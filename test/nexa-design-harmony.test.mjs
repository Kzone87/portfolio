import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const family = read('nexa-family.css');
const portfolio = read('home-domain.css');
const corporate = read('nexa-tech-service/styles-100.css');
const portal = read('nexa-service-domain/portal-actions.css');
const operations = read('field-service-ops/delivery-100.css');
const customerActions = read('field-service-ops/customer-actions.css');
const build = read('scripts/nexa-build-delivery.mjs');

test('NEXA family uses one canonical brand palette while preserving surface-specific density', () => {
  assert.match(family, /--nexa-brand:#1565e8/);
  assert.match(family, /--nexa-brand-dark:#0b4db8/);
  assert.match(family, /--nexa-navy:#102a43/);
  assert.match(family, /--nexa-cyan:#0ea5c6/);
  assert.match(family, /--nexa-font:Inter,Pretendard/);

  assert.match(corporate, /--nexa-blue:#1565e8/);
  assert.match(corporate, /--nexa-navy:#102a43/);
  assert.match(portfolio, /--portfolio-nexa-brand:#1565e8/);
  assert.match(portfolio, /linear-gradient\(145deg,#102a43/);
  assert.match(portfolio, /\.nexa-preview \.nexa-page\{background:linear-gradient\(145deg,#174b78,#0b2741\)/);

  assert.match(portal, /@import url\("\.\.\/nexa-family\.css"\)/);
  assert.match(portal, /\.brand-mark\{border-radius:50%;background:linear-gradient\(145deg,var\(--nexa-brand\),var\(--nexa-cyan\)\)/);
  assert.match(portal, /\.current-card\{background:linear-gradient\(145deg,var\(--nexa-navy\),#153d60\)/);
  assert.match(portal, /\.lookup-form button\{background:var\(--nexa-brand\)\}/);

  assert.match(operations, /@import url\("\.\.\/nexa-family\.css"\)/);
  assert.match(operations, /\.product-identity:before\{content:"N"/);
  assert.match(operations, /--ui-accent:var\(--nexa-brand\)/);
  assert.match(operations, /\.login-card button\{[^}]*background:var\(--nexa-brand\)/);
  assert.match(customerActions, /button\.resolve\{background:var\(--nexa-brand\)/);
});

test('NEXA keeps semantic operational status colors separate from brand color', () => {
  assert.match(portal, /\.customer-action-state\.OPEN\{background:#fff5d8/);
  assert.match(portal, /\.customer-action-state\.RESOLVED\{background:#e7f6ee/);
  assert.match(customerActions, /\.customer-action-status\.OPEN\{background:#fff2c9/);
  assert.match(customerActions, /\.customer-action-status\.RESOLVED\{background:#e5f5ed/);
  assert.match(operations, /\.team-role-badge\.STAFF\{background:#edf5ef/);
});

test('delivery bundle carries shared brand tokens without exposing private runtime code', () => {
  assert.match(build, /copy\('nexa-family\.css'\)/);
  assert.match(build, /sharedAssets: \['nexa-family\.css'\]/);
  assert.match(build, /excluded: \['server source', 'tests'/);
});

test('design harmony layers keep long-content and mobile safeguards', () => {
  assert.match(portfolio, /overflow-wrap:anywhere/);
  assert.match(portal, /overflow-wrap:anywhere/);
  assert.match(operations, /min-width:0/);
  assert.match(portal, /@media\(max-width:420px\)/);
  assert.match(operations, /@media\(max-width:420px\)/);
});
