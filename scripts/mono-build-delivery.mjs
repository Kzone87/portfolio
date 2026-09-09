import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const repo=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const out=path.resolve(repo,'dist/mono-operations-delivery');
fs.rmSync(out,{recursive:true,force:true});
fs.mkdirSync(out,{recursive:true});

function copy(relativeSource,relativeTarget=relativeSource){const source=path.join(repo,relativeSource),target=path.join(out,relativeTarget);fs.mkdirSync(path.dirname(target),{recursive:true});fs.cpSync(source,target,{recursive:true})}
for(const file of [
  'mono-operations/server/commercial-app.mjs',
  'mono-operations/server/commercial-store.mjs',
  'mono-operations/server/security.mjs',
  'mono-operations/server/ai-provider.mjs',
  'mono-operations/server/ops.mjs'
])copy(file,file.replace('mono-operations/',''));
copy('mono-operations/commercial-ui','commercial-ui');
copy('mono-operations/deploy','deploy');
copy('mono-operations/DELIVERY_RUNBOOK.md','DELIVERY_RUNBOOK.md');

fs.mkdirSync(path.join(out,'scripts'),{recursive:true});
fs.writeFileSync(path.join(out,'package.json'),JSON.stringify({
  name:'mono-operations-commercial',private:true,version:'1.0.0',type:'module',engines:{node:'>=24'},
  scripts:{start:'node server/commercial-app.mjs',backup:'node scripts/backup.mjs',restore:'node scripts/restore.mjs',admin:'node scripts/admin.mjs'}
},null,2)+'\n');
fs.writeFileSync(path.join(out,'scripts/backup.mjs'),`import path from 'node:path';\nimport { backupDatabase } from '../server/ops.mjs';\nconst db=process.env.MONO_DB_PATH;if(!db)throw new Error('MONO_DB_PATH_REQUIRED');const stamp=new Date().toISOString().replaceAll(':','-');const dest=process.argv[2]||path.resolve('backups',\`mono-\${stamp}.sqlite\`);console.log(JSON.stringify(backupDatabase(db,dest),null,2));\n`);
fs.writeFileSync(path.join(out,'scripts/restore.mjs'),`import { restoreDatabase } from '../server/ops.mjs';\nconst db=process.env.MONO_DB_PATH,backup=process.argv[2];if(!db||!backup)throw new Error('MONO_DB_PATH_AND_BACKUP_REQUIRED');console.log(JSON.stringify(restoreDatabase(backup,db),null,2));\n`);
fs.writeFileSync(path.join(out,'scripts/admin.mjs'),`import { createCommercialStore } from '../server/commercial-store.mjs';\nconst [cmd,...a]=process.argv.slice(2),dbPath=process.env.MONO_DB_PATH,secretKey=process.env.MONO_SECRET_KEY;if(!dbPath||!secretKey)throw new Error('MONO_DB_PATH_AND_SECRET_REQUIRED');const s=createCommercialStore({dbPath,secretKey});try{if(cmd==='bootstrap'){const[email,name,password]=a;console.log(JSON.stringify(s.ensureBootstrapAdmin({email,name,password}),null,2))}else if(cmd==='add-user'){const[adminEmail,email,name,role,password]=a;const admin=s.db.prepare(\"SELECT id FROM users WHERE email=? AND role='ADMIN' AND active=1\").get(String(adminEmail||'').toLowerCase());if(!admin)throw new Error('ACTIVE_ADMIN_NOT_FOUND');console.log(JSON.stringify(s.createUser({actorId:admin.id,email,name,role,password}),null,2))}else throw new Error('Commands: bootstrap | add-user')}finally{s.close()}\n`);

function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const full=path.join(dir,entry.name);return entry.isDirectory()?files(full):[full]})}
const manifest=files(out).sort().map(file=>{const data=fs.readFileSync(file);return {path:path.relative(out,file).replaceAll('\\','/'),bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')}});
fs.writeFileSync(path.join(out,'MANIFEST.json'),JSON.stringify({builtAt:new Date().toISOString(),node:'24+',files:manifest},null,2)+'\n');
console.log(`MONO delivery built: ${out} (${manifest.length} files)`);
