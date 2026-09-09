const endpoint = String(window.KZONE_PROJECT_INQUIRY_ENDPOINT || '').trim().replace(/\/+$/, '');
const form = document.getElementById('project-inquiry-form');
const message = document.getElementById('project-inquiry-message');
const summary = document.getElementById('project-inquiry-summary');
const copyButton = document.getElementById('copy-project-inquiry');
const downloadButton = document.getElementById('download-project-inquiry');
let currentText = '';

const line = (label, value) => `${label}: ${value || '미입력'}`;
function readValues() {
  const data = new FormData(form);
  return {
    company: String(data.get('company') || '').trim(),
    name: String(data.get('name') || '').trim(),
    email: String(data.get('email') || '').trim(),
    projectType: String(data.get('projectType') || '').trim(),
    budgetRange: String(data.get('budgetRange') || '').trim(),
    desiredStart: String(data.get('desiredStart') || '').trim(),
    detail: String(data.get('detail') || '').trim(),
    consent: data.get('consent') === 'yes'
  };
}
function buildText(value) {
  return [
    '[KZONE87 프로젝트 의뢰]',
    line('회사·조직', value.company),
    line('담당자', value.name),
    line('회신 이메일', value.email),
    line('프로젝트 유형', value.projectType),
    line('예상 범위', value.budgetRange),
    line('희망 시작', value.desiredStart),
    `현재 업무/문제:\n${value.detail}`
  ].join('\n');
}
function enablePortableDraftActions() {
  if (copyButton) copyButton.disabled = false;
  if (downloadButton) downloadButton.disabled = false;
}
function showSummary(text, id = '') {
  currentText = id ? `${text}\n\n접수번호: ${id}` : text;
  summary.hidden = false;
  summary.querySelector('pre').textContent = currentText;
  enablePortableDraftActions();
  summary.scrollIntoView({ block:'nearest', behavior:'smooth' });
}

if (endpoint) {
  const submit = form?.querySelector('button[type="submit"]');
  if (submit) submit.textContent = '비공개 의뢰 보내기';
  const note = summary?.querySelector('p');
  if (note) note.textContent = '입력한 프로젝트 의뢰는 비공개 상담 API로 전송됩니다.';
  const mode = document.querySelector('.inquiry-mode');
  if (mode) mode.innerHTML = '<span>PRIVATE INTAKE</span><strong>이 운영환경은 비공개 상담 API가 연결되어 있습니다.</strong><small>정상 접수 후 접수번호가 표시되며, 동일 내용을 복사하거나 TXT로 보관할 수 있습니다.</small>';
}

form?.addEventListener('submit', async event => {
  event.preventDefault();
  message.className = 'message wide';
  const value = readValues();
  if (value.company.length < 2 || value.name.length < 2 || !/^\S+@\S+\.\S+$/.test(value.email) || !value.projectType || value.detail.length < 10 || !value.consent) {
    message.textContent = '필수 항목과 동의 여부를 확인해 주세요.';
    message.classList.add('error');
    return;
  }
  const text = buildText(value);
  if (!endpoint) {
    showSummary(text);
    message.textContent = '의뢰 내용을 정리했습니다. 공개 포트폴리오에서는 서버로 전송하지 않습니다. 아래에서 복사하거나 TXT로 저장할 수 있습니다.';
    return;
  }
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  form.setAttribute('aria-busy', 'true');
  message.textContent = '비공개 프로젝트 문의를 접수하고 있습니다.';
  try {
    const response = await fetch(`${endpoint}/api/project-inquiries`, {
      method:'POST',
      headers:{ 'content-type':'application/json' },
      body:JSON.stringify(value)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error?.message || '의뢰를 접수하지 못했습니다.');
    showSummary(text, payload.id);
    message.textContent = `비공개 프로젝트 문의가 접수되었습니다. 접수번호 ${payload.id}`;
  } catch (error) {
    showSummary(text);
    message.textContent = `${error instanceof Error ? error.message : '의뢰를 접수하지 못했습니다.'} 작성한 내용은 복사하거나 TXT로 보관할 수 있습니다.`;
    message.classList.add('error');
  } finally {
    button.disabled = false;
    form.removeAttribute('aria-busy');
  }
});

copyButton?.addEventListener('click', async () => {
  if (!currentText) return;
  try {
    await navigator.clipboard.writeText(currentText);
    message.textContent = '의뢰 내용을 복사했습니다.';
    message.classList.remove('error');
  } catch {
    message.textContent = '자동 복사를 사용할 수 없습니다. 아래 의뢰 내용을 직접 복사해 주세요.';
    message.classList.add('error');
  }
});

downloadButton?.addEventListener('click', () => {
  if (!currentText) return;
  const blob = new Blob([`${currentText}\n`], { type:'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'KZONE87-project-inquiry.txt';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  message.textContent = 'TXT 의뢰서를 저장했습니다.';
  message.classList.remove('error');
});
