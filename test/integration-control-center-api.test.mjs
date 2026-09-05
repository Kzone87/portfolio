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

test('V2 API exposes health and seeded integration resources', async () => {
  await withServer(async (baseUrl) => {
    const health = await json(await fetch(`${baseUrl}/health`));
    assert.equal(health.response.status, 200);
    assert.equal(health.body.service, 'integration-control-center-v2');

    const connections = await json(await fetch(`${baseUrl}/api/connections`));
    assert.equal(connections.response.status, 200);
    assert.equal(connections.body.length, 6);

    const jobs = await json(await fetch(`${baseUrl}/api/jobs`));
    assert.equal(jobs.response.status, 200);
    assert.equal(jobs.body.length, 3);
  });
});

test('creates a validated sync job and rejects an invalid flow', async () => {
  await withServer(async (baseUrl) => {
    const valid = await json(await fetch(`${baseUrl}/api/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Invoice export',
        source: 'erp-demo',
        target: 'analytics-demo',
        entity: 'invoices',
        schedule: 'daily',
        policy: 'retry-3'
      })
    }));
    assert.equal(valid.response.status, 201);
    assert.equal(valid.body.status, 'ACTIVE');
    assert.match(valid.response.headers.get('location'), /^\/api\/jobs\/job-/);

    const invalid = await json(await fetch(`${baseUrl}/api/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Broken flow',
        source: 'erp-demo',
        target: 'erp-demo',
        entity: 'orders',
        schedule: 'manual',
        policy: 'stop'
      })
    }));
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

    const runs = await json(await fetch(`${baseUrl}/api/runs`));
    assert.equal(runs.response.status, 200);
    assert.equal(runs.body.length, 1);
  });
});

test('connection health failure is captured as a failed run instead of crashing', async () => {
  await withServer(async (baseUrl) => {
    const active = await json(await fetch(`${baseUrl}/api/jobs/job-stock-sync/status`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'ACTIVE' })
    }));
    assert.equal(active.response.status, 200);

    const failed = await json(await fetch(`${baseUrl}/api/jobs/job-stock-sync/runs`, { method: 'POST' }));
    assert.equal(failed.response.status, 201);
    assert.equal(failed.body.result, 'FAILED');
    assert.match(failed.body.detail, /health check failed/);
  });
});
