import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { auditSecurityInputs, createEvidence, extractTableRows, validateAutomationPlan } from '../mini-labs/engine.mjs';

const html = await readFile(new URL('../mini-labs/index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../mini-labs/app.js', import.meta.url), 'utf8');
const readme = await readFile(new URL('../mini-labs/README.md', import.meta.url), 'utf8');

test('public service does not claim to execute external browser automation', () => {
  assert.match(html, /실제 사이트에는 접속하지 않습니다/);
  assert.match(html, /외부 시스템 조작 없음/);
  assert.match(readme, /실제 network\/navigation 없음/);
  assert.doesNotMatch(app, /page\.goto|browser\.newPage|window\.location\s*=/);
});

test('CSV service parser accepts business commas and escaped quotes', () => {
  const rows = extractTableRows('customer,name,note\nC001,"Mono, Inc","He said ""ready"""');
  assert.deepEqual(rows, [{ customer: 'C001', name: 'Mono, Inc', note: 'He said "ready"' }]);
});

test('workflow navigation accepts public HTTPS and blocks private destinations', () => {
  assert.doesNotThrow(() => validateAutomationPlan([{ id: 'open', type: 'NAVIGATE', target: 'https://example.org/form' }]));
  for (const url of ['http://example.org', 'https://localhost/admin', 'https://10.0.0.1/admin', 'https://192.168.0.1', 'https://user:pass@example.org']) {
    assert.throws(() => validateAutomationPlan([{ id: 'open', type: 'NAVIGATE', target: url }]), /NAVIGATION_NOT_SAFE/);
  }
});

test('Security Check evidence boundary excludes raw secret', () => {
  const rawSecret = 'super-private-demo-value';
  const result = auditSecurityInputs({ origin: 'https://example.com', allowedOrigin: 'https://example.com', base: 'https://example.com', redirect: '/ok', spreadsheetCell: 'safe', secret: rawSecret });
  const evidence = createEvidence({ tool: 'Security Check', status: result.pass ? 'PASS' : 'CHECK', summary: 'security result', details: { findings: result.findings, maskedSecret: result.maskedSecret } , generatedAt: '2026-09-10T00:00:00.000Z' });
  const serialized = JSON.stringify(evidence);
  assert.equal(serialized.includes(rawSecret), false);
  assert.match(serialized, /\*+/);
});

test('service documentation defines actual limits and final production acceptance', () => {
  for (const phrase of ['100KB', '5,000행', '100열', '최대 30단계', 'same-SHA GitHub Pages', 'console error', 'horizontal overflow']) assert.match(readme, new RegExp(phrase));
});
