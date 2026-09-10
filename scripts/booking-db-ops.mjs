import {createHash} from 'node:crypto';
import {copyFileSync,existsSync,mkdirSync,readFileSync,renameSync,rmSync,statSync,writeFileSync} from 'node:fs';
import {dirname,isAbsolute,join,relative,resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';

const DEFAULT_DB='booking-crm/server/data/booking.sqlite';
const absolute=value=>resolve(String(value||'').trim());
const checksum=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const stamp=(value=new Date())=>value.toISOString().replace(/[-:.]/g,'');
const sqlString=value=>`'${String(value).replaceAll("'","''")}'`;

export function bookingDatabasePath(env=process.env){
  const path=absolute(env.BOOKING_DB_PATH||DEFAULT_DB);
  if(!path||path.endsWith(':memory:'))throw new Error('BOOKING_DB_PATH must use persistent storage');
  return path;
}

export function verifyBookingSqlite(path){
  if(!existsSync(path))throw new Error(`SQLite file not found: ${path}`);
  const db=new DatabaseSync(path);
  try{
    const rows=db.prepare('PRAGMA quick_check').all();
    if(!rows.length||rows.some(row=>Object.values(row)[0]!=='ok'))throw new Error(`SQLite quick_check failed: ${path}`);
    return true;
  }finally{db.close()}
}

export function createBookingBackup({env=process.env,now=new Date()}={}){
  const source=bookingDatabasePath(env);
  if(!existsSync(source))throw new Error(`database does not exist: ${source}`);
  verifyBookingSqlite(source);
  const backupDir=absolute(env.BOOKING_BACKUP_DIR||'backups/booking-crm');
  mkdirSync(backupDir,{recursive:true});
  const suffix=stamp(now),file=`booking-${suffix}.sqlite`,target=join(backupDir,file);
  if(existsSync(target))throw new Error(`backup already exists: ${target}`);
  const db=new DatabaseSync(source);
  try{db.exec('PRAGMA busy_timeout=5000');db.exec(`VACUUM INTO ${sqlString(target)}`)}finally{db.close()}
  verifyBookingSqlite(target);
  const manifest={version:1,product:'BOOKING CRM',createdAt:now.toISOString(),database:{file,bytes:statSync(target).size,sha256:checksum(target)}};
  const manifestPath=join(backupDir,`manifest-${suffix}.json`);
  writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`,{flag:'wx'});
  return {manifestPath,manifest};
}

function safeSnapshotPath(manifestDir,file){
  const candidate=resolve(manifestDir,String(file||'')),rel=relative(manifestDir,candidate);
  if(!file||rel.startsWith('..')||isAbsolute(rel))throw new Error('backup manifest contains an unsafe file path');
  return candidate;
}

export function restoreBookingBackup({manifestPath,env=process.env,confirmation=''}={}){
  if(confirmation!=='RESTORE_BOOKING')throw new Error('restore requires confirmation RESTORE_BOOKING');
  const target=bookingDatabasePath(env),absoluteManifest=absolute(manifestPath);
  if(!existsSync(absoluteManifest))throw new Error(`backup manifest not found: ${absoluteManifest}`);
  const manifest=JSON.parse(readFileSync(absoluteManifest,'utf8'));
  if(manifest?.version!==1||manifest?.product!=='BOOKING CRM'||!manifest.database)throw new Error('invalid BOOKING CRM backup manifest');
  const backup=safeSnapshotPath(dirname(absoluteManifest),manifest.database.file);
  if(!existsSync(backup))throw new Error(`backup file missing: ${manifest.database.file}`);
  if(statSync(backup).size!==Number(manifest.database.bytes))throw new Error('backup size mismatch');
  if(checksum(backup)!==manifest.database.sha256)throw new Error('backup checksum mismatch');
  verifyBookingSqlite(backup);
  mkdirSync(dirname(target),{recursive:true});
  const suffix=stamp(),preRestore=existsSync(target)?`${target}.pre-restore-${suffix}`:'',temp=`${target}.restore-${suffix}.tmp`;
  if(preRestore)copyFileSync(target,preRestore);
  copyFileSync(backup,temp);verifyBookingSqlite(temp);
  rmSync(`${target}-wal`,{force:true});rmSync(`${target}-shm`,{force:true});rmSync(target,{force:true});renameSync(temp,target);
  try{verifyBookingSqlite(target)}catch(error){
    if(preRestore&&existsSync(preRestore)){rmSync(target,{force:true});copyFileSync(preRestore,target);verifyBookingSqlite(target)}
    throw error;
  }
  return {target,preRestore:preRestore||null,manifest};
}
