import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';

const digest=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
function verify(root,product){
  const manifestPath=join(root,'MANIFEST.json');assert.ok(existsSync(manifestPath));const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));assert.equal(manifest.product,product);assert.ok(manifest.files.length>=7);
  for(const entry of manifest.files){const path=join(root,entry.path);assert.ok(existsSync(path),entry.path);const data=readFileSync(path);assert.equal(data.length,entry.bytes,entry.path);assert.equal(digest(path),entry.sha256,entry.path)}
}

test('Booking CRM delivery package is complete and checksum-verifiable',()=>{
  execFileSync(process.execPath,['scripts/booking-build-delivery.mjs'],{cwd:resolve('.')});
  const root=resolve('dist/booking-crm-delivery');verify(root,'BOOKING CRM');
  for(const file of ['server/app.mjs','server/store.mjs','scripts/booking-backup.mjs','scripts/booking-restore.mjs','deploy/.env.example','deploy/nginx.conf.example','deploy/booking-crm.service.example','DELIVERY_RUNBOOK.md'])assert.ok(existsSync(join(root,file)),file);
});

test('OPS KIT delivery package is complete and checksum-verifiable',()=>{
  execFileSync(process.execPath,['scripts/ops-kit-build-delivery.mjs'],{cwd:resolve('.')});
  const root=resolve('dist/ops-kit-delivery');verify(root,'OPS KIT');
  for(const file of ['index.html','app.js','engine.mjs','DELIVERY_RUNBOOK.md'])assert.ok(existsSync(join(root,file)),file);
});
