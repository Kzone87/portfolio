import http from 'node:http';
import { ApiError, createStore } from './store.mjs';

function sendJson(response, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
    ...extraHeaders
  });
  response.end(payload);
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 100_000) throw new ApiError(413, 'BODY_TOO_LARGE', 'Request body is too large.');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }
}

function routeMatch(pathname, pattern) {
  const pathParts = pathname.split('/').filter(Boolean);
  const patternParts = pattern.split('/').filter(Boolean);
  if (pathParts.length !== patternParts.length) return null;
  const params = {};
  for (let index = 0; index < patternParts.length; index += 1) {
    const expected = patternParts[index];
    const actual = pathParts[index];
    if (expected.startsWith(':')) params[expected.slice(1)] = decodeURIComponent(actual);
    else if (expected !== actual) return null;
  }
  return params;
}

function parseLimit(url, fallback = 50) {
  const value = Number(url.searchParams.get('limit') ?? String(fallback));
  return Number.isInteger(value) ? value : fallback;
}

export function createIntegrationHandler(store = createStore()) {
  return async function handler(request, response) {
    try {
      const url = new URL(request.url, 'http://localhost');
      const method = request.method ?? 'GET';

      if (method === 'GET' && url.pathname === '/health') {
        return sendJson(response, 200, { status: 'ok', service: 'integration-control-center-v3' });
      }
      if (method === 'GET' && url.pathname === '/api/connections') {
        return sendJson(response, 200, store.listConnections());
      }
      if (method === 'GET' && url.pathname === '/api/jobs') {
        return sendJson(response, 200, store.listJobs());
      }
      if (method === 'POST' && url.pathname === '/api/jobs') {
        const created = store.createJob(await readJson(request));
        return sendJson(response, 201, created, { location: `/api/jobs/${created.id}` });
      }
      if (method === 'GET' && url.pathname === '/api/runs') {
        return sendJson(response, 200, store.listRuns(parseLimit(url)));
      }
      if (method === 'GET' && url.pathname === '/api/webhook-events') {
        return sendJson(response, 200, store.listWebhookEvents(parseLimit(url)));
      }
      if (method === 'GET' && url.pathname === '/api/dead-letters') {
        return sendJson(response, 200, store.listDeadLetters(parseLimit(url)));
      }

      const statusParams = routeMatch(url.pathname, '/api/jobs/:id/status');
      if (method === 'PATCH' && statusParams) {
        const body = await readJson(request);
        return sendJson(response, 200, store.setJobStatus(statusParams.id, body.status));
      }

      const runParams = routeMatch(url.pathname, '/api/jobs/:id/runs');
      if (method === 'POST' && runParams) {
        const run = store.runJob(runParams.id, request.headers['idempotency-key'] ?? '');
        return sendJson(response, run.replayed ? 200 : 201, run);
      }

      const runDetailParams = routeMatch(url.pathname, '/api/runs/:id');
      if (method === 'GET' && runDetailParams) {
        return sendJson(response, 200, store.getRun(runDetailParams.id));
      }

      const retryParams = routeMatch(url.pathname, '/api/runs/:id/retry');
      if (method === 'POST' && retryParams) {
        return sendJson(response, 201, store.retryRun(retryParams.id));
      }

      const webhookParams = routeMatch(url.pathname, '/api/webhooks/:connectionId');
      if (method === 'POST' && webhookParams) {
        const event = store.receiveWebhook(webhookParams.connectionId, await readJson(request));
        return sendJson(response, event.replayed ? 200 : 202, event);
      }

      return sendJson(response, 404, { code: 'ROUTE_NOT_FOUND', message: 'Route not found.' });
    } catch (error) {
      if (error instanceof ApiError) {
        return sendJson(response, error.status, { code: error.code, message: error.message });
      }
      console.error(error);
      return sendJson(response, 500, { code: 'INTERNAL_ERROR', message: 'Unexpected server error.' });
    }
  };
}

export function createIntegrationServer(store = createStore()) {
  return http.createServer(createIntegrationHandler(store));
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const port = Number(process.env.PORT ?? 8787);
  const server = createIntegrationServer();
  server.listen(port, () => {
    console.log(`Integration Control Center V3 API listening on http://localhost:${port}`);
  });
}
