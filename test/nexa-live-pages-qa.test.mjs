import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const load = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('portfolio declares a project-local favicon so GitHub Pages does not fall back to host-root favicon.ico', async () => {
  const [html, favicon] = await Promise.all([load('index.html'), load('favicon.svg')]);
  assert.match(html, /<link rel="icon" href="\.\/favicon\.svg" type="image\/svg\+xml">/);
  assert.match(favicon, /<svg[\s\S]*viewBox="0 0 64 64"/);
  assert.doesNotMatch(html, /href="\/favicon\.ico"/);
});

test('live Pages QA opens the deployed site in three viewports and exercises customer and operations flows', async () => {
  const [script, workflow] = await Promise.all([
    load('scripts/nexa-live-page-qa.mjs'),
    load('.github/workflows/nexa-live-pages-qa.yml')
  ]);
  for (const size of ['1440', '768', '390']) assert.match(script, new RegExp(`width: ${size}`));
  for (const path of ['/nexa-tech-service/', '/nexa-service-domain/', '/field-service-ops/']) assert.match(script, new RegExp(path.replaceAll('/', '\\/')));
  assert.match(script, /secure-send/);
  assert.match(script, /secure-verify/);
  assert.match(script, /operations day\/week\/map\/field/);
  assert.match(script, /response\.status\(\) >= 400/);
  assert.match(script, /requestfailed/);
  assert.match(workflow, /Wait for same-SHA GitHub Pages deployment/);
  assert.match(workflow, /head_sha=\$\{GITHUB_SHA\}/);
  assert.match(workflow, /pages build and deployment/);
  assert.match(workflow, /Verify deployed GitHub Pages in real browser/);
});
