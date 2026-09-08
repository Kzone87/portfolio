import test from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { createBackup, restoreBackup, verifySqlite } from '../scripts/nexa-db-ops.mjs';

function writeMarker(path, value) {
  const db = new DatabaseSync(path);
  try {
    db.exec('CREATE TABLE IF NOT EXISTS marker(value TEXT NOT NULL)');
    db.exec('DELETE FROM marker');
    db.prepare('INSERT INTO marker(value) VALUES(?)').run(value);
  } finally { db.close(); }
}

function readMarker(path) {
  const db = new DatabaseSync(path);
  try { return db.prepare('SELECT value FROM marker LIMIT 1').get().value; }
  finally { db.close(); }
}

test('NEXA backup and guarded restore recover consistent SQLite snapshots', () => {
  const root = mkdtempSync(join(tmpdir(), 'nexa-backup-'));
  const ops = join(root, 'ops.sqlite');
  const inquiry = join(root, 'inquiries.sqlite');
  const backupDir = join(root, 'backups');
  const env = {
    NEXA_OPS_DB_PATH: ops,
    NEXA_OPS_AUTH_DB_PATH: ops,
    NEXA_INQUIRY_DB_PATH: inquiry,
    NEXA_BACKUP_DIR: backupDir
  };
  try {
    writeMarker(ops, 'before-ops');
    writeMarker(inquiry, 'before-inquiry');
    const backup = createBackup({ env, now: new Date('2026-09-08T12:00:00.000Z') });
    assert.equal(backup.manifest.databases.length, 2, 'shared ops/auth database should be backed up once');
    assert.ok(backup.manifest.databases.some(item => item.keys.includes('ops') && item.keys.includes('auth')));
    assert.ok(backup.manifest.databases.every(item => /^[a-f0-9]{64}$/.test(item.sha256)));

    writeMarker(ops, 'after-ops');
    writeMarker(inquiry, 'after-inquiry');
    assert.throws(() => restoreBackup({ manifestPath: backup.manifestPath, env, confirmation: '' }), /RESTORE_NEXA/);

    const restored = restoreBackup({ manifestPath: backup.manifestPath, env, confirmation: 'RESTORE_NEXA' });
    assert.equal(restored.restored.length, 2);
    assert.equal(readMarker(ops), 'before-ops');
    assert.equal(readMarker(inquiry), 'before-inquiry');
    assert.equal(verifySqlite(ops), true);
    assert.equal(verifySqlite(inquiry), true);
    assert.ok(restored.restored.every(item => item.preRestore && readMarker(item.preRestore).startsWith('after-')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('restore refuses a backup whose checksum no longer matches its manifest', () => {
  const root = mkdtempSync(join(tmpdir(), 'nexa-backup-checksum-'));
  const ops = join(root, 'ops.sqlite');
  const inquiry = join(root, 'inquiries.sqlite');
  const backupDir = join(root, 'backups');
  const env = { NEXA_OPS_DB_PATH: ops, NEXA_OPS_AUTH_DB_PATH: ops, NEXA_INQUIRY_DB_PATH: inquiry, NEXA_BACKUP_DIR: backupDir };
  try {
    writeMarker(ops, 'ops');
    writeMarker(inquiry, 'inquiry');
    const backup = createBackup({ env, now: new Date('2026-09-08T12:01:00.000Z') });
    const manifest = JSON.parse(readFileSync(backup.manifestPath, 'utf8'));
    const damaged = join(backupDir, manifest.databases[0].file);
    appendFileSync(damaged, 'damaged');
    assert.throws(() => restoreBackup({ manifestPath: backup.manifestPath, env, confirmation: 'RESTORE_NEXA' }), /checksum mismatch/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
