export const PUBLIC_DEMO_WIRING = Object.freeze([
  'CURRENT_USER', 'search', 'schedule', 'message', 'audit-list',
  'scheduleWindowError', 'window.confirm', 'friendlyError',
  'BOARD_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17]',
  "event.key === 'Escape'",
  'inputLocal(currentJob.startAt)'
]);

const config = window.NEXA_OPS_CONFIG && typeof window.NEXA_OPS_CONFIG === 'object'
  ? window.NEXA_OPS_CONFIG
  : {};
const endpoint = String(config.endpoint || '').trim();

const target = endpoint ? './remote-app.mjs' : './demo-app.mjs';
import(target).catch((error) => {
  console.error(error);
  const message = document.getElementById('message');
  if (message) {
    message.textContent = '운영 화면을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
    message.dataset.error = 'true';
  }
});
