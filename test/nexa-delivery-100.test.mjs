import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createStore } from '../field-service-ops/server/store.mjs';
import { createAuthStore, AuthError } from '../field-service-ops/server/auth-store.mjs';
import { createFieldServiceServer } from '../field-service-ops/server/app.mjs';
import { createInquiryStore } from '../nexa-tech-service/server/inquiry-store.mjs';

const load = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const ORIGIN = 'https://ops.nexa.example';

async function startDeliveryServer() {
  const fieldStore = createStore();
  const authStore = createAuthStore(':memory:', {
    bootstrapAdmin: {
      id: 'ops-admin',
      username: 'admin',
      name: '김현수',
      team: '서울 운영팀',
      password: 'delivery-admin-123'
    }
  });
  const inquiryStore = createInquiryStore();
  const server = createFieldServiceServer(fieldStore, {
    requireAuth: true,
    authStore,
    inquiryStore,
    allowedOrigins: [ORIGIN]
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  return {
    root: `http://127.0.0.1:${address.port}`,
    server,
    fieldStore,
    authStore,
    inquiryStore,
    async close() {
      server.close();
      await once(server, 'close');
      authStore.close();
      inquiryStore.close();
    }
  };
}

async function login(root, username = 'admin', password = 'delivery-admin-123') {
  const response = await fetch(`${root}/api/auth/login`, {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const payload = await response.json();
  const cookie = String(response.headers.get('set-cookie') || '').split(';')[0];
  return { response, payload, cookie };
}

function sessionHeaders(session, extra = {}) {
  return { origin: ORIGIN, cookie: session.cookie, 'x-csrf-token': session.payload.csrfToken, ...extra };
}

test('delivery auth store keeps password credentials server-side and revokes sessions on account changes', () => {
  const auth = createAuthStore(':memory:', {
    bootstrapAdmin: { id: 'admin-1', username: 'admin', name: '관리자', team: '운영팀', password: 'strong-admin-123' }
  });
  try {
    assert.throws(() => auth.login('admin', 'wrong-password'), error => error instanceof AuthError && error.code === 'AUTH_FAILED');
    const first = auth.login('admin', 'strong-admin-123');
    assert.equal(first.principal.role, 'ADMIN');
    assert.ok(first.token.length > 30);
    assert.equal(auth.resolveSession(first.token).principal.id, 'admin-1');

    const staff = auth.createUser({ id: 'staff-1', username: 'staff1', name: '배차직원', team: '운영팀', role: 'STAFF', password: 'strong-staff-123' }, 'admin-1');
    assert.equal(staff.role, 'STAFF');
    const staffSession = auth.login('staff1', 'strong-staff-123');
    auth.resetPassword('staff-1', 'changed-staff-456', 'admin-1');
    assert.throws(() => auth.resolveSession(staffSession.token), error => error instanceof AuthError && error.code === 'SESSION_INVALID');
    assert.equal(auth.login('staff1', 'changed-staff-456').principal.id, 'staff-1');

    assert.throws(() => auth.updateUser('admin-1', { active: false }, 'admin-1'), error => error instanceof AuthError && error.code === 'LAST_ADMIN_REQUIRED');
  } finally {
    auth.close();
  }
});

test('production browser session uses HttpOnly cookie, CSRF and server-side role identity', async () => {
  const runtime = await startDeliveryServer();
  try {
    const session = await login(runtime.root);
    assert.equal(session.response.status, 200);
    const cookieHeader = session.response.headers.get('set-cookie') || '';
    assert.match(cookieHeader, /nexa_ops_session=/);
    assert.match(cookieHeader, /HttpOnly/i);
    assert.match(cookieHeader, /SameSite=Lax/i);
    assert.equal(session.payload.principal.id, 'ops-admin');
    assert.ok(session.payload.csrfToken);

    const me = await fetch(`${runtime.root}/api/me`, { headers: { origin: ORIGIN, cookie: session.cookie } });
    assert.equal(me.status, 200);
    const principal = await me.json();
    assert.equal(principal.role, 'ADMIN');
    assert.equal(principal.name, '김현수');

    const rejected = await fetch(`${runtime.root}/api/jobs`, {
      method: 'POST',
      headers: { origin: ORIGIN, cookie: session.cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ customerName: '위조 고객', address: '서울 중구 테스트로 1', summary: '권한 위조 테스트', priority: 'NORMAL', actor: 'attacker', role: 'ADMIN' })
    });
    assert.equal(rejected.status, 403);
    assert.equal((await rejected.json()).error.code, 'CSRF_REQUIRED');

    const created = await fetch(`${runtime.root}/api/jobs`, {
      method: 'POST',
      headers: sessionHeaders(session, { 'content-type': 'application/json' }),
      body: JSON.stringify({ customerName: '세션 고객', address: '서울 중구 테스트로 2', summary: '세션 기반 방문 요청', priority: 'NORMAL', actor: 'attacker', role: 'STAFF' })
    });
    assert.equal(created.status, 201);
    const job = await created.json();
    const audit = runtime.fieldStore.listAudits(job.id)[0];
    assert.equal(audit.actor, 'ops-admin');
  } finally {
    await runtime.close();
  }
});

test('employee inquiry desk can process inquiry to field job and cannot close while field work is active', async () => {
  const runtime = await startDeliveryServer();
  try {
    const createdInquiry = runtime.inquiryStore.create({
      company: '납품테스트상사',
      name: '고객담당자',
      phone: '010-1111-2222',
      email: 'customer@example.com',
      industry: '기업·교육·공공 사무환경',
      sites: '1개 사업장',
      assets: '1–5대',
      impact: '처리량·품질에 큰 영향이 생김',
      service: '고장·장애 현장지원',
      engagement: '고장 날 때 현장지원',
      detail: '출력 품질이 불안정해 현장 방문 점검이 필요합니다.',
      consent: true
    });
    const session = await login(runtime.root);

    const inbox = await fetch(`${runtime.root}/api/inquiries`, { headers: { origin: ORIGIN, cookie: session.cookie } });
    assert.equal(inbox.status, 200);
    assert.ok((await inbox.json()).items.some(item => item.id === createdInquiry.id));

    const contacted = await fetch(`${runtime.root}/api/inquiries/${createdInquiry.id}/contacted`, {
      method: 'POST',
      headers: sessionHeaders(session, { 'content-type': 'application/json' }),
      body: JSON.stringify({ expectedVersion: 1 })
    });
    assert.equal(contacted.status, 200);
    const contactedInquiry = await contacted.json();
    assert.equal(contactedInquiry.status, 'CONTACTED');

    const visitPayload = {
      expectedVersion: contactedInquiry.version,
      address: '서울 중구 세종대로 20',
      summary: '디지털 인쇄장비 출력 품질 현장 점검',
      priority: 'NORMAL'
    };
    const visit = await fetch(`${runtime.root}/api/inquiries/${createdInquiry.id}/visit-request`, {
      method: 'POST',
      headers: sessionHeaders(session, { 'content-type': 'application/json' }),
      body: JSON.stringify(visitPayload)
    });
    assert.equal(visit.status, 201);
    const handoff = await visit.json();
    assert.equal(handoff.handoff.state, 'COMPLETED');
    assert.ok(Number.isInteger(handoff.fieldJob.id));

    const replay = await fetch(`${runtime.root}/api/inquiries/${createdInquiry.id}/visit-request`, {
      method: 'POST',
      headers: sessionHeaders(session, { 'content-type': 'application/json' }),
      body: JSON.stringify(visitPayload)
    });
    assert.equal(replay.status, 200);
    const replayBody = await replay.json();
    assert.equal(replayBody.fieldJob.id, handoff.fieldJob.id);

    const prematureClose = await fetch(`${runtime.root}/api/inquiries/${createdInquiry.id}/close`, {
      method: 'POST',
      headers: sessionHeaders(session, { 'content-type': 'application/json' }),
      body: JSON.stringify({ expectedVersion: replayBody.inquiry.version })
    });
    assert.equal(prematureClose.status, 409);
    assert.equal((await prematureClose.json()).error.code, 'FIELD_JOB_STILL_ACTIVE');

    const job = runtime.fieldStore.getJob(handoff.fieldJob.id);
    const schedule = await fetch(`${runtime.root}/api/jobs/${job.id}/schedule`, {
      method: 'POST',
      headers: sessionHeaders(session, { 'content-type': 'application/json' }),
      body: JSON.stringify({ expectedVersion: job.version, agentId: 1, startAt: '2026-09-08T01:00:00.000Z', endAt: '2026-09-08T02:00:00.000Z' })
    });
    const scheduled = await schedule.json();
    assert.equal(schedule.status, 200);

    let current = scheduled;
    for (const suffix of ['dispatch', 'on-site', 'complete']) {
      const response = await fetch(`${runtime.root}/api/jobs/${job.id}/${suffix}`, {
        method: 'POST',
        headers: sessionHeaders(session, { 'content-type': 'application/json' }),
        body: JSON.stringify({ expectedVersion: current.version })
      });
      assert.equal(response.status, 200);
      current = await response.json();
    }
    assert.equal(current.status, 'COMPLETED');

    const latestInquiry = runtime.inquiryStore.get(createdInquiry.id);
    const closed = await fetch(`${runtime.root}/api/inquiries/${createdInquiry.id}/close`, {
      method: 'POST',
      headers: sessionHeaders(session, { 'content-type': 'application/json' }),
      body: JSON.stringify({ expectedVersion: latestInquiry.version })
    });
    assert.equal(closed.status, 200);
    assert.equal((await closed.json()).status, 'CLOSED');
  } finally {
    await runtime.close();
  }
});

test('operations UI exposes a real employee inbox, login, account administration and no configured browser bearer token', async () => {
  const [html, bootstrap, remote, demo, inquiryDesk, teamAdmin, css] = await Promise.all([
    load('field-service-ops/index.html'),
    load('field-service-ops/app.js'),
    load('field-service-ops/remote-app.mjs'),
    load('field-service-ops/demo-delivery-app.mjs'),
    load('field-service-ops/inquiry-desk.mjs'),
    load('field-service-ops/team-admin.mjs'),
    load('field-service-ops/delivery-100.css')
  ]);
  for (const phrase of ['직원 로그인', '상담 접수함', '방문 요청 생성', '배차 운영', '직원 계정 관리']) assert.match(html, new RegExp(phrase));
  assert.match(bootstrap, /demo-delivery-app\.mjs/);
  assert.match(remote, /credentials:\s*'include'/);
  assert.match(remote, /x-csrf-token/);
  assert.match(remote, /\/api\/auth\/login/);
  assert.match(remote, /\/api\/inquiries/);
  assert.match(remote, /\/api\/admin\/users/);
  assert.doesNotMatch(remote, /config\.token/);
  assert.doesNotMatch(remote, /Bearer \$\{token\}/);
  assert.match(demo, /mountInquiryDesk/);
  assert.match(inquiryDesk, /VISIT_REQUEST_CREATED/);
  assert.match(teamAdmin, /비밀번호 재설정/);
  assert.match(css, /\.login-screen/);
  assert.match(css, /overflow-wrap:anywhere/);
});
