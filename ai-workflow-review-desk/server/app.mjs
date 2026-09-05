import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createStore, DomainError } from './store.mjs';

const JSON_LIMIT = 64 * 1024;

function sendJson(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET,POST,OPTIONS'
  });
  res.end(payload);
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > JSON_LIMIT) throw new DomainError(413, 'BODY_TOO_LARGE', 'request body too large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new DomainError(400, 'INVALID_JSON', 'request body must be valid JSON');
  }
}

function routeId(pathname, suffix) {
  const escaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = pathname.match(new RegExp(`^/api/tasks/(\\d+)${escaped}$`));
  return match ? Number(match[1]) : null;
}

export function createAiReviewServer(store = createStore()) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const { pathname } = url;

      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': 'content-type',
          'access-control-allow-methods': 'GET,POST,OPTIONS'
        });
        res.end();
        return;
      }

      if (req.method === 'GET' && pathname === '/api/health') {
        sendJson(res, 200, { ok: true, service: 'ai-workflow-review-desk', providerMode: 'credential-free-mock' });
        return;
      }
      if (req.method === 'GET' && pathname === '/api/prompts') {
        sendJson(res, 200, { items: store.listPrompts() });
        return;
      }
      if (req.method === 'GET' && pathname === '/api/tasks') {
        sendJson(res, 200, { items: store.listTasks() });
        return;
      }
      if (req.method === 'GET' && pathname === '/api/runs') {
        sendJson(res, 200, { items: store.listRuns() });
        return;
      }
      if (req.method === 'GET' && pathname === '/api/reviews') {
        sendJson(res, 200, { items: store.listReviews() });
        return;
      }
      if (req.method === 'POST' && pathname === '/api/tasks') {
        const body = await readJson(req);
        sendJson(res, 201, store.createTask(body));
        return;
      }

      const generateId = routeId(pathname, '/generate');
      if (req.method === 'POST' && generateId !== null) {
        const body = await readJson(req);
        sendJson(res, 200, store.generateTask(generateId, {
          promptVersion: body.promptVersion,
          providerOrder: body.providerOrder
        }));
        return;
      }

      const reviewId = routeId(pathname, '/review');
      if (req.method === 'POST' && reviewId !== null) {
        const body = await readJson(req);
        sendJson(res, 200, store.reviewTask(reviewId, body));
        return;
      }

      sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'route not found' } });
    } catch (error) {
      if (error instanceof DomainError) {
        sendJson(res, error.statusCode, { error: { code: error.code, message: error.message } });
        return;
      }
      console.error(error);
      sendJson(res, 500, { error: { code: 'INTERNAL_ERROR', message: 'unexpected server error' } });
    }
  });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const port = Number(process.env.PORT ?? 8790);
  const server = createAiReviewServer();
  server.listen(port, '127.0.0.1', () => {
    console.log(`AI Workflow Review Desk API listening on http://127.0.0.1:${port}`);
  });
}
