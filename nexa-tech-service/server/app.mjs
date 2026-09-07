import http from 'node:http';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createInquiryStore, InquiryError, INQUIRY_STATUS } from './inquiry-store.mjs';

const BODY_LIMIT = 32 * 1024;
const DEFAULT_RATE_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_RATE_MAX = 5;
const tokenKey = token => createHash('sha256').update(String(token)).digest('hex');

function send(req, res, config, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  const origin = String(req.headers.origin || '').trim();
  let cors = {};
  if (origin) {
    if (config.allowedOrigins.has('*')) cors = { 'access-control-allow-origin': '*', vary: 'Origin' };
    else if (config.allowedOrigins.has(origin)) cors = { 'access-control-allow-origin': origin, vary: 'Origin' };
    else throw new InquiryError(403, 'ORIGIN_NOT_ALLOWED', '요청할 수 없는 출처입니다.');
  }
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...cors,
    ...extraHeaders
  });
  res.end(payload);
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > BODY_LIMIT) throw new InquiryError(413, 'BODY_TOO_LARGE', '상담 내용이 너무 큽니다.');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new InquiryError(400, 'INVALID_JSON', '요청 형식을 확인해 주세요.'); }
}

function parseAdmins(raw = '') {
  if (!String(raw).trim()) return [];
  let value;
  try { value = JSON.parse(raw); } catch { throw new Error('NEXA_INQUIRY_ADMINS_JSON must be valid JSON'); }
  if (!Array.isArray(value)) throw new Error('NEXA_INQUIRY_ADMINS_JSON must be an array');
  return value.map((item, index) => {
    const token = String(item?.token || '').trim();
    const id = String(item?.id || '').trim();
    if (token.length < 16) throw new Error(`admin ${index} token must be at least 16 characters`);
    if (!/^[a-zA-Z0-9._-]{2,80}$/.test(id)) throw new Error(`admin ${index} id is invalid`);
    return { token, id };
  });
}

function adminRegistry(admins) {
  return new Map(admins.map(admin => [tokenKey(admin.token), { id: admin.id, role: 'ADMIN' }]));
}

function requireAdmin(req, config) {
  const authorization = String(req.headers.authorization || '');
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new InquiryError(401, 'AUTH_REQUIRED', '관리자 인증이 필요합니다.');
  const admin = config.admins.get(tokenKey(match[1].trim()));
  if (!admin) throw new InquiryError(401, 'INVALID_AUTH_TOKEN', '관리자 인증 정보가 올바르지 않습니다.');
  return admin;
}

function clientKey(req, config) {
  let address = String(req.socket.remoteAddress || 'unknown');
  if (config.trustProxy) {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (forwarded) address = forwarded;
  }
  return createHash('sha256').update(`${address}|${String(req.headers['user-agent'] || '')}`).digest('hex');
}

function consumeRateLimit(req, config) {
  const key = clientKey(req, config);
  const now = Date.now();
  const current = config.rateBuckets.get(key);
  if (!current || now >= current.resetAt) {
    const next = { count: 1, resetAt: now + config.rateWindowMs };
    config.rateBuckets.set(key, next);
    return Math.ceil(config.rateWindowMs / 1000);
  }
  if (current.count >= config.rateMax) {
    const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    throw new InquiryError(429, 'RATE_LIMITED', `잠시 후 다시 시도해 주세요. (${retryAfter}초)`);
  }
  current.count += 1;
  return Math.max(1, Math.ceil((current.resetAt - now) / 1000));
}

function adminInquiryRoute(path, suffix = '') {
  const escaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = path.match(new RegExp(`^/api/admin/inquiries/([A-Z0-9-]+)${escaped}$`));
  return match ? match[1] : null;
}

export function createInquiryServer(store = createInquiryStore(), options = {}) {
  const config = {
    allowedOrigins: new Set(options.allowedOrigins || ['*']),
    admins: adminRegistry(options.admins || []),
    requireAdminConfig: Boolean(options.requireAdminConfig),
    rateWindowMs: Number(options.rateWindowMs || DEFAULT_RATE_WINDOW_MS),
    rateMax: Number(options.rateMax || DEFAULT_RATE_MAX),
    rateBuckets: new Map(),
    trustProxy: Boolean(options.trustProxy)
  };
  if (config.requireAdminConfig && config.admins.size === 0) throw new Error('production inquiry API requires at least one admin principal');

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const path = url.pathname;

      if (req.method === 'OPTIONS') {
        const origin = String(req.headers.origin || '').trim();
        if (origin && !config.allowedOrigins.has('*') && !config.allowedOrigins.has(origin)) throw new InquiryError(403, 'ORIGIN_NOT_ALLOWED', '요청할 수 없는 출처입니다.');
        const cors = origin ? { 'access-control-allow-origin': config.allowedOrigins.has('*') ? '*' : origin, vary: 'Origin' } : {};
        res.writeHead(204, {
          ...cors,
          'access-control-allow-headers': 'authorization, content-type',
          'access-control-allow-methods': 'GET,POST,OPTIONS',
          'access-control-max-age': '600',
          'x-content-type-options': 'nosniff'
        });
        res.end();
        return;
      }

      if (req.method === 'GET' && path === '/api/health') {
        send(req, res, config, 200, { ok: true, service: 'nexa-inquiry-api' });
        return;
      }

      if (req.method === 'POST' && path === '/api/inquiries') {
        consumeRateLimit(req, config);
        const created = store.create(await readBody(req));
        send(req, res, config, 201, created);
        return;
      }

      if (path.startsWith('/api/admin/')) {
        const admin = requireAdmin(req, config);
        if (req.method === 'GET' && path === '/api/admin/inquiries') {
          send(req, res, config, 200, { items: store.list({ status: url.searchParams.get('status') || '' }) });
          return;
        }
        const direct = adminInquiryRoute(path);
        if (req.method === 'GET' && direct) { send(req, res, config, 200, store.get(direct)); return; }
        const auditId = adminInquiryRoute(path, '/audits');
        if (req.method === 'GET' && auditId) { send(req, res, config, 200, { items: store.audits(auditId) }); return; }
        const contactedId = adminInquiryRoute(path, '/contacted');
        if (req.method === 'POST' && contactedId) {
          const body = await readBody(req);
          send(req, res, config, 200, store.transition(contactedId, body.expectedVersion, INQUIRY_STATUS.CONTACTED, admin.id));
          return;
        }
        const closeId = adminInquiryRoute(path, '/close');
        if (req.method === 'POST' && closeId) {
          const body = await readBody(req);
          send(req, res, config, 200, store.transition(closeId, body.expectedVersion, INQUIRY_STATUS.CLOSED, admin.id));
          return;
        }
      }

      send(req, res, config, 404, { error: { code: 'NOT_FOUND', message: '요청 경로를 찾을 수 없습니다.' } });
    } catch (error) {
      if (error instanceof InquiryError) {
        try {
          send(req, res, config, error.statusCode, { error: { code: error.code, message: error.message } }, error.code === 'RATE_LIMITED' ? { 'retry-after': '60' } : {});
        } catch {
          res.writeHead(error.statusCode, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
          res.end(JSON.stringify({ error: { code: error.code, message: error.message } }));
        }
        return;
      }
      console.error(error);
      try { send(req, res, config, 500, { error: { code: 'INTERNAL_ERROR', message: '상담 요청을 처리하지 못했습니다.' } }); }
      catch {
        res.writeHead(500, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        res.end(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: '상담 요청을 처리하지 못했습니다.' } }));
      }
    }
  });
}

export function runtimeInquiryOptions(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const allowedOrigins = String(env.NEXA_INQUIRY_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  if (production && allowedOrigins.length === 0) throw new Error('NEXA_INQUIRY_ALLOWED_ORIGINS is required in production');
  const admins = parseAdmins(env.NEXA_INQUIRY_ADMINS_JSON || '');
  if (production && admins.length === 0) throw new Error('NEXA_INQUIRY_ADMINS_JSON is required in production');
  return {
    allowedOrigins: production ? allowedOrigins : (allowedOrigins.length ? allowedOrigins : ['*']),
    admins,
    requireAdminConfig: production,
    trustProxy: env.NEXA_INQUIRY_TRUST_PROXY === '1',
    rateWindowMs: Number(env.NEXA_INQUIRY_RATE_WINDOW_MS || DEFAULT_RATE_WINDOW_MS),
    rateMax: Number(env.NEXA_INQUIRY_RATE_MAX || DEFAULT_RATE_MAX)
  };
}

export function createRuntimeInquiryStore(env = process.env) {
  return createInquiryStore(env.NEXA_INQUIRY_DB_PATH || 'nexa-tech-service/server/data/inquiries.sqlite');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const port = Number(process.env.PORT || 8796);
  const store = createRuntimeInquiryStore();
  const server = createInquiryServer(store, runtimeInquiryOptions());
  const close = () => server.close(() => { store.close(); process.exit(0); });
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
  server.listen(port, '127.0.0.1', () => console.log(`NEXA Inquiry API listening on http://127.0.0.1:${port}`));
}
