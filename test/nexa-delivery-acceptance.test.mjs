import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createStore } from '../field-service-ops/server/store.mjs';
import { createAuthStore } from '../field-service-ops/server/auth-store.mjs';
import { createFieldServiceServer } from '../field-service-ops/server/app.mjs';
import { createInquiryStore } from '../nexa-tech-service/server/inquiry-store.mjs';
import { createInquiryServer, createFieldOpsClient } from '../nexa-tech-service/server/app.mjs';

const OPS_ORIGIN = 'https://ops.nexa.example';
const CUSTOMER_ORIGIN = 'https://service.nexa.example';
const adminPassword = ['acceptance', 'fixture', 'admin'].join('-');
const serviceToken = ['acceptance', 'fixture', 'service', '000000000000'].join('-');

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

async function stop(server) {
  if (!server.listening) return;
  server.close();
  await once(server, 'close');
}

async function json(root, path, options = {}) {
  const response = await fetch(`${root}${path}`, {
    method: options.method || 'GET',
    headers: {
      accept: 'application/json',
      ...(options.origin ? { origin: options.origin } : {}),
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...(options.csrf ? { 'x-csrf-token': options.csrf } : {}),
      ...(options.authorization ? { authorization: options.authorization } : {}),
      ...(options.body ? { 'content-type': 'application/json' } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  return { response, body: await response.json().catch(() => ({})) };
}

async function login(opsRoot) {
  const result = await json(opsRoot, '/api/auth/login', {
    method: 'POST',
    origin: OPS_ORIGIN,
    body: { username: 'acceptance-admin', password: adminPassword }
  });
  assert.equal(result.response.status, 200);
  const cookie = String(result.response.headers.get('set-cookie') || '').split(';')[0];
  assert.match(cookie, /^nexa_ops_session=/);
  assert.ok(result.body.csrfToken);
  return { cookie, csrf: result.body.csrfToken, principal: result.body.principal };
}

const inquiryPayload = {
  company: '인수검수상사',
  name: '고객담당자',
  phone: '010-2468-1357',
  email: 'customer@example.com',
  industry: '기업·교육·공공 사무환경',
  sites: '1개 사업장',
  assets: '1–5대',
  impact: '처리량·품질에 큰 영향이 생김',
  service: '고장·장애 현장지원',
  engagement: '고장 날 때 현장지원',
  detail: '출력 품질이 불안정해서 현장 방문 점검이 필요합니다.',
  consent: true
};

test('NEXA delivery acceptance: customer to staff to field service and back', async () => {
  const fieldStore = createStore();
  const authStore = createAuthStore(':memory:', {
    bootstrapAdmin: {
      id: 'acceptance-admin',
      username: 'acceptance-admin',
      name: '검수 관리자',
      team: '서비스 운영팀',
      password: adminPassword
    }
  });
  const inquiryStore = createInquiryStore();

  const opsServer = createFieldServiceServer(fieldStore, {
    requireAuth: true,
    authStore,
    inquiryStore,
    principals: [{ token: serviceToken, id: 'nexa-inquiry-service', name: 'NEXA Inquiry Service', role: 'STAFF' }],
    allowedOrigins: [OPS_ORIGIN]
  });
  const opsRoot = await listen(opsServer);

  const fieldOpsClient = createFieldOpsClient({ baseUrl: opsRoot, token: serviceToken });
  const inquiryServer = createInquiryServer(inquiryStore, {
    allowedOrigins: [CUSTOMER_ORIGIN],
    fieldOpsClient,
    rateWindowMs: 60_000,
    rateMax: 50
  });
  const inquiryRoot = await listen(inquiryServer);

  try {
    const ready = await json(opsRoot, '/api/ready', { origin: OPS_ORIGIN });
    assert.equal(ready.response.status, 200);
    assert.equal(ready.body.ready, true);

    const created = await json(inquiryRoot, '/api/inquiries', {
      method: 'POST',
      origin: CUSTOMER_ORIGIN,
      body: inquiryPayload
    });
    assert.equal(created.response.status, 201);
    const inquiryId = created.body.id;
    assert.match(inquiryId, /^NX-/);

    const wrongLookup = await json(inquiryRoot, '/api/customer/requests/lookup', {
      method: 'POST',
      origin: CUSTOMER_ORIGIN,
      body: { id: inquiryId, phone: '010-0000-0000' }
    });
    assert.equal(wrongLookup.response.status, 404);
    assert.equal(wrongLookup.body.error.code, 'CUSTOMER_REQUEST_NOT_FOUND');

    const session = await login(opsRoot);
    assert.equal(session.principal.role, 'ADMIN');

    const csrfBlocked = await json(opsRoot, `/api/inquiries/${inquiryId}/contacted`, {
      method: 'POST',
      origin: OPS_ORIGIN,
      cookie: session.cookie,
      body: { expectedVersion: 1 }
    });
    assert.equal(csrfBlocked.response.status, 403);
    assert.equal(csrfBlocked.body.error.code, 'CSRF_REQUIRED');

    const contacted = await json(opsRoot, `/api/inquiries/${inquiryId}/contacted`, {
      method: 'POST',
      origin: OPS_ORIGIN,
      cookie: session.cookie,
      csrf: session.csrf,
      body: { expectedVersion: 1 }
    });
    assert.equal(contacted.response.status, 200);
    assert.equal(contacted.body.status, 'CONTACTED');

    const visit = await json(opsRoot, `/api/inquiries/${inquiryId}/visit-request`, {
      method: 'POST',
      origin: OPS_ORIGIN,
      cookie: session.cookie,
      csrf: session.csrf,
      body: {
        expectedVersion: contacted.body.version,
        address: '서울 중구 세종대로 20',
        summary: '디지털 인쇄장비 출력 품질 현장 점검',
        priority: 'NORMAL'
      }
    });
    assert.equal(visit.response.status, 201);
    const jobId = visit.body.fieldJob.id;
    assert.equal(visit.body.handoff.state, 'COMPLETED');

    const jobBeforeSchedule = await json(opsRoot, `/api/jobs/${jobId}`, {
      origin: OPS_ORIGIN,
      cookie: session.cookie
    });
    assert.equal(jobBeforeSchedule.response.status, 200);

    const scheduled = await json(opsRoot, `/api/jobs/${jobId}/schedule`, {
      method: 'POST',
      origin: OPS_ORIGIN,
      cookie: session.cookie,
      csrf: session.csrf,
      body: {
        expectedVersion: jobBeforeSchedule.body.version,
        agentId: 1,
        startAt: '2026-09-09T05:00:00.000Z',
        endAt: '2026-09-09T06:00:00.000Z'
      }
    });
    assert.equal(scheduled.response.status, 200);
    assert.equal(scheduled.body.status, 'SCHEDULED');

    const customerView = await json(inquiryRoot, '/api/customer/requests/lookup', {
      method: 'POST',
      origin: CUSTOMER_ORIGIN,
      body: { id: inquiryId, phone: inquiryPayload.phone }
    });
    assert.equal(customerView.response.status, 200);
    assert.equal(customerView.body.visit.status, 'SCHEDULED');
    assert.equal(customerView.body.visit.startAt, '2026-09-09T05:00:00.000Z');

    const customerAction = await json(inquiryRoot, '/api/customer/requests/action', {
      method: 'POST',
      origin: CUSTOMER_ORIGIN,
      body: {
        id: inquiryId,
        phone: inquiryPayload.phone,
        type: 'RESCHEDULE',
        note: '9월 10일 오후 방문으로 변경 부탁드립니다.',
        preferredAt: '2026-09-10 14:00 이후'
      }
    });
    assert.equal(customerAction.response.status, 201);
    assert.equal(customerAction.body.action.state, 'OPEN');
    const customerActionId = customerAction.body.action.id;

    const duplicateAction = await json(inquiryRoot, '/api/customer/requests/action', {
      method: 'POST',
      origin: CUSTOMER_ORIGIN,
      body: {
        id: inquiryId,
        phone: inquiryPayload.phone,
        type: 'RESCHEDULE',
        note: '같은 일정 변경 요청을 다시 보냅니다.',
        preferredAt: '2026-09-10 15:00 이후'
      }
    });
    assert.equal(duplicateAction.response.status, 409);
    assert.equal(duplicateAction.body.error.code, 'CUSTOMER_ACTION_ALREADY_OPEN');

    const inbox = await json(opsRoot, `/api/inquiries/${inquiryId}`, {
      origin: OPS_ORIGIN,
      cookie: session.cookie
    });
    assert.equal(inbox.response.status, 200);
    assert.ok(inbox.body.customerActions.some(action => action.id === customerActionId && action.state === 'OPEN'));

    const staleReschedule = await json(opsRoot, `/api/jobs/${jobId}/reschedule`, {
      method: 'POST',
      origin: OPS_ORIGIN,
      cookie: session.cookie,
      csrf: session.csrf,
      body: {
        expectedVersion: scheduled.body.version - 1,
        agentId: 1,
        startAt: '2026-09-10T05:00:00.000Z',
        endAt: '2026-09-10T06:00:00.000Z'
      }
    });
    assert.equal(staleReschedule.response.status, 409);
    assert.equal(staleReschedule.body.error.code, 'STALE_JOB');

    const rescheduled = await json(opsRoot, `/api/jobs/${jobId}/reschedule`, {
      method: 'POST',
      origin: OPS_ORIGIN,
      cookie: session.cookie,
      csrf: session.csrf,
      body: {
        expectedVersion: scheduled.body.version,
        agentId: 1,
        startAt: '2026-09-10T05:00:00.000Z',
        endAt: '2026-09-10T06:00:00.000Z'
      }
    });
    assert.equal(rescheduled.response.status, 200);

    const decision = await json(opsRoot, `/api/inquiries/${inquiryId}/customer-actions/${customerActionId}/decision`, {
      method: 'POST',
      origin: OPS_ORIGIN,
      cookie: session.cookie,
      csrf: session.csrf,
      body: { decision: 'RESOLVED', resolution: '9월 10일 14:00 방문으로 일정을 변경했습니다.' }
    });
    assert.equal(decision.response.status, 200);
    assert.equal(decision.body.state, 'RESOLVED');
    assert.equal(decision.body.resolvedBy, 'acceptance-admin');

    const customerViewAfter = await json(inquiryRoot, '/api/customer/requests/lookup', {
      method: 'POST',
      origin: CUSTOMER_ORIGIN,
      body: { id: inquiryId, phone: inquiryPayload.phone }
    });
    assert.equal(customerViewAfter.response.status, 200);
    assert.equal(customerViewAfter.body.visit.startAt, '2026-09-10T05:00:00.000Z');
    assert.ok(customerViewAfter.body.customerActions.some(action => action.id === customerActionId && action.state === 'RESOLVED' && action.resolution.includes('일정을 변경')));

    let currentJob = rescheduled.body;
    for (const suffix of ['dispatch', 'on-site', 'complete']) {
      const next = await json(opsRoot, `/api/jobs/${jobId}/${suffix}`, {
        method: 'POST',
        origin: OPS_ORIGIN,
        cookie: session.cookie,
        csrf: session.csrf,
        body: { expectedVersion: currentJob.version }
      });
      assert.equal(next.response.status, 200);
      currentJob = next.body;
    }
    assert.equal(currentJob.status, 'COMPLETED');

    const latestInquiry = await json(opsRoot, `/api/inquiries/${inquiryId}`, {
      origin: OPS_ORIGIN,
      cookie: session.cookie
    });
    const closed = await json(opsRoot, `/api/inquiries/${inquiryId}/close`, {
      method: 'POST',
      origin: OPS_ORIGIN,
      cookie: session.cookie,
      csrf: session.csrf,
      body: { expectedVersion: latestInquiry.body.version }
    });
    assert.equal(closed.response.status, 200);
    assert.equal(closed.body.status, 'CLOSED');

    const finalCustomerView = await json(inquiryRoot, '/api/customer/requests/lookup', {
      method: 'POST',
      origin: CUSTOMER_ORIGIN,
      body: { id: inquiryId, phone: inquiryPayload.phone }
    });
    assert.equal(finalCustomerView.response.status, 200);
    assert.equal(finalCustomerView.body.status, 'CLOSED');
    assert.equal(finalCustomerView.body.visit.status, 'COMPLETED');
    assert.ok(finalCustomerView.body.updates.some(update => update.title === '현장 작업 완료'));
  } finally {
    await stop(inquiryServer);
    await stop(opsServer);
    inquiryStore.close();
    authStore.close();
    fieldStore.close?.();
  }
});
