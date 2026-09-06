import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createStore, DomainError } from './store.mjs';
const LIMIT=64*1024;
function send(res,status,body){const p=JSON.stringify(body);res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(p),'cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-headers':'content-type','access-control-allow-methods':'GET,POST,OPTIONS'});res.end(p);}
async function body(req){let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>LIMIT)throw new DomainError(413,'BODY_TOO_LARGE','request body too large');chunks.push(c);}if(!chunks.length)return{};try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new DomainError(400,'INVALID_JSON','request body must be valid JSON');}}
function route(path,suffix=''){const esc=suffix.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const m=path.match(new RegExp(`^/api/jobs/(\\d+)${esc}$`));return m?Number(m[1]):null;}
export function createFieldServiceServer(store=createStore()){
 return http.createServer(async(req,res)=>{try{const u=new URL(req.url??'/','http://localhost'),p=u.pathname;
  if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-origin':'*','access-control-allow-headers':'content-type','access-control-allow-methods':'GET,POST,OPTIONS'});res.end();return;}
  if(req.method==='GET'&&p==='/api/health'){send(res,200,{ok:true,service:'field-service-ops',mode:'fictional-demo'});return;}
  if(req.method==='GET'&&p==='/api/agents'){send(res,200,{items:store.listAgents()});return;}
  if(req.method==='GET'&&p==='/api/metrics'){send(res,200,store.metrics());return;}
  if(req.method==='GET'&&p==='/api/jobs'){send(res,200,{items:store.listJobs({query:u.searchParams.get('query')??'',status:u.searchParams.get('status')??'',priority:u.searchParams.get('priority')??'',agentId:u.searchParams.get('agentId')??''})});return;}
  if(req.method==='GET'&&p==='/api/audits'){const raw=u.searchParams.get('jobId');const id=raw?Number(raw):null;if(id!==null&&!Number.isInteger(id))throw new DomainError(400,'INVALID_JOB_ID','jobId must be an integer');send(res,200,{items:store.listAudits(id)});return;}
  if(req.method==='POST'&&p==='/api/jobs'){const b=await body(req);send(res,201,store.createJob(b,b.actor));return;}
  const direct=route(p);if(req.method==='GET'&&direct!==null){send(res,200,store.getJob(direct));return;}
  const actions=[['/schedule','schedule'],['/reschedule','reschedule'],['/reassign','reassign'],['/dispatch','dispatch'],['/on-site','onSite'],['/complete','complete'],['/cancel','cancel'],['/no-show','noShow']];
  for(const [suffix,method] of actions){const id=route(p,suffix);if(req.method==='POST'&&id!==null){const b=await body(req);send(res,200,store[method](id,b));return;}}
  send(res,404,{error:{code:'NOT_FOUND',message:'route not found'}});
 }catch(error){if(error instanceof DomainError){send(res,error.statusCode,{error:{code:error.code,message:error.message}});return;}console.error(error);send(res,500,{error:{code:'INTERNAL_ERROR',message:'unexpected server error'}});}});
}
const isMain=process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1];if(isMain){const port=Number(process.env.PORT??8792);createFieldServiceServer().listen(port,'127.0.0.1',()=>console.log(`Field Service Ops API listening on http://127.0.0.1:${port}`));}
