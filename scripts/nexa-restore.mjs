import { restoreBackup } from './nexa-db-ops.mjs';

const manifestPath = String(process.argv[2] || '').trim();
if (!manifestPath) {
  console.error('Usage: NEXA_RESTORE_CONFIRM=RESTORE_NEXA node scripts/nexa-restore.mjs <manifest.json>');
  process.exitCode = 2;
} else {
  try {
    const result = restoreBackup({ manifestPath, confirmation: process.env.NEXA_RESTORE_CONFIRM || '' });
    console.log(`NEXA restore complete: ${result.restored.length} database target(s)`);
    for (const item of result.restored) console.log(`- ${item.key}: ${item.target}${item.preRestore ? ` (pre-restore copy: ${item.preRestore})` : ''}`);
  } catch (error) {
    console.error(`NEXA restore failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
