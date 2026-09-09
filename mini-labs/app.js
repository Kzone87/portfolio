import {
  validateContent,
  extractionSummary,
  validateAutomationPlan,
  simulateAutomation,
  auditSecurityInputs,
  deploymentDecision,
  createEvidence,
  evidenceToJson
} from './engine.mjs';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const make = (tag, className = '', text = '') => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};

const toolCopy = {
  content: { name: 'Content Preflight', copy: '게시 전에 길이, slug, placeholder와 과도한 링크를 검사합니다.' },
  extract: { name: '문서 값 추출', copy: 'key:value 문서와 quoted CSV를 구조화하고 행·열 오류를 차단합니다.' },
  workflow: { name: 'Workflow Dry-Run', copy: '실제 사이트에 접속하지 않고 자동화 계획의 단계와 실패 지점을 검증합니다.' },
  security: { name: 'Security Check', copy: 'Origin, redirect, spreadsheet cell, secret 취급과 기본 보안 헤더를 점검합니다.' },
  release: { name: 'Release Gate', copy: '필수 배포 조건이 모두 통과했는지 GO / NO-GO로 판정합니다.' }
};

const errorCopy = {
  BODY_TOO_LARGE: '본문 입력 크기가 허용 범위를 넘었습니다.',
  INPUT_TOO_LARGE: '입력 데이터가 100KB 제한을 넘었습니다.',
  TOO_MANY_LINES: 'key:value 입력 줄 수가 너무 많습니다.',
  TOO_MANY_ROWS: 'CSV 데이터가 5,000행 제한을 넘었습니다.',
  TOO_MANY_COLUMNS: 'CSV 열 수가 100열 제한을 넘었습니다.',
  INVALID_HEADERS: 'CSV 헤더는 비어 있거나 중복될 수 없습니다.',
  UNCLOSED_QUOTE: 'CSV 따옴표가 닫히지 않았습니다.',
  INVALID_WORKFLOW_JSON: 'Workflow JSON 문법을 확인해 주세요.',
  PLAN_LENGTH: '워크플로 단계는 1~30개여야 합니다.',
  DUPLICATE_STEP_ID: '워크플로 step id가 중복되었습니다.',
  UNSUPPORTED_STEP: '지원하지 않는 workflow step type입니다.',
  TARGET_REQUIRED: '각 단계에는 target이 필요합니다.',
  NAVIGATION_NOT_SAFE: 'NAVIGATE는 public HTTPS URL만 허용합니다.',
  INVALID_URL: 'NAVIGATE URL 형식을 확인해 주세요.'
};

const canonicalTool = (id) => id === 'automation' ? 'workflow' : id;
const tabIdForTool = (id) => id === 'workflow' ? 'automation' : id;

function readableError(error) {
  const code = String(error?.message || error || 'UNKNOWN_ERROR').split(':')[0];
  return errorCopy[code] || `입력 형식을 확인해 주세요. (${code})`;
}

function selectTool(id) {
  const canonical = canonicalTool(id);
  const tabId = tabIdForTool(canonical);
  $$('[data-tab]').forEach((button) => {
    const active = button.dataset.tab === tabId;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
    button.tabIndex = active ? 0 : -1;
  });
  $$('.lab').forEach((panel) => panel.classList.toggle('active', panel.id === canonical));
  $('#current-tool-name').textContent = toolCopy[canonical].name;
  $('#current-tool-copy').textContent = toolCopy[canonical].copy;
}

$$('[data-tab]').forEach((button) => button.addEventListener('click', () => selectTool(button.dataset.tab)));

function copyText(value) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
  const area = document.createElement('textarea');
  area.value = value;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.append(area);
  area.select();
  document.execCommand('copy');
  area.remove();
  return Promise.resolve();
}

function downloadText(filename, value, type = 'application/json') {
  const blob = new Blob([value], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function renderResult(target, { ok, title, copy, rows = [], evidence, dataDownload = null }) {
  target.replaceChildren();
  const head = make('div', 'result-head');
  head.append(make('span', ok ? 'result-ok' : 'result-fail', ok ? 'PASS' : 'CHECK'), make('strong', '', title));
  target.append(head, make('p', 'muted', copy));

  if (rows.length) {
    const list = make('div', 'result-list');
    for (const item of rows) {
      const row = make('div', 'result-row');
      row.append(make('span', '', item.label), make('strong', item.ok === false ? 'fail-text' : item.ok === true ? 'ok-text' : '', item.value));
      list.append(row);
    }
    target.append(list);
  }

  if (evidence) {
    const meta = make('div', 'evidence-meta');
    meta.append(make('span', '', `증빙 ID ${evidence.fingerprint}`), make('span', '', new Date(evidence.generatedAt).toLocaleString('ko-KR')));
    const actions = make('div', 'result-actions');
    const copyButton = make('button', 'secondary-action', '요약 복사');
    copyButton.type = 'button';
    copyButton.addEventListener('click', async () => {
      await copyText(`${evidence.product} · ${evidence.tool} · ${evidence.status}\n${evidence.summary}\n증빙 ID ${evidence.fingerprint}`);
      copyButton.textContent = '복사 완료';
      setTimeout(() => { copyButton.textContent = '요약 복사'; }, 1200);
    });
    const evidenceButton = make('button', 'secondary-action', '증빙 JSON');
    evidenceButton.type = 'button';
    evidenceButton.addEventListener('click', () => downloadText(`ops-kit-${evidence.tool.toLowerCase().replaceAll(' ', '-')}-${evidence.fingerprint}.json`, evidenceToJson(evidence)));
    actions.append(copyButton, evidenceButton);
    if (dataDownload) {
      const dataButton = make('button', 'secondary-action', dataDownload.label);
      dataButton.type = 'button';
      dataButton.addEventListener('click', dataDownload.onClick);
      actions.append(dataButton);
    }
    target.append(meta, actions);
  }
}

function renderError(target, tool, error) {
  const message = readableError(error);
  const evidence = createEvidence({ tool, status: 'CHECK', summary: message, details: { error: String(error?.message || error) } });
  renderResult(target, { ok: false, title: '입력을 확인해 주세요.', copy: message, evidence });
}

function runContent() {
  const out = $('#content-output');
  try {
    const result = validateContent({ title: $('#content-title').value, body: $('#content-body').value, slug: $('#content-slug').value });
    const rows = [
      { label: '제목 길이', value: result.errors.includes('TITLE_LENGTH') ? '확인 필요' : '통과', ok: !result.errors.includes('TITLE_LENGTH') },
      { label: '본문 길이', value: result.errors.includes('BODY_LENGTH') ? '확인 필요' : '통과', ok: !result.errors.includes('BODY_LENGTH') },
      { label: 'Slug', value: result.content.slug || '생성 불가', ok: Boolean(result.content.slug) },
      { label: 'Placeholder', value: result.warnings.includes('PLACEHOLDER_FOUND') ? '발견됨' : '없음', ok: !result.warnings.includes('PLACEHOLDER_FOUND') },
      { label: '링크 밀도', value: result.warnings.includes('LINK_DENSITY_HIGH') ? '높음' : '정상', ok: !result.warnings.includes('LINK_DENSITY_HIGH') }
    ];
    const ok = result.valid && result.warnings.length === 0;
    const evidence = createEvidence({
      tool: 'Content Preflight', status: ok ? 'PASS' : 'CHECK',
      summary: ok ? '필수 게시 전 검사를 통과했습니다.' : `${result.errors.length}개 오류, ${result.warnings.length}개 경고가 있습니다.`,
      details: { errors: result.errors, warnings: result.warnings, slug: result.content.slug, titleLength: result.content.title.length, bodyLength: result.content.body.length }
    });
    renderResult(out, { ok, title: ok ? '게시 전 검사를 통과했습니다.' : '게시 전에 확인이 필요합니다.', copy: evidence.summary, rows, evidence });
  } catch (error) { renderError(out, 'Content Preflight', error); }
}

function runExtract() {
  const out = $('#extract-output');
  try {
    const result = extractionSummary($('#kv-source').value, $('#csv-source').value);
    const rows = [
      { label: '문서 필드', value: `${result.counts.fields}개`, ok: true },
      { label: 'CSV 데이터', value: `${result.counts.rows}행`, ok: true },
      { label: 'CSV 열', value: `${result.counts.columns}열`, ok: true }
    ];
    for (const [key, value] of Object.entries(result.values).slice(0, 4)) rows.push({ label: key.replaceAll('_', ' '), value });
    const evidence = createEvidence({ tool: 'Data Extractor', status: 'PASS', summary: `값을 정리했습니다. 문서 ${result.counts.fields}개 필드와 CSV ${result.counts.rows}행을 구조화했습니다.`, details: { counts: result.counts } });
    renderResult(out, {
      ok: true, title: '구조화가 완료되었습니다.', copy: evidence.summary, rows, evidence,
      dataDownload: { label: '추출 결과 JSON', onClick: () => downloadText('ops-kit-extracted-data.json', `${JSON.stringify({ values: result.values, rows: result.rows }, null, 2)}\n`) }
    });
  } catch (error) { renderError(out, 'Data Extractor', error); }
}

function parseWorkflowInput() {
  let plan;
  try { plan = JSON.parse($('#workflow-source').value); } catch { throw new Error('INVALID_WORKFLOW_JSON'); }
  return validateAutomationPlan(plan);
}

function syncFailStepOptions() {
  const select = $('#fail-step');
  const previous = select.value;
  let plan;
  try { plan = parseWorkflowInput(); } catch { return; }
  const ids = plan.map((step) => step.id);
  select.replaceChildren();
  const normal = document.createElement('option');
  normal.value = '';
  normal.textContent = '정상 처리';
  select.append(normal);
  for (const id of ids) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = id;
    select.append(option);
  }
  select.value = ids.includes(previous) ? previous : '';
}

function runWorkflow() {
  const out = $('#automation-output');
  try {
    const plan = parseWorkflowInput();
    const result = simulateAutomation(plan, { failAt: $('#fail-step').value });
    const rows = result.events.map((event) => ({ label: `${event.stepId} · ${event.type}`, value: event.status === 'SUCCESS' ? '완료' : '실패', ok: event.status === 'SUCCESS' }));
    const ok = result.status === 'SUCCESS';
    const evidence = createEvidence({ tool: 'Workflow Dry-Run', status: ok ? 'PASS' : 'CHECK', summary: ok ? `${result.total}단계 dry-run을 완료했습니다.` : `${result.completed}/${result.total}단계 후 시뮬레이션 실패가 발생했습니다.`, details: { completed: result.completed, total: result.total, events: result.events } });
    const boundaryCopy = ok
      ? `${evidence.summary} Dry-run에서 반복작업을 끝까지 완료했습니다. 실제 웹사이트에는 접속하지 않았습니다.`
      : `${evidence.summary} Dry-run이 중간 단계에서 멈췄습니다. 실제 웹사이트에는 접속하지 않았습니다.`;
    renderResult(out, { ok, title: ok ? 'Dry-run을 끝까지 통과했습니다.' : '실패 지점을 확인했습니다.', copy: boundaryCopy, rows, evidence });
  } catch (error) { renderError(out, 'Workflow Dry-Run', error); }
}

function runSecurity() {
  const out = $('#security-output');
  try {
    const result = auditSecurityInputs({
      origin: $('#security-origin').value,
      allowedOrigin: $('#security-allowed-origin').value,
      redirect: $('#security-redirect').value,
      base: $('#security-base').value,
      spreadsheetCell: $('#security-cell').value,
      secret: $('#security-secret').value
    });
    const rows = result.findings.map((finding) => ({ label: finding.label, value: finding.ok ? '통과' : '차단/보완', ok: finding.ok }));
    rows.push({ label: '정규화 redirect', value: result.normalizedRedirect }, { label: 'Spreadsheet safe value', value: result.safeCell }, { label: 'Secret 표시', value: result.maskedSecret });
    const evidence = createEvidence({ tool: 'Security Check', status: result.pass ? 'PASS' : 'CHECK', summary: result.pass ? '입력한 보안 점검 항목을 모두 통과했습니다.' : `${result.findings.filter((item) => !item.ok).length}개 항목에 보완이 필요합니다.`, details: { findings: result.findings, normalizedRedirect: result.normalizedRedirect, safeCell: result.safeCell, headers: result.headers } });
    renderResult(out, { ok: result.pass, title: result.pass ? '보안 점검을 통과했습니다.' : '보완할 항목이 있습니다.', copy: evidence.summary, rows, evidence });
  } catch (error) { renderError(out, 'Security Check', error); }
}

function releaseInput() {
  return Object.fromEntries($$('#release-form input[type="checkbox"]').map((input) => [input.name, input.checked]));
}

function runRelease() {
  const out = $('#release-output');
  const result = deploymentDecision(releaseInput());
  const labels = { tests: '자동 테스트', build: 'Production build', secretScan: 'Secret scan', healthCheck: 'Health check', rollbackPlan: 'Rollback plan', OBSERVABILITY_MISSING: 'Observability', BACKUP_NOT_VERIFIED: 'Backup verification' };
  const rows = ['tests', 'build', 'secretScan', 'healthCheck', 'rollbackPlan'].map((key) => ({ label: labels[key], value: result.failed.includes(key) ? '실패' : '통과', ok: !result.failed.includes(key) }));
  for (const warning of result.warnings) rows.push({ label: labels[warning] || warning, value: '권장 보완', ok: false });
  const evidence = createEvidence({ tool: 'Release Gate', status: result.decision, summary: `${result.decision} · 필수 gate 점수 ${result.score}/100`, details: result });
  renderResult(out, { ok: result.ready, title: result.ready ? 'GO · 배포 필수 조건 통과' : 'NO-GO · 배포를 중단합니다.', copy: result.ready ? '필수 release gate가 모두 통과했습니다.' : `차단 항목: ${result.failed.join(', ')}`, rows, evidence });
}

$('#content-run').addEventListener('click', runContent);
$('#extract-run').addEventListener('click', runExtract);
$('#automation-run').addEventListener('click', runWorkflow);
$('#security-run').addEventListener('click', runSecurity);
$('#release-run').addEventListener('click', runRelease);
$('#workflow-source').addEventListener('input', syncFailStepOptions);

$$('[data-clear-output]').forEach((button) => button.addEventListener('click', () => {
  const target = document.querySelector(button.dataset.clearOutput);
  target?.replaceChildren(make('div', 'empty-result', '실행하면 여기에 결과와 증빙이 표시됩니다.'));
}));

syncFailStepOptions();
runContent();
runExtract();
runWorkflow();
runSecurity();
runRelease();
selectTool('content');
