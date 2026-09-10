import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const motion = read('home-motion.js');
const commercial = read('commercial-portfolio.js');
const booking = read('booking-portfolio.js');
const performance = read('portfolio-performance.js');
const proof = read('portfolio-proof-center.js');
const accessibility = read('portfolio-accessibility.js');
const seo = read('portfolio-seo.js');
const robots = read('robots.txt');

test('elite portfolio layers are loaded from the home entry', () => {
  for (const file of ['portfolio-performance.js','portfolio-proof-center.js','portfolio-accessibility.js','portfolio-seo.js']) {
    assert.ok(motion.includes(`import('./${file}')`), `home entry must load ${file}`);
  }
});

test('performance gate defers every embedded live product preview', () => {
  assert.match(performance, /IntersectionObserver/);
  assert.match(performance, /rootMargin: '500px 0px'/);
  assert.match(performance, /max-width: 760px/);
  assert.match(performance, /dataset\.previewSrc/);
  assert.match(performance, /KZONE_PERFORMANCE_GATE/);
  assert.doesNotMatch(commercial, /<iframe src=/);
  assert.doesNotMatch(booking, /<iframe src=/);
  assert.match(commercial, /data-preview-src/);
  assert.match(booking, /data-preview-src/);
});

test('proof center exposes five evidence stages across five product lines', () => {
  for (const product of ['NEXA SERVICE SUITE','BOOKING CRM','MONO OPERATIONS','EXCEL WORKBENCH','OPS KIT']) assert.ok(proof.includes(product));
  for (const stage of ['LIVE','SOURCE','TESTS','CI','DEPLOY QA']) assert.ok(proof.includes(stage));
  assert.match(proof, /id = 'proof-center'/);
});

test('recruiter path is explicitly constrained to a 90-second three-step review', () => {
  assert.match(proof, /RECRUITER 90-SECOND FLOW/);
  assert.match(proof, /01 · 35 SEC/);
  assert.match(proof, /02 · 35 SEC/);
  assert.match(proof, /03 · 20 SEC/);
  assert.match(proof, /recruiter-nexa/);
  assert.match(proof, /recruiter-mono/);
});

test('accessibility gate includes WCAG 2.2 interaction guardrails', () => {
  assert.match(accessibility, /min-height:44px/);
  assert.match(accessibility, /focus-visible/);
  assert.match(accessibility, /prefers-reduced-motion:reduce/);
  assert.match(accessibility, /aria-controls/);
  assert.match(accessibility, /aria-labelledby/);
  assert.match(accessibility, /tinyCriticalControls/);
  assert.match(accessibility, /KZONE_ACCESSIBILITY_GATE/);
});

test('SEO layer publishes crawler controls and Person ProfilePage WebSite structured data', () => {
  assert.match(robots, /Sitemap: https:\/\/kzone87\.github\.io\/portfolio\/sitemap\.xml/);
  for (const type of ['Person','ProfilePage','WebSite']) assert.ok(seo.includes(`'@type': '${type}'`));
  assert.match(seo, /index,follow,max-image-preview:large/);
  assert.match(seo, /og:site_name/);
  assert.match(seo, /twitter:card/);
  assert.match(seo, /application\/ld\+json/);
});

test('case studies connect problem, decision, hard edge, implementation and verification', () => {
  for (const stage of ['PROBLEM','DECISION','HARD EDGE','IMPLEMENTATION','VERIFICATION']) assert.ok(proof.includes(stage));
  assert.match(proof, /EVIDENCE-DRIVEN CASE STUDIES/);
  assert.match(proof, /same-SHA Pages Chrome QA/);
  assert.doesNotMatch(proof, /\b\d+%\b/);
});
