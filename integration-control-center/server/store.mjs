import { randomUUID } from 'node:crypto';

export const CONNECTIONS = Object.freeze([
  { id: 'crm-demo', name: 'CRM Demo', kind: 'REST API', state: 'ACTIVE' },
  { id: 'erp-demo', name: 'ERP Demo', kind: 'REST API', state: 'ACTIVE' },
  { id: 'billing-demo', name: 'Billing Demo', kind: 'Webhook', state: 'PAUSED' },
  { id: 'warehouse-demo', name: 'Warehouse Demo', kind: 'REST API', state: 'ERROR' },
  { id: 'sheet-demo', name: 'Spreadsheet Demo', kind: 'File import', state: 'ACTIVE' },
  { id: 'analytics-demo', name: 'Analytics Demo', kind: 'Batch export', state: 'ACTIVE' }
]);

const ENTITIES = new Set(['customers', 'orders', 'inventory', 'invoices']);
const SCHEDULES = new Set(['manual', 'hourly', 'daily']);
const POLICIES = new Set(['retry-3', 'stop', 'skip-row']);
const connectionIds = new Set(CONNECTIONS.map((item) => item.id));

const DEFAULT_JOBS = Object.freeze([
  { id: 'job-customer-master', name: 'Customer master sync', source: 'crm-demo', target: 'erp-demo', entity: 'customers', schedule: 'hourly', policy: 'retry-3', status: 'ACTIVE', lastRun: null },
  { id: 'job-order-export', name: 'Order analytics export', source: 'erp-demo', target: 'analytics-demo', entity: 'orders', schedule: 'daily', policy: 'skip-row', status: 'ACTIVE', lastRun: null },
  { id: 'job-stock-sync', name: 'Inventory sync', source: 'warehouse-demo', target: 'erp-demo', entity: 'inventory', schedule: 'manual', policy: 'stop', status: 'PAUSED', lastRun: null }
]);

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function cleanText(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function connectionState(id) {
  return CONNECTIONS.find((item) => item.id === id)?.state ?? 'ERROR';
}

export function validateJobInput(input) {
  if (!input || typeof input !== 'object') throw new ApiError(400, 'INVALID_BODY', 'JSON object body is required.');
  const name = cleanText(input.name, 80);
  const source = cleanText(input.source, 60);
  const target = cleanText(input.target, 60);
  const entity = cleanText(input.entity, 40);
  const schedule = cleanText(input.schedule, 40);
  const policy = cleanText(input.policy, 40);

  if (!name) throw new ApiError(400, 'INVALID_JOB_NAME', 'Job name is required.');
  if (!connectionIds.has(source) || !connectionIds.has(target)) throw new ApiError(400, 'INVALID_CONNECTION', 'Source and target must reference known connections.');
  if (source === target) throw new ApiError(400, 'SAME_CONNECTION', 'Source and target must be different.');
  if (!ENTITIES.has(entity)) throw new ApiError(400, 'INVALID_ENTITY', 'Unsupported entity.');
  if (!SCHEDULES.has(schedule)) throw new ApiError(400, 'INVALID_SCHEDULE', 'Unsupported schedule.');
  if (!POLICIES.has(policy)) throw new ApiError(400, 'INVALID_POLICY', 'Unsupported failure policy.');

  return { name, source, target, entity, schedule, policy };
}

export function createStore() {
  let jobs = DEFAULT_JOBS.map((job) => ({ ...job }));
  let runs = [];
  const idempotentRuns = new Map();

  function requireJob(id) {
    const job = jobs.find((item) => item.id === id);
    if (!job) throw new ApiError(404, 'JOB_NOT_FOUND', `Job not found: ${id}`);
    return job;
  }

  return {
    listConnections() {
      return CONNECTIONS.map((item) => ({ ...item }));
    },
    listJobs() {
      return jobs.map((item) => ({ ...item }));
    },
    listRuns(limit = 50) {
      const safeLimit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 100) : 50;
      return runs.slice(0, safeLimit).map((item) => ({ ...item }));
    },
    createJob(input) {
      const value = validateJobInput(input);
      const job = { id: `job-${randomUUID()}`, ...value, status: 'ACTIVE', lastRun: null };
      jobs = [job, ...jobs].slice(0, 100);
      return { ...job };
    },
    setJobStatus(id, nextStatus) {
      const job = requireJob(id);
      if (!['ACTIVE', 'PAUSED'].includes(nextStatus)) throw new ApiError(400, 'INVALID_STATUS', 'Status must be ACTIVE or PAUSED.');
      if (job.status === nextStatus) throw new ApiError(409, 'STATUS_UNCHANGED', `Job is already ${nextStatus}.`);
      jobs = jobs.map((item) => item.id === id ? { ...item, status: nextStatus } : item);
      return { ...requireJob(id) };
    },
    runJob(id, idempotencyKey = '') {
      const job = requireJob(id);
      const key = cleanText(idempotencyKey, 120);
      if (key && idempotentRuns.has(`${id}:${key}`)) return { ...idempotentRuns.get(`${id}:${key}`), replayed: true };
      if (job.status !== 'ACTIVE') throw new ApiError(409, 'JOB_PAUSED', 'Paused jobs cannot run.');

      const sourceState = connectionState(job.source);
      const targetState = connectionState(job.target);
      const failed = sourceState !== 'ACTIVE' || targetState !== 'ACTIVE';
      const at = new Date().toISOString();
      const seed = [...job.name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
      const run = {
        id: `run-${randomUUID()}`,
        jobId: job.id,
        jobName: job.name,
        result: failed ? 'FAILED' : 'SUCCESS',
        at,
        processed: failed ? 0 : 80 + (seed % 421),
        detail: failed ? `Connection health check failed (${sourceState} -> ${targetState})` : `Completed with ${job.policy}`,
        replayed: false
      };
      runs = [run, ...runs].slice(0, 200);
      jobs = jobs.map((item) => item.id === id ? { ...item, lastRun: at } : item);
      if (key) idempotentRuns.set(`${id}:${key}`, run);
      return { ...run };
    },
    reset() {
      jobs = DEFAULT_JOBS.map((job) => ({ ...job }));
      runs = [];
      idempotentRuns.clear();
    }
  };
}
