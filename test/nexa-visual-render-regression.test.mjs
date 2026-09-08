import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../home-domain.css', import.meta.url), 'utf8');

test('NEXA flagship keeps readable contrast and wraps inside its own column', () => {
  assert.match(css, /\.nexa-showcase h3\{color:#f7fbff;white-space:normal;max-width:100%;word-break:keep-all\}/);
});

test('NEXA flagship stacks before tablet widths become cramped and removes decorative duplication on mobile', () => {
  assert.match(css, /@media\(max-width:1020px\)\{[\s\S]*?\.nexa-showcase\{grid-template-columns:1fr\}/);
  assert.match(css, /@media\(max-width:760px\)\{[\s\S]*?\.nexa-showcase \.browser-preview\{display:none\}/);
});

test('surface CTA labels wrap only at word boundaries', () => {
  assert.match(css, /\.nexa-surface-link b\{word-break:keep-all;overflow-wrap:normal\}/);
});
