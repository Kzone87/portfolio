import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const load=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('portfolio adds Booking CRM as fifth client-ready product line with deferred real live screen',async()=>{
  const script=await load('booking-portfolio.js');
  const loader=await load('home-motion.js');
  for(const phrase of ['05','PRODUCT LINES','BOOKING CRM','예약 요청','Slot Conflict','expectedVersion','HttpOnly Session','SQLite · WAL · Persistence','ACTUAL LIVE SCREEN']) assert.match(script,new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(script,/iframe data-src="\.\/booking-crm\/"/);
  assert.doesNotMatch(script,/iframe src="\.\/booking-crm\/"/);
  assert.match(script,/href="\.\/booking-crm\/"/);
  assert.match(loader,/import\('\.\/booking-portfolio\.js'\)/);
  assert.match(loader,/import\('\.\/portfolio-quality\.js'\)/);
});

test('Booking CRM source documents public privacy boundary and commercial delivery controls',async()=>{
  const html=await load('booking-crm/index.html');const runbook=await load('booking-crm/DELIVERY_RUNBOOK.md');
  assert.match(html,/입력값은 서버로 전송하거나 저장하지 않으며/);
  for(const phrase of ['HttpOnly Session','CSRF','SQLite','409 SLOT_CONFLICT','409 STALE_BOOKING','same-SHA production public Chrome QA PASS']) assert.match(runbook,new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});
