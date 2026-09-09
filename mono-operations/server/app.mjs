import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createCoreStore, MonoError } from './core-store.mjs';
import { createStore as createMarketStore, DomainError as MarketError } from '../../commerce-ops-console/server/store.mjs';
import { createStore as createOfficeStore, DomainError as OfficeError } from '../../document-intake-approval/server/store.mjs';
import { createStore as createSupportStore, DomainError as SupportError } from '../../ai-workflow-review-desk/server/store.mjs';
import { createStore as createDataStore, ApiError as DataError } from '../../integration-control-center/server/store.mjs';

const JSON_LIMIT=128*1024;
const SESSION_COOKIE='mono_session';
const isProd=process.env.NODE_ENV==='production';
const dbPath=process.env.MONO_DB_PATH||(isProd?'':':memory:');
const allowedOrigin=process.env.MONO_ALLOWED_ORIGIN||(isProd?'':'*');
if(isProd&&(!dbPath||dbPath===':memory:'))throw new Error('MONO_DB_PATH persistent path is required in production');
if(isProd&&(!allowedOrigin||allowedOrigin==='*'))throw new Error('MONO_ALLOWED_ORIGIN explicit origin is required in production');
const bootstrapAdmin=isProd?{
  id:process.env.MONO_BOOTSTRAP_ADMIN_ID,
  username:process.env.MONO_BOOTSTRAP_ADMIN_USER,
  name:process.env.MONO_BOOTSTRAP_ADMIN_NAME,
  team:process.env.MONO_BOOTSTRAP_ADMIN_TEAM||'Operations',
  password:process.env.MONO_BOOTSTRAP_ADMIN_PASSWORD
}:{id:'mono-admin',username:'mono-admin',name:'김서준',team:'서울 운영팀',password:'MonoDemo!2026'};
if(isProd&&Object.values(bootstrapAdmin).some(value=>!String(value||'').trim()))throw new Error('MONO_BOOTSTRAP_ADMIN_* values are required for first production bootstrap');

const loginAttempts=new Map();
const core=createCoreStore(dbPath,{bootstrapAdmin});
const market=createMarketStore(),office=createOfficeStore(),support=createSupportStore(),dataHub=createDataStore();
const now=()=>Date.now();
function cleanAttempts(){for(const [key,value] of loginAttempts)if(now()-value.windowStart>10*60*1000)loginAttempts.delete(key);}
function rateLimitKey(req){return String(req.socket?.remoteAddress||'local');}
function assertLoginRate(req){cleanAttempts();const key=rateLimitKey(req),entry=loginAttempts.get(key)||{count:0,windowStart:now()};if(now()-entry.windowStart>10*60*1000){entry.count=0;entry.windowStart=now();}if(entry.count>=10)throw new MonoError(429,'LOGIN_RATE_LIMIT','로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.');entry.count++;loginAttempts.set(key,entry);}
function clearLoginRate(req){loginAttempts.delete(rateLimitKey(req));}
function cookies(req){return Object.fromEntries(String(req.headers.cookie||'').split(';').map(v=>v.trim()).filter(Boolean).map(pair=>{const i=pair.indexOf('=');return i<0?[pair,'']:[pair.slice(0,i),decodeURIComponent(pair.slice(i+1))];}));}
function setSessionCookie(res,token){const secure=isProd?'; Secure':'';res.setHeader('set-cookie',`${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${secure}`);}
function clearSessionCookie(res){const secure=isProd?'; Secure':'';res.setHeader('set-cookie',`${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`);}
function corsHeaders(req){const origin=String(req.headers.origin||'');const allow=allowedOrigin==='*'?'*':origin===allowedOrigin?origin:'';return allow?{'access-control-allow-origin':allow,'vary':'Origin'}:{};}
function sendJson(req,res,status,body,extra={}){const payload=JSON.stringify(body);res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(payload),'cache-control':'no-store',...corsHeaders(req),...extra});res.end(payload);}
async function readJson(req){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>JSON_LIMIT)throw new MonoError(413,'BODY_TOO_LARGE','요청 데이터가 너무 큽니다.');chunks.push(chunk);}if(!chunks.length)return{};try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new MonoError(400,'INVALID_JSON','JSON 형식을 확인해 주세요.');}}
function sessionOf(req){const token=cookies(req)[SESSION_COOKIE]||'';if(!token)throw new MonoError(401,'AUTH_REQUIRED','로그인이 필요합니다.');const session=core.resolveSession(token);return{...session,token};}
function requireMutation(req,capability){const session=sessionOf(req);core.requireCapability(session.principal,capability);const csrf=String(req.headers['x-csrf-token']||'');if(!csrf||csrf!==session.csrfToken)throw new MonoError(403,'CSRF_INVALID','요청 보안 토큰을 확인해 주세요.');return session;}
function requireRead(req,capability){const session=sessionOf(req);core.requireCapability(session.principal,capability);return session;}
function routeId(pathname,prefix,suffix=''){const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const match=pathname.match(new RegExp(`^${esc(prefix)}([^/]+)${esc(suffix)}$`));return match?decodeURIComponent(match[1]):null;}
function numericRoute(pathname,prefix,suffix=''){const id=routeId(pathname,prefix,suffix);return id!==null&&/^\d+$/.test(id)?Number(id):null;}
function actorInput(session,extra={}){return{...extra,actor:session.principal.id,reviewer:session.principal.id,decidedBy:session.principal.id,role:session.principal.role==='ADMIN'||session.principal.role==='MANAGER'?'ADMIN':session.principal.role==='REVIEWER'?'REVIEWER':'SUBMITTER'};}
function audit(session,module,type,id,action,detail=''){core.audit({module,resourceType:type,resourceId:String(id??''),actorId:session.principal.id,actorName:session.principal.name,action,detail});}
function inbox(){const items=[];
  for(const refund of market.listRefunds('REQUESTED')){const order=market.getOrder(refund.orderId);items.push({id:`market-refund-${refund.id}`,module:'MARKET',kind:'APPROVAL',priority:refund.requiresApproval?'HIGH':'NORMAL',title:'환불 승인 대기',detail:`${order.orderNo} · ${refund.amount} ${order.currency}`,resourceId:String(refund.id)});}
  for(const order of market.listOrders({})){if(order.opsStatus==='ON_HOLD')items.push({id:`market-hold-${order.id}`,module:'MARKET',kind:'URGENT',priority:'HIGH',title:'보류 주문 확인',detail:`${order.orderNo} · ${order.customerName}`,resourceId:String(order.id)});else if(['UNFULFILLED','PICKING'].includes(order.fulfillmentStatus))items.push({id:`market-fulfill-${order.id}`,module:'MARKET',kind:'ACTION',priority:'NORMAL',title:'출고 처리',detail:`${order.orderNo} · ${order.fulfillmentStatus}`,resourceId:String(order.id)});}
  for(const doc of office.listDocuments({})){if(doc.status==='SUBMITTED')items.push({id:`office-review-${doc.id}`,module:'OFFICE',kind:'APPROVAL',priority:'HIGH',title:'문서 검수 대기',detail:doc.title,resourceId:String(doc.id)});if(doc.status==='NEEDS_CHANGES')items.push({id:`office-change-${doc.id}`,module:'OFFICE',kind:'ACTION',priority:'NORMAL',title:'수정 요청 문서',detail:doc.title,resourceId:String(doc.id)});}
  for(const task of support.listTasks()){if(task.status==='NEEDS_REVIEW'||task.status==='GENERATED')items.push({id:`support-review-${task.id}`,module:'SUPPORT',kind:'APPROVAL',priority:task.evaluation?.risk==='HIGH'?'HIGH':'NORMAL',title:'고객 답변 검토',detail:task.title,resourceId:String(task.id)});else if(task.status==='PENDING')items.push({id:`support-pending-${task.id}`,module:'SUPPORT',kind:'ACTION',priority:'NORMAL',title:'고객 문의 정리',detail:task.title,resourceId:String(task.id)});}
  for(const run of dataHub.listRuns(30)){if(run.result==='FAILED')items.push({id:`data-failed-${run.id}`,module:'DATA HUB',kind:'FAILURE',priority:'HIGH',title:'연동 실패 재처리',detail:run.jobName,resourceId:run.id});}
  for(const dead of dataHub.listDeadLetters(20))items.push({id:`data-dead-${dead.id}`,module:'DATA HUB',kind:'FAILURE',priority:'CRITICAL',title:'Dead Letter 확인',detail:dead.jobName,resourceId:dead.id});
  return items;
}
function overview(){const marketMetrics=market.metrics(),officeMetrics=office.metrics(),tasks=support.listTasks(),runs=dataHub.listRuns(50),dead=dataHub.listDeadLetters(50);return{market:{...marketMetrics},office:{...officeMetrics},support:{pending:tasks.filter(t=>t.status==='PENDING').length,review:tasks.filter(t=>['GENERATED','NEEDS_REVIEW'].includes(t.status)).length,final:tasks.filter(t=>['APPROVED','REJECTED'].includes(t.status)).length},dataHub:{failed:runs.filter(r=>r.result==='FAILED').length,deadLetters:dead.length,runs:runs.length},inbox:inbox().length};}
function mapError(error){if(error instanceof MonoError)return error;if(error instanceof MarketError||error instanceof OfficeError||error instanceof SupportError)return new MonoError(error.statusCode,error.code,error.message);if(error instanceof DataError)return new MonoError(error.status,error.code,error.message);return error;}

export function createMonoServer(){return http.createServer(async(req,res)=>{try{const url=new URL(req.url||'/','http://localhost'),{pathname,searchParams}=url;
  if(req.method==='OPTIONS'){sendJson(req,res,204,{}, {'access-control-allow-headers':'content-type,x-csrf-token','access-control-allow-methods':'GET,POST,PATCH,OPTIONS'});return;}
  if(req.method==='GET'&&pathname==='/api/health'){sendJson(req,res,200,{ok:true,service:'mono-operations',mode:isProd?'production':'development'});return;}
  if(req.method==='GET'&&pathname==='/api/ready'){sendJson(req,res,core.ready()?200:503,{ok:core.ready(),database:core.ready()?'ready':'unavailable'});return;}
  if(req.method==='POST'&&pathname==='/api/auth/login'){assertLoginRate(req);const body=await readJson(req),result=core.login(body.username,body.password);clearLoginRate(req);setSessionCookie(res,result.token);sendJson(req,res,200,{principal:result.principal,csrfToken:result.csrfToken,expiresAt:result.expiresAt});return;}
  if(req.method==='POST'&&pathname==='/api/auth/logout'){const session=sessionOf(req);if(String(req.headers['x-csrf-token']||'')!==session.csrfToken)throw new MonoError(403,'CSRF_INVALID','요청 보안 토큰을 확인해 주세요.');core.logout(session.token,session.principal);clearSessionCookie(res);sendJson(req,res,200,{ok:true});return;}
  if(req.method==='GET'&&pathname==='/api/me'){const session=sessionOf(req);sendJson(req,res,200,{principal:session.principal,capabilities:core.can(session.principal,'*')?['*']:undefined,csrfToken:session.csrfToken});return;}
  if(req.method==='GET'&&pathname==='/api/overview'){sessionOf(req);sendJson(req,res,200,overview());return;}
  if(req.method==='GET'&&pathname==='/api/inbox'){sessionOf(req);sendJson(req,res,200,{items:inbox()});return;}
  if(req.method==='GET'&&pathname==='/api/audits'){const session=requireRead(req,'audit.read');sendJson(req,res,200,{items:core.listAudits(Number(searchParams.get('limit')||100)),viewer:session.principal.name});return;}
  if(req.method==='GET'&&pathname==='/api/admin/users'){const session=sessionOf(req);core.requireCapability(session.principal,'*');sendJson(req,res,200,{items:core.listUsers()});return;}
  if(req.method==='POST'&&pathname==='/api/admin/users'){const session=requireMutation(req,'*'),body=await readJson(req);sendJson(req,res,201,core.createUser(body,session.principal.id));return;}

  if(req.method==='GET'&&pathname==='/api/market/orders'){requireRead(req,'market.read');sendJson(req,res,200,{items:market.listOrders({query:searchParams.get('query')||''})});return;}
  if(req.method==='GET'&&pathname==='/api/market/refunds'){requireRead(req,'market.read');sendJson(req,res,200,{items:market.listRefunds(searchParams.get('status')||'')});return;}
  for(const [suffix,method,action,cap] of [['/pick','startPicking','START_PICKING','market.fulfill'],['/ship','ship','SHIP','market.fulfill'],['/deliver','deliver','DELIVER','market.fulfill']]){const id=numericRoute(pathname,'/api/market/orders/',suffix);if(req.method==='POST'&&id!==null){const session=requireMutation(req,cap),body=await readJson(req),result=market[method](id,actorInput(session,body));audit(session,'MARKET','ORDER',id,action,JSON.stringify({version:result.version}));sendJson(req,res,200,result);return;}}
  const refundId=numericRoute(pathname,'/api/market/refunds/','/decision');if(req.method==='POST'&&refundId!==null){const session=requireMutation(req,'market.refund.approve'),body=await readJson(req),result=market.decideRefund(refundId,actorInput(session,{...body,role:'ADMIN'}));audit(session,'MARKET','REFUND',refundId,result.refund.status==='APPROVED'?'APPROVE_REFUND':'REJECT_REFUND',result.refund.decisionNote||'');sendJson(req,res,200,result);return;}

  if(req.method==='GET'&&pathname==='/api/office/documents'){requireRead(req,'office.read');sendJson(req,res,200,{items:office.listDocuments({status:searchParams.get('status')||''})});return;}
  const docReviewId=numericRoute(pathname,'/api/office/documents/','/review');if(req.method==='POST'&&docReviewId!==null){const session=requireMutation(req,'office.review'),body=await readJson(req),result=office.review(docReviewId,actorInput(session,{...body,role:session.principal.role==='ADMIN'||session.principal.role==='MANAGER'?'ADMIN':'REVIEWER'}));audit(session,'OFFICE','DOCUMENT',docReviewId,body.decision||'REVIEW',body.comment||'');sendJson(req,res,200,result);return;}
  const docArchiveId=numericRoute(pathname,'/api/office/documents/','/archive');if(req.method==='POST'&&docArchiveId!==null){const session=requireMutation(req,'office.archive'),body=await readJson(req),result=office.archive(docArchiveId,actorInput(session,{...body,role:'ADMIN'}));audit(session,'OFFICE','DOCUMENT',docArchiveId,'ARCHIVE','');sendJson(req,res,200,result);return;}

  if(req.method==='GET'&&pathname==='/api/support/tasks'){requireRead(req,'support.read');sendJson(req,res,200,{items:support.listTasks()});return;}
  const generateId=numericRoute(pathname,'/api/support/tasks/','/generate');if(req.method==='POST'&&generateId!==null){const session=requireMutation(req,'support.review'),body=await readJson(req),result=support.generateTask(generateId,body);audit(session,'SUPPORT','TASK',generateId,'GENERATE',`evidence=${result.run.retrieval?.evidence?.length||0}`);sendJson(req,res,200,result);return;}
  const supportReviewId=numericRoute(pathname,'/api/support/tasks/','/review');if(req.method==='POST'&&supportReviewId!==null){const session=requireMutation(req,'support.review'),body=await readJson(req),result=support.reviewTask(supportReviewId,{...body,reviewer:session.principal.id});audit(session,'SUPPORT','TASK',supportReviewId,body.decision||'REVIEW',`evidence=${result.review.evidenceIds.length}`);sendJson(req,res,200,result);return;}

  if(req.method==='GET'&&pathname==='/api/data-hub/connections'){requireRead(req,'data.read');sendJson(req,res,200,{items:dataHub.listConnections()});return;}
  if(req.method==='GET'&&pathname==='/api/data-hub/jobs'){requireRead(req,'data.read');sendJson(req,res,200,{items:dataHub.listJobs()});return;}
  if(req.method==='GET'&&pathname==='/api/data-hub/runs'){requireRead(req,'data.read');sendJson(req,res,200,{items:dataHub.listRuns(Number(searchParams.get('limit')||50))});return;}
  if(req.method==='GET'&&pathname==='/api/data-hub/dead-letters'){requireRead(req,'data.read');sendJson(req,res,200,{items:dataHub.listDeadLetters(50)});return;}
  const runJobId=routeId(pathname,'/api/data-hub/jobs/','/run');if(req.method==='POST'&&runJobId!==null){const session=requireMutation(req,'data.run'),body=await readJson(req),result=dataHub.runJob(runJobId,String(body.idempotencyKey||''));audit(session,'DATA HUB','JOB',runJobId,'RUN',result.result);sendJson(req,res,200,result);return;}
  const retryId=routeId(pathname,'/api/data-hub/runs/','/retry');if(req.method==='POST'&&retryId!==null){const session=requireMutation(req,'data.retry'),result=dataHub.retryRun(retryId);audit(session,'DATA HUB','RUN',retryId,'RETRY',result.result);sendJson(req,res,200,result);return;}
  const connectionId=routeId(pathname,'/api/data-hub/webhooks/');if(req.method==='POST'&&connectionId!==null){const session=requireMutation(req,'data.run'),body=await readJson(req),eventKey=`${connectionId}:${String(body.eventId||'')}`,dedup=core.recordEvent({module:'DATA HUB',eventKey,eventType:String(body.type||''),payload:body});if(dedup.replayed){sendJson(req,res,200,{replayed:true,eventKey});return;}const event=dataHub.receiveWebhook(connectionId,body);audit(session,'DATA HUB','WEBHOOK',body.eventId,'WEBHOOK_ACCEPTED',body.type||'');let order=null;if(body.type==='order.updated'&&event.status==='PROCESSED'){const payload=body.payload||{};order=market.createOrder({orderNo:String(payload.orderNo||`WEB-${String(body.eventId).slice(-10)}`),customerName:String(payload.customerName||'연동 고객'),email:String(payload.email||'integration@example.com'),total:Number(payload.total||10000),currency:String(payload.currency||'KRW'),itemCount:Number(payload.itemCount||1)},'data-hub');core.audit({module:'MARKET',resourceType:'ORDER',resourceId:String(order.id),actorId:'system',actorName:'DATA HUB',action:'INTEGRATION_CREATE_ORDER',detail:`${order.orderNo} · ${body.eventId}`});}sendJson(req,res,201,{event,order,replayed:false});return;}

  sendJson(req,res,404,{error:{code:'NOT_FOUND',message:'route not found'}});
}catch(raw){const error=mapError(raw);if(error instanceof MonoError){sendJson(req,res,error.statusCode,{error:{code:error.code,message:error.message}});return;}console.error(raw);sendJson(req,res,500,{error:{code:'INTERNAL_ERROR',message:'unexpected server error'}});}});}

const isMain=process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1];
if(isMain){const port=Number(process.env.PORT||8794),server=createMonoServer();server.listen(port,'127.0.0.1',()=>console.log(`MONO Operations API listening on http://127.0.0.1:${port}`));}
