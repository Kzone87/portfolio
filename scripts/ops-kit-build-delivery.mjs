import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const repo=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const out=path.resolve(repo,'dist/ops-kit-delivery');
fs.rmSync(out,{recursive:true,force:true});
fs.mkdirSync(out,{recursive:true});

for(const name of ['index.html','styles.css','quality.css','app.js','engine.mjs','README.md','DELIVERY_RUNBOOK.md']){
  fs.copyFileSync(path.join(repo,'mini-labs',name),path.join(out,name));
}

function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const full=path.join(dir,entry.name);return entry.isDirectory()?files(full):[full]})}
const manifest=files(out).sort().map(file=>{const data=fs.readFileSync(file);return {path:path.relative(out,file).replaceAll('\\','/'),bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')}});
fs.writeFileSync(path.join(out,'MANIFEST.json'),JSON.stringify({schemaVersion:1,product:'OPS KIT',deliveryType:'static-local-first',builtAt:new Date().toISOString(),files:manifest},null,2)+'\n');
console.log(`OPS KIT delivery built: ${out} (${manifest.length} files)`);
