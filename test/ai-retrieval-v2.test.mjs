import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { listKnowledgeDocuments, retrieveKnowledge } from '../ai-workflow-review-desk/knowledge.mjs';
import { TASK_STATUS, nextTaskStatus, runGeneration } from '../ai-workflow-review-desk/engine.mjs';
import { createAiReviewServer } from '../ai-workflow-review-desk/server/app.mjs';

function sampleTask(overrides = {}) {
  return {
    id: 1,
    title: 'Duplicate invoice charge',
    content: 'A customer reports a duplicate invoice payment charge and asks whether a refund can be approved.',
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

test('knowledge catalog is local, structured and non-empty', () => {
  const documents = listKnowledgeDocuments();
  assert.ok(documents.length >= 6);
  assert.ok(documents.every((item) => item.id && item.title && item.category && item.sectionCount >= 1));
  assert.ok(documents.some((item) => item.id === 'billing-refund-policy'));
  assert.ok(documents.some((item) => item.id === 'security-escalation-policy'));
});

test('retrieval ranks relevant billing evidence and reports coverage', () => {
  const result = retrieveKnowledge('duplicate invoice payment charge refund', { limit: 3 });
  assert.ok(result.evidence.length >= 1);
  assert.equal(result.evidence[0].documentId, 'billing-refund-policy');
  assert.equal(result.evidence[0].rank, 1);
  assert.ok(result.evidence[0].score > 0);
  assert.ok(result.evidence[0].matchedTerms.includes('duplicate'));
  assert.ok(result.coverage > 0);
});

test('retrieval does not invent evidence for unrelated input', () => {
  const result = retrieveKnowledge('quantum banana satellites');
  assert.deepEqual(result.evidence, []);
  assert.equal(result.coverage, 0);
});

test('grounded generation preserves evidence through provider fallback', () => {
  const result = runGeneration(sampleTask({
    content: '[FAIL_PRIMARY] A customer reports a duplicate invoice payment charge and requests refund review.'
  }));
  assert.equal(result.status, 'SUCCESS');
  assert.equal(result.promptVersion, 'triage-grounded-v2');
  assert.equal(result.providerId, 'mock-fallback');
  assert.deepEqual(result.attempts.map((item) => item.status), ['FAILED', 'SUCCESS']);
  assert.ok(result.retrieval.evidence.length >= 1);
  assert.equal(result.retrieval.evidence[0].documentId, 'billing-refund-policy');
  assert.ok(result.evaluation.flags.includes('EVIDENCE_FOUND'));
  assert.match(result.output.nextAction, /supporting local evidence/);
});

test('no-evidence generation is forced into human review', () => {
  const result = runGeneration(sampleTask({
    title: 'Unrelated request',
    content: 'Quantum banana satellites require a ceremonial purple telescope.'
  }));
  assert.equal(result.status, 'SUCCESS');
  assert.deepEqual(result.retrieval.evidence, []);
  assert.ok(result.evaluation.flags.includes('NO_EVIDENCE'));
  assert.equal(nextTaskStatus(result), TASK_STATUS.NEEDS_REVIEW);
});

test('HTTP API exposes knowledge retrieval and stores evidence in review audit', async () => {
  await withServer(async (baseUrl) => {
    const knowledge = await request(baseUrl, '/api/knowledge');
    assert.equal(knowledge.response.status, 200);
    assert.ok(knowledge.body.items.some((item) => item.id === 'data-import-runbook'));

    const retrieval = await request(baseUrl, '/api/retrieval', {
      method: 'POST',
      body: JSON.stringify({ query: 'excel import mapping schema validation', limit: 2 })
    });
    assert.equal(retrieval.response.status, 200);
    assert.ok(retrieval.body.evidence.length >= 1);
    assert.equal(retrieval.body.evidence[0].documentId, 'data-import-runbook');

    const created = await request(baseUrl, '/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Import mapping failure',
        content: 'Excel import mapping changed and schema validation fails.'
      })
    });
    assert.equal(created.response.status, 201);

    const generated = await request(baseUrl, `/api/tasks/${created.body.id}/generate`, {
      method: 'POST',
      body: JSON.stringify({ promptVersion: 'triage-grounded-v2' })
    });
    assert.equal(generated.response.status, 200);
    assert.ok(generated.body.run.retrieval.evidence.length >= 1);

    const approved = await request(baseUrl, `/api/tasks/${created.body.id}/review`, {
      method: 'POST',
      body: JSON.stringify({
        decision: 'APPROVE',
        expectedVersion: generated.body.task.version,
        reviewer: 'evidence-reviewer'
      })
    });
    assert.equal(approved.response.status, 200);

    const reviews = await request(baseUrl, '/api/reviews');
    const review = reviews.body.items.find((item) => item.taskId === created.body.id);
    assert.ok(review);
    assert.ok(Array.isArray(review.evidenceIds));
    assert.ok(review.evidenceIds.length >= 1);
    assert.equal(typeof review.evidenceCoverage, 'number');
  });
});
