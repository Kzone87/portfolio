import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const repo=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const out=path.resolve(repo,'dist/booking-crm-delivery');
fs.rmSync(out,{recursive:true,force:true});
fs.mkdirSync(out,{recursive:true});

function copy(source,target=source.replace(/^booking-crm\//,'')){
  const from=path.join(repo,source),to=path.join(out,target);
  fs.mkdirSync(path.dirname(to),{recursive:true});
  fs.cpSync(from,to,{recursive:true});
}

for(const file of [
  'booking-crm/index.html','booking-crm/styles.css','booking-crm/app.js','booking-crm/engine.mjs',
  'booking-crm/server/app.mjs','booking-crm/server/store.mjs','booking-crm/README.md','booking-crm/DELIVERY_RUNBOOK.md'
])copy(file);
copy('booking-crm/deploy','deploy');
fs.mkdirSync(path.join(out,'scripts'),{recursive:true});
for(const file of ['scripts/booking-db-ops.mjs','scripts/booking-backup.mjs','scripts/booking-restore.mjs'])copy(file,file.replace('scripts/','scripts/'));

fs.writeFileSync(path.join(out,'package.json'),JSON.stringify({
  name:'booking-crm-commercial',private:true,version:'1.0.0',type:'module',engines:{node:'>=24'},
  scripts:{start:'node server/app.mjs',backup:'node scripts/booking-backup.mjs',restore:'node scripts/booking-restore.mjs'}
},null,2)+'\n');

function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const full=path.join(dir,entry.name);return entry.isDirectory()?files(full):[full]})}
const manifest=files(out).sort().map(file=>{const data=fs.readFileSync(file);return {path:path.relative(out,file).replaceAll('\\','/'),bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')}});
fs.writeFileSync(path.join(out,'MANIFEST.json'),JSON.stringify({schemaVersion:1,product:'BOOKING CRM',builtAt:new Date().toISOString(),node:'24+',files:manifest},null,2)+'\n');
console.log(`BOOKING CRM delivery built: ${out} (${manifest.length} files)`);
