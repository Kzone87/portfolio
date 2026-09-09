import path from 'node:path';
import { backupDatabase } from '../mono-operations/server/ops.mjs';

const dbPath=process.env.MONO_DB_PATH;
if(!dbPath)throw new Error('MONO_DB_PATH_REQUIRED');
const stamp=new Date().toISOString().replaceAll(':','-').replace(/\.\d{3}Z$/,'Z');
const destination=process.argv[2]||path.resolve('backups',`mono-${stamp}.sqlite`);
const result=backupDatabase(dbPath,destination);
console.log(JSON.stringify(result,null,2));
