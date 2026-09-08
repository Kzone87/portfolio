import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const home = readFileSync(new URL('../nexa-tech-service/index.html', import.meta.url), 'utf8');
const scopeJs = readFileSync(new URL('../nexa-tech-service/commercial-scope.js', import.meta.url), 'utf8');
const scopeCss = readFileSync(new URL('../nexa-tech-service/commercial-scope.css', import.meta.url), 'utf8');
const build = readFileSync(new URL('../scripts/nexa-build-delivery.mjs', import.meta.url), 'utf8');
const envExample = readFileSync(new URL('../deploy/nexa.env.example', import.meta.url), 'utf8');
const runbook = readFileSync(new URL('../NEXA_DELIVERY_RUNBOOK.md', import.meta.url), 'utf8');

test('NEXA TECH home keeps customer-critical navigation and contract boundaries usable without JavaScript', () => {
  assert.match(home, /href="\.\.\/nexa-service-domain\/" data-service-status>진행 조회<\/a>/);
  assert.match(home, /href="\.\.\/nexa-service-domain\/" data-service-status>접수 진행 확인<\/a>/);
  assert.match(home, /class="console-consult-link" href="\.\/contact\.html">상담하기 →<\/a>/);
  assert.match(home, /data-commercial-scope-static/);
  assert.match(home, /이용·계약 기준/);
  assert.match(home, /확인되지 않은 응답시간이나 지원범위를 임의로 약속하지 않습니다/);
  assert.match(scopeJs, /main\.querySelector\('\[data-commercial-scope-static\]'\)/);
});

test('public demo stays honest while delivery build has explicit real-company injection points', () => {
  assert.match(home, /<!-- NEXA_HOME_STRUCTURED_DATA -->/);
  assert.match(home, /<!-- NEXA_HOME_COMPANY_PROFILE -->/);
  assert.match(home, /data-demo-disclaimer/);
  assert.match(home, /가상 브랜드/);
  assert.doesNotMatch(home, /123-45-67890|02-1234-5678|에이원프린트케어/);

  for (const field of [
    'brandName','brandMark','legalName','representative','businessNumber','address','phone','email','businessHours','serviceRegion','privacyUrl'
  ]) assert.match(build, new RegExp(field));
  assert.match(build, /NEXA_PUBLIC_SITE_ORIGIN/);
  assert.match(build, /NEXA_COMPANY_PROFILE_FILE/);
  assert.match(build, /application\/ld\+json/);
  assert.match(build, /company-profile-section/);
  assert.match(envExample, /NEXA_PUBLIC_SITE_ORIGIN=/);
  assert.match(envExample, /NEXA_COMPANY_PROFILE_FILE=/);
});

test('handover runbook requires the same real-domain and company-profile inputs as the delivery build', () => {
  for (const key of ['NEXA_PUBLIC_API_ORIGIN','NEXA_OPS_API_ORIGIN','NEXA_CUSTOMER_SECURE_ORIGIN','NEXA_PUBLIC_SITE_ORIGIN','NEXA_COMPANY_PROFILE_FILE','NEXA_DELIVERY_DIR']) {
    assert.match(runbook, new RegExp(key));
  }
  assert.match(runbook, /실제 고객 도메인/);
  assert.match(runbook, /사업자등록번호/);
  assert.match(runbook, /개인정보 처리방침 URL/);
  assert.match(runbook, /Organization JSON-LD/);
  assert.doesNotMatch(runbook, /이뮔일|이뮔지/);
});

test('delivery-only company facts and contact actions are responsive and keyboard-visible', () => {
  assert.match(scopeCss, /\.company-profile-card\{display:grid/);
  assert.match(scopeCss, /\.company-profile-grid\{display:grid/);
  assert.match(scopeCss, /\.company-phone/);
  assert.match(scopeCss, /\.company-privacy/);
  assert.match(scopeCss, /@media\(max-width:900px\)[\s\S]*\.company-profile-card\{grid-template-columns:1fr\}/);
  assert.match(scopeCss, /@media\(max-width:520px\)[\s\S]*\.company-profile-grid\{grid-template-columns:1fr\}/);
  assert.match(scopeCss, /\.console-foot \.console-consult-link/);
});
