import { restoreDatabase } from '../mono-operations/server/ops.mjs';

const dbPath=process.env.MONO_DB_PATH;
const backupPath=process.argv[2];
if(!dbPath)throw new Error('MONO_DB_PATH_REQUIRED');
if(!backupPath)throw new Error('Usage: node scripts/mono-restore.mjs <backup.sqlite>');
console.log('IMPORTANT: stop the MONO server before restore.');
const result=restoreDatabase(backupPath,dbPath);
console.log(JSON.stringify(result,null,2));
