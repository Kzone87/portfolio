import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {notificationRetryAt,serviceCaseState,serviceTargetForInquiry,validateFeedback,ServiceExcellenceError} from '../engine.mjs';

const nowIso=()=>new Date().toISOString();
const text=(value,max=1000)=>String(value??'').trim().slice(0,max);
const normalizedTime=value=>new Date(value).toISOString();
const rowCase=row=>row?{
  requestId:row.request_id,
  tier:row.tier,
  responseTargetMinutes:Number(row.response_target_minutes),
  createdAt:row.created_at,
  responseDueAt:row.response_due_at,
  respondedAt:row.responded_at||null,
  closedAt:row.closed_at||null
}:null;
const rowNotification=row=>row?{
  id:Number(row.id),requestId:row.request_id,eventType:row.event_type,channel:row.channel,destination:row.destination,
  payload:JSON.parse(row.payload_json||'{}'),dedupeKey:row.dedupe_key,status:row.status,attempts:Number(row.attempts),
  nextAttemptAt:row.next_attempt_at||null,lastError:row.last_error||'',createdAt:row.created_at,sentAt:row.sent_at||null
}:null;
const rowFeedback=row=>row?{requestId:row.request_id,score:Number(row.score),comment:row.comment,createdAt:row.created_at}:null;

export function createServiceExcellenceStore(path=':memory:',options={}){
  if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
  const db=new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  if(path!==':memory:')db.exec('PRAGMA journal_mode=WAL;');
  const policy=options.policy||{};
  db.exec(`
    CREATE TABLE IF NOT EXISTS service_cases(
      request_id TEXT PRIMARY KEY,
      tier TEXT NOT NULL,
      response_target_minutes INTEGER NOT NULL CHECK(response_target_minutes>0),
      created_at TEXT NOT NULL,
      response_due_at TEXT NOT NULL,
      responded_at TEXT,
      closed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_service_cases_due ON service_cases(response_due_at);
    CREATE TABLE IF NOT EXISTS notification_outbox(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      channel TEXT NOT NULL CHECK(channel IN ('SMS','EMAIL','WEBHOOK')),
      destination TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      dedupe_key TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL CHECK(status IN ('PENDING','RETRY','SENT','DEAD')),
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TEXT,
      last_error TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      sent_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_notification_outbox_pending ON notification_outbox(status,next_attempt_at,id);
    CREATE TABLE IF NOT EXISTS csat_feedback(
      request_id TEXT PRIMARY KEY,
      score INTEGER NOT NULL CHECK(score BETWEEN 1 AND 5),
      comment TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
  `);

  const requireCase=requestId=>{
    const row=db.prepare('SELECT * FROM service_cases WHERE request_id=?').get(text(requestId,80));
    if(!row)throw new ServiceExcellenceError('SERVICE_CASE_NOT_FOUND','서비스 품질 케이스를 찾을 수 없습니다.',404);
    return row;
  };

  return {
    db,
    ensureCase(inquiry){
      const requestId=text(inquiry?.id||inquiry?.requestId,80);
      if(!requestId)throw new ServiceExcellenceError('REQUEST_ID_REQUIRED','접수번호가 필요합니다.');
      const target=serviceTargetForInquiry(inquiry,policy);
      db.prepare('INSERT OR IGNORE INTO service_cases(request_id,tier,response_target_minutes,created_at,response_due_at) VALUES(?,?,?,?,?)').run(
        requestId,target.tier,target.responseTargetMinutes,target.createdAt,target.responseDueAt
      );
      return this.case(requestId);
    },
    case(requestId){return rowCase(db.prepare('SELECT * FROM service_cases WHERE request_id=?').get(text(requestId,80)))},
    markResponded(requestId,at=nowIso()){
      const row=requireCase(requestId);const when=normalizedTime(at);
      db.prepare('UPDATE service_cases SET responded_at=COALESCE(responded_at,?) WHERE request_id=?').run(when,row.request_id);
      return this.case(row.request_id);
    },
    markClosed(requestId,at=nowIso()){
      const row=requireCase(requestId);const when=normalizedTime(at);
      db.prepare('UPDATE service_cases SET closed_at=COALESCE(closed_at,?) WHERE request_id=?').run(when,row.request_id);
      return this.case(row.request_id);
    },
    enqueueNotification({requestId,eventType,channel='WEBHOOK',destination,payload={},dedupeKey,createdAt=nowIso()}){
      requireCase(requestId);
      const type=text(eventType,80),kind=text(channel,20).toUpperCase(),target=text(destination,240),key=text(dedupeKey||`${requestId}:${type}:${kind}`,240);
      if(!type)throw new ServiceExcellenceError('EVENT_TYPE_REQUIRED','알림 이벤트 유형이 필요합니다.');
      if(!['SMS','EMAIL','WEBHOOK'].includes(kind))throw new ServiceExcellenceError('INVALID_NOTIFICATION_CHANNEL','알림 채널을 확인해 주세요.');
      if(!target)throw new ServiceExcellenceError('NOTIFICATION_DESTINATION_REQUIRED','알림 수신 대상이 필요합니다.');
      let json;
      try{json=JSON.stringify(payload??{})}catch{throw new ServiceExcellenceError('INVALID_NOTIFICATION_PAYLOAD','알림 payload를 직렬화할 수 없습니다.');}
      if(Buffer.byteLength(json)>16_384)throw new ServiceExcellenceError('NOTIFICATION_PAYLOAD_TOO_LARGE','알림 payload가 너무 큽니다.',413);
      const when=normalizedTime(createdAt);
      db.prepare(`INSERT OR IGNORE INTO notification_outbox(request_id,event_type,channel,destination,payload_json,dedupe_key,status,attempts,next_attempt_at,created_at)
        VALUES(?,?,?,?,?,?,'PENDING',0,?,?)`).run(text(requestId,80),type,kind,target,json,key,when,when);
      return rowNotification(db.prepare('SELECT * FROM notification_outbox WHERE dedupe_key=?').get(key));
    },
    pendingNotifications(at=nowIso(),limit=20){
      const safeLimit=Math.max(1,Math.min(100,Number(limit)||20));const when=normalizedTime(at);
      return db.prepare(`SELECT * FROM notification_outbox WHERE status IN ('PENDING','RETRY') AND (next_attempt_at IS NULL OR next_attempt_at<=?) ORDER BY id LIMIT ?`).all(when,safeLimit).map(rowNotification);
    },
    markNotificationSent(id,at=nowIso()){
      const when=normalizedTime(at);
      const result=db.prepare(`UPDATE notification_outbox SET status='SENT',attempts=attempts+1,sent_at=?,next_attempt_at=NULL,last_error='' WHERE id=? AND status IN ('PENDING','RETRY')`).run(when,Number(id));
      if(!result.changes)throw new ServiceExcellenceError('NOTIFICATION_NOT_PENDING','전송 대기 알림을 찾을 수 없습니다.',409);
      return rowNotification(db.prepare('SELECT * FROM notification_outbox WHERE id=?').get(Number(id)));
    },
    markNotificationFailed(id,error,at=nowIso(),maxAttempts=5){
      const row=db.prepare('SELECT * FROM notification_outbox WHERE id=?').get(Number(id));
      if(!row||!['PENDING','RETRY'].includes(row.status))throw new ServiceExcellenceError('NOTIFICATION_NOT_PENDING','전송 대기 알림을 찾을 수 없습니다.',409);
      const attempts=Number(row.attempts)+1,dead=attempts>=Math.max(1,Number(maxAttempts)||5),when=normalizedTime(at);
      const retry=dead?null:notificationRetryAt(attempts,when);
      db.prepare('UPDATE notification_outbox SET status=?,attempts=?,next_attempt_at=?,last_error=? WHERE id=?').run(dead?'DEAD':'RETRY',attempts,retry,text(error?.message||error,500),row.id);
      return rowNotification(db.prepare('SELECT * FROM notification_outbox WHERE id=?').get(row.id));
    },
    submitFeedback(requestId,input,at=nowIso()){
      const serviceCase=rowCase(requireCase(requestId));
      if(!serviceCase.closedAt)throw new ServiceExcellenceError('SERVICE_NOT_CLOSED','서비스 완료 후 만족도를 남길 수 있습니다.',409);
      const value=validateFeedback(input),createdAt=normalizedTime(at);
      try{db.prepare('INSERT INTO csat_feedback(request_id,score,comment,created_at) VALUES(?,?,?,?)').run(serviceCase.requestId,value.score,value.comment,createdAt)}
      catch(error){if(String(error.message).includes('UNIQUE'))throw new ServiceExcellenceError('CSAT_ALREADY_SUBMITTED','이미 만족도를 제출했습니다.',409);throw error}
      return this.feedback(serviceCase.requestId);
    },
    feedback(requestId){return rowFeedback(db.prepare('SELECT * FROM csat_feedback WHERE request_id=?').get(text(requestId,80)))},
    summary(at=nowIso()){
      const cases=db.prepare('SELECT * FROM service_cases ORDER BY created_at DESC').all().map(rowCase);
      const states={ON_TRACK:0,AT_RISK:0,OVERDUE:0,MET:0,BREACHED:0,CLOSED_UNRESPONDED:0};
      let responseMinutes=0,responseCount=0;
      for(const item of cases){states[serviceCaseState(item,at)]++;if(item.respondedAt){responseMinutes+=Math.max(0,(Date.parse(item.respondedAt)-Date.parse(item.createdAt))/60_000);responseCount++;}}
      const feedback=db.prepare('SELECT COUNT(*) count,AVG(score) average FROM csat_feedback').get();
      const outbox=db.prepare(`SELECT
        SUM(CASE WHEN status IN ('PENDING','RETRY') THEN 1 ELSE 0 END) pending,
        SUM(CASE WHEN status='DEAD' THEN 1 ELSE 0 END) dead
        FROM notification_outbox`).get();
      return {
        totalCases:cases.length,states,
        averageResponseMinutes:responseCount?Math.round(responseMinutes/responseCount):null,
        csat:{responses:Number(feedback.count||0),average:feedback.average==null?null:Number(Number(feedback.average).toFixed(2))},
        notifications:{pending:Number(outbox.pending||0),dead:Number(outbox.dead||0)}
      };
    },
    health(){return db.prepare('PRAGMA quick_check').get()},
    close(){if(path!==':memory:')db.exec('PRAGMA wal_checkpoint(TRUNCATE)');db.close()}
  };
}
