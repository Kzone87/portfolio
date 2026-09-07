import http from 'node:http';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createStore, DomainError } from './store.mjs';
import { createSqliteStore } from './sqlite-store.mjs';

const LIMIT = 64 * 1024;
const LOCAL_PRINCIPAL = Object.freeze({ id: 'local-dispatcher', name: 'Local Dispatcher', role: 'STAFF' });

const tokenKey = token => createHash('sha256').update(String(token)).digest('hex');
const normalizeRole = role => String(role || '').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'STAFF';

export function parsePrincipals(raw = '') {
  if (!String(raw).trim()) return [];
  let value;
  try { value = JSON.parse(raw); } catch { throw new Error('NEXA_OPS_PRINCIPALS_JSON must be valid JSON'); }
  if (!Array.isArray(value)) throw new Error('NEXA_OPS_PRINCIPALS_JSON must be an array');
  return value.map((item, index) => {
    const token = String(item?.token || '').trim();
    const id = String(item?.id || '').trim();
    if (token.length < 16) throw new Error(`principal ${index} token must be at least 16 characters`);
    if (!/^[a-zA-Z0-9._-]{2,80}$/.test(id)) throw new Error(`principal ${index} id is invalid`);
    return { token, id, name: String(item?.name || id).slice(0, 80), role: normalizeRole(item?.role) };
  });
}

function principalRegistry(principals = []) {
  return new Map(principals.map(principal => [tokenKey(principal.token), { id: principal.id, name: principal.name, role: normalizeRole(principal.role) }]));
}

function bearer(req) {
  const header = String(req.headers.authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function resolvePrincipal(req, config) {
  const token = bearer(req);
  if (token) {
    const principal = config.registry.get(tokenKey(token));
    if (principal) return principal;
    throw new DomainError(401, 'INVALID_AUTH_TOKEN', 'authentication token is invalid');
  }
  if (config.requireAuth) throw new DomainError(401, 'AUTH_REQUIRED', 'authentication is required');
  return config.localPrincipal;
}

function originHeaders(req, config) {
  const origin = String(req.headers.origin || '').trim();
  if (!origin) return {};
  if (config.allowedOrigins.has('*')) return { 'access-control-allow-origin': '*', vary: 'Origin' };
  if (!config.allowedOrigins.has(origin)) throw new DomainError(403, 'ORIGIN_NOT_ALLOWED', 'request origin is not allowed');
  return { 'access-control-allow-origin': origin, vary: 'Origin' };
}

function send(req, res, config, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  const cors = originHeaders(req, config);
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

async function body(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > LIMIT) throw new DomainError(413, 'BODY_TOO_LARGE', 'request body too large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new DomainError(400, 'INVALID_JSON', 'request body must be valid JSON'); }
}

function route(path, suffix = '') {
  const escaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = path.match(new RegExp(`^/api/jobs/(\\d+)${escaped}$`));
  return match ? Number(match[1]) : null;
}

function securedInput(input, principal) {
  const safe = { ...(input || {}) };
  delete safe.actor;
  delete safe.role;
  return { ...safe, actor: principal.id, role: principal.role };
}

export function createFieldServiceServer(store = createStore(), options = {}) {
  const config = {
    requireAuth: Boolean(options.requireAuth),
    localPrincipal: options.localPrincipal || LOCAL_PRINCIPAL,
    registry: principalRegistry(options.principals || []),
    allowedOrigins: new Set(options.allowedOrigins || ['*'])
  };
  if (config.requireAuth && config.registry.size === 0) throw new Error('authenticated mode requires at least one principal');

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const path = url.pathname;

      if (req.method === 'OPTIONS') {
        const cors = originHeaders(req, config);
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
        send(req, res, config, 200, { ok: true, service: 'field-service-ops', auth: config.requireAuth ? 'required' : 'local' });
        return;
      }

      const principal = resolvePrincipal(req, config);

      if (req.method === 'GET' && path === '/api/agents') { send(req, res, config, 200, { items: store.listAgents() }); return; }
      if (req.method === 'GET' && path === '/api/metrics') { send(req, res, config, 200, store.metrics()); return; }
      if (req.method === 'GET' && path === '/api/jobs') {
        send(req, res, config, 200, { items: store.listJobs({ query: url.searchParams.get('query') ?? '', status: url.searchParams.get('status') ?? '', priority: url.searchParams.get('priority') ?? '', agentId: url.searchParams.get('agentId') ?? '' }) });
        return;
      }
      if (req.method === 'GET' && path === '/api/audits') {
        const raw = url.searchParams.get('jobId');
        const id = raw ? Number(raw) : null;
        if (id !== null && !Number.isInteger(id)) throw new DomainError(400, 'INVALID_JOB_ID', 'jobId must be an integer');
        send(req, res, config, 200, { items: store.listAudits(id) });
        return;
      }
      if (req.method === 'POST' && path === '/api/jobs') {
        const input = securedInput(await body(req), principal);
        send(req, res, config, 201, store.createJob(input, principal.id));
        return;
      }

      const direct = route(path);
      if (req.method === 'GET' && direct !== null) { send(req, res, config, 200, store.getJob(direct)); return; }

      const actions = [['/schedule', 'schedule'], ['/reschedule', 'reschedule'], ['/reassign', 'reassign'], ['/dispatch', 'dispatch'], ['/on-site', 'onSite'], ['/complete', 'complete'], ['/cancel', 'cancel'], ['/no-show', 'noShow']];
      for (const [suffix, method] of actions) {
        const id = route(path, suffix);
        if (req.method === 'POST' && id !== null) {
          const input = securedInput(await body(req), principal);
          send(req, res, config, 200, store[method](id, input));
          return;
        }
      }

      send(req, res, config, 404, { error: { code: 'NOT_FOUND', message: 'route not found' } });
    } catch (error) {
      if (error instanceof DomainError) {
        try { send(req, res, config, error.statusCode, { error: { code: error.code, message: error.message } }); }
        catch { res.writeHead(error.statusCode, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify({ error: { code: error.code, message: error.message } })); }
        return;
      }
      console.error(error);
      try { send(req, res, config, 500, { error: { code: 'INTERNAL_ERROR', message: 'unexpected server error' } }); }
      catch { res.writeHead(500, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'unexpected server error' } })); }
    }
  });
}

function parseAgents(raw = '') {
  if (!String(raw).trim()) return [];
  let value;
  try { value = JSON.parse(raw); } catch { throw new Error('NEXA_OPS_AGENTS_JSON must be valid JSON'); }
  if (!Array.isArray(value)) throw new Error('NEXA_OPS_AGENTS_JSON must be an array');
  return value.map((agent, index) => ({
    id: Number(agent?.id ?? index + 1),
    name: String(agent?.name || '').trim(),
    region: String(agent?.region || '').trim(),
    active: agent?.active !== false
  }));
}

export function runtimeOptions(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const principals = parsePrincipals(env.NEXA_OPS_PRINCIPALS_JSON || '');
  const requireAuth = production || env.NEXA_OPS_REQUIRE_AUTH === '1';
  if (requireAuth && principals.length === 0) throw new Error('NEXA_OPS_PRINCIPALS_JSON is required when authentication is enabled');
  const allowedOrigins = String(env.NEXA_OPS_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  return {
    requireAuth,
    principals,
    allowedOrigins: production ? allowedOrigins : (allowedOrigins.length ? allowedOrigins : ['*'])
  };
}

export function createRuntimeStore(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const path = env.NEXA_OPS_DB_PATH || 'field-service-ops/server/data/nexa-ops.sqlite';
  return createSqliteStore(path, {
    seedDemo: !production && env.NEXA_OPS_SEED_DEMO !== '0',
    agents: parseAgents(env.NEXA_OPS_AGENTS_JSON || '')
  });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const port = Number(process.env.PORT ?? 8792);
  const store = createRuntimeStore();
  const server = createFieldServiceServer(store, runtimeOptions());
  const close = () => server.close(() => { store.close?.(); process.exit(0); });
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
  server.listen(port, '127.0.0.1', () => console.log(`NEXA Service Operations API listening on http://127.0.0.1:${port}`));
}
