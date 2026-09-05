const STORAGE_JOBS = 'icc-v1-jobs';
const STORAGE_RUNS = 'icc-v1-runs';

const connections = [
  { id: 'crm-demo', name: 'CRM Demo', kind: 'REST API', state: 'ACTIVE' },
  { id: 'erp-demo', name: 'ERP Demo', kind: 'REST API', state: 'ACTIVE' },
  { id: 'billing-demo', name: 'Billing Demo', kind: 'Webhook', state: 'PAUSED' },
  { id: 'warehouse-demo', name: 'Warehouse Demo', kind: 'REST API', state: 'ERROR' },
  { id: 'sheet-demo', name: 'Spreadsheet Demo', kind: 'File import', state: 'ACTIVE' },
  { id: 'analytics-demo', name: 'Analytics Demo', kind: 'Batch export', state: 'ACTIVE' }
];

const allowedEntities = new Set(['customers', 'orders', 'inventory', 'invoices']);
const allowedSchedules = new Set(['manual', 'hourly', 'daily']);
const allowedPolicies = new Set(['retry-3', 'stop', 'skip-row']);
const connectionIds = new Set(connections.map((item) => item.id));

const defaultJobs = [
  { id: 'job-customer-master', name: 'Customer master sync', source: 'crm-demo', target: 'erp-demo', entity: 'customers', schedule: 'hourly', policy: 'retry-3', status: 'ACTIVE', lastRun: null },
  { id: 'job-order-export', name: 'Order analytics export', source: 'erp-demo', target: 'analytics-demo', entity: 'orders', schedule: 'daily', policy: 'skip-row', status: 'ACTIVE', lastRun: null },
  { id: 'job-stock-sync', name: 'Inventory sync', source: 'warehouse-demo', target: 'erp-demo', entity: 'inventory', schedule: 'manual', policy: 'stop', status: 'PAUSED', lastRun: null }
];

const byId = (id) => document.getElementById(id);
const elements = {
  connections: byId('connectionList'),
  jobs: byId('jobTable'),
  history: byId('historyList'),
  form: byId('jobForm'),
  name: byId('jobName'),
  source: byId('jobSource'),
  target: byId('jobTarget'),
  entity: byId('jobEntity'),
  schedule: byId('jobSchedule'),
  policy: byId('jobPolicy'),
  formStatus: byId('formStatus'),
  metricConnections: byId('metricConnections'),
  metricActive: byId('metricActive'),
  metricFailed: byId('metricFailed'),
  metricRuns: byId('metricRuns')
};

function safeText(value, max = 120) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function sanitizeJob(value) {
  if (!value || typeof value !== 'object') return null;
  const id = safeText(value.id, 100);
  const name = safeText(value.name, 80);
  const source = safeText(value.source, 60);
  const target = safeText(value.target, 60);
  const entity = safeText(value.entity, 40);
  const schedule = safeText(value.schedule, 40);
  const policy = safeText(value.policy, 40);
  const status = value.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE';
  const lastRun = typeof value.lastRun === 'string' ? value.lastRun.slice(0, 40) : null;
  if (!id || !name || source === target) return null;
  if (!connectionIds.has(source) || !connectionIds.has(target)) return null;
  if (!allowedEntities.has(entity) || !allowedSchedules.has(schedule) || !allowedPolicies.has(policy)) return null;
  return { id, name, source, target, entity, schedule, policy, status, lastRun };
}

function sanitizeRun(value) {
  if (!value || typeof value !== 'object') return null;
  const id = safeText(value.id, 100);
  const jobId = safeText(value.jobId, 100);
  const jobName = safeText(value.jobName, 80);
  const result = value.result === 'FAILED' ? 'FAILED' : value.result === 'SUCCESS' ? 'SUCCESS' : null;
  const at = typeof value.at === 'string' ? value.at.slice(0, 40) : '';
  const processed = Number.isInteger(value.processed) && value.processed >= 0 && value.processed <= 1000000 ? value.processed : 0;
  const detail = safeText(value.detail, 180);
  if (!id || !jobId || !jobName || !result || !at) return null;
  return { id, jobId, jobName, result, at, processed, detail };
}

function loadArray(key, sanitizer, fallback = []) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(parsed)) return fallback;
    const sanitized = parsed.map(sanitizer).filter(Boolean);
    return sanitized.length ? sanitized : fallback;
  } catch {
    return fallback;
  }
}

let jobs = loadArray(STORAGE_JOBS, sanitizeJob, defaultJobs.map((job) => ({ ...job })));
let runs = loadArray(STORAGE_RUNS, sanitizeRun, []);

function persist() {
  localStorage.setItem(STORAGE_JOBS, JSON.stringify(jobs));
  localStorage.setItem(STORAGE_RUNS, JSON.stringify(runs.slice(0, 80)));
}

function connectionName(id) {
  return connections.find((item) => item.id === id)?.name || id;
}

function connectionState(id) {
  return connections.find((item) => item.id === id)?.state || 'ERROR';
}

function option(value, label) {
  const node = document.createElement('option');
  node.value = value;
  node.textContent = label;
  return node;
}

function renderConnections() {
  const fragment = document.createDocumentFragment();
  connections.forEach((connection) => {
    const card = document.createElement('article');
    card.className = 'connection';
    const name = document.createElement('strong');
    name.textContent = connection.name;
    const kind = document.createElement('span');
    kind.textContent = connection.kind;
    const state = document.createElement('span');
    state.className = `state state-${connection.state.toLowerCase()}`;
    state.textContent = connection.state;
    card.append(name, kind, state);
    fragment.append(card);
  });
  elements.connections.replaceChildren(fragment);
}

function renderConnectionSelects() {
  const usable = connections.filter((item) => item.state !== 'ERROR');
  const sourceOptions = [option('', 'Source 선택'), ...usable.map((item) => option(item.id, item.name))];
  const targetOptions = [option('', 'Target 선택'), ...usable.map((item) => option(item.id, item.name))];
  elements.source.replaceChildren(...sourceOptions);
  elements.target.replaceChildren(...targetOptions);
}

function statusNode(status) {
  const node = document.createElement('span');
  node.className = `job-status job-${status.toLowerCase()}`;
  node.textContent = status;
  return node;
}

function button(label, className, handler) {
  const node = document.createElement('button');
  node.type = 'button';
  node.textContent = label;
  if (className) node.className = className;
  node.addEventListener('click', handler);
  return node;
}

function renderJobs() {
  const fragment = document.createDocumentFragment();
  jobs.forEach((job) => {
    const row = document.createElement('tr');
    const nameCell = document.createElement('td');
    const name = document.createElement('strong');
    name.textContent = job.name;
    nameCell.append(name);

    const flow = document.createElement('td');
    flow.textContent = `${connectionName(job.source)} → ${connectionName(job.target)}`;
    const entity = document.createElement('td'); entity.textContent = job.entity;
    const schedule = document.createElement('td'); schedule.textContent = job.schedule;
    const policy = document.createElement('td'); policy.textContent = job.policy;
    const status = document.createElement('td'); status.append(statusNode(job.status));
    const lastRun = document.createElement('td'); lastRun.textContent = job.lastRun ? new Date(job.lastRun).toLocaleString('ko-KR') : '-';
    const actions = document.createElement('td');
    const group = document.createElement('div'); group.className = 'action-group';
    group.append(
      button('실행', 'run', () => runJob(job.id)),
      button(job.status === 'ACTIVE' ? '일시정지' : '재개', '', () => toggleJob(job.id))
    );
    actions.append(group);
    row.append(nameCell, flow, entity, schedule, policy, status, lastRun, actions);
    fragment.append(row);
  });
  elements.jobs.replaceChildren(fragment);
}

function renderHistory() {
  if (!runs.length) {
    const empty = document.createElement('p');
    empty.className = 'form-status';
    empty.textContent = '아직 실행 이력이 없습니다.';
    elements.history.replaceChildren(empty);
    return;
  }
  const fragment = document.createDocumentFragment();
  runs.slice(0, 20).forEach((run) => {
    const row = document.createElement('article');
    row.className = `history ${run.result === 'FAILED' ? 'failed' : ''}`;
    const dot = document.createElement('span'); dot.className = 'dot';
    const body = document.createElement('div');
    const title = document.createElement('strong'); title.textContent = `${run.jobName} · ${run.result}`;
    const detail = document.createElement('span'); detail.textContent = `${run.detail} · ${run.processed} rows`;
    body.append(title, detail);
    const time = document.createElement('time'); time.textContent = new Date(run.at).toLocaleString('ko-KR');
    row.append(dot, body, time);
    fragment.append(row);
  });
  elements.history.replaceChildren(fragment);
}

function renderMetrics() {
  elements.metricConnections.textContent = String(connections.length);
  elements.metricActive.textContent = String(jobs.filter((job) => job.status === 'ACTIVE').length);
  elements.metricFailed.textContent = String(runs.filter((run) => run.result === 'FAILED').length);
  elements.metricRuns.textContent = String(runs.length);
}

function render() {
  renderConnections();
  renderJobs();
  renderHistory();
  renderMetrics();
}

function createId(prefix) {
  return `${prefix}-${typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function toggleJob(id) {
  jobs = jobs.map((job) => job.id === id ? { ...job, status: job.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' } : job);
  persist();
  render();
}

function runJob(id) {
  const job = jobs.find((item) => item.id === id);
  if (!job) return;
  if (job.status !== 'ACTIVE') {
    elements.formStatus.textContent = '일시정지된 작업은 실행할 수 없습니다.';
    return;
  }

  const now = new Date().toISOString();
  const blocked = connectionState(job.source) === 'ERROR' || connectionState(job.target) === 'ERROR';
  const pausedConnection = connectionState(job.source) === 'PAUSED' || connectionState(job.target) === 'PAUSED';
  const result = blocked || pausedConnection ? 'FAILED' : 'SUCCESS';
  const seed = [...job.name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const processed = result === 'SUCCESS' ? 80 + (seed % 421) : 0;
  const detail = result === 'SUCCESS'
    ? `Completed with ${job.policy}`
    : pausedConnection ? 'Connection is paused' : 'Connection health check failed';

  runs = [{ id: createId('run'), jobId: job.id, jobName: job.name, result, at: now, processed, detail }, ...runs].slice(0, 80);
  jobs = jobs.map((item) => item.id === id ? { ...item, lastRun: now } : item);
  persist();
  render();
  elements.formStatus.textContent = result === 'SUCCESS' ? '시뮬레이션 실행이 완료되었습니다.' : '실패 상태를 Run history에 기록했습니다.';
}

elements.form.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = safeText(elements.name.value, 80);
  const source = elements.source.value;
  const target = elements.target.value;
  const entity = elements.entity.value;
  const schedule = elements.schedule.value;
  const policy = elements.policy.value;
  if (!name || !connectionIds.has(source) || !connectionIds.has(target) || source === target) {
    elements.formStatus.textContent = '작업명과 서로 다른 Source / Target을 선택해 주세요.';
    return;
  }
  if (!allowedEntities.has(entity) || !allowedSchedules.has(schedule) || !allowedPolicies.has(policy)) {
    elements.formStatus.textContent = '허용되지 않은 작업 설정입니다.';
    return;
  }
  jobs = [{ id: createId('job'), name, source, target, entity, schedule, policy, status: 'ACTIVE', lastRun: null }, ...jobs].slice(0, 40);
  elements.form.reset();
  elements.formStatus.textContent = '동기화 작업을 추가했습니다.';
  persist();
  render();
});

byId('resetDemo').addEventListener('click', () => {
  jobs = defaultJobs.map((job) => ({ ...job }));
  runs = [];
  persist();
  render();
  elements.formStatus.textContent = '데모 상태를 초기화했습니다.';
});

byId('clearHistory').addEventListener('click', () => {
  runs = [];
  persist();
  render();
});

renderConnectionSelects();
render();
