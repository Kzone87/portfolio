import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import {
  decryptSecret,
  encryptSecret,
  hashPassword,
  randomToken,
  sha256,
  verifyPassword,
  verifyWebhookSignature
} from './security.mjs';

export const ROLE_CAPABILITIES = Object.freeze({
  OPERATOR: [
    'work.read','orders.read','orders.create','orders.fulfill','refunds.create',
    'documents.read','documents.write','documents.submit',
    'support.read','support.create','support.generate','integrations.read'
  ],
  REVIEWER: [
    'work.read','orders.read','documents.read','documents.review',
    'support.read','support.review','integrations.read'
  ],
  MANAGER: [
    'work.read','orders.read','orders.create','orders.fulfill','refunds.create','refunds.approve',
    'documents.read','documents.write','documents.submit','documents.review',
    'support.read','support.create','support.generate','support.review',
    'integrations.read','integrations.manage','integrations.retry','audit.read'
  ],
  ADMIN: ['*']
});

const ROLES = new Set(Object.keys(ROLE_CAPABILITIES));
const ORDER_TRANSITIONS = Object.freeze({
  NEW: ['PICKING','CANCELLED'],
  PICKING: ['SHIPPED','CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: []
});
const DOCUMENT_TRANSITIONS = Object.freeze({
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['APPROVED','NEEDS_CHANGES','REJECTED'],
  NEEDS_CHANGES: ['SUBMITTED'],
  APPROVED: ['ARCHIVED'],
  REJECTED: [],
  ARCHIVED: []
});

export class CommercialError extends Error {
  constructor(status, code, message = code) {
    super(message);
    this.name = 'CommercialError';
    this.status = status;
    this.code = code;
  }
}

function cleanText(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}
function normalizeEmail(value) {
  const email = cleanText(value, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new CommercialError(400,'INVALID_EMAIL');
  return email;
}
function safeJson(value, fallback = null) {
  try { return JSON.parse(value); } catch { return fallback; }
}
function toJson(value) { return JSON.stringify(value ?? null); }
function iso(ms = Date.now()) { return new Date(ms).toISOString(); }
function roleCaps(role) { return ROLE_CAPABILITIES[role] ?? []; }
export function hasCommercialCapability(role, capability) {
  const caps = roleCaps(role);
  return caps.includes('*') || caps.includes(capability);
}
function assertCapability(user, capability) {
  if (!hasCommercialCapability(user.role, capability)) throw new CommercialError(403,'FORBIDDEN');
}
function assertExpectedVersion(value) {
  const version = Number(value);
  if (!Number.isInteger(version) || version < 1) throw new CommercialError(400,'EXPECTED_VERSION_REQUIRED');
  return version;
}
function assertDecisionNote(value) {
  const note = cleanText(value, 500);
  if (note.length < 4) throw new CommercialError(400,'DECISION_NOTE_REQUIRED');
  return note;
}
function tokenize(text) {
  return [...new Set(cleanText(text, 8000).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 2))];
}

export function createCommercialStore({
  dbPath = ':memory:',
  secretKey,
  now = () => Date.now(),
  sessionTtlSeconds = 28_800,
  loginWindowSeconds = 900,
  loginMaxAttempts = 5
} = {}) {
  if (!secretKey) throw new Error('MONO_SECRET_KEY_REQUIRED');
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA synchronous=NORMAL;');
  if (dbPath !== ':memory:') db.exec('PRAGMA journal_mode=WAL;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_meta(version INTEGER NOT NULL);
    INSERT INTO schema_meta(version) SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM schema_meta);

    CREATE TABLE IF NOT EXISTS users(
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions(
      id_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      csrf_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE TABLE IF NOT EXISTS auth_rate_limits(
      key TEXT PRIMARY KEY,
      attempts INTEGER NOT NULL,
      window_start INTEGER NOT NULL,
      blocked_until INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS audits(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id TEXT,
      module TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      detail TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audits_created ON audits(id DESC);

    CREATE TABLE IF NOT EXISTS work_items(
      id TEXT PRIMARY KEY,
      module TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL DEFAULT '',
      priority TEXT NOT NULL DEFAULT 'MEDIUM',
      capability TEXT NOT NULL,
      status TEXT NOT NULL,
      owner TEXT NOT NULL DEFAULT '',
      next_action TEXT NOT NULL DEFAULT '',
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders(
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      total_cents INTEGER NOT NULL,
      status TEXT NOT NULL,
      owner_id TEXT REFERENCES users(id),
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS refunds(
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id),
      amount_cents INTEGER NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL,
      decision_note TEXT,
      created_by TEXT NOT NULL REFERENCES users(id),
      reviewed_by TEXT REFERENCES users(id),
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documents(
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      source_text TEXT NOT NULL DEFAULT '',
      fields_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL,
      owner_id TEXT NOT NULL REFERENCES users(id),
      review_note TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS knowledge_docs(
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      allowed_roles_json TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS support_tasks(
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL REFERENCES users(id),
      output_json TEXT,
      evaluation_json TEXT,
      evidence_json TEXT,
      provider_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS support_runs(
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES support_tasks(id),
      task_version INTEGER NOT NULL,
      provider_id TEXT NOT NULL,
      status TEXT NOT NULL,
      output_json TEXT,
      evidence_json TEXT NOT NULL,
      error_code TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS support_reviews(
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES support_tasks(id),
      decision TEXT NOT NULL,
      note TEXT NOT NULL,
      reviewer_id TEXT NOT NULL REFERENCES users(id),
      task_version INTEGER NOT NULL,
      evidence_json TEXT NOT NULL,
      output_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS integration_connections(
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      state TEXT NOT NULL,
      endpoint_url TEXT,
      secret_cipher TEXT NOT NULL,
      secret_iv TEXT NOT NULL,
      secret_tag TEXT NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS integration_jobs(
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      source_connection_id TEXT NOT NULL REFERENCES integration_connections(id),
      target_connection_id TEXT NOT NULL REFERENCES integration_connections(id),
      event_type TEXT NOT NULL,
      status TEXT NOT NULL,
      max_retries INTEGER NOT NULL DEFAULT 3,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS integration_events(
      id TEXT PRIMARY KEY,
      connection_id TEXT NOT NULL REFERENCES integration_connections(id),
      event_id TEXT NOT NULL,
      type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      status TEXT NOT NULL,
      run_id TEXT,
      received_at TEXT NOT NULL,
      UNIQUE(connection_id,event_id)
    );
    CREATE TABLE IF NOT EXISTS integration_runs(
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES integration_jobs(id),
      event_row_id TEXT NOT NULL REFERENCES integration_events(id),
      result TEXT NOT NULL,
      attempt INTEGER NOT NULL,
      retry_of TEXT,
      detail TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      finished_at TEXT
    );
    CREATE TABLE IF NOT EXISTS integration_queue(
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL UNIQUE REFERENCES integration_runs(id),
      available_at INTEGER NOT NULL,
      status TEXT NOT NULL,
      leased_until INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_integration_queue_due ON integration_queue(status,available_at);
    CREATE TABLE IF NOT EXISTS integration_dead_letters(
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES integration_runs(id),
      job_id TEXT NOT NULL REFERENCES integration_jobs(id),
      event_row_id TEXT NOT NULL REFERENCES integration_events(id),
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );
  `);

  function currentIso() { return iso(now()); }
  function audit(actorId, module, entityId, action, detail) {
    db.prepare('INSERT INTO audits(actor_id,module,entity_id,action,detail,created_at) VALUES(?,?,?,?,?,?)')
      .run(actorId ?? null, module, entityId, action, cleanText(detail,1000), currentIso());
  }
  function requireUser(id) {
    const user = db.prepare('SELECT id,email,name,role,active FROM users WHERE id=?').get(id);
    if (!user || !user.active) throw new CommercialError(401,'UNAUTHORIZED');
    return user;
  }
  function actor(id, capability = null) {
    const user = requireUser(id);
    if (capability) assertCapability(user, capability);
    return user;
  }
  function rowOr404(sql, id, code) {
    const row = db.prepare(sql).get(id);
    if (!row) throw new CommercialError(404,code);
    return row;
  }
  function guardedUpdate(sql, params, code = 'STALE_VERSION') {
    const result = db.prepare(sql).run(...params);
    if (result.changes !== 1) throw new CommercialError(409,code);
  }

  function createUser({ email, name, role, password, actorId = null }) {
    const normalizedEmail = normalizeEmail(email);
    const normalizedRole = cleanText(role,20).toUpperCase();
    if (!ROLES.has(normalizedRole)) throw new CommercialError(400,'INVALID_ROLE');
    const normalizedName = cleanText(name,80);
    if (normalizedName.length < 2) throw new CommercialError(400,'INVALID_NAME');
    if (actorId) actor(actorId,'users.manage');
    const { salt, hash } = hashPassword(password);
    const id = `usr-${randomUUID()}`;
    const at = currentIso();
    try {
      db.prepare('INSERT INTO users(id,email,name,role,password_salt,password_hash,active,created_at,updated_at) VALUES(?,?,?,?,?,?,1,?,?)')
        .run(id,normalizedEmail,normalizedName,normalizedRole,salt,hash,at,at);
    } catch (error) {
      if (String(error.message).includes('UNIQUE')) throw new CommercialError(409,'EMAIL_EXISTS');
      throw error;
    }
    audit(actorId,'ADMIN',id,'USER_CREATED',`${normalizedEmail} ${normalizedRole}`);
    return requireUser(id);
  }

  function ensureBootstrapAdmin({ email, name = 'MONO Administrator', password }) {
    const count = Number(db.prepare('SELECT COUNT(*) c FROM users').get().c);
    if (count > 0) return { created:false };
    const user = createUser({email,name,role:'ADMIN',password});
    return { created:true,user };
  }

  function listUsers(actorId) {
    actor(actorId,'users.manage');
    return db.prepare('SELECT id,email,name,role,active,created_at,updated_at FROM users ORDER BY created_at').all();
  }
  function setUserActive(actorId, userId, active, expectedSelfGuard = true) {
    const admin = actor(actorId,'users.manage');
    const target = requireUser(userId);
    if (expectedSelfGuard && admin.id === target.id && !active) throw new CommercialError(409,'CANNOT_DISABLE_SELF');
    guardedUpdate('UPDATE users SET active=?,updated_at=? WHERE id=?',[active?1:0,currentIso(),userId],'USER_NOT_FOUND');
    if (!active) db.prepare('DELETE FROM sessions WHERE user_id=?').run(userId);
    audit(actorId,'ADMIN',userId,active?'USER_ENABLED':'USER_DISABLED',target.email);
    return db.prepare('SELECT id,email,name,role,active FROM users WHERE id=?').get(userId);
  }

  function rateKey(email, ip) { return `${email}|${cleanText(ip,80)}`; }
  function assertLoginAllowed(key) {
    const row = db.prepare('SELECT * FROM auth_rate_limits WHERE key=?').get(key);
    const timestamp = now();
    if (row?.blocked_until > timestamp) throw new CommercialError(429,'LOGIN_RATE_LIMITED');
  }
  function recordLoginFailure(key) {
    const timestamp = now();
    const windowMs = loginWindowSeconds * 1000;
    const row = db.prepare('SELECT * FROM auth_rate_limits WHERE key=?').get(key);
    let attempts = 1;
    let windowStart = timestamp;
    if (row && timestamp - row.window_start <= windowMs) {
      attempts = row.attempts + 1;
      windowStart = row.window_start;
    }
    const blockedUntil = attempts >= loginMaxAttempts ? timestamp + windowMs : 0;
    db.prepare(`INSERT INTO auth_rate_limits(key,attempts,window_start,blocked_until) VALUES(?,?,?,?)
      ON CONFLICT(key) DO UPDATE SET attempts=excluded.attempts,window_start=excluded.window_start,blocked_until=excluded.blocked_until`)
      .run(key,attempts,windowStart,blockedUntil);
  }
  function login({ email, password, ip = '' }) {
    const normalizedEmail = normalizeEmail(email);
    const key = rateKey(normalizedEmail,ip);
    assertLoginAllowed(key);
    const row = db.prepare('SELECT * FROM users WHERE email=?').get(normalizedEmail);
    if (!row || !row.active || !verifyPassword(password,row.password_salt,row.password_hash)) {
      recordLoginFailure(key);
      throw new CommercialError(401,'INVALID_CREDENTIALS');
    }
    db.prepare('DELETE FROM auth_rate_limits WHERE key=?').run(key);
    const token = randomToken();
    const csrf = randomToken(24);
    const at = currentIso();
    const expiresAt = now() + sessionTtlSeconds * 1000;
    db.prepare('INSERT INTO sessions(id_hash,user_id,csrf_hash,expires_at,created_at,last_seen_at) VALUES(?,?,?,?,?,?)')
      .run(sha256(token),row.id,sha256(csrf),expiresAt,at,at);
    audit(row.id,'AUTH',row.id,'LOGIN','Session created');
    return { token, csrf, expiresAt, user:{id:row.id,email:row.email,name:row.name,role:row.role} };
  }
  function authenticate(token) {
    const hash = sha256(token ?? '');
    const row = db.prepare(`SELECT s.id_hash,s.csrf_hash,s.expires_at,u.id,u.email,u.name,u.role,u.active
      FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id_hash=?`).get(hash);
    if (!row || !row.active || row.expires_at <= now()) {
      if (row) db.prepare('DELETE FROM sessions WHERE id_hash=?').run(hash);
      throw new CommercialError(401,'UNAUTHORIZED');
    }
    db.prepare('UPDATE sessions SET last_seen_at=? WHERE id_hash=?').run(currentIso(),hash);
    return { sessionHash:hash, csrfHash:row.csrf_hash, user:{id:row.id,email:row.email,name:row.name,role:row.role} };
  }
  function assertCsrf(sessionHash, csrfToken) {
    const row = db.prepare('SELECT csrf_hash FROM sessions WHERE id_hash=?').get(sessionHash);
    if (!row || sha256(csrfToken ?? '') !== row.csrf_hash) throw new CommercialError(403,'CSRF_INVALID');
  }
  function logout(token, actorId = null) {
    db.prepare('DELETE FROM sessions WHERE id_hash=?').run(sha256(token ?? ''));
    if (actorId) audit(actorId,'AUTH',actorId,'LOGOUT','Session revoked');
  }
  function purgeExpiredSessions() {
    return db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(now()).changes;
  }

  function listAudit(actorId, limit = 100) {
    actor(actorId,'audit.read');
    const safeLimit = Math.max(1,Math.min(500,Number(limit)||100));
    return db.prepare('SELECT * FROM audits ORDER BY id DESC LIMIT ?').all(safeLimit);
  }

  function listWorkItems(actorId) {
    const user = actor(actorId,'work.read');
    return db.prepare('SELECT * FROM work_items ORDER BY CASE priority WHEN \'HIGH\' THEN 0 WHEN \'MEDIUM\' THEN 1 ELSE 2 END,updated_at DESC').all()
      .map((row)=>({...row,canAct:hasCommercialCapability(user.role,row.capability)}));
  }
  function createWorkItem({id=`W-${randomUUID()}`,module,title,subtitle='',priority='MEDIUM',capability,status='대기',owner='',nextAction=''}) {
    const at=currentIso();
    db.prepare('INSERT OR REPLACE INTO work_items(id,module,title,subtitle,priority,capability,status,owner,next_action,version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,1,?,?)')
      .run(id,cleanText(module,30),cleanText(title,160),cleanText(subtitle,240),cleanText(priority,20),cleanText(capability,80),cleanText(status,40),cleanText(owner,100),cleanText(nextAction,500),at,at);
    return id;
  }
  function acknowledgeWorkItem(actorId,id,expectedVersion){
    const user=actor(actorId,'work.read');
    const row=rowOr404('SELECT * FROM work_items WHERE id=?',id,'WORK_NOT_FOUND');
    const version=assertExpectedVersion(expectedVersion);
    if(row.version!==version) throw new CommercialError(409,'STALE_WORK_ITEM');
    assertCapability(user,row.capability);
    guardedUpdate("UPDATE work_items SET status='확인 완료',version=version+1,updated_at=? WHERE id=? AND version=?",[currentIso(),id,version],'STALE_WORK_ITEM');
    audit(actorId,row.module,id,'ACKNOWLEDGE',row.title);
    return rowOr404('SELECT * FROM work_items WHERE id=?',id,'WORK_NOT_FOUND');
  }

  function createOrder(actorId,input={}){
    actor(actorId,'orders.create');
    const customer=cleanText(input.customerName,120); const total=Number(input.totalCents);
    if(customer.length<2||!Number.isInteger(total)||total<=0) throw new CommercialError(400,'INVALID_ORDER');
    const id=cleanText(input.id,80)||`ORD-${randomUUID()}`; const at=currentIso();
    try{db.prepare('INSERT INTO orders(id,customer_name,total_cents,status,owner_id,version,created_at,updated_at) VALUES(?,?,?,\'NEW\',?,1,?,?)').run(id,customer,total,actorId,at,at)}
    catch(error){if(String(error.message).includes('UNIQUE'))throw new CommercialError(409,'ORDER_EXISTS');throw error}
    audit(actorId,'MARKET',id,'ORDER_CREATED',`${customer} ${total}`);
    createWorkItem({id:`WORK-${id}`,module:'MARKET',title:`신규 주문 ${id}`,subtitle:customer,capability:'orders.fulfill',status:'처리 대기',owner:'주문 운영',nextAction:'주문 내용을 확인하고 출고 상태를 진행합니다.'});
    return getOrder(actorId,id);
  }
  function getOrder(actorId,id){actor(actorId,'orders.read');return rowOr404('SELECT * FROM orders WHERE id=?',id,'ORDER_NOT_FOUND')}
  function listOrders(actorId){actor(actorId,'orders.read');return db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all()}
  function transitionOrder(actorId,id,nextStatus,expectedVersion){
    actor(actorId,'orders.fulfill'); const row=getOrder(actorId,id); const version=assertExpectedVersion(expectedVersion); const next=cleanText(nextStatus,20).toUpperCase();
    if(row.version!==version) throw new CommercialError(409,'STALE_ORDER');
    if(!(ORDER_TRANSITIONS[row.status]??[]).includes(next)) throw new CommercialError(409,'INVALID_ORDER_TRANSITION');
    guardedUpdate('UPDATE orders SET status=?,version=version+1,updated_at=? WHERE id=? AND version=?',[next,currentIso(),id,version],'STALE_ORDER');
    audit(actorId,'MARKET',id,'ORDER_STATUS',`${row.status} -> ${next}`);
    return getOrder(actorId,id);
  }
  function createRefund(actorId,orderId,input={}){
    actor(actorId,'refunds.create'); const order=getOrder(actorId,orderId); const amount=Number(input.amountCents); const reason=cleanText(input.reason,500);
    if(!Number.isInteger(amount)||amount<=0||amount>order.total_cents||reason.length<4) throw new CommercialError(400,'INVALID_REFUND');
    const id=`REF-${randomUUID()}`,at=currentIso();
    db.prepare("INSERT INTO refunds(id,order_id,amount_cents,reason,status,created_by,version,created_at,updated_at) VALUES(?,?,?,?, 'REQUESTED',?,1,?,?)").run(id,orderId,amount,reason,actorId,at,at);
    audit(actorId,'MARKET',id,'REFUND_REQUESTED',reason);
    createWorkItem({id:`WORK-${id}`,module:'MARKET',title:`환불 승인 ${id}`,subtitle:`${orderId} · ${amount}`,priority:'HIGH',capability:'refunds.approve',status:'승인 대기',owner:'운영 관리자',nextAction:'환불 사유와 결제 금액을 검토하고 승인 또는 반려합니다.'});
    return getRefund(actorId,id);
  }
  function getRefund(actorId,id){actor(actorId,'orders.read');return rowOr404('SELECT * FROM refunds WHERE id=?',id,'REFUND_NOT_FOUND')}
  function decideRefund(actorId,id,{decision,note,expectedVersion}={}){
    actor(actorId,'refunds.approve'); const row=getRefund(actorId,id); const version=assertExpectedVersion(expectedVersion); if(row.version!==version)throw new CommercialError(409,'STALE_REFUND');
    if(row.status!=='REQUESTED')throw new CommercialError(409,'REFUND_FINALIZED'); const next=cleanText(decision,20).toUpperCase(); if(!['APPROVED','REJECTED'].includes(next))throw new CommercialError(400,'INVALID_REFUND_DECISION'); const normalizedNote=assertDecisionNote(note);
    guardedUpdate('UPDATE refunds SET status=?,decision_note=?,reviewed_by=?,version=version+1,updated_at=? WHERE id=? AND version=?',[next,normalizedNote,actorId,currentIso(),id,version],'STALE_REFUND');
    audit(actorId,'MARKET',id,'REFUND_DECISION',`${next}: ${normalizedNote}`); return getRefund(actorId,id);
  }

  function createDocument(actorId,input={}){
    actor(actorId,'documents.write'); const title=cleanText(input.title,160),type=cleanText(input.type,40).toUpperCase(),source=cleanText(input.sourceText,20000);
    if(title.length<2||!['INVOICE','APPLICATION','CONTRACT','OTHER'].includes(type))throw new CommercialError(400,'INVALID_DOCUMENT');
    const id=`DOC-${randomUUID()}`,at=currentIso(); db.prepare("INSERT INTO documents(id,title,type,source_text,fields_json,status,owner_id,version,created_at,updated_at) VALUES(?,?,?,?,?,'DRAFT',?,1,?,?)").run(id,title,type,source,toJson(input.fields??{}),actorId,at,at);
    audit(actorId,'OFFICE',id,'DOCUMENT_CREATED',title); return getDocument(actorId,id);
  }
  function getDocument(actorId,id){actor(actorId,'documents.read');const row=rowOr404('SELECT * FROM documents WHERE id=?',id,'DOCUMENT_NOT_FOUND');return {...row,fields:safeJson(row.fields_json,{})}}
  function listDocuments(actorId){actor(actorId,'documents.read');return db.prepare('SELECT * FROM documents ORDER BY created_at DESC').all().map(r=>({...r,fields:safeJson(r.fields_json,{})}))}
  function updateDocument(actorId,id,{title,sourceText,fields,expectedVersion}={}){
    const user=actor(actorId,'documents.write'); const row=getDocument(actorId,id); if(row.owner_id!==user.id&&user.role!=='ADMIN'&&user.role!=='MANAGER')throw new CommercialError(403,'DOCUMENT_OWNER_REQUIRED');
    const version=assertExpectedVersion(expectedVersion); if(row.version!==version)throw new CommercialError(409,'STALE_DOCUMENT'); if(!['DRAFT','NEEDS_CHANGES'].includes(row.status))throw new CommercialError(409,'DOCUMENT_NOT_EDITABLE');
    const nextTitle=title===undefined?row.title:cleanText(title,160); if(nextTitle.length<2)throw new CommercialError(400,'INVALID_DOCUMENT');
    guardedUpdate('UPDATE documents SET title=?,source_text=?,fields_json=?,version=version+1,updated_at=? WHERE id=? AND version=?',[nextTitle,sourceText===undefined?row.source_text:cleanText(sourceText,20000),fields===undefined?row.fields_json:toJson(fields),currentIso(),id,version],'STALE_DOCUMENT');
    audit(actorId,'OFFICE',id,'DOCUMENT_UPDATED',nextTitle); return getDocument(actorId,id);
  }
  function submitDocument(actorId,id,expectedVersion){actor(actorId,'documents.submit');const row=getDocument(actorId,id);const version=assertExpectedVersion(expectedVersion);if(row.version!==version)throw new CommercialError(409,'STALE_DOCUMENT');if(!DOCUMENT_TRANSITIONS[row.status]?.includes('SUBMITTED'))throw new CommercialError(409,'INVALID_DOCUMENT_TRANSITION');guardedUpdate("UPDATE documents SET status='SUBMITTED',version=version+1,updated_at=? WHERE id=? AND version=?",[currentIso(),id,version],'STALE_DOCUMENT');audit(actorId,'OFFICE',id,'DOCUMENT_SUBMITTED',row.title);createWorkItem({id:`WORK-${id}`,module:'OFFICE',title:`문서 검수 ${row.title}`,subtitle:id,capability:'documents.review',status:'검수 대기',owner:'검수 담당자',nextAction:'원문과 입력값을 대조하고 승인, 수정요청 또는 반려합니다.'});return getDocument(actorId,id)}
  function reviewDocument(actorId,id,{decision,note,expectedVersion}={}){actor(actorId,'documents.review');const row=getDocument(actorId,id);const version=assertExpectedVersion(expectedVersion);if(row.version!==version)throw new CommercialError(409,'STALE_DOCUMENT');if(row.status!=='SUBMITTED')throw new CommercialError(409,'INVALID_DOCUMENT_TRANSITION');const map={APPROVE:'APPROVED',NEEDS_CHANGES:'NEEDS_CHANGES',REJECT:'REJECTED'};const next=map[cleanText(decision,30).toUpperCase()];if(!next)throw new CommercialError(400,'INVALID_DOCUMENT_DECISION');const normalizedNote=assertDecisionNote(note);guardedUpdate('UPDATE documents SET status=?,review_note=?,version=version+1,updated_at=? WHERE id=? AND version=?',[next,normalizedNote,currentIso(),id,version],'STALE_DOCUMENT');audit(actorId,'OFFICE',id,'DOCUMENT_REVIEW',`${next}: ${normalizedNote}`);return getDocument(actorId,id)}
  function archiveDocument(actorId,id,expectedVersion){actor(actorId,'documents.archive');const row=getDocument(actorId,id);const version=assertExpectedVersion(expectedVersion);if(row.version!==version)throw new CommercialError(409,'STALE_DOCUMENT');if(row.status!=='APPROVED')throw new CommercialError(409,'INVALID_DOCUMENT_TRANSITION');guardedUpdate("UPDATE documents SET status='ARCHIVED',version=version+1,updated_at=? WHERE id=? AND version=?",[currentIso(),id,version],'STALE_DOCUMENT');audit(actorId,'OFFICE',id,'DOCUMENT_ARCHIVED',row.title);return getDocument(actorId,id)}

  function createKnowledgeDoc(actorId,input={}){actor(actorId,'knowledge.manage');const title=cleanText(input.title,160),body=cleanText(input.body,30000);const roles=(Array.isArray(input.allowedRoles)?input.allowedRoles:[]).map(v=>cleanText(v,20).toUpperCase()).filter(v=>ROLES.has(v));if(title.length<2||body.length<10||!roles.length)throw new CommercialError(400,'INVALID_KNOWLEDGE_DOC');const id=`KB-${randomUUID()}`,at=currentIso();db.prepare('INSERT INTO knowledge_docs(id,title,body,allowed_roles_json,version,created_at,updated_at) VALUES(?,?,?,?,1,?,?)').run(id,title,body,toJson([...new Set(roles)]),at,at);audit(actorId,'SUPPORT',id,'KNOWLEDGE_CREATED',title);return db.prepare('SELECT id,title,allowed_roles_json,version,created_at,updated_at FROM knowledge_docs WHERE id=?').get(id)}
  function listKnowledge(actorId){const user=actor(actorId,'support.read');return db.prepare('SELECT * FROM knowledge_docs ORDER BY updated_at DESC').all().filter(row=>safeJson(row.allowed_roles_json,[]).includes(user.role)||user.role==='ADMIN').map(row=>({...row,allowedRoles:safeJson(row.allowed_roles_json,[])}))}
  function retrieveKnowledge(actorId,query,limit=3){const docs=listKnowledge(actorId),terms=tokenize(query);const ranked=docs.map(doc=>{const hay=cleanText(`${doc.title} ${doc.body}`,40000).toLowerCase();const matches=terms.filter(t=>hay.includes(t));return {...doc,score:matches.length,matchedTerms:matches}}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,Math.max(1,Math.min(5,Number(limit)||3)));return ranked.map(({body,...row})=>({...row,excerpt:body.slice(0,1200)}))}
  function createSupportTask(actorId,input={}){actor(actorId,'support.create');const title=cleanText(input.title,160),content=cleanText(input.content,8000);if(title.length<2||content.length<5)throw new CommercialError(400,'INVALID_SUPPORT_TASK');const id=`SUP-${randomUUID()}`,at=currentIso();db.prepare("INSERT INTO support_tasks(id,title,content,status,version,created_by,created_at,updated_at) VALUES(?,?,?,'PENDING',1,?,?,?)").run(id,title,content,actorId,at,at);audit(actorId,'SUPPORT',id,'TASK_CREATED',title);return getSupportTask(actorId,id)}
  function getSupportTask(actorId,id){actor(actorId,'support.read');const r=rowOr404('SELECT * FROM support_tasks WHERE id=?',id,'SUPPORT_TASK_NOT_FOUND');return {...r,output:safeJson(r.output_json),evaluation:safeJson(r.evaluation_json),evidence:safeJson(r.evidence_json,[])}}
  function listSupportTasks(actorId){actor(actorId,'support.read');return db.prepare('SELECT * FROM support_tasks ORDER BY created_at DESC').all().map(r=>({...r,output:safeJson(r.output_json),evaluation:safeJson(r.evaluation_json),evidence:safeJson(r.evidence_json,[])}))}
  function supportGenerationContext(actorId,id,expectedVersion){actor(actorId,'support.generate');const task=getSupportTask(actorId,id);const version=assertExpectedVersion(expectedVersion);if(task.version!==version)throw new CommercialError(409,'STALE_SUPPORT_TASK');if(['APPROVED','REJECTED'].includes(task.status))throw new CommercialError(409,'SUPPORT_TASK_FINALIZED');const evidence=retrieveKnowledge(actorId,`${task.title} ${task.content}`,3);return {task,evidence}}
  function recordSupportGeneration(actorId,id,{expectedVersion,providerId,output,evaluation,evidence,errorCode=null}={}){actor(actorId,'support.generate');const task=getSupportTask(actorId,id);const version=assertExpectedVersion(expectedVersion);if(task.version!==version)throw new CommercialError(409,'STALE_SUPPORT_TASK');const success=!errorCode&&output&&typeof output==='object';const runId=`RUN-${randomUUID()}`,at=currentIso();db.prepare('INSERT INTO support_runs(id,task_id,task_version,provider_id,status,output_json,evidence_json,error_code,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(runId,id,version,cleanText(providerId,120),success?'SUCCESS':'FAILED',success?toJson(output):null,toJson(evidence??[]),errorCode?cleanText(errorCode,120):null,at);guardedUpdate('UPDATE support_tasks SET status=?,output_json=?,evaluation_json=?,evidence_json=?,provider_id=?,version=version+1,updated_at=? WHERE id=? AND version=?',[success?'NEEDS_REVIEW':'PENDING',success?toJson(output):null,toJson(evaluation??null),toJson(evidence??[]),cleanText(providerId,120),at,id,version],'STALE_SUPPORT_TASK');audit(actorId,'SUPPORT',id,success?'AI_DRAFT_CREATED':'AI_GENERATION_FAILED',`${providerId}${errorCode?` ${errorCode}`:''}`);if(success)createWorkItem({id:`WORK-${id}`,module:'SUPPORT',title:`AI 답변 검토 ${task.title}`,subtitle:id,capability:'support.review',status:'사람 검토 필요',owner:'고객지원 검수자',nextAction:'근거자료와 AI 제안을 확인하고 수정 후 승인 또는 반려합니다.'});return {task:getSupportTask(actorId,id),run:db.prepare('SELECT * FROM support_runs WHERE id=?').get(runId)}}
  function reviewSupportTask(actorId,id,{decision,note,expectedVersion,editedOutput}={}){actor(actorId,'support.review');const task=getSupportTask(actorId,id);const version=assertExpectedVersion(expectedVersion);if(task.version!==version)throw new CommercialError(409,'STALE_SUPPORT_TASK');if(task.status!=='NEEDS_REVIEW')throw new CommercialError(409,'INVALID_SUPPORT_REVIEW_STATE');const normalized=cleanText(decision,20).toUpperCase();if(!['APPROVE','REJECT'].includes(normalized))throw new CommercialError(400,'INVALID_SUPPORT_DECISION');const normalizedNote=assertDecisionNote(note);const finalOutput=editedOutput&&typeof editedOutput==='object'?editedOutput:task.output;const next=normalized==='APPROVE'?'APPROVED':'REJECTED',reviewId=`REV-${randomUUID()}`,at=currentIso();db.prepare('INSERT INTO support_reviews(id,task_id,decision,note,reviewer_id,task_version,evidence_json,output_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(reviewId,id,normalized,normalizedNote,actorId,version,toJson(task.evidence??[]),toJson(finalOutput),at);guardedUpdate('UPDATE support_tasks SET status=?,output_json=?,version=version+1,updated_at=? WHERE id=? AND version=?',[next,toJson(finalOutput),at,id,version],'STALE_SUPPORT_TASK');audit(actorId,'SUPPORT',id,'HUMAN_REVIEW',`${normalized}: ${normalizedNote}`);return {task:getSupportTask(actorId,id),review:db.prepare('SELECT * FROM support_reviews WHERE id=?').get(reviewId)}}

  function createIntegrationConnection(actorId,input={}){actor(actorId,'integrations.manage');const id=cleanText(input.id,80)||`CON-${randomUUID()}`,name=cleanText(input.name,120),kind=cleanText(input.kind,20).toUpperCase(),state=cleanText(input.state||'ACTIVE',20).toUpperCase(),endpointUrl=cleanText(input.endpointUrl,1000)||null,secret=String(input.secret??'');if(name.length<2||!['INBOUND_WEBHOOK','OUTBOUND_HTTP'].includes(kind)||!['ACTIVE','PAUSED'].includes(state)||secret.length<16)throw new CommercialError(400,'INVALID_CONNECTION');if(kind==='OUTBOUND_HTTP'&&!endpointUrl)throw new CommercialError(400,'ENDPOINT_REQUIRED');const enc=encryptSecret(secret,secretKey),at=currentIso();try{db.prepare('INSERT INTO integration_connections(id,name,kind,state,endpoint_url,secret_cipher,secret_iv,secret_tag,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,name,kind,state,endpointUrl,enc.ciphertext,enc.iv,enc.tag,actorId,at,at)}catch(error){if(String(error.message).includes('UNIQUE'))throw new CommercialError(409,'CONNECTION_EXISTS');throw error}audit(actorId,'DATA_HUB',id,'CONNECTION_CREATED',`${name} ${kind}`);return getIntegrationConnection(actorId,id)}
  function getIntegrationConnection(actorId,id){actor(actorId,'integrations.read');const r=rowOr404('SELECT id,name,kind,state,endpoint_url,created_by,created_at,updated_at FROM integration_connections WHERE id=?',id,'CONNECTION_NOT_FOUND');return r}
  function internalConnection(id){const r=rowOr404('SELECT * FROM integration_connections WHERE id=?',id,'CONNECTION_NOT_FOUND');return {...r,secret:decryptSecret({ciphertext:r.secret_cipher,iv:r.secret_iv,tag:r.secret_tag},secretKey)}}
  function listIntegrationConnections(actorId){actor(actorId,'integrations.read');return db.prepare('SELECT id,name,kind,state,endpoint_url,created_by,created_at,updated_at FROM integration_connections ORDER BY created_at DESC').all()}
  function createIntegrationJob(actorId,input={}){actor(actorId,'integrations.manage');const name=cleanText(input.name,120),eventType=cleanText(input.eventType,100),source=internalConnection(cleanText(input.sourceConnectionId,80)),target=internalConnection(cleanText(input.targetConnectionId,80)),maxRetries=Math.max(0,Math.min(8,Number(input.maxRetries??3)));if(name.length<2||eventType.length<3||source.kind!=='INBOUND_WEBHOOK'||target.kind!=='OUTBOUND_HTTP'||source.id===target.id||!Number.isInteger(maxRetries))throw new CommercialError(400,'INVALID_INTEGRATION_JOB');const id=`JOB-${randomUUID()}`,at=currentIso();db.prepare("INSERT INTO integration_jobs(id,name,source_connection_id,target_connection_id,event_type,status,max_retries,created_by,created_at,updated_at) VALUES(?,?,?,?,?,'ACTIVE',?,?,?,?)").run(id,name,source.id,target.id,eventType,maxRetries,actorId,at,at);audit(actorId,'DATA_HUB',id,'JOB_CREATED',`${source.id} -> ${target.id} ${eventType}`);return db.prepare('SELECT * FROM integration_jobs WHERE id=?').get(id)}
  function listIntegrationJobs(actorId){actor(actorId,'integrations.read');return db.prepare('SELECT * FROM integration_jobs ORDER BY created_at DESC').all()}
  function ingestWebhook({connectionId,rawBody,signature,input}){const connection=internalConnection(connectionId);if(connection.kind!=='INBOUND_WEBHOOK'||connection.state!=='ACTIVE')throw new CommercialError(409,'WEBHOOK_NOT_ACTIVE');if(!verifyWebhookSignature(rawBody,connection.secret,signature))throw new CommercialError(401,'INVALID_WEBHOOK_SIGNATURE');const eventId=cleanText(input?.eventId,120),type=cleanText(input?.type,100),payload=input?.payload;if(!eventId||!type||!payload||typeof payload!=='object'||Array.isArray(payload))throw new CommercialError(400,'INVALID_WEBHOOK');const existing=db.prepare('SELECT * FROM integration_events WHERE connection_id=? AND event_id=?').get(connectionId,eventId);if(existing)return {...existing,replayed:true};const job=db.prepare("SELECT * FROM integration_jobs WHERE source_connection_id=? AND event_type=? AND status='ACTIVE' ORDER BY created_at LIMIT 1").get(connectionId,type);if(!job)throw new CommercialError(409,'NO_ACTIVE_WEBHOOK_JOB');const eventRowId=`EVT-${randomUUID()}`,runId=`IRUN-${randomUUID()}`,queueId=`Q-${randomUUID()}`,at=currentIso();db.exec('BEGIN IMMEDIATE');try{db.prepare("INSERT INTO integration_events(id,connection_id,event_id,type,payload_json,payload_hash,status,run_id,received_at) VALUES(?,?,?,?,?,?,'QUEUED',?,?)").run(eventRowId,connectionId,eventId,type,toJson(payload),sha256(rawBody),runId,at);db.prepare("INSERT INTO integration_runs(id,job_id,event_row_id,result,attempt,detail,created_at) VALUES(?,?,?,'QUEUED',0,'',?)").run(runId,job.id,eventRowId,at);db.prepare("INSERT INTO integration_queue(id,run_id,available_at,status,leased_until,created_at,updated_at) VALUES(?,?,?,'PENDING',0,?,?)").run(queueId,runId,now(),at,at);db.exec('COMMIT')}catch(error){db.exec('ROLLBACK');if(String(error.message).includes('UNIQUE')){const found=db.prepare('SELECT * FROM integration_events WHERE connection_id=? AND event_id=?').get(connectionId,eventId);if(found)return {...found,replayed:true}}throw error}audit(null,'DATA_HUB',eventRowId,'WEBHOOK_ACCEPTED',`${connectionId} ${eventId}`);return {...db.prepare('SELECT * FROM integration_events WHERE id=?').get(eventRowId),replayed:false}}
  function claimDueIntegrationRun(leaseMs=30_000){const timestamp=now();db.exec('BEGIN IMMEDIATE');try{const q=db.prepare("SELECT * FROM integration_queue WHERE (status='PENDING' AND available_at<=?) OR (status='LEASED' AND leased_until<=?) ORDER BY available_at LIMIT 1").get(timestamp,timestamp);if(!q){db.exec('COMMIT');return null}const leasedUntil=timestamp+leaseMs;guardedUpdate("UPDATE integration_queue SET status='LEASED',leased_until=?,updated_at=? WHERE id=?",[leasedUntil,currentIso(),q.id],'QUEUE_CLAIM_FAILED');const run=rowOr404('SELECT * FROM integration_runs WHERE id=?',q.run_id,'RUN_NOT_FOUND');const job=rowOr404('SELECT * FROM integration_jobs WHERE id=?',run.job_id,'JOB_NOT_FOUND');const event=rowOr404('SELECT * FROM integration_events WHERE id=?',run.event_row_id,'EVENT_NOT_FOUND');const target=internalConnection(job.target_connection_id);db.exec('COMMIT');return {queue:{...q,status:'LEASED',leased_until:leasedUntil},run,job,event:{...event,payload:safeJson(event.payload_json,{})},target:{id:target.id,name:target.name,endpointUrl:target.endpoint_url,secret:target.secret}}}catch(error){try{db.exec('ROLLBACK')}catch{}throw error}}
  function completeIntegrationRun({queueId,success,detail=''}){const q=rowOr404('SELECT * FROM integration_queue WHERE id=?',queueId,'QUEUE_NOT_FOUND');if(q.status!=='LEASED')throw new CommercialError(409,'QUEUE_NOT_LEASED');const run=rowOr404('SELECT * FROM integration_runs WHERE id=?',q.run_id,'RUN_NOT_FOUND');const job=rowOr404('SELECT * FROM integration_jobs WHERE id=?',run.job_id,'JOB_NOT_FOUND');const event=rowOr404('SELECT * FROM integration_events WHERE id=?',run.event_row_id,'EVENT_NOT_FOUND');const at=currentIso();db.exec('BEGIN IMMEDIATE');try{db.prepare("UPDATE integration_queue SET status='DONE',updated_at=? WHERE id=?").run(at,queueId);db.prepare('UPDATE integration_runs SET result=?,detail=?,finished_at=? WHERE id=?').run(success?'SUCCESS':'FAILED',cleanText(detail,1000),at,run.id);if(success){db.prepare("UPDATE integration_events SET status='PROCESSED' WHERE id=?").run(event.id)}else if(run.attempt<job.max_retries){const nextAttempt=run.attempt+1,nextRunId=`IRUN-${randomUUID()}`,nextQueueId=`Q-${randomUUID()}`,delayMs=Math.min(300_000,1000*(2**Math.max(0,nextAttempt-1)));db.prepare("INSERT INTO integration_runs(id,job_id,event_row_id,result,attempt,retry_of,detail,created_at) VALUES(?,?,?,'QUEUED',?,?, '',?)").run(nextRunId,job.id,event.id,nextAttempt,run.id,at);db.prepare("INSERT INTO integration_queue(id,run_id,available_at,status,leased_until,created_at,updated_at) VALUES(?,?,?,'PENDING',0,?,?)").run(nextQueueId,nextRunId,now()+delayMs,at,at);db.prepare("UPDATE integration_events SET status='RETRY_SCHEDULED',run_id=? WHERE id=?").run(nextRunId,event.id)}else{const deadId=`DLQ-${randomUUID()}`;db.prepare('INSERT INTO integration_dead_letters(id,run_id,job_id,event_row_id,reason,created_at) VALUES(?,?,?,?,?,?)').run(deadId,run.id,job.id,event.id,cleanText(detail,1000)||'Retry limit reached',at);db.prepare("UPDATE integration_events SET status='DEAD_LETTER' WHERE id=?").run(event.id);createWorkItem({id:`WORK-${deadId}`,module:'DATA_HUB',title:`연동 실패 ${job.name}`,subtitle:event.event_id,priority:'HIGH',capability:'integrations.retry',status:'Dead Letter',owner:'통합 운영 관리자',nextAction:'실패 원인을 확인하고 재처리 또는 연결 설정을 수정합니다.'})}db.exec('COMMIT')}catch(error){try{db.exec('ROLLBACK')}catch{}throw error}audit(null,'DATA_HUB',run.id,success?'RUN_SUCCESS':'RUN_FAILED',cleanText(detail,500));return db.prepare('SELECT * FROM integration_runs WHERE id=?').get(run.id)}
  function listIntegrationRuns(actorId,limit=100){actor(actorId,'integrations.read');return db.prepare('SELECT * FROM integration_runs ORDER BY created_at DESC LIMIT ?').all(Math.max(1,Math.min(500,Number(limit)||100)))}
  function listDeadLetters(actorId){actor(actorId,'integrations.read');return db.prepare('SELECT * FROM integration_dead_letters WHERE resolved_at IS NULL ORDER BY created_at DESC').all()}
  function retryDeadLetter(actorId,id){actor(actorId,'integrations.retry');const dead=rowOr404('SELECT * FROM integration_dead_letters WHERE id=? AND resolved_at IS NULL',id,'DEAD_LETTER_NOT_FOUND');const previous=rowOr404('SELECT * FROM integration_runs WHERE id=?',dead.run_id,'RUN_NOT_FOUND');const runId=`IRUN-${randomUUID()}`,queueId=`Q-${randomUUID()}`,at=currentIso();db.exec('BEGIN IMMEDIATE');try{db.prepare("INSERT INTO integration_runs(id,job_id,event_row_id,result,attempt,retry_of,detail,created_at) VALUES(?,?,?,'QUEUED',0,?,'manual dead-letter retry',?)").run(runId,dead.job_id,dead.event_row_id,previous.id,at);db.prepare("INSERT INTO integration_queue(id,run_id,available_at,status,leased_until,created_at,updated_at) VALUES(?,?,?,'PENDING',0,?,?)").run(queueId,runId,now(),at,at);db.prepare('UPDATE integration_dead_letters SET resolved_at=? WHERE id=?').run(at,id);db.prepare("UPDATE integration_events SET status='RETRY_SCHEDULED',run_id=? WHERE id=?").run(runId,dead.event_row_id);db.exec('COMMIT')}catch(error){db.exec('ROLLBACK');throw error}audit(actorId,'DATA_HUB',id,'DEAD_LETTER_RETRY',runId);return db.prepare('SELECT * FROM integration_runs WHERE id=?').get(runId)}

  function ready(){try{db.prepare('SELECT 1 ok').get();return true}catch{return false}}
  function checkpoint(){if(dbPath!==':memory:')db.exec('PRAGMA wal_checkpoint(FULL);')}
  function close(){db.close()}

  return {
    db, ready, checkpoint, close,
    audit, actor, createUser, ensureBootstrapAdmin, listUsers, setUserActive,
    login, authenticate, assertCsrf, logout, purgeExpiredSessions, listAudit,
    listWorkItems, createWorkItem, acknowledgeWorkItem,
    createOrder, getOrder, listOrders, transitionOrder, createRefund, getRefund, decideRefund,
    createDocument, getDocument, listDocuments, updateDocument, submitDocument, reviewDocument, archiveDocument,
    createKnowledgeDoc, listKnowledge, retrieveKnowledge, createSupportTask, getSupportTask, listSupportTasks, supportGenerationContext, recordSupportGeneration, reviewSupportTask,
    createIntegrationConnection, getIntegrationConnection, listIntegrationConnections, createIntegrationJob, listIntegrationJobs, ingestWebhook, claimDueIntegrationRun, completeIntegrationRun, listIntegrationRuns, listDeadLetters, retryDeadLetter
  };
}
