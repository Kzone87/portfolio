import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const load = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const shared = await load('product-ui.css');
const styles = await Promise.all([
  'ai-workflow-review-desk/styles.css','integration-control-center/styles.css','commerce-ops-console/styles.css','field-service-ops/styles.css','document-intake-approval/styles.css','mini-labs/styles.css','scope-estimator/style.css'
].map(load));
const home = await load('home.css');
const service = await load('services/service-page.css');

test('shared product UI defines dense operational B2B tokens and responsive product patterns', () => {
  for (const token of ['--ui-bg:#f4f5f7','--ui-text:#111827','--ui-accent:#4f46e5','--ui-line:#e5e7eb','--ui-radius:9px']) {
    assert.ok(shared.includes(token), `missing shared token ${token}`);
  }
  for (const pattern of ['.topbar{','.metrics,','.workspace{','.panel{','.table-wrap{','@media(max-width:980px)','.architecture{display:none!important}']) {
    assert.ok(shared.includes(pattern), `missing shared pattern ${pattern}`);
  }
});

test('all static public product demos import the same shared UI system', () => {
  for (const css of styles) {
    assert.match(css, /product-ui\.css/);
    assert.match(css, /@layer legacy, system/);
  }
});

test('portfolio and service pages use the same restrained visual language', () => {
  assert.match(home, /--accent:#4f46e5/);
  assert.match(service, /--accent:#4f46e5/);
  assert.match(home, /border:1px solid var\(--line\)/);
  assert.match(service, /border:1px solid var\(--line\)/);
  assert.doesNotMatch(home, /border-radius:24px/);
});
