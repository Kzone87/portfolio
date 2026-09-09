const seedWork = Object.freeze([
  { id:'W-101', module:'MARKET', title:'고액 환불 승인', detail:'ORD-260904 · 180,000원 · 파손 접수', owner:'운영 관리자', age:'12분 전', kind:'APPROVAL', priority:'승인', href:'../commerce-ops-console/' },
  { id:'W-102', module:'OFFICE', title:'서비스 계약 검수', detail:'CTR-2609 · 적용일 확인 필요', owner:'문서 검수', age:'21분 전', kind:'URGENT', priority:'긴급', href:'../document-intake-approval/' },
  { id:'W-103', module:'SUPPORT', title:'중복 결제 환불 문의 검토', detail:'관련 환불 정책 근거 3건 · 담당자 최종확인 필요', owner:'고객지원', age:'34분 전', kind:'APPROVAL', priority:'승인', href:'../ai-workflow-review-desk/' },
  { id:'W-104', module:'DATA HUB', title:'재고 연동 실패', detail:'Warehouse → ERP · 연결 상태 확인 필요', owner:'데이터 운영', age:'42분 전', kind:'FAILURE', priority:'실패', href:'../integration-control-center/' },
  { id:'W-105', module:'MARKET', title:'출고 지연 주문', detail:'ORD-260902 · 주소 확인 보류', owner:'주문 운영', age:'1시간 전', kind:'URGENT', priority:'긴급', href:'../commerce-ops-console/' },
  { id:'W-106', module:'DATA HUB', title:'Dead Letter 확인', detail:'inventory.updated · 재시도 한도 도달', owner:'운영 관리자', age:'2시간 전', kind:'FAILURE', priority:'실패', href:'../integration-control-center/' }
]);
const seedAudits = Object.freeze([
  { time:'09:42', module:'DATA HUB', text:'재고 연동 실행이 실패하여 확인 업무를 생성했습니다.' },
  { time:'09:37', module:'SUPPORT', text:'문의 #C-88 자동 제안이 담당자 검토 단계로 이동했습니다.' },
  { time:'09:34', module:'OFFICE', text:'문서 #D-201이 검수 대기 상태로 제출되었습니다.' },
  { time:'09:31', module:'MARKET', text:'주문 ORD-260903이 피킹 단계로 이동했습니다.' }
]);
let work = seedWork.map(item=>({...item}));
let audits = seedAudits.map(item=>({...item}));
let currentFilter = 'ALL';
const $ = id => document.getElementById(id);
const workList = $('workList');
const auditList = $('auditList');
const toast = $('toast');
function esc(value){return String(value).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));}
function priorityClass(kind){return kind==='URGENT'?'urgent':kind==='APPROVAL'?'approval':kind==='FAILURE'?'failure':'normal';}
function renderWork(){
  const visible = currentFilter==='ALL' ? work : work.filter(item=>item.kind===currentFilter);
  workList.innerHTML = visible.length ? visible.map(item=>`<article class="work-item" data-work-id="${esc(item.id)}" data-kind="${esc(item.kind)}"><span class="module-badge">${esc(item.module)}</span><div class="work-copy"><strong>${esc(item.title)}</strong><small>${esc(item.detail)}</small></div><span class="work-owner">${esc(item.owner)}</span><span class="work-age">${esc(item.age)}</span><a class="work-action" href="${esc(item.href)}">처리하기</a><span class="priority-badge ${priorityClass(item.kind)}">${esc(item.priority)}</span></article>`).join('') : '<p class="demo-boundary">현재 조건에 해당하는 대기 업무가 없습니다.</p>';
  $('allCount').textContent = String(work.length);
}
function renderAudits(){auditList.innerHTML = audits.slice(0,8).map(item=>`<article class="audit-item"><time>${esc(item.time)}</time><b>${esc(item.module)}</b><p>${esc(item.text)}</p></article>`).join('');}
function nowHm(){return new Intl.DateTimeFormat('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());}
function notify(message){toast.textContent=message;toast.classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>toast.classList.remove('show'),2600);}
function addAudit(module,text){audits.unshift({time:nowHm(),module,text});renderAudits();}
function simulateOrderEvent(){
  if(work.some(item=>item.id==='W-LIVE')){notify('같은 이벤트는 중복 등록되지 않습니다.');return;}
  work.unshift({id:'W-LIVE',module:'MARKET',title:'신규 주문 연동 확인',detail:'ORD-261010 · DATA HUB order.updated에서 생성',owner:'주문 운영',age:'방금',kind:'NORMAL',priority:'신규',href:'../commerce-ops-console/'});
  const orders=Number($('metricOrders').textContent)||0;$('metricOrders').textContent=String(orders+1);
  addAudit('DATA HUB','order.updated 이벤트를 중복 확인 후 MARKET 신규 주문 업무로 전달했습니다.');
  addAudit('MARKET','ORD-261010 신규 주문이 통합 업무함에 생성되었습니다.');
  renderWork();notify('DATA HUB → MARKET 주문 이벤트가 정상 처리되었습니다.');
}
function resetDemo(){work=seedWork.map(item=>({...item}));audits=seedAudits.map(item=>({...item}));currentFilter='ALL';document.querySelectorAll('.filter').forEach(button=>button.classList.toggle('active',button.dataset.filter==='ALL'));$('metricOrders').textContent='12';renderWork();renderAudits();notify('가상 운영 데이터를 초기 상태로 되돌렸습니다.');}
document.querySelectorAll('.filter').forEach(button=>button.addEventListener('click',()=>{currentFilter=button.dataset.filter||'ALL';document.querySelectorAll('.filter').forEach(item=>item.classList.toggle('active',item===button));renderWork();}));
$('simulateEvent').addEventListener('click',simulateOrderEvent);
$('resetDemo').addEventListener('click',resetDemo);
$('mobileMenu').addEventListener('click',()=>{const open=document.body.classList.toggle('menu-open');$('mobileMenu').setAttribute('aria-expanded',String(open));});
document.querySelectorAll('.side-nav a').forEach(link=>link.addEventListener('click',()=>{if(innerWidth<=760){document.body.classList.remove('menu-open');$('mobileMenu').setAttribute('aria-expanded','false');}}));
renderWork();renderAudits();