import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const load=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('Booking CRM runbook requires verified recovery and employee lifecycle controls',async()=>{
  const runbook=await load('booking-crm/DELIVERY_RUNBOOK.md');
  for(const phrase of ['build:booking-delivery','MANIFEST.json','RESTORE_BOOKING','PRAGMA quick_check','last active ADMIN','reset-password','same main SHA'])assert.match(runbook,new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'));
});
