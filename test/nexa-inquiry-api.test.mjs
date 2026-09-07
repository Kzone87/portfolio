import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInquiryServer, runtimeInquiryOptions } from '../nexa-tech-service/server/app.mjs';
import { createInquiryStore } from '../nexa-tech-service/server/inquiry-store.mjs';

const ADMIN_TOKEN = 'inquiry-admin-token-123456789';
const ADMIN = [{ token: ADMIN_TOKEN, id: 'service-coordinator' }];
const auth = token => ({ authorization: `Bearer ${token}` });
const validInquiry = (overrides = {}) => ({
  company: '모노상사',
  name: '김담당',
  phone: '010-1234-5678',
  email: 'contact@example.com',
  industry: '생산·인쇄·제조',
  sites: '2–5개 사업장',
  assets: '6–20대',
  impact: '처리량·품질에 큰 영향이 생김',
  service: '고장·장애 현장지원',
  engagement: '정기관리 방식 검토',
  detail: '지점별 장비 장애 요청과 방문 일정을 한곳에서 관리하고 싶습니다.',
  consent: true,
  ...overrides
});

async function withServer(run, options = {}) {
  const store = options.store || createInquiryStore();
  const server = createInquiryServer(store, options.serverOptions || {});
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  try { await run(base, store); }
  finally {
    server.close();
    await once(server, 'close');
    store.close?.();
  }
}

async function request(base, path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) }
  });
  return { response, body: await response.json() };
}

test('public inquiry endpoint validates and stores a PENDING consultation', async () => withServer(async (base, store) => {
  const invalid = await request(base, '/api/inquiries', { method: 'POST', body: JSON.stringify(validInquiry({ company: 'A' })) });
  assert.equal(invalid.response.status, 400);
  assert.equal(invalid.body.error.code, 'INVALID_COMPANY');
  assert.equal(store.list().length, 0);

  const created = await request(base, '/api/inquiries', { method: 'POST', body: JSON.stringify(validInquiry()) });
  assert.equal(created.response.status, 201);
  assert.match(created.body.id, /^NX-[A-F0-9]{12}$/);
  assert.equal(created.body.status, 'PENDING');
  assert.equal(created.body.version, 1);
  const stored = store.get(created.body.id);
  assert.equal(stored.company, '모노상사');
  assert.equal(stored.phone, '010-1234-5678');
  assert.equal(stored.status, 'PENDING');
}));

test('public inquiry endpoint rate-limits repeated submissions', async () => withServer(async base => {
  const first = await request(base, '/api/inquiries', { method: 'POST', body: JSON.stringify(validInquiry({ detail: '첫 번째 상담 요청입니다. 충분한 길이의 설명입니다.' })) });
  const second = await request(base, '/api/inquiries', { method: 'POST', body: JSON.stringify(validInquiry({ detail: '두 번째 상담 요청입니다. 충분한 길이의 설명입니다.' })) });
  const third = await request(base, '/api/inquiries', { method: 'POST', body: JSON.stringify(validInquiry({ detail: '세 번째 상담 요청입니다. 충분한 길이의 설명입니다.' })) });
  assert.equal(first.response.status, 201);
  assert.equal(second.response.status, 201);
  assert.equal(third.response.status, 429);
  assert.equal(third.body.error.code, 'RATE_LIMITED');
}, { serverOptions: { rateMax: 2, rateWindowMs: 60_000 } }));

test('admin workflow requires authentication and enforces versioned status transitions', async () => withServer(async base => {
  const created = await request(base, '/api/inquiries', { method: 'POST', body: JSON.stringify(validInquiry()) });
  const id = created.body.id;

  const unauthenticated = await request(base, '/api/admin/inquiries');
  assert.equal(unauthenticated.response.status, 401);
  assert.equal(unauthenticated.body.error.code, 'AUTH_REQUIRED');

  const badToken = await request(base, '/api/admin/inquiries', { headers: auth('wrong-admin-token-123456789') });
  assert.equal(badToken.response.status, 401);
  assert.equal(badToken.body.error.code, 'INVALID_AUTH_TOKEN');

  const pending = await request(base, '/api/admin/inquiries?status=PENDING', { headers: auth(ADMIN_TOKEN) });
  assert.equal(pending.response.status, 200);
  assert.ok(pending.body.items.some(item => item.id === id));

  const contacted = await request(base, `/api/admin/inquiries/${id}/contacted`, {
    method: 'POST',
    headers: auth(ADMIN_TOKEN),
    body: JSON.stringify({ expectedVersion: 1, actor: 'forged-user' })
  });
  assert.equal(contacted.response.status, 200);
  assert.equal(contacted.body.status, 'CONTACTED');
  assert.equal(contacted.body.version, 2);

  const stale = await request(base, `/api/admin/inquiries/${id}/close`, {
    method: 'POST',
    headers: auth(ADMIN_TOKEN),
    body: JSON.stringify({ expectedVersion: 1 })
  });
  assert.equal(stale.response.status, 409);
  assert.equal(stale.body.error.code, 'STALE_INQUIRY');

  const closed = await request(base, `/api/admin/inquiries/${id}/close`, {
    method: 'POST',
    headers: auth(ADMIN_TOKEN),
    body: JSON.stringify({ expectedVersion: 2 })
  });
  assert.equal(closed.response.status, 200);
  assert.equal(closed.body.status, 'CLOSED');
  assert.equal(closed.body.version, 3);

  const audits = await request(base, `/api/admin/inquiries/${id}/audits`, { headers: auth(ADMIN_TOKEN) });
  assert.equal(audits.body.items.length, 2);
  assert.ok(audits.body.items.every(item => item.actor === 'service-coordinator'));
  assert.deepEqual(audits.body.items.map(item => item.toStatus), ['CLOSED', 'CONTACTED']);
}, { serverOptions: { admins: ADMIN, requireAdminConfig: true } }));

test('inquiry API applies an explicit browser origin allowlist', async () => withServer(async base => {
  const denied = await request(base, '/api/inquiries', {
    method: 'POST',
    headers: { origin: 'https://attacker.example' },
    body: JSON.stringify(validInquiry())
  });
  assert.equal(denied.response.status, 403);
  assert.equal(denied.body.error.code, 'ORIGIN_NOT_ALLOWED');

  const allowed = await request(base, '/api/inquiries', {
    method: 'POST',
    headers: { origin: 'https://nexa.example' },
    body: JSON.stringify(validInquiry())
  });
  assert.equal(allowed.response.status, 201);
  assert.equal(allowed.response.headers.get('access-control-allow-origin'), 'https://nexa.example');
}, { serverOptions: { allowedOrigins: ['https://nexa.example'] } }));

test('inquiry SQLite store persists customer request and workflow state across restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nexa-inquiry-'));
  const dbPath = join(directory, 'inquiries.sqlite');
  try {
    const first = createInquiryStore(dbPath);
    const created = first.create(validInquiry());
    first.transition(created.id, 1, 'CONTACTED', 'service-coordinator');
    first.close();

    const second = createInquiryStore(dbPath);
    const restored = second.get(created.id);
    assert.equal(restored.status, 'CONTACTED');
    assert.equal(restored.version, 2);
    assert.equal(restored.detail, validInquiry().detail);
    const audits = second.audits(created.id);
    assert.equal(audits.length, 1);
    assert.equal(audits[0].actor, 'service-coordinator');
    second.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('production inquiry runtime refuses missing origin and admin configuration', () => {
  assert.throws(() => runtimeInquiryOptions({ NODE_ENV: 'production' }), /NEXA_INQUIRY_ALLOWED_ORIGINS/);
  assert.throws(() => runtimeInquiryOptions({ NODE_ENV: 'production', NEXA_INQUIRY_ALLOWED_ORIGINS: 'https:\/\/nexa.example' }), /NEXA_INQUIRY_ADMINS_JSON/);
  const options = runtimeInquiryOptions({
    NODE_ENV: 'production',
    NEXA_INQUIRY_ALLOWED_ORIGINS: 'https://nexa.example',
    NEXA_INQUIRY_ADMINS_JSON: JSON.stringify(ADMIN)
  });
  assert.deepEqual(options.allowedOrigins, ['https://nexa.example']);
  assert.equal(options.admins[0].id, 'service-coordinator');
});

test('customer form preserves public preview honesty while supporting a configured real intake API', async () => {
  const html = await readFile(new URL('../nexa-tech-service/contact.html', import.meta.url), 'utf8');
  const app = await readFile(new URL('../nexa-tech-service/app.js', import.meta.url), 'utf8');
  assert.match(html, /이 공개 페이지에서는 상담 내용을 서버로 전송하지 않습니다/);
  assert.match(app, /window\.NEXA_INQUIRY_ENDPOINT/);
  assert.match(app, /fetch\(`\$\{inquiryEndpoint\}\/api\/inquiries`/);
  assert.match(app, /상담 요청 보내기/);
  assert.match(app, /상담 요청이 접수되었습니다/);
  assert.match(app, /접수번호/);
  assert.match(app, /상담 내용을 정리했습니다/);
  assert.match(app, /navigator\.clipboard/);
});
