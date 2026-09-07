const endpoint = String(window.NEXA_CUSTOMER_PORTAL_ENDPOINT || '').trim().replace(/\/+$/, '');
const $ = id => document.getElementById(id);
const form = $('lookup-form');
const requestView = $('request-view');
const emptyView = $('lookup-empty');
const message = $('lookup-message');

const demoRequest = {
  id: 'NX-260907-0142',
  phoneLast4: '4821',
  company: '알파오피스',
  statusLabel: '방문 일정 확정',
  currentTitle: '방문 일정이 확정되었습니다.',
  currentCopy: '기사 방문 전 장비 주변 작업공간과 테스트 출력이 가능한 환경을 준비해 주세요.',
  nextSchedule: '9월 9일 14:00–15:00',
  visit: {
    status: 'SCHEDULED',
    priority: 'NORMAL',
    startAt: '2026-09-09T05:00:00.000Z',
    endAt: '2026-09-09T06:00:00.000Z',
    address: '서울 중구 세종대로 10',
    summary: '디지털 인쇄장비 출력 품질 점검',
    agentAssigned: true
  },
  updates: [
    { at: '2026-09-08T07:42:00.000Z', title: '방문 일정 확정', copy: '9월 9일 14:00 방문으로 일정이 확정되었습니다.' },
    { at: '2026-09-08T02:20:00.000Z', title: '현장 방문 필요 확인', copy: '상담 내용을 확인하고 현장 점검이 필요한 요청으로 분류했습니다.' },
    { at: '2026-09-07T08:03:00.000Z', title: '상담 접수', copy: '유지보수 상담 요청이 접수되었습니다.' }
  ]
};

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

function render(data) {
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

function showNotFound(copy = '접수번호와 연락처 뒤 4자리를 다시 확인해 주세요.') {
  requestView.hidden = true;
  emptyView.hidden = false;
  const p = emptyView.querySelector('p');
  if (p) p.textContent = `${copy} 계속 확인되지 않으면 상담 페이지에서 문의해 주세요.`;
}

async function lookup(requestId, phoneLast4) {
  if (!endpoint) {
    if (requestId.toUpperCase() === demoRequest.id && phoneLast4 === demoRequest.phoneLast4) return demoRequest;
    const error = new Error('접수정보를 확인할 수 없습니다.');
    error.code = 'NOT_FOUND';
    throw error;
  }
  const response = await fetch(`${endpoint}/api/customer/requests/lookup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: requestId, phoneLast4 })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || '요청을 조회하지 못했습니다.');
    error.code = payload?.error?.code || 'LOOKUP_FAILED';
    throw error;
  }
  return payload;
}

form?.addEventListener('submit', async event => {
  event.preventDefault();
  message.className = 'lookup-message';
  message.textContent = '';
  const requestId = String($('request-id')?.value || '').trim().toUpperCase();
  const phoneLast4 = String($('phone-last4')?.value || '').replace(/\D/g, '').slice(-4);
  if (!/^NX-[A-Z0-9-]{6,24}$/.test(requestId) || phoneLast4.length !== 4) {
    message.textContent = '접수번호와 연락처 뒤 4자리를 확인해 주세요.';
    message.classList.add('error');
    return;
  }
  const button = form.querySelector('button[type="submit"]');
  if (button) button.disabled = true;
  message.textContent = '요청 정보를 확인하고 있습니다.';
  try {
    const data = await lookup(requestId, phoneLast4);
    render(data);
    message.textContent = '최신 요청 상태를 불러왔습니다.';
  } catch (error) {
    showNotFound(error instanceof Error ? error.message : undefined);
    message.textContent = error instanceof Error ? error.message : '요청을 조회하지 못했습니다.';
    message.classList.add('error');
  } finally {
    if (button) button.disabled = false;
  }
});

if (!endpoint) render(demoRequest);
else requestView.hidden = true;
