import test from 'node:test';
import assert from 'node:assert/strict';
import { slugify, validateContent, publishContent, parseKeyValueText, extractTableRows, validateAutomationPlan, simulateAutomation, isAllowedOrigin, safeRedirect, maskSecret, safeSpreadsheetCell, securityHeaders, evaluateRelease, deploymentDecision } from '../mini-labs/engine.mjs';

test('CMS lab normalizes slugs and blocks invalid publish', () => {
  assert.equal(slugify(' Hello, 업무 World! '), 'hello-업무-world');
  const invalid = validateContent({ title: 'x', body: 'short' });
  assert.equal(invalid.valid, false);
  assert.throws(() => publishContent({ title: 'x', body: 'short' }), /CONTENT_INVALID/);
  const out = publishContent({ title: 'Release Note', body: 'This is a sufficiently long fictional content body for publishing.' });
  assert.equal(out.status, 'PUBLISHED');
  assert.equal(out.slug, 'release-note');
});

test('Extraction lab parses key value and strict table rows', () => {
  assert.deepEqual(parseKeyValueText('Invoice No: A-1\nCustomer Name: Example Co'), { invoice_no: 'A-1', customer_name: 'Example Co' });
  assert.deepEqual(extractTableRows('id,name\n1,Alice\n2,Bob'), [{ id: '1', name: 'Alice' }, { id: '2', name: 'Bob' }]);
  assert.throws(() => extractTableRows('id,name\n1'), /COLUMN_MISMATCH/);
  assert.throws(() => extractTableRows('id,id\n1,2'), /INVALID_HEADERS/);
});

test('Browser automation lab allows only deterministic allowlisted plans', () => {
  const plan = validateAutomationPlan([
    { id: 'open', type: 'NAVIGATE', target: 'https://example.com/form' },
    { id: 'fill', type: 'INPUT', target: '#name', value: 'Demo' },
    { id: 'submit', type: 'CLICK', target: '#submit' },
    { id: 'assert', type: 'ASSERT_TEXT', target: '#status', value: 'Saved' }
  ]);
  assert.equal(plan.length, 4);
  assert.throws(() => validateAutomationPlan([{ type: 'NAVIGATE', target: 'http://example.com' }]), /NAVIGATION_NOT_ALLOWLISTED/);
  assert.throws(() => validateAutomationPlan([{ type: 'NAVIGATE', target: 'https://evil.example.net' }]), /NAVIGATION_NOT_ALLOWLISTED/);
  assert.equal(simulateAutomation(plan, { failAt: 'submit' }).status, 'FAILED');
  assert.equal(simulateAutomation(plan).completed, 4);
});

test('Security lab blocks open redirects and spreadsheet formulas', () => {
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
});

test('QA deployment lab blocks release until required gates pass', () => {
  const no = evaluateRelease({ tests: true, build: true, secretScan: false, healthCheck: true, rollbackPlan: false });
  assert.equal(no.ready, false);
  assert.deepEqual(no.failed, ['secretScan', 'rollbackPlan']);
  assert.equal(deploymentDecision(no).decision, 'NO_GO');
  const yes = deploymentDecision({ tests: true, build: true, secretScan: true, healthCheck: true, rollbackPlan: true, observability: true, backupVerified: true });
  assert.equal(yes.ready, true);
  assert.equal(yes.decision, 'GO');
  assert.equal(yes.score, 100);
});
