import {
  TASK_STATUS,
  applyHumanReview,
  nextTaskStatus,
  runGeneration,
  validateStructuredOutput,
  validateTaskInput
} from './engine.mjs';

const state = {
  taskSeq: 4,
  runSeq: 1,
  reviewSeq: 1,
  selectedId: 1,
  tasks: [
    {
      id: 1,
      title: 'Invoice correction request',
      content: 'A customer says the latest invoice contains a duplicate charge and asks for a refund review.',
      status: TASK_STATUS.PENDING,
      version: 1,
      output: null,
      evaluation: null,
      lastRun: null
    },
    {
      id: 2,
      title: 'Production access issue',
      content: 'URGENT: a staff member cannot login to the production account after a permission change.',
      status: TASK_STATUS.PENDING,
      version: 1,
      output: null,
      evaluation: null,
      lastRun: null
    },
    {
      id: 3,
      title: 'Fallback demonstration',
      content: '[FAIL_PRIMARY] Excel import fails when the vendor sends a different column mapping.',
      status: TASK_STATUS.PENDING,
      version: 1,
      output: null,
      evaluation: null,
      lastRun: null
    }
  ],
  runs: [],
  reviews: []
};

const $ = (id) => document.getElementById(id);

const elements = {
  pendingCount: $('pending-count'),
  reviewCount: $('review-count'),
  finalCount: $('final-count'),
  fallbackCount: $('fallback-count'),
  taskForm: $('task-form'),
  taskTitle: $('task-title'),
  taskContent: $('task-content'),
  taskList: $('task-list'),
  generateAll: $('generate-all'),
  promptVersion: $('prompt-version'),
  emptyReview: $('empty-review'),
  reviewContent: $('review-content'),
  selectedStatus: $('selected-status'),
  selectedTitle: $('selected-title'),
  selectedInput: $('selected-input'),
  generateSelected: $('generate-selected'),
  providerTrace: $('provider-trace'),
  outputEditor: $('output-editor'),
  providerName: $('provider-name'),
  promptName: $('prompt-name'),
  evalScore: $('eval-score'),
  evalFlags: $('eval-flags'),
  editSummary: $('edit-summary'),
  editAction: $('edit-action'),
  editCategory: $('edit-category'),
  editRisk: $('edit-risk'),
  editConfidence: $('edit-confidence'),
  approve: $('approve'),
  reject: $('reject'),
  runHistory: $('run-history'),
  reviewHistory: $('review-history')
};

function selectedTask() {
  return state.tasks.find((task) => task.id === state.selectedId) ?? null;
}

function createElement(tag, className, text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function statusBadge(status) {
  const span = createElement('span', `status ${status}`, status);
  return span;
}

function renderStats() {
  elements.pendingCount.textContent = String(state.tasks.filter((task) => task.status === TASK_STATUS.PENDING).length);
  elements.reviewCount.textContent = String(state.tasks.filter((task) => [TASK_STATUS.GENERATED, TASK_STATUS.NEEDS_REVIEW].includes(task.status)).length);
  elements.finalCount.textContent = String(state.tasks.filter((task) => [TASK_STATUS.APPROVED, TASK_STATUS.REJECTED].includes(task.status)).length);
  elements.fallbackCount.textContent = String(state.runs.filter((run) => run.attempts.length > 1 && run.status === 'SUCCESS').length);
}

function renderTaskList() {
  elements.taskList.replaceChildren();
  for (const task of state.tasks) {
    const button = createElement('button', `task-card${task.id === state.selectedId ? ' active' : ''}`);
    button.type = 'button';
    button.addEventListener('click', () => {
      state.selectedId = task.id;
      render();
    });

    const header = document.createElement('header');
    header.append(createElement('strong', '', task.title), statusBadge(task.status));
    const copy = createElement('p', '', task.content.replaceAll('[FAIL_PRIMARY]', '').replaceAll('[FAIL_ALL]', '').trim());
    const meta = createElement('small', '', `v${task.version}${task.lastRun ? ` · ${task.lastRun.providerId ?? 'provider failed'}` : ''}`);
    button.append(header, copy, meta);
    elements.taskList.append(button);
  }
}

function renderTrace(task) {
  elements.providerTrace.replaceChildren();
  if (!task?.lastRun) return;
  for (const attempt of task.lastRun.attempts) {
    const className = attempt.status === 'SUCCESS' ? 'ok' : 'fail';
    const label = attempt.status === 'SUCCESS'
      ? `${attempt.providerId} · SUCCESS`
      : `${attempt.providerId} · FAILED${attempt.error ? ` · ${attempt.error}` : ''}`;
    elements.providerTrace.append(createElement('span', className, label));
  }
}

function fillOutput(task) {
  const ready = Boolean(task?.output && [TASK_STATUS.GENERATED, TASK_STATUS.NEEDS_REVIEW].includes(task.status));
  elements.outputEditor.hidden = !ready;
  if (!ready) return;

  elements.providerName.textContent = task.lastRun?.providerId ?? '-';
  elements.promptName.textContent = task.lastRun?.promptVersion ?? '-';
  elements.evalScore.textContent = String(task.evaluation?.score ?? '-');
  elements.evalFlags.textContent = task.evaluation?.flags?.length ? task.evaluation.flags.join(', ') : 'NONE';
  elements.editSummary.value = task.output.summary;
  elements.editAction.value = task.output.nextAction;
  elements.editCategory.value = task.output.category;
  elements.editRisk.value = task.output.risk;
  elements.editConfidence.value = String(task.output.confidence);
}

function renderReviewDesk() {
  const task = selectedTask();
  elements.emptyReview.hidden = Boolean(task);
  elements.reviewContent.hidden = !task;
  if (!task) return;

  elements.selectedStatus.className = `status ${task.status}`;
  elements.selectedStatus.textContent = task.status;
  elements.selectedTitle.textContent = task.title;
  elements.selectedInput.textContent = task.content.replaceAll('[FAIL_PRIMARY]', '').replaceAll('[FAIL_ALL]', '').trim();
  const finalized = [TASK_STATUS.APPROVED, TASK_STATUS.REJECTED].includes(task.status);
  elements.generateSelected.disabled = finalized;
  elements.generateSelected.textContent = task.lastRun ? 'AI 제안 다시 생성' : 'AI 제안 생성';
  renderTrace(task);
  fillOutput(task);
}

function historyItem(title, detail) {
  const article = createElement('article', 'history-item');
  const header = document.createElement('header');
  header.append(createElement('strong', '', title));
  article.append(header, createElement('p', '', detail));
  return article;
}

function renderHistory() {
  elements.runHistory.replaceChildren();
  if (!state.runs.length) elements.runHistory.append(createElement('div', 'empty-state', '아직 실행 이력이 없습니다.'));
  for (const run of [...state.runs].reverse()) {
    const attempts = run.attempts.map((item) => `${item.providerId}:${item.status}`).join(' → ');
    elements.runHistory.append(historyItem(
      `Task #${run.taskId} · ${run.status}`,
      `${run.promptVersion} · ${attempts} · score ${run.evaluation.score}`
    ));
  }

  elements.reviewHistory.replaceChildren();
  if (!state.reviews.length) elements.reviewHistory.append(createElement('div', 'empty-state', '아직 사람의 승인/반려 기록이 없습니다.'));
  for (const review of [...state.reviews].reverse()) {
    elements.reviewHistory.append(historyItem(
      `Task #${review.taskId} · ${review.decision}`,
      `reviewer ${review.reviewer} · version ${review.version} · ${review.edited ? 'edited before decision' : 'unchanged output'}`
    ));
  }
}

function render() {
  renderStats();
  renderTaskList();
  renderReviewDesk();
  renderHistory();
  elements.generateAll.disabled = !state.tasks.some((task) => task.status === TASK_STATUS.PENDING);
}

function generateTask(task) {
  if ([TASK_STATUS.APPROVED, TASK_STATUS.REJECTED].includes(task.status)) return;
  const result = runGeneration(task, { promptVersion: elements.promptVersion.value });
  const runRecord = {
    id: state.runSeq++,
    taskId: task.id,
    ...result,
    createdAt: new Date().toISOString()
  };
  state.runs.push(runRecord);
  task.version += 1;
  task.lastRun = runRecord;
  task.evaluation = result.evaluation;
  if (result.status === 'SUCCESS') {
    task.output = result.output;
    task.status = nextTaskStatus(result);
  } else {
    task.output = null;
    task.status = TASK_STATUS.PENDING;
  }
}

function editorOutput() {
  return {
    summary: elements.editSummary.value.trim(),
    category: elements.editCategory.value,
    risk: elements.editRisk.value,
    nextAction: elements.editAction.value.trim(),
    confidence: Number(elements.editConfidence.value)
  };
}

function reviewSelected(decision) {
  const task = selectedTask();
  if (!task) return;
  const editedOutput = editorOutput();
  if (decision === 'APPROVE' && !validateStructuredOutput(editedOutput)) {
    window.alert('승인할 결과가 구조화 출력 규칙에 맞지 않습니다. 요약/Action/Confidence를 확인하세요.');
    return;
  }
  try {
    const before = JSON.stringify(task.output);
    const reviewed = applyHumanReview(task, decision, decision === 'APPROVE' ? editedOutput : null);
    Object.assign(task, reviewed);
    state.reviews.push({
      id: state.reviewSeq++,
      taskId: task.id,
      decision,
      reviewer: 'demo-reviewer',
      version: task.version,
      edited: decision === 'APPROVE' && before !== JSON.stringify(editedOutput),
      createdAt: new Date().toISOString()
    });
    render();
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'review failed');
  }
}

elements.taskForm.addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    const input = validateTaskInput({ title: elements.taskTitle.value, content: elements.taskContent.value });
    const task = {
      id: state.taskSeq++,
      ...input,
      status: TASK_STATUS.PENDING,
      version: 1,
      output: null,
      evaluation: null,
      lastRun: null
    };
    state.tasks.unshift(task);
    state.selectedId = task.id;
    elements.taskForm.reset();
    render();
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'invalid task');
  }
});

elements.generateSelected.addEventListener('click', () => {
  const task = selectedTask();
  if (!task) return;
  generateTask(task);
  render();
});

elements.generateAll.addEventListener('click', () => {
  for (const task of state.tasks) {
    if (task.status === TASK_STATUS.PENDING) generateTask(task);
  }
  render();
});

elements.approve.addEventListener('click', () => reviewSelected('APPROVE'));
elements.reject.addEventListener('click', () => reviewSelected('REJECT'));

elements.promptVersion.addEventListener('change', () => {
  const task = selectedTask();
  if (task && ![TASK_STATUS.APPROVED, TASK_STATUS.REJECTED].includes(task.status)) {
    elements.generateSelected.textContent = '선택 Prompt로 다시 생성';
  }
});

render();
