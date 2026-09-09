import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const load=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const html=await load('document-intake-approval/index.html');
const app=await load('document-intake-approval/app.js');
const engine=await load('document-intake-approval/engine.mjs');
const store=await load('document-intake-approval/server/store.mjs');
const css=await load('document-intake-approval/styles.css');
const liveQa=await load('scripts/document-live-page-qa.mjs');
const workflow=await load('.github/workflows/document-live-pages-qa.yml');

test('document desk is a complete internal intake product rather than a portfolio landing page',()=>{
  assert.match(html,/문서 접수·검수/);
  assert.match(html,/id="create-document"/);
  assert.match(html,/id="type-filter" aria-label="문서 종류"/);
  assert.match(html,/id="reset-filters"/);
  assert.match(html,/지금 먼저 확인할 업무/);
  assert.match(html,/class="mobile-nav"/);
  assert.match(html,/rel="canonical" href="https:\/\/kzone87\.github\.io\/portfolio\/document-intake-approval\/"/);
  assert.match(html,/rel="icon" href="data:image\/svg\+xml;base64,/);
  assert.doesNotMatch(html,/← 프로젝트|포트폴리오/);
});

test('document UI and domain enforce role boundaries, version visibility, and auditable decisions',()=>{
  assert.match(app,/el\.version\.textContent=`v\$\{d\.version\}`/);
  assert.match(app,/state\.role==='SUBMITTER'&&d\.allowedActions\.includes\('EDIT'\)/);
  assert.match(app,/comment\.length<4/);
  assert.match(app,/store\.createDocument\(\{type:el\.intakeType\.value/);
  assert.match(store,/AUTHOR_FORBIDDEN/);
  assert.match(store,/requireSubmitter\(input\)/);
  assert.match(engine,/comment\.length<4\|\|comment\.length>500/);
});

test('document responsive workspace protects intake, mobile navigation, and narrow layouts',()=>{
  assert.match(css,/\.priority-board\{/);
  assert.match(css,/\.intake-form\{/);
  assert.match(css,/@media\(max-width:760px\)[\s\S]*\.mobile-nav\{position:sticky/);
  assert.match(css,/@media\(max-width:480px\)/);
  assert.match(css,/\.version-pill\{/);
});

test('document production QA waits for same-SHA Pages and verifies the real intake-review-archive flow',()=>{
  for(const width of ['1440','768','390'])assert.match(liveQa,new RegExp(`width:\\s*${width}`));
  assert.match(liveQa,/create-document/);
  assert.match(liveQa,/검수 근거를 4자 이상/);
  assert.match(liveQa,/selectOption\('REVIEWER'\)/);
  assert.match(liveQa,/selectOption\('ADMIN'\)/);
  assert.match(liveQa,/DOCUMENT LIVE PAGES QA: PASS/);
  assert.match(workflow,/Wait for same-SHA GitHub Pages deployment/);
  assert.match(workflow,/head_sha=\$\{GITHUB_SHA\}/);
  assert.match(workflow,/Verify document GitHub Pages in real browser/);
});
