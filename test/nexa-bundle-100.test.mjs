import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../field-service-ops/server/store.mjs';
import { createFieldServiceServer, runtimeOptions as fieldRuntimeOptions, createRuntimeStore } from '../field-service-ops/server/app.mjs';
import { createInquiryStore, InquiryError } from '../nexa-tech-service/server/inquiry-store.mjs';
import { createInquiryServer, createFieldOpsClient, runtimeInquiryOptions, createRuntimeInquiryStore, createRuntimeFieldOpsClient } from '../nexa-tech-service/server/app.mjs';

const ADMIN_TOKEN = 'bundle-admin-token-123456789';
const FIELD_TOKEN = 'bundle-field-token-123456789';
const adminAuth = { authorization: `Bearer ${ADMIN_TOKEN}` };
const fieldAuth = { authorization: `Bearer ${FIELD_TOKEN}` };

const inquiryPayload = (overrides = {}) => ({
  company: 'NEXA 연동 고객',
  name: '김담당',
  phone: '010-1234-5678',
  email: 'ops@example.com',
  industry: '생산·인쇄·제조',
  sites: '1개 사업장',
  assets: '1–5대',
  impact: '생산·영업 등 핵심 업무가 멈춤',
  service: '고장·장애 현장지원',
  engagement: '고장 날 때 현장지원',
  detail: '주요 출력장비가 멈춰 현장 확인과 방문 지원이 필요합니다.',
  consent: true,
  ...overrides
});

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

async function closeServer(server) {
  server.close();
  await once(server, 'close');
}

async function request(base, path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) }
  });
  return { response, body: await response.json() };
}

test('field operations creates one REQUESTED job for repeated Idempotency-Key requests', async () => {
  const store = createStore();
  const server = createFieldServiceServer(store, {
    requireAuth: true,
    principals: [{ token: FIELD_TOKEN, id: 'nexa-inquiry-service', role: 'STAFF' }],
    allowedOrigins: ['https://ops.example']
  });
  const base = await listen(server);
  try {
    const payload = { customerName: 'Handoff Co', address: '서울시 테스트구 100', summary: '상담에서 전환된 방문 요청', priority: 'URGENT' };
    const first = await request(base, '/api/jobs', { method: 'POST', headers: { ...fieldAuth, 'idempotency-key': 'nexa-inquiry-NX-TEST123456-visit-v1' }, body: JSON.stringify(payload) });
    const second = await request(base, '/api/jobs', { method: 'POST', headers: { ...fieldAuth, 'idempotency-key': 'nexa-inquiry-NX-TEST123456-visit-v1' }, body: JSON.stringify(payload) });
    assert.equal(first.response.status, 201);
    assert.equal(first.body.status, 'REQUESTED');
    assert.equal(first.body.idempotentReplay, false);
    assert.equal(second.response.status, 200);
    assert.equal(second.body.id, first.body.id);
    assert.equal(second.body.idempotentReplay, true);
    const jobs = await request(base, '/api/jobs?status=REQUESTED', { headers: fieldAuth });
    assert.equal(jobs.body.items.filter(item => item.customerName === 'Handoff Co').length, 1);
    const audits = await request(base, `/api/audits?jobId=${first.body.id}`, { headers: fieldAuth });
    assert.equal(audits.body.items.filter(item => item.action === 'CREATE').length, 1);
    assert.equal(audits.body.items[0].actor, 'nexa-inquiry-service');
  } finally {
    await closeServer(server);
  }
});

test('NEXA consultation flows end-to-end into one Field Ops visit job and then closes', async () => {
  const fieldStore = createStore();
  const fieldServer = createFieldServiceServer(fieldStore, {
    requireAuth: true,
    principals: [{ token: FIELD_TOKEN, id: 'nexa-inquiry-service', role: 'STAFF' }],
    allowedOrigins: ['https://ops.example']
  });
  const fieldBase = await listen(fieldServer);

  const inquiryStore = createInquiryStore();
  const inquiryServer = createInquiryServer(inquiryStore, {
    admins: [{ token: ADMIN_TOKEN, id: 'service-coordinator' }],
    requireAdminConfig: true,
    allowedOrigins: ['https://nexa.example'],
    fieldOpsClient: createFieldOpsClient({ baseUrl: fieldBase, token: FIELD_TOKEN })
  });
  const inquiryBase = await listen(inquiryServer);

  try {
    const created = await request(inquiryBase, '/api/inquiries', { method: 'POST', body: JSON.stringify(inquiryPayload()) });
    assert.equal(created.response.status, 201);
    const id = created.body.id;

    const contacted = await request(inquiryBase, `/api/admin/inquiries/${id}/contacted`, { method: 'POST', headers: adminAuth, body: JSON.stringify({ expectedVersion: 1 }) });
    assert.equal(contacted.body.status, 'CONTACTED');
    assert.equal(contacted.body.version, 2);

    const handoff = await request(inquiryBase, `/api/admin/inquiries/${id}/visit-request`, {
      method: 'POST',
      headers: adminAuth,
      body: JSON.stringify({ expectedVersion: 2, address: '서울시 테스트구 현장로 101', summary: '출력장비 업무중단 현장 점검', priority: 'URGENT' })
    });
    assert.equal(handoff.response.status, 201);
    assert.equal(handoff.body.handoff.state, 'COMPLETED');
    assert.equal(handoff.body.fieldJob.status, 'REQUESTED');
    assert.equal(handoff.body.fieldJob.customerName, 'NEXA 연동 고객');
    assert.equal(handoff.body.fieldJob.address, '서울시 테스트구 현장로 101');
    assert.equal(handoff.body.inquiry.version, 4);
    const fieldJobId = handoff.body.fieldJob.id;

    const replay = await request(inquiryBase, `/api/admin/inquiries/${id}/visit-request`, {
      method: 'POST',
      headers: adminAuth,
      body: JSON.stringify({ expectedVersion: 2, address: '무시되어야 할 재전송 주소', summary: '중복 요청', priority: 'NORMAL' })
    });
    assert.equal(replay.response.status, 200);
    assert.equal(replay.body.handoff.fieldJobId, fieldJobId);

    const requestedJobs = await request(fieldBase, '/api/jobs?status=REQUESTED', { headers: fieldAuth });
    assert.equal(requestedJobs.body.items.filter(item => item.customerName === 'NEXA 연동 고객').length, 1);

    const fieldAudits = await request(fieldBase, `/api/audits?jobId=${fieldJobId}`, { headers: fieldAuth });
    assert.ok(fieldAudits.body.items.some(item => item.action === 'CREATE' && item.actor === 'nexa-inquiry-service'));

    const inquiryAudits = await request(inquiryBase, `/api/admin/inquiries/${id}/audits`, { headers: adminAuth });
    assert.ok(inquiryAudits.body.items.some(item => item.action === 'VISIT_REQUEST_PREPARED' && item.actor === 'service-coordinator'));
    assert.ok(inquiryAudits.body.items.some(item => item.action === 'VISIT_REQUEST_CREATED' && item.actor === 'service-coordinator'));

    const closed = await request(inquiryBase, `/api/admin/inquiries/${id}/close`, { method: 'POST', headers: adminAuth, body: JSON.stringify({ expectedVersion: 4 }) });
    assert.equal(closed.response.status, 200);
    assert.equal(closed.body.status, 'CLOSED');
    assert.equal(closed.body.version, 5);
    assert.equal(closed.body.handoff.fieldJobId, fieldJobId);
  } finally {
    await closeServer(inquiryServer);
    inquiryStore.close();
    await closeServer(fieldServer);
  }
});

test('failed Field Ops handoff stays pending, blocks close and resumes safely with the same key', async () => {
  const store = createInquiryStore();
  let attempts = 0;
  const keys = [];
  const fieldOpsClient = {
    async createVisitRequest({ handoff }) {
      attempts += 1;
      keys.push(handoff.idempotencyKey);
      if (attempts === 1) throw new InquiryError(502, 'FIELD_OPS_UNAVAILABLE', 'temporary failure');
      return { id: 77, status: 'REQUESTED', idempotentReplay: true };
    }
  };
  const server = createInquiryServer(store, {
    admins: [{ token: ADMIN_TOKEN, id: 'service-coordinator' }],
    requireAdminConfig: true,
    fieldOpsClient
  });
  const base = await listen(server);
  try {
    const created = await request(base, '/api/inquiries', { method: 'POST', body: JSON.stringify(inquiryPayload({ company: 'Retry Client' })) });
    const id = created.body.id;
    await request(base, `/api/admin/inquiries/${id}/contacted`, { method: 'POST', headers: adminAuth, body: JSON.stringify({ expectedVersion: 1 }) });

    const failed = await request(base, `/api/admin/inquiries/${id}/visit-request`, { method: 'POST', headers: adminAuth, body: JSON.stringify({ expectedVersion: 2, address: '부산시 재시도구 55', priority: 'NORMAL' }) });
    assert.equal(failed.response.status, 502);
    assert.equal(store.get(id).handoff.state, 'PENDING');
    assert.equal(store.get(id).version, 3);

    const closePending = await request(base, `/api/admin/inquiries/${id}/close`, { method: 'POST', headers: adminAuth, body: JSON.stringify({ expectedVersion: 3 }) });
    assert.equal(closePending.response.status, 409);
    assert.equal(closePending.body.error.code, 'VISIT_HANDOFF_PENDING');

    const retried = await request(base, `/api/admin/inquiries/${id}/visit-request`, { method: 'POST', headers: adminAuth, body: JSON.stringify({ expectedVersion: 2, address: '다른 값은 사용하지 않음', priority: 'URGENT' }) });
    assert.equal(retried.response.status, 200);
    assert.equal(retried.body.handoff.state, 'COMPLETED');
    assert.equal(retried.body.handoff.fieldJobId, 77);
    assert.equal(attempts, 2);
    assert.equal(keys[0], keys[1]);
  } finally {
    await closeServer(server);
    store.close();
  }
});

test('production runtimes fail closed when persistence, identity or origin configuration is incomplete', async () => {
  const principals = JSON.stringify([{ token: FIELD_TOKEN, id: 'dispatcher-1', name: 'Dispatcher', role: 'STAFF' }]);
  const agents = JSON.stringify([{ id: 1, name: 'Field Agent 1', region: 'Central', active: true }]);

  assert.throws(() => fieldRuntimeOptions({ NODE_ENV: 'production', NEXA_OPS_PRINCIPALS_JSON: principals }), /NEXA_OPS_ALLOWED_ORIGINS/);
  assert.throws(() => fieldRuntimeOptions({ NODE_ENV: 'production', NEXA_OPS_PRINCIPALS_JSON: principals, NEXA_OPS_ALLOWED_ORIGINS: '*' }), /must not contain \*/);
  assert.throws(() => createRuntimeStore({ NODE_ENV: 'production', NEXA_OPS_AGENTS_JSON: agents }), /NEXA_OPS_DB_PATH/);
  assert.throws(() => createRuntimeStore({ NODE_ENV: 'production', NEXA_OPS_DB_PATH: ':memory:', NEXA_OPS_AGENTS_JSON: agents }), /persistent storage/);
  assert.throws(() => createRuntimeStore({ NODE_ENV: 'production', NEXA_OPS_DB_PATH: '/tmp/nexa-unused.sqlite' }), /NEXA_OPS_AGENTS_JSON/);

  const admins = JSON.stringify([{ token: ADMIN_TOKEN, id: 'service-coordinator' }]);
  assert.throws(() => runtimeInquiryOptions({ NODE_ENV: 'production', NEXA_INQUIRY_ALLOWED_ORIGINS: '*', NEXA_INQUIRY_ADMINS_JSON: admins }), /must not contain \*/);
  assert.throws(() => runtimeInquiryOptions({ NODE_ENV: 'production', NEXA_INQUIRY_ALLOWED_ORIGINS: 'https://nexa.example', NEXA_INQUIRY_ADMINS_JSON: admins, NEXA_INQUIRY_RATE_MAX: '0' }), /positive integer/);
  assert.throws(() => createRuntimeInquiryStore({ NODE_ENV: 'production' }), /NEXA_INQUIRY_DB_PATH/);
  assert.throws(() => createRuntimeInquiryStore({ NODE_ENV: 'production', NEXA_INQUIRY_DB_PATH: ':memory:' }), /persistent storage/);
  assert.throws(() => createRuntimeFieldOpsClient({ NODE_ENV: 'production' }), /NEXA_FIELD_OPS_URL/);
  assert.throws(() => createRuntimeFieldOpsClient({ NODE_ENV: 'production', NEXA_FIELD_OPS_URL: 'http://ops.example', NEXA_FIELD_OPS_SERVICE_TOKEN: FIELD_TOKEN }), /must use HTTPS/);

  const directory = await mkdtemp(join(tmpdir(), 'nexa-bundle-prod-'));
  try {
    const fieldStore = createRuntimeStore({ NODE_ENV: 'production', NEXA_OPS_DB_PATH: join(directory, 'ops.sqlite'), NEXA_OPS_AGENTS_JSON: agents });
    assert.equal(fieldStore.listAgents().length, 1);
    fieldStore.close();
    const inquiryStore = createRuntimeInquiryStore({ NODE_ENV: 'production', NEXA_INQUIRY_DB_PATH: join(directory, 'inquiry.sqlite') });
    inquiryStore.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
