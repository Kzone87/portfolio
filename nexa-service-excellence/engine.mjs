const DEFAULT_POLICY=Object.freeze({
  critical:{tier:'CRITICAL',responseMinutes:30},
  high:{tier:'HIGH',responseMinutes:120},
  normal:{tier:'NORMAL',responseMinutes:480},
  planned:{tier:'PLANNED',responseMinutes:1440}
});

const IMPACT_KEY=new Map([
  ['생산·영업 등 핵심 업무가 멈춤','critical'],
  ['처리량·품질에 큰 영향이 생김','high'],
  ['대체 장비가 있어 일정 조율 가능','normal'],
  ['고장이 아니라 정기점검·설치 작업','planned']
]);

export class ServiceExcellenceError extends Error{
  constructor(code,message,status=400){super(message);this.name='ServiceExcellenceError';this.code=code;this.status=status}
}

const iso=value=>{
  const date=value instanceof Date?value:new Date(value);
  if(!Number.isFinite(date.getTime()))throw new ServiceExcellenceError('INVALID_TIME','유효한 시간이 필요합니다.');
  return date.toISOString();
};

const finitePositive=(value,label)=>{
  const number=Number(value);
  if(!Number.isFinite(number)||number<=0||number>43_200)throw new ServiceExcellenceError('INVALID_POLICY',`${label} 응답 목표 시간을 확인해 주세요.`);
  return Math.round(number);
};

export function normalizeServicePolicy(policy={}){
  const result={};
  for(const [key,fallback] of Object.entries(DEFAULT_POLICY)){
    const value=policy[key]||fallback;
    result[key]={tier:String(value.tier||fallback.tier).trim().toUpperCase(),responseMinutes:finitePositive(value.responseMinutes??fallback.responseMinutes,key)};
  }
  return result;
}

export function serviceTargetForInquiry(inquiry,policy={}){
  const key=IMPACT_KEY.get(String(inquiry?.impact||''))||'normal';
  const normalized=normalizeServicePolicy(policy)[key];
  const createdAt=iso(inquiry?.createdAt||new Date());
  const responseDueAt=new Date(Date.parse(createdAt)+normalized.responseMinutes*60_000).toISOString();
  return {tier:normalized.tier,responseTargetMinutes:normalized.responseMinutes,createdAt,responseDueAt};
}

export function serviceCaseState(serviceCase,at=new Date()){
  if(!serviceCase)throw new ServiceExcellenceError('CASE_REQUIRED','서비스 케이스가 필요합니다.');
  const now=Date.parse(iso(at));
  const due=Date.parse(iso(serviceCase.responseDueAt));
  if(serviceCase.respondedAt){
    const responded=Date.parse(iso(serviceCase.respondedAt));
    return responded<=due?'MET':'BREACHED';
  }
  if(serviceCase.closedAt)return 'CLOSED_UNRESPONDED';
  if(now>due)return 'OVERDUE';
  const created=Date.parse(iso(serviceCase.createdAt));
  const total=Math.max(1,due-created);
  const remaining=due-now;
  return remaining<=Math.max(15*60_000,total*0.25)?'AT_RISK':'ON_TRACK';
}

export function validateFeedback(input){
  const score=Number(input?.score);
  const comment=String(input?.comment||'').trim();
  if(!Number.isInteger(score)||score<1||score>5)throw new ServiceExcellenceError('INVALID_CSAT_SCORE','만족도 점수는 1~5 사이여야 합니다.');
  if(comment.length>1000)throw new ServiceExcellenceError('CSAT_COMMENT_TOO_LONG','만족도 의견은 1000자 이하여야 합니다.');
  return {score,comment};
}

export function notificationRetryAt(attempt,at=new Date()){
  const count=Math.max(1,Math.floor(Number(attempt)||1));
  const delayMinutes=Math.min(360,2**Math.min(8,count-1));
  return new Date(Date.parse(iso(at))+delayMinutes*60_000).toISOString();
}

export function parsePolicyJson(raw=''){
  if(!String(raw).trim())return normalizeServicePolicy();
  let parsed;
  try{parsed=JSON.parse(raw)}catch{throw new ServiceExcellenceError('INVALID_POLICY_JSON','NEXA_SERVICE_TARGETS_JSON must be valid JSON')}
  return normalizeServicePolicy(parsed);
}

export const SERVICE_EXCELLENCE_DEFAULT_POLICY=DEFAULT_POLICY;
