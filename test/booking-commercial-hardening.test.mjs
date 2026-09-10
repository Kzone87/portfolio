import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createBookingApp} from '../booking-crm/server/app.mjs';
import {BookingStore} from '../booking-crm/server/store.mjs';

const ORIGIN='http://127.0.0.1:8798';
const sha=value=>createHash('sha256').update(String(value)).digest('hex');

async function request(base,path,{method='GET',cookie='',csrf='',body}={}){
  const response=await fetch(`${base}${path}`,{method,headers:{origin:ORIGIN,...(cookie?{cookie}:{}),...(csrf?{'x-csrf-token':csrf}:{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  return {response,body:await response.json().catch(()=>({}))};
}
async function login(base,email,password){
  const result=await request(base,'/api/auth/login',{method:'POST',body:{email,password}});
  return {...result,cookie:String(result.response.headers.get('set-cookie')||'').split(';')[0],csrf:result.body.csrf};
}

test('Booking CRM rejects weak first-admin credentials',()=>{
  assert.throws(()=>new BookingStore({adminPassword:'short1'}),/WEAK_PASSWORD/);
});

test('Booking CRM hashes bearer sessions at rest and supports guarded employee lifecycle',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'booking-hardening-')),dbPath=join(dir,'booking.sqlite');
  const adminPassword='Strong-Admin-123!';
  const app=createBookingApp({dbPath,adminPassword,allowedOrigin:ORIGIN});
  const address=await app.listen(0),base=`http://127.0.0.1:${address.port}`;
  try{
    const ready=await request(base,'/ready');assert.equal(ready.response.status,200);assert.equal(ready.body.database,true);
    const admin=await login(base,'admin@booking.local',adminPassword);assert.equal(admin.response.status,200);assert.equal(admin.body.employee.role,'ADMIN');
    const rawSession=decodeURIComponent(admin.cookie.split('=')[1]);
    const inspect=new DatabaseSync(dbPath);try{const row=inspect.prepare('SELECT id FROM sessions LIMIT 1').get();assert.notEqual(row.id,rawSession);assert.equal(row.id,sha(rawSession))}finally{inspect.close()}

    const created=await request(base,'/api/admin/employees',{method:'POST',cookie:admin.cookie,csrf:admin.csrf,body:{email:'staff@example.com',name:'예약담당자',role:'STAFF',password:'Staff-Access-123!'}});
    assert.equal(created.response.status,201);assert.equal(created.body.employee.role,'STAFF');const staffId=created.body.employee.id;
    const staff=await login(base,'staff@example.com','Staff-Access-123!');assert.equal(staff.response.status,200);
    const forbidden=await request(base,'/api/admin/employees',{cookie:staff.cookie});assert.equal(forbidden.response.status,403);

    const disabled=await request(base,`/api/admin/employees/${staffId}`,{method:'PATCH',cookie:admin.cookie,csrf:admin.csrf,body:{active:false}});assert.equal(disabled.response.status,200);assert.equal(disabled.body.employee.active,false);
    const revoked=await request(base,'/api/me',{cookie:staff.cookie});assert.equal(revoked.response.status,401);
    const lastAdmin=await request(base,'/api/admin/employees/E-ADMIN',{method:'PATCH',cookie:admin.cookie,csrf:admin.csrf,body:{active:false}});assert.equal(lastAdmin.response.status,409);assert.equal(lastAdmin.body.error,'LAST_ADMIN_REQUIRED');

    const enabled=await request(base,`/api/admin/employees/${staffId}`,{method:'PATCH',cookie:admin.cookie,csrf:admin.csrf,body:{active:true}});assert.equal(enabled.response.status,200);
    const beforeReset=await login(base,'staff@example.com','Staff-Access-123!');assert.equal(beforeReset.response.status,200);
    const reset=await request(base,`/api/admin/employees/${staffId}/reset-password`,{method:'POST',cookie:admin.cookie,csrf:admin.csrf,body:{password:'Staff-New-456!'}});assert.equal(reset.response.status,200);
    const revokedByReset=await request(base,'/api/me',{cookie:beforeReset.cookie});assert.equal(revokedByReset.response.status,401);
    const oldLogin=await login(base,'staff@example.com','Staff-Access-123!');assert.equal(oldLogin.response.status,401);
    const newLogin=await login(base,'staff@example.com','Staff-New-456!');assert.equal(newLogin.response.status,200);
    const audit=await request(base,'/api/admin/audit',{cookie:admin.cookie});assert.equal(audit.response.status,200);assert.ok(audit.body.audit.some(row=>row.action==='EMPLOYEE_PASSWORD_RESET'));
  }finally{await app.close();rmSync(dir,{recursive:true,force:true})}
});
