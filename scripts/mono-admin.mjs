import { createCommercialStore } from '../mono-operations/server/commercial-store.mjs';

const [command,...args]=process.argv.slice(2);
const dbPath=process.env.MONO_DB_PATH;
const secretKey=process.env.MONO_SECRET_KEY;
if(!dbPath)throw new Error('MONO_DB_PATH_REQUIRED');
if(!secretKey)throw new Error('MONO_SECRET_KEY_REQUIRED');
const store=createCommercialStore({dbPath,secretKey});
try{
  if(command==='bootstrap'){
    const [email,name,password]=args;
    if(!email||!password)throw new Error('Usage: mono-admin bootstrap <email> <name> <password>');
    console.log(JSON.stringify(store.ensureBootstrapAdmin({email,name:name||'MONO Administrator',password}),null,2));
  }else if(command==='add-user'){
    const [adminEmail,email,name,role,password]=args;
    if(!adminEmail||!email||!name||!role||!password)throw new Error('Usage: mono-admin add-user <adminEmail> <email> <name> <role> <password>');
    const admin=store.db.prepare("SELECT id FROM users WHERE email=? AND role='ADMIN' AND active=1").get(adminEmail.toLowerCase());
    if(!admin)throw new Error('ACTIVE_ADMIN_NOT_FOUND');
    console.log(JSON.stringify(store.createUser({actorId:admin.id,email,name,role,password}),null,2));
  }else if(command==='list-users'){
    const [adminEmail]=args;
    const admin=store.db.prepare("SELECT id FROM users WHERE email=? AND role='ADMIN' AND active=1").get(String(adminEmail||'').toLowerCase());
    if(!admin)throw new Error('ACTIVE_ADMIN_NOT_FOUND');
    console.table(store.listUsers(admin.id));
  }else{
    throw new Error('Commands: bootstrap | add-user | list-users');
  }
}finally{store.close()}
