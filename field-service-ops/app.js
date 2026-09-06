import { createStore } from './server/store.mjs';
import { ACTION_LABELS, STATUS_LABELS, friendlyActor, friendlyError, uiLabel } from '../customer-ui.js';

const store = createStore();
const state = { selectedId: null, role: 'STAFF' };
const $ = (id) => document.getElementById(id);
const el = {
  role: $('role'), search: $('search'), statusFilter: $('status-filter'), jobList: $('job-list'),
  empty: $('empty'), detail: $('detail'), detailPanel: $('detail-panel'), detailBackdrop: $('detail-backdrop'), closeDetail: $('close-detail'),
  jobTitle: $('job-title'), jobCopy: $('job-copy'), version: $('version'), status: $('status'), priority: $('priority'), agent: $('agent'), slot: $('slot'),
  actions: $('actions'), agentSelect: $('agent-select'), startAt: $('start-at'), endAt: $('end-at'), override: $('override'), schedule: $('schedule'), message: $('message'),
  agentBoard: $('agent-board'), auditList: $('audit-list'), mActive: $('m-active'), mScheduled: $('m-scheduled'), mDispatched: $('m-dispatched'), mOnsite: $('m-onsite'), mUrgent: $('m-urgent')
};

const PEOPLE = { 'Agent A': '김도현', 'Agent B': '이준호', 'Agent C': '박민수' };
const REGIONS = { Central: '중부권', East: '동부권', West: '서부권' };
const JOBS = {
  1: { customer: '알파오피스', address: '서울 중구 세종대로 10', summary: '정기 장비 점검' },
  2: { customer: '베타연구소', address: '서울 성동구 성수이로 25', summary: '긴급 서비스 중단 점검' },
  3: { customer: '감마스튜디오', address: '서울 마포구 월드컵로 31', summary: '설치 후속 방문' },
  4: { customer: '델타리테일', address: '서울 영등포구 시장로 44', summary: '최종 가동 상태 확인' }
};
const BOARD_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
const node = (tag, cls = '', text = '') => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
const badge = (value) => node('span', `badge ${value}`, uiLabel(value));
const actor = () => state.role === 'ADMIN' ? 'demo-admin' : 'dispatcher';

function job() {
  if (state.selectedId == null) return null;
  try { return store.getJob(state.selectedId); } catch { return null; }
}
function agentDisplay(agent) { return PEOPLE[agent?.name] ?? agent?.name ?? '미배정'; }
function agentName(id) { return agentDisplay(store.listAgents().find((agent) => agent.id === id)); }
function region(agent) { return REGIONS[agent?.region] ?? agent?.region ?? ''; }
function copy(currentJob) { return JOBS[currentJob.id] ?? { customer: currentJob.customerName, address: currentJob.address, summary: currentJob.summary }; }
function fmt(iso) { return iso ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '-'; }
function localHour(iso) { return (new Date(iso).getUTCHours() + 9) % 24; }
function localMinutes(iso) { return new Date(iso).getUTCMinutes(); }
function durationHours(currentJob) { return Math.max(.5, (new Date(currentJob.endAt) - new Date(currentJob.startAt)) / 3600000); }
function koreaIso(value) { return new Date(`${value}:00+09:00`).toISOString(); }
function inputLocal(iso) { if (!iso) return ''; return new Date(new Date(iso).getTime() + 9 * 3600000).toISOString().slice(0, 16); }
function message(text, error = false) { el.message.textContent = text; el.message.dataset.error = error ? 'true' : 'false'; }

function metrics() {
  const current = store.metrics();
  el.mActive.textContent = current.active;
  el.mScheduled.textContent = current.scheduled;
  el.mDispatched.textContent = current.dispatched;
  el.mOnsite.textContent = current.onSite;
  el.mUrgent.textContent = current.urgent;
}

function list() {
  const query = el.search.value.trim().toLowerCase();
  const jobs = store.listJobs({ status: el.statusFilter.value }).filter((currentJob) => {
    if (!query) return true;
    const customerCopy = copy(currentJob);
    return [customerCopy.customer, customerCopy.address, customerCopy.summary, currentJob.customerName, currentJob.address, currentJob.summary, agentName(currentJob.agentId)]
      .some((value) => String(value).toLowerCase().includes(query));
  });

  el.jobList.replaceChildren();
  for (const currentJob of jobs) {
    const customerCopy = copy(currentJob);
    const button = node('button', `job-card${currentJob.id === state.selectedId ? ' active' : ''}`);
    button.type = 'button';
    button.setAttribute('aria-label', `${customerCopy.customer}, ${uiLabel(currentJob.status)}, ${customerCopy.summary}`);
    const heading = node('div', 'card-head');
    heading.append(node('strong', '', `#${currentJob.id} ${customerCopy.customer}`), badge(currentJob.status));
    button.append(
      heading,
      node('p', '', customerCopy.summary),
      node('small', '', `${uiLabel(currentJob.priority)} · ${agentName(currentJob.agentId)}${currentJob.startAt ? ` · ${fmt(currentJob.startAt)}` : ' · 일정 미배정'}`)
    );
    button.addEventListener('click', () => { state.selectedId = currentJob.id; message(''); render(); });
    el.jobList.append(button);
  }
  if (!jobs.length) el.jobList.append(node('div', 'empty compact', '조건에 맞는 방문 요청이 없습니다.'));
}

function closeDrawer() {
  state.selectedId = null;
  document.body.classList.remove('detail-open');
  render();
}

function run(action) {
  const currentJob = job();
  if (!currentJob) return;
  try {
    const input = { expectedVersion: currentJob.version, actor: actor() };
    if (action === 'DISPATCH') store.dispatch(currentJob.id, input);
    else if (action === 'ON_SITE') store.onSite(currentJob.id, input);
    else if (action === 'COMPLETE') store.complete(currentJob.id, input);
    else if (action === 'NO_SHOW') store.noShow(currentJob.id, input);
    else if (action === 'CANCEL') {
      if (!window.confirm('이 방문 작업을 취소하시겠습니까?')) return;
      store.cancel(currentJob.id, input);
    }
    message(`${ACTION_LABELS[action] ?? '처리'}가 완료되었습니다.`);
  } catch (error) {
    message(friendlyError(error), true);
  }
  render();
}

function detail() {
  const currentJob = job();
  const open = Boolean(currentJob);
  el.detailPanel.classList.toggle('open', open);
  el.detailPanel.setAttribute('aria-hidden', String(!open));
  el.detailBackdrop.hidden = !open;
  document.body.classList.toggle('detail-open', open);
  el.empty.hidden = open;
  el.detail.hidden = !open;
  if (!currentJob) return;

  const customerCopy = copy(currentJob);
  el.jobTitle.textContent = `#${currentJob.id} · ${customerCopy.customer}`;
  el.jobCopy.textContent = `${customerCopy.address} · ${customerCopy.summary}`;
  el.version.textContent = '';
  el.status.textContent = uiLabel(currentJob.status);
  el.priority.textContent = uiLabel(currentJob.priority);
  el.agent.textContent = agentName(currentJob.agentId);
  el.slot.textContent = currentJob.startAt ? `${fmt(currentJob.startAt)} ~ ${fmt(currentJob.endAt)}` : '아직 배정되지 않음';

  el.actions.replaceChildren();
  for (const action of currentJob.allowedActions.filter((action) => !['SCHEDULE', 'RESCHEDULE', 'REASSIGN'].includes(action))) {
    const button = node('button', `action ${action}`, ACTION_LABELS[action] ?? uiLabel(action));
    button.type = 'button';
    button.addEventListener('click', () => run(action));
    el.actions.append(button);
  }
  if (!el.actions.children.length) el.actions.append(node('span', 'muted', '현재 바로 처리할 작업이 없습니다.'));

  const canSchedule = currentJob.allowedActions.some((action) => ['SCHEDULE', 'RESCHEDULE', 'REASSIGN'].includes(action));
  el.schedule.disabled = !canSchedule;
  el.schedule.textContent = currentJob.status === 'REQUESTED' ? '일정 배정' : '일정 변경';
  if (currentJob.agentId) el.agentSelect.value = String(currentJob.agentId);
  if (currentJob.startAt && currentJob.endAt) {
    el.startAt.value = inputLocal(currentJob.startAt);
    el.endAt.value = inputLocal(currentJob.endAt);
  } else {
    el.startAt.value = '2026-09-07T10:00';
    el.endAt.value = '2026-09-07T11:00';
  }
}

function renderBoard(agents, jobs) {
  el.agentBoard.replaceChildren();
  const head = node('div', 'schedule-head');
  head.append(node('span', '', '기사'));
  for (const hour of BOARD_HOURS) head.append(node('span', '', `${String(hour).padStart(2, '0')}:00`));
  el.agentBoard.append(head);

  for (const agent of agents) {
    const row = node('div', 'schedule-row');
    const label = node('div', 'agent-label');
    label.append(node('strong', '', agentDisplay(agent)), node('span', '', region(agent)));
    row.append(label);
    const cells = BOARD_HOURS.map(() => node('div', 'time-cell'));
    for (const cell of cells) row.append(cell);

    const activeJobs = jobs.filter((currentJob) => currentJob.agentId === agent.id && ['SCHEDULED', 'DISPATCHED', 'ON_SITE'].includes(currentJob.status) && currentJob.startAt && currentJob.endAt);
    for (const currentJob of activeJobs) {
      const start = localHour(currentJob.startAt);
      const index = BOARD_HOURS.indexOf(start);
      if (index < 0) continue;
      const customerCopy = copy(currentJob);
      const card = node('button', `slot-card ${currentJob.status}${currentJob.priority === 'URGENT' ? ' URGENT' : ''}`);
      card.type = 'button';
      card.style.width = `calc(${Math.min(durationHours(currentJob), BOARD_HOURS.length - index) * 100}% - 8px)`;
      card.style.left = `calc(${localMinutes(currentJob.startAt) / 60 * 100}% + 4px)`;
      card.append(node('strong', '', customerCopy.customer), node('span', '', `${fmt(currentJob.startAt)} · ${uiLabel(currentJob.status)}`));
      card.addEventListener('click', () => { state.selectedId = currentJob.id; message(''); render(); });
      cells[index].append(card);
    }
    el.agentBoard.append(row);
  }
}

function agents() {
  const agents = store.listAgents();
  const jobs = store.listJobs();
  el.agentSelect.replaceChildren(...agents.map((agent) => {
    const option = node('option', '', `${agentDisplay(agent)} · ${region(agent)}`);
    option.value = String(agent.id);
    return option;
  }));
  renderBoard(agents, jobs);
}

function audits() {
  el.auditList.replaceChildren();
  for (const audit of store.listAudits().slice(0, 20)) {
    const row = node('article', 'audit');
    const heading = node('div');
    heading.append(node('strong', '', `${ACTION_LABELS[audit.action] ?? uiLabel(audit.action)} · 작업 #${audit.jobId}`), node('span', '', friendlyActor(audit.actor)));
    let detailText = audit.detail || '';
    for (const [key, label] of Object.entries(STATUS_LABELS)) detailText = detailText.replaceAll(key, label);
    detailText = detailText.replaceAll('Agent A', '김도현').replaceAll('Agent B', '이준호').replaceAll('Agent C', '박민수').replaceAll('unassigned request', '미배정 요청');
    row.append(heading, node('p', '', detailText || '상태 변경'));
    el.auditList.append(row);
  }
}

function render() {
  metrics();
  list();
  agents();
  detail();
  audits();
}

function scheduleWindowError(startValue, endValue) {
  if (!startValue || !endValue) return '방문 시작과 종료 시간을 입력해 주세요.';
  if (startValue.slice(0, 10) !== endValue.slice(0, 10)) return '방문 시작과 종료는 같은 날짜여야 합니다.';
  if (endValue <= startValue) return '방문 종료 시간은 시작 시간보다 늦어야 합니다.';
  const startTime = startValue.slice(11, 16);
  const endTime = endValue.slice(11, 16);
  if (startTime < '08:00' || endTime > '18:00') return '방문 시간은 08:00부터 18:00 사이로 지정해 주세요.';
  return '';
}

el.role.addEventListener('change', () => {
  state.role = el.role.value;
  message(`${state.role === 'ADMIN' ? '관리자' : '배차 담당자'} 화면으로 전환했습니다.`);
  render();
});
el.search.addEventListener('input', list);
el.statusFilter.addEventListener('change', list);
el.closeDetail.addEventListener('click', closeDrawer);
el.detailBackdrop.addEventListener('click', closeDrawer);
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && state.selectedId != null) closeDrawer(); });

el.schedule.addEventListener('click', () => {
  const currentJob = job();
  if (!currentJob) return;
  const windowError = scheduleWindowError(el.startAt.value, el.endAt.value);
  if (windowError) { message(windowError, true); return; }

  try {
    const input = {
      expectedVersion: currentJob.version,
      agentId: Number(el.agentSelect.value),
      startAt: koreaIso(el.startAt.value),
      endAt: koreaIso(el.endAt.value),
      role: state.role,
      actor: actor(),
      overrideReason: el.override.value
    };
    if (currentJob.status === 'REQUESTED') store.schedule(currentJob.id, input);
    else store.reschedule(currentJob.id, input);
    message(currentJob.status === 'REQUESTED' ? '방문 일정을 배정했습니다.' : '방문 일정을 변경했습니다.');
    el.override.value = '';
  } catch (error) {
    message(friendlyError(error, '일정 정보를 다시 확인해 주세요.'), true);
  }
  render();
});

render();
