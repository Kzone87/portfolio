import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, copyFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DEFAULT_OPS_DB = 'field-service-ops/server/data/nexa-ops.sqlite';
const DEFAULT_INQUIRY_DB = 'nexa-tech-service/server/data/inquiries.sqlite';

function absolute(value) {
  return resolve(String(value || '').trim());
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function checksum(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function stamp(value = new Date()) {
  return value.toISOString().replace(/[-:.]/g, '').replace('Z', 'Z');
}

export function databaseTargets(env = process.env) {
  const ops = absolute(env.NEXA_OPS_DB_PATH || DEFAULT_OPS_DB);
  const auth = absolute(env.NEXA_OPS_AUTH_DB_PATH || env.NEXA_OPS_DB_PATH || DEFAULT_OPS_DB);
  const inquiry = absolute(env.NEXA_INQUIRY_DB_PATH || DEFAULT_INQUIRY_DB);
  for (const [key, path] of Object.entries({ ops, auth, inquiry })) {
    if (!path || path.endsWith(':memory:')) throw new Error(`${key} database must use persistent storage`);
  }
  return { ops, auth, inquiry };
}

export function groupedTargets(env = process.env) {
  const targets = databaseTargets(env);
  const groups = new Map();
  for (const [key, path] of Object.entries(targets)) {
    const item = groups.get(path) || { source: path, keys: [] };
    item.keys.push(key);
    groups.set(path, item);
  }
  return [...groups.values()];
}

export function verifySqlite(path) {
  if (!existsSync(path)) throw new Error(`SQLite file not found: ${path}`);
  const db = new DatabaseSync(path);
  try {
    const rows = db.prepare('PRAGMA quick_check').all();
    if (!rows.length || rows.some(row => Object.values(row)[0] !== 'ok')) throw new Error(`SQLite quick_check failed: ${path}`);
    return true;
  } finally {
    db.close();
  }
}

export function createBackup({ env = process.env, now = new Date() } = {}) {
  const backupDir = absolute(env.NEXA_BACKUP_DIR || 'backups/nexa');
  mkdirSync(backupDir, { recursive: true });
  const createdAt = now.toISOString();
  const suffix = stamp(now);
  const databases = [];

  for (const group of groupedTargets(env)) {
    if (!existsSync(group.source)) throw new Error(`database does not exist: ${group.source}`);
    verifySqlite(group.source);
    const fileName = `${group.keys.join('-')}-${suffix}.sqlite`;
    const target = join(backupDir, fileName);
    if (existsSync(target)) throw new Error(`backup already exists: ${target}`);
    const db = new DatabaseSync(group.source);
    try {
      db.exec('PRAGMA busy_timeout=5000');
      db.exec(`VACUUM INTO ${sqlString(target)}`);
    } finally {
      db.close();
    }
    verifySqlite(target);
    databases.push({
      keys: group.keys,
      file: fileName,
      bytes: statSync(target).size,
      sha256: checksum(target)
    });
  }

  const manifest = {
    version: 1,
    createdAt,
    databases
  };
  const manifestPath = join(backupDir, `manifest-${suffix}.json`);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  return { manifestPath, manifest };
}

function safeBackupPath(manifestDir, file) {
  const candidate = resolve(manifestDir, String(file || ''));
  const rel = relative(manifestDir, candidate);
  if (!file || rel.startsWith('..') || isAbsolute(rel)) throw new Error('backup manifest contains an unsafe file path');
  return candidate;
}

function restoreOne(backup, target, restoreStamp) {
  verifySqlite(backup);
  mkdirSync(dirname(target), { recursive: true });
  const preRestore = existsSync(target) ? `${target}.pre-restore-${restoreStamp}` : '';
  const temp = `${target}.restore-${restoreStamp}.tmp`;
  if (preRestore) copyFileSync(target, preRestore);
  copyFileSync(backup, temp);
  verifySqlite(temp);
  rmSync(`${target}-wal`, { force: true });
  rmSync(`${target}-shm`, { force: true });
  rmSync(target, { force: true });
  renameSync(temp, target);
  try {
    verifySqlite(target);
  } catch (error) {
    if (preRestore && existsSync(preRestore)) {
      rmSync(target, { force: true });
      copyFileSync(preRestore, target);
    }
    throw error;
  }
  return preRestore || null;
}

export function restoreBackup({ manifestPath, env = process.env, confirmation = '' } = {}) {
  if (confirmation !== 'RESTORE_NEXA') throw new Error('restore requires confirmation RESTORE_NEXA');
  const absoluteManifest = absolute(manifestPath);
  if (!existsSync(absoluteManifest)) throw new Error(`backup manifest not found: ${absoluteManifest}`);
  const manifest = JSON.parse(readFileSync(absoluteManifest, 'utf8'));
  if (manifest?.version !== 1 || !Array.isArray(manifest.databases) || !manifest.databases.length) throw new Error('invalid NEXA backup manifest');
  const targets = databaseTargets(env);
  const manifestDir = dirname(absoluteManifest);
  const restoreStamp = stamp(new Date());
  const restoredTargets = new Set();
  const restored = [];

  for (const entry of manifest.databases) {
    const backup = safeBackupPath(manifestDir, entry.file);
    if (!existsSync(backup)) throw new Error(`backup file missing: ${entry.file}`);
    if (checksum(backup) !== entry.sha256) throw new Error(`backup checksum mismatch: ${entry.file}`);
    if (!Array.isArray(entry.keys) || !entry.keys.length) throw new Error('backup entry has no database keys');
    for (const key of entry.keys) {
      const target = targets[key];
      if (!target || restoredTargets.has(target)) continue;
      const preRestore = restoreOne(backup, target, restoreStamp);
      restoredTargets.add(target);
      restored.push({ key, target, preRestore });
    }
  }
  return { restored, manifest };
}
