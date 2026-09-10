import {ServiceExcellenceError} from '../engine.mjs';

export function createWebhookNotificationSender({url,token='',fetchImpl=fetch,timeoutMs=5000}={}){
  let endpoint;
  try{endpoint=new URL(String(url||''))}catch{throw new ServiceExcellenceError('INVALID_NOTIFICATION_WEBHOOK','알림 Webhook URL을 확인해 주세요.')}
  if(!['https:','http:'].includes(endpoint.protocol))throw new ServiceExcellenceError('INVALID_NOTIFICATION_WEBHOOK','알림 Webhook은 HTTP(S) URL이어야 합니다.');
  const timeout=Math.max(500,Math.min(30_000,Number(timeoutMs)||5000));
  return async notification=>{
    let response;
    try{
      response=await fetchImpl(endpoint,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},signal:AbortSignal.timeout(timeout),body:JSON.stringify({
        id:notification.id,
        requestId:notification.requestId,
        eventType:notification.eventType,
        channel:notification.channel,
        destination:notification.destination,
        payload:notification.payload
      })});
    }catch(error){throw new ServiceExcellenceError('NOTIFICATION_PROVIDER_UNAVAILABLE',error?.message||'알림 전송사업자에 연결할 수 없습니다.',502)}
    if(!response.ok){
      const detail=await response.text().catch(()=>"");
      throw new ServiceExcellenceError('NOTIFICATION_PROVIDER_REJECTED',`알림 전송이 거절되었습니다. HTTP ${response.status}${detail?` · ${detail.slice(0,120)}`:''}`,502);
    }
    return {ok:true,status:response.status};
  };
}

export async function dispatchNotificationBatch(store,sender,{at=new Date(),limit=20,maxAttempts=5}={}){
  if(!store||typeof store.pendingNotifications!=='function')throw new Error('service excellence store is required');
  if(typeof sender!=='function')throw new Error('notification sender is required');
  const attempted=[];
  for(const notification of store.pendingNotifications(at,limit)){
    try{
      await sender(notification);
      attempted.push({id:notification.id,status:store.markNotificationSent(notification.id,at).status});
    }catch(error){
      const updated=store.markNotificationFailed(notification.id,error,at,maxAttempts);
      attempted.push({id:notification.id,status:updated.status,error:error?.code||error?.message||'SEND_FAILED'});
    }
  }
  return attempted;
}

export function startNotificationWorker(store,sender,{intervalMs=5000,limit=20,maxAttempts=5,onError=console.error}={}){
  const delay=Math.max(1000,Math.min(300_000,Number(intervalMs)||5000));
  let running=false,closed=false;
  const tick=async()=>{
    if(closed||running)return [];
    running=true;
    try{return await dispatchNotificationBatch(store,sender,{limit,maxAttempts})}
    catch(error){onError(error);return []}
    finally{running=false}
  };
  const timer=setInterval(tick,delay);timer.unref?.();
  return {tick,close(){closed=true;clearInterval(timer)}};
}
