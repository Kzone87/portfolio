import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createIntegrationServer } from '../integration-control-center/server/app.mjs';

async function withServer(run) {
  const server = createIntegrationServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function json(response) {
  const body = await response.json();
  return { response, body };
}

async function postJson(url, body, headers = {}) {
  return json(await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body)
  }));
}

test('V3 API exposes health and seeded integration resources', async () => {
  await withServer(async (baseUrl) => {
    const health = await json(await fetch(`${baseUrl}/health`));
    assert.equal(health.response.status, 200);
    assert.equal(health.body.service, 'integration-control-center-v3');

    const connections = await json(await fetch(`${baseUrl}/api/connections`));
    assert.equal(connections.response.status, 200);
    assert.equal(connections.body.length, 7);
    assert.ok(connections.body.some((item) => item.id === 'orders-webhook-demo' && item.kind === 'Webhook'));

    const jobs = await json(await fetch(`${baseUrl}/api/jobs`));
    assert.equal(jobs.response.status, 200);
    assert.equal(jobs.body.length, 4);
    assert.ok(jobs.body.some((item) => item.id === 'job-order-webhook' && item.schedule === 'webhook'));
  });
});

test('creates a validated sync job and rejects an invalid flow', async () => {
  await withServer(async (baseUrl) => {
    const valid = await postJson(`${baseUrl}/api/jobs`, {
      name: 'Invoice export',
      source: 'erp-demo',
      target: 'analytics-demo',
      entity: 'invoices',
      schedule: 'daily',
      policy: 'retry-3'
    });
    assert.equal(valid.response.status, 201);
    assert.equal(valid.body.status, 'ACTIVE');
    assert.match(valid.response.headers.get('location'), /^\/api\/jobs\/job-/);

    const invalid = await postJson(`${baseUrl}/api/jobs`, {
      name: 'Broken flow',
      source: 'erp-demo',
      target: 'erp-demo',
      entity: 'orders',
      schedule: 'manual',
      policy: 'stop'
    });
    assert.equal(invalid.response.status, 400);
    assert.equal(invalid.body.code, 'SAME_CONNECTION');
  });
});

test('enforces status conflicts and prevents paused jobs from running', async () => {
  await withServer(async (baseUrl) => {
    const paused = await json(await fetch(`${baseUrl}/api/jobs/job-customer-master/status`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'PAUSED' })
    }));
    assert.equal(paused.response.status, 200);
    assert.equal(paused.body.status, 'PAUSED');

    const unchanged = await json(await fetch(`${baseUrl}/api/jobs/job-customer-master/status`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'PAUSED' })
    }));
    assert.equal(unchanged.response.status, 409);
    assert.equal(unchanged.body.code, 'STATUS_UNCHANGED');

    const blockedRun = await json(await fetch(`${baseUrl}/api/jobs/job-customer-master/runs`, { method: 'POST' }));
    assert.equal(blockedRun.response.status, 409);
    assert.equal(blockedRun.body.code, 'JOB_PAUSED');
  });
});

test('run endpoint records history and replays an idempotent request', async () => {
  await withServer(async (baseUrl) => {
    const first = await json(await fetch(`${baseUrl}/api/jobs/job-customer-master/runs`, {
      method: 'POST',
      headers: { 'idempotency-key': 'demo-request-1' }
    }));
    assert.equal(first.response.status, 201);
    assert.equal(first.body.result, 'SUCCESS');
    assert.equal(first.body.replayed, false);

    const replay = await json(await fetch(`${baseUrl}/api/jobs/job-customer-master/runs`, {
      method: 'POST',
      headers: { 'idempotency-key': 'demo-request-1' }
    }));
    assert.equal(replay.response.status, 200);
    assert.equal(replay.body.id, first.body.id);
    assert.equal(replay.body.replayed, true);

    const detail = await json(await fetch(`${baseUrl}/api/runs/${first.body.id}`));
    assert.equal(detail.response.status, 200);
    assert.equal(detail.body.trigger, 'MANUAL');
    assert.equal(detail.body.retryCount, 0);
  });
});

test('webhook endpoint deduplicates event IDs and connects event to a run', async () => {
  await withServer(async (baseUrl) => {
    const payload = { eventId: 'order-evt-1001', type: 'order.updated', payload: { orderId: 'O-1001' } };
    const first = await postJson(`${baseUrl}/api/webhooks/orders-webhook-demo`, payload);
    assert.equal(first.response.status, 202);
    assert.equal(first.body.status, 'PROCESSED');
    assert.equal(first.body.replayed, false);

    const replay = await postJson(`${baseUrl}/api/webhooks/orders-webhook-demo`, payload);
    assert.equal(replay.response.status, 200);
    assert.equal(replay.body.id, first.body.id);
    assert.equal(replay.body.runId, first.body.runId);
    assert.equal(replay.body.replayed, true);

    const events = await json(await fetch(`${baseUrl}/api/webhook-events`));
    assert.equal(events.response.status, 200);
    assert.equal(events.body.length, 1);

    const run = await json(await fetch(`${baseUrl}/api/runs/${first.body.runId}`));
    assert.equal(run.body.trigger, 'WEBHOOK');
    assert.equal(run.body.eventId, 'order-evt-1001');
  });
});

test('webhook validation rejects unknown, paused, and unsupported requests', async () => {
  await withServer(async (baseUrl) => {
    const unknown = await postJson(`${baseUrl}/api/webhooks/missing-demo`, { eventId: 'e1', type: 'order.updated', payload: {} });
    assert.equal(unknown.response.status, 404);
    assert.equal(unknown.body.code, 'CONNECTION_NOT_FOUND');

    const paused = await postJson(`${baseUrl}/api/webhooks/billing-demo`, { eventId: 'e2', type: 'invoice.updated', payload: {} });
    assert.equal(paused.response.status, 409);
    assert.equal(paused.body.code, 'CONNECTION_NOT_ACTIVE');

    const invalidType = await postJson(`${baseUrl}/api/webhooks/orders-webhook-demo`, { eventId: 'e3', type: 'order.deleted', payload: {} });
    assert.equal(invalidType.response.status, 400);
    assert.equal(invalidType.body.code, 'INVALID_EVENT_TYPE');
  });
});

test('failed webhook run can be retried and keeps retry lineage', async () => {
  await withServer(async (baseUrl) => {
    const event = await postJson(`${baseUrl}/api/webhooks/orders-webhook-demo`, {
      eventId: 'transient-evt-1',
      type: 'order.updated',
      payload: { simulateFailure: true }
    });
    assert.equal(event.response.status, 202);
    assert.equal(event.body.status, 'FAILED');

    const original = await json(await fetch(`${baseUrl}/api/runs/${event.body.runId}`));
    assert.equal(original.body.result, 'FAILED');
    assert.equal(original.body.retryCount, 0);

    const retry = await json(await fetch(`${baseUrl}/api/runs/${original.body.id}/retry`, { method: 'POST' }));
    assert.equal(retry.response.status, 201);
    assert.equal(retry.body.result, 'SUCCESS');
    assert.equal(retry.body.retryOf, original.body.id);
    assert.equal(retry.body.retryCount, 1);
    assert.equal(retry.body.trigger, 'RETRY');

    const retryAgain = await json(await fetch(`${baseUrl}/api/runs/${retry.body.id}/retry`, { method: 'POST' }));
    assert.equal(retryAgain.response.status, 409);
    assert.equal(retryAgain.body.code, 'RUN_NOT_RETRYABLE');
  });
});

test('persistent failure reaches dead letter after three retries', async () => {
  await withServer(async (baseUrl) => {
    const active = await json(await fetch(`${baseUrl}/api/jobs/job-stock-sync/status`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'ACTIVE' })
    }));
    assert.equal(active.response.status, 200);

    const original = await json(await fetch(`${baseUrl}/api/jobs/job-stock-sync/runs`, { method: 'POST' }));
    assert.equal(original.body.result, 'FAILED');

    const retry1 = await json(await fetch(`${baseUrl}/api/runs/${original.body.id}/retry`, { method: 'POST' }));
    assert.equal(retry1.body.result, 'FAILED');
    assert.equal(retry1.body.retryCount, 1);

    const retry2 = await json(await fetch(`${baseUrl}/api/runs/${retry1.body.id}/retry`, { method: 'POST' }));
    assert.equal(retry2.body.result, 'FAILED');
    assert.equal(retry2.body.retryCount, 2);

    const retry3 = await json(await fetch(`${baseUrl}/api/runs/${retry2.body.id}/retry`, { method: 'POST' }));
    assert.equal(retry3.body.result, 'DEAD_LETTER');
    assert.equal(retry3.body.retryCount, 3);
    assert.equal(retry3.body.deadLettered, true);

    const deadLetters = await json(await fetch(`${baseUrl}/api/dead-letters`));
    assert.equal(deadLetters.response.status, 200);
    assert.equal(deadLetters.body.length, 1);
    assert.equal(deadLetters.body[0].runId, retry3.body.id);
  });
});
