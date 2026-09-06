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
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new DomainError(400, 'INVALID_JSON', 'request body must be valid JSON'); }
}

function orderRoute(pathname, suffix = '') {
  const escaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = pathname.match(new RegExp(`^/api/orders/(\\d+)${escaped}$`));
  return match ? Number(match[1]) : null;
}

function refundRoute(pathname, suffix = '') {
  const escaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = pathname.match(new RegExp(`^/api/refunds/(\\d+)${escaped}$`));
  return match ? Number(match[1]) : null;
}

export function createCommerceServer(store = createStore()) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const { pathname, searchParams } = url;

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
        sendJson(res, 200, { ok: true, service: 'commerce-ops-console', mode: 'fictional-demo' });
        return;
      }
      if (req.method === 'GET' && pathname === '/api/metrics') {
        sendJson(res, 200, store.metrics());
        return;
      }
      if (req.method === 'GET' && pathname === '/api/orders') {
        sendJson(res, 200, { items: store.listOrders({
          query: searchParams.get('query') ?? '',
          opsStatus: searchParams.get('opsStatus') ?? '',
          paymentStatus: searchParams.get('paymentStatus') ?? '',
          fulfillmentStatus: searchParams.get('fulfillmentStatus') ?? ''
        }) });
        return;
      }
      if (req.method === 'GET' && pathname === '/api/refunds') {
        sendJson(res, 200, { items: store.listRefunds(searchParams.get('status') ?? '') });
        return;
      }
      if (req.method === 'GET' && pathname === '/api/audits') {
        const raw = searchParams.get('orderId');
        const orderId = raw === null || raw === '' ? null : Number(raw);
        if (orderId !== null && !Number.isInteger(orderId)) throw new DomainError(400, 'INVALID_ORDER_ID', 'orderId must be an integer');
        sendJson(res, 200, { items: store.listAudits(orderId) });
        return;
      }
      if (req.method === 'POST' && pathname === '/api/orders') {
        const body = await readJson(req);
        sendJson(res, 201, store.createOrder(body, body.actor));
        return;
      }

      const directOrderId = orderRoute(pathname);
      if (req.method === 'GET' && directOrderId !== null) {
        sendJson(res, 200, store.getOrder(directOrderId));
        return;
      }

      const actionMap = [
        ['/hold', 'hold'], ['/release', 'release'], ['/pick', 'startPicking'], ['/ship', 'ship'],
        ['/deliver', 'deliver'], ['/return', 'returnOrder'], ['/cancel', 'cancel'], ['/refunds', 'requestRefund']
      ];
      for (const [suffix, method] of actionMap) {
        const id = orderRoute(pathname, suffix);
        if (req.method === 'POST' && id !== null) {
          const body = await readJson(req);
          sendJson(res, 200, store[method](id, body));
          return;
        }
      }

      const refundDecisionId = refundRoute(pathname, '/decision');
      if (req.method === 'POST' && refundDecisionId !== null) {
        const body = await readJson(req);
        sendJson(res, 200, store.decideRefund(refundDecisionId, body));
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
  const port = Number(process.env.PORT ?? 8791);
  const server = createCommerceServer();
  server.listen(port, '127.0.0.1', () => {
    console.log(`Commerce Ops Console API listening on http://127.0.0.1:${port}`);
  });
}
