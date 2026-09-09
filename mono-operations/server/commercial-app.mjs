import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCommercialStore, CommercialError } from './commercial-store.mjs';
import { createAiProviderChain } from './ai-provider.mjs';
import { clearSessionCookie, parseCookies, sessionCookie, webhookSignature } from './security.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UI_ROOT = path.resolve(__dirname, '../commercial-ui');

function required(name, value) {
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}
function parseJsonEnv(name, value, fallback) {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch { throw new Error(`${name}_INVALID_JSON`); }
}
function normalizeOrigin(value) {
  try { return new URL(value).origin; } catch { throw new Error('MONO_PUBLIC_ORIGIN_INVALID'); }
}

export function loadCommercialConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const dbPath = env.MONO_DB_PATH || (production ? null : ':memory:');
  const secretKey = env.MONO_SECRET_KEY || (production ? null : Buffer.alloc(32,7).toString('base64'));
  const publicOrigin = normalizeOrigin(env.MONO_PUBLIC_ORIGIN || 'http://127.0.0.1:8796');
  if (production && !publicOrigin.startsWith('https://')) throw new Error('MONO_PUBLIC_ORIGIN_HTTPS_REQUIRED');
  const providers = parseJsonEnv('MONO_AI_PROVIDERS', env.MONO_AI_PROVIDERS, production ? null : [{
    id:'local-test-provider', baseUrl:'http://127.0.0.1:9898/v1', apiKey:'test-only-key', model:'test-model', timeoutMs:5000
  }]);
  if (!Array.isArray(providers) || !providers.length) throw new Error('MONO_AI_PROVIDERS_REQUIRED');
  const allowHosts = String(env.MONO_INTEGRATION_ALLOW_HOSTS || (production ? '' : '127.0.0.1,localhost'))
    .split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
  if (production && !allowHosts.length) throw new Error('MONO_INTEGRATION_ALLOW_HOSTS_REQUIRED');
  return {
    production,
    dbPath: required('MONO_DB_PATH', dbPath),
    secretKey: required('MONO_SECRET_KEY', secretKey),
    publicOrigin,
    providers,
    allowHosts,
    port: Number(env.MONO_PORT || 8796),
    bind: env.MONO_BIND || '127.0.0.1',
    trustProxy: env.MONO_TRUST_PROXY === '1',
    sessionTtlSeconds: Math.max(900, Math.min(86_400, Number(env.MONO_SESSION_TTL_SECONDS || 28_800))),
    integrationPollMs: Math.max(250, Math.min(60_000, Number(env.MONO_INTEGRATION_POLL_MS || 2_000))),
    bootstrapAdminEmail: env.MONO_BOOTSTRAP_ADMIN_EMAIL || '',
    bootstrapAdminName: env.MONO_BOOTSTRAP_ADMIN_NAME || 'MONO Administrator',
    bootstrapAdminPassword: env.MONO_BOOTSTRAP_ADMIN_PASSWORD || ''
  };
}

function securityHeaders(config, contentType = 'application/json; charset=utf-8') {
  return {
    'content-type': contentType,
    'cache-control': contentType.startsWith('text/html') ? 'no-store' : 'no-store',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    ...(config.production ? {'strict-transport-security':'max-age=31536000; includeSubDomains'} : {})
  };
}
function sendJson(res, config, status, body, extraHeaders = {}) {
  res.writeHead(status, {...securityHeaders(config), ...extraHeaders});
  res.end(JSON.stringify(body));
}
function sendText(res, config, status, text, contentType, extraHeaders = {}) {
  res.writeHead(status, {...securityHeaders(config,contentType), ...extraHeaders});
  res.end(text);
}
async function readRawBody(req, limit = 256_000) {
  let size = 0; const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new CommercialError(413,'BODY_TOO_LARGE');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function readJson(req, limit) {
  const raw = await readRawBody(req,limit);
  if (!raw.length) return {};
  try { return JSON.parse(raw.toString('utf8')); } catch { throw new CommercialError(400,'INVALID_JSON'); }
}
function requestIp(req, config) {
  if (config.trustProxy) return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim().slice(0,80);
  return String(req.socket.remoteAddress || '').slice(0,80);
}
function assertSameOrigin(req, config) {
  const origin = req.headers.origin;
  if (origin && origin !== config.publicOrigin) throw new CommercialError(403,'ORIGIN_REJECTED');
}
function sessionFrom(req, store) {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies.mono_session || '';
  const session = store.authenticate(token);
  return {...session,token};
}
function authorizeMutation(req, store, config) {
  assertSameOrigin(req,config);
  const session = sessionFrom(req,store);
  store.assertCsrf(session.sessionHash,req.headers['x-csrf-token']);
  return session;
}
function publicConnectionEndpointAllowed(endpointUrl, config) {
  let url;
  try { url = new URL(endpointUrl); } catch { throw new CommercialError(400,'INVALID_ENDPOINT_URL'); }
  if (config.production && url.protocol !== 'https:') throw new CommercialError(400,'HTTPS_ENDPOINT_REQUIRED');
  if (!config.allowHosts.includes(url.hostname.toLowerCase())) throw new CommercialError(400,'ENDPOINT_HOST_NOT_ALLOWED');
  if (url.username || url.password) throw new CommercialError(400,'ENDPOINT_CREDENTIALS_FORBIDDEN');
  return url.toString();
}
function routeMatch(pathname, pattern) { return pathname.match(pattern); }

function staticFile(pathname) {
  const requestPath = pathname === '/' ? '/index.html' : pathname;
  const normalized = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, '');
  const file = path.resolve(UI_ROOT, `.${normalized.startsWith('/') ? normalized : `/${normalized}`}`);
  if (!file.startsWith(UI_ROOT)) return null;
  return file;
}
function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

export async function processIntegrationOnce({store,config,fetchImpl=globalThis.fetch}) {
  const claimed = store.claimDueIntegrationRun();
  if (!claimed) return false;
  let success = false; let detail = '';
  try {
    const endpoint = publicConnectionEndpointAllowed(claimed.target.endpointUrl,config);
    const outboundBody = JSON.stringify({
      eventId: claimed.event.event_id,
      type: claimed.event.type,
      payload: claimed.event.payload
    });
    const response = await fetchImpl(endpoint,{
      method:'POST',
      headers:{
        'content-type':'application/json',
        'x-mono-event-id':claimed.event.event_id,
        'x-mono-signature':webhookSignature(Buffer.from(outboundBody),claimed.target.secret)
      },
      body:outboundBody,
      signal:AbortSignal.timeout(15_000)
    });
    success = response.ok;
    detail = success ? `HTTP ${response.status}` : `HTTP ${response.status} ${String(await response.text()).slice(0,300)}`;
  } catch (error) {
    detail = error?.name === 'TimeoutError' ? 'OUTBOUND_TIMEOUT' : `OUTBOUND_ERROR ${String(error?.message || error).slice(0,300)}`;
  }
  store.completeIntegrationRun({queueId:claimed.queue.id,success,detail});
  return true;
}

export function createCommercialRuntime({config=loadCommercialConfig(),store=null,fetchImpl=globalThis.fetch}={}) {
  const ownedStore = store || createCommercialStore({dbPath:config.dbPath,secretKey:config.secretKey,sessionTtlSeconds:config.sessionTtlSeconds});
  const userCount = Number(ownedStore.db.prepare('SELECT COUNT(*) c FROM users').get().c);
  if (userCount === 0) {
    if (!config.bootstrapAdminEmail || !config.bootstrapAdminPassword) throw new Error('MONO_BOOTSTRAP_ADMIN_REQUIRED_FOR_EMPTY_DATABASE');
    ownedStore.ensureBootstrapAdmin({email:config.bootstrapAdminEmail,name:config.bootstrapAdminName,password:config.bootstrapAdminPassword});
  }
  const ai = createAiProviderChain({providers:config.providers,fetchImpl});
  let workerTimer = null; let workerBusy = false;
  async function workerTick(){
    if(workerBusy)return; workerBusy=true;
    try{for(let i=0;i<20;i+=1){if(!(await processIntegrationOnce({store:ownedStore,config,fetchImpl})))break}}
    finally{workerBusy=false}
  }
  function startWorker(){ if(workerTimer)return; workerTimer=setInterval(workerTick,config.integrationPollMs); workerTimer.unref?.(); }
  function stopWorker(){ if(workerTimer){clearInterval(workerTimer);workerTimer=null} }

  const server = http.createServer(async(req,res)=>{
    const url = new URL(req.url || '/',config.publicOrigin);
    const pathname = url.pathname;
    try {
      if (req.method==='GET' && pathname==='/health') return sendJson(res,config,200,{ok:true,service:'mono-operations-commercial'});
      if (req.method==='GET' && pathname==='/ready') return sendJson(res,config,ownedStore.ready()?200:503,{ready:ownedStore.ready(),database:ownedStore.ready()});

      const webhook = routeMatch(pathname,/^\/api\/webhooks\/([^/]+)$/);
      if (req.method==='POST' && webhook) {
        const raw = await readRawBody(req,512_000);
        let input; try{input=JSON.parse(raw.toString('utf8'))}catch{throw new CommercialError(400,'INVALID_JSON')}
        const event = ownedStore.ingestWebhook({connectionId:decodeURIComponent(webhook[1]),rawBody:raw,signature:req.headers['x-mono-signature'],input});
        workerTick();
        return sendJson(res,config,event.replayed?200:202,{event});
      }

      if (req.method==='POST' && pathname==='/api/auth/login') {
        assertSameOrigin(req,config);
        const payload = await readJson(req,32_768);
        const result = ownedStore.login({email:payload.email,password:payload.password,ip:requestIp(req,config)});
        return sendJson(res,config,200,{user:result.user,csrfToken:result.csrf,expiresAt:result.expiresAt},{'set-cookie':sessionCookie(result.token,{secure:config.production,maxAge:config.sessionTtlSeconds})});
      }

      if (pathname.startsWith('/api/')) {
        if (req.method==='POST' && pathname==='/api/auth/logout') {
          const session = authorizeMutation(req,ownedStore,config);
          ownedStore.logout(session.token,session.user.id);
          return sendJson(res,config,200,{ok:true},{'set-cookie':clearSessionCookie({secure:config.production})});
        }
        const session = req.method==='GET' ? sessionFrom(req,ownedStore) : authorizeMutation(req,ownedStore,config);
        const actorId = session.user.id;

        if (req.method==='GET' && pathname==='/api/me') return sendJson(res,config,200,{user:session.user,csrfToken:req.headers['x-csrf-token']||null});
        if (req.method==='GET' && pathname==='/api/work-items') return sendJson(res,config,200,{items:ownedStore.listWorkItems(actorId)});
        let match = routeMatch(pathname,/^\/api\/work-items\/([^/]+)\/acknowledge$/);
        if(req.method==='POST'&&match){const p=await readJson(req,16_384);return sendJson(res,config,200,{item:ownedStore.acknowledgeWorkItem(actorId,decodeURIComponent(match[1]),p.expectedVersion)})}

        if(req.method==='GET'&&pathname==='/api/admin/users')return sendJson(res,config,200,{items:ownedStore.listUsers(actorId)});
        if(req.method==='POST'&&pathname==='/api/admin/users'){const p=await readJson(req,32_768);return sendJson(res,config,201,{user:ownedStore.createUser({...p,actorId})})}
        match=routeMatch(pathname,/^\/api\/admin\/users\/([^/]+)\/active$/);
        if(req.method==='POST'&&match){const p=await readJson(req,8192);return sendJson(res,config,200,{user:ownedStore.setUserActive(actorId,decodeURIComponent(match[1]),Boolean(p.active))})}
        if(req.method==='GET'&&pathname==='/api/audit')return sendJson(res,config,200,{items:ownedStore.listAudit(actorId,Number(url.searchParams.get('limit')||100))});

        if(req.method==='GET'&&pathname==='/api/orders')return sendJson(res,config,200,{items:ownedStore.listOrders(actorId)});
        if(req.method==='POST'&&pathname==='/api/orders'){const p=await readJson(req,32_768);return sendJson(res,config,201,{order:ownedStore.createOrder(actorId,p)})}
        match=routeMatch(pathname,/^\/api\/orders\/([^/]+)\/status$/);
        if(req.method==='POST'&&match){const p=await readJson(req,16_384);return sendJson(res,config,200,{order:ownedStore.transitionOrder(actorId,decodeURIComponent(match[1]),p.status,p.expectedVersion)})}
        match=routeMatch(pathname,/^\/api\/orders\/([^/]+)\/refunds$/);
        if(req.method==='POST'&&match){const p=await readJson(req,32_768);return sendJson(res,config,201,{refund:ownedStore.createRefund(actorId,decodeURIComponent(match[1]),p)})}
        match=routeMatch(pathname,/^\/api\/refunds\/([^/]+)\/decision$/);
        if(req.method==='POST'&&match){const p=await readJson(req,32_768);return sendJson(res,config,200,{refund:ownedStore.decideRefund(actorId,decodeURIComponent(match[1]),p)})}

        if(req.method==='GET'&&pathname==='/api/documents')return sendJson(res,config,200,{items:ownedStore.listDocuments(actorId)});
        if(req.method==='POST'&&pathname==='/api/documents'){const p=await readJson(req,64_000);return sendJson(res,config,201,{document:ownedStore.createDocument(actorId,p)})}
        match=routeMatch(pathname,/^\/api\/documents\/([^/]+)$/);
        if(req.method==='PUT'&&match){const p=await readJson(req,64_000);return sendJson(res,config,200,{document:ownedStore.updateDocument(actorId,decodeURIComponent(match[1]),p)})}
        match=routeMatch(pathname,/^\/api\/documents\/([^/]+)\/submit$/);
        if(req.method==='POST'&&match){const p=await readJson(req,8192);return sendJson(res,config,200,{document:ownedStore.submitDocument(actorId,decodeURIComponent(match[1]),p.expectedVersion)})}
        match=routeMatch(pathname,/^\/api\/documents\/([^/]+)\/review$/);
        if(req.method==='POST'&&match){const p=await readJson(req,32_768);return sendJson(res,config,200,{document:ownedStore.reviewDocument(actorId,decodeURIComponent(match[1]),p)})}
        match=routeMatch(pathname,/^\/api\/documents\/([^/]+)\/archive$/);
        if(req.method==='POST'&&match){const p=await readJson(req,8192);return sendJson(res,config,200,{document:ownedStore.archiveDocument(actorId,decodeURIComponent(match[1]),p.expectedVersion)})}

        if(req.method==='GET'&&pathname==='/api/support/knowledge')return sendJson(res,config,200,{items:ownedStore.listKnowledge(actorId)});
        if(req.method==='POST'&&pathname==='/api/support/knowledge'){const p=await readJson(req,64_000);return sendJson(res,config,201,{document:ownedStore.createKnowledgeDoc(actorId,p)})}
        if(req.method==='GET'&&pathname==='/api/support/tasks')return sendJson(res,config,200,{items:ownedStore.listSupportTasks(actorId)});
        if(req.method==='POST'&&pathname==='/api/support/tasks'){const p=await readJson(req,32_768);return sendJson(res,config,201,{task:ownedStore.createSupportTask(actorId,p)})}
        match=routeMatch(pathname,/^\/api\/support\/tasks\/([^/]+)\/generate$/);
        if(req.method==='POST'&&match){
          const p=await readJson(req,8192);const id=decodeURIComponent(match[1]);const context=ownedStore.supportGenerationContext(actorId,id,p.expectedVersion);
          try{const generated=await ai.generate(context);return sendJson(res,config,200,ownedStore.recordSupportGeneration(actorId,id,{expectedVersion:p.expectedVersion,providerId:generated.providerId,output:generated.output,evaluation:generated.evaluation,evidence:context.evidence}))}
          catch(error){ownedStore.recordSupportGeneration(actorId,id,{expectedVersion:p.expectedVersion,providerId:error?.attempts?.at(-1)?.providerId||'provider-chain',evidence:context.evidence,errorCode:error?.code||'AI_GENERATION_FAILED'});throw new CommercialError(502,error?.code||'AI_GENERATION_FAILED')}
        }
        match=routeMatch(pathname,/^\/api\/support\/tasks\/([^/]+)\/review$/);
        if(req.method==='POST'&&match){const p=await readJson(req,32_768);return sendJson(res,config,200,ownedStore.reviewSupportTask(actorId,decodeURIComponent(match[1]),p))}

        if(req.method==='GET'&&pathname==='/api/integrations/connections')return sendJson(res,config,200,{items:ownedStore.listIntegrationConnections(actorId)});
        if(req.method==='POST'&&pathname==='/api/integrations/connections'){const p=await readJson(req,32_768);if(String(p.kind).toUpperCase()==='OUTBOUND_HTTP')p.endpointUrl=publicConnectionEndpointAllowed(p.endpointUrl,config);return sendJson(res,config,201,{connection:ownedStore.createIntegrationConnection(actorId,p)})}
        if(req.method==='GET'&&pathname==='/api/integrations/jobs')return sendJson(res,config,200,{items:ownedStore.listIntegrationJobs(actorId)});
        if(req.method==='POST'&&pathname==='/api/integrations/jobs'){const p=await readJson(req,32_768);return sendJson(res,config,201,{job:ownedStore.createIntegrationJob(actorId,p)})}
        if(req.method==='GET'&&pathname==='/api/integrations/runs')return sendJson(res,config,200,{items:ownedStore.listIntegrationRuns(actorId,Number(url.searchParams.get('limit')||100))});
        if(req.method==='GET'&&pathname==='/api/integrations/dead-letters')return sendJson(res,config,200,{items:ownedStore.listDeadLetters(actorId)});
        match=routeMatch(pathname,/^\/api\/integrations\/dead-letters\/([^/]+)\/retry$/);
        if(req.method==='POST'&&match)return sendJson(res,config,200,{run:ownedStore.retryDeadLetter(actorId,decodeURIComponent(match[1]))});

        return sendJson(res,config,404,{error:'NOT_FOUND'});
      }

      if (req.method==='GET' || req.method==='HEAD') {
        const file=staticFile(pathname);
        if(file&&fs.existsSync(file)&&fs.statSync(file).isFile()){
          const data=fs.readFileSync(file);res.writeHead(200,{...securityHeaders(config,contentType(file)),'cache-control':file.endsWith('.html')?'no-store':'public, max-age=300'});return res.end(req.method==='HEAD'?undefined:data)
        }
        if(!path.extname(pathname)){
          const index=path.join(UI_ROOT,'index.html');if(fs.existsSync(index))return sendText(res,config,200,fs.readFileSync(index,'utf8'),'text/html; charset=utf-8');
        }
      }
      return sendJson(res,config,404,{error:'NOT_FOUND'});
    } catch (error) {
      const status = error instanceof CommercialError ? error.status : 500;
      const code = error instanceof CommercialError ? error.code : 'INTERNAL_ERROR';
      if(status===500) console.error('[MONO]',error);
      return sendJson(res,config,status,{error:code});
    }
  });

  function close(){stopWorker();return new Promise(resolve=>server.close(()=>{ownedStore.checkpoint();ownedStore.close();resolve()}))}
  return {server,store:ownedStore,startWorker,stopWorker,workerTick,close};
}

if(import.meta.url===`file://${process.argv[1]}`){
  const config=loadCommercialConfig();
  const runtime=createCommercialRuntime({config});
  runtime.server.listen(config.port,config.bind,()=>{
    runtime.startWorker();
    console.log(`MONO Commercial Runtime listening on ${config.bind}:${config.port}`);
  });
  const shutdown=()=>runtime.close().finally(()=>process.exit(0));
  process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
}
