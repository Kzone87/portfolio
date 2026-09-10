export const SERVICES = Object.freeze([
  { id: 'consult', name: '1:1 상담', durationMin: 60, priceLabel: '상담형', capacity: 1 },
  { id: 'visit', name: '방문 서비스', durationMin: 90, priceLabel: '방문형', capacity: 1 },
  { id: 'group', name: '그룹 클래스', durationMin: 120, priceLabel: '예약형', capacity: 6 },
]);

export const BOOKING_STATUS = Object.freeze(['REQUESTED','CONFIRMED','COMPLETED','CANCELLED']);
export const INQUIRY_STATUS = Object.freeze(['NEW','CONTACTED','CLOSED']);

export function normalizePhone(value='') {
  const digits=String(value).replace(/\D/g,'').slice(0,11);
  if(digits.length===11) return `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}`;
  if(digits.length===10) return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;
  return digits;
}

export function validateCustomer({name,phone}) {
  const cleanName=String(name||'').trim();
  const cleanPhone=normalizePhone(phone);
  if(cleanName.length<2 || cleanName.length>50) throw new Error('CUSTOMER_NAME_INVALID');
  if(!/^0\d{1,2}-\d{3,4}-\d{4}$/.test(cleanPhone)) throw new Error('CUSTOMER_PHONE_INVALID');
  return {name:cleanName,phone:cleanPhone};
}

export function validateNote(note='', max=500) {
  const value=String(note||'').trim();
  if(value.length>max) throw new Error('NOTE_TOO_LONG');
  return value;
}

export function validateDateTime(value) {
  const ts=Date.parse(value);
  if(!Number.isFinite(ts)) throw new Error('SCHEDULE_INVALID');
  return new Date(ts).toISOString();
}

export function addMinutes(iso, minutes) {
  return new Date(Date.parse(iso)+minutes*60000).toISOString();
}

export function overlaps(aStart,aEnd,bStart,bEnd) {
  return Date.parse(aStart)<Date.parse(bEnd) && Date.parse(bStart)<Date.parse(aEnd);
}

export function serviceById(id) {
  const service=SERVICES.find(item=>item.id===id);
  if(!service) throw new Error('SERVICE_NOT_FOUND');
  return service;
}

export function assertSlotAvailable(bookings,{serviceId,startAt,ignoreId=null}) {
  const service=serviceById(serviceId);
  const normalizedStart=validateDateTime(startAt);
  const endAt=addMinutes(normalizedStart,service.durationMin);
  const conflicts=bookings.filter(item=>item.id!==ignoreId && item.status!=='CANCELLED' && overlaps(normalizedStart,endAt,item.startAt,item.endAt));
  if(conflicts.length>=service.capacity) throw new Error('SLOT_CONFLICT');
  return {startAt:normalizedStart,endAt};
}

function nextId(prefix, items) {
  const max=items.reduce((acc,item)=>Math.max(acc,Number(String(item.id||'').replace(/\D/g,''))||0),0);
  return `${prefix}-${String(max+1).padStart(4,'0')}`;
}

export function createBooking(state,input,{actor='PUBLIC'}={}) {
  const customer=validateCustomer(input);
  const service=serviceById(input.serviceId);
  const schedule=assertSlotAvailable(state.bookings,{serviceId:service.id,startAt:input.startAt});
  const booking={
    id:nextId('B',state.bookings),
    customerId:input.customerId||nextId('C',state.customers),
    customerName:customer.name,
    customerPhone:customer.phone,
    serviceId:service.id,
    serviceName:service.name,
    startAt:schedule.startAt,
    endAt:schedule.endAt,
    status:'REQUESTED',
    note:validateNote(input.note),
    staffNote:'',
    version:1,
    createdAt:new Date().toISOString(),
  };
  const existing=state.customers.find(item=>item.phone===customer.phone);
  if(existing) booking.customerId=existing.id;
  else state.customers.push({id:booking.customerId,name:customer.name,phone:customer.phone,tags:['신규'],memo:''});
  state.bookings.unshift(booking);
  recordAudit(state,{actor,action:'BOOKING_CREATED',entity:'booking',entityId:booking.id,detail:`${service.name} ${booking.startAt}`});
  return booking;
}

export function createInquiry(state,input,{actor='PUBLIC'}={}) {
  const customer=validateCustomer(input);
  const inquiry={
    id:nextId('I',state.inquiries),
    customerName:customer.name,
    customerPhone:customer.phone,
    topic:String(input.topic||'일반 문의').trim().slice(0,80),
    message:validateNote(input.message,1000),
    status:'NEW',
    version:1,
    createdAt:new Date().toISOString(),
  };
  state.inquiries.unshift(inquiry);
  recordAudit(state,{actor,action:'INQUIRY_CREATED',entity:'inquiry',entityId:inquiry.id,detail:inquiry.topic});
  return inquiry;
}

export function transitionBooking(state,id,nextStatus,{expectedVersion,actor='STAFF'}={}) {
  if(!BOOKING_STATUS.includes(nextStatus)) throw new Error('STATUS_INVALID');
  const item=state.bookings.find(row=>row.id===id);
  if(!item) throw new Error('BOOKING_NOT_FOUND');
  if(Number(expectedVersion)!==item.version) throw new Error('STALE_BOOKING');
  const allowed={REQUESTED:['CONFIRMED','CANCELLED'],CONFIRMED:['COMPLETED','CANCELLED'],COMPLETED:[],CANCELLED:[]};
  if(!allowed[item.status].includes(nextStatus)) throw new Error('INVALID_TRANSITION');
  const previous=item.status;
  item.status=nextStatus;
  item.version+=1;
  recordAudit(state,{actor,action:'BOOKING_STATUS_CHANGED',entity:'booking',entityId:id,detail:`${previous} → ${nextStatus}`});
  return item;
}

export function rescheduleBooking(state,id,startAt,{expectedVersion,actor='STAFF'}={}) {
  const item=state.bookings.find(row=>row.id===id);
  if(!item) throw new Error('BOOKING_NOT_FOUND');
  if(Number(expectedVersion)!==item.version) throw new Error('STALE_BOOKING');
  if(['COMPLETED','CANCELLED'].includes(item.status)) throw new Error('BOOKING_TERMINAL');
  const schedule=assertSlotAvailable(state.bookings,{serviceId:item.serviceId,startAt,ignoreId:id});
  item.startAt=schedule.startAt;
  item.endAt=schedule.endAt;
  item.version+=1;
  recordAudit(state,{actor,action:'BOOKING_RESCHEDULED',entity:'booking',entityId:id,detail:item.startAt});
  return item;
}

export function updateCustomerMemo(state,customerId,memo,{actor='STAFF'}={}) {
  const customer=state.customers.find(item=>item.id===customerId);
  if(!customer) throw new Error('CUSTOMER_NOT_FOUND');
  customer.memo=validateNote(memo,1000);
  recordAudit(state,{actor,action:'CUSTOMER_MEMO_UPDATED',entity:'customer',entityId:customerId,detail:customer.memo.slice(0,80)});
  return customer;
}

export function transitionInquiry(state,id,nextStatus,{expectedVersion,actor='STAFF'}={}) {
  if(!INQUIRY_STATUS.includes(nextStatus)) throw new Error('STATUS_INVALID');
  const item=state.inquiries.find(row=>row.id===id);
  if(!item) throw new Error('INQUIRY_NOT_FOUND');
  if(Number(expectedVersion)!==item.version) throw new Error('STALE_INQUIRY');
  const allowed={NEW:['CONTACTED','CLOSED'],CONTACTED:['CLOSED'],CLOSED:[]};
  if(!allowed[item.status].includes(nextStatus)) throw new Error('INVALID_TRANSITION');
  const previous=item.status;
  item.status=nextStatus;
  item.version+=1;
  recordAudit(state,{actor,action:'INQUIRY_STATUS_CHANGED',entity:'inquiry',entityId:id,detail:`${previous} → ${nextStatus}`});
  return item;
}

export function recordAudit(state,{actor,action,entity,entityId,detail}) {
  const event={id:nextId('A',state.audit),actor,action,entity,entityId,detail:String(detail||'').slice(0,300),createdAt:new Date().toISOString()};
  state.audit.unshift(event);
  state.audit=state.audit.slice(0,100);
  return event;
}

export function metrics(state) {
  return {
    requested:state.bookings.filter(item=>item.status==='REQUESTED').length,
    confirmed:state.bookings.filter(item=>item.status==='CONFIRMED').length,
    today:state.bookings.filter(item=>item.status!=='CANCELLED').length,
    inquiries:state.inquiries.filter(item=>item.status!=='CLOSED').length,
    customers:state.customers.length,
  };
}

export function createDemoState(baseDate=new Date()) {
  const d=new Date(baseDate);
  d.setHours(0,0,0,0);
  const iso=(dayOffset,hour,minute=0)=>{const x=new Date(d);x.setDate(x.getDate()+dayOffset);x.setHours(hour,minute,0,0);return x.toISOString();};
  const state={customers:[],bookings:[],inquiries:[],audit:[]};
  createBooking(state,{name:'김하늘',phone:'01012345678',serviceId:'consult',startAt:iso(1,10),note:'첫 상담 요청'},{actor:'DEMO_SEED'});
  transitionBooking(state,state.bookings[0].id,'CONFIRMED',{expectedVersion:1,actor:'MANAGER'});
  createBooking(state,{name:'박서준',phone:'01098765432',serviceId:'visit',startAt:iso(1,14),note:'현장 확인 요청'},{actor:'DEMO_SEED'});
  createInquiry(state,{name:'이민지',phone:'01055556666',topic:'가격 문의',message:'정기 이용 요금이 궁금합니다.'},{actor:'DEMO_SEED'});
  return state;
}
