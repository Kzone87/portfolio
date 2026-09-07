import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const polish = await readFile(new URL('../home-polish.css', import.meta.url), 'utf8');

test('final polish layer is statically loaded after the fresh blue system', () => {
  const fresh = html.indexOf('href="./home-fresh.css"');
  const finalPolish = html.indexOf('href="./home-polish.css"');
  assert.ok(fresh >= 0, 'fresh blue stylesheet missing');
  assert.ok(finalPolish > fresh, 'final polish must load after fresh blue stylesheet');
});

test('Korean typography uses deliberate line breaking and readable hero sizing', () => {
  assert.match(polish, /word-break:keep-all/);
  assert.match(polish, /text-wrap:balance/);
  assert.match(polish, /\.studio-hero-grid\{[\s\S]*grid-template-columns:minmax\(0,1\.24fr\) minmax\(360px,\.76fr\)/);
  assert.match(polish, /@media\(max-width:700px\)[\s\S]*\.studio-hero h1\{[\s\S]*11\.25vw/);
});

test('MONO workflow is readable instead of four cramped desktop tiles', () => {
  assert.match(polish, /\.mono-bento,[\s\S]*grid-template-columns:1fr/);
  assert.match(polish, /\.mono-bento a,[\s\S]*grid-template-columns:32px minmax\(0,1fr\) auto 18px/);
  assert.match(polish, /\.mono-bento a>small[\s\S]*white-space:nowrap/);
});

test('proof rail keeps symmetric padding inside its rounded container', () => {
  assert.match(polish, /\.proof-rail>div:first-child\{padding-left:28px\}/);
  assert.match(polish, /\.proof-rail>div:last-child\{padding-right:28px\}/);
});

test('contact rows explicitly place label copy and action instead of relying on auto placement', () => {
  assert.match(polish, /\.contact-rows article\{[\s\S]*grid-template-columns:92px minmax\(0,1fr\) 166px/);
  assert.match(polish, /\.contact-rows article>span\{[\s\S]*grid-column:1;[\s\S]*grid-row:1 \/ span 2/);
  assert.match(polish, /\.contact-rows h3\{grid-column:2;grid-row:1/);
  assert.match(polish, /\.contact-rows p\{grid-column:2;grid-row:2/);
  assert.match(polish, /\.contact-rows a\{[\s\S]*grid-column:3;[\s\S]*grid-row:1 \/ span 2/);
});

test('mobile keeps three useful navigation items and resets contact grid cleanly', () => {
  assert.match(polish, /@media\(max-width:700px\)[\s\S]*\.studio-header nav a:nth-child\(2\)\{display:block\}/);
  assert.match(polish, /@media\(max-width:700px\)[\s\S]*\.studio-header nav a:nth-child\(3\)\{display:none\}/);
  assert.match(polish, /@media\(max-width:700px\)[\s\S]*\.contact-rows article\{grid-template-columns:1fr/);
});
