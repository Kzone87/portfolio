import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {readFileSync,existsSync} from 'node:fs';
import {BookingStore} from './store.mjs';
import {SERVICES,validateCustomer,validateNote,serviceById,validateDateTime,addMinutes} from '../engine.mjs';

const HERE=dirname(fileURLToPath(import.meta.url));
const PUBLIC=resolve(HERE,'..');
const LIMIT=32_768;
const contentTypes={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
const cookie=(req,name)=>String(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(`${name}=`))?.slice(name.length+1)||'';
const securityHeaders={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'SAMEORIGIN'};
const json=(res,status,body,headers={})=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8',...securityHeaders,...headers});res.end(JSON.stringify(body))};
const parseBody=req=>new Promise((resolveBody,reject)=>{let raw='';req.on('data',chunk=>{raw+=chunk;if(Buffer.byteLength(raw)>LIMIT){reject(Object.assign(new Error('BODY_TOO_LARGE'),{status:413}));req.destroy()}});req.on('end',()=>{try{resolveBody(raw?JSON.parse(raw):{})}catch{reject(Object.assign(new Error('INVALID_JSON'),{status:400}))}});req.on('error',reject)});
const clientIp=req=>String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim();

export function createBookingApp(options={}){
  const production=options.production??process.env.NODE_ENV==='production';
  const dbPath=options.dbPath??process.env.BOOKING_DB_PATH??(production?null:':memory:');
  const adminPassword=options.adminPassword??process.env.BOOKING_ADMIN_PASSWORD??(production?null:'booking-demo-1234');
  const allowedOrigin=options.allowedOrigin??process.env.BOOKING_ALLOWED_ORIGIN??(production?null:'http://127.0.0.1:8798');
  if(!dbPath) throw new Error('BOOKING_DB_PATH_REQUIRED_IN_PRODUCTION');
  if(!adminPassword) throw new Error('BOOKING_ADMIN_PASSWORD_REQUIRED_IN_PRODUCTION');
  if(!allowedOrigin) throw new Error('BOOKING_ALLOWED_ORIGIN_REQUIRED_IN_PRODUCTION');
  const store=options.store??new BookingStore({dbPath,adminPassword});
  const attempts=new Map();
  const hit=(key,max,windowMs)=>{const t=Date.now();const row=attempts.get(key)||{count:0,reset:t+windowMs};if(row.reset<t){row.count=0;row.reset=t+windowMs}row.count++;attempts.set(key,row);return row.count<=max};
  const sameOrigin=req=>!req.headers.origin||req.headers.origin===allowedOrigin;
  const auth=req=>store.session(cookie(req,'booking_session'));
  const requireAuth=(req,res,roles=['STAFF','ADMIN'])=>{const session=auth(req);if(!session){json(res,401,{error:'UNAUTHORIZED'});return null}if(!roles.includes(session.employee.role)){json(res,403,{error:'FORBIDDEN'});return null}return session};
  const requireMutation=(req,res,roles)=>{const session=requireAuth(req,res,roles);if(!session)return null;if(!store.verifyCsrf(session,req.headers['x-csrf-token'])){json(res,403,{error:'CSRF_INVALID'});return null}return session};

  const handler=async(req,res)=>{
    try{
      if(!sameOrigin(req)){json(res,403,{error:'ORIGIN_NOT_ALLOWED'});return}
      const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);const path=url.pathname;
      if(path==='/health'){json(res,200,{ok:true});return}
      if(path==='/ready'){const ready=store.health();const ok=ready.quick_check==='ok';json(res,ok?200:503,{ready:ok,database:ok});return}
      if(req.method==='POST'&&path==='/api/auth/login'){
        if(!hit(`login:${clientIp(req)}`,8,10*60_000)){json(res,429,{error:'RATE_LIMITED'});return}
        const body=await parseBody(req);const result=store.login(body.email,body.password);if(!result){json(res,401,{error:'INVALID_CREDENTIALS'});return}
        json(res,200,{employee:result.employee,csrf:result.csrf,expiresAt:result.expiresAt},{'set-cookie':`booking_session=${result.session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${production?'; Secure':''}`});return;
      }
      if(req.method==='POST'&&path==='/api/auth/logout'){const session=requireMutation(req,res,['STAFF','ADMIN']);if(!session)return;store.logout(cookie(req,'booking_session'));json(res,200,{ok:true},{'set-cookie':`booking_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${production?'; Secure':''}`});return}
      if(req.method==='GET'&&path==='/api/me'){const session=requireAuth(req,res);if(!session)return;json(res,200,{employee:session.employee});return}
      if(req.method==='GET'&&path==='/api/services'){json(res,200,{services:SERVICES});return}
      if(req.method==='POST'&&path==='/api/bookings'){
        if(!hit(`public:${clientIp(req)}`,20,10*60_000)){json(res,429,{error:'RATE_LIMITED'});return}
        const body=await parseBody(req);const customer=validateCustomer(body);const service=serviceById(body.serviceId);const startAt=validateDateTime(body.startAt);const endAt=addMinutes(startAt,service.durationMin);const booking=store.createBooking({...customer,serviceId:service.id,startAt,endAt,note:validateNote(body.note)});json(res,201,{booking:{id:booking.id,status:booking.status,startAt:booking.start_at,serviceId:booking.service_id}});return;
      }
      if(req.method==='POST'&&path==='/api/inquiries'){
        if(!hit(`public:${clientIp(req)}`,20,10*60_000)){json(res,429,{error:'RATE_LIMITED'});return}
        const body=await parseBody(req);const customer=validateCustomer(body);const inquiry=store.createInquiry({...customer,topic:String(body.topic||'일반 문의').trim().slice(0,80),message:validateNote(body.message,1000)});json(res,201,{inquiry:{id:inquiry.id,status:inquiry.status}});return;
      }
      if(req.method==='GET'&&path==='/api/admin/bookings'){const session=requireAuth(req,res);if(!session)return;json(res,200,{bookings:store.listBookings()});return}
      if(req.method==='GET'&&path==='/api/admin/inquiries'){const session=requireAuth(req,res);if(!session)return;json(res,200,{inquiries:store.listInquiries()});return}
      if(req.method==='GET'&&path==='/api/admin/customers'){const session=requireAuth(req,res);if(!session)return;json(res,200,{customers:store.listCustomers()});return}
      if(req.method==='GET'&&path==='/api/admin/audit'){const session=requireAuth(req,res);if(!session)return;json(res,200,{audit:store.listAudit()});return}
      if(req.method==='GET'&&path==='/api/admin/employees'){const session=requireAuth(req,res,['ADMIN']);if(!session)return;json(res,200,{employees:store.listEmployees()});return}
      if(req.method==='POST'&&path==='/api/admin/employees'){const session=requireMutation(req,res,['ADMIN']);if(!session)return;const body=await parseBody(req);json(res,201,{employee:store.createEmployee(body,session.employee.id)});return}
      const employeeReset=path.match(/^\/api\/admin\/employees\/([^/]+)\/reset-password$/);if(employeeReset&&req.method==='POST'){const session=requireMutation(req,res,['ADMIN']);if(!session)return;const body=await parseBody(req);json(res,200,{employee:store.resetEmployeePassword(employeeReset[1],body.password,session.employee.id)});return}
      const employeeMatch=path.match(/^\/api\/admin\/employees\/([^/]+)$/);if(employeeMatch&&req.method==='PATCH'){const session=requireMutation(req,res,['ADMIN']);if(!session)return;const body=await parseBody(req);let employee=store.employeeById(employeeMatch[1]);if(!employee){json(res,404,{error:'EMPLOYEE_NOT_FOUND'});return}if(body.role!==undefined)employee=store.setEmployeeRole(employee.id,body.role,session.employee.id);if(body.active!==undefined)employee=store.setEmployeeActive(employee.id,body.active,session.employee.id);json(res,200,{employee});return}
      const bookingMatch=path.match(/^\/api\/admin\/bookings\/([^/]+)$/);if(bookingMatch&&req.method==='PATCH'){const session=requireMutation(req,res);if(!session)return;const body=await parseBody(req);const existing=store.bookingById(bookingMatch[1]);if(!existing){json(res,404,{error:'BOOKING_NOT_FOUND'});return}let startAt=body.startAt,endAt=body.endAt;if(startAt&&!endAt){const service=serviceById(existing.service_id);endAt=addMinutes(validateDateTime(startAt),service.durationMin)}const booking=store.updateBooking(bookingMatch[1],{expectedVersion:body.expectedVersion,status:body.status,startAt,endAt,actorId:session.employee.id});json(res,200,{booking});return}
      const customerMatch=path.match(/^\/api\/admin\/customers\/([^/]+)$/);if(customerMatch&&req.method==='PATCH'){const session=requireMutation(req,res);if(!session)return;const body=await parseBody(req);const customer=store.updateCustomer(customerMatch[1],validateNote(body.memo,1000),session.employee.id);json(res,200,{customer});return}
      const inquiryMatch=path.match(/^\/api\/admin\/inquiries\/([^/]+)$/);if(inquiryMatch&&req.method==='PATCH'){const session=requireMutation(req,res);if(!session)return;const body=await parseBody(req);const inquiry=store.updateInquiry(inquiryMatch[1],{expectedVersion:body.expectedVersion,status:body.status,actorId:session.employee.id});json(res,200,{inquiry});return}
      if(req.method==='GET'&&!path.startsWith('/api/')){let target=path==='/'?'/index.html':path;target=target.replace(/\.\.+/g,'.');const file=resolve(PUBLIC,`.${target}`);if(file.startsWith(PUBLIC)&&existsSync(file)){const ext=file.slice(file.lastIndexOf('.'));res.writeHead(200,{'content-type':contentTypes[ext]||'application/octet-stream',...securityHeaders});res.end(readFileSync(file));return}}
      json(res,404,{error:'NOT_FOUND'});
    }catch(error){json(res,error.status||500,{error:error.message||'INTERNAL_ERROR'})}
  };
  const server=http.createServer(handler);
  return {server,store,listen(port=8798,host='127.0.0.1'){return new Promise(resolveListen=>server.listen(port,host,()=>resolveListen(server.address())))},close(){return new Promise(resolveClose=>server.close(()=>{store.close();resolveClose()}))}};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const app=createBookingApp();const port=Number(process.env.BOOKING_PORT||8798);app.listen(port).then(()=>console.log(`BOOKING CRM listening on http://127.0.0.1:${port}`));
  process.on('SIGTERM',()=>app.close().then(()=>process.exit(0)));
}
