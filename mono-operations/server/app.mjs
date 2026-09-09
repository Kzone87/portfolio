import http from 'node:http';
import { createMonoStore } from './store.mjs';

const isProduction=process.env.NODE_ENV==='production';
const port=Number(process.env.MONO_PORT||8795);
const dbPath=process.env.MONO_DB_PATH||(isProduction?null:':memory:');
if(!dbPath) throw new Error('MONO_DB_PATH_REQUIRED_IN_PRODUCTION');

let tokenMap={};
if(process.env.MONO_API_TOKENS){
  try{tokenMap=JSON.parse(process.env.MONO_API_TOKENS)}catch{throw new Error('INVALID_MONO_API_TOKENS')}
}
if(isProduction&&Object.keys(tokenMap).length===0) throw new Error('MONO_API_TOKENS_REQUIRED_IN_PRODUCTION');
if(!isProduction&&Object.keys(tokenMap).length===0){tokenMap={'demo-operator-token':'operator','demo-reviewer-token':'reviewer','demo-manager-token':'manager','demo-admin-token':'admin'}}

const store=createMonoStore({dbPath});
function send(res,status,body){const json=JSON.stringify(body);res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(json)}
function auth(req){const header=req.headers.authorization||'';const token=header.startsWith('Bearer ')?header.slice(7):'';const actorId=tokenMap[token];if(!actorId){const e=new Error('UNAUTHORIZED');e.code='UNAUTHORIZED';throw e}return store.actor(actorId)}
async function body(req,limit=32_768){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>limit){const e=new Error('BODY_TOO_LARGE');e.code='BODY_TOO_LARGE';throw e}chunks.push(chunk)}if(!chunks.length)return{};try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{const e=new Error('INVALID_JSON');e.code='INVALID_JSON';throw e}}
function mapError(error){switch(error.code){case'UNAUTHORIZED':return[401,{error:'UNAUTHORIZED'}];case'FORBIDDEN':return[403,{error:'FORBIDDEN'}];case'WORK_NOT_FOUND':return[404,{error:'WORK_NOT_FOUND'}];case'STALE_WORK_ITEM':return[409,{error:'STALE_WORK_ITEM'}];case'EXPECTED_VERSION_REQUIRED':return[400,{error:'EXPECTED_VERSION_REQUIRED'}];case'BODY_TOO_LARGE':return[413,{error:'BODY_TOO_LARGE'}];case'INVALID_JSON':return[400,{error:'INVALID_JSON'}];default:return[500,{error:'INTERNAL_ERROR'}]}}

export const server=http.createServer(async(req,res)=>{
  try{
    if(req.method==='GET'&&req.url==='/health') return send(res,200,{ok:true,service:'mono-operations'});
    if(req.method==='GET'&&req.url==='/ready') return send(res,200,{ready:true,database:true});
    const actor=auth(req);
    if(req.method==='GET'&&req.url==='/api/me') return send(res,200,{id:actor.id,name:actor.name,role:actor.role});
    if(req.method==='GET'&&req.url==='/api/work-items') return send(res,200,{items:store.listWorkItems(actor.id)});
    if(req.method==='GET'&&req.url==='/api/audit') return send(res,200,{items:store.listAudit(actor.id)});
    const match=req.url?.match(/^\/api\/work-items\/([^/]+)\/acknowledge$/);
    if(req.method==='POST'&&match){const payload=await body(req);const item=store.acknowledge({id:decodeURIComponent(match[1]),actorId:actor.id,expectedVersion:payload.expectedVersion});return send(res,200,{item})}
    return send(res,404,{error:'NOT_FOUND'});
  }catch(error){const[status,payload]=mapError(error);return send(res,status,payload)}
});

if(import.meta.url===`file://${process.argv[1]}`){server.listen(port,'127.0.0.1',()=>console.log(`MONO Operations API listening on http://127.0.0.1:${port}`))}
process.on('SIGTERM',()=>server.close(()=>{store.close();process.exit(0)}));
