import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const load=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('commercial delivery matrix distinguishes server and local-first product boundaries',async()=>{
  const matrix=await load('COMMERCIAL_DELIVERY_MATRIX.md');
  for(const phrase of ['NEXA SERVICE SUITE','BOOKING CRM','MONO OPERATIONS','Excel Workbench','OPS KIT','fail-closed','multi-tenant SaaS isolation'])assert.match(matrix,new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(matrix,/public demo is not treated as proof/i);
});
