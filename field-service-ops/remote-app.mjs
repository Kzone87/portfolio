import { ACTION_LABELS, STATUS_LABELS, friendlyActor, friendlyError, uiLabel } from '../customer-ui.js';
import { mountInquiryDesk } from './inquiry-desk.mjs';
import { mountTeamAdmin } from './team-admin.mjs';

const config = window.NEXA_OPS_CONFIG && typeof window.NEXA_OPS_CONFIG === 'object' ? window.NEXA_OPS_CONFIG : {};
const endpoint = String(config.endpoint || '').trim().replace(/\/+$/, '');
const state = { selectedId: null, agents: [], jobs: [], audits: [], metrics: null, principal: null };
let csrfToken = '';
let inquiryDesk = null;
let teamAdmin = null;
const $ = id => document.getElementById(id);
const el = {
  search: $('search'), statusFilter: $('status-filter'), jobList: $('job-list'),
  empty: $('empty'), detail: $('detail'), detailPanel: $('detail-panel'), detailBackdrop: $('detail-backdrop'), closeDetail: $('close-detail'),
  jobTitle: $('job-title'), jobCopy: $('job-copy'), version: $('version'), status: $('status'), priority: $('priority'), agent: $('agent'), slot: $('slot'),
  actions: $('actions'), agentSelect: $('agent-select'), startAt: $('start-at'), endAt: $('end-at'), override: $('override'), schedule: $('schedule'), message: $('message'),
  agentBoard: $('agent-board'), auditList: $('audit-list'), mActive: $('m-active'), mScheduled: $('m-scheduled'), mDispatched: $('m-dispatched'), mOnsite: $('m-onsite'), mUrgent: $('m-urgent'),
  loginScreen: $('login-screen'), loginForm: $('login-form'), loginUsername: $('login-username'), loginPassword: $('login-password'), loginMessage: $('login-message'),
  logout: $('logout-button'), teamTab: $('team-tab'), inquiryBadge: $('inquiry-badge')
};
const BOARD_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
const node = (tag, cls = '', text = '') => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
const badge = value => node('span', `badge ${value}`, uiLabel(value));

class RemoteError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'RemoteError';
    this.status = status;
    this.code = code;
  }
}

async function api(path, options = {}) {
  const method = options.method || 'GET';
  const headers = { accept: 'application/json', ...(options.body ? { 'content-type': 'application/json' } : {}) };
  if (method !== 'GET' && method !== 'HEAD' && csrfToken && !options.skipCsrf) headers['x-csrf-token'] = csrfToken;
  const response = await fetch(`${endpoint}${path}`, {
    method,
    headers,
    credentials: 'include',
    cache: 'no-store',
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new RemoteError(response.status, payload?.error?.code || 'REQUEST_FAILED', payload?.error?.message || '운영 요청을 처리하지 못했습니다.');
  return payload;
}

function koreaDateParts(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value);
  const get = type => parts.find(part => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
const workDate = /^\d{4}-\d{2}-\d{2}$/.test(String(config.workDate || '')) ? String(config.workDate) : koreaDateParts();

function workDateLabel() {
  const date = new Date(`${workDate}T00:00:00+09:00`);
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short' }).format(date);
}
function dateCardLabel() {
  const date = new Date(`${workDate}T00:00:00+09:00`);
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).format(date);
}
function localDate(iso) { return iso ? koreaDateParts(new Date(iso)) : ''; }
function fmt(iso) {
  return iso ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso)) : '-';
}
function localHour(iso) { return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', hour: '2-digit', hour12: false }).format(new Date(iso))) % 24; }
function localMinutes(iso) { return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', minute: '2-digit' }).format(new Date(iso))); }
function durationHours(job) { return Math.max(.5, (new Date(job.endAt) - new Date(job.startAt)) / 3600000); }
function koreaIso(value) { return new Date(`${value}:00+09:00`).toISOString(); }
function inputLocal(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(date);
  const get = type => parts.find(part => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
function message(text, error = false) {
  if (!el.message) return;
  el.message.textContent = text;
  el.message.dataset.error = error ? 'true' : 'false';
}
function showGlobalStatus(text, error = false) {
  let banner = document.getElementById('ops-global-status');
  if (!banner) {
    banner = document.createElement('p');
    banner.id = 'ops-global-status';
    banner.className = 'message ops-global-status';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    document.querySelector('.workspace-tabs')?.after(banner);
  }
  banner.textContent = text;
  banner.dataset.error = error ? 'true' : 'false';
  banner.hidden = !text;
}

function applyPrincipal(principal) {
  state.principal = principal;
  const team = document.querySelector('.user-team');
  const avatar = document.querySelector('.user-avatar');
  const name = document.querySelector('.user-copy strong');
  const role = document.querySelector('.user-copy small');
  if (team) team.textContent = principal.team || '운영팀';
  if (name) name.textContent = principal.name || principal.id || '로그인 사용자';
  if (avatar) avatar.textContent = String(principal.name || principal.id || '사').trim().slice(0, 1);
  if (role) role.textContent = principal.role === 'ADMIN' ? '운영 관리자' : '배차 담당자';
  const overrideLabel = el.override?.closest('label');
  if (overrideLabel) overrideLabel.hidden = principal.role !== 'ADMIN';
  if (el.teamTab) el.teamTab.hidden = principal.role !== 'ADMIN';
  if (el.logout) el.logout.hidden = false;
}

function applyWorkDate() {
  const label = workDateLabel();
  const pageTitle = document.querySelector('#dispatch-workspace .page-head h1');
  const dateStrong = document.querySelector('#dispatch-workspace .date-card strong');
  const legend = document.querySelector('.board-legend');
  if (pageTitle) pageTitle.textContent = `${label.replace(/\s*\S요일$|\s*\S$/u, '')} 배차 현황`;
  if (dateStrong) dateStrong.textContent = dateCardLabel();
  if (legend) legend.textContent = label.replace(/\s*\S요일$|\s*\S$/u, '');
  if (el.startAt) { el.startAt.min = `${workDate}T08:00`; el.startAt.max = `${workDate}T17:30`; }
  if (el.endAt) { el.endAt.min = `${workDate}T08:30`; el.endAt.max = `${workDate}T18:00`; }
}

function activateWorkspace(name) {
  document.querySelectorAll('[data-workspace-tab]').forEach(button => {
    const active = button.dataset.workspaceTab === name;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  document.querySelectorAll('.workspace-view').forEach(view => { view.hidden = view.id !== `${name}-workspace`; });
  if (name === 'inquiries') inquiryDesk?.refresh().catch(() => {});
  if (name === 'team') teamAdmin?.refresh().catch(() => {});
}
document.querySelectorAll('[data-workspace-tab]').forEach(button => button.addEventListener('click', () => activateWorkspace(button.dataset.workspaceTab)));

function showLogin(copy = '') {
  document.body.classList.add('auth-required');
  if (el.loginScreen) el.loginScreen.hidden = false;
  if (el.logout) el.logout.hidden = true;
  if (el.loginMessage) {
    el.loginMessage.textContent = copy;
    el.loginMessage.dataset.error = copy ? 'true' : 'false';
  }
  queueMicrotask(() => el.loginUsername?.focus());
}
function hideLogin() {
  document.body.classList.remove('auth-required');
  if (el.loginScreen) el.loginScreen.hidden = true;
  if (el.loginMessage) el.loginMessage.textContent = '';
}

function job() { return state.jobs.find(item => item.id === state.selectedId) || null; }
function agentName(id) { return state.agents.find(agent => agent.id === id)?.name || '미배정'; }

function renderMetrics() {
  const metrics = state.metrics || {};
  el.mActive.textContent = metrics.active ?? 0;
  el.mScheduled.textContent = metrics.scheduled ?? 0;
  el.mDispatched.textContent = metrics.dispatched ?? 0;
  el.mOnsite.textContent = metrics.onSite ?? 0;
  el.mUrgent.textContent = metrics.urgent ?? 0;
}

function renderList() {
  const query = el.search.value.trim().toLowerCase();
  const jobs = state.jobs.filter(currentJob => !el.statusFilter.value || currentJob.status === el.statusFilter.value).filter(currentJob => {
    if (!query) return true;
    return [currentJob.customerName, currentJob.address, currentJob.summary, agentName(currentJob.agentId)]
      .some(value => String(value || '').toLowerCase().includes(query));
  });
  el.jobList.replaceChildren();
  for (const currentJob of jobs) {
    const button = node('button', `job-card${currentJob.id === state.selectedId ? ' active' : ''}`);
    button.type = 'button';
    button.setAttribute('aria-label', `${currentJob.customerName}, ${uiLabel(currentJob.status)}, ${currentJob.summary}`);
    const heading = node('div', 'card-head');
    heading.append(node('strong', '', `#${currentJob.id} ${currentJob.customerName}`), badge(currentJob.status));
    button.append(
      heading,
      node('p', '', currentJob.summary),
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

async function run(action) {
  const currentJob = job();
  if (!currentJob) return;
  const suffix = { DISPATCH: 'dispatch', ON_SITE: 'on-site', COMPLETE: 'complete', NO_SHOW: 'no-show', CANCEL: 'cancel' }[action];
  if (!suffix) return;
  if (action === 'CANCEL' && !window.confirm('이 방문 작업을 취소하시겠습니까?')) return;
  try {
    await api(`/api/jobs/${currentJob.id}/${suffix}`, { method: 'POST', body: { expectedVersion: currentJob.version } });
    await refresh({ quiet: true });
    message(`${ACTION_LABELS[action] ?? '처리'}가 완료되었습니다.`);
  } catch (error) {
    message(friendlyError(error), true);
    if (error?.code === 'STALE_JOB') await refresh({ quiet: true });
    if (error?.status === 401) showLogin('로그인 시간이 만료되었습니다.');
  }
}

function renderDetail() {
  const currentJob = job();
  const open = Boolean(currentJob);
  el.detailPanel.classList.toggle('open', open);
  el.detailPanel.setAttribute('aria-hidden', String(!open));
  el.detailBackdrop.hidden = !open;
  document.body.classList.toggle('detail-open', open);
  el.empty.hidden = open;
  el.detail.hidden = !open;
  if (!currentJob) return;
  el.jobTitle.textContent = `#${currentJob.id} · ${currentJob.customerName}`;
  el.jobCopy.textContent = `${currentJob.address} · ${currentJob.summary}`;
  el.version.textContent = '';
  el.status.textContent = uiLabel(currentJob.status);
  el.priority.textContent = uiLabel(currentJob.priority);
  el.agent.textContent = agentName(currentJob.agentId);
  el.slot.textContent = currentJob.startAt ? `${fmt(currentJob.startAt)} ~ ${fmt(currentJob.endAt)}` : '아직 배정되지 않음';

  el.actions.replaceChildren();
  for (const action of (currentJob.allowedActions || []).filter(item => !['SCHEDULE', 'RESCHEDULE', 'REASSIGN'].includes(item))) {
    const button = node('button', `action ${action}`, ACTION_LABELS[action] ?? uiLabel(action));
    button.type = 'button';
    button.addEventListener('click', () => run(action));
    el.actions.append(button);
  }
  if (!el.actions.children.length) el.actions.append(node('span', 'muted', '현재 바로 처리할 작업이 없습니다.'));

  const canSchedule = (currentJob.allowedActions || []).some(action => ['SCHEDULE', 'RESCHEDULE', 'REASSIGN'].includes(action));
  el.schedule.disabled = !canSchedule;
  el.schedule.textContent = currentJob.status === 'REQUESTED' ? '일정 배정' : '일정 변경';
  if (currentJob.agentId) el.agentSelect.value = String(currentJob.agentId);
  if (currentJob.startAt && currentJob.endAt) {
    el.startAt.value = inputLocal(currentJob.startAt);
    el.endAt.value = inputLocal(currentJob.endAt);
  } else {
    el.startAt.value = `${workDate}T10:00`;
    el.endAt.value = `${workDate}T11:00`;
  }
}

function renderBoard() {
  el.agentBoard.replaceChildren();
  const head = node('div', 'schedule-head');
  head.append(node('span', '', '기사'));
  for (const hour of BOARD_HOURS) head.append(node('span', '', `${String(hour).padStart(2, '0')}:00`));
  el.agentBoard.append(head);

  for (const agent of state.agents.filter(item => item.active !== false)) {
    const row = node('div', 'schedule-row');
    const label = node('div', 'agent-label');
    label.append(node('strong', '', agent.name), node('span', '', agent.region || ''));
    row.append(label);
    const cells = BOARD_HOURS.map(() => node('div', 'time-cell'));
    for (const cell of cells) row.append(cell);

    const activeJobs = state.jobs.filter(currentJob => currentJob.agentId === agent.id && ['SCHEDULED', 'DISPATCHED', 'ON_SITE'].includes(currentJob.status) && currentJob.startAt && currentJob.endAt && localDate(currentJob.startAt) === workDate);
    for (const currentJob of activeJobs) {
      const start = localHour(currentJob.startAt);
      const index = BOARD_HOURS.indexOf(start);
      if (index < 0) continue;
      const card = node('button', `slot-card ${currentJob.status}${currentJob.priority === 'URGENT' ? ' URGENT' : ''}`);
      card.type = 'button';
      card.style.width = `calc(${Math.min(durationHours(currentJob), BOARD_HOURS.length - index) * 100}% - 8px)`;
      card.style.left = `calc(${localMinutes(currentJob.startAt) / 60 * 100}% + 4px)`;
      card.append(node('strong', '', currentJob.customerName), node('span', '', `${fmt(currentJob.startAt)} · ${uiLabel(currentJob.status)}`));
      card.addEventListener('click', () => { state.selectedId = currentJob.id; message(''); render(); });
      cells[index].append(card);
    }
    el.agentBoard.append(row);
  }
}

function renderAgents() {
  const selected = el.agentSelect.value;
  el.agentSelect.replaceChildren(...state.agents.filter(agent => agent.active !== false).map(agent => {
    const option = node('option', '', `${agent.name}${agent.region ? ` · ${agent.region}` : ''}`);
    option.value = String(agent.id);
    return option;
  }));
  if (selected && [...el.agentSelect.options].some(option => option.value === selected)) el.agentSelect.value = selected;
}

function renderAudits() {
  el.auditList.replaceChildren();
  for (const audit of state.audits.slice(0, 20)) {
    const row = node('article', 'audit');
    const heading = node('div');
    const principal = state.principal || {};
    heading.append(node('strong', '', `${ACTION_LABELS[audit.action] ?? uiLabel(audit.action)} · 작업 #${audit.jobId}`), node('span', '', audit.actor === principal.id ? principal.name : friendlyActor(audit.actor)));
    let detailText = audit.detail || '';
    for (const [key, label] of Object.entries(STATUS_LABELS)) detailText = detailText.replaceAll(key, label);
    row.append(heading, node('p', '', detailText || '상태 변경'));
    el.auditList.append(row);
  }
  if (!state.audits.length) el.auditList.append(node('div', 'empty compact', '변경 이력이 없습니다.'));
}

function render() {
  renderMetrics();
  renderList();
  renderAgents();
  renderBoard();
  renderDetail();
  renderAudits();
}

function scheduleWindowError(startValue, endValue) {
  if (!startValue || !endValue) return '방문 시작과 종료 시간을 입력해 주세요.';
  if (startValue.slice(0, 10) !== endValue.slice(0, 10)) return '방문 시작과 종료는 같은 날짜여야 합니다.';
  if (startValue.slice(0, 10) !== workDate) return '현재 배차 기준일 안에서 방문 시간을 지정해 주세요.';
  if (endValue <= startValue) return '방문 종료 시간은 시작 시간보다 늦어야 합니다.';
  const startTime = startValue.slice(11, 16);
  const endTime = endValue.slice(11, 16);
  if (startTime < '08:00' || endTime > '18:00') return '방문 시간은 08:00부터 18:00 사이로 지정해 주세요.';
  return '';
}

async function refresh({ quiet = false } = {}) {
  if (!quiet) showGlobalStatus('운영 데이터를 불러오고 있습니다.');
  try {
    const [principal, agents, jobs, metrics, audits] = await Promise.all([
      api('/api/me'), api('/api/agents'), api('/api/jobs'), api('/api/metrics'), api('/api/audits')
    ]);
    if (principal.csrfToken) csrfToken = principal.csrfToken;
    applyPrincipal(principal);
    state.agents = agents.items || [];
    state.jobs = jobs.items || [];
    state.metrics = metrics;
    state.audits = audits.items || [];
    if (state.selectedId != null && !state.jobs.some(item => item.id === state.selectedId)) state.selectedId = null;
    render();
    showGlobalStatus('');
  } catch (error) {
    showGlobalStatus(friendlyError(error, '운영 데이터를 불러오지 못했습니다.'), true);
    if (error?.status === 401) showLogin(error.message || '로그인이 필요합니다.');
    throw error;
  }
}

function inquiryAdapter() {
  return {
    list: () => api('/api/inquiries'),
    get: id => api(`/api/inquiries/${encodeURIComponent(id)}`),
    audits: id => api(`/api/inquiries/${encodeURIComponent(id)}/audits`),
    contacted: (id, expectedVersion) => api(`/api/inquiries/${encodeURIComponent(id)}/contacted`, { method: 'POST', body: { expectedVersion } }),
    visit: (id, expectedVersion, input) => api(`/api/inquiries/${encodeURIComponent(id)}/visit-request`, { method: 'POST', body: { expectedVersion, ...input } }),
    close: (id, expectedVersion) => api(`/api/inquiries/${encodeURIComponent(id)}/close`, { method: 'POST', body: { expectedVersion } })
  };
}

function teamAdapter() {
  return {
    listUsers: () => api('/api/admin/users'),
    authAudits: () => api('/api/admin/auth-audits'),
    createUser: input => api('/api/admin/users', { method: 'POST', body: input }),
    updateUser: (id, input) => api(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'POST', body: input }),
    resetPassword: (id, password) => api(`/api/admin/users/${encodeURIComponent(id)}/password`, { method: 'POST', body: { password } })
  };
}

async function startAuthenticated(principal) {
  applyPrincipal(principal);
  hideLogin();
  if (!inquiryDesk) {
    inquiryDesk = mountInquiryDesk({
      adapter: inquiryAdapter(),
      principal,
      onCount: count => { if (el.inquiryBadge) el.inquiryBadge.textContent = String(count); },
      onVisitCreated: async fieldJob => {
        await refresh({ quiet: true });
        state.selectedId = Number(fieldJob.id);
        activateWorkspace('dispatch');
        render();
      }
    });
  }
  if (principal.role === 'ADMIN' && !teamAdmin) {
    teamAdmin = mountTeamAdmin({ adapter: teamAdapter(), currentUserId: principal.id });
  }
  await Promise.all([refresh({ quiet: true }), inquiryDesk.refresh()]);
}

el.search.addEventListener('input', renderList);
el.statusFilter.addEventListener('change', renderList);
el.closeDetail.addEventListener('click', closeDrawer);
el.detailBackdrop.addEventListener('click', closeDrawer);
document.addEventListener('keydown', event => { if (event.key === 'Escape' && state.selectedId != null) closeDrawer(); });

el.schedule.addEventListener('click', async () => {
  const currentJob = job();
  if (!currentJob) return;
  const windowError = scheduleWindowError(el.startAt.value, el.endAt.value);
  if (windowError) { message(windowError, true); return; }
  try {
    const requestBody = {
      expectedVersion: currentJob.version,
      agentId: Number(el.agentSelect.value),
      startAt: koreaIso(el.startAt.value),
      endAt: koreaIso(el.endAt.value),
      overrideReason: el.override.value
    };
    const suffix = currentJob.status === 'REQUESTED' ? 'schedule' : 'reschedule';
    await api(`/api/jobs/${currentJob.id}/${suffix}`, { method: 'POST', body: requestBody });
    await refresh({ quiet: true });
    message(currentJob.status === 'REQUESTED' ? '방문 일정을 배정했습니다.' : '방문 일정을 변경했습니다.');
    el.override.value = '';
  } catch (error) {
    message(friendlyError(error, '일정 정보를 다시 확인해 주세요.'), true);
    if (error?.code === 'STALE_JOB') await refresh({ quiet: true });
    if (error?.status === 401) showLogin('로그인 시간이 만료되었습니다.');
  }
});

el.loginForm?.addEventListener('submit', async event => {
  event.preventDefault();
  const username = String(el.loginUsername?.value || '').trim();
  const password = String(el.loginPassword?.value || '');
  if (el.loginMessage) {
    el.loginMessage.textContent = '로그인하고 있습니다.';
    el.loginMessage.dataset.error = 'false';
  }
  try {
    const session = await api('/api/auth/login', { method: 'POST', body: { username, password }, skipCsrf: true });
    csrfToken = session.csrfToken || '';
    if (el.loginPassword) el.loginPassword.value = '';
    await startAuthenticated(session.principal);
  } catch (error) {
    if (el.loginMessage) {
      el.loginMessage.textContent = error instanceof Error ? error.message : '로그인하지 못했습니다.';
      el.loginMessage.dataset.error = 'true';
    }
  }
});

el.logout?.addEventListener('click', async () => {
  try { await api('/api/auth/logout', { method: 'POST', body: {} }); } catch {}
  csrfToken = '';
  state.principal = null;
  state.jobs = [];
  state.agents = [];
  state.audits = [];
  if (el.loginPassword) el.loginPassword.value = '';
  showLogin('로그아웃되었습니다.');
});

applyWorkDate();
document.body.classList.add('auth-required');
api('/api/me').then(principal => {
  if (principal.csrfToken) csrfToken = principal.csrfToken;
  return startAuthenticated(principal);
}).catch(error => {
  if (error?.status === 401) showLogin('');
  else showLogin('운영 서버에 연결하지 못했습니다.');
});
