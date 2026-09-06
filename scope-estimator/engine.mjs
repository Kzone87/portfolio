const PROJECTS={
feature:{label:'작은 기능 / 기존 서비스 보완',base:1,phase:'변경 대상 기능 1개와 영향 범위를 먼저 고정하고 구현·검증합니다.'},
excel:{label:'Excel / CSV 업무자동화',base:2,phase:'대표 입력 파일을 기준으로 Import → 검증 → 변환 → Export 흐름부터 완성합니다.'},
admin:{label:'관리자페이지 / CRM / 업무관리',base:2,phase:'핵심 데이터 1~2개와 CRUD·권한·상태 처리부터 1차 운영 버전으로 만듭니다.'},
ai:{label:'AI Workflow / Local RAG',base:2,phase:'AI가 처리할 업무 1개와 근거 데이터, Structured Output, Human Review 경계를 먼저 검증합니다.'},
integration:{label:'REST API / 시스템 연동',base:2,phase:'Source → Target 한 방향과 validation·실패처리·중복방지부터 검증합니다.'},
commerce:{label:'쇼핑몰 주문 / 운영관리',base:2,phase:'Order → Fulfillment 핵심 흐름과 Hold/Refund 정책부터 운영 가능한 1차 버전으로 만듭니다.'},
field:{label:'예약 / 배차 / 현장서비스',base:2,phase:'예약 시간대와 담당자 배정, 충돌 방지, Dispatch → Complete 핵심 흐름부터 만듭니다.'},
document:{label:'문서접수 / 검수 / 승인',base:2,phase:'문서 유형 1개를 기준으로 제출 → 검수 → 수정요청/승인 Workflow부터 완성합니다.'}
};
const PACKAGE_LEVELS=[{max:1,name:'STANDARD',budget:'49~99만원',note:'범위가 명확한 작은 기능 또는 단일 자동화에 적합합니다.'},{max:3,name:'DELUXE',budget:'149~299만원',note:'하나의 업무 흐름을 실제 사용 가능한 도구로 구현하는 범위입니다.'},{max:5,name:'PREMIUM',budget:'299~499만원',note:'여러 데이터 관계·권한·상태·AI/연동이 함께 필요한 운영 시스템 범위입니다.'},{max:Infinity,name:'CUSTOM',budget:'499만원 이상',note:'복수 모듈·고급 승인·복수 연동을 단계별 프로젝트로 나누는 편이 적합합니다.'}];
const ALLOWED={projectType:new Set(Object.keys(PROJECTS)),existing:new Set(['new','existing']),roles:new Set(['single','multi']),data:new Set(['simple','relational']),integrations:new Set(['none','one','multiple']),operation:new Set(['basic','advanced']),schedule:new Set(['normal','urgent'])};
export function sanitizeScopeInput(value={}){const out={};for(const[key,allowed]of Object.entries(ALLOWED)){const candidate=typeof value[key]==='string'?value[key]:'';out[key]=allowed.has(candidate)?candidate:[...allowed][0];}return out;}
export function evaluateScope(raw){const input=sanitizeScopeInput(raw),project=PROJECTS[input.projectType];let score=project.base;const reasons=[];
if(input.projectType==='ai')reasons.push('AI 근거·output schema와 사람의 승인 지점 정의 필요');
if(input.projectType==='commerce')reasons.push('주문·결제·출고·환불 상태 경계 정의 필요');
if(input.projectType==='field')reasons.push('예약 시간대와 담당자 충돌 정책 정의 필요');
if(input.projectType==='document')reasons.push('문서 유형별 checklist와 reviewer 권한 정의 필요');
if(input.existing==='existing'){score++;reasons.push('기존 소스 분석과 회귀 확인 필요');}
if(input.roles==='multi'){score++;reasons.push('복수 사용자 역할/권한 필요');}
if(input.data==='relational'){score++;reasons.push('여러 데이터 관계 필요');}
if(input.integrations==='one'){score++;reasons.push(input.projectType==='ai'?'AI provider/API 연동 1개':'외부 서비스/API 연동 1개');}else if(input.integrations==='multiple'){score+=2;reasons.push(input.projectType==='ai'?'복수 AI/외부 provider 연동':'복수 외부 서비스/API 연동');}
if(input.operation==='advanced'){score++;reasons.push(input.projectType==='ai'?'Evidence/Evaluation/Audit/Fallback 운영 고도화':'Audit/승인/재시도/대량처리 등 운영 고도화');}
if(input.schedule==='urgent'){score++;reasons.push('일정 제약이 큰 프로젝트');}
const pkg=PACKAGE_LEVELS.find(x=>score<=x.max);return{input,score,projectLabel:project.label,packageName:pkg.name,budget:pkg.budget,packageNote:pkg.note,firstPhase:project.phase,reasons:reasons.length?reasons:['복잡도 추가 조건이 적은 기본 범위']};}
export function buildBrief(result){const i=result.input,labels={existing:i.existing==='existing'?'기존 시스템 수정':'신규 개발',roles:i.roles==='multi'?'복수 역할/권한':'단일 관리자 중심',data:i.data==='relational'?'관계형 데이터 여러 개':'단순 데이터 구조',integrations:i.integrations==='none'?'외부 연동 없음':i.integrations==='one'?'외부 연동 1개':'외부 연동 여러 개',operation:i.operation==='advanced'?'운영 고도화 필요':'기본 운영 기능',schedule:i.schedule==='urgent'?'일정 제약 큼':'일반 일정'};return['[1차 개발 범위 문의]',`프로젝트 유형: ${result.projectLabel}`,`개발 형태: ${labels.existing}`,`사용자/권한: ${labels.roles}`,`데이터 구조: ${labels.data}`,`외부 연동: ${labels.integrations}`,`운영 요구: ${labels.operation}`,`일정: ${labels.schedule}`,'',`예상 패키지 가이드: ${result.packageName}`,`예산 참고 구간: ${result.budget}`,`추천 1차 범위: ${result.firstPhase}`,'','현재 업무 방식:','가장 불편한 점:','개발 후 반드시 가능해야 하는 결과:'].join('\n');}
export const scopeCatalog=Object.freeze({projectTypes:Object.fromEntries(Object.entries(PROJECTS).map(([k,v])=>[k,v.label])),packages:PACKAGE_LEVELS.map(({name,budget})=>({name,budget}))});
