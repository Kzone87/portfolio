import http from 'node:http';
import { createHash, randomInt } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { InquiryError } from './inquiry-store.mjs';
import { createRuntimeInquiryStore, createRuntimeFieldOpsClient } from './app.mjs';
import { createCustomerAccessStore, CustomerAccessError } from './customer-access-store.mjs';

const COOKIE = 'nexa_customer_session';
const BODY_LIMIT = 48 * 1024;
const DEFAULT_RATE_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_RATE_MAX = 5;
const sha = value => createHash('sha256').update(String(value || '')).digest('hex');
const phoneKey = value => String(value || '').replace(/\D/g, '');
const emailKey = value => String(value || '').trim().toLowerCase();

function cookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

function sessionCookie(value, maxAge, secure) {
  const items = [
    `${COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.max(0, Math.floor(maxAge))}`
  ];
  if (secure) items.push('Secure');
  return items.join('; ');
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > BODY_LIMIT) throw new CustomerAccessError(413, 'BODY_TOO_LARGE', '요청 내용이 너무 큽니다.');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new CustomerAccessError(400, 'INVALID_JSON', '요청 형식을 확인해 주세요.'); }
}

function originHeaders(req, config) {
  const origin = String(req.headers.origin || '').trim();
  if (!origin) return {};
  if (!config.allowedOrigins.has('*') && !config.allowedOrigins.has(origin)) {
    throw new CustomerAccessError(403, 'ORIGIN_NOT_ALLOWED', '요청할 수 없는 출처입니다.');
  }
  return {
    'access-control-allow-origin': config.allowedOrigins.has('*') ? origin : origin,
    'access-control-allow-credentials': 'true',
    vary: 'Origin'
  };
}

function send(req, res, config, status, body, extra = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    ...originHeaders(req, config),
    ...extra
  });
  res.end(payload);
}

function clientKey(req, config, suffix = '') {
  let address = String(req.socket.remoteAddress || 'unknown');
  if (config.trustProxy) {
    address = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || address;
  }
  return sha(`${address}|${String(req.headers['user-agent'] || '')}|${suffix}`);
}

function consumeRate(req, config, suffix = '') {
  const key = clientKey(req, config, suffix);
  const now = Date.now();
  const bucket = config.rateBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    config.rateBuckets.set(key, { count: 1, resetAt: now + config.rateWindowMs });
    return;
  }
  if (bucket.count >= config.rateMax) {
    throw new CustomerAccessError(429, 'RATE_LIMITED', '인증 요청이 많습니다. 잠시 후 다시 시도해 주세요.');
  }
  bucket.count += 1;
}

function resolveIdentity(inquiryStore, requestId, channel) {
  const id = String(requestId || '').trim().toUpperCase();
  if (!/^NX-[A-Z0-9-]{6,24}$/.test(id)) return null;
  let inquiry;
  try { inquiry = inquiryStore.get(id); }
  catch (error) {
    if (error instanceof InquiryError && error.statusCode === 404) return null;
    throw error;
  }
  const target = channel === 'email' ? emailKey(inquiry.email) : phoneKey(inquiry.phone);
  if (!target) return null;
  return { inquiry, target, contactKey: target };
}

function sessionFor(req, config) {
  const raw = cookies(req)[COOKIE] || '';
  if (!raw) throw new CustomerAccessError(401, 'CUSTOMER_SESSION_REQUIRED', '고객 인증이 필요합니다.');
  return { raw, value: config.accessStore.resolveSession(raw) };
}

function sameScope(inquiry, session) {
  if (String(inquiry.company || '') !== String(session.company || '')) return false;
  return session.channel === 'email'
    ? emailKey(inquiry.email) === session.contactKey
    : phoneKey(inquiry.phone) === session.contactKey;
}

function basePublic(inquiry) {
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
    customerActions: (inquiry.customerActions || []).map(item => ({
      id: item.id,
      type: item.type,
      state: item.state,
      note: item.note,
      preferredAt: item.preferredAt,
      resolution: item.resolution,
      createdAt: item.createdAt,
      resolvedAt: item.resolvedAt
    })),
    updates: []
  };
}

function inquiryUpdates(store, inquiry) {
  const labels = {
    VISIT_REQUEST_CREATED: ['현장 방문 요청 전달', '현장 운영팀에 방문 요청이 전달되었습니다.'],
    VISIT_REQUEST_PREPARED: ['방문 준비 확인', '방문 장소와 요청 내용을 확인했습니다.'],
    CUSTOMER_RESCHEDULE_REQUESTED: ['일정 변경 요청 접수', '희망 방문시간 변경 요청을 담당자가 확인합니다.'],
    CUSTOMER_CANCEL_REQUESTED: ['방문 취소 요청 접수', '방문 취소 요청을 담당자가 확인합니다.'],
    CUSTOMER_MESSAGE_REQUESTED: ['추가 문의 접수', '추가로 남긴 내용을 담당자가 확인합니다.'],
    CUSTOMER_ACTION_RESOLVED: ['고객 요청 처리 완료', '담당자가 고객 요청을 확인하고 처리했습니다.'],
    CUSTOMER_ACTION_REJECTED: ['고객 요청 확인 완료', '담당자가 요청을 확인하고 처리 결과를 남겼습니다.']
  };
  const items = store.audits(inquiry.id).map(item => {
    if (labels[item.action]) return { at: item.createdAt, title: labels[item.action][0], copy: labels[item.action][1] };
    if (item.toStatus === 'CLOSED') return { at: item.createdAt, title: '상담 처리 완료', copy: '상담 요청의 처리가 완료되었습니다.' };
    if (item.toStatus === 'CONTACTED') return { at: item.createdAt, title: '상담 내용 확인', copy: '담당자가 상담 내용을 확인했습니다.' };
    return { at: item.createdAt, title: '요청 상태 변경', copy: '서비스 요청 상태가 변경되었습니다.' };
  });
  items.push({ at: inquiry.createdAt, title: '상담 접수', copy: '유지보수 상담 요청이 접수되었습니다.' });
  return items;
}

function fieldUpdates(visit) {
  const labels = {
    CREATE: ['방문 요청 접수', '현장 운영팀에 방문 요청이 등록되었습니다.'],
    SCHEDULE: ['방문 일정 확정', '담당 기사와 방문 일정이 확정되었습니다.'],
    SCHEDULE_OVERRIDE: ['긴급 방문 일정 확정', '긴급 방문 일정이 확정되었습니다.'],
    RESCHEDULE: ['방문 일정 변경', '방문 일정이 변경되었습니다.'],
    REASSIGN: ['담당 기사 변경', '방문 담당 기사가 변경되었습니다.'],
    DISPATCH: ['기사 출동', '담당 기사가 방문 장소로 출동했습니다.'],
    ON_SITE: ['현장 도착', '담당 기사가 현장에 도착했습니다.'],
    COMPLETE: ['현장 작업 완료', '현장 작업이 완료되었습니다.'],
    CANCEL: ['방문 취소', '방문 요청이 취소되었습니다.'],
    NO_SHOW: ['방문 일정 재확인', '현장 방문이 완료되지 않아 일정 확인이 필요합니다.']
  };
  return (visit?.updates || []).map(item => {
    const value = labels[item.action] || ['현장 진행상태 변경', '현장 서비스 진행상태가 변경되었습니다.'];
    return { at: item.createdAt, title: value[0], copy: value[1] };
  });
}

async function secureView(config, inquiry) {
  const view = basePublic(inquiry);
  let visit = null;
  if (view.handoff?.fieldJobId && config.fieldOpsClient) {
    visit = await config.fieldOpsClient.getVisitRequest(view.handoff.fieldJobId);
  }
  const updates = [...fieldUpdates(visit), ...inquiryUpdates(config.inquiryStore, inquiry)]
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, 12);
  return {
    ...view,
    visit: visit ? {
      id: visit.id,
      status: visit.status,
      priority: visit.priority,
      startAt: visit.startAt,
      endAt: visit.endAt,
      address: visit.address,
      summary: visit.summary,
      agentAssigned: visit.agentAssigned,
      fieldReport: visit.fieldReport || null
    } : null,
    updates
  };
}

function reportFromView(view) {
  const completeUpdate = (view.visit?.updates || []).find(item => item.action === 'COMPLETE');
  return {
    requestId: view.id,
    status: view.visit?.status || view.status,
    service: view.service,
    address: view.visit?.address || view.handoff?.address || '',
    summary: view.visit?.summary || view.handoff?.summary || '',
    scheduledAt: view.visit?.startAt || null,
    completedAt: completeUpdate?.createdAt || (view.visit?.status === 'COMPLETED' ? view.visit?.endAt || null : null),
    fieldReport: view.visit?.fieldReport || null
  };
}

export function createOtpWebhookSender({ url, token = '', fetchImpl = fetch }) {
  const endpoint = String(url || '').trim();
  if (!endpoint) throw new Error('OTP webhook URL is required');
  return async ({ channel, to, code, requestId }) => {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ channel, to, code, requestId })
    });
    if (!response.ok) {
      throw new CustomerAccessError(502, 'OTP_DELIVERY_FAILED', '인증번호를 전송하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  };
}

export function createCustomerAccessServer(options = {}) {
  if (!options.inquiryStore) throw new Error('customer access server requires inquiryStore');
  if (!options.accessStore) throw new Error('customer access server requires accessStore');
  if (typeof options.sendOtp !== 'function') throw new Error('customer access server requires sendOtp');

  const config = {
    inquiryStore: options.inquiryStore,
    accessStore: options.accessStore,
    fieldOpsClient: options.fieldOpsClient || null,
    sendOtp: options.sendOtp,
    allowedOrigins: new Set(options.allowedOrigins || ['*']),
    secureCookies: Boolean(options.secureCookies),
    trustProxy: Boolean(options.trustProxy),
    rateWindowMs: Number(options.rateWindowMs || DEFAULT_RATE_WINDOW_MS),
    rateMax: Number(options.rateMax || DEFAULT_RATE_MAX),
    rateBuckets: new Map()
  };

  if (!Number.isFinite(config.rateWindowMs) || config.rateWindowMs < 1000) throw new Error('rateWindowMs must be at least 1000 milliseconds');
  if (!Number.isInteger(config.rateMax) || config.rateMax < 1) throw new Error('rateMax must be a positive integer');

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      const path = url.pathname;

      if (req.method !== 'OPTIONS') originHeaders(req, config);
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          ...originHeaders(req, config),
          'access-control-allow-headers': 'content-type,x-csrf-token',
          'access-control-allow-methods': 'GET,POST,OPTIONS',
          'access-control-allow-credentials': 'true',
          'access-control-max-age': '600',
          'x-content-type-options': 'nosniff'
        });
        res.end();
        return;
      }

      if (req.method === 'GET' && path === '/api/customer/access/health') {
        send(req, res, config, 200, { ok: true, service: 'nexa-customer-access' });
        return;
      }
      if (req.method === 'GET' && path === '/api/customer/access/ready') {
        send(req, res, config, 200, { ready: true, service: 'nexa-customer-access' });
        return;
      }

      if (req.method === 'POST' && path === '/api/customer/access/challenge') {
        const input = await readBody(req);
        const id = String(input.id || '').trim().toUpperCase();
        const channel = String(input.channel || 'sms').toLowerCase() === 'email' ? 'email' : 'sms';
        config.accessStore.cleanup();
        consumeRate(req, config, 'client');
        consumeRate(req, config, `target:${id}|${channel}`);

        const identity = resolveIdentity(config.inquiryStore, id, channel);
        const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
        const challenge = config.accessStore.createChallenge({
          requestId: identity?.inquiry?.id || null,
          company: identity?.inquiry?.company || '',
          contactKey: identity?.contactKey || '',
          channel,
          code
        });
        if (identity) {
          await config.sendOtp({ channel, to: identity.target, code, requestId: identity.inquiry.id });
        }
        send(req, res, config, 202, challenge);
        return;
      }

      if (req.method === 'POST' && path === '/api/customer/access/verify') {
        const input = await readBody(req);
        const verified = config.accessStore.verifyChallenge(input.challengeId, input.code);
        const maxAge = Math.max(0, Math.floor((Date.parse(verified.expiresAt) - Date.now()) / 1000));
        send(req, res, config, 200, {
          ok: true,
          csrfToken: verified.csrfToken,
          expiresAt: verified.expiresAt,
          requestId: verified.anchorRequestId
        }, { 'set-cookie': sessionCookie(verified.token, maxAge, config.secureCookies) });
        return;
      }

      if (req.method === 'GET' && path === '/api/customer/access/request') {
        const session = sessionFor(req, config).value;
        const inquiry = config.inquiryStore.get(session.anchorRequestId);
        if (!sameScope(inquiry, session)) throw new CustomerAccessError(403, 'CUSTOMER_SCOPE_MISMATCH', '조회할 수 없는 요청입니다.');
        send(req, res, config, 200, await secureView(config, inquiry));
        return;
      }

      if (req.method === 'GET' && path === '/api/customer/access/history') {
        const session = sessionFor(req, config).value;
        const items = config.inquiryStore.list()
          .filter(item => sameScope(item, session))
          .slice(0, 20)
          .map(item => ({
            id: item.id,
            status: item.status,
            service: item.service,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt
          }));
        send(req, res, config, 200, { items });
        return;
      }

      if (req.method === 'GET' && path === '/api/customer/access/report') {
        const session = sessionFor(req, config).value;
        const requestId = String(url.searchParams.get('requestId') || session.anchorRequestId).trim().toUpperCase();
        let inquiry;
        try { inquiry = config.inquiryStore.get(requestId); }
        catch (error) {
          if (error instanceof InquiryError && error.statusCode === 404) throw new CustomerAccessError(404, 'CUSTOMER_REQUEST_NOT_FOUND', '접수정보를 확인할 수 없습니다.');
          throw error;
        }
        if (!sameScope(inquiry, session)) throw new CustomerAccessError(404, 'CUSTOMER_REQUEST_NOT_FOUND', '접수정보를 확인할 수 없습니다.');
        const view = await secureView(config, inquiry);
        send(req, res, config, 200, reportFromView(view));
        return;
      }

      if (req.method === 'POST' && path === '/api/customer/access/action') {
        const sessionInfo = sessionFor(req, config);
        config.accessStore.assertCsrf(sessionInfo.value, String(req.headers['x-csrf-token'] || ''));
        const input = await readBody(req);
        const requestId = String(input.requestId || sessionInfo.value.anchorRequestId).trim().toUpperCase();
        let inquiry;
        try { inquiry = config.inquiryStore.get(requestId); }
        catch (error) {
          if (error instanceof InquiryError && error.statusCode === 404) throw new CustomerAccessError(404, 'CUSTOMER_REQUEST_NOT_FOUND', '접수정보를 확인할 수 없습니다.');
          throw error;
        }
        if (!sameScope(inquiry, sessionInfo.value)) throw new CustomerAccessError(404, 'CUSTOMER_REQUEST_NOT_FOUND', '접수정보를 확인할 수 없습니다.');
        const action = config.inquiryStore.createCustomerAction(inquiry.id, input, 'customer');
        send(req, res, config, 201, { action });
        return;
      }

      if (req.method === 'POST' && path === '/api/customer/access/logout') {
        const sessionInfo = sessionFor(req, config);
        config.accessStore.assertCsrf(sessionInfo.value, String(req.headers['x-csrf-token'] || ''));
        config.accessStore.logout(sessionInfo.raw);
        send(req, res, config, 200, { ok: true }, { 'set-cookie': sessionCookie('', 0, config.secureCookies) });
        return;
      }

      send(req, res, config, 404, { error: { code: 'NOT_FOUND', message: '요청 경로를 찾을 수 없습니다.' } });
    } catch (error) {
      if (error instanceof CustomerAccessError || error instanceof InquiryError) {
        const statusCode = Number(error.statusCode || 400);
        try {
          send(req, res, config, statusCode, { error: { code: error.code || 'REQUEST_FAILED', message: error.message } }, error.code === 'RATE_LIMITED' ? { 'retry-after': '60' } : {});
        } catch {
          res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
          res.end(JSON.stringify({ error: { code: error.code || 'REQUEST_FAILED', message: error.message } }));
        }
        return;
      }
      console.error(error);
      try { send(req, res, config, 500, { error: { code: 'INTERNAL_ERROR', message: '고객 인증 요청을 처리하지 못했습니다.' } }); }
      catch {
        res.writeHead(500, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        res.end(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: '고객 인증 요청을 처리하지 못했습니다.' } }));
      }
    }
  });
}

export function runtimeCustomerAccessOptions(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const allowedOrigins = String(env.NEXA_CUSTOMER_ALLOWED_ORIGINS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  if (production && allowedOrigins.length === 0) throw new Error('NEXA_CUSTOMER_ALLOWED_ORIGINS is required in production');
  if (production && allowedOrigins.includes('*')) throw new Error('NEXA_CUSTOMER_ALLOWED_ORIGINS must not contain * in production');

  const webhook = String(env.NEXA_CUSTOMER_OTP_WEBHOOK_URL || '').trim();
  if (production && !webhook) throw new Error('NEXA_CUSTOMER_OTP_WEBHOOK_URL is required in production');
  if (webhook) {
    let parsed;
    try { parsed = new URL(webhook); }
    catch { throw new Error('NEXA_CUSTOMER_OTP_WEBHOOK_URL must be a valid URL'); }
    const loopback = ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname);
    if (production && parsed.protocol !== 'https:' && !loopback) throw new Error('NEXA_CUSTOMER_OTP_WEBHOOK_URL must use HTTPS in production unless it is loopback');
  }

  const rateWindowMs = Number(env.NEXA_CUSTOMER_RATE_WINDOW_MS || DEFAULT_RATE_WINDOW_MS);
  const rateMax = Number(env.NEXA_CUSTOMER_RATE_MAX || DEFAULT_RATE_MAX);
  if (!Number.isFinite(rateWindowMs) || rateWindowMs < 1000) throw new Error('NEXA_CUSTOMER_RATE_WINDOW_MS must be at least 1000');
  if (!Number.isInteger(rateMax) || rateMax < 1) throw new Error('NEXA_CUSTOMER_RATE_MAX must be a positive integer');

  return {
    allowedOrigins: production ? allowedOrigins : (allowedOrigins.length ? allowedOrigins : ['*']),
    secureCookies: production || env.NEXA_CUSTOMER_SECURE_COOKIES === '1',
    trustProxy: env.NEXA_CUSTOMER_TRUST_PROXY === '1',
    webhook,
    webhookToken: String(env.NEXA_CUSTOMER_OTP_WEBHOOK_TOKEN || '').trim(),
    rateWindowMs,
    rateMax
  };
}

export function createRuntimeCustomerAccessStore(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const configuredPath = String(env.NEXA_CUSTOMER_ACCESS_DB_PATH || '').trim();
  if (production && (!configuredPath || configuredPath === ':memory:')) {
    throw new Error('NEXA_CUSTOMER_ACCESS_DB_PATH must point to persistent storage in production');
  }
  return createCustomerAccessStore(configuredPath || 'nexa-tech-service/server/data/customer-access.sqlite');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const runtime = runtimeCustomerAccessOptions();
  const inquiryStore = createRuntimeInquiryStore();
  const accessStore = createRuntimeCustomerAccessStore();
  const fieldOpsClient = createRuntimeFieldOpsClient();
  const sendOtp = runtime.webhook
    ? createOtpWebhookSender({ url: runtime.webhook, token: runtime.webhookToken })
    : async ({ channel, to, code }) => console.log(`[DEV OTP] ${channel} ${to}: ${code}`);
  const server = createCustomerAccessServer({ ...runtime, inquiryStore, accessStore, fieldOpsClient, sendOtp });
  const port = Number(process.env.PORT || 8797);
  const close = () => server.close(() => {
    accessStore.close();
    inquiryStore.close();
    process.exit(0);
  });
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
  server.listen(port, '127.0.0.1', () => console.log(`NEXA Customer Access API listening on http://127.0.0.1:${port}`));
}
