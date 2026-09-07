import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../home-alignment.css', import.meta.url), 'utf8');

test('hero and NEXA copy have explicit stable line-break rules', () => {
  assert.match(html, /반복되는 업무를<br><span>더 단순하게 만드는<\/span><br>웹 시스템을 만듭니다\./);
  assert.match(css, /\.studio-hero h1\{[\s\S]*white-space:nowrap/);
  assert.match(css, /\.nexa-showcase h3\{[\s\S]*white-space:nowrap/);
  assert.match(css, /@media\(max-width:700px\)[\s\S]*\.nexa-showcase h3\{white-space:normal\}/);
});

test('NEXA actions stay attached to the facts instead of dropping to card bottom', () => {
  assert.match(css, /\.nexa-showcase \.case-links\{[\s\S]*margin-top:22px;[\s\S]*padding-top:0/);
});

test('capability, proof and about copy positions are intentionally tightened', () => {
  assert.match(css, /\.editorial-grid h3\{margin-top:22px\}/);
  assert.match(css, /\.proof-story>div:last-child\{padding-top:34px\}/);
  assert.match(html, /코드보다 먼저,<br>업무 흐름을 봅니다\./);
  assert.match(css, /\.about-profile h2\{[\s\S]*max-width:16ch/);
});

test('contact warning no longer interrupts the primary CTA flow', () => {
  const intro = html.indexOf('같이 일하고 싶다면');
  const rows = html.indexOf('class="contact-grid contact-rows"');
  const note = html.indexOf('class="contact-note"');
  assert.ok(intro >= 0 && rows > intro && note > rows);
  assert.match(html, /채용·협업 제안과 외주·구축 상담을 아래 두 경로에서 바로 남길 수 있습니다\./);
});
