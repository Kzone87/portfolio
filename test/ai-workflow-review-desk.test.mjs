import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import {
  TASK_STATUS,
  applyHumanReview,
  nextTaskStatus,
  runGeneration,
  validateStructuredOutput
} from '../ai-workflow-review-desk/engine.mjs';
import { createAiReviewServer } from '../ai-workflow-review-desk/server/app.mjs';

function sampleTask(overrides = {}) {
  return {
    id: 1,
    title: 'Sample task',
    content: 'A customer reports an invoice payment error and asks for review.',
    status: TASK_STATUS.PENDING,
    version: 1,
    output: null,
    evaluation: null,
    ...overrides
  };
}

async function withServer(run) {
  const server = createAiReviewServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await run(baseUrl);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers ?? {})
    }
  });
  const body = await response.json();
  return { response, body };
}

test('AI engine produces validated structured output', () => {
  const result = runGeneration(sampleTask(), { promptVersion: 'triage-v2' });
  assert.equal(result.status, 'SUCCESS');
  assert.equal(result.providerId, 'mock-primary');
  assert.equal(validateStructuredOutput(result.output), true);
  assert.equal(result.output.category, 'billing');
  assert.equal(result.evaluation.requiresHumanReview, true);
});

test('primary provider failure falls back deterministically', () => {
  const result = runGeneration(sampleTask({
    content: '[FAIL_PRIMARY] Excel import fails because vendor columns changed.'
  }));
  assert.equal(result.status, 'SUCCESS');
  assert.equal(result.providerId, 'mock-fallback');
  assert.deepEqual(result.attempts.map((item) => item.status), ['FAILED', 'SUCCESS']);
  assert.equal(result.output.category, 'data');
});

test('high-risk output is routed to needs-review instead of auto approval', () => {
  const result = runGeneration(sampleTask({
    content: 'Security breach suspected. Customer data may have leaked from production.'
  }));
  assert.equal(result.output.risk, 'HIGH');
  assert.equal(nextTaskStatus(result), TASK_STATUS.NEEDS_REVIEW);
  assert.ok(result.evaluation.flags.includes('HIGH_RISK'));
});

test('human review can approve a schema-valid edited output', () => {
  const result = runGeneration(sampleTask());
  const generated = {
    ...sampleTask(),
    status: nextTaskStatus(result),
    version: 2,
    output: result.output,
    evaluation: result.evaluation
  };
  const edited = { ...result.output, nextAction: 'Verify the invoice and ask a human billing owner to confirm the refund.' };
  const reviewed = applyHumanReview(generated, 'APPROVE', edited);
  assert.equal(reviewed.status, TASK_STATUS.APPROVED);
  assert.equal(reviewed.version, 3);
  assert.equal(reviewed.output.nextAction, edited.nextAction);
});

test('HTTP API exposes credential-free health and prompt registry', async () => {
  await withServer(async (baseUrl) => {
    const health = await request(baseUrl, '/api/health');
    assert.equal(health.response.status, 200);
    assert.equal(health.body.providerMode, 'credential-free-mock');

    const prompts = await request(baseUrl, '/api/prompts');
    assert.equal(prompts.response.status, 200);
    assert.ok(prompts.body.items.some((item) => item.id === 'triage-v2'));
  });
});

test('HTTP workflow creates, generates with fallback, then requires current version for review', async () => {
  await withServer(async (baseUrl) => {
    const created = await request(baseUrl, '/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Vendor import problem',
        content: '[FAIL_PRIMARY] Excel import mapping changed and production upload fails.'
      })
    });
    assert.equal(created.response.status, 201);
    const taskId = created.body.id;

    const generated = await request(baseUrl, `/api/tasks/${taskId}/generate`, {
      method: 'POST',
      body: JSON.stringify({ promptVersion: 'triage-v2' })
    });
    assert.equal(generated.response.status, 200);
    assert.equal(generated.body.run.providerId, 'mock-fallback');
    assert.equal(generated.body.run.attempts.length, 2);

    const stale = await request(baseUrl, `/api/tasks/${taskId}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision: 'APPROVE', expectedVersion: 1, reviewer: 'qa-user' })
    });
    assert.equal(stale.response.status, 409);
    assert.equal(stale.body.error.code, 'STALE_REVIEW');

    const currentVersion = generated.body.task.version;
    const approved = await request(baseUrl, `/api/tasks/${taskId}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision: 'APPROVE', expectedVersion: currentVersion, reviewer: 'qa-user' })
    });
    assert.equal(approved.response.status, 200);
    assert.equal(approved.body.task.status, 'APPROVED');

    const regenerate = await request(baseUrl, `/api/tasks/${taskId}/generate`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    assert.equal(regenerate.response.status, 409);
    assert.equal(regenerate.body.error.code, 'TASK_FINALIZED');

    const reviews = await request(baseUrl, '/api/reviews');
    assert.equal(reviews.response.status, 200);
    assert.ok(reviews.body.items.some((item) => item.taskId === taskId && item.decision === 'APPROVE'));
  });
});

test('HTTP API rejects invalid task payload', async () => {
  await withServer(async (baseUrl) => {
    const result = await request(baseUrl, '/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'x', content: 'bad' })
    });
    assert.equal(result.response.status, 400);
    assert.equal(result.body.error.code, 'INVALID_TASK');
  });
});

test('public AI lab uses no external network/storage credentials', async () => {
  const html = await readFile(new URL('../ai-workflow-review-desk/index.html', import.meta.url), 'utf8');
  const app = await readFile(new URL('../ai-workflow-review-desk/app.js', import.meta.url), 'utf8');
  const engine = await readFile(new URL('../ai-workflow-review-desk/engine.mjs', import.meta.url), 'utf8');
  const content = [html, app, engine].join('\n');
  assert.match(html, /NO API KEY/);
  assert.doesNotMatch(app, /fetch\s*\(|localStorage|sessionStorage/);
  assert.doesNotMatch(content, /sk-[A-Za-z0-9_-]{20,}/);
  assert.doesNotMatch(content, /AIza[0-9A-Za-z_-]{20,}/);
  assert.match(app, /textContent/);
});
