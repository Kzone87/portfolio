import { randomUUID } from 'node:crypto';

export const CONNECTIONS = Object.freeze([
  { id: 'crm-demo', name: 'CRM Demo', kind: 'REST API', state: 'ACTIVE' },
  { id: 'erp-demo', name: 'ERP Demo', kind: 'REST API', state: 'ACTIVE' },
  { id: 'billing-demo', name: 'Billing Demo', kind: 'Webhook', state: 'PAUSED' },
  { id: 'warehouse-demo', name: 'Warehouse Demo', kind: 'REST API', state: 'ERROR' },
  { id: 'sheet-demo', name: 'Spreadsheet Demo', kind: 'File import', state: 'ACTIVE' },
  { id: 'analytics-demo', name: 'Analytics Demo', kind: 'Batch export', state: 'ACTIVE' },
  { id: 'orders-webhook-demo', name: 'Order Webhook Demo', kind: 'Webhook', state: 'ACTIVE' }
]);

const ENTITIES = new Set(['customers', 'orders', 'inventory', 'invoices']);
const SCHEDULES = new Set(['manual', 'hourly', 'daily', 'webhook']);
const POLICIES = new Set(['retry-3', 'stop', 'skip-row']);
const WEBHOOK_TYPES = Object.freeze({
  'customer.updated': 'customers',
  'order.updated': 'orders',
  'inventory.updated': 'inventory',
  'invoice.updated': 'invoices'
});
const MAX_RETRY_COUNT = 3;
const connectionIds = new Set(CONNECTIONS.map((item) => item.id));

const DEFAULT_JOBS = Object.freeze([
  { id: 'job-customer-master', name: 'Customer master sync', source: 'crm-demo', target: 'erp-demo', entity: 'customers', schedule: 'hourly', policy: 'retry-3', status: 'ACTIVE', lastRun: null },
  { id: 'job-order-export', name: 'Order analytics export', source: 'erp-demo', target: 'analytics-demo', entity: 'orders', schedule: 'daily', policy: 'skip-row', status: 'ACTIVE', lastRun: null },
  { id: 'job-stock-sync', name: 'Inventory sync', source: 'warehouse-demo', target: 'erp-demo', entity: 'inventory', schedule: 'manual', policy: 'retry-3', status: 'PAUSED', lastRun: null },
  { id: 'job-order-webhook', name: 'Inbound order webhook sync', source: 'orders-webhook-demo', target: 'erp-demo', entity: 'orders', schedule: 'webhook', policy: 'retry-3', status: 'ACTIVE', lastRun: null }
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

function requireObject(value, code, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, code, message);
  return value;
}

export function validateJobInput(input) {
  requireObject(input, 'INVALID_BODY', 'JSON object body is required.');
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

export function validateWebhookInput(input) {
  requireObject(input, 'INVALID_WEBHOOK_BODY', 'Webhook body must be a JSON object.');
  const eventId = cleanText(input.eventId, 120);
  const type = cleanText(input.type, 80);
  const payload = input.payload ?? {};
  if (!eventId) throw new ApiError(400, 'EVENT_ID_REQUIRED', 'eventId is required.');
  if (!Object.hasOwn(WEBHOOK_TYPES, type)) throw new ApiError(400, 'INVALID_EVENT_TYPE', 'Unsupported webhook event type.');
  requireObject(payload, 'INVALID_EVENT_PAYLOAD', 'payload must be a JSON object.');
  return { eventId, type, entity: WEBHOOK_TYPES[type], payload };
}

export function createStore() {
  let jobs = DEFAULT_JOBS.map((job) => ({ ...job }));
  let runs = [];
  let webhookEvents = [];
  let deadLetters = [];
  const idempotentRuns = new Map();
  const webhookDedup = new Map();

  function requireJob(id) {
    const job = jobs.find((item) => item.id === id);
    if (!job) throw new ApiError(404, 'JOB_NOT_FOUND', `Job not found: ${id}`);
    return job;
  }

  function requireRun(id) {
    const run = runs.find((item) => item.id === id);
    if (!run) throw new ApiError(404, 'RUN_NOT_FOUND', `Run not found: ${id}`);
    return run;
  }

  function executeJob(job, context = {}) {
    if (job.status !== 'ACTIVE') throw new ApiError(409, 'JOB_PAUSED', 'Paused jobs cannot run.');
    const sourceState = connectionState(job.source);
    const targetState = connectionState(job.target);
    const connectionFailure = sourceState !== 'ACTIVE' || targetState !== 'ACTIVE';
    const forcedFailure = context.forceFailure === true;
    const failed = connectionFailure || forcedFailure;
    const at = new Date().toISOString();
    const seed = [...job.name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const retryCount = Number.isInteger(context.retryCount) ? context.retryCount : 0;
    const deadLettered = failed && retryCount >= MAX_RETRY_COUNT;
    const result = deadLettered ? 'DEAD_LETTER' : failed ? 'FAILED' : 'SUCCESS';
    const detail = forcedFailure
      ? 'Simulated transient downstream failure.'
      : connectionFailure
        ? `Connection health check failed (${sourceState} -> ${targetState})`
        : `Completed with ${job.policy}`;
    const run = {
      id: `run-${randomUUID()}`,
      jobId: job.id,
      jobName: job.name,
      result,
      at,
      processed: failed ? 0 : 80 + (seed % 421),
      detail,
      replayed: false,
      trigger: context.trigger ?? 'MANUAL',
      eventId: context.eventId ?? null,
      retryOf: context.retryOf ?? null,
      retryCount,
      deadLettered
    };
    runs = [run, ...runs].slice(0, 300);
    jobs = jobs.map((item) => item.id === job.id ? { ...item, lastRun: at } : item);
    if (deadLettered) {
      deadLetters = [{
        id: `dead-${randomUUID()}`,
        runId: run.id,
        rootRunId: context.rootRunId ?? context.retryOf ?? run.id,
        jobId: run.jobId,
        jobName: run.jobName,
        reason: run.detail,
        at
      }, ...deadLetters].slice(0, 100);
    }
    return run;
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
    getRun(id) {
      return { ...requireRun(id) };
    },
    listWebhookEvents(limit = 50) {
      const safeLimit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 100) : 50;
      return webhookEvents.slice(0, safeLimit).map((item) => ({ ...item }));
    },
    listDeadLetters(limit = 50) {
      const safeLimit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 100) : 50;
      return deadLetters.slice(0, safeLimit).map((item) => ({ ...item }));
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
      const run = executeJob(job);
      if (key) idempotentRuns.set(`${id}:${key}`, run);
      return { ...run };
    },
    receiveWebhook(connectionId, input) {
      if (!connectionIds.has(connectionId)) throw new ApiError(404, 'CONNECTION_NOT_FOUND', `Connection not found: ${connectionId}`);
      const connection = CONNECTIONS.find((item) => item.id === connectionId);
      if (connection?.kind !== 'Webhook') throw new ApiError(409, 'NOT_WEBHOOK_CONNECTION', 'Connection is not configured for webhooks.');
      if (connection.state !== 'ACTIVE') throw new ApiError(409, 'CONNECTION_NOT_ACTIVE', 'Webhook connection is not active.');
      const value = validateWebhookInput(input);
      const dedupKey = `${connectionId}:${value.eventId}`;
      if (webhookDedup.has(dedupKey)) return { ...webhookDedup.get(dedupKey), replayed: true };

      const job = jobs.find((item) => item.source === connectionId && item.entity === value.entity && item.schedule === 'webhook');
      if (!job) throw new ApiError(409, 'NO_WEBHOOK_JOB', 'No active webhook job matches this event.');
      if (job.status !== 'ACTIVE') throw new ApiError(409, 'WEBHOOK_JOB_PAUSED', 'Matching webhook job is paused.');

      const run = executeJob(job, {
        trigger: 'WEBHOOK',
        eventId: value.eventId,
        forceFailure: value.payload.simulateFailure === true
      });
      const event = {
        id: `evt-${randomUUID()}`,
        connectionId,
        eventId: value.eventId,
        type: value.type,
        entity: value.entity,
        status: run.result === 'SUCCESS' ? 'PROCESSED' : 'FAILED',
        runId: run.id,
        receivedAt: new Date().toISOString(),
        replayed: false
      };
      webhookEvents = [event, ...webhookEvents].slice(0, 200);
      webhookDedup.set(dedupKey, event);
      return { ...event };
    },
    retryRun(id) {
      const previous = requireRun(id);
      if (previous.result !== 'FAILED') throw new ApiError(409, 'RUN_NOT_RETRYABLE', 'Only FAILED runs can be retried.');
      if (previous.retryCount >= MAX_RETRY_COUNT) throw new ApiError(409, 'RETRY_LIMIT_REACHED', 'Retry limit reached.');
      const job = requireJob(previous.jobId);
      const nextRetryCount = previous.retryCount + 1;
      const rootRunId = previous.retryOf ?? previous.id;
      const run = executeJob(job, {
        trigger: 'RETRY',
        eventId: previous.eventId,
        retryOf: previous.id,
        retryCount: nextRetryCount,
        rootRunId
      });
      return { ...run };
    },
    reset() {
      jobs = DEFAULT_JOBS.map((job) => ({ ...job }));
      runs = [];
      webhookEvents = [];
      deadLetters = [];
      idempotentRuns.clear();
      webhookDedup.clear();
    }
  };
}
