import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

const quality = read('portfolio-quality.js');
const seo = read('portfolio-seo.js');
const motion = read('home-motion.js');
const commercial = read('commercial-portfolio.js');
const booking = read('booking-portfolio.js');
const sitemap = read('sitemap.xml');
const robots = read('robots.txt');

for (const file of ['portfolio-quality.js', 'portfolio-seo.js', 'commercial-portfolio.js', 'booking-portfolio.js', 'home-motion.js']) {
  test(`${file} has valid JavaScript syntax`, () => {
    const result = spawnSync(process.execPath, ['--check', join(root, file)], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  });
}

test('P1 Performance Gate prevents eager live-preview network loading', () => {
  for (const source of [commercial, booking]) {
    assert.doesNotMatch(source, /<iframe\s+src=/);
    assert.match(source, /<iframe\s+data-src=/);
  }
  assert.match(quality, /IntersectionObserver/);
  assert.match(quality, /rootMargin:\s*'500px 0px'/);
  assert.match(quality, /max-width:760px/);
  assert.match(quality, /window\.KZONE_ACTIVATE_PREVIEW/);
});

test('P1 Proof Center exposes five traceable evidence stages for every product line', () => {
  assert.match(quality, /id = 'proof-center'/);
  for (const stage of ['Live', 'Source', 'Domain Tests', 'CI', 'Deployment QA']) {
    assert.ok(quality.includes(`['${stage}'`) || quality.includes(`['${stage}',`), `missing proof stage ${stage}`);
  }
  for (const product of ['NEXA SERVICE SUITE', 'BOOKING CRM', 'MONO OPERATIONS', 'EXCEL WORKBENCH', 'OPS KIT']) {
    assert.ok(quality.includes(product), `missing proof product ${product}`);
  }
  assert.match(quality, /test\/nexa-bundle-100\.test\.mjs/);
  assert.match(quality, /test\/booking-crm\.test\.mjs/);
  assert.match(quality, /test\/mono-commercial-http\.test\.mjs/);
  assert.match(quality, /test\/mini-labs\.test\.mjs/);
});

test('P1 Recruiter 90-second flow is explicit and evidence-oriented', () => {
  assert.match(quality, /RECRUITER · 90 SECOND REVIEW/);
  assert.match(quality, /00–35 SEC/);
  assert.match(quality, /35–65 SEC/);
  assert.match(quality, /65–90 SEC/);
  assert.match(quality, /href="#featured"/);
  assert.match(quality, /href="#proof-center"/);
});

test('P1 Accessibility Gate covers focus visibility, focus offsets, target size and reduced motion', () => {
  assert.match(quality, /scroll-padding-top:92px/);
  assert.match(quality, /scroll-margin-top:92px/);
  assert.match(quality, /min-height:44px/);
  assert.match(quality, /:focus-visible/);
  assert.match(quality, /outline:3px solid #2563eb/);
  assert.match(quality, /prefers-reduced-motion:reduce/);
  assert.match(quality, /animation-duration:\.01ms/);
});

test('P2 Search and SEO layer exposes WebSite, ProfilePage and Person structured data', () => {
  for (const type of ["'@type': 'WebSite'", "'@type': 'ProfilePage'", "'@type': 'Person'"]) {
    assert.ok(seo.includes(type), `missing structured type ${type}`);
  }
  assert.match(seo, /meta\[name="robots"\]/);
  assert.match(seo, /og:site_name/);
  assert.match(seo, /og:locale/);
  assert.match(seo, /twitter:card/);
  assert.match(seo, /rel="me"/);
  assert.match(motion, /import\(['"]\.\/portfolio-seo\.js['"]\)/);
  assert.match(motion, /import\(['"]\.\/portfolio-quality\.js['"]\)/);
});

test('sitemap and robots expose primary product and conversion surfaces', () => {
  for (const path of [
    '/portfolio/',
    '/portfolio/nexa-tech-service/',
    '/portfolio/booking-crm/',
    '/portfolio/mono-operations/',
    '/portfolio/mini-labs/',
    '/portfolio/project-inquiry/'
  ]) assert.ok(sitemap.includes(path), `sitemap missing ${path}`);
  assert.match(sitemap, /<lastmod>2026-09-10<\/lastmod>/);
  assert.match(robots, /Sitemap: https:\/\/kzone87\.github\.io\/portfolio\/sitemap\.xml/);
});

test('P2 evidence-driven case studies use the full engineering narrative', () => {
  for (const stage of ['PROBLEM', 'DESIGN DECISION', 'HARD EDGE', 'IMPLEMENTATION', 'VERIFICATION']) {
    assert.ok(quality.includes(stage), `case study stage missing: ${stage}`);
  }
  for (const project of ['case-nexa', 'case-booking', 'case-mono']) {
    assert.ok(quality.includes(project), `case study missing ${project}`);
  }
});
