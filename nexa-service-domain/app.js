const endpoint = String(window.NEXA_CUSTOMER_PORTAL_ENDPOINT || '').trim().replace(/\/+$/, '');
const $ = id => document.getElementById(id);
const form = $('lookup-form');
const requestView = $('request-view');
const emptyView = $('lookup-empty');
const message = $('lookup-message');
const actionForm = $('customer-action-form');
const actionType = $('customer-action-type');
const actionPreferredWrap = $('customer-action-preferred-wrap');
const actionPreferred = $('customer-action-preferred');
const actionNote = $('customer-action-note');
const actionMessage = $('customer-action-message');
const linkedRequestId = String(new URLSearchParams(window.location.search).get('request') || '').trim().toUpperCase();
const portalSessionKey = 'nexa:customer-request';
const portalSessionMaxAge = 30 * 60 * 1000;
let currentAccess = null;
let currentRequest = null;

requestView.hidden = true;
emptyView.hidden = true;

const demoRequest = {
  id: 'NX-260907-0142',
  phone: '010-9876-4821',
  company: '알파오피스',
  statusLabel: '방문 일정 확정',
  currentTitle: '방문 일정이 확정되었습니다.',
  currentCopy: '기사 방문 전 장비 주변 작업공간과 테스트 출력이 가능한 환경을 준비해 주세요.',
  nextSchedule: '9월 9일 14:00–15:00',
  status: 'CONTACTED',
  handoff: { state: 'COMPLETED', fieldJobId: 18, address: '서울 중구 세종대로 10', summary: '디지털 인쇄장비 출력 품질 점검', priority: 'NORMAL' },
  visit: {
    id: 18,
    status: 'SCHEDULED',
    priority: 'NORMAL',
    startAt: '2026-09-09T05:00:00.000Z',
    endAt: '2026-09-09T06:00:00.000Z',
    address: '서울 중구 세종대로 10',
    summary: '디지털 인쇄장비 출력 품질 점검',
    agentAssigned: true
  },
  customerActions: [],
  updates: [
    { at: '2026-09-08T07:42:00.000Z', title: '방문 일정 확정', copy: '9월 9일 14:00 방문으로 일정이 확정되었습니다.' },
    { at: '2026-09-08T02:20:00.000Z', title: '현장 방문 필요 확인', copy: '상담 내용을 확인하고 현장 점검이 필요한 요청으로 분류했습니다.' },
    { at: '2026-09-07T08:03:00.000Z', title: '상담 접수', copy: '유지보수 상담 요청이 접수되었습니다.' }
  ]
};

const ACTION_LABELS = Object.freeze({ MESSAGE: '추가 문의', RESCHEDULE: '일정 변경 요청', CANCEL: '방문 취소 요청' });
const ACTION_STATES = Object.freeze({ OPEN: '처리 대기', RESOLVED: '처리 완료', REJECTED: '안내 완료' });

function text(id, value) {
  const node = $(id);
  if (node) node.textContent = value;
}

function dateTime(iso) {
  if (!iso) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
  }).format(new Date(iso)).replace(/\. /g, '. ').replace(/\.$/, '');
}

function shortDateTime(iso) {
  if (!iso) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
  }).format(new Date(iso)).replace(/\. /g, '.').replace(/\.$/, '');
}

function visitWindow(visit) {
  if (!visit?.startAt) return '일정 확인 중';
  const start = new Date(visit.startAt);
  const end = visit.endAt ? new Date(visit.endAt) : null;
  const day = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' }).format(start);
  const time = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(start);
  const endTime = end ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(end) : '';
  return `${day} ${time}${endTime ? `–${endTime}` : ''}`;
}

const stages = [
  ['상담 접수', '요청 내용을 접수했습니다.'],
  ['지원 확인', '지원 범위와 방문 필요 여부를 확인합니다.'],
  ['방문 확정', '방문 날짜와 시간을 안내합니다.'],
  ['방문·작업', '기사 방문 후 현장 작업을 진행합니다.'],
  ['결과 안내', '작업 결과와 장비 상태를 안내합니다.'],
  ['후속관리', '필요한 재방문·부품·다음 점검을 안내합니다.']
];

function stageIndex(data) {
  const status = String(data?.visit?.status || '');
  if (status === 'COMPLETED' || data?.status === 'CLOSED') return 5;
  if (status === 'ON_SITE') return 3;
  if (status === 'DISPATCHED') return 3;
  if (status === 'SCHEDULED') return 2;
  if (status === 'REQUESTED' || data?.handoff?.state === 'COMPLETED') return 1;
  if (data?.status === 'CONTACTED') return 1;
  return 0;
}

function stateCopy(data) {
  const status = String(data?.visit?.status || '');
  if (status === 'COMPLETED' || data?.status === 'CLOSED') return ['작업 결과를 확인해 주세요.', '현장 작업이 완료되었습니다. 조치 결과와 남은 후속작업을 확인해 주세요.', '작업 완료'];
  if (status === 'ON_SITE') return ['현재 현장 작업 중입니다.', '담당 기사가 현장에서 장비 상태를 확인하고 필요한 작업을 진행하고 있습니다.', '현장 작업 중'];
  if (status === 'DISPATCHED') return ['담당 기사가 출동했습니다.', '예정된 방문 장소로 이동 중입니다. 현장 출입과 장비 접근이 가능하도록 준비해 주세요.', '기사 출동 중'];
  if (status === 'SCHEDULED') return ['방문 일정이 확정되었습니다.', '기사 방문 전 장비 주변 작업공간과 테스트 출력이 가능한 환경을 준비해 주세요.', '방문 일정 확정'];
  if (status === 'REQUESTED' || data?.handoff?.state === 'COMPLETED') return ['방문 일정을 확인하고 있습니다.', '현장 방문 요청이 전달되었습니다. 가능한 기사 일정과 방문 시간을 확인한 뒤 안내합니다.', '방문 일정 확인 중'];
  if (data?.status === 'CONTACTED') return ['상담 내용을 확인했습니다.', '지원 범위와 현장 방문 필요 여부를 확인하고 있습니다.', '지원 확인 중'];
  return ['상담 요청이 접수되었습니다.', '담당자가 상담 내용을 확인한 뒤 필요한 다음 단계를 안내합니다.', '상담 접수'];
}

function renderTimeline(data) {
  const list = $('timeline');
  if (!list) return;
  const current = stageIndex(data);
  list.replaceChildren(...stages.map(([title, copy], index) => {
    const li = document.createElement('li');
    if (index < current) li.className = 'done';
    else if (index === current) li.className = 'current';
    const marker = document.createElement('i');
    marker.textContent = index < current ? '✓' : String(index + 1);
    const wrap = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = title;
    const span = document.createElement('span');
    span.textContent = copy;
    wrap.append(strong, span);
    li.append(marker, wrap);
    return li;
  }));
}

function renderUpdates(items = []) {
  const list = $('update-list');
  if (!list) return;
  const safeItems = items.length ? items : [{ at: new Date().toISOString(), title: '상담 접수', copy: '유지보수 상담 요청이 접수되었습니다.' }];
  list.replaceChildren(...safeItems.slice(0, 6).map(item => {
    const article = document.createElement('article');
    const time = document.createElement('time');
    time.textContent = shortDateTime(item.at || item.createdAt);
    const div = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = item.title || '요청 상태 변경';
    const p = document.createElement('p');
    p.textContent = item.copy || '요청 상태가 변경되었습니다.';
    div.append(strong, p);
    article.append(time, div);
    return article;
  }));
}

function renderCustomerActions(data) {
  const list = $('customer-action-list');
  if (!list) return;
  const items = Array.isArray(data?.customerActions) ? data.customerActions : [];
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'customer-action-empty';
    empty.textContent = '아직 추가로 남긴 요청이 없습니다.';
    list.replaceChildren(empty);
  } else {
    list.replaceChildren(...items.map(item => {
      const article = document.createElement('article');
      article.className = 'customer-action-item';
      const strong = document.createElement('strong');
      strong.textContent = ACTION_LABELS[item.type] || '고객 요청';
      const state = document.createElement('span');
      state.className = `customer-action-state ${item.state || 'OPEN'}`;
      state.textContent = ACTION_STATES[item.state] || item.state || '처리 대기';
      const detail = document.createElement('p');
      detail.textContent = `${item.preferredAt ? `희망시간 ${item.preferredAt} · ` : ''}${item.note || ''}`;
      const time = document.createElement('small');
      time.textContent = `요청 ${shortDateTime(item.createdAt)}`;
      article.append(strong, state, detail, time);
      if (item.resolution) {
        const resolution = document.createElement('p');
        resolution.className = 'customer-action-resolution';
        resolution.textContent = `담당자 안내: ${item.resolution}`;
        article.append(resolution);
      }
      return article;
    }));
  }

  const visitReady = Boolean(data?.handoff?.fieldJobId || data?.visit?.id);
  const terminalVisit = ['DISPATCHED','ON_SITE','COMPLETED','CANCELLED','NO_SHOW'].includes(String(data?.visit?.status || ''));
  const closed = data?.status === 'CLOSED';
  if (actionType) {
    for (const option of actionType.options) {
      if (['RESCHEDULE','CANCEL'].includes(option.value)) option.disabled = closed || !visitReady || terminalVisit;
    }
    if (actionType.selectedOptions[0]?.disabled) actionType.value = 'MESSAGE';
  }
  if (actionForm) {
    const submit = $('customer-action-submit');
    if (submit) submit.disabled = closed;
    actionForm.setAttribute('aria-disabled', closed ? 'true' : 'false');
  }
  syncActionForm();
}

function render(data) {
  currentRequest = data;
  requestView.hidden = false;
  emptyView.hidden = true;
  const [title, copy, label] = stateCopy(data);
  text('customer-name', data.company || '고객');
  text('request-number', data.id || '-');
  text('request-status', data.statusLabel || label);
  text('current-title', data.currentTitle || title);
  text('current-copy', data.currentCopy || copy);
  text('next-schedule', data.nextSchedule || visitWindow(data.visit));
  text('visit-priority', data.visit?.priority === 'URGENT' ? '긴급' : '일반');
  text('visit-time', data.visit?.startAt ? `${dateTime(data.visit.startAt)}${data.visit.endAt ? `–${new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(data.visit.endAt))}` : ''}` : '일정 확인 중');
  text('visit-address', data.visit?.address || data.handoff?.address || '방문 장소 확인 중');
  text('visit-agent', data.visit?.agentAssigned ? '담당 기사 배정 완료' : '담당 기사 확인 중');
  text('visit-summary', data.visit?.summary || data.handoff?.summary || data.service || '요청 내용 확인 중');
  renderTimeline(data);
  renderUpdates(data.updates || []);
  renderCustomerActions(data);

  const completed = String(data.visit?.status || '') === 'COMPLETED' || data.status === 'CLOSED';
  if (completed) {
    text('result-title', '현장 작업이 완료되었습니다.');
    text('result-copy', data.resultCopy || '작업 결과와 현재 장비 상태를 확인했습니다. 추가 부품이나 재방문이 필요한 경우 후속 일정이 이어집니다.');
    text('result-state', '결과 확인 가능');
  } else {
    text('result-title', '현장 작업 후 결과가 표시됩니다.');
    text('result-copy', '작업이 완료되면 확인한 증상, 조치 내용, 현재 사용 가능 여부와 남은 후속작업을 이 화면에서 확인할 수 있습니다.');
    text('result-state', '아직 작업 전입니다.');
  }
}

function showNotFound(copy = '접수번호와 상담 연락처를 다시 확인해 주세요.') {
  currentAccess = null;
  currentRequest = null;
  requestView.hidden = true;
  emptyView.hidden = false;
  const p = emptyView.querySelector('p');
  if (p) p.textContent = `${copy} 계속 확인되지 않으면 상담 페이지에서 문의해 주세요.`;
}

function normalizedPhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function readRememberedAccess() {
  try {
    const raw = sessionStorage.getItem(portalSessionKey);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (!value?.requestId || !value?.phone || !Number.isFinite(value?.savedAt)) return null;
    if (Date.now() - value.savedAt > portalSessionMaxAge) {
      sessionStorage.removeItem(portalSessionKey);
      return null;
    }
    return { requestId: String(value.requestId).trim().toUpperCase(), phone: String(value.phone).trim() };
  } catch {
    return null;
  }
}

function clearRememberedAccess(requestId) {
  try {
    const remembered = readRememberedAccess();
    if (!requestId || remembered?.requestId === requestId) sessionStorage.removeItem(portalSessionKey);
  } catch {
    // Ignore storage failures.
  }
}

async function lookup(requestId, phone) {
  if (!endpoint) {
    if (requestId.toUpperCase() === demoRequest.id && normalizedPhone(phone) === normalizedPhone(demoRequest.phone)) return structuredClone(demoRequest);
    const error = new Error('접수정보를 확인할 수 없습니다.');
    error.code = 'NOT_FOUND';
    throw error;
  }
  const response = await fetch(`${endpoint}/api/customer/requests/lookup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: requestId, phone })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || '요청을 조회하지 못했습니다.');
    error.code = payload?.error?.code || 'LOOKUP_FAILED';
    throw error;
  }
  return payload;
}

async function createCustomerAction(access, input) {
  if (!endpoint) {
    if (access.requestId !== demoRequest.id || normalizedPhone(access.phone) !== normalizedPhone(demoRequest.phone)) throw new Error('접수정보를 확인할 수 없습니다.');
    const duplicate = demoRequest.customerActions.find(item => item.type === input.type && item.state === 'OPEN' && input.type !== 'MESSAGE');
    if (duplicate) throw new Error('같은 유형의 요청이 이미 처리 대기 중입니다.');
    const action = {
      id: Date.now(), type: input.type, state: 'OPEN', note: input.note, preferredAt: input.preferredAt || '', resolution: '', createdAt: new Date().toISOString(), resolvedAt: null
    };
    demoRequest.customerActions.unshift(action);
    demoRequest.updates.unshift({ at: action.createdAt, title: `${ACTION_LABELS[action.type]} 접수`, copy: '담당자가 요청 내용을 확인합니다.' });
    return { action };
  }
  const response = await fetch(`${endpoint}/api/customer/requests/action`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: access.requestId, phone: access.phone, ...input })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || '추가 요청을 접수하지 못했습니다.');
    error.code = payload?.error?.code || 'CUSTOMER_ACTION_FAILED';
    throw error;
  }
  return payload;
}

function syncActionForm() {
  if (!actionType || !actionPreferredWrap) return;
  const isReschedule = actionType.value === 'RESCHEDULE';
  actionPreferredWrap.hidden = !isReschedule;
  if (actionPreferred) actionPreferred.required = isReschedule;
}
actionType?.addEventListener('change', syncActionForm);

form?.addEventListener('submit', async event => {
  event.preventDefault();
  message.className = 'lookup-message';
  message.textContent = '';
  emptyView.hidden = true;
  const requestId = String($('request-id')?.value || '').trim().toUpperCase();
  const phone = String($('request-phone')?.value || '').trim();
  if (!/^NX-[A-Z0-9-]{6,24}$/.test(requestId) || normalizedPhone(phone).length < 9) {
    requestView.hidden = true;
    message.textContent = '접수번호와 상담 연락처를 확인해 주세요.';
    message.classList.add('error');
    return;
  }
  const button = form.querySelector('button[type="submit"]');
  if (button) button.disabled = true;
  form.setAttribute('aria-busy', 'true');
  message.textContent = '요청 정보를 확인하고 있습니다.';
  try {
    const data = await lookup(requestId, phone);
    currentAccess = { requestId, phone };
    render(data);
    history.replaceState(null, '', `${location.pathname}?request=${encodeURIComponent(requestId)}`);
    message.textContent = '최신 요청 상태를 불러왔습니다.';
  } catch (error) {
    clearRememberedAccess(requestId);
    showNotFound(error instanceof Error ? error.message : undefined);
    message.textContent = error instanceof Error ? error.message : '요청을 조회하지 못했습니다.';
    message.classList.add('error');
  } finally {
    form.removeAttribute('aria-busy');
    if (button) button.disabled = false;
  }
});

actionForm?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!currentAccess || !currentRequest) return;
  actionMessage.className = 'lookup-message';
  actionMessage.textContent = '';
  const type = String(actionType?.value || 'MESSAGE');
  const note = String(actionNote?.value || '').trim();
  const preferredAt = type === 'RESCHEDULE' ? String(actionPreferred?.value || '').trim() : '';
  if (note.length < 3) {
    actionMessage.textContent = '요청 내용을 3자 이상 입력해 주세요.';
    actionMessage.classList.add('error');
    return;
  }
  if (type === 'RESCHEDULE' && !preferredAt) {
    actionMessage.textContent = '희망 방문시간을 입력해 주세요.';
    actionMessage.classList.add('error');
    return;
  }
  const button = $('customer-action-submit');
  if (button) button.disabled = true;
  actionForm.setAttribute('aria-busy', 'true');
  actionMessage.textContent = '요청을 접수하고 있습니다.';
  try {
    await createCustomerAction(currentAccess, { type, note, preferredAt });
    if (actionNote) actionNote.value = '';
    if (actionPreferred) actionPreferred.value = '';
    const latest = await lookup(currentAccess.requestId, currentAccess.phone);
    render(latest);
    actionMessage.textContent = '요청이 접수되었습니다. 담당자 처리 결과는 이 화면에서 확인할 수 있습니다.';
  } catch (error) {
    actionMessage.textContent = error instanceof Error ? error.message : '요청을 접수하지 못했습니다.';
    actionMessage.classList.add('error');
  } finally {
    actionForm.removeAttribute('aria-busy');
    if (button && currentRequest?.status !== 'CLOSED') button.disabled = false;
  }
});

const remembered = readRememberedAccess();
if (linkedRequestId && /^NX-[A-Z0-9-]{6,24}$/.test(linkedRequestId)) {
  $('request-id').value = linkedRequestId;
  if (remembered?.requestId === linkedRequestId) $('request-phone').value = remembered.phone;
  else if (!endpoint && linkedRequestId === demoRequest.id) $('request-phone').value = demoRequest.phone;
}

syncActionForm();
if (linkedRequestId && remembered?.requestId === linkedRequestId && remembered.phone) {
  queueMicrotask(() => form?.requestSubmit());
}
