import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export class InquiryError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = 'InquiryError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

const INDUSTRIES = new Set(['생산·인쇄·제조', '기업·교육·공공 사무환경', '유통·프랜차이즈·다지점', '장비 공급사·서비스 파트너', '물류·운영 거점', '기타 업종']);
const IMPACTS = new Set(['생산·영업 등 핵심 업무가 멈춤', '처리량·품질에 큰 영향이 생김', '대체 장비가 있어 일정 조율 가능', '고장이 아니라 정기점검·설치 작업']);
const SERVICES = new Set(['정기점검·예방관리', '고장·장애 현장지원', '신규 설치·장비 이전', '여러 사업장 장비관리', '장비 이력·교체 검토', '무엇이 필요한지 상담부터']);
const STATUSES = Object.freeze({ PENDING: 'PENDING', CONTACTED: 'CONTACTED', CLOSED: 'CLOSED' });
const HANDOFF_STATES = Object.freeze({ PENDING: 'PENDING', COMPLETED: 'COMPLETED' });
const txt = (value, max) => String(value ?? '').trim().slice(0, max);
const nowIso = () => new Date().toISOString();

export function validateInquiry(input) {
  const value = {
    company: txt(input?.company, 100),
    name: txt(input?.name, 80),
    phone: txt(input?.phone, 40),
    email: txt(input?.email, 160),
    industry: txt(input?.industry, 80),
    sites: txt(input?.sites, 60),
    assets: txt(input?.assets, 60),
    impact: txt(input?.impact, 120),
    service: txt(input?.service, 120),
    engagement: txt(input?.engagement, 120),
    detail: txt(input?.detail, 2000),
    consent: input?.consent === true || input?.consent === 'yes'
  };
  if (value.company.length < 2) throw new InquiryError(400, 'INVALID_COMPANY', '회사·조직명을 확인해 주세요.');
  if (value.name.length < 2) throw new InquiryError(400, 'INVALID_NAME', '담당자명을 확인해 주세요.');
  if (value.phone.replace(/\D/g, '').length < 9) throw new InquiryError(400, 'INVALID_PHONE', '연락처를 확인해 주세요.');
  if (value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) throw new InquiryError(400, 'INVALID_EMAIL', '이메일 형식을 확인해 주세요.');
  if (!INDUSTRIES.has(value.industry)) throw new InquiryError(400, 'INVALID_INDUSTRY', '업종을 확인해 주세요.');
  if (!IMPACTS.has(value.impact)) throw new InquiryError(400, 'INVALID_IMPACT', '업무 영향을 확인해 주세요.');
  if (!SERVICES.has(value.service)) throw new InquiryError(400, 'INVALID_SERVICE', '관심 서비스를 확인해 주세요.');
  if (value.detail.length < 10) throw new InquiryError(400, 'INVALID_DETAIL', '현재 불편한 점을 10자 이상 작성해 주세요.');
  if (!value.consent) throw new InquiryError(400, 'CONSENT_REQUIRED', '상담 내용 확인이 필요합니다.');
  return value;
}

function rowToInquiry(row) {
  return {
    id: row.public_id,
    company: row.company,
    name: row.contact_name,
    phone: row.phone,
    email: row.email || '',
    industry: row.industry,
    sites: row.sites,
    assets: row.assets,
    impact: row.impact,
    service: row.service,
    engagement: row.engagement,
    detail: row.detail,
    status: row.status,
    version: Number(row.version),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToHandoff(row) {
  if (!row) return null;
  return {
    state: row.state,
    idempotencyKey: row.idempotency_key,
    fieldJobId: row.field_job_id == null ? null : Number(row.field_job_id),
    address: row.address,
    summary: row.summary,
    priority: row.priority,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function createInquiryStore(path = ':memory:') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS inquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT NOT NULL UNIQUE,
      company TEXT NOT NULL,
      contact_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      industry TEXT NOT NULL,
      sites TEXT NOT NULL,
      assets TEXT NOT NULL,
      impact TEXT NOT NULL,
      service TEXT NOT NULL,
      engagement TEXT NOT NULL,
      detail TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('PENDING','CONTACTED','CLOSED')),
      version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_inquiries_status_created ON inquiries(status, created_at DESC);
    CREATE TABLE IF NOT EXISTS inquiry_handoffs (
      inquiry_id INTEGER PRIMARY KEY REFERENCES inquiries(id),
      state TEXT NOT NULL CHECK(state IN ('PENDING','COMPLETED')),
      idempotency_key TEXT NOT NULL UNIQUE,
      field_job_id INTEGER,
      address TEXT NOT NULL,
      summary TEXT NOT NULL,
      priority TEXT NOT NULL CHECK(priority IN ('NORMAL','URGENT')),
      actor TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS inquiry_audits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inquiry_id INTEGER NOT NULL REFERENCES inquiries(id),
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      version INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_inquiry_audits_inquiry ON inquiry_audits(inquiry_id, id DESC);
  `);

  const findRow = publicId => db.prepare('SELECT * FROM inquiries WHERE public_id=?').get(String(publicId));
  const requireInquiry = publicId => {
    const row = findRow(publicId);
    if (!row) throw new InquiryError(404, 'INQUIRY_NOT_FOUND', '상담 요청을 찾을 수 없습니다.');
    return row;
  };
  const findHandoff = inquiryId => db.prepare('SELECT * FROM inquiry_handoffs WHERE inquiry_id=?').get(Number(inquiryId));
  const output = row => ({ ...rowToInquiry(row), handoff: rowToHandoff(findHandoff(row.id)) });
  const validVersion = expectedVersion => {
    const version = Number(expectedVersion);
    if (!Number.isInteger(version) || version < 1) throw new InquiryError(400, 'EXPECTED_VERSION_REQUIRED', 'expectedVersion이 필요합니다.');
    return version;
  };

  return {
    create(input) {
      const value = validateInquiry(input);
      const createdAt = nowIso();
      const publicId = `NX-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
      db.prepare(`INSERT INTO inquiries(public_id,company,contact_name,phone,email,industry,sites,assets,impact,service,engagement,detail,status,version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        publicId, value.company, value.name, value.phone, value.email, value.industry, value.sites, value.assets, value.impact, value.service, value.engagement, value.detail, STATUSES.PENDING, 1, createdAt, createdAt
      );
      return { id: publicId, status: STATUSES.PENDING, version: 1, createdAt };
    },
    list(filters = {}) {
      const status = String(filters.status || '').toUpperCase();
      if (status && !Object.values(STATUSES).includes(status)) throw new InquiryError(400, 'INVALID_STATUS', '지원하지 않는 상담 상태입니다.');
      const rows = status ? db.prepare('SELECT * FROM inquiries WHERE status=? ORDER BY id DESC').all(status) : db.prepare('SELECT * FROM inquiries ORDER BY id DESC').all();
      return rows.map(output);
    },
    get(publicId) { return output(requireInquiry(publicId)); },
    transition(publicId, expectedVersion, nextStatus, actor) {
      if (![STATUSES.CONTACTED, STATUSES.CLOSED].includes(nextStatus)) throw new InquiryError(400, 'INVALID_STATUS', '지원하지 않는 상담 상태입니다.');
      db.exec('BEGIN IMMEDIATE');
      try {
        const row = requireInquiry(publicId);
        const version = validVersion(expectedVersion);
        if (Number(row.version) !== version) throw new InquiryError(409, 'STALE_INQUIRY', '상담 상태가 이미 변경되었습니다.');
        const handoff = findHandoff(row.id);
        if (nextStatus === STATUSES.CLOSED && handoff?.state === HANDOFF_STATES.PENDING) throw new InquiryError(409, 'VISIT_HANDOFF_PENDING', '방문 요청 생성이 진행 중입니다.');
        const allowed = row.status === STATUSES.PENDING ? [STATUSES.CONTACTED, STATUSES.CLOSED] : row.status === STATUSES.CONTACTED ? [STATUSES.CLOSED] : [];
        if (!allowed.includes(nextStatus)) throw new InquiryError(409, 'INVALID_INQUIRY_ACTION', '현재 상태에서는 처리할 수 없습니다.');
        const updatedAt = nowIso();
        const result = db.prepare('UPDATE inquiries SET status=?,version=version+1,updated_at=? WHERE id=? AND version=?').run(nextStatus, updatedAt, row.id, version);
        if (Number(result.changes) !== 1) throw new InquiryError(409, 'STALE_INQUIRY', '상담 상태가 이미 변경되었습니다.');
        const nextVersion = version + 1;
        db.prepare('INSERT INTO inquiry_audits(inquiry_id,actor,action,from_status,to_status,version,created_at) VALUES(?,?,?,?,?,?,?)').run(row.id, String(actor).slice(0, 80), 'STATUS_CHANGE', row.status, nextStatus, nextVersion, updatedAt);
        db.exec('COMMIT');
        return output({ ...row, status: nextStatus, version: nextVersion, updated_at: updatedAt });
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    prepareVisitRequest(publicId, expectedVersion, input, actor) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const row = requireInquiry(publicId);
        const existing = findHandoff(row.id);
        if (existing) {
          db.exec('COMMIT');
          return { inquiry: output(row), handoff: rowToHandoff(existing), replay: true };
        }
        const version = validVersion(expectedVersion);
        if (Number(row.version) !== version) throw new InquiryError(409, 'STALE_INQUIRY', '상담 상태가 이미 변경되었습니다.');
        if (row.status !== STATUSES.CONTACTED) throw new InquiryError(409, 'VISIT_REQUIRES_CONTACTED', '고객 연락 확인 후 방문 요청을 생성할 수 있습니다.');
        const address = txt(input?.address, 300);
        const summary = txt(input?.summary || row.detail, 500);
        const priority = String(input?.priority || 'NORMAL').toUpperCase();
        if (address.length < 5) throw new InquiryError(400, 'INVALID_VISIT_ADDRESS', '확인된 방문 주소를 입력해 주세요.');
        if (summary.length < 5) throw new InquiryError(400, 'INVALID_VISIT_SUMMARY', '방문 요청 내용을 확인해 주세요.');
        if (!['NORMAL','URGENT'].includes(priority)) throw new InquiryError(400, 'INVALID_VISIT_PRIORITY', '방문 우선순위를 확인해 주세요.');
        const timestamp = nowIso();
        const idempotencyKey = `nexa-inquiry-${row.public_id}-visit-v1`;
        db.prepare('INSERT INTO inquiry_handoffs(inquiry_id,state,idempotency_key,field_job_id,address,summary,priority,actor,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(
          row.id, HANDOFF_STATES.PENDING, idempotencyKey, null, address, summary, priority, String(actor).slice(0, 80), timestamp, timestamp
        );
        const result = db.prepare('UPDATE inquiries SET version=version+1,updated_at=? WHERE id=? AND version=?').run(timestamp, row.id, version);
        if (Number(result.changes) !== 1) throw new InquiryError(409, 'STALE_INQUIRY', '상담 상태가 이미 변경되었습니다.');
        const nextVersion = version + 1;
        db.prepare('INSERT INTO inquiry_audits(inquiry_id,actor,action,from_status,to_status,version,created_at) VALUES(?,?,?,?,?,?,?)').run(row.id, String(actor).slice(0, 80), 'VISIT_REQUEST_PREPARED', row.status, row.status, nextVersion, timestamp);
        db.exec('COMMIT');
        const updated = { ...row, version: nextVersion, updated_at: timestamp };
        return { inquiry: output(updated), handoff: rowToHandoff(findHandoff(row.id)), replay: false };
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    completeVisitRequest(publicId, fieldJobId, actor) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const row = requireInquiry(publicId);
        const handoff = findHandoff(row.id);
        if (!handoff) throw new InquiryError(409, 'VISIT_HANDOFF_NOT_PREPARED', '방문 요청 준비 상태가 없습니다.');
        if (handoff.state === HANDOFF_STATES.COMPLETED) {
          db.exec('COMMIT');
          return { inquiry: output(row), handoff: rowToHandoff(handoff), replay: true };
        }
        const jobId = Number(fieldJobId);
        if (!Number.isInteger(jobId) || jobId < 1) throw new InquiryError(502, 'INVALID_FIELD_JOB', '현장 운영시스템이 올바른 작업번호를 반환하지 않았습니다.');
        const timestamp = nowIso();
        db.prepare('UPDATE inquiry_handoffs SET state=?,field_job_id=?,updated_at=? WHERE inquiry_id=? AND state=?').run(HANDOFF_STATES.COMPLETED, jobId, timestamp, row.id, HANDOFF_STATES.PENDING);
        const result = db.prepare('UPDATE inquiries SET version=version+1,updated_at=? WHERE id=? AND version=?').run(timestamp, row.id, row.version);
        if (Number(result.changes) !== 1) throw new InquiryError(409, 'STALE_INQUIRY', '상담 상태가 이미 변경되었습니다.');
        const nextVersion = Number(row.version) + 1;
        db.prepare('INSERT INTO inquiry_audits(inquiry_id,actor,action,from_status,to_status,version,created_at) VALUES(?,?,?,?,?,?,?)').run(row.id, String(actor).slice(0, 80), 'VISIT_REQUEST_CREATED', row.status, row.status, nextVersion, timestamp);
        db.exec('COMMIT');
        return { inquiry: output({ ...row, version: nextVersion, updated_at: timestamp }), handoff: rowToHandoff(findHandoff(row.id)), replay: false };
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    audits(publicId) {
      const inquiry = requireInquiry(publicId);
      return db.prepare('SELECT actor,action,from_status,to_status,version,created_at FROM inquiry_audits WHERE inquiry_id=? ORDER BY id DESC').all(inquiry.id).map(row => ({ actor: row.actor, action: row.action, fromStatus: row.from_status, toStatus: row.to_status, version: Number(row.version), createdAt: row.created_at }));
    },
    close() { db.close(); }
  };
}

export { STATUSES as INQUIRY_STATUS, HANDOFF_STATES as INQUIRY_HANDOFF_STATE };
