import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createMonoStore, hasCapability } from '../mono-operations/server/store.mjs';

const html=fs.readFileSync(new URL('../mono-operations/index.html',import.meta.url),'utf8');
const js=fs.readFileSync(new URL('../mono-operations/app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../mono-operations/styles.css',import.meta.url),'utf8');
const api=fs.readFileSync(new URL('../mono-operations/server/app.mjs',import.meta.url),'utf8');

test('MONO suite exposes one work inbox and four real modules',()=>{
  for(const text of ['MONO OPERATIONS','통합 업무함','MARKET','OFFICE','SUPPORT','DATA HUB']) assert.match(html,new RegExp(text));
  for(const path of ['../commerce-ops-console/','../document-intake-approval/','../ai-workflow-review-desk/','../integration-control-center/']) assert.ok(html.includes(path));
});

test('public shell is responsive without hiding horizontal defects',()=>{
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/@media\(max-width:420px\)/);
  assert.doesNotMatch(css,/overflow-x\s*:\s*hidden/);
  assert.match(html,/mobile-tabs/);
});

test('mobile header keeps MONO OPERATIONS identity visible when sidebar is closed',()=>{
  assert.match(html,/<p>MONO OPERATIONS<\/p><h1>통합 업무 운영<\/h1>/);
  assert.match(css,/@media\(max-width:760px\)[\s\S]*?\.topbar>div:first-of-type p\{display:block/);
  assert.doesNotMatch(css,/@media\(max-width:760px\)[\s\S]*?\.topbar>div:first-of-type p\{display:none/);
});

test('browser demo uses capability checks and human-review language',()=>{
  assert.match(js,/ROLE_CAPS/);
  assert.match(js,/refunds\.approve/);
  assert.match(js,/documents\.review/);
  assert.match(js,/support\.review/);
  assert.match(js,/integrations\.retry/);
  assert.match(html,/Human Review/);
});

test('delivery API fails closed in production and requires bearer authentication',()=>{
  assert.match(api,/MONO_DB_PATH_REQUIRED_IN_PRODUCTION/);
  assert.match(api,/MONO_API_TOKENS_REQUIRED_IN_PRODUCTION/);
  assert.match(api,/Authorization|authorization/);
  assert.match(api,/Bearer /);
  assert.match(api,/EXPECTED_VERSION_REQUIRED/);
  assert.match(api,/STALE_WORK_ITEM/);
});

test('server-side capability boundary blocks operator and permits manager',()=>{
  assert.equal(hasCapability('OPERATOR','refunds.approve'),false);
  assert.equal(hasCapability('MANAGER','refunds.approve'),true);
  assert.equal(hasCapability('ADMIN','integrations.retry'),true);
});

test('store enforces stale version and records audit only after authorized update',()=>{
  const store=createMonoStore();
  try{
    const item=store.getWorkItem('W-1001','operator');
    assert.throws(()=>store.acknowledge({id:item.id,actorId:'operator',expectedVersion:item.version}),e=>e.code==='FORBIDDEN');
    assert.equal(store.listAudit('admin').length,0);
    const updated=store.acknowledge({id:item.id,actorId:'manager',expectedVersion:item.version});
    assert.equal(updated.status,'확인 완료');
    assert.equal(updated.version,item.version+1);
    assert.equal(store.listAudit('admin').length,1);
    assert.throws(()=>store.acknowledge({id:item.id,actorId:'manager',expectedVersion:item.version}),e=>e.code==='STALE_WORK_ITEM');
  }finally{store.close()}
});
