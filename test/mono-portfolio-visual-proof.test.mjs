import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const qa=fs.readFileSync('scripts/mono-live-page-qa.mjs','utf8');
const workflow=fs.readFileSync('.github/workflows/mono-live-pages-qa.yml','utf8');

test('portfolio live QA reveals scroll-animated sections before accepting visual evidence',()=>{
  assert.ok(qa.includes('async function revealPortfolioSections'));
  assert.ok(qa.includes('scrollIntoViewIfNeeded()'));
  assert.ok(qa.includes('getComputedStyle(el)'));
  assert.ok(qa.includes('visual.opacity<0.98'));
  assert.ok(qa.includes('portfolio-mono-${vpName}.png'));
});

test('MONO live workflow remains tied to visual-proof changes',()=>{
  assert.ok(workflow.includes("'test/mono-portfolio-visual-proof.test.mjs'"));
  assert.ok(workflow.includes("'scripts/mono-live-page-qa.mjs'"));
});
