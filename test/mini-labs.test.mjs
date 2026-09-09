import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LIMITS,
  slugify,
  validateContent,
  publishContent,
  parseKeyValueText,
  parseCsvMatrix,
  extractTableRows,
  extractionSummary,
  validateAutomationPlan,
  simulateAutomation,
  isAllowedOrigin,
  safeRedirect,
  maskSecret,
  safeSpreadsheetCell,
  securityHeaders,
  auditSecurityInputs,
  evaluateRelease,
  deploymentDecision,
  createEvidence,
  evidenceToJson
} from '../mini-labs/engine.mjs';

test('Content Preflight normalizes slugs, blocks invalid publish and surfaces placeholders', () => {
  assert.equal(slugify(' Hello, 업무 World! '), 'hello-업무-world');
  const invalid = validateContent({ title: 'x', body: 'short' });
  assert.equal(invalid.valid, false);
  assert.throws(() => publishContent({ title: 'x', body: 'short' }), /CONTENT_INVALID/);
  const warning = validateContent({ title: 'Release Note', body: 'This is a long enough body with TODO placeholder content.' });
  assert.equal(warning.valid, true);
  assert.deepEqual(warning.warnings, ['PLACEHOLDER_FOUND']);
  const out = publishContent({ title: 'Release Note', body: 'This is a sufficiently long fictional content body for publishing.' });
  assert.equal(out.status, 'PUBLISHED');
  assert.equal(out.slug, 'release-note');
});

test('Data Extractor handles quoted CSV and rejects ambiguous structures', () => {
  assert.deepEqual(parseKeyValueText('Invoice No: A-1\nCustomer Name: Example Co'), { invoice_no: 'A-1', customer_name: 'Example Co' });
  assert.throws(() => parseKeyValueText('ID: 1\nID: 2'), /DUPLICATE_KEY/);
  assert.deepEqual(parseCsvMatrix('id,name,note\n1,"Mono, Inc","a ""quoted"" value"'), [['id', 'name', 'note'], ['1', 'Mono, Inc', 'a "quoted" value']]);
  assert.deepEqual(extractTableRows('id,name\n1,Alice\n2,Bob'), [{ id: '1', name: 'Alice' }, { id: '2', name: 'Bob' }]);
  assert.throws(() => extractTableRows('id,name\n1'), /COLUMN_MISMATCH/);
  assert.throws(() => extractTableRows('id,id\n1,2'), /INVALID_HEADERS/);
  assert.throws(() => extractTableRows('id,name\n1,"Alice'), /UNCLOSED_QUOTE/);
  const summary = extractionSummary('ID: A-1', 'id,name\n1,Alice');
  assert.deepEqual(summary.counts, { fields: 1, rows: 1, columns: 2 });
  assert.throws(() => parseKeyValueText('x'.repeat(LIMITS.textInputBytes + 1)), /INPUT_TOO_LARGE/);
});

test('Workflow Dry-Run validates public HTTPS plans without browsing', () => {
  const plan = validateAutomationPlan([
    { id: 'open', type: 'NAVIGATE', target: 'https://example.com/form' },
    { id: 'fill', type: 'INPUT', target: '#name', value: 'Demo' },
    { id: 'wait', type: 'WAIT_FOR', target: '#ready' },
    { id: 'submit', type: 'CLICK', target: '#submit' },
    { id: 'assert', type: 'ASSERT_TEXT', target: '#status', value: 'Saved' }
  ]);
  assert.equal(plan.length, 5);
  assert.throws(() => validateAutomationPlan([{ type: 'NAVIGATE', target: 'http://example.com' }]), /NAVIGATION_NOT_SAFE/);
  assert.throws(() => validateAutomationPlan([{ type: 'NAVIGATE', target: 'https://127.0.0.1/admin' }]), /NAVIGATION_NOT_SAFE/);
  assert.throws(() => validateAutomationPlan([{ type: 'NAVIGATE', target: 'https://user:pass@example.com' }]), /NAVIGATION_NOT_SAFE/);
  assert.throws(() => validateAutomationPlan([{ id: 'a', type: 'CLICK', target: '#a' }, { id: 'a', type: 'CLICK', target: '#b' }]), /DUPLICATE_STEP_ID/);
  assert.equal(simulateAutomation(plan, { failAt: 'submit' }).status, 'FAILED');
  assert.equal(simulateAutomation(plan).completed, 5);
});

test('Security Check blocks cross-origin redirects, masks secrets and neutralizes spreadsheet formulas', () => {
  assert.equal(isAllowedOrigin('https://example.com'), true);
  assert.equal(isAllowedOrigin('http://example.com'), false);
  assert.equal(safeRedirect('/dashboard?tab=1'), '/dashboard?tab=1');
  assert.equal(safeRedirect('https://evil.example.net/phish'), '/');
  assert.equal(safeSpreadsheetCell('=SUM(1,2)'), "'=SUM(1,2)");
  assert.equal(safeSpreadsheetCell('plain'), 'plain');
  assert.match(maskSecret('abcdefghijkl'), /^ab\*+kl$/);
  const headers = securityHeaders();
  assert.equal(headers['x-content-type-options'], 'nosniff');
  assert.match(headers['content-security-policy'], /default-src 'self'/);

  const safe = auditSecurityInputs({ origin: 'https://example.com', allowedOrigin: 'https://example.com', base: 'https://example.com', redirect: '/dashboard', spreadsheetCell: 'plain', secret: '12345678' });
  assert.equal(safe.pass, true);
  const unsafe = auditSecurityInputs({ origin: 'https://evil.example.net', allowedOrigin: 'https://example.com', base: 'https://example.com', redirect: 'https://evil.example.net', spreadsheetCell: '=2+2', secret: '123' });
  assert.equal(unsafe.pass, false);
  assert.equal(unsafe.normalizedRedirect, '/');
  assert.equal(unsafe.safeCell, "'=2+2");
  assert.equal(unsafe.maskedSecret, '***');
});

test('Release Gate blocks deployment until every required gate passes', () => {
  const no = evaluateRelease({ tests: true, build: true, secretScan: false, healthCheck: true, rollbackPlan: false });
  assert.equal(no.ready, false);
  assert.deepEqual(no.failed, ['secretScan', 'rollbackPlan']);
  assert.equal(deploymentDecision(no).decision, 'NO_GO');
  const yes = deploymentDecision({ tests: true, build: true, secretScan: true, healthCheck: true, rollbackPlan: true, observability: true, backupVerified: true });
  assert.equal(yes.ready, true);
  assert.equal(yes.decision, 'GO');
  assert.equal(yes.score, 100);
  assert.deepEqual(yes.warnings, []);
});

test('Evidence contract is versioned, bounded and reproducible for a fixed timestamp', () => {
  const input = { tool: 'Release Gate', status: 'GO', summary: 'ready', details: { failed: [], note: 'x'.repeat(3000) }, generatedAt: '2026-09-10T00:00:00.000Z' };
  const first = createEvidence(input);
  const second = createEvidence(input);
  assert.equal(first.schemaVersion, 1);
  assert.equal(first.product, 'OPS KIT');
  assert.equal(first.fingerprint, second.fingerprint);
  assert.equal(first.details.note.length, 2000);
  assert.match(evidenceToJson(first), /"fingerprint"/);
});
