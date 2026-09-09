import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const js=fs.readFileSync('commercial-portfolio.js','utf8');
const css=fs.readFileSync('commercial-portfolio.css','utf8');
const qa=fs.readFileSync('scripts/mono-live-page-qa.mjs','utf8');
const workflow=fs.readFileSync('.github/workflows/mono-live-pages-qa.yml','utf8');

test('portfolio upgrades MONO from four demo cards into one flagship operations suite',()=>{
  for(const text of ['FLAGSHIP OPERATIONS SUITE','MONO OPERATIONS','중소기업용 Back-office Operations Suite','MONO MARKET','MONO OFFICE','MONO SUPPORT','MONO DATA HUB','COMMERCIAL DELIVERY EVIDENCE']) assert.ok(js.includes(text),`missing ${text}`);
  assert.ok(js.includes('src="./mono-operations/"'),'portfolio must embed the actual deployed MONO Operations screen');
  assert.equal((js.match(/class="mono-surface-link/g)||[]).length,5,'suite home plus four module links must be visible');
  for(const href of ['./mono-operations/','./commerce-ops-console/','./document-intake-approval/','./ai-workflow-review-desk/','./integration-control-center/']) assert.ok(js.includes(`href="${href}"`),`missing ${href}`);
});

test('MONO flagship layout keeps real-screen preview and responsive fallbacks explicit',()=>{
  for(const token of ['.mono-portfolio-featured','.mono-live-frame-wrap iframe','.mono-surface-links','.mono-engineering-proof','.single-secondary-case']) assert.ok(css.includes(token),`missing ${token}`);
  assert.match(css,/width:200%;height:200%;[^}]*transform:scale\(\.5\)/,'live page must be scaled rather than replaced with a fake illustration');
  assert.match(css,/@media\(max-width:760px\)[^{]*\{[^}]*\.mono-portfolio-featured/s,'mobile layout contract missing');
});

test('same-SHA live QA validates the portfolio showcase as well as the MONO product surfaces',()=>{
  assert.ok(qa.includes("name:'portfolio'"));
  assert.ok(qa.includes("frameLocator('.mono-live-preview iframe')"));
  assert.ok(qa.includes('MONO OPERATIONS LIVE PAGES QA: PASS'));
  for(const path of ["'index.html'","'commercial-portfolio.js'","'commercial-portfolio.css'","'test/mono-portfolio-showcase.test.mjs'"]) assert.ok(workflow.includes(path),`workflow trigger missing ${path}`);
});
