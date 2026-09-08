import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export class AuthError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

const nowIso = () => new Date().toISOString();
const normalizeUsername = value => String(value || '').trim().toLowerCase();
const text = (value, max = 120) => String(value || '').trim().slice(0, max);
const tokenHash = value => createHash('sha256').update(String(value || '')).digest('hex');
const validRole = value => String(value || '').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'STAFF';

function passwordDigest(password, salt) {
  return scryptSync(String(password), salt, 64).toString('hex');
}

function assertPassword(password) {
  const value = String(password || '');
  if (value.length < 10 || value.length > 200) throw new AuthError(400, 'INVALID_PASSWORD', '비밀번호는 10자 이상이어야 합니다.');
  return value;
}

function safeEqualHex(left, right) {
  try {
    const a = Buffer.from(String(left), 'hex');
    const b = Buffer.from(String(right), 'hex');
    return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    team: row.team || '',
    agentId: row.agent_id == null ? null : Number(row.agent_id),
    role: row.role,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function createAuthStore(path = ':memory:', options = {}) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL');

  const sessionMaxMs = Number(options.sessionMaxMs || 8 * 60 * 60 * 1000);
  const sessionIdleMs = Number(options.sessionIdleMs || 30 * 60 * 1000);
  if (!Number.isFinite(sessionMaxMs) || sessionMaxMs < 5 * 60 * 1000) throw new Error('sessionMaxMs must be at least five minutes');
  if (!Number.isFinite(sessionIdleMs) || sessionIdleMs < 60 * 1000 || sessionIdleMs > sessionMaxMs) throw new Error('sessionIdleMs must be between one minute and sessionMaxMs');

  db.exec(`
    CREATE TABLE IF NOT EXISTS ops_users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      team TEXT NOT NULL DEFAULT '',
      agent_id INTEGER,
      role TEXT NOT NULL CHECK(role IN ('STAFF','ADMIN')),
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ops_users_active_role ON ops_users(active, role);

    CREATE TABLE IF NOT EXISTS ops_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES ops_users(id) ON DELETE CASCADE,
      csrf_token TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ops_sessions_user ON ops_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_ops_sessions_expires ON ops_sessions(expires_at);

    CREATE TABLE IF NOT EXISTS ops_auth_audits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ops_auth_audits_created ON ops_auth_audits(id DESC);
  `);
  const userColumns = new Set(db.prepare('PRAGMA table_info(ops_users)').all().map(row => row.name));
  if (!userColumns.has('agent_id')) db.exec('ALTER TABLE ops_users ADD COLUMN agent_id INTEGER');

  const audit = (userId, actor, action, detail = '') => {
    db.prepare('INSERT INTO ops_auth_audits(user_id,actor,action,detail,created_at) VALUES(?,?,?,?,?)')
      .run(userId || null, text(actor, 80) || 'system', text(action, 80), text(detail, 300), nowIso());
  };

  function countUsers() {
    return Number(db.prepare('SELECT COUNT(*) AS count FROM ops_users').get().count);
  }

  function countActiveAdmins(excludeId = '') {
    return Number(db.prepare(`SELECT COUNT(*) AS count FROM ops_users WHERE active=1 AND role='ADMIN' AND id<>?`).get(String(excludeId || '')).count);
  }

  function requireUser(id) {
    const row = db.prepare('SELECT * FROM ops_users WHERE id=?').get(String(id));
    if (!row) throw new AuthError(404, 'USER_NOT_FOUND', '직원 계정을 찾을 수 없습니다.');
    return row;
  }

  function insertUser(input, actor = 'system') {
    const id = text(input?.id, 80);
    const username = normalizeUsername(input?.username);
    const name = text(input?.name, 80);
    const team = text(input?.team, 80);
    const rawAgentId = input?.agentId;
    const agentId = rawAgentId === undefined || rawAgentId === null || rawAgentId === '' ? null : Number(rawAgentId);
    const role = validRole(input?.role);
    const password = assertPassword(input?.password);
    if (!/^[a-zA-Z0-9._-]{2,80}$/.test(id)) throw new AuthError(400, 'INVALID_USER_ID', '직원 계정 ID를 확인해 주세요.');
    if (!/^[a-z0-9._-]{3,80}$/.test(username)) throw new AuthError(400, 'INVALID_USERNAME', '로그인 ID를 확인해 주세요.');
    if (name.length < 2) throw new AuthError(400, 'INVALID_USER_NAME', '직원 이름을 확인해 주세요.');
    if (agentId !== null && (!Number.isInteger(agentId) || agentId < 1)) throw new AuthError(400, 'INVALID_AGENT_ID', '연결할 기사 프로필을 확인해 주세요.');
    const salt = randomBytes(16).toString('hex');
    const hash = passwordDigest(password, salt);
    const timestamp = nowIso();
    try {
      db.prepare('INSERT INTO ops_users(id,username,name,team,agent_id,role,password_salt,password_hash,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
        .run(id, username, name, team, agentId, role, salt, hash, 1, timestamp, timestamp);
    } catch (error) {
      if (String(error?.message || '').includes('UNIQUE')) throw new AuthError(409, 'USER_ALREADY_EXISTS', '이미 사용 중인 직원 ID 또는 로그인 ID입니다.');
      throw error;
    }
    audit(id, actor, 'USER_CREATE', `${username} · ${role}`);
    return rowToUser(requireUser(id));
  }

  if (countUsers() === 0 && options.bootstrapAdmin) {
    insertUser({ ...options.bootstrapAdmin, role: 'ADMIN' }, 'bootstrap');
  }

  function login(username, password) {
    const normalized = normalizeUsername(username);
    const row = db.prepare('SELECT * FROM ops_users WHERE username=?').get(normalized);
    const generic = () => new AuthError(401, 'AUTH_FAILED', '로그인 정보를 확인해 주세요.');
    if (!row || !row.active) throw generic();
    const digest = passwordDigest(String(password || ''), row.password_salt);
    if (!safeEqualHex(digest, row.password_hash)) {
      audit(row.id, row.id, 'LOGIN_FAILED', 'invalid password');
      throw generic();
    }
    const token = randomBytes(32).toString('base64url');
    const csrfToken = randomBytes(24).toString('base64url');
    const created = Date.now();
    const expiresAt = new Date(created + sessionMaxMs).toISOString();
    const timestamp = new Date(created).toISOString();
    db.prepare('INSERT INTO ops_sessions(token_hash,user_id,csrf_token,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?)')
      .run(tokenHash(token), row.id, csrfToken, timestamp, timestamp, expiresAt);
    audit(row.id, row.id, 'LOGIN', '');
    return { token, csrfToken, principal: rowToUser(row), expiresAt };
  }

  function resolveSession(token) {
    const hash = tokenHash(token);
    const row = db.prepare(`
      SELECT s.*,u.username,u.name,u.team,u.agent_id,u.role,u.active,u.created_at AS user_created_at,u.updated_at AS user_updated_at
      FROM ops_sessions s JOIN ops_users u ON u.id=s.user_id
      WHERE s.token_hash=?
    `).get(hash);
    if (!row || !row.active) {
      if (row) db.prepare('DELETE FROM ops_sessions WHERE token_hash=?').run(hash);
      throw new AuthError(401, 'SESSION_INVALID', '로그인이 필요합니다.');
    }
    const now = Date.now();
    const expiresAt = Date.parse(row.expires_at);
    const lastSeen = Date.parse(row.last_seen_at);
    if (!Number.isFinite(expiresAt) || now >= expiresAt || !Number.isFinite(lastSeen) || now - lastSeen > sessionIdleMs) {
      db.prepare('DELETE FROM ops_sessions WHERE token_hash=?').run(hash);
      audit(row.user_id, row.user_id, 'SESSION_EXPIRED', '');
      throw new AuthError(401, 'SESSION_EXPIRED', '로그인 시간이 만료되었습니다.');
    }
    const seenAt = new Date(now).toISOString();
    db.prepare('UPDATE ops_sessions SET last_seen_at=? WHERE token_hash=?').run(seenAt, hash);
    return {
      principal: {
        id: row.user_id,
        username: row.username,
        name: row.name,
        team: row.team || '',
        agentId: row.agent_id == null ? null : Number(row.agent_id),
        role: row.role,
        active: true,
        createdAt: row.user_created_at,
        updatedAt: row.user_updated_at
      },
      csrfToken: row.csrf_token,
      expiresAt: row.expires_at
    };
  }

  function logout(token, actor = '') {
    const hash = tokenHash(token);
    const row = db.prepare('SELECT user_id FROM ops_sessions WHERE token_hash=?').get(hash);
    db.prepare('DELETE FROM ops_sessions WHERE token_hash=?').run(hash);
    if (row) audit(row.user_id, actor || row.user_id, 'LOGOUT', '');
  }

  function listUsers() {
    return db.prepare('SELECT * FROM ops_users ORDER BY active DESC, role DESC, name, id').all().map(rowToUser);
  }

  function createUser(input, actor) {
    return insertUser(input, actor);
  }

  function updateUser(id, input, actor) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const row = requireUser(id);
      const name = input?.name === undefined ? row.name : text(input.name, 80);
      const team = input?.team === undefined ? row.team : text(input.team, 80);
      const rawAgentId = input?.agentId === undefined ? row.agent_id : input.agentId;
      const agentId = rawAgentId === undefined || rawAgentId === null || rawAgentId === '' ? null : Number(rawAgentId);
      const role = input?.role === undefined ? row.role : validRole(input.role);
      const active = input?.active === undefined ? Boolean(row.active) : Boolean(input.active);
      if (name.length < 2) throw new AuthError(400, 'INVALID_USER_NAME', '직원 이름을 확인해 주세요.');
      if (agentId !== null && (!Number.isInteger(agentId) || agentId < 1)) throw new AuthError(400, 'INVALID_AGENT_ID', '연결할 기사 프로필을 확인해 주세요.');
      if (row.active && row.role === 'ADMIN' && (!active || role !== 'ADMIN') && countActiveAdmins(row.id) === 0) {
        throw new AuthError(409, 'LAST_ADMIN_REQUIRED', '마지막 운영 관리자 계정은 비활성화하거나 권한을 낮출 수 없습니다.');
      }
      const timestamp = nowIso();
      db.prepare('UPDATE ops_users SET name=?,team=?,agent_id=?,role=?,active=?,updated_at=? WHERE id=?')
        .run(name, team, agentId, role, active ? 1 : 0, timestamp, row.id);
      if (!active) db.prepare('DELETE FROM ops_sessions WHERE user_id=?').run(row.id);
      audit(row.id, actor, 'USER_UPDATE', `${role} · ${active ? 'active' : 'disabled'}`);
      db.exec('COMMIT');
      return rowToUser(requireUser(id));
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  function resetPassword(id, password, actor) {
    const row = requireUser(id);
    const value = assertPassword(password);
    const salt = randomBytes(16).toString('hex');
    const hash = passwordDigest(value, salt);
    const timestamp = nowIso();
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('UPDATE ops_users SET password_salt=?,password_hash=?,updated_at=? WHERE id=?').run(salt, hash, timestamp, row.id);
      db.prepare('DELETE FROM ops_sessions WHERE user_id=?').run(row.id);
      audit(row.id, actor, 'PASSWORD_RESET', '');
      db.exec('COMMIT');
      return rowToUser(requireUser(id));
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  function authAudits(limit = 100) {
    const safeLimit = Math.min(500, Math.max(1, Number(limit) || 100));
    return db.prepare('SELECT * FROM ops_auth_audits ORDER BY id DESC LIMIT ?').all(safeLimit).map(row => ({
      id: Number(row.id),
      userId: row.user_id || null,
      actor: row.actor,
      action: row.action,
      detail: row.detail,
      createdAt: row.created_at
    }));
  }

  function cleanupSessions() {
    const now = nowIso();
    return db.prepare('DELETE FROM ops_sessions WHERE expires_at<=?').run(now).changes;
  }

  return {
    countUsers,
    login,
    resolveSession,
    logout,
    listUsers,
    createUser,
    updateUser,
    resetPassword,
    authAudits,
    cleanupSessions,
    close() { db.close(); }
  };
}
