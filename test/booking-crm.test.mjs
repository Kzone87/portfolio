import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createDemoState,createBooking,transitionBooking,rescheduleBooking,createInquiry,transitionInquiry,metrics} from '../booking-crm/engine.mjs';
import {createBookingApp} from '../booking-crm/server/app.mjs';

const tomorrow=(hour)=>{const d=new Date();d.setDate(d.getDate()+2);d.setHours(hour,0,0,0);return d.toISOString()};

test('booking domain rejects overlap, enforces version and records workflow metrics',()=>{
  const state={customers:[],bookings:[],inquiries:[],audit:[]};
  const first=createBooking(state,{name:'김고객',phone:'01012345678',serviceId:'consult',startAt:tomorrow(10),note:'첫 상담'});
  assert.throws(()=>createBooking(state,{name:'이고객',phone:'01099998888',serviceId:'consult',startAt:tomorrow(10)}),/SLOT_CONFLICT/);
  const confirmed=transitionBooking(state,first.id,'CONFIRMED',{expectedVersion:1,actor:'MANAGER'});
  assert.equal(confirmed.version,2);assert.equal(confirmed.status,'CONFIRMED');
  assert.throws(()=>transitionBooking(state,first.id,'COMPLETED',{expectedVersion:1}),/STALE_BOOKING/);
  const moved=rescheduleBooking(state,first.id,tomorrow(11),{expectedVersion:2});assert.equal(moved.version,3);
  const inquiry=createInquiry(state,{name:'박문의',phone:'01022223333',topic:'가격 문의',message:'정기권이 있나요?'});transitionInquiry(state,inquiry.id,'CONTACTED',{expectedVersion:1});
  const m=metrics(state);assert.equal(m.confirmed,1);assert.equal(m.inquiries,1);assert.ok(state.audit.length>=5);
});

test('public demo has realistic seeded booking and inquiry without network persistence',()=>{
  const state=createDemoState();assert.ok(state.bookings.length>=2);assert.ok(state.customers.length>=2);assert.ok(state.inquiries.length>=1);assert.ok(state.audit.length>=4);
});

test('commercial runtime authenticates staff, protects CSRF, persists booking and blocks stale/conflicting updates',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'booking-crm-'));const dbPath=join(dir,'booking.sqlite');
  const app=createBookingApp({dbPath,adminPassword:'Strong-Test-123!',allowedOrigin:'http://127.0.0.1:8798'});const address=await app.listen(0);const base=`http://127.0.0.1:${address.port}`;
  let cookie='';
  try{
    const health=await fetch(`${base}/ready`);assert.equal(health.status,200);assert.equal((await health.json()).ready,true);
    const first=await fetch(`${base}/api/bookings`,{method:'POST',headers:{'content-type':'application/json','origin':'http://127.0.0.1:8798'},body:JSON.stringify({name:'김고객',phone:'01012345678',serviceId:'consult',startAt:tomorrow(10),note:'실제 예약'})});assert.equal(first.status,201);const created=(await first.json()).booking;
    const conflict=await fetch(`${base}/api/bookings`,{method:'POST',headers:{'content-type':'application/json','origin':'http://127.0.0.1:8798'},body:JSON.stringify({name:'이고객',phone:'01099998888',serviceId:'consult',startAt:tomorrow(10)})});assert.equal(conflict.status,409);
    const unauth=await fetch(`${base}/api/admin/bookings`);assert.equal(unauth.status,401);
    const login=await fetch(`${base}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json','origin':'http://127.0.0.1:8798'},body:JSON.stringify({email:'admin@booking.local',password:'Strong-Test-123!'})});assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];const session=await login.json();assert.equal(session.employee.role,'ADMIN');assert.ok(session.csrf);
    const list=await fetch(`${base}/api/admin/bookings`,{headers:{cookie}});assert.equal(list.status,200);const row=(await list.json()).bookings.find(item=>item.id===created.id);assert.ok(row);
    const csrfFail=await fetch(`${base}/api/admin/bookings/${created.id}`,{method:'PATCH',headers:{cookie,'content-type':'application/json','origin':'http://127.0.0.1:8798'},body:JSON.stringify({expectedVersion:1,status:'CONFIRMED'})});assert.equal(csrfFail.status,403);
    const update=await fetch(`${base}/api/admin/bookings/${created.id}`,{method:'PATCH',headers:{cookie,'x-csrf-token':session.csrf,'content-type':'application/json','origin':'http://127.0.0.1:8798'},body:JSON.stringify({expectedVersion:1,status:'CONFIRMED'})});assert.equal(update.status,200);assert.equal((await update.json()).booking.status,'CONFIRMED');
    const stale=await fetch(`${base}/api/admin/bookings/${created.id}`,{method:'PATCH',headers:{cookie,'x-csrf-token':session.csrf,'content-type':'application/json','origin':'http://127.0.0.1:8798'},body:JSON.stringify({expectedVersion:1,status:'COMPLETED'})});assert.equal(stale.status,409);
    const inquiry=await fetch(`${base}/api/inquiries`,{method:'POST',headers:{'content-type':'application/json','origin':'http://127.0.0.1:8798'},body:JSON.stringify({name:'문의고객',phone:'01033334444',topic:'일정 문의',message:'토요일도 가능한가요?'})});assert.equal(inquiry.status,201);
    const audits=await fetch(`${base}/api/admin/audit`,{headers:{cookie}});assert.equal(audits.status,200);assert.ok((await audits.json()).audit.length>=3);
  }finally{await app.close()}
  const app2=createBookingApp({dbPath,adminPassword:'Strong-Test-123!',allowedOrigin:'http://127.0.0.1:8798'});const address2=await app2.listen(0);try{const login=await fetch(`http://127.0.0.1:${address2.port}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json','origin':'http://127.0.0.1:8798'},body:JSON.stringify({email:'admin@booking.local',password:'Strong-Test-123!'})});const cookie2=login.headers.get('set-cookie').split(';')[0];const list=await fetch(`http://127.0.0.1:${address2.port}/api/admin/bookings`,{headers:{cookie:cookie2}});assert.equal((await list.json()).bookings.length,1)}finally{await app2.close();rmSync(dir,{recursive:true,force:true})}
});
