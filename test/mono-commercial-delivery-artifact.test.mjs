import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow=fs.readFileSync(new URL('../.github/workflows/mono-commercial-runtime-qa.yml',import.meta.url),'utf8');
const builder=fs.readFileSync(new URL('../scripts/mono-build-delivery.mjs',import.meta.url),'utf8');
const runbook=fs.readFileSync(new URL('../mono-operations/DELIVERY_RUNBOOK.md',import.meta.url),'utf8');
const envTemplate=fs.readFileSync(new URL('../mono-operations/deploy/.env.example',import.meta.url),'utf8');

test('commercial delivery artifact upload preserves hidden configuration templates',()=>{
  const block=workflow.match(/- name: Upload delivery package[\s\S]*?(?=\n\s*- name:|$)/)?.[0]||'';
  assert.match(block,/name:\s*mono-operations-commercial-delivery/);
  assert.match(block,/path:\s*dist\/mono-operations-delivery/);
  assert.match(block,/include-hidden-files:\s*true/);
  assert.match(block,/if-no-files-found:\s*error/);
});

test('delivery builder and acceptance contract require env template plus manifest integrity',()=>{
  assert.match(builder,/copy\('mono-operations\/deploy','deploy'\)/);
  assert.match(builder,/MANIFEST\.json/);
  assert.match(builder,/createHash\('sha256'\)/);
  assert.match(runbook,/`deploy\/\.env\.example`/);
  assert.match(runbook,/MANIFEST\.json/);
  assert.match(runbook,/SHA-256/);
  assert.match(runbook,/include-hidden-files:\s*true/);
  assert.match(envTemplate,/NODE_ENV=production/);
  assert.match(envTemplate,/MONO_DB_PATH=/);
  assert.match(envTemplate,/MONO_SECRET_KEY=/);
  assert.match(envTemplate,/MONO_PUBLIC_ORIGIN=https:\/\//);
});
