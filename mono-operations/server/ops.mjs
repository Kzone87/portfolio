import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function sqlString(value){return `'${String(value).replaceAll("'","''")}'`}

export function integrityCheck(dbPath){
  if(!fs.existsSync(dbPath))throw new Error('MONO_DB_NOT_FOUND');
  const db=new DatabaseSync(dbPath);
  try{
    const rows=db.prepare('PRAGMA integrity_check').all();
    const ok=rows.length===1&&Object.values(rows[0])[0]==='ok';
    if(!ok)throw new Error(`MONO_DB_INTEGRITY_FAILED:${JSON.stringify(rows)}`);
    const version=db.prepare('SELECT version FROM schema_meta LIMIT 1').get()?.version;
    if(!Number.isInteger(Number(version)))throw new Error('MONO_SCHEMA_VERSION_MISSING');
    return {ok:true,version:Number(version)};
  }finally{db.close()}
}

export function backupDatabase(dbPath,destination){
  if(!dbPath||dbPath===':memory:')throw new Error('MONO_BACKUP_REQUIRES_FILE_DB');
  if(!fs.existsSync(dbPath))throw new Error('MONO_DB_NOT_FOUND');
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  if(fs.existsSync(destination))fs.rmSync(destination,{force:true});
  const db=new DatabaseSync(dbPath);
  try{
    db.exec('PRAGMA wal_checkpoint(FULL);');
    db.exec(`VACUUM INTO ${sqlString(path.resolve(destination))};`);
  }finally{db.close()}
  const check=integrityCheck(destination);
  const stat=fs.statSync(destination);
  return {path:path.resolve(destination),size:stat.size,...check};
}

export function restoreDatabase(backupPath,dbPath){
  if(!backupPath||!dbPath||dbPath===':memory:')throw new Error('MONO_RESTORE_PATH_REQUIRED');
  integrityCheck(backupPath);
  fs.mkdirSync(path.dirname(dbPath),{recursive:true});
  const absoluteDb=path.resolve(dbPath),temporary=`${absoluteDb}.restore-${process.pid}-${Date.now()}`;
  fs.copyFileSync(backupPath,temporary);
  integrityCheck(temporary);
  let previous=null;
  if(fs.existsSync(absoluteDb)){
    previous=`${absoluteDb}.pre-restore-${new Date().toISOString().replaceAll(':','-')}`;
    fs.copyFileSync(absoluteDb,previous);
  }
  fs.renameSync(temporary,absoluteDb);
  for(const suffix of ['-wal','-shm']){const file=`${absoluteDb}${suffix}`;if(fs.existsSync(file))fs.rmSync(file,{force:true})}
  const check=integrityCheck(absoluteDb);
  return {restored:path.resolve(absoluteDb),previous,...check};
}
