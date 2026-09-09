import {SERVICES,createDemoState,createBooking,createInquiry,transitionBooking,rescheduleBooking,updateCustomerMemo,transitionInquiry,metrics} from './engine.mjs';

const state=createDemoState();
let selectedService=SERVICES[0].id;
let selectedSlot='10:00';
let selectedBookingId=state.bookings[0]?.id||null;

const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const statusLabel={REQUESTED:'요청',CONFIRMED:'확정',COMPLETED:'완료',CANCELLED:'취소',NEW:'신규',CONTACTED:'연락완료',CLOSED:'종료'};
const fmt=iso=>new Intl.DateTimeFormat('ko-KR',{month:'short',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(iso));

function setView(view){
  $$('.nav-btn').forEach(btn=>btn.classList.toggle('is-active',btn.dataset.view===view));
  $$('.view-panel').forEach(panel=>panel.classList.toggle('is-active',panel.dataset.panel===view));
  document.getElementById(`${view}-view`)?.scrollIntoView({behavior:'smooth',block:'start'});
  if(view==='admin') renderAdmin();
}

function nextDate(offset=1){const d=new Date();d.setDate(d.getDate()+offset);return d.toISOString().slice(0,10)}
function currentStartAt(){return new Date(`${$('#booking-date').value}T${selectedSlot}:00`).toISOString()}

function renderServices(){
  $('#service-options').innerHTML=SERVICES.map(s=>`<button type="button" class="service-option ${s.id===selectedService?'is-selected':''}" data-service="${s.id}"><b>${esc(s.name)}</b><span>${s.durationMin}분 · ${esc(s.priceLabel)}</span></button>`).join('');
}
function renderSlots(){
  const slots=['09:00','10:00','11:30','14:00','15:30','17:00'];
  if(!slots.includes(selectedSlot)) selectedSlot=slots[0];
  $('#slot-options').innerHTML=slots.map(slot=>`<button type="button" class="slot-option ${slot===selectedSlot?'is-selected':''}" data-slot="${slot}">${slot}</button>`).join('');
}

function renderTicket(item){
  $('#booking-ticket').className='ticket';
  $('#booking-ticket').innerHTML=`<div class="ticket-top"><div><small>예약번호</small><b>${esc(item.id)}</b></div><span class="status ${item.status}">${statusLabel[item.status]}</span></div><dl><dt>서비스</dt><dd>${esc(item.serviceName)}</dd><dt>일정</dt><dd>${esc(fmt(item.startAt))}</dd><dt>예약자</dt><dd>${esc(item.customerName)}</dd><dt>요청사항</dt><dd>${esc(item.note||'없음')}</dd></dl><p>공개 데모이므로 이 예약은 서버에 저장되지 않습니다. 관리자 화면에서 같은 요청의 처리 흐름을 이어서 체험할 수 있습니다.</p><button type="button" class="secondary full" data-go-admin>관리자에서 확인하기</button>`;
}

function renderMetrics(){
  const m=metrics(state); const cards=[['신규 예약',m.requested],['확정 예약',m.confirmed],['운영 예약',m.today],['열린 문의',m.inquiries],['고객',m.customers]];
  $('#metric-grid').innerHTML=cards.map(([label,value])=>`<article class="metric"><span>${label}</span><b>${value}</b></article>`).join('');
}
function filteredBookings(){const filter=$('#booking-filter').value;return state.bookings.filter(item=>filter==='ALL'||item.status===filter)}
function renderBookingList(){
  const rows=filteredBookings();
  $('#booking-list').innerHTML=rows.length?rows.map(item=>`<button type="button" class="booking-row ${item.id===selectedBookingId?'is-selected':''}" data-booking-id="${item.id}"><div><strong>${esc(item.customerName)} · ${esc(item.serviceName)}</strong><small>${esc(fmt(item.startAt))} · ${esc(item.customerPhone)}</small></div><span class="status ${item.status}">${statusLabel[item.status]}</span></button>`).join(''):'<div class="empty-state"><strong>조건에 맞는 예약이 없습니다.</strong></div>';
}
function renderDetail(){
  const item=state.bookings.find(row=>row.id===selectedBookingId);
  if(!item){$('#booking-detail').className='empty-state';$('#booking-detail').innerHTML='<strong>예약을 선택하세요.</strong><p>왼쪽 Queue에서 예약을 선택하면 상세 정보가 표시됩니다.</p>';$('#detail-version').textContent='선택 없음';return}
  const customer=state.customers.find(row=>row.id===item.customerId);
  $('#detail-version').textContent=`v${item.version}`;
  $('#booking-detail').className='';
  const actions=[];
  if(item.status==='REQUESTED') actions.push('<button data-action="confirm">예약 확정</button>');
  if(item.status==='CONFIRMED') actions.push('<button data-action="complete">서비스 완료</button>');
  if(!['COMPLETED','CANCELLED'].includes(item.status)) actions.push('<button data-action="reschedule">30분 뒤로 변경</button><button data-action="cancel">예약 취소</button>');
  $('#booking-detail').innerHTML=`<div class="detail-head"><div><h3>${esc(item.customerName)}</h3><p>${esc(item.serviceName)} · ${esc(item.id)}</p></div><span class="status ${item.status}">${statusLabel[item.status]}</span></div><div class="detail-meta"><span>연락처</span><b>${esc(item.customerPhone)}</b><span>예약 일정</span><b>${esc(fmt(item.startAt))}</b><span>고객 요청</span><b>${esc(item.note||'없음')}</b><span>고객 태그</span><b>${esc(customer?.tags?.join(', ')||'없음')}</b></div><div class="detail-actions">${actions.join('')}</div><label class="field"><span>고객 메모</span><textarea id="customer-memo" maxlength="1000" placeholder="다음 상담에 필요한 내용을 기록하세요.">${esc(customer?.memo||'')}</textarea></label><button type="button" class="secondary full" data-save-memo>고객 메모 저장</button><p id="detail-error" class="form-error" role="alert"></p>`;
}
function renderInquiries(){
  $('#inquiry-list').innerHTML=state.inquiries.map(item=>`<article class="inquiry-item"><header><div><strong>${esc(item.customerName)} · ${esc(item.topic)}</strong><small>${esc(item.customerPhone)}</small></div><span class="status ${item.status}">${statusLabel[item.status]}</span></header><p>${esc(item.message)}</p>${item.status!=='CLOSED'?`<div class="detail-actions">${item.status==='NEW'?`<button data-inquiry="${item.id}" data-inquiry-action="CONTACTED">연락완료</button>`:''}<button data-inquiry="${item.id}" data-inquiry-action="CLOSED">종료</button></div>`:''}</article>`).join('');
}
function renderAudit(){
  $('#audit-list').innerHTML=state.audit.slice(0,12).map(item=>`<article class="audit-item"><header><strong>${esc(item.action)}</strong><code>${esc(item.actor)}</code></header><p>${esc(item.entityId)} · ${esc(item.detail)}</p></article>`).join('');
}
function renderAdmin(){renderMetrics();renderBookingList();renderDetail();renderInquiries();renderAudit()}

function handleError(target,error){const map={CUSTOMER_NAME_INVALID:'이름을 2~50자로 입력하세요.',CUSTOMER_PHONE_INVALID:'올바른 휴대폰 번호를 입력하세요.',SLOT_CONFLICT:'선택한 시간은 이미 예약되어 있습니다.',NOTE_TOO_LONG:'입력 내용이 너무 깁니다.',STALE_BOOKING:'다른 작업에서 예약이 변경되었습니다. 화면을 다시 확인하세요.',INVALID_TRANSITION:'현재 상태에서는 해당 처리를 할 수 없습니다.'};target.textContent=map[error.message]||`처리하지 못했습니다. (${error.message})`}

$('#booking-date').value=nextDate(1);renderServices();renderSlots();renderAdmin();

document.addEventListener('click',event=>{
  const view=event.target.closest('[data-view]'); if(view){setView(view.dataset.view);return}
  const jump=event.target.closest('[data-jump]'); if(jump){setView(jump.dataset.jump);return}
  const service=event.target.closest('[data-service]'); if(service){selectedService=service.dataset.service;renderServices();return}
  const slot=event.target.closest('[data-slot]'); if(slot){selectedSlot=slot.dataset.slot;renderSlots();return}
  if(event.target.closest('[data-go-admin]')){setView('admin');return}
  const row=event.target.closest('[data-booking-id]'); if(row){selectedBookingId=row.dataset.bookingId;renderBookingList();renderDetail();return}
  const action=event.target.closest('[data-action]'); if(action){
    const item=state.bookings.find(row=>row.id===selectedBookingId); const error=$('#detail-error'); error.textContent='';
    try{
      if(action.dataset.action==='confirm') transitionBooking(state,item.id,'CONFIRMED',{expectedVersion:item.version,actor:'MANAGER'});
      if(action.dataset.action==='complete') transitionBooking(state,item.id,'COMPLETED',{expectedVersion:item.version,actor:'STAFF'});
      if(action.dataset.action==='cancel') transitionBooking(state,item.id,'CANCELLED',{expectedVersion:item.version,actor:'MANAGER'});
      if(action.dataset.action==='reschedule') rescheduleBooking(state,item.id,new Date(Date.parse(item.startAt)+30*60000).toISOString(),{expectedVersion:item.version,actor:'STAFF'});
      renderAdmin();
    }catch(err){handleError(error,err)}
    return;
  }
  if(event.target.closest('[data-save-memo]')){
    const item=state.bookings.find(row=>row.id===selectedBookingId);const error=$('#detail-error');error.textContent='';
    try{updateCustomerMemo(state,item.customerId,$('#customer-memo').value,{actor:'STAFF'});renderAdmin()}catch(err){handleError(error,err)}return;
  }
  const inquiryAction=event.target.closest('[data-inquiry-action]');if(inquiryAction){const item=state.inquiries.find(row=>row.id===inquiryAction.dataset.inquiry);try{transitionInquiry(state,item.id,inquiryAction.dataset.inquiryAction,{expectedVersion:item.version,actor:'STAFF'});renderAdmin()}catch{}return}
});

$('#booking-filter').addEventListener('change',()=>{renderBookingList();renderDetail()});
$('#booking-form').addEventListener('submit',event=>{
  event.preventDefault();const form=event.currentTarget;const error=$('#booking-error');error.textContent='';const data=new FormData(form);
  try{const item=createBooking(state,{name:data.get('name'),phone:data.get('phone'),serviceId:selectedService,startAt:currentStartAt(),note:data.get('note')},{actor:'PUBLIC_DEMO'});selectedBookingId=item.id;renderTicket(item);renderAdmin();form.reset()}catch(err){handleError(error,err)}
});
$('#inquiry-form').addEventListener('submit',event=>{
  event.preventDefault();const form=event.currentTarget;const error=$('#inquiry-error');error.textContent='';const data=new FormData(form);
  try{const item=createInquiry(state,{name:data.get('name'),phone:data.get('phone'),topic:data.get('topic'),message:data.get('message')},{actor:'PUBLIC_DEMO'});const result=$('#inquiry-result');result.hidden=false;result.innerHTML=`<strong>${esc(item.id)} 문의가 데모 Inbox에 등록되었습니다.</strong><br>관리자 화면에서 처리 흐름을 확인할 수 있습니다.`;form.reset();renderAdmin()}catch(err){handleError(error,err)}
});
