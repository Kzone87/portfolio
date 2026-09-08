import { createBackup } from './nexa-db-ops.mjs';

try {
  const result = createBackup();
  console.log(`NEXA backup complete: ${result.manifestPath}`);
  for (const item of result.manifest.databases) console.log(`- ${item.keys.join('+')}: ${item.file} (${item.bytes} bytes)`);
} catch (error) {
  console.error(`NEXA backup failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
