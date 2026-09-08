import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export class CustomerAccessError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = 'CustomerAccessError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

const sha = value => createHash('sha256').update(String(value || '')).digest('hex');
const nowIso = () => new Date().toISOString();
const safeEqual = (left, right) => {
  try {
    const a = Buffer.from(String(left), 'hex');
    const b = Buffer.from(String(right), 'hex');
    return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
  } catch { return false; }
};
const codeHash = (challengeId, code) => sha(`${challengeId}:${String(code || '')}`);

export function createCustomerAccessStore(path = ':memory:', options = {}) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
  const challengeTtlMs = Number(options.challengeTtlMs || 5 * 60 * 1000);
  const maxAttempts = Number(options.maxAttempts || 5);
  const sessionMaxMs = Number(options.sessionMaxMs || 60 * 60 * 1000);
  const sessionIdleMs = Number(options.sessionIdleMs || 20 * 60 * 1000);
  if (!Number.isFinite(challengeTtlMs) || challengeTtlMs < 60_000) throw new Error('challengeTtlMs must be at least one minute');
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) throw new Error('maxAttempts must be positive');
  if (!Number.isFinite(sessionMaxMs) || sessionMaxMs < 5 * 60_000) throw new Error('sessionMaxMs must be at least five minutes');
  if (!Number.isFinite(sessionIdleMs) || sessionIdleMs < 60_000 || sessionIdleMs > sessionMaxMs) throw new Error('sessionIdleMs must be between one minute and sessionMaxMs');
  db.exec(`
    CREATE TABLE IF NOT EXISTS customer_access_challenges (
      id TEXT PRIMARY KEY,
      request_id TEXT,
      company TEXT NOT NULL DEFAULT '',
      contact_key TEXT NOT NULL DEFAULT '',
      channel TEXT NOT NULL CHECK(channel IN ('sms','email')),
      code_hash TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      consumed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_customer_access_challenges_request ON customer_access_challenges(request_id,created_at DESC);
    CREATE TABLE IF NOT EXISTS customer_access_sessions (
      token_hash TEXT PRIMARY KEY,
      anchor_request_id TEXT NOT NULL,
      company TEXT NOT NULL,
      contact_key TEXT NOT NULL,
      channel TEXT NOT NULL,
      csrf_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_customer_access_sessions_expires ON customer_access_sessions(expires_at);
  `);

  function createChallenge({ requestId = null, company = '', contactKey = '', channel, code }) {
    const id = `NXA-${randomUUID()}`;
    const createdAt = nowIso();
    const expiresAt = new Date(Date.now() + challengeTtlMs).toISOString();
    db.prepare('INSERT INTO customer_access_challenges(id,request_id,company,contact_key,channel,code_hash,max_attempts,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?)').run(
      id, requestId || null, String(company || '').slice(0, 120), String(contactKey || '').slice(0, 180), channel, codeHash(id, code), maxAttempts, createdAt, expiresAt
    );
    return { challengeId: id, expiresAt };
  }

  function verifyChallenge(challengeId, code) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const row = db.prepare('SELECT * FROM customer_access_challenges WHERE id=?').get(String(challengeId || ''));
      const generic = () => new CustomerAccessError(401, 'OTP_INVALID', '인증번호를 확인해 주세요.');
      if (!row || row.consumed_at || Date.now() >= Date.parse(row.expires_at) || Number(row.attempts) >= Number(row.max_attempts)) throw generic();
      if (!safeEqual(row.code_hash, codeHash(row.id, code))) {
        db.prepare('UPDATE customer_access_challenges SET attempts=attempts+1 WHERE id=?').run(row.id);
        throw generic();
      }
      if (!row.request_id || !row.contact_key || !row.company) {
        db.prepare('UPDATE customer_access_challenges SET attempts=max_attempts,consumed_at=? WHERE id=?').run(nowIso(), row.id);
        throw generic();
      }
      const at = nowIso();
      db.prepare('UPDATE customer_access_challenges SET consumed_at=? WHERE id=?').run(at, row.id);
      const token = randomBytes(32).toString('base64url');
      const csrfToken = randomBytes(24).toString('base64url');
      const expiresAt = new Date(Date.now() + sessionMaxMs).toISOString();
      db.prepare('INSERT INTO customer_access_sessions(token_hash,anchor_request_id,company,contact_key,channel,csrf_hash,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?)').run(
        sha(token), row.request_id, row.company, row.contact_key, row.channel, sha(csrfToken), at, at, expiresAt
      );
      db.exec('COMMIT');
      return { token, csrfToken, expiresAt, anchorRequestId: row.request_id, company: row.company, contactKey: row.contact_key, channel: row.channel };
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  function resolveSession(token) {
    const hash = sha(token);
    const row = db.prepare('SELECT * FROM customer_access_sessions WHERE token_hash=?').get(hash);
    if (!row) throw new CustomerAccessError(401, 'CUSTOMER_SESSION_REQUIRED', '고객 인증이 필요합니다.');
    const now = Date.now();
    const expires = Date.parse(row.expires_at);
    const lastSeen = Date.parse(row.last_seen_at);
    if (!Number.isFinite(expires) || now >= expires || !Number.isFinite(lastSeen) || now - lastSeen > sessionIdleMs) {
      db.prepare('DELETE FROM customer_access_sessions WHERE token_hash=?').run(hash);
      throw new CustomerAccessError(401, 'CUSTOMER_SESSION_EXPIRED', '인증 시간이 만료되었습니다. 인증번호를 다시 받아 주세요.');
    }
    db.prepare('UPDATE customer_access_sessions SET last_seen_at=? WHERE token_hash=?').run(nowIso(), hash);
    return {
      tokenHash: hash,
      anchorRequestId: row.anchor_request_id,
      company: row.company,
      contactKey: row.contact_key,
      channel: row.channel,
      csrfHash: row.csrf_hash,
      expiresAt: row.expires_at
    };
  }

  function assertCsrf(session, token) {
    if (!token || !safeEqual(session.csrfHash, sha(token))) throw new CustomerAccessError(403, 'CUSTOMER_CSRF_REQUIRED', '요청 보안정보가 만료되었습니다. 인증을 다시 진행해 주세요.');
  }
  function logout(token) { db.prepare('DELETE FROM customer_access_sessions WHERE token_hash=?').run(sha(token)); }
  function cleanup() {
    const now = nowIso();
    db.prepare('DELETE FROM customer_access_challenges WHERE expires_at<? OR consumed_at IS NOT NULL').run(now);
    db.prepare('DELETE FROM customer_access_sessions WHERE expires_at<?').run(now);
  }
  return { createChallenge, verifyChallenge, resolveSession, assertCsrf, logout, cleanup, close() { db.close(); } };
}
