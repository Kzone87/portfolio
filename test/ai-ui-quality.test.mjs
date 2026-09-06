import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../ai-workflow-review-desk/index.html', import.meta.url), 'utf8');
const quality = await readFile(new URL('../ai-workflow-review-desk/quality.css', import.meta.url), 'utf8');

test('AI support workspace keeps human review and evidence visible', () => {
  assert.match(html, /MONO SUPPORT/);
  assert.match(html, /외부 AI 연결 없이/);
  assert.doesNotMatch(html, /가상 데이터로 실행|샘플 고객지원팀/);
  assert.match(html, /문의함/);
  assert.match(html, /상담 내용/);
  assert.match(html, /이번 문의 참고자료/);
  assert.match(html, /담당자가 검토한 뒤 최종 결정합니다/);
  assert.match(html, /id="approve"/);
  assert.match(html, /id="reject"/);
});

test('AI support readability layer protects primary working text', () => {
  assert.match(html, /styles\.css"><link rel="stylesheet" href="\.\/quality\.css"/);
  assert.match(quality, /\.task-card strong\{font-size:13px!important/);
  assert.match(quality, /\.input-copy\{font-size:13px!important/);
  assert.match(quality, /\.evidence-item p\{font-size:12px!important/);
  assert.match(quality, /\.review-actions button\{min-height:40px!important;font-size:13px!important/);
});
