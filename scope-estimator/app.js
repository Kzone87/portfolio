import { buildBrief, evaluateScope } from './engine.mjs';

const form = document.getElementById('scopeForm');
const fields = ['projectType','existing','roles','data','integrations','operation','schedule'];
const projectLabel = document.getElementById('projectLabel');
const packageBadge = document.getElementById('packageBadge');
const budget = document.getElementById('budget');
const packageNote = document.getElementById('packageNote');
const reasonList = document.getElementById('reasonList');
const firstPhase = document.getElementById('firstPhase');
const briefText = document.getElementById('briefText');
const copyButton = document.getElementById('copyButton');
const resetButton = document.getElementById('resetButton');
const copyStatus = document.getElementById('copyStatus');

function readInput() {
  return Object.fromEntries(fields.map((id) => [id, document.getElementById(id).value]));
}

function render() {
  const result = evaluateScope(readInput());
  projectLabel.textContent = result.projectLabel;
  packageBadge.textContent = result.packageName;
  budget.textContent = result.budget;
  packageNote.textContent = result.packageNote;
  firstPhase.textContent = result.firstPhase;
  briefText.value = buildBrief(result);

  const fragment = document.createDocumentFragment();
  result.reasons.forEach((reason) => {
    const item = document.createElement('li');
    item.textContent = reason;
    fragment.append(item);
  });
  reasonList.replaceChildren(fragment);
  copyStatus.textContent = '';
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  render();
});

fields.forEach((id) => document.getElementById(id).addEventListener('change', render));

resetButton.addEventListener('click', () => {
  form.reset();
  render();
});

copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(briefText.value);
    copyStatus.textContent = '상담용 Brief를 복사했습니다.';
  } catch {
    briefText.focus();
    briefText.select();
    copyStatus.textContent = '자동 복사가 제한되어 있습니다. 선택된 내용을 직접 복사해 주세요.';
  }
});

render();
