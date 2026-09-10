import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const homeMotion = readFileSync(new URL('../home-motion.js', import.meta.url), 'utf8');
const polish = readFileSync(new URL('../portfolio-visual-polish.js', import.meta.url), 'utf8');

test('portfolio reveal motion has a bounded visibility fallback', () => {
  assert.match(homeMotion, /setTimeout\(revealAll, 1200\)/);
  assert.match(homeMotion, /hashchange/);
  assert.match(homeMotion, /observer\.disconnect\(\)/);
  assert.match(homeMotion, /portfolio-visual-polish\.js/);
  assert.match(homeMotion, /Promise\.allSettled\(portfolioLayers\)/);
});

test('visual polish compacts recruiter, proof and legacy evidence sections', () => {
  assert.match(polish, /\.recruiter-path-section\{padding:36px 0\}/);
  assert.match(polish, /\.proof-center-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(polish, /\.proof-center-card:last-child\{grid-column:1\/-1\}/);
  assert.match(polish, /#evidence \.proof-rail\{display:none\}/);
  assert.match(polish, /\.proof-center-chain\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\);gap:6px\}/);
  assert.match(polish, /window\.KZONE_VISUAL_POLISH/);
});
