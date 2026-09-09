import { DatabaseSync } from 'node:sqlite';

export const ROLE_CAPABILITIES={
  OPERATOR:['orders.read','orders.fulfill','support.read','integrations.read'],
  REVIEWER:['orders.read','documents.read','documents.review','support.read','support.review'],
  MANAGER:['orders.read','orders.fulfill','refunds.approve','documents.read','documents.review','support.read','support.review','integrations.read','integrations.retry'],
  ADMIN:['*']
};

const seedItems=[
  ['W-1001','MARKET','고액 환불 승인 대기','주문 #M-260906-031 · 248,000원','HIGH','refunds.approve','승인 대기','운영 관리자','파손 증빙과 결제 내역을 확인하고 승인 또는 반려 사유를 남깁니다.'],
  ['W-1002','OFFICE','공급사 인보이스 검수','문서 #D-2041 · 필수값 추출 완료','MEDIUM','documents.review','검수 대기','검수 담당자','원문과 추출값을 대조하고 승인, 수정요청 또는 반려를 결정합니다.'],
  ['W-1003','SUPPORT','배송지연 문의 답변 검토','문의 #S-881 · 근거 3건 · 신뢰도 91%','MEDIUM','support.review','사람 검토 필요','고객지원 검수자','근거자료와 AI 제안을 확인하고 문구를 수정한 뒤 승인 또는 반려합니다.'],
  ['W-1004','DATA_HUB','주문 동기화 3회 실패','Run #R-1902 · warehouse-demo','HIGH','integrations.retry','Dead Letter','통합 운영 관리자','연결 상태와 실패 원인을 확인한 뒤 안전하게 재처리하거나 에스컬레이션합니다.']
];

function capsFor(role){return ROLE_CAPABILITIES[role]||[]}
export function hasCapability(role,capability){const caps=capsFor(role);return caps.includes('*')||caps.includes(capability)}

export function createMonoStore({dbPath=':memory:'}={}){
  const db=new DatabaseSync(dbPath);
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,role TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS work_items(id TEXT PRIMARY KEY,module TEXT NOT NULL,title TEXT NOT NULL,subtitle TEXT NOT NULL,priority TEXT NOT NULL,capability TEXT NOT NULL,status TEXT NOT NULL,owner TEXT NOT NULL,next_action TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS audits(id INTEGER PRIMARY KEY AUTOINCREMENT,actor_id TEXT NOT NULL,module TEXT NOT NULL,entity_id TEXT NOT NULL,action TEXT NOT NULL,detail TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  `);
  const count=db.prepare('SELECT COUNT(*) c FROM users').get().c;
  if(!count){
    const insertUser=db.prepare('INSERT INTO users(id,name,role) VALUES(?,?,?)');
    [['operator','김민수','OPERATOR'],['reviewer','박지현','REVIEWER'],['manager','이민우','MANAGER'],['admin','최서연','ADMIN']].forEach(v=>insertUser.run(...v));
  }
  const workCount=db.prepare('SELECT COUNT(*) c FROM work_items').get().c;
  if(!workCount){const stmt=db.prepare('INSERT INTO work_items(id,module,title,subtitle,priority,capability,status,owner,next_action) VALUES(?,?,?,?,?,?,?,?,?)');seedItems.forEach(v=>stmt.run(...v));}
  function actor(id){const user=db.prepare('SELECT id,name,role,active FROM users WHERE id=?').get(id);if(!user||!user.active){const e=new Error('UNAUTHORIZED');e.code='UNAUTHORIZED';throw e}return user}
  function listWorkItems(actorId){actor(actorId);return db.prepare('SELECT * FROM work_items ORDER BY CASE priority WHEN \'HIGH\' THEN 0 WHEN \'MEDIUM\' THEN 1 ELSE 2 END, updated_at DESC').all()}
  function getWorkItem(id,actorId){actor(actorId);const row=db.prepare('SELECT * FROM work_items WHERE id=?').get(id);if(!row){const e=new Error('WORK_NOT_FOUND');e.code='WORK_NOT_FOUND';throw e}return row}
  function acknowledge({id,actorId,expectedVersion}){
    const user=actor(actorId);const item=getWorkItem(id,actorId);
    if(!Number.isInteger(expectedVersion)){const e=new Error('EXPECTED_VERSION_REQUIRED');e.code='EXPECTED_VERSION_REQUIRED';throw e}
    if(item.version!==expectedVersion){const e=new Error('STALE_WORK_ITEM');e.code='STALE_WORK_ITEM';throw e}
    if(!hasCapability(user.role,item.capability)){const e=new Error('FORBIDDEN');e.code='FORBIDDEN';throw e}
    if(item.status==='확인 완료'){return item}
    const result=db.prepare("UPDATE work_items SET status='확인 완료',version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND version=?").run(id,expectedVersion);
    if(result.changes!==1){const e=new Error('STALE_WORK_ITEM');e.code='STALE_WORK_ITEM';throw e}
    db.prepare('INSERT INTO audits(actor_id,module,entity_id,action,detail) VALUES(?,?,?,?,?)').run(user.id,item.module,item.id,'ACKNOWLEDGE',`${item.title} 확인 처리`);
    return getWorkItem(id,actorId);
  }
  function listAudit(actorId){actor(actorId);return db.prepare('SELECT * FROM audits ORDER BY id DESC LIMIT 100').all()}
  function close(){db.close()}
  return {db,actor,listWorkItems,getWorkItem,acknowledge,listAudit,close};
}
