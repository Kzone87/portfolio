import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../home-domain.css', import.meta.url), 'utf8');

test('NEXA flagship keeps readable contrast on the dark portfolio card', () => {
  assert.match(css, /\.nexa-showcase h3\{color:#f7fbff\}/);
});

test('NEXA flagship stacks before tablet and mobile widths become cramped', () => {
  assert.match(css, /@media\(max-width:1020px\)\{[\s\S]*?\.nexa-showcase\{grid-template-columns:1fr\}/);
  assert.match(css, /@media\(max-width:760px\)\{[\s\S]*?\.nexa-showcase \.browser-preview\{margin:0 20px 20px;min-height:360px\}/);
  assert.match(css, /@media\(max-width:420px\)\{[\s\S]*?\.nexa-showcase \.browser-preview\{margin:0 14px 14px;min-height:330px\}/);
});

test('surface CTA labels wrap only at word boundaries', () => {
  assert.match(css, /\.nexa-surface-link b\{word-break:keep-all;overflow-wrap:normal\}/);
});
