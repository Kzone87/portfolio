import {DatabaseSync} from 'node:sqlite';
import {randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
import {SERVICES,normalizePhone} from '../engine.mjs';

const now=()=>new Date().toISOString();
const id=(prefix)=>`${prefix}-${randomBytes(6).toString('hex')}`;
const sha=value=>createHash('sha256').update(String(value||'')).digest('hex');
const hashPassword=(password,salt=randomBytes(16).toString('hex'))=>({salt,hash:scryptSync(password,salt,64).toString('hex')});
const verifyPassword=(password,salt,expected)=>{try{const actual=Buffer.from(scryptSync(password,salt,64).toString('hex'));const wanted=Buffer.from(String(expected));return actual.length===wanted.length&&timingSafeEqual(actual,wanted)}catch{return false}};
const cleanEmail=value=>String(value||'').trim().toLowerCase();
const cleanName=value=>String(value||'').trim().slice(0,80);
const cleanRole=value=>String(value||'').trim().toUpperCase();

export function validateEmployeePassword(value){
  const password=String(value||'');
  if(password.length<12||password.length>200||!/[A-Za-z]/.test(password)||!/\d/.test(password)) throw Object.assign(new Error('WEAK_PASSWORD'),{status:400});
  return password;
}

function validateEmployeeInput({email,name,role,password}){
  const normalizedEmail=cleanEmail(email),normalizedName=cleanName(name),normalizedRole=cleanRole(role);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw Object.assign(new Error('INVALID_EMPLOYEE_EMAIL'),{status:400});
  if(normalizedName.length<2) throw Object.assign(new Error('INVALID_EMPLOYEE_NAME'),{status:400});
  if(!['STAFF','ADMIN'].includes(normalizedRole)) throw Object.assign(new Error('INVALID_EMPLOYEE_ROLE'),{status:400});
  return {email:normalizedEmail,name:normalizedName,role:normalizedRole,password:validateEmployeePassword(password)};
}

export class BookingStore{
  constructor({dbPath=':memory:',adminPassword='booking-demo-1234'}={}){
    this.db=new DatabaseSync(dbPath);
    this.db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
    this.migrate();
    this.seed(adminPassword);
  }
  migrate(){
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS employees(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL,password_salt TEXT NOT NULL,password_hash TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,employee_id TEXT NOT NULL,csrf_hash TEXT NOT NULL,expires_at TEXT NOT NULL,created_at TEXT NOT NULL,FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE);
      CREATE TABLE IF NOT EXISTS customers(id TEXT PRIMARY KEY,name TEXT NOT NULL,phone TEXT UNIQUE NOT NULL,memo TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS bookings(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL,service_id TEXT NOT NULL,start_at TEXT NOT NULL,end_at TEXT NOT NULL,status TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',version INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,FOREIGN KEY(customer_id) REFERENCES customers(id));
      CREATE INDEX IF NOT EXISTS idx_bookings_start ON bookings(start_at);
      CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
      CREATE TABLE IF NOT EXISTS inquiries(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL,topic TEXT NOT NULL,message TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'NEW',version INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,FOREIGN KEY(customer_id) REFERENCES customers(id));
      CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
      CREATE TABLE IF NOT EXISTS audits(id TEXT PRIMARY KEY,actor_id TEXT NOT NULL,action TEXT NOT NULL,entity TEXT NOT NULL,entity_id TEXT NOT NULL,detail TEXT NOT NULL,created_at TEXT NOT NULL);
    `);
  }
  seed(adminPassword){
    const count=this.db.prepare('SELECT COUNT(*) n FROM employees').get().n;
    if(!count){const password=validateEmployeePassword(adminPassword);const p=hashPassword(password);this.db.prepare('INSERT INTO employees VALUES(?,?,?,?,?,?,?,?)').run('E-ADMIN','admin@booking.local','관리자','ADMIN',p.salt,p.hash,1,now());}
  }
  login(email,password){
    this.cleanupSessions();
    const employee=this.db.prepare('SELECT * FROM employees WHERE email=? AND active=1').get(cleanEmail(email));
    if(!employee||!verifyPassword(String(password||''),employee.password_salt,employee.password_hash)) return null;
    const session=id('S'),csrf=randomBytes(24).toString('base64url'),expires=new Date(Date.now()+8*3600_000).toISOString();
    this.db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run(sha(session),employee.id,sha(csrf),expires,now());
    return {session,csrf,employee:{id:employee.id,email:employee.email,name:employee.name,role:employee.role},expiresAt:expires};
  }
  session(sessionId){
    if(!sessionId) return null;
    const row=this.db.prepare('SELECT s.*,e.email,e.name,e.role,e.active FROM sessions s JOIN employees e ON e.id=s.employee_id WHERE s.id=? AND s.expires_at>? AND e.active=1').get(sha(sessionId),now());
    return row?{id:row.id,employee:{id:row.employee_id,email:row.email,name:row.name,role:row.role},csrfHash:row.csrf_hash}:null;
  }
  verifyCsrf(session,token){return Boolean(session&&token&&sha(token)===session.csrfHash)}
  logout(sessionId){if(sessionId)this.db.prepare('DELETE FROM sessions WHERE id=?').run(sha(sessionId))}
  cleanupSessions(){this.db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(now())}
  listEmployees(){return this.db.prepare('SELECT id,email,name,role,active,created_at FROM employees ORDER BY created_at,id').all().map(row=>({...row,active:Boolean(row.active)}))}
  employeeById(employeeId){return this.db.prepare('SELECT id,email,name,role,active,created_at FROM employees WHERE id=?').get(String(employeeId||''))}
  createEmployee(input,actorId='system'){
    const value=validateEmployeeInput(input||{}),employeeId=id('E'),p=hashPassword(value.password),createdAt=now();
    try{this.db.prepare('INSERT INTO employees VALUES(?,?,?,?,?,?,?,?)').run(employeeId,value.email,value.name,value.role,p.salt,p.hash,1,createdAt)}catch(error){if(String(error.message).includes('UNIQUE'))throw Object.assign(new Error('EMPLOYEE_EMAIL_EXISTS'),{status:409});throw error}
    this.audit(actorId,'EMPLOYEE_CREATED','employee',employeeId,`${value.email} ${value.role}`);return this.employeeById(employeeId);
  }
  setEmployeeRole(employeeId,role,actorId='system'){
    const employee=this.employeeById(employeeId);if(!employee)throw Object.assign(new Error('EMPLOYEE_NOT_FOUND'),{status:404});const next=cleanRole(role);if(!['STAFF','ADMIN'].includes(next))throw Object.assign(new Error('INVALID_EMPLOYEE_ROLE'),{status:400});
    if(employee.role==='ADMIN'&&next!=='ADMIN'&&employee.active){const count=this.db.prepare("SELECT COUNT(*) n FROM employees WHERE role='ADMIN' AND active=1").get().n;if(count<=1)throw Object.assign(new Error('LAST_ADMIN_REQUIRED'),{status:409})}
    this.db.prepare('UPDATE employees SET role=? WHERE id=?').run(next,employee.id);this.db.prepare('DELETE FROM sessions WHERE employee_id=?').run(employee.id);this.audit(actorId,'EMPLOYEE_ROLE_CHANGED','employee',employee.id,`${employee.role} → ${next}`);return this.employeeById(employee.id);
  }
  setEmployeeActive(employeeId,active,actorId='system'){
    const employee=this.employeeById(employeeId);if(!employee)throw Object.assign(new Error('EMPLOYEE_NOT_FOUND'),{status:404});const next=Boolean(active);
    if(employee.role==='ADMIN'&&employee.active&&!next){const count=this.db.prepare("SELECT COUNT(*) n FROM employees WHERE role='ADMIN' AND active=1").get().n;if(count<=1)throw Object.assign(new Error('LAST_ADMIN_REQUIRED'),{status:409})}
    this.db.prepare('UPDATE employees SET active=? WHERE id=?').run(next?1:0,employee.id);if(!next)this.db.prepare('DELETE FROM sessions WHERE employee_id=?').run(employee.id);this.audit(actorId,next?'EMPLOYEE_ACTIVATED':'EMPLOYEE_DEACTIVATED','employee',employee.id,employee.email);return this.employeeById(employee.id);
  }
  resetEmployeePassword(employeeId,password,actorId='system'){
    const employee=this.employeeById(employeeId);if(!employee)throw Object.assign(new Error('EMPLOYEE_NOT_FOUND'),{status:404});const p=hashPassword(validateEmployeePassword(password));this.db.prepare('UPDATE employees SET password_salt=?,password_hash=? WHERE id=?').run(p.salt,p.hash,employee.id);this.db.prepare('DELETE FROM sessions WHERE employee_id=?').run(employee.id);this.audit(actorId,'EMPLOYEE_PASSWORD_RESET','employee',employee.id,employee.email);return this.employeeById(employee.id);
  }
  getOrCreateCustomer({name,phone}){
    const normalized=normalizePhone(phone);let row=this.db.prepare('SELECT * FROM customers WHERE phone=?').get(normalized);
    if(row)return row;
    const customer={id:id('C'),name:String(name).trim(),phone:normalized,memo:'',created_at:now(),updated_at:now()};
    this.db.prepare('INSERT INTO customers VALUES(?,?,?,?,?,?)').run(customer.id,customer.name,customer.phone,customer.memo,customer.created_at,customer.updated_at);return customer;
  }
  slotConflict(serviceId,startAt,endAt,ignoreId=null){
    const rows=this.db.prepare(`SELECT id FROM bookings WHERE status!='CANCELLED' AND start_at < ? AND end_at > ? ${ignoreId?'AND id != ?':''}`).all(...(ignoreId?[endAt,startAt,ignoreId]:[endAt,startAt]));
    const service=SERVICES.find(s=>s.id===serviceId);return rows.length>=(service?.capacity||1);
  }
  createBooking({name,phone,serviceId,startAt,endAt,note=''}){
    if(this.slotConflict(serviceId,startAt,endAt)) throw Object.assign(new Error('SLOT_CONFLICT'),{status:409});
    const customer=this.getOrCreateCustomer({name,phone});const booking={id:id('B'),customer_id:customer.id,service_id:serviceId,start_at:startAt,end_at:endAt,status:'REQUESTED',note,version:1,created_at:now(),updated_at:now()};
    this.db.prepare('INSERT INTO bookings VALUES(?,?,?,?,?,?,?,?,?,?)').run(booking.id,booking.customer_id,booking.service_id,booking.start_at,booking.end_at,booking.status,booking.note,booking.version,booking.created_at,booking.updated_at);this.audit('PUBLIC','BOOKING_CREATED','booking',booking.id,`${serviceId} ${startAt}`);return this.bookingById(booking.id);
  }
  createInquiry({name,phone,topic,message}){const customer=this.getOrCreateCustomer({name,phone});const inquiry={id:id('I'),customer_id:customer.id,topic,message,status:'NEW',version:1,created_at:now(),updated_at:now()};this.db.prepare('INSERT INTO inquiries VALUES(?,?,?,?,?,?,?,?)').run(inquiry.id,inquiry.customer_id,inquiry.topic,inquiry.message,inquiry.status,inquiry.version,inquiry.created_at,inquiry.updated_at);this.audit('PUBLIC','INQUIRY_CREATED','inquiry',inquiry.id,topic);return this.inquiryById(inquiry.id)}
  bookingById(idv){return this.db.prepare(`SELECT b.*,c.name customer_name,c.phone customer_phone,c.memo customer_memo FROM bookings b JOIN customers c ON c.id=b.customer_id WHERE b.id=?`).get(idv)}
  inquiryById(idv){return this.db.prepare(`SELECT i.*,c.name customer_name,c.phone customer_phone FROM inquiries i JOIN customers c ON c.id=i.customer_id WHERE i.id=?`).get(idv)}
  listBookings(){return this.db.prepare(`SELECT b.*,c.name customer_name,c.phone customer_phone,c.memo customer_memo FROM bookings b JOIN customers c ON c.id=b.customer_id ORDER BY b.start_at ASC`).all()}
  listInquiries(){return this.db.prepare(`SELECT i.*,c.name customer_name,c.phone customer_phone FROM inquiries i JOIN customers c ON c.id=i.customer_id ORDER BY i.created_at DESC`).all()}
  listCustomers(){return this.db.prepare(`SELECT c.*,COUNT(b.id) booking_count FROM customers c LEFT JOIN bookings b ON b.customer_id=c.id GROUP BY c.id ORDER BY c.updated_at DESC`).all()}
  updateBooking(idv,{expectedVersion,status,startAt,endAt,actorId}){
    const item=this.bookingById(idv);if(!item) throw Object.assign(new Error('BOOKING_NOT_FOUND'),{status:404});if(Number(expectedVersion)!==item.version) throw Object.assign(new Error('STALE_BOOKING'),{status:409});
    const allowed={REQUESTED:['CONFIRMED','CANCELLED'],CONFIRMED:['COMPLETED','CANCELLED'],COMPLETED:[],CANCELLED:[]};
    const nextStatus=status||item.status;if(status&&!allowed[item.status].includes(status)) throw Object.assign(new Error('INVALID_TRANSITION'),{status:409});
    const nextStart=startAt||item.start_at,nextEnd=endAt||item.end_at;if((startAt||endAt)&&this.slotConflict(item.service_id,nextStart,nextEnd,idv)) throw Object.assign(new Error('SLOT_CONFLICT'),{status:409});
    const result=this.db.prepare('UPDATE bookings SET start_at=?,end_at=?,status=?,version=version+1,updated_at=? WHERE id=? AND version=?').run(nextStart,nextEnd,nextStatus,now(),idv,item.version);if(!result.changes) throw Object.assign(new Error('STALE_BOOKING'),{status:409});this.audit(actorId,'BOOKING_UPDATED','booking',idv,`${item.status} → ${nextStatus}; ${nextStart}`);return this.bookingById(idv);
  }
  updateCustomer(customerId,memo,actorId){const result=this.db.prepare('UPDATE customers SET memo=?,updated_at=? WHERE id=?').run(memo,now(),customerId);if(!result.changes)throw Object.assign(new Error('CUSTOMER_NOT_FOUND'),{status:404});this.audit(actorId,'CUSTOMER_MEMO_UPDATED','customer',customerId,String(memo).slice(0,80));return this.db.prepare('SELECT * FROM customers WHERE id=?').get(customerId)}
  updateInquiry(idv,{expectedVersion,status,actorId}){const item=this.inquiryById(idv);if(!item)throw Object.assign(new Error('INQUIRY_NOT_FOUND'),{status:404});if(Number(expectedVersion)!==item.version)throw Object.assign(new Error('STALE_INQUIRY'),{status:409});const allowed={NEW:['CONTACTED','CLOSED'],CONTACTED:['CLOSED'],CLOSED:[]};if(!allowed[item.status].includes(status))throw Object.assign(new Error('INVALID_TRANSITION'),{status:409});this.db.prepare('UPDATE inquiries SET status=?,version=version+1,updated_at=? WHERE id=? AND version=?').run(status,now(),idv,item.version);this.audit(actorId,'INQUIRY_UPDATED','inquiry',idv,`${item.status} → ${status}`);return this.inquiryById(idv)}
  audit(actorId,action,entity,entityId,detail){this.db.prepare('INSERT INTO audits VALUES(?,?,?,?,?,?,?)').run(id('A'),actorId,action,entity,entityId,String(detail||'').slice(0,300),now())}
  listAudit(){return this.db.prepare('SELECT * FROM audits ORDER BY created_at DESC LIMIT 100').all()}
  health(){return this.db.prepare('PRAGMA quick_check').get()}
  close(){this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');this.db.close()}
}
