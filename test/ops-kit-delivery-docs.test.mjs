import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const load=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('OPS KIT handover documents local-first scope and manifest verification',async()=>{
  const runbook=await load('mini-labs/DELIVERY_RUNBOOK.md');
  for(const phrase of ['local-first','MANIFEST.json','SHA-256','connect-src','simulation','no server-side user data'])assert.match(runbook,new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'));
});
