import {createBookingBackup} from './booking-db-ops.mjs';
const result=createBookingBackup();
console.log(JSON.stringify(result,null,2));
