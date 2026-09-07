import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../home-balance.css', import.meta.url), 'utf8');

test('final balance layer is loaded last', () => {
  const alignment = html.indexOf('home-alignment.css');
  const balance = html.indexOf('home-balance.css');
  assert.ok(alignment >= 0 && balance > alignment);
});

test('section headings keep supporting copy in the same reading zone', () => {
  assert.match(css, /\.editorial-heading\{[\s\S]*display:block/);
  assert.match(css, /\.editorial-heading>p\{[\s\S]*max-width:620px[\s\S]*margin:10px 0 0/);
});

test('proof reads as one coherent story rather than split extremes', () => {
  assert.match(css, /\.proof-story\{[\s\S]*display:block[\s\S]*max-width:940px/);
  assert.match(css, /\.proof-story>div:last-child\{[\s\S]*padding-top:18px/);
});

test('contact CTA stays beside its copy instead of floating at the far edge', () => {
  assert.match(css, /\.contact-rows article\{[\s\S]*grid-template-columns:88px minmax\(0,1fr\)/);
  assert.match(css, /\.contact-rows a\{[\s\S]*grid-column:2[\s\S]*justify-self:start/);
});
