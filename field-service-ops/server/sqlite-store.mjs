import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  ACTIVE_SLOT_STATUSES,
  JOB_STATUS,
  PRIORITY,
  assertExpectedVersion,
  arriveOnSite,
  cancelJob,
  completeJob,
  computeMetrics,
  createJob,
  dispatchJob,
  markNoShow,
  overlaps,
  scheduleJob,
  snapshotJob
} from '../engine.mjs';
import { DomainError } from './store.mjs';

const DEMO_AGENTS = [
  { id: 1, name: 'Agent A', region: 'Central', active: true },
  { id: 2, name: 'Agent B', region: 'East', active: true },
  { id: 3, name: 'Agent C', region: 'West', active: true }
];

const DEMO_JOBS = [
  { id: 1, customerName: 'Alpha Office', address: '10 Central Ave', summary: 'Routine equipment inspection', priority: PRIORITY.NORMAL, status: JOB_STATUS.SCHEDULED, agentId: 1, startAt: '2026-09-07T00:00:00.000Z', endAt: '2026-09-07T01:00:00.000Z', version: 2, overrideReason: null },
  { id: 2, customerName: 'Beta Lab', address: '25 East Street', summary: 'Urgent service interruption check', priority: PRIORITY.URGENT, status: JOB_STATUS.DISPATCHED, agentId: 2, startAt: '2026-09-07T01:00:00.000Z', endAt: '2026-09-07T03:00:00.000Z', version: 3, overrideReason: null },
  { id: 3, customerName: 'Gamma Studio', address: '31 West Road', summary: 'Installation follow-up visit', priority: PRIORITY.NORMAL, status: JOB_STATUS.REQUESTED, agentId: null, startAt: null, endAt: null, version: 1, overrideReason: null },
  { id: 4, customerName: 'Delta Retail', address: '44 Market Lane', summary: 'Final commissioning verification', priority: PRIORITY.NORMAL, status: JOB_STATUS.ON_SITE, agentId: 3, startAt: '2026-09-07T02:00:00.000Z', endAt: '2026-09-07T04:00:00.000Z', version: 4, overrideReason: null }
];

const DEMO_AUDITS = [
  { id: 1, jobId: 1, actor: 'dispatcher', action: 'SCHEDULE', detail: 'Agent A', jobVersion: 2 },
  { id: 2, jobId: 2, actor: 'dispatcher', action: 'SCHEDULE', detail: 'Agent B', jobVersion: 2 },
  { id: 3, jobId: 2, actor: 'dispatcher', action: 'DISPATCH', detail: '', jobVersion: 3 },
  { id: 4, jobId: 4, actor: 'dispatcher', action: 'SCHEDULE', detail: 'Agent C', jobVersion: 2 },
  { id: 5, jobId: 4, actor: 'dispatcher', action: 'DISPATCH', detail: '', jobVersion: 3 },
  { id: 6, jobId: 4, actor: 'field-agent', action: 'ON_SITE', detail: '', jobVersion: 4 },
  { id: 7, jobId: 3, actor: 'system', action: 'CREATE', detail: 'unassigned request', jobVersion: 1 }
];

const nowIso = () => new Date().toISOString();
const clone = value => structuredClone(value);

function mapError(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith('STALE_JOB_VERSION:')) return new DomainError(409, 'STALE_JOB', message);
  if (/expectedVersion/.test(message)) return new DomainError(400, 'EXPECTED_VERSION_REQUIRED', message);
  return new DomainError(409, 'INVALID_JOB_ACTION', message);
}

function rowToJob(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    customerName: row.customer_name,
    address: row.address,
    summary: row.summary,
    priority: row.priority,
    status: row.status,
    agentId: row.agent_id == null ? null : Number(row.agent_id),
    startAt: row.start_at,
    endAt: row.end_at,
    version: Number(row.version),
    overrideReason: row.override_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToAudit(row) {
  return {
    id: Number(row.id),
    jobId: Number(row.job_id),
    actor: row.actor,
    action: row.action,
    detail: row.detail,
    jobVersion: Number(row.job_version),
    createdAt: row.created_at
  };
}

export function createSqliteStore(path = ':memory:', options = {}) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      region TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
    );
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      address TEXT NOT NULL,
      summary TEXT NOT NULL,
      priority TEXT NOT NULL CHECK(priority IN ('NORMAL','URGENT')),
      status TEXT NOT NULL CHECK(status IN ('REQUESTED','SCHEDULED','DISPATCHED','ON_SITE','COMPLETED','CANCELLED','NO_SHOW')),
      agent_id INTEGER REFERENCES agents(id),
      start_at TEXT,
      end_at TEXT,
      version INTEGER NOT NULL CHECK(version >= 1),
      override_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_jobs_agent_status ON jobs(agent_id, status);
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    CREATE TABLE IF NOT EXISTS audits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL REFERENCES jobs(id),
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      job_version INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audits_job_id ON audits(job_id, id DESC);
  `);

  const bootstrapAgents = Array.isArray(options.agents) ? options.agents : (options.seedDemo ? DEMO_AGENTS : []);
  if (Number(db.prepare('SELECT COUNT(*) AS count FROM agents').get().count) === 0 && bootstrapAgents.length) {
    const insert = db.prepare('INSERT INTO agents(id, name, region, active) VALUES(?,?,?,?)');
    for (const agent of bootstrapAgents) insert.run(Number(agent.id), String(agent.name), String(agent.region), agent.active === false ? 0 : 1);
  }

  if (options.seedDemo && Number(db.prepare('SELECT COUNT(*) AS count FROM jobs').get().count) === 0) {
    const seeded = '2026-09-06T00:00:00.000Z';
    db.exec('BEGIN IMMEDIATE');
    try {
      const insertJob = db.prepare(`INSERT INTO jobs(id,customer_name,address,summary,priority,status,agent_id,start_at,end_at,version,override_reason,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      for (const job of DEMO_JOBS) insertJob.run(job.id, job.customerName, job.address, job.summary, job.priority, job.status, job.agentId, job.startAt, job.endAt, job.version, job.overrideReason, seeded, seeded);
      const insertAudit = db.prepare('INSERT INTO audits(id,job_id,actor,action,detail,job_version,created_at) VALUES(?,?,?,?,?,?,?)');
      for (const audit of DEMO_AUDITS) insertAudit.run(audit.id, audit.jobId, audit.actor, audit.action, audit.detail, audit.jobVersion, seeded);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  const getJobRow = id => db.prepare('SELECT * FROM jobs WHERE id=?').get(Number(id));
  const requireJob = id => {
    const job = rowToJob(getJobRow(id));
    if (!job) throw new DomainError(404, 'JOB_NOT_FOUND', 'job not found');
    return job;
  };
  const requireAgent = id => {
    const row = db.prepare('SELECT id,name,region,active FROM agents WHERE id=? AND active=1').get(Number(id));
    if (!row) throw new DomainError(404, 'AGENT_NOT_FOUND', 'active field agent not found');
    return { id: Number(row.id), name: row.name, region: row.region, active: Boolean(row.active) };
  };
  const audit = (job, action, actor, detail = '') => db.prepare('INSERT INTO audits(job_id,actor,action,detail,job_version,created_at) VALUES(?,?,?,?,?,?)').run(job.id, String(actor || 'ops-user').slice(0, 80), action, String(detail || '').slice(0, 300), job.version, nowIso());
  const assertVersion = (job, version) => { try { assertExpectedVersion(job, version); } catch (error) { throw mapError(error); } };
  const writeJob = (job, expectedVersion) => {
    const result = db.prepare(`UPDATE jobs SET customer_name=?,address=?,summary=?,priority=?,status=?,agent_id=?,start_at=?,end_at=?,version=?,override_reason=?,updated_at=? WHERE id=? AND version=?`).run(
      job.customerName, job.address, job.summary, job.priority, job.status, job.agentId, job.startAt, job.endAt, job.version, job.overrideReason, job.updatedAt, job.id, expectedVersion
    );
    if (Number(result.changes) !== 1) throw new DomainError(409, 'STALE_JOB', 'job changed before this action was committed');
  };
  const conflicts = (jobId, agentId, startAt, endAt) => db.prepare(`SELECT * FROM jobs WHERE id<>? AND agent_id=? AND status IN ('SCHEDULED','DISPATCHED','ON_SITE')`).all(Number(jobId), Number(agentId)).map(rowToJob).filter(job => overlaps(startAt, endAt, job.startAt, job.endAt));

  function transaction(run) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = run();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  function plan(id, input = {}, action = 'SCHEDULE') {
    return transaction(() => {
      const job = requireJob(id);
      assertVersion(job, input.expectedVersion);
      const agent = requireAgent(input.agentId);
      let next;
      try { next = scheduleJob(clone(job), input, nowIso()); } catch (error) { throw mapError(error); }
      const hit = conflicts(job.id, agent.id, next.startAt, next.endAt);
      if (hit.length) {
        const role = String(input.role || 'STAFF').toUpperCase();
        const reason = String(input.overrideReason || '').trim();
        if (job.priority !== PRIORITY.URGENT || role !== 'ADMIN' || reason.length < 5) throw new DomainError(409, 'SLOT_CONFLICT', `agent already has ${hit.length} overlapping active job(s)`);
        next.overrideReason = reason.slice(0, 200);
        audit(next, 'SCHEDULE_OVERRIDE', input.actor, `conflict with ${hit.map(item => `#${item.id}`).join(', ')} · ${next.overrideReason}`);
      }
      writeJob(next, job.version);
      audit(next, action, input.actor, `${agent.name} · ${next.startAt} → ${next.endAt}`);
      return snapshotJob(next);
    });
  }

  function mutate(id, input, action, fn) {
    return transaction(() => {
      const job = requireJob(id);
      assertVersion(job, input?.expectedVersion);
      let next;
      try { next = fn(clone(job), nowIso()); } catch (error) { throw mapError(error); }
      writeJob(next, job.version);
      audit(next, action, input?.actor);
      return snapshotJob(next);
    });
  }

  return {
    listAgents() {
      return db.prepare('SELECT id,name,region,active FROM agents WHERE active=1 ORDER BY id').all().map(row => ({ id: Number(row.id), name: row.name, region: row.region, active: Boolean(row.active) }));
    },
    listJobs(filters = {}) {
      const q = String(filters.query || '').trim().toLowerCase();
      const status = String(filters.status || '');
      const priority = String(filters.priority || '');
      const agentId = filters.agentId ? Number(filters.agentId) : null;
      return db.prepare('SELECT * FROM jobs ORDER BY id').all().map(rowToJob)
        .filter(job => !q || [job.customerName, job.address, job.summary].some(value => value.toLowerCase().includes(q)))
        .filter(job => !status || job.status === status)
        .filter(job => !priority || job.priority === priority)
        .filter(job => !agentId || job.agentId === agentId)
        .map(snapshotJob);
    },
    getJob(id) { return snapshotJob(requireJob(id)); },
    listAudits(jobId = null) {
      const rows = jobId == null ? db.prepare('SELECT * FROM audits ORDER BY id DESC').all() : db.prepare('SELECT * FROM audits WHERE job_id=? ORDER BY id DESC').all(Number(jobId));
      return rows.map(rowToAudit);
    },
    metrics() { return computeMetrics(db.prepare('SELECT * FROM jobs').all().map(rowToJob)); },
    createJob(input, actor = 'ops-user') {
      return transaction(() => {
        const createdAt = nowIso();
        let normalized;
        try { normalized = createJob(input, { id: 0, createdAt }); } catch (error) { throw new DomainError(400, 'INVALID_JOB', error instanceof Error ? error.message : 'invalid job'); }
        const result = db.prepare(`INSERT INTO jobs(customer_name,address,summary,priority,status,agent_id,start_at,end_at,version,override_reason,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(
          normalized.customerName, normalized.address, normalized.summary, normalized.priority, normalized.status, null, null, null, 1, null, createdAt, createdAt
        );
        const job = { ...normalized, id: Number(result.lastInsertRowid) };
        audit(job, 'CREATE', actor, job.summary);
        return snapshotJob(job);
      });
    },
    schedule(id, input) { return plan(id, input, 'SCHEDULE'); },
    reschedule(id, input) { return plan(id, input, 'RESCHEDULE'); },
    reassign(id, input) { return plan(id, input, 'REASSIGN'); },
    dispatch(id, input = {}) { return mutate(id, input, 'DISPATCH', dispatchJob); },
    onSite(id, input = {}) { return mutate(id, input, 'ON_SITE', arriveOnSite); },
    complete(id, input = {}) { return mutate(id, input, 'COMPLETE', completeJob); },
    cancel(id, input = {}) { return mutate(id, input, 'CANCEL', cancelJob); },
    noShow(id, input = {}) { return mutate(id, input, 'NO_SHOW', markNoShow); },
    close() { db.close(); }
  };
}
