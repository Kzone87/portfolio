import http from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const BODY_LIMIT = 48 * 1024;
const DEFAULT_RATE_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_RATE_MAX = 5;
const STATUS = new Set(['NEW', 'CONTACTED', 'CLOSED']);
const text = (value, max) => String(value ?? '').trim().slice(0, max);
const nowIso = () => new Date().toISOString();
const tokenHash = value => createHash('sha256').update(String(value || '')).digest('hex');

export class ProjectInquiryError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = 'ProjectInquiryError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function validate(input) {
  const value = {
    company: text(input?.company, 120),
    name: text(input?.name, 80),
    email: text(input?.email, 180).toLowerCase(),
    projectType: text(input?.projectType, 120),
    budgetRange: text(input?.budgetRange, 120),
    desiredStart: text(input?.desiredStart, 120),
    detail: text(input?.detail, 4000),
    consent: input?.consent === true || input?.consent === 'yes'
  };
  if (value.company.length < 2) throw new ProjectInquiryError(400, 'INVALID_COMPANY', '회사·조직명을 확인해 주세요.');
  if (value.name.length < 2) throw new ProjectInquiryError(400, 'INVALID_NAME', '담당자명을 확인해 주세요.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) throw new ProjectInquiryError(400, 'INVALID_EMAIL', '회신 이메일을 확인해 주세요.');
  if (value.projectType.length < 2) throw new ProjectInquiryError(400, 'INVALID_PROJECT_TYPE', '프로젝트 유형을 확인해 주세요.');
  if (value.detail.length < 10) throw new ProjectInquiryError(400, 'INVALID_DETAIL', '현재 업무와 필요한 범위를 10자 이상 작성해 주세요.');
  if (!value.consent) throw new ProjectInquiryError(400, 'CONSENT_REQUIRED', '문의 내용 확인이 필요합니다.');
  return value;
}

export function createProjectInquiryStore(path = ':memory:') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_inquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT NOT NULL UNIQUE,
      company TEXT NOT NULL,
      contact_name TEXT NOT NULL,
      email TEXT NOT NULL,
      project_type TEXT NOT NULL,
      budget_range TEXT NOT NULL DEFAULT '',
      desired_start TEXT NOT NULL DEFAULT '',
      detail TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('NEW','CONTACTED','CLOSED')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_project_inquiries_status_created ON project_inquiries(status,id DESC);
    CREATE TABLE IF NOT EXISTS project_inquiry_audits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inquiry_id INTEGER NOT NULL REFERENCES project_inquiries(id),
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  const row = value => value ? ({
    id: value.public_id,
    company: value.company,
    name: value.contact_name,
    email: value.email,
    projectType: value.project_type,
    budgetRange: value.budget_range,
    desiredStart: value.desired_start,
    detail: value.detail,
    status: value.status,
    createdAt: value.created_at,
    updatedAt: value.updated_at
  }) : null;
  const requireRow = publicId => {
    const value = db.prepare('SELECT * FROM project_inquiries WHERE public_id=?').get(String(publicId || '').toUpperCase());
    if (!value) throw new ProjectInquiryError(404, 'PROJECT_INQUIRY_NOT_FOUND', '프로젝트 문의를 찾을 수 없습니다.');
    return value;
  };
  return {
    create(input) {
      const value = validate(input);
      const at = nowIso();
      const publicId = `KZ-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
      const result = db.prepare(`INSERT INTO project_inquiries(public_id,company,contact_name,email,project_type,budget_range,desired_start,detail,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(
        publicId, value.company, value.name, value.email, value.projectType, value.budgetRange, value.desiredStart, value.detail, 'NEW', at, at
      );
      db.prepare('INSERT INTO project_inquiry_audits(inquiry_id,actor,action,from_status,to_status,created_at) VALUES(?,?,?,?,?,?)').run(Number(result.lastInsertRowid), 'customer', 'CREATE', null, 'NEW', at);
      return { id: publicId, status: 'NEW', createdAt: at };
    },
    list(status = '') {
      const normalized = String(status || '').toUpperCase();
      if (normalized && !STATUS.has(normalized)) throw new ProjectInquiryError(400, 'INVALID_STATUS', '프로젝트 문의 상태를 확인해 주세요.');
      const rows = normalized
        ? db.prepare('SELECT * FROM project_inquiries WHERE status=? ORDER BY id DESC').all(normalized)
        : db.prepare('SELECT * FROM project_inquiries ORDER BY id DESC').all();
      return rows.map(row);
    },
    get(publicId) { return row(requireRow(publicId)); },
    transition(publicId, nextStatus, actor) {
      const next = String(nextStatus || '').toUpperCase();
      if (!STATUS.has(next) || next === 'NEW') throw new ProjectInquiryError(400, 'INVALID_STATUS', '변경할 문의 상태를 확인해 주세요.');
      db.exec('BEGIN IMMEDIATE');
      try {
        const current = requireRow(publicId);
        const allowed = current.status === 'NEW' ? ['CONTACTED', 'CLOSED'] : current.status === 'CONTACTED' ? ['CLOSED'] : [];
        if (!allowed.includes(next)) throw new ProjectInquiryError(409, 'INVALID_PROJECT_INQUIRY_ACTION', '현재 상태에서는 처리할 수 없습니다.');
        const at = nowIso();
        db.prepare('UPDATE project_inquiries SET status=?,updated_at=? WHERE id=?').run(next, at, current.id);
        db.prepare('INSERT INTO project_inquiry_audits(inquiry_id,actor,action,from_status,to_status,created_at) VALUES(?,?,?,?,?,?)').run(current.id, text(actor, 80), 'STATUS_CHANGE', current.status, next, at);
        db.exec('COMMIT');
        return row({ ...current, status: next, updated_at: at });
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    count() { return Number(db.prepare('SELECT COUNT(*) AS count FROM project_inquiries').get().count); },
    close() { db.close(); }
  };
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > BODY_LIMIT) throw new ProjectInquiryError(413, 'BODY_TOO_LARGE', '문의 내용이 너무 큽니다.');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new ProjectInquiryError(400, 'INVALID_JSON', '요청 형식을 확인해 주세요.'); }
}

function parseAdmins(raw = '') {
  if (!String(raw).trim()) return [];
  let value;
  try { value = JSON.parse(raw); } catch { throw new Error('KZONE_PROJECT_INQUIRY_ADMINS_JSON must be valid JSON'); }
  if (!Array.isArray(value)) throw new Error('KZONE_PROJECT_INQUIRY_ADMINS_JSON must be an array');
  return value.map((item, index) => {
    const token = String(item?.token || '').trim();
    const id = String(item?.id || '').trim();
    if (token.length < 16) throw new Error(`project inquiry admin ${index} token must be at least 16 characters`);
    if (!/^[a-zA-Z0-9._-]{2,80}$/.test(id)) throw new Error(`project inquiry admin ${index} id is invalid`);
    return { token, id };
  });
}

function adminRegistry(items) { return new Map(items.map(item => [tokenHash(item.token), { id: item.id }])); }
function requireAdmin(req, config) {
  const match = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  if (!match) throw new ProjectInquiryError(401, 'AUTH_REQUIRED', '관리자 인증이 필요합니다.');
  const principal = config.admins.get(tokenHash(match[1].trim()));
  if (!principal) throw new ProjectInquiryError(401, 'INVALID_AUTH_TOKEN', '관리자 인증정보가 올바르지 않습니다.');
  return principal;
}
function clientKey(req, trustProxy) {
  let address = String(req.socket.remoteAddress || 'unknown');
  if (trustProxy) address = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || address;
  return createHash('sha256').update(`${address}|${String(req.headers['user-agent'] || '')}`).digest('hex');
}
function consumeRate(req, config) {
  const key = clientKey(req, config.trustProxy);
  const now = Date.now();
  const bucket = config.rateBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) { config.rateBuckets.set(key, { count: 1, resetAt: now + config.rateWindowMs }); return; }
  if (bucket.count >= config.rateMax) throw new ProjectInquiryError(429, 'RATE_LIMITED', '문의 요청이 많습니다. 잠시 후 다시 시도해 주세요.');
  bucket.count += 1;
}
function originHeaders(req, config) {
  const origin = String(req.headers.origin || '').trim();
  if (!origin) return {};
  if (!config.allowedOrigins.has('*') && !config.allowedOrigins.has(origin)) throw new ProjectInquiryError(403, 'ORIGIN_NOT_ALLOWED', '요청할 수 없는 출처입니다.');
  return { 'access-control-allow-origin': config.allowedOrigins.has('*') ? '*' : origin, vary: 'Origin' };
}
function send(req, res, config, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    ...originHeaders(req, config)
  });
  res.end(payload);
}

export function createProjectInquiryServer(store = createProjectInquiryStore(), options = {}) {
  const config = {
    allowedOrigins: new Set(options.allowedOrigins || ['*']),
    admins: adminRegistry(options.admins || []),
    requireAdminConfig: Boolean(options.requireAdminConfig),
    trustProxy: Boolean(options.trustProxy),
    rateWindowMs: Number(options.rateWindowMs || DEFAULT_RATE_WINDOW_MS),
    rateMax: Number(options.rateMax || DEFAULT_RATE_MAX),
    rateBuckets: new Map()
  };
  if (config.requireAdminConfig && !config.admins.size) throw new Error('production project inquiry API requires an admin principal');
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      const path = url.pathname;
      if (req.method !== 'OPTIONS') originHeaders(req, config);
      if (req.method === 'OPTIONS') {
        res.writeHead(204, { ...originHeaders(req, config), 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-max-age': '600' });
        res.end(); return;
      }
      if (req.method === 'GET' && path === '/api/health') { send(req, res, config, 200, { ok: true, service: 'kzone-project-inquiry' }); return; }
      if (req.method === 'GET' && path === '/api/ready') { send(req, res, config, 200, { ready: true, service: 'kzone-project-inquiry', inquiries: store.count() }); return; }
      if (req.method === 'POST' && path === '/api/project-inquiries') {
        consumeRate(req, config);
        send(req, res, config, 201, store.create(await readBody(req))); return;
      }
      if (path === '/api/admin/project-inquiries' && req.method === 'GET') {
        requireAdmin(req, config);
        send(req, res, config, 200, { items: store.list(url.searchParams.get('status') || '') }); return;
      }
      const match = path.match(/^\/api\/admin\/project-inquiries\/(KZ-[A-Z0-9-]+)\/status$/);
      if (match && req.method === 'POST') {
        const admin = requireAdmin(req, config);
        const input = await readBody(req);
        send(req, res, config, 200, store.transition(match[1], input.status, admin.id)); return;
      }
      send(req, res, config, 404, { error: { code: 'NOT_FOUND', message: '요청 경로를 찾을 수 없습니다.' } });
    } catch (error) {
      const value = error instanceof ProjectInquiryError ? error : new ProjectInquiryError(500, 'INTERNAL_ERROR', '프로젝트 문의를 처리하지 못했습니다.');
      if (!(error instanceof ProjectInquiryError)) console.error(error);
      try { send(req, res, config, value.statusCode, { error: { code: value.code, message: value.message } }); }
      catch { res.writeHead(value.statusCode, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify({ error: { code: value.code, message: value.message } })); }
    }
  });
}

export function runtimeProjectInquiryOptions(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const allowedOrigins = String(env.KZONE_PROJECT_INQUIRY_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  if (production && (!allowedOrigins.length || allowedOrigins.includes('*'))) throw new Error('KZONE_PROJECT_INQUIRY_ALLOWED_ORIGINS must be a non-wildcard origin list in production');
  const admins = parseAdmins(env.KZONE_PROJECT_INQUIRY_ADMINS_JSON || '');
  if (production && !admins.length) throw new Error('KZONE_PROJECT_INQUIRY_ADMINS_JSON is required in production');
  return { allowedOrigins: production ? allowedOrigins : (allowedOrigins.length ? allowedOrigins : ['*']), admins, requireAdminConfig: production, trustProxy: env.KZONE_PROJECT_INQUIRY_TRUST_PROXY === '1' };
}
export function createRuntimeProjectInquiryStore(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const path = String(env.KZONE_PROJECT_INQUIRY_DB_PATH || '').trim();
  if (production && (!path || path === ':memory:')) throw new Error('KZONE_PROJECT_INQUIRY_DB_PATH must point to persistent storage in production');
  return createProjectInquiryStore(path || 'portfolio-inquiry/data/project-inquiries.sqlite');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const store = createRuntimeProjectInquiryStore();
  const server = createProjectInquiryServer(store, runtimeProjectInquiryOptions());
  const port = Number(process.env.PORT || 8798);
  const close = () => server.close(() => { store.close(); process.exit(0); });
  process.on('SIGINT', close); process.on('SIGTERM', close);
  server.listen(port, '127.0.0.1', () => console.log(`KZONE project inquiry API listening on http://127.0.0.1:${port}`));
}
