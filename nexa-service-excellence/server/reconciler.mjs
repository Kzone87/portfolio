import {existsSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {ServiceExcellenceError} from '../engine.mjs';

const channelFor=row=>String(row.email||'').trim()?{channel:'EMAIL',destination:String(row.email).trim()}:{channel:'SMS',destination:String(row.phone||'').trim()};

export function reconcileServiceExcellence({inquiryDbPath,serviceStore}={}){
  if(!inquiryDbPath||!existsSync(inquiryDbPath))throw new ServiceExcellenceError('INQUIRY_DB_NOT_FOUND','NEXA 상담 데이터베이스를 찾을 수 없습니다.',503);
  if(!serviceStore||typeof serviceStore.ensureCase!=='function')throw new Error('service excellence store is required');
  const source=new DatabaseSync(inquiryDbPath);
  try{
    const integrity=source.prepare('PRAGMA quick_check').get();
    if(integrity?.quick_check!=='ok')throw new ServiceExcellenceError('INQUIRY_DB_UNHEALTHY','NEXA 상담 데이터베이스 무결성 검사가 실패했습니다.',503);
    const rows=source.prepare('SELECT public_id,impact,phone,email,status,created_at,updated_at FROM inquiries ORDER BY id').all();
    let created=0,responded=0,closed=0,enqueued=0;
    const firstResponse=source.prepare(`SELECT ia.created_at FROM inquiry_audits ia JOIN inquiries i ON i.id=ia.inquiry_id
      WHERE i.public_id=? AND ia.action='STATUS_CHANGE' AND ia.to_status IN ('CONTACTED','CLOSED') ORDER BY ia.id LIMIT 1`);
    const firstClosed=source.prepare(`SELECT ia.created_at FROM inquiry_audits ia JOIN inquiries i ON i.id=ia.inquiry_id
      WHERE i.public_id=? AND ia.action='STATUS_CHANGE' AND ia.to_status='CLOSED' ORDER BY ia.id LIMIT 1`);
    for(const row of rows){
      const before=serviceStore.case(row.public_id);
      let serviceCase=serviceStore.ensureCase({id:row.public_id,impact:row.impact,createdAt:row.created_at});
      if(!before)created++;
      const response=firstResponse.get(row.public_id);
      if(response?.created_at&&!serviceCase.respondedAt){serviceCase=serviceStore.markResponded(row.public_id,response.created_at);responded++;}
      const close=firstClosed.get(row.public_id);
      if(close?.created_at&&!serviceCase.closedAt){serviceCase=serviceStore.markClosed(row.public_id,close.created_at);closed++;}
      const contact=channelFor(row);
      const events=[
        {type:'INTAKE_RECEIVED',ready:true},
        {type:'RESPONSE_CONFIRMED',ready:Boolean(serviceCase.respondedAt)},
        {type:'SERVICE_CLOSED_FEEDBACK',ready:Boolean(serviceCase.closedAt)}
      ];
      for(const event of events){
        if(!event.ready||!contact.destination)continue;
        const key=`${row.public_id}:${event.type}:${contact.channel}`;
        const existing=serviceStore.db.prepare('SELECT id FROM notification_outbox WHERE dedupe_key=?').get(key);
        serviceStore.enqueueNotification({
          requestId:row.public_id,eventType:event.type,channel:contact.channel,destination:contact.destination,dedupeKey:key,
          payload:{requestId:row.public_id,eventType:event.type,tier:serviceCase.tier,responseDueAt:serviceCase.responseDueAt}
        });
        if(!existing)enqueued++;
      }
    }
    return {scanned:rows.length,created,responded,closed,enqueued};
  }finally{source.close()}
}

export function startServiceExcellenceReconciler(options,{intervalMs=60_000,onError=console.error}={}){
  const delay=Math.max(5_000,Math.min(900_000,Number(intervalMs)||60_000));
  let closed=false,running=false;
  const tick=()=>{
    if(closed||running)return null;
    running=true;
    try{return reconcileServiceExcellence(options)}catch(error){onError(error);return null}finally{running=false}
  };
  const timer=setInterval(tick,delay);timer.unref?.();
  return {tick,close(){closed=true;clearInterval(timer)}};
}
