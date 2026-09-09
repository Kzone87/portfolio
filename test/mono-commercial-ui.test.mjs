import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../mono-operations/commercial-ui/index.html',import.meta.url),'utf8');
const js=fs.readFileSync(new URL('../mono-operations/commercial-ui/app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../mono-operations/commercial-ui/styles.css',import.meta.url),'utf8');

function count(pattern,text){return [...text.matchAll(pattern)].length}

test('commercial workspace exposes login plus four real operating modules',()=>{
  for(const value of ['업무 운영 Workspace','통합 업무함','MONO MARKET','MONO OFFICE','MONO SUPPORT','MONO DATA HUB','감사이력'])assert.match(html,new RegExp(value));
  assert.match(html,/autocomplete="username"/);
  assert.match(html,/autocomplete="current-password"/);
});

test('async form submits capture stable form references before awaiting network',()=>{
  assert.equal(count(/addEventListener\('submit',async e=>\{/g,js),4);
  assert.equal(count(/const form=e\.currentTarget/g,js),4);
  assert.equal(count(/form\.reset\(\)/g,js),4);
  assert.doesNotMatch(js,/e\.currentTarget\.reset\(\)/);
  for(const formId of ['order-form','document-form','support-form','login-form']){
    assert.match(js,new RegExp(`\\$\\('#${formId}'\\)\\.addEventListener\\('submit',async e=>\\{e\\.preventDefault\\(\\);const form=e\\.currentTarget`));
  }
});

test('commercial browser keeps credentials out of persistent browser storage',()=>{
  assert.doesNotMatch(js,/localStorage/);
  assert.doesNotMatch(js,/sessionStorage\.setItem\([^\n;]*(?:password|apiKey)/i);
  assert.doesNotMatch(js,/sessionStorage\.getItem\([^\n;]*(?:password|apiKey)/i);
  assert.match(js,/sessionStorage\.getItem\('mono\.csrf'\)/);
  assert.match(js,/sessionStorage\.setItem\('mono\.csrf',state\.csrf\)/);
});

test('commercial layout explicitly supports desktop tablet and narrow mobile without hiding overflow defects',()=>{
  assert.match(css,/@media\(max-width:1050px\)/);
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/@media\(max-width:420px\)/);
  assert.doesNotMatch(css,/overflow-x\s*:\s*hidden/);
});
