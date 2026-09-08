import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createStore } from '../field-service-ops/server/store.mjs';
import { createFieldServiceServer } from '../field-service-ops/server/app.mjs';

const load = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Portfolio Main presents NEXA as three real user surfaces with end-to-end engineering evidence', async () => {
  const home = await load('index.html');
  const css = await load('home-domain.css');
  for (const phrase of ['NEXA SERVICE SUITE','신규 고객','기존 고객','직원','NEXA CUSTOMER SERVICE','NEXA SERVICE OPERATIONS','Inquiry → Field Job → Customer Portal','E2E Tests']) {
    assert.match(home, new RegExp(phrase));
  }
  assert.match(home, /test\/nexa-bundle-100\.test\.mjs/);
  assert.match(home, /class="nexa-surface-links"/);
  assert.match(css, /\.nexa-surface-links/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /overflow-wrap:anywhere/);
});

test('customer front door hands a newly created request to the portal without putting contact data in the URL', async () => {
  const app = await load('nexa-tech-service/app.js');
  assert.match(app, /sessionStorage\.setItem/);
  assert.match(app, /nexa:customer-request/);
  assert.match(app, /rememberPortalAccess\(payload\.id, values\.phone\)/);
  assert.match(app, /\?request=\$\{encodeURIComponent\(requestId\)\}/);
  assert.doesNotMatch(app, /[?&]phone=/);
});

test('customer portal keeps request detail hidden until lookup and accepts only a short-lived same-tab handoff', async () => {
  const html = await load('nexa-service-domain/index.html');
  const app = await load('nexa-service-domain/app.js');
  assert.match(html, /id="request-view"[^>]*hidden/);
  assert.match(app, /portalSessionMaxAge = 30 \* 60 \* 1000/);
  assert.match(app, /sessionStorage\.getItem/);
  assert.match(app, /form\?\.requestSubmit\(\)/);
  assert.match(app, /\/api\/customer\/requests\/lookup/);
  assert.doesNotMatch(app, /if \(!endpoint[^\n]*render\(demoRequest\)/);
});

test('staff workspace selects public demo or session-authenticated remote API mode without trusting actor or role from the browser', async () => {
  const bootstrap = await load('field-service-ops/app.js');
  const demo = await load('field-service-ops/demo-delivery-app.mjs');
  const remote = await load('field-service-ops/remote-app.mjs');
  assert.match(bootstrap, /NEXA_OPS_CONFIG/);
  assert.match(bootstrap, /remote-app\.mjs/);
  assert.match(bootstrap, /demo-delivery-app\.mjs/);
  assert.match(demo, /mountInquiryDesk/);
  for (const route of ['/api/me','/api/agents','/api/jobs','/api/metrics','/api/audits','/api/inquiries']) assert.ok(remote.includes(route), `remote client missing ${route}`);
  assert.match(remote, /credentials:\s*'include'/);
  assert.match(remote, /x-csrf-token/);
  assert.match(remote, /expectedVersion/);
  assert.doesNotMatch(remote, /config\.token/);
  assert.doesNotMatch(remote, /body:\s*\{[^}]*actor\s*:/s);
  assert.doesNotMatch(remote, /body:\s*\{[^}]*role\s*:/s);
});

test('Field Ops /api/me returns the server-authenticated service identity for trusted machine-to-machine callers', async () => {
  const token = 'final-ops-token-123456789';
  const server = createFieldServiceServer(createStore(), {
    requireAuth: true,
    principals: [{ token, id: 'dispatcher-final', name: '김현수', role: 'ADMIN', team: '서울 운영팀' }],
    allowedOrigins: ['https://ops.nexa.example']
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/me`, { headers: { authorization: `Bearer ${token}` } });
    assert.equal(response.status, 200);
    const principal = await response.json();
    assert.equal(principal.id, 'dispatcher-final');
    assert.equal(principal.name, '김현수');
    assert.equal(principal.role, 'ADMIN');
    assert.equal(principal.team, '서울 운영팀');
  } finally {
    server.close();
    await once(server, 'close');
  }
});
