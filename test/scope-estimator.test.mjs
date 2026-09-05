import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBrief, evaluateScope, sanitizeScopeInput } from '../scope-estimator/engine.mjs';

const base = {
  projectType: 'feature',
  existing: 'new',
  roles: 'single',
  data: 'simple',
  integrations: 'none',
  operation: 'basic',
  schedule: 'normal'
};

test('simple isolated feature stays in STANDARD guide', () => {
  const result = evaluateScope(base);
  assert.equal(result.packageName, 'STANDARD');
  assert.equal(result.budget, '49~99만원');
  assert.equal(result.score, 1);
});

test('typical excel workflow starts in DELUXE guide', () => {
  const result = evaluateScope({ ...base, projectType: 'excel' });
  assert.equal(result.packageName, 'DELUXE');
  assert.equal(result.budget, '149~299만원');
  assert.match(result.firstPhase, /Import/);
});

test('relational admin workflow with multiple roles reaches PREMIUM', () => {
  const result = evaluateScope({
    ...base,
    projectType: 'admin',
    roles: 'multi',
    data: 'relational'
  });
  assert.equal(result.packageName, 'PREMIUM');
  assert.equal(result.budget, '299~499만원');
  assert.ok(result.reasons.some((reason) => reason.includes('역할')));
});

test('high-complexity existing integration is classified CUSTOM', () => {
  const result = evaluateScope({
    projectType: 'integration',
    existing: 'existing',
    roles: 'multi',
    data: 'relational',
    integrations: 'multiple',
    operation: 'advanced',
    schedule: 'urgent'
  });
  assert.equal(result.packageName, 'CUSTOM');
  assert.equal(result.budget, '499만원 이상');
  assert.ok(result.score > 5);
});

test('untrusted enum values are normalized to allow-listed defaults', () => {
  const sanitized = sanitizeScopeInput({
    projectType: '<script>',
    existing: 'drop-table',
    roles: 'multi'
  });
  assert.equal(sanitized.projectType, 'feature');
  assert.equal(sanitized.existing, 'new');
  assert.equal(sanitized.roles, 'multi');
});

test('generated brief contains package guide but no user secrets', () => {
  const result = evaluateScope({ ...base, projectType: 'integration', integrations: 'one' });
  const brief = buildBrief(result);
  assert.match(brief, /1차 개발 범위 문의/);
  assert.match(brief, /예상 패키지 가이드/);
  assert.match(brief, /외부 연동 1개/);
  assert.doesNotMatch(brief, /password|api[_-]?key|token/i);
});
