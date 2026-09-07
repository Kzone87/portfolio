import http from 'node:http';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createInquiryStore, InquiryError, INQUIRY_STATUS, INQUIRY_HANDOFF_STATE } from './inquiry-store.mjs';

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

function lookupIdentity(store, input) {
  const id = String(input?.id || '').trim().toUpperCase();
  const last4 = String(input?.phoneLast4 || '').replace(/\D/g, '').slice(-4);
  if (!/^NX-[A-Z0-9-]{6,24}$/.test(id) || last4.length !== 4) throw new InquiryError(400, 'INVALID_LOOKUP', '접수번호와 연락처 뒤 4자리를 확인해 주세요.');
  let inquiry;
  try { inquiry = store.get(id); }
  catch (error) {
    if (error instanceof InquiryError && error.statusCode === 404) throw new InquiryError(404, 'CUSTOMER_REQUEST_NOT_FOUND', '접수정보를 확인할 수 없습니다.');
    throw error;
  }
  const digits = String(inquiry.phone || '').replace(/\D/g, '');
  if (digits.slice(-4) !== last4) throw new InquiryError(404, 'CUSTOMER_REQUEST_NOT_FOUND', '접수정보를 확인할 수 없습니다.');
  return inquiry;
}

function inquiryUpdates(store, inquiry) {
  const updates = store.audits(inquiry.id).map(item => {
    if (item.action === 'VISIT_REQUEST_CREATED') return { at: item.createdAt, title: '현장 방문 요청 전달', copy: '현장 운영팀에 방문 요청이 전달되었습니다.' };
    if (item.action === 'VISIT_REQUEST_PREPARED') return { at: item.createdAt, title: '방문 준비 확인', copy: '방문 장소와 요청 내용을 확인했습니다.' };
    if (item.toStatus === INQUIRY_STATUS.CLOSED) return { at: item.createdAt, title: '상담 처리 완료', copy: '상담 요청의 처리가 완료되었습니다.' };
    if (item.toStatus === INQUIRY_STATUS.CONTACTED) return { at: item.createdAt, title: '상담 내용 확인', copy: '담당자가 상담 내용을 확인했습니다.' };
    return { at: item.createdAt, title: '요청 상태 변경', copy: '서비스 요청 상태가 변경되었습니다.' };
  });
  updates.push({ at: inquiry.createdAt, title: '상담 접수', copy: '유지보수 상담 요청이 접수되었습니다.' });
  return updates.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

function publicInquiry(store, inquiry) {
  return {
    id: inquiry.id,
    company: inquiry.company,
    status: inquiry.status,
    service: inquiry.service,
    createdAt: inquiry.createdAt,
    updatedAt: inquiry.updatedAt,
    handoff: inquiry.handoff ? {
      state: inquiry.handoff.state,
      fieldJobId: inquiry.handoff.fieldJobId,
      address: inquiry.handoff.address,
      summary: inquiry.handoff.summary,
      priority: inquiry.handoff.priority
    } : null,
    updates: inquiryUpdates(store, inquiry)
  };
}

export function createFieldOpsClient({ baseUrl, token, fetchImpl = fetch }) {
  const root = String(baseUrl || '').trim().replace(/\/+$/, '');
  const credential = String(token || '').trim();
  if (!root) throw new Error('field operations base URL is required');
  if (credential.length < 16) throw new Error('field operations service token must be at least 16 characters');
  const headers = () => ({ authorization: `Bearer ${credential}` });
  return {
    async createVisitRequest({ inquiry, handoff }) {
      let response;
      try {
        response = await fetchImpl(`${root}/api/jobs`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...headers(),
            'idempotency-key': handoff.idempotencyKey
          },
          body: JSON.stringify({
            customerName: inquiry.company,
            address: handoff.address,
            summary: handoff.summary,
            priority: handoff.priority
          })
        });
      } catch {
        throw new InquiryError(502, 'FIELD_OPS_UNAVAILABLE', '현장 운영시스템에 방문 요청을 전달하지 못했습니다. 다시 시도해 주세요.');
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new InquiryError(502, 'FIELD_OPS_REJECTED', payload?.error?.message || '현장 운영시스템이 방문 요청을 처리하지 못했습니다.');
      if (!Number.isInteger(Number(payload?.id)) || Number(payload.id) < 1) throw new InquiryError(502, 'INVALID_FIELD_JOB', '현장 운영시스템이 올바른 작업번호를 반환하지 않았습니다.');
      return payload;
    },
    async getVisitRequest(jobId) {
      let jobResponse;
      let auditResponse;
      try {
        [jobResponse, auditResponse] = await Promise.all([
          fetchImpl(`${root}/api/jobs/${Number(jobId)}`, { headers: headers() }),
          fetchImpl(`${root}/api/audits?jobId=${Number(jobId)}`, { headers: headers() })
        ]);
      } catch {
        throw new InquiryError(502, 'FIELD_OPS_UNAVAILABLE', '현장 방문 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }
      const job = await jobResponse.json().catch(() => ({}));
      const auditPayload = await auditResponse.json().catch(() => ({ items: [] }));
      if (!jobResponse.ok) throw new InquiryError(502, 'FIELD_OPS_REJECTED', job?.error?.message || '현장 방문 상태를 확인하지 못했습니다.');
      return {
        id: Number(job.id),
        status: job.status,
        priority: job.priority,
        startAt: job.startAt || null,
        endAt: job.endAt || null,
        address: job.address || '',
        summary: job.summary || '',
        agentAssigned: Number.isInteger(Number(job.agentId)) && Number(job.agentId) > 0,
        updates: (auditPayload.items || []).slice(0, 10)
      };
    }
  };
}

function fieldUpdates(visit) {
  const labels = {
    CREATE: ['방문 요청 접수', '현장 운영팀에 방문 요청이 등록되었습니다.'],
    SCHEDULE: ['방문 일정 확정', '담당 기사와 방문 일정이 확정되었습니다.'],
    SCHEDULE_OVERRIDE: ['긴급 방문 일정 확정', '운영 관리자 확인 후 긴급 방문 일정이 확정되었습니다.'],
    RESCHEDULE: ['방문 일정 변경', '방문 일정이 변경되었습니다.'],
    REASSIGN: ['담당 기사 변경', '방문 담당 기사가 변경되었습니다.'],
    DISPATCH: ['기사 출동', '담당 기사가 방문 장소로 출동했습니다.'],
    ON_SITE: ['현장 도착', '담당 기사가 현장에 도착했습니다.'],
    COMPLETE: ['현장 작업 완료', '현장 작업이 완료되었습니다.'],
    CANCEL: ['방문 취소', '방문 요청이 취소되었습니다.'],
    NO_SHOW: ['방문 일정 재확인', '현장 방문이 완료되지 않아 일정 확인이 필요합니다.']
  };
  return (visit?.updates || []).map(item => {
    const [title, copy] = labels[item.action] || ['현장 진행상태 변경', '현장 서비스 진행상태가 변경되었습니다.'];
    return { at: item.createdAt, title, copy };
  });
}

export function createInquiryServer(store = createInquiryStore(), options = {}) {
  const config = {
    allowedOrigins: new Set(options.allowedOrigins || ['*']),
    admins: adminRegistry(options.admins || []),
    requireAdminConfig: Boolean(options.requireAdminConfig),
    rateWindowMs: Number(options.rateWindowMs || DEFAULT_RATE_WINDOW_MS),
    rateMax: Number(options.rateMax || DEFAULT_RATE_MAX),
    rateBuckets: new Map(),
    trustProxy: Boolean(options.trustProxy),
    fieldOpsClient: options.fieldOpsClient || null
  };
  if (config.requireAdminConfig && config.admins.size === 0) throw new Error('production inquiry API requires at least one admin principal');
  if (!Number.isFinite(config.rateWindowMs) || config.rateWindowMs < 1000) throw new Error('rateWindowMs must be at least 1000 milliseconds');
  if (!Number.isInteger(config.rateMax) || config.rateMax < 1) throw new Error('rateMax must be a positive integer');

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
        send(req, res, config, 200, { ok: true, service: 'nexa-inquiry-api', fieldOpsHandoff: Boolean(config.fieldOpsClient), customerLookup: true });
        return;
      }

      if (req.method === 'POST' && path === '/api/inquiries') {
        consumeRateLimit(req, config);
        const created = store.create(await readBody(req));
        send(req, res, config, 201, created);
        return;
      }

      if (req.method === 'POST' && path === '/api/customer/requests/lookup') {
        consumeRateLimit(req, config);
        const inquiry = lookupIdentity(store, await readBody(req));
        const view = publicInquiry(store, inquiry);
        let visit = null;
        if (view.handoff?.fieldJobId && config.fieldOpsClient) visit = await config.fieldOpsClient.getVisitRequest(view.handoff.fieldJobId);
        const updates = [...fieldUpdates(visit), ...view.updates].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 10);
        send(req, res, config, 200, { ...view, visit: visit ? { id: visit.id, status: visit.status, priority: visit.priority, startAt: visit.startAt, endAt: visit.endAt, address: visit.address, summary: visit.summary, agentAssigned: visit.agentAssigned } : null, updates });
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
        const visitId = adminInquiryRoute(path, '/visit-request');
        if (req.method === 'POST' && visitId) {
          if (!config.fieldOpsClient) throw new InquiryError(503, 'FIELD_OPS_NOT_CONFIGURED', '현장 운영시스템 연결이 설정되지 않았습니다.');
          const input = await readBody(req);
          const prepared = store.prepareVisitRequest(visitId, input.expectedVersion, input, admin.id);
          if (prepared.handoff.state === INQUIRY_HANDOFF_STATE.COMPLETED) {
            send(req, res, config, 200, prepared);
            return;
          }
          const fieldJob = await config.fieldOpsClient.createVisitRequest(prepared);
          const completed = store.completeVisitRequest(visitId, fieldJob.id, admin.id);
          send(req, res, config, completed.replay || fieldJob.idempotentReplay ? 200 : 201, { ...completed, fieldJob });
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
  if (production && allowedOrigins.includes('*')) throw new Error('NEXA_INQUIRY_ALLOWED_ORIGINS must not contain * in production');
  const admins = parseAdmins(env.NEXA_INQUIRY_ADMINS_JSON || '');
  if (production && admins.length === 0) throw new Error('NEXA_INQUIRY_ADMINS_JSON is required in production');
  const rateWindowMs = Number(env.NEXA_INQUIRY_RATE_WINDOW_MS || DEFAULT_RATE_WINDOW_MS);
  const rateMax = Number(env.NEXA_INQUIRY_RATE_MAX || DEFAULT_RATE_MAX);
  if (!Number.isFinite(rateWindowMs) || rateWindowMs < 1000) throw new Error('NEXA_INQUIRY_RATE_WINDOW_MS must be at least 1000');
  if (!Number.isInteger(rateMax) || rateMax < 1) throw new Error('NEXA_INQUIRY_RATE_MAX must be a positive integer');
  return {
    allowedOrigins: production ? allowedOrigins : (allowedOrigins.length ? allowedOrigins : ['*']),
    admins,
    requireAdminConfig: production,
    trustProxy: env.NEXA_INQUIRY_TRUST_PROXY === '1',
    rateWindowMs,
    rateMax
  };
}

export function createRuntimeInquiryStore(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const configuredPath = String(env.NEXA_INQUIRY_DB_PATH || '').trim();
  if (production && (!configuredPath || configuredPath === ':memory:')) throw new Error('NEXA_INQUIRY_DB_PATH must point to persistent storage in production');
  return createInquiryStore(configuredPath || 'nexa-tech-service/server/data/inquiries.sqlite');
}

export function createRuntimeFieldOpsClient(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const baseUrl = String(env.NEXA_FIELD_OPS_URL || '').trim();
  const token = String(env.NEXA_FIELD_OPS_SERVICE_TOKEN || '').trim();
  if (!baseUrl && !token && !production) return null;
  if (!baseUrl) throw new Error('NEXA_FIELD_OPS_URL is required for visit handoff');
  if (token.length < 16) throw new Error('NEXA_FIELD_OPS_SERVICE_TOKEN must be at least 16 characters');
  let parsed;
  try { parsed = new URL(baseUrl); } catch { throw new Error('NEXA_FIELD_OPS_URL must be a valid URL'); }
  const localHttp = parsed.protocol === 'http:' && ['127.0.0.1','localhost','::1'].includes(parsed.hostname);
  if (production && parsed.protocol !== 'https:' && !localHttp) throw new Error('NEXA_FIELD_OPS_URL must use HTTPS in production unless it is loopback');
  return createFieldOpsClient({ baseUrl, token });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const port = Number(process.env.PORT || 8796);
  const store = createRuntimeInquiryStore();
  const options = runtimeInquiryOptions();
  options.fieldOpsClient = createRuntimeFieldOpsClient();
  const server = createInquiryServer(store, options);
  const close = () => server.close(() => { store.close(); process.exit(0); });
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
  server.listen(port, '127.0.0.1', () => console.log(`NEXA Inquiry API listening on http://127.0.0.1:${port}`));
}
