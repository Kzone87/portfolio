import {restoreBookingBackup} from './booking-db-ops.mjs';
const manifestPath=process.argv[2];
if(!manifestPath)throw new Error('Usage: npm run restore:booking -- <manifest.json>');
const result=restoreBookingBackup({manifestPath,confirmation:process.env.BOOKING_RESTORE_CONFIRM||''});
console.log(JSON.stringify(result,null,2));
