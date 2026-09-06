const source = document.getElementById('jobSource');
const target = document.getElementById('jobTarget');

function ensureFailedConnectionOption(select) {
  if (!select || select.querySelector('option[value="warehouse-demo"]')) return;
  const option = document.createElement('option');
  option.value = 'warehouse-demo';
  option.textContent = '재고관리 프로그램 · 점검 필요';
  option.disabled = true;
  option.dataset.failedConnection = 'true';
  select.append(option);
}

function ensureFailedConnectionsRemainPreviewable() {
  ensureFailedConnectionOption(source);
  ensureFailedConnectionOption(target);
}

const observer = new MutationObserver(ensureFailedConnectionsRemainPreviewable);
if (source) observer.observe(source, { childList: true });
if (target) observer.observe(target, { childList: true });
ensureFailedConnectionsRemainPreviewable();

const destructiveConfirmations = {
  resetDemo: '저장된 전달 작업과 실행 이력을 초기 구성으로 되돌릴까요?',
  clearHistory: '현재 실행 이력을 모두 비울까요?'
};

document.addEventListener('click', event => {
  const button = event.target.closest?.('button');
  const message = button ? destructiveConfirmations[button.id] : null;
  if (!message || window.confirm(message)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}, { capture: true });
