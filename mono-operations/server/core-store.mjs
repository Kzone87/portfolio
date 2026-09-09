import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export class MonoError extends Error {
  constructor(statusCode, code, message){ super(message); this.name='MonoError'; this.statusCode=statusCode; this.code=code; }
}

export const ROLE_CAPABILITIES = Object.freeze({
  OPERATOR: ['market.read','market.fulfill','office.read','office.submit','support.read','support.review','data.read','data.run'],
  REVIEWER: ['market.read','office.read','office.review','support.read','support.review','data.read'],
  MANAGER: ['market.read','market.fulfill','market.refund.approve','office.read','office.submit','office.review','office.archive','support.read','support.review','data.read','data.run','data.retry','audit.read'],
  ADMIN: ['*']
});

const nowIso=()=>new Date().toISOString();
const clean=(value,max=120)=>String(value??'').trim().slice(0,max);
const normalizeUser=value=>clean(value,80).toLowerCase();
const hashToken=value=>createHash('sha256').update(String(value||'')).digest('hex');
const digest=(password,salt)=>scryptSync(String(password),salt,64).toString('hex');
function safeHexEqual(a,b){try{const x=Buffer.from(String(a),'hex'),y=Buffer.from(String(b),'hex');return x.length===y.length&&x.length>0&&timingSafeEqual(x,y);}catch{return false;}}
function validRole(value){const role=String(value||'').toUpperCase();if(!Object.hasOwn(ROLE_CAPABILITIES,role))throw new MonoError(400,'INVALID_ROLE','지원하지 않는 직원 역할입니다.');return role;}
function publicUser(row){return row?{id:row.id,username:row.username,name:row.name,team:row.team,role:row.role,active:Boolean(row.active),createdAt:row.created_at,updatedAt:row.updated_at}:null;}

export function createCoreStore(path=':memory:',options={}){
  if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
  const db=new DatabaseSync(path);db.exec('PRAGMA foreign_keys=ON');if(path!==':memory:')db.exec('PRAGMA journal_mode=WAL');
  const maxMs=Number(options.sessionMaxMs||8*60*60*1000),idleMs=Number(options.sessionIdleMs||30*60*1000);
  db.exec(`
    CREATE TABLE IF NOT EXISTS mono_users(
      id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, name TEXT NOT NULL, team TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL CHECK(role IN ('OPERATOR','REVIEWER','MANAGER','ADMIN')),
      password_salt TEXT NOT NULL,password_hash TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)),
      created_at TEXT NOT NULL,updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS mono_sessions(
      token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES mono_users(id) ON DELETE CASCADE,csrf_token TEXT NOT NULL,
      created_at TEXT NOT NULL,last_seen_at TEXT NOT NULL,expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_mono_sessions_user ON mono_sessions(user_id);
    CREATE TABLE IF NOT EXISTS mono_audits(
      id INTEGER PRIMARY KEY AUTOINCREMENT,module TEXT NOT NULL,resource_type TEXT NOT NULL,resource_id TEXT,
      actor_id TEXT,actor_name TEXT NOT NULL,action TEXT NOT NULL,detail TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_mono_audits_created ON mono_audits(id DESC);
    CREATE TABLE IF NOT EXISTS mono_events(
      id INTEGER PRIMARY KEY AUTOINCREMENT,module TEXT NOT NULL,event_key TEXT UNIQUE,event_type TEXT NOT NULL,payload_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PROCESSED',created_at TEXT NOT NULL
    );
  `);
  function insertUser(input,actor='bootstrap'){
    const id=clean(input?.id,80),username=normalizeUser(input?.username),name=clean(input?.name,80),team=clean(input?.team,80),role=validRole(input?.role);
    const password=String(input?.password||'');if(!/^[A-Za-z0-9._-]{2,80}$/.test(id))throw new MonoError(400,'INVALID_USER_ID','직원 ID를 확인해 주세요.');
    if(!/^[a-z0-9._-]{3,80}$/.test(username))throw new MonoError(400,'INVALID_USERNAME','로그인 ID를 확인해 주세요.');
    if(name.length<2)throw new MonoError(400,'INVALID_NAME','직원 이름을 확인해 주세요.');if(password.length<10||password.length>200)throw new MonoError(400,'INVALID_PASSWORD','비밀번호는 10자 이상이어야 합니다.');
    const salt=randomBytes(16).toString('hex'),timestamp=nowIso();
    try{db.prepare('INSERT INTO mono_users(id,username,name,team,role,password_salt,password_hash,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,username,name,team,role,salt,digest(password,salt),1,timestamp,timestamp);}catch(error){if(String(error?.message||'').includes('UNIQUE'))throw new MonoError(409,'USER_EXISTS','이미 사용 중인 계정입니다.');throw error;}
    audit({module:'CORE',resourceType:'USER',resourceId:id,actorId:actor,actorName:actor,action:'USER_CREATE',detail:`${username} · ${role}`});return publicUser(db.prepare('SELECT * FROM mono_users WHERE id=?').get(id));
  }
  if(Number(db.prepare('SELECT COUNT(*) AS c FROM mono_users').get().c)===0&&options.bootstrapAdmin)insertUser({...options.bootstrapAdmin,role:'ADMIN'},'bootstrap');
  function audit(input={}){const module=clean(input.module,40)||'CORE',resourceType=clean(input.resourceType,60)||'SYSTEM',resourceId=clean(input.resourceId,120)||null,actorId=clean(input.actorId,80)||null,actorName=clean(input.actorName,80)||'system',action=clean(input.action,80),detail=clean(input.detail,800);if(!action)throw new MonoError(400,'AUDIT_ACTION_REQUIRED','audit action is required');db.prepare('INSERT INTO mono_audits(module,resource_type,resource_id,actor_id,actor_name,action,detail,created_at) VALUES(?,?,?,?,?,?,?,?)').run(module,resourceType,resourceId,actorId,actorName,action,detail,nowIso());}
  function login(username,password){const row=db.prepare('SELECT * FROM mono_users WHERE username=?').get(normalizeUser(username));if(!row||!row.active||!safeHexEqual(digest(String(password||''),row.password_salt),row.password_hash)){if(row)audit({module:'CORE',resourceType:'SESSION',resourceId:row.id,actorId:row.id,actorName:row.name,action:'LOGIN_FAILED'});throw new MonoError(401,'AUTH_FAILED','로그인 정보를 확인해 주세요.');}const token=randomBytes(32).toString('base64url'),csrfToken=randomBytes(24).toString('base64url'),now=Date.now(),created=new Date(now).toISOString(),expiresAt=new Date(now+maxMs).toISOString();db.prepare('INSERT INTO mono_sessions(token_hash,user_id,csrf_token,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?)').run(hashToken(token),row.id,csrfToken,created,created,expiresAt);audit({module:'CORE',resourceType:'SESSION',resourceId:row.id,actorId:row.id,actorName:row.name,action:'LOGIN'});return{token,csrfToken,principal:publicUser(row),expiresAt};}
  function resolveSession(token){const hash=hashToken(token),row=db.prepare('SELECT s.*,u.username,u.name,u.team,u.role,u.active,u.created_at AS user_created_at,u.updated_at AS user_updated_at FROM mono_sessions s JOIN mono_users u ON u.id=s.user_id WHERE s.token_hash=?').get(hash);if(!row||!row.active)throw new MonoError(401,'SESSION_INVALID','로그인이 필요합니다.');const now=Date.now(),last=Date.parse(row.last_seen_at),exp=Date.parse(row.expires_at);if(!Number.isFinite(last)||!Number.isFinite(exp)||now>=exp||now-last>idleMs){db.prepare('DELETE FROM mono_sessions WHERE token_hash=?').run(hash);throw new MonoError(401,'SESSION_EXPIRED','로그인 시간이 만료되었습니다.');}db.prepare('UPDATE mono_sessions SET last_seen_at=? WHERE token_hash=?').run(new Date(now).toISOString(),hash);return{principal:{id:row.user_id,username:row.username,name:row.name,team:row.team,role:row.role,active:true,createdAt:row.user_created_at,updatedAt:row.user_updated_at},csrfToken:row.csrf_token,expiresAt:row.expires_at};}
  function logout(token,principal){db.prepare('DELETE FROM mono_sessions WHERE token_hash=?').run(hashToken(token));if(principal)audit({module:'CORE',resourceType:'SESSION',resourceId:principal.id,actorId:principal.id,actorName:principal.name,action:'LOGOUT'});}
  function can(principal,capability){const list=ROLE_CAPABILITIES[principal?.role]||[];return list.includes('*')||list.includes(capability);}
  function requireCapability(principal,capability){if(!can(principal,capability))throw new MonoError(403,'FORBIDDEN','이 업무를 처리할 권한이 없습니다.');}
  function listAudits(limit=100){const safe=Math.min(500,Math.max(1,Number(limit)||100));return db.prepare('SELECT * FROM mono_audits ORDER BY id DESC LIMIT ?').all(safe).map(row=>({id:Number(row.id),module:row.module,resourceType:row.resource_type,resourceId:row.resource_id,actorId:row.actor_id,actorName:row.actor_name,action:row.action,detail:row.detail,createdAt:row.created_at}));}
  function recordEvent(input={}){const module=clean(input.module,40),eventKey=clean(input.eventKey,160),eventType=clean(input.eventType,80),payload=input.payload&&typeof input.payload==='object'?input.payload:{};if(!module||!eventKey||!eventType)throw new MonoError(400,'INVALID_EVENT','module, eventKey and eventType are required');try{db.prepare('INSERT INTO mono_events(module,event_key,event_type,payload_json,status,created_at) VALUES(?,?,?,?,?,?)').run(module,eventKey,eventType,JSON.stringify(payload),'PROCESSED',nowIso());return{replayed:false};}catch(error){if(String(error?.message||'').includes('UNIQUE'))return{replayed:true};throw error;}}
  function ready(){return Number(db.prepare('SELECT 1 AS ok').get().ok)===1;}
  function listUsers(){return db.prepare('SELECT * FROM mono_users ORDER BY active DESC,role DESC,name').all().map(publicUser);}
  return{login,resolveSession,logout,can,requireCapability,audit,listAudits,recordEvent,ready,listUsers,createUser(input,actor){return insertUser(input,actor);},close(){db.close();}};
}
