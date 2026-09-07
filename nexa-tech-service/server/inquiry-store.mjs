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

export function createInquiryStore(path = ':memory:') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
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
      return rows.map(rowToInquiry);
    },
    get(publicId) { return rowToInquiry(requireInquiry(publicId)); },
    transition(publicId, expectedVersion, nextStatus, actor) {
      if (![STATUSES.CONTACTED, STATUSES.CLOSED].includes(nextStatus)) throw new InquiryError(400, 'INVALID_STATUS', '지원하지 않는 상담 상태입니다.');
      db.exec('BEGIN IMMEDIATE');
      try {
        const row = requireInquiry(publicId);
        const version = Number(expectedVersion);
        if (!Number.isInteger(version) || version < 1) throw new InquiryError(400, 'EXPECTED_VERSION_REQUIRED', 'expectedVersion이 필요합니다.');
        if (Number(row.version) !== version) throw new InquiryError(409, 'STALE_INQUIRY', '상담 상태가 이미 변경되었습니다.');
        const allowed = row.status === STATUSES.PENDING ? [STATUSES.CONTACTED, STATUSES.CLOSED] : row.status === STATUSES.CONTACTED ? [STATUSES.CLOSED] : [];
        if (!allowed.includes(nextStatus)) throw new InquiryError(409, 'INVALID_INQUIRY_ACTION', '현재 상태에서는 처리할 수 없습니다.');
        const updatedAt = nowIso();
        const result = db.prepare('UPDATE inquiries SET status=?,version=version+1,updated_at=? WHERE id=? AND version=?').run(nextStatus, updatedAt, row.id, version);
        if (Number(result.changes) !== 1) throw new InquiryError(409, 'STALE_INQUIRY', '상담 상태가 이미 변경되었습니다.');
        const nextVersion = version + 1;
        db.prepare('INSERT INTO inquiry_audits(inquiry_id,actor,action,from_status,to_status,version,created_at) VALUES(?,?,?,?,?,?,?)').run(row.id, String(actor).slice(0, 80), 'STATUS_CHANGE', row.status, nextStatus, nextVersion, updatedAt);
        db.exec('COMMIT');
        return { ...rowToInquiry({ ...row, status: nextStatus, version: nextVersion, updated_at: updatedAt }), status: nextStatus, version: nextVersion, updatedAt };
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

export { STATUSES as INQUIRY_STATUS };
