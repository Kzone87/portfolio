import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../home-v3.css', import.meta.url), 'utf8');
const freshCss = await readFile(new URL('../home-fresh.css', import.meta.url), 'utf8');
const motion = await readFile(new URL('../home-motion.js', import.meta.url), 'utf8');

const demoTargets = [
  './nexa-tech-service/',
  './field-service-ops/',
  'https://kzone87.github.io/customer-map-planner/',
  './commerce-ops-console/',
  './document-intake-approval/',
  './ai-workflow-review-desk/',
  './integration-control-center/',
  './mini-labs/'
];

test('portfolio home exposes all eight runnable product surfaces', () => {
  for (const href of demoTargets) assert.ok(html.includes(`href="${href}"`), `missing ${href}`);
  assert.match(html, /<strong>08<\/strong><span>LIVE PRODUCTS/);
});

test('portfolio uses a product-studio hierarchy instead of repeating card grids', () => {
  assert.match(html, /더 단순하게 만드는/);
  assert.match(html, /class="flagship nexa-showcase"/);
  assert.match(html, /class="case-link-grid mono-bento"/);
  assert.match(html, /class="flagship compact-flagship excel-case"/);
  assert.match(html, /class="capability-grid editorial-grid"/);
  assert.match(html, /class="proof-rail"/);
  assert.match(html, /코드보다 먼저,<br>업무 흐름을 봅니다/);
  assert.doesNotMatch(html, /identity-card|compact-evidence-grid|60초 검토 순서|운영 제품 바로가기/);
});

test('portfolio home has search metadata and keyboard navigation support', () => {
  assert.match(html, /property="og:type" content="website"/);
  assert.match(html, /property="og:title"/);
  assert.match(html, /rel="canonical" href="https:\/\/kzone87\.github\.io\/portfolio\/"/);
  assert.match(html, /class="skip-link" href="#top">본문으로 바로가기/);
  assert.match(html, /a:focus-visible,button:focus-visible/);
});

test('fresh blue visual hierarchy stays bright, editorial and developer-focused', () => {
  assert.match(html, /<meta name="theme-color" content="#eff7ff">/);
  assert.match(html, /href="\.\/home-fresh\.css"/);
  assert.match(freshCss, /--fresh-blue:#2563eb/);
  assert.match(freshCss, /\.studio-hero h1 span\{[\s\S]*linear-gradient\(90deg,#2563eb 0%,#0ea5e9 54%,#6366f1 100%\)/);
  assert.match(freshCss, /\.nexa-showcase\{[\s\S]*#edf7ff/);
  assert.match(freshCss, /\.mono-bento\{[\s\S]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(freshCss, /\.about-contact-section\{[\s\S]*#edf7ff/);
  assert.doesNotMatch(freshCss, /#101813|#10271e/);
});

test('palette is statically loaded and motion does not mutate stylesheets', () => {
  assert.doesNotMatch(motion, /createElement\(['"]link['"]\)|home-light\.css|home-fresh\.css/);
  assert.match(html, /home-fresh\.css/);
});

test('editorial capability layout and mobile readability remain intact', () => {
  assert.match(css, /\.editorial-grid\{[^}]*grid-template-columns:1fr 1fr/);
  assert.match(css, /\.proof-rail\{[^}]*grid-template-columns:repeat\(4,1fr\)/);
  assert.match(css, /@media\(max-width:700px\)[\s\S]*\.studio-header nav a\{font-size:\.82rem/);
  assert.match(freshCss, /@media\(max-width:700px\)[\s\S]*\.mono-bento\{grid-template-columns:1fr 1fr/);
});

test('reveal motion is progressive enhancement and respects reduced motion', () => {
  assert.match(html, /home-motion\.js/);
  assert.doesNotThrow(() => new Function(motion));
  assert.match(motion, /prefers-reduced-motion: reduce/);
  assert.match(motion, /IntersectionObserver/);
  assert.match(css, /\.motion-ready \[data-reveal\]/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
});
