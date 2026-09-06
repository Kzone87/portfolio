const txt=v=>String(v??'').trim();

// CMS LAB
export function slugify(value){return txt(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-+|-+$/g,'').slice(0,80);}
export function validateContent(input){const title=txt(input?.title),body=txt(input?.body),slug=slugify(input?.slug||title);const errors=[];if(title.length<3||title.length>120)errors.push('TITLE_LENGTH');if(body.length<20||body.length>10000)errors.push('BODY_LENGTH');if(!slug)errors.push('SLUG_REQUIRED');return{valid:errors.length===0,errors,content:{title,body,slug,status:input?.status==='PUBLISHED'?'PUBLISHED':'DRAFT'}};}
export function publishContent(input){const result=validateContent(input);if(!result.valid)throw new Error(`CONTENT_INVALID:${result.errors.join(',')}`);return{...result.content,status:'PUBLISHED',publishedAt:'DETERMINISTIC-DEMO'};}

// EXTRACTION LAB
export function parseKeyValueText(source){const out={};for(const line of String(source??'').split(/\r?\n/)){const m=line.match(/^\s*([^:]{1,60})\s*:\s*(.*?)\s*$/);if(!m)continue;const key=slugify(m[1]).replaceAll('-','_');if(key&&!(key in out))out[key]=m[2].slice(0,500);}return out;}
export function extractTableRows(csv){const lines=String(csv??'').trim().split(/\r?\n/).filter(Boolean);if(!lines.length)return[];const headers=lines[0].split(',').map(x=>txt(x));if(headers.some(x=>!x)||new Set(headers).size!==headers.length)throw new Error('INVALID_HEADERS');return lines.slice(1).map((line,rowIndex)=>{const values=line.split(',').map(x=>txt(x));if(values.length!==headers.length)throw new Error(`COLUMN_MISMATCH:${rowIndex+2}`);return Object.fromEntries(headers.map((h,i)=>[h,values[i]]));});}

// BROWSER AUTOMATION LAB — deterministic workflow validation, no external browsing.
const STEP_TYPES=new Set(['NAVIGATE','INPUT','CLICK','ASSERT_TEXT']);
export function validateAutomationPlan(plan){if(!Array.isArray(plan)||plan.length<1||plan.length>20)throw new Error('PLAN_LENGTH');const ids=new Set();return plan.map((step,index)=>{const id=txt(step?.id||`step-${index+1}`),type=txt(step?.type).toUpperCase(),target=txt(step?.target),value=txt(step?.value);if(ids.has(id))throw new Error('DUPLICATE_STEP_ID');ids.add(id);if(!STEP_TYPES.has(type))throw new Error('UNSUPPORTED_STEP');if(!target)throw new Error('TARGET_REQUIRED');if(type==='NAVIGATE'){let url;try{url=new URL(target);}catch{throw new Error('INVALID_URL');}if(url.protocol!=='https:'||!['example.com','demo.example.com'].includes(url.hostname))throw new Error('NAVIGATION_NOT_ALLOWLISTED');}return{id,type,target,value};});}
export function simulateAutomation(plan,options={}){const validated=validateAutomationPlan(plan);const failAt=txt(options.failAt);const events=[];for(const step of validated){if(step.id===failAt){events.push({stepId:step.id,status:'FAILED',error:'SIMULATED_FAILURE'});return{status:'FAILED',events,completed:events.filter(e=>e.status==='SUCCESS').length};}events.push({stepId:step.id,status:'SUCCESS'});}return{status:'SUCCESS',events,completed:events.length};}

// SECURITY LAB
export function isAllowedOrigin(origin,allowed=['https://example.com']){try{const u=new URL(origin);return u.protocol==='https:'&&allowed.includes(u.origin);}catch{return false;}}
export function safeRedirect(value,base='https://example.com'){try{const target=new URL(value,base),origin=new URL(base).origin;if(target.origin!==origin)return'/';return`${target.pathname}${target.search}${target.hash}`;}catch{return'/';}}
export function maskSecret(value){const s=String(value??'');if(s.length<=4)return'*'.repeat(s.length);return`${s.slice(0,2)}${'*'.repeat(Math.min(12,s.length-4))}${s.slice(-2)}`;}
export function safeSpreadsheetCell(value){const s=String(value??'');return /^[=+\-@]/.test(s)?`'${s}`:s;}
export function securityHeaders(){return{'content-security-policy':"default-src 'self'; object-src 'none'; base-uri 'self'",'x-content-type-options':'nosniff','referrer-policy':'no-referrer','permissions-policy':'camera=(), microphone=(), geolocation=()'};}

// QA / DEPLOYMENT LAB
export function evaluateRelease(input={}){const checks=[['tests',Boolean(input.tests)],['build',Boolean(input.build)],['secretScan',Boolean(input.secretScan)],['healthCheck',Boolean(input.healthCheck)],['rollbackPlan',Boolean(input.rollbackPlan)]];const failed=checks.filter(([,ok])=>!ok).map(([name])=>name);const warnings=[];if(!input.observability)warnings.push('OBSERVABILITY_MISSING');if(!input.backupVerified)warnings.push('BACKUP_NOT_VERIFIED');return{ready:failed.length===0,failed,warnings,score:Math.round(((checks.length-failed.length)/checks.length)*100)};}
export function deploymentDecision(input={}){const result=evaluateRelease(input);return{...result,decision:result.ready?'GO':'NO_GO',reason:result.ready?'required release gates passed':`blocked by ${result.failed.join(', ')}`};}
