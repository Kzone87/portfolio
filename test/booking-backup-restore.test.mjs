import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BookingStore} from '../booking-crm/server/store.mjs';
import {createBookingBackup,restoreBookingBackup,verifyBookingSqlite} from '../scripts/booking-db-ops.mjs';

const future=(hours)=>new Date(Date.now()+hours*3600_000).toISOString();

test('Booking CRM backup is a verified SQLite snapshot and restore rolls data back safely',()=>{
  const dir=mkdtempSync(join(tmpdir(),'booking-backup-')),dbPath=join(dir,'booking.sqlite'),backupDir=join(dir,'backups');
  const env={BOOKING_DB_PATH:dbPath,BOOKING_BACKUP_DIR:backupDir};
  try{
    let store=new BookingStore({dbPath,adminPassword:'Backup-Admin-123!'});
    store.createBooking({name:'백업고객',phone:'01011112222',serviceId:'consult',startAt:future(48),endAt:future(49),note:'백업 기준 예약'});
    store.close();

    const backup=createBookingBackup({env,now:new Date('2026-09-10T12:00:00.000Z')});
    assert.ok(existsSync(backup.manifestPath));assert.equal(backup.manifest.product,'BOOKING CRM');assert.equal(backup.manifest.database.sha256.length,64);
    const backupPath=join(backupDir,backup.manifest.database.file);assert.equal(verifyBookingSqlite(backupPath),true);

    store=new BookingStore({dbPath,adminPassword:'ignored-existing-123'});
    store.createBooking({name:'복원전추가',phone:'01033334444',serviceId:'consult',startAt:future(72),endAt:future(73),note:'복원 시 제거될 예약'});
    assert.equal(store.listBookings().length,2);store.close();

    assert.throws(()=>restoreBookingBackup({manifestPath:backup.manifestPath,env,confirmation:'WRONG'}),/RESTORE_BOOKING/);
    const restored=restoreBookingBackup({manifestPath:backup.manifestPath,env,confirmation:'RESTORE_BOOKING'});
    assert.ok(restored.preRestore&&existsSync(restored.preRestore));assert.equal(verifyBookingSqlite(dbPath),true);

    store=new BookingStore({dbPath,adminPassword:'ignored-existing-123'});
    assert.equal(store.listBookings().length,1);assert.equal(store.listBookings()[0].customer_name,'백업고객');store.close();
  }finally{rmSync(dir,{recursive:true,force:true})}
});
