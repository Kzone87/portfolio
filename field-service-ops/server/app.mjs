import http from 'node:http';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createStore, DomainError } from './store.mjs';
import { createSqliteStore } from './sqlite-store.mjs';
import { createAuthStore, AuthError } from './auth-store.mjs';
import { createInquiryStore, InquiryError, INQUIRY_STATUS, INQUIRY_HANDOFF_STATE } from '../../nexa-tech-service/server/inquiry-store.mjs';

const LIMIT = 64 * 1024;
const SESSION_COOKIE = 'nexa_ops_session';
const LOCAL_PRINCIPAL = Object.freeze({ id: 'local-dispatcher', name: 'Local Dispatcher', role: 'STAFF', team: 'Local Operations' });
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
    return {
      token,
      id,
      name: String(item?.name || id).slice(0, 80),
      role: normalizeRole(item?.role),
      team: String(item?.team || '').trim().slice(0, 80)
    };
  });
}

function principalRegistry(principals = []) {
  return new Map(principals.map(principal => [tokenKey(principal.token), {
    id: principal.id,
    name: principal.name,
    role: normalizeRole(principal.role),
    team: principal.team || ''
  }]));
}

function bearer(req) {
  const header = String(req.headers.authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function cookies(req) {
  const result = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name) result[name] = decodeURIComponent(value);
  }
  return result;
}

function sessionCookie(token, maxAgeSeconds, secure = false) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function resolveIdentity(req, config) {
  const token = bearer(req);
  if (token) {
    const principal = config.registry.get(tokenKey(token));
    if (principal) return { principal, authType: 'bearer', csrfToken: '', sessionToken: '', expiresAt: null };
    throw new DomainError(401, 'INVALID_AUTH_TOKEN', 'authentication token is invalid');
  }

  const sessionToken = cookies(req)[SESSION_COOKIE] || '';
  if (sessionToken && config.authStore) {
    try {
      const session = config.authStore.resolveSession(sessionToken);
      return { ...session, authType: 'session', sessionToken };
    } catch (error) {
      if (error instanceof AuthError) throw new DomainError(error.statusCode, error.code, error.message);
      throw error;
    }
  }

  if (config.requireAuth) throw new DomainError(401, 'AUTH_REQUIRED', 'authentication is required');
  return { principal: config.localPrincipal, authType: 'local', csrfToken: '', sessionToken: '', expiresAt: null };
}

function requireCsrf(req, identity) {
  if (identity.authType !== 'session') return;
  const token = String(req.headers['x-csrf-token'] || '').trim();
  if (!token || token !== identity.csrfToken) throw new DomainError(403, 'CSRF_REQUIRED', '요청 보안정보가 만료되었습니다. 다시 로그인해 주세요.');
}

function requireAdmin(identity) {
  if (identity.principal.role !== 'ADMIN') throw new DomainError(403, 'ADMIN_REQUIRED', '운영 관리자 권한이 필요합니다.');
}

function requestIdempotencyKey(req) {
  const key = String(req.headers['idempotency-key'] || '').trim();
  if (!key) return '';
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key)) throw new DomainError(400, 'INVALID_IDEMPOTENCY_KEY', 'Idempotency-Key must be 8-128 safe characters');
  return key;
}

function originHeaders(req, config) {
  const origin = String(req.headers.origin || '').trim();
  if (!origin) return {};
  if (config.allowedOrigins.has('*')) return {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    vary: 'Origin'
  };
  if (!config.allowedOrigins.has(origin)) throw new DomainError(403, 'ORIGIN_NOT_ALLOWED', 'request origin is not allowed');
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    vary: 'Origin'
  };
}

function send(req, res, config, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  const cors = originHeaders(req, config);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
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

function inquiryRoute(path, suffix = '') {
  const escaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = path.match(new RegExp(`^/api/inquiries/([A-Z0-9-]+)${escaped}$`));
  return match ? match[1] : null;
}

function userRoute(path, suffix = '') {
  const escaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = path.match(new RegExp(`^/api/admin/users/([a-zA-Z0-9._-]+)${escaped}$`));
  return match ? match[1] : null;
}

function securedInput(input, principal) {
  const safe = { ...(input || {}) };
  delete safe.actor;
  delete safe.role;
  return { ...safe, actor: principal.id, role: principal.role };
}

function clientKey(req) {
  return createHash('sha256').update(`${String(req.socket.remoteAddress || '')}|${String(req.headers['user-agent'] || '')}`).digest('hex');
}

function consumeLoginRate(req, config) {
  const key = clientKey(req);
  const now = Date.now();
  const current = config.loginBuckets.get(key);
  if (!current || now >= current.resetAt) {
    config.loginBuckets.set(key, { count: 1, resetAt: now + config.loginWindowMs });
    return;
  }
  if (current.count >= config.loginMax) throw new DomainError(429, 'LOGIN_RATE_LIMITED', '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.');
  current.count += 1;
}

function mapInquiryError(error) {
  if (error instanceof InquiryError) return new DomainError(error.statusCode, error.code, error.message);
  return error;
}

function mapAuthError(error) {
  if (error instanceof AuthError) return new DomainError(error.statusCode, error.code, error.message);
  return error;
}

export function createFieldServiceServer(store = createStore(), options = {}) {
  const config = {
    requireAuth: Boolean(options.requireAuth),
    localPrincipal: options.localPrincipal || LOCAL_PRINCIPAL,
    registry: principalRegistry(options.principals || []),
    allowedOrigins: new Set(options.allowedOrigins || ['*']),
    authStore: options.authStore || null,
    inquiryStore: options.inquiryStore || null,
    secureCookies: Boolean(options.secureCookies),
    loginBuckets: new Map(),
    loginWindowMs: Number(options.loginWindowMs || 10 * 60 * 1000),
    loginMax: Number(options.loginMax || 5)
  };
  if (config.requireAuth && config.registry.size === 0 && !config.authStore) {
    throw new Error('authenticated mode requires a session auth store or at least one bearer principal');
  }

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const path = url.pathname;

      if (req.method === 'OPTIONS') {
        const cors = originHeaders(req, config);
        res.writeHead(204, {
          ...cors,
          'access-control-allow-headers': 'authorization, content-type, idempotency-key, x-csrf-token',
          'access-control-allow-methods': 'GET,POST,OPTIONS',
          'access-control-max-age': '600',
          'x-content-type-options': 'nosniff'
        });
        res.end();
        return;
      }

      if (req.method === 'GET' && path === '/api/health') {
        send(req, res, config, 200, {
          ok: true,
          service: 'nexa-service-operations',
          auth: config.authStore ? 'session' : (config.requireAuth ? 'bearer' : 'local'),
          inquiryDesk: Boolean(config.inquiryStore)
        });
        return;
      }

      if (req.method === 'POST' && path === '/api/auth/login') {
        if (!config.authStore) throw new DomainError(503, 'AUTH_NOT_CONFIGURED', '직원 로그인이 설정되지 않았습니다.');
        consumeLoginRate(req, config);
        const input = await body(req);
        let session;
        try { session = config.authStore.login(input.username, input.password); }
        catch (error) { throw mapAuthError(error); }
        const maxAge = Math.max(60, Math.floor((Date.parse(session.expiresAt) - Date.now()) / 1000));
        send(req, res, config, 200, {
          principal: session.principal,
          csrfToken: session.csrfToken,
          expiresAt: session.expiresAt
        }, { 'set-cookie': sessionCookie(session.token, maxAge, config.secureCookies) });
        return;
      }

      const identity = resolveIdentity(req, config);

      if (req.method === 'POST' && path === '/api/auth/logout') {
        requireCsrf(req, identity);
        if (identity.authType === 'session' && config.authStore) config.authStore.logout(identity.sessionToken, identity.principal.id);
        send(req, res, config, 200, { ok: true }, { 'set-cookie': sessionCookie('', 0, config.secureCookies) });
        return;
      }

      if (req.method === 'GET' && path === '/api/me') {
        send(req, res, config, 200, {
          id: identity.principal.id,
          username: identity.principal.username || '',
          name: identity.principal.name,
          role: identity.principal.role,
          team: identity.principal.team || '',
          csrfToken: identity.authType === 'session' ? identity.csrfToken : null,
          expiresAt: identity.expiresAt || null
        });
        return;
      }

      if (req.method === 'GET' && path === '/api/agents') { send(req, res, config, 200, { items: store.listAgents() }); return; }
      if (req.method === 'GET' && path === '/api/metrics') { send(req, res, config, 200, store.metrics()); return; }
      if (req.method === 'GET' && path === '/api/jobs') {
        send(req, res, config, 200, { items: store.listJobs({
          query: url.searchParams.get('query') ?? '',
          status: url.searchParams.get('status') ?? '',
          priority: url.searchParams.get('priority') ?? '',
          agentId: url.searchParams.get('agentId') ?? ''
        }) });
        return;
      }
      if (req.method === 'GET' && path === '/api/audits') {
        const raw = url.searchParams.get('jobId');
        const id = raw ? Number(raw) : null;
        if (id !== null && !Number.isInteger(id)) throw new DomainError(400, 'INVALID_JOB_ID', 'jobId must be an integer');
        send(req, res, config, 200, { items: store.listAudits(id) });
        return;
      }

      if (req.method === 'GET' && path === '/api/inquiries') {
        if (!config.inquiryStore) throw new DomainError(503, 'INQUIRY_DESK_NOT_CONFIGURED', '상담 접수함이 설정되지 않았습니다.');
        try { send(req, res, config, 200, { items: config.inquiryStore.list({ status: url.searchParams.get('status') || '' }) }); }
        catch (error) { throw mapInquiryError(error); }
        return;
      }

      const inquiryId = inquiryRoute(path);
      if (req.method === 'GET' && inquiryId) {
        if (!config.inquiryStore) throw new DomainError(503, 'INQUIRY_DESK_NOT_CONFIGURED', '상담 접수함이 설정되지 않았습니다.');
        try { send(req, res, config, 200, config.inquiryStore.get(inquiryId)); }
        catch (error) { throw mapInquiryError(error); }
        return;
      }

      const inquiryAuditId = inquiryRoute(path, '/audits');
      if (req.method === 'GET' && inquiryAuditId) {
        if (!config.inquiryStore) throw new DomainError(503, 'INQUIRY_DESK_NOT_CONFIGURED', '상담 접수함이 설정되지 않았습니다.');
        try { send(req, res, config, 200, { items: config.inquiryStore.audits(inquiryAuditId) }); }
        catch (error) { throw mapInquiryError(error); }
        return;
      }

      if (req.method === 'GET' && path === '/api/admin/users') {
        requireAdmin(identity);
        if (!config.authStore) throw new DomainError(503, 'AUTH_NOT_CONFIGURED', '직원 계정 관리가 설정되지 않았습니다.');
        send(req, res, config, 200, { items: config.authStore.listUsers() });
        return;
      }

      if (req.method === 'GET' && path === '/api/admin/auth-audits') {
        requireAdmin(identity);
        if (!config.authStore) throw new DomainError(503, 'AUTH_NOT_CONFIGURED', '직원 계정 관리가 설정되지 않았습니다.');
        send(req, res, config, 200, { items: config.authStore.authAudits() });
        return;
      }

      if (req.method !== 'GET') requireCsrf(req, identity);

      if (req.method === 'POST' && path === '/api/admin/users') {
        requireAdmin(identity);
        if (!config.authStore) throw new DomainError(503, 'AUTH_NOT_CONFIGURED', '직원 계정 관리가 설정되지 않았습니다.');
        try { send(req, res, config, 201, config.authStore.createUser(await body(req), identity.principal.id)); }
        catch (error) { throw mapAuthError(error); }
        return;
      }

      const updateUserId = userRoute(path);
      if (req.method === 'POST' && updateUserId) {
        requireAdmin(identity);
        if (!config.authStore) throw new DomainError(503, 'AUTH_NOT_CONFIGURED', '직원 계정 관리가 설정되지 않았습니다.');
        try { send(req, res, config, 200, config.authStore.updateUser(updateUserId, await body(req), identity.principal.id)); }
        catch (error) { throw mapAuthError(error); }
        return;
      }

      const passwordUserId = userRoute(path, '/password');
      if (req.method === 'POST' && passwordUserId) {
        requireAdmin(identity);
        if (!config.authStore) throw new DomainError(503, 'AUTH_NOT_CONFIGURED', '직원 계정 관리가 설정되지 않았습니다.');
        const input = await body(req);
        try { send(req, res, config, 200, config.authStore.resetPassword(passwordUserId, input.password, identity.principal.id)); }
        catch (error) { throw mapAuthError(error); }
        return;
      }

      const contactedId = inquiryRoute(path, '/contacted');
      if (req.method === 'POST' && contactedId) {
        if (!config.inquiryStore) throw new DomainError(503, 'INQUIRY_DESK_NOT_CONFIGURED', '상담 접수함이 설정되지 않았습니다.');
        const input = await body(req);
        try { send(req, res, config, 200, config.inquiryStore.transition(contactedId, input.expectedVersion, INQUIRY_STATUS.CONTACTED, identity.principal.id)); }
        catch (error) { throw mapInquiryError(error); }
        return;
      }

      const visitId = inquiryRoute(path, '/visit-request');
      if (req.method === 'POST' && visitId) {
        if (!config.inquiryStore) throw new DomainError(503, 'INQUIRY_DESK_NOT_CONFIGURED', '상담 접수함이 설정되지 않았습니다.');
        const input = await body(req);
        const priority = String(input.priority || 'NORMAL').toUpperCase();
        if (priority === 'URGENT' && identity.principal.role !== 'ADMIN') throw new DomainError(403, 'ADMIN_REQUIRED_FOR_URGENT', '긴급 방문 요청은 운영 관리자 확인이 필요합니다.');
        let prepared;
        try {
          prepared = config.inquiryStore.prepareVisitRequest(visitId, input.expectedVersion, input, identity.principal.id);
        } catch (error) {
          throw mapInquiryError(error);
        }
        const fieldJob = store.createJob({
          customerName: prepared.inquiry.company,
          address: prepared.handoff.address,
          summary: prepared.handoff.summary,
          priority: prepared.handoff.priority
        }, identity.principal.id, prepared.handoff.idempotencyKey);
        let completed;
        try { completed = config.inquiryStore.completeVisitRequest(visitId, fieldJob.id, identity.principal.id); }
        catch (error) { throw mapInquiryError(error); }
        send(req, res, config, completed.replay || fieldJob.idempotentReplay ? 200 : 201, { ...completed, fieldJob });
        return;
      }

      const closeInquiryId = inquiryRoute(path, '/close');
      if (req.method === 'POST' && closeInquiryId) {
        if (!config.inquiryStore) throw new DomainError(503, 'INQUIRY_DESK_NOT_CONFIGURED', '상담 접수함이 설정되지 않았습니다.');
        const input = await body(req);
        let inquiry;
        try { inquiry = config.inquiryStore.get(closeInquiryId); }
        catch (error) { throw mapInquiryError(error); }
        if (inquiry.handoff?.state === INQUIRY_HANDOFF_STATE.COMPLETED && inquiry.handoff.fieldJobId) {
          const fieldJob = store.getJob(inquiry.handoff.fieldJobId);
          if (!['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(fieldJob.status)) {
            throw new DomainError(409, 'FIELD_JOB_STILL_ACTIVE', '현장 작업이 진행 중입니다. 완료·취소·방문불가 처리 후 상담을 종료해 주세요.');
          }
        }
        try { send(req, res, config, 200, config.inquiryStore.transition(closeInquiryId, input.expectedVersion, INQUIRY_STATUS.CLOSED, identity.principal.id)); }
        catch (error) { throw mapInquiryError(error); }
        return;
      }

      if (req.method === 'POST' && path === '/api/jobs') {
        const input = securedInput(await body(req), identity.principal);
        const created = store.createJob(input, identity.principal.id, requestIdempotencyKey(req));
        send(req, res, config, created.idempotentReplay ? 200 : 201, created);
        return;
      }

      const direct = route(path);
      if (req.method === 'GET' && direct !== null) { send(req, res, config, 200, store.getJob(direct)); return; }

      const actions = [['/schedule', 'schedule'], ['/reschedule', 'reschedule'], ['/reassign', 'reassign'], ['/dispatch', 'dispatch'], ['/on-site', 'onSite'], ['/complete', 'complete'], ['/cancel', 'cancel'], ['/no-show', 'noShow']];
      for (const [suffix, method] of actions) {
        const id = route(path, suffix);
        if (req.method === 'POST' && id !== null) {
          const input = securedInput(await body(req), identity.principal);
          send(req, res, config, 200, store[method](id, input));
          return;
        }
      }

      send(req, res, config, 404, { error: { code: 'NOT_FOUND', message: 'route not found' } });
    } catch (error) {
      const domain = error instanceof DomainError ? error : mapInquiryError(mapAuthError(error));
      if (domain instanceof DomainError) {
        try {
          const extra = domain.code === 'AUTH_REQUIRED' || domain.code === 'SESSION_EXPIRED' || domain.code === 'SESSION_INVALID'
            ? { 'set-cookie': sessionCookie('', 0, config.secureCookies) }
            : {};
          send(req, res, config, domain.statusCode, { error: { code: domain.code, message: domain.message } }, extra);
        } catch {
          res.writeHead(domain.statusCode, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
          res.end(JSON.stringify({ error: { code: domain.code, message: domain.message } }));
        }
        return;
      }
      console.error(error);
      try { send(req, res, config, 500, { error: { code: 'INTERNAL_ERROR', message: 'unexpected server error' } }); }
      catch {
        res.writeHead(500, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        res.end(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'unexpected server error' } }));
      }
    }
  });
}

function parseAgents(raw = '') {
  if (!String(raw).trim()) return [];
  let value;
  try { value = JSON.parse(raw); } catch { throw new Error('NEXA_OPS_AGENTS_JSON must be valid JSON'); }
  if (!Array.isArray(value)) throw new Error('NEXA_OPS_AGENTS_JSON must be an array');
  const seen = new Set();
  return value.map((agent, index) => {
    const id = Number(agent?.id ?? index + 1);
    const name = String(agent?.name || '').trim();
    const region = String(agent?.region || '').trim();
    if (!Number.isInteger(id) || id < 1 || seen.has(id)) throw new Error(`agent ${index} id must be a unique positive integer`);
    if (name.length < 2 || name.length > 80) throw new Error(`agent ${index} name is invalid`);
    if (region.length < 1 || region.length > 80) throw new Error(`agent ${index} region is invalid`);
    seen.add(id);
    return { id, name, region, active: agent?.active !== false };
  });
}

function parseBootstrapAdmin(raw = '') {
  if (!String(raw).trim()) return null;
  let value;
  try { value = JSON.parse(raw); } catch { throw new Error('NEXA_OPS_BOOTSTRAP_ADMIN_JSON must be valid JSON'); }
  return {
    id: String(value?.id || '').trim(),
    username: String(value?.username || '').trim(),
    name: String(value?.name || '').trim(),
    team: String(value?.team || '').trim(),
    password: String(value?.password || ''),
    role: 'ADMIN'
  };
}

export function runtimeOptions(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const principals = parsePrincipals(env.NEXA_OPS_PRINCIPALS_JSON || '');
  const requireAuth = production || env.NEXA_OPS_REQUIRE_AUTH === '1';
  const allowedOrigins = String(env.NEXA_OPS_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  if (production && allowedOrigins.length === 0) throw new Error('NEXA_OPS_ALLOWED_ORIGINS is required in production');
  if (production && allowedOrigins.includes('*')) throw new Error('NEXA_OPS_ALLOWED_ORIGINS must not contain * in production');
  return {
    requireAuth,
    principals,
    allowedOrigins: production ? allowedOrigins : (allowedOrigins.length ? allowedOrigins : ['*']),
    secureCookies: production
  };
}

export function createRuntimeStore(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const configuredPath = String(env.NEXA_OPS_DB_PATH || '').trim();
  if (production && (!configuredPath || configuredPath === ':memory:')) throw new Error('NEXA_OPS_DB_PATH must point to persistent storage in production');
  const agents = parseAgents(env.NEXA_OPS_AGENTS_JSON || '');
  if (production && agents.length === 0) throw new Error('NEXA_OPS_AGENTS_JSON is required in production');
  const path = configuredPath || 'field-service-ops/server/data/nexa-ops.sqlite';
  return createSqliteStore(path, {
    seedDemo: !production && env.NEXA_OPS_SEED_DEMO !== '0',
    ...(agents.length ? { agents } : {})
  });
}

export function createRuntimeAuthStore(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const opsPath = String(env.NEXA_OPS_DB_PATH || '').trim() || 'field-service-ops/server/data/nexa-ops.sqlite';
  const path = String(env.NEXA_OPS_AUTH_DB_PATH || '').trim() || opsPath;
  if (production && path === ':memory:') throw new Error('NEXA_OPS_AUTH_DB_PATH must point to persistent storage in production');
  const bootstrapAdmin = parseBootstrapAdmin(env.NEXA_OPS_BOOTSTRAP_ADMIN_JSON || '') || (!production ? {
    id: 'local-admin',
    username: 'admin',
    name: 'Local Admin',
    team: 'Local Operations',
    password: 'nexa-local-admin'
  } : null);
  const store = createAuthStore(path, {
    bootstrapAdmin,
    sessionMaxMs: Number(env.NEXA_OPS_SESSION_MAX_MS || 8 * 60 * 60 * 1000),
    sessionIdleMs: Number(env.NEXA_OPS_SESSION_IDLE_MS || 30 * 60 * 1000)
  });
  if (production && store.countUsers() === 0) {
    store.close();
    throw new Error('NEXA_OPS_BOOTSTRAP_ADMIN_JSON is required on first production startup');
  }
  return store;
}

export function createRuntimeInquiryStore(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const configuredPath = String(env.NEXA_INQUIRY_DB_PATH || '').trim();
  if (production && (!configuredPath || configuredPath === ':memory:')) throw new Error('NEXA_INQUIRY_DB_PATH must point to the persistent inquiry database in production');
  return createInquiryStore(configuredPath || 'nexa-tech-service/server/data/inquiries.sqlite');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const port = Number(process.env.PORT ?? 8792);
  const store = createRuntimeStore();
  const authStore = createRuntimeAuthStore();
  const inquiryStore = createRuntimeInquiryStore();
  const server = createFieldServiceServer(store, { ...runtimeOptions(), authStore, inquiryStore });
  const close = () => server.close(() => {
    inquiryStore.close?.();
    authStore.close?.();
    store.close?.();
    process.exit(0);
  });
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
  server.listen(port, '127.0.0.1', () => console.log(`NEXA Service Operations API listening on http://127.0.0.1:${port}`));
}
