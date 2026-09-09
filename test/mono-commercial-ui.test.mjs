import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../mono-operations/commercial-ui/index.html',import.meta.url),'utf8');
const js=fs.readFileSync(new URL('../mono-operations/commercial-ui/app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../mono-operations/commercial-ui/styles.css',import.meta.url),'utf8');

test('commercial workspace exposes login plus four real operating modules',()=>{
  for(const value of ['업무 운영 Workspace','통합 업무함','MONO MARKET','MONO OFFICE','MONO SUPPORT','MONO DATA HUB','감사이력'])assert.match(html,new RegExp(value));
  assert.match(html,/autocomplete="username"/);
  assert.match(html,/autocomplete="current-password"/);
});

test('async form submits capture stable form references before awaiting network',()=>{
  const handlers=[...js.matchAll(/addEventListener\('submit',async e=>\{([^]*?)\}\);/g)].map(match=>match[1]);
  assert.equal(handlers.length,4);
  for(const handler of handlers){
    assert.match(handler,/const form=e\.currentTarget/);
    assert.doesNotMatch(handler,/e\.currentTarget\.reset\(\)/);
    assert.match(handler,/form\.reset\(\)/);
  }
});

test('commercial browser keeps credentials out of persistent browser storage',()=>{
  assert.doesNotMatch(js,/localStorage/);
  assert.doesNotMatch(js,/apiKey|passwords?\s*[:=]/i);
  assert.match(js,/sessionStorage\.getItem\('mono\.csrf'\)/);
});

test('commercial layout explicitly supports desktop tablet and narrow mobile without hiding overflow defects',()=>{
  assert.match(css,/@media\(max-width:1050px\)/);
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/@media\(max-width:420px\)/);
  assert.doesNotMatch(css,/overflow-x\s*:\s*hidden/);
});
