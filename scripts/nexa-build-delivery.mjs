import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(process.env.NEXA_DELIVERY_DIR || join(root, 'dist', 'nexa-delivery'));

function endpoint(name) {
  const value = String(process.env[name] || '').trim().replace(/\/+$/, '');
  if (!value) throw new Error(`${name} is required`);
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error(`${name} must be a valid URL`); }
  const local = parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !local) throw new Error(`${name} must use HTTPS unless it is loopback`);
  return value;
}

function publicSiteBase(name) {
  const value = String(process.env[name] || '').trim().replace(/\/+$/, '');
  if (!value) throw new Error(`${name} is required`);
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error(`${name} must be a valid URL`); }
  const local = parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !local) throw new Error(`${name} must use HTTPS unless it is loopback`);
  if (parsed.search || parsed.hash) throw new Error(`${name} must not include query or hash`);
  return value;
}

function publicLink(value, field) {
  const text = String(value || '').trim();
  if (!text) throw new Error(`company profile ${field} is required`);
  if (/^(?:\.\/|\.\.\/|\/)/.test(text)) return text;
  let parsed;
  try { parsed = new URL(text); } catch { throw new Error(`company profile ${field} must be HTTPS or a relative path`); }
  if (parsed.protocol !== 'https:') throw new Error(`company profile ${field} must use HTTPS`);
  return text;
}

function readCompanyProfile() {
  const configured = String(process.env.NEXA_COMPANY_PROFILE_FILE || '').trim();
  if (!configured) throw new Error('NEXA_COMPANY_PROFILE_FILE is required');
  const file = isAbsolute(configured) ? configured : resolve(root, configured);
  if (!existsSync(file)) throw new Error(`company profile file not found: ${file}`);
  let parsed;
  try { parsed = JSON.parse(readFileSync(file, 'utf8')); } catch { throw new Error('NEXA_COMPANY_PROFILE_FILE must contain valid JSON'); }

  const required = ['brandName','brandMark','legalName','representative','businessNumber','address','phone','email','businessHours','serviceRegion','privacyUrl'];
  const profile = {};
  for (const field of required) {
    profile[field] = String(parsed?.[field] || '').trim();
    if (!profile[field]) throw new Error(`company profile ${field} is required`);
  }
  if (profile.brandName.length > 80) throw new Error('company profile brandName is too long');
  if (profile.brandMark.length > 3) throw new Error('company profile brandMark must be 1-3 characters');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) throw new Error('company profile email is invalid');
  if (!/^[0-9+().\-\s]{7,30}$/.test(profile.phone)) throw new Error('company profile phone is invalid');
  profile.privacyUrl = publicLink(profile.privacyUrl, 'privacyUrl');
  profile.ogImageUrl = parsed?.ogImageUrl ? publicLink(parsed.ogImageUrl, 'ogImageUrl') : '';
  return Object.freeze(profile);
}

function copy(relativePath) {
  const source = join(root, relativePath);
  const target = join(output, relativePath);
  if (!existsSync(source)) throw new Error(`delivery source missing: ${relativePath}`);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}

function injectConfig(relativePath, marker) {
  const target = join(output, relativePath);
  const html = readFileSync(target, 'utf8');
  if (!html.includes(marker)) throw new Error(`runtime config marker not found: ${relativePath}`);
  writeFileSync(target, html.replace(marker, `<script src="./runtime-config.js"></script>${marker}`));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function phoneHref(phone) {
  return `tel:${String(phone).replace(/[^0-9+]/g, '')}`;
}

function corporatePageUrl(base, file) {
  return new URL(file === 'index.html' ? './' : `./${file}`, `${base}/`).href;
}

function companyFactsSection(profile) {
  return `<section class="company-profile-section" aria-label="회사 및 서비스 운영 정보"><div class="shell company-profile-card"><div class="company-profile-intro"><span class="korean-kicker">회사·운영 정보</span><h2>${escapeHtml(profile.brandName)}에<br>연락하기 전에 확인하세요.</h2><p>실제 계약과 방문 일정은 아래 회사 정보와 운영 기준을 바탕으로 상담 후 확정합니다.</p><div class="company-profile-actions"><a class="company-phone" href="${escapeHtml(phoneHref(profile.phone))}">${escapeHtml(profile.phone)} 전화하기</a><a class="company-privacy" href="${escapeHtml(profile.privacyUrl)}">개인정보 처리방침</a></div></div><div class="company-profile-grid"><div><span>법인·사업자명</span><strong>${escapeHtml(profile.legalName)}</strong></div><div><span>대표자</span><strong>${escapeHtml(profile.representative)}</strong></div><div><span>사업자등록번호</span><strong>${escapeHtml(profile.businessNumber)}</strong></div><div><span>대표 연락처</span><a href="${escapeHtml(phoneHref(profile.phone))}">${escapeHtml(profile.phone)}</a></div><div><span>이메일</span><a href="mailto:${escapeHtml(profile.email)}">${escapeHtml(profile.email)}</a></div><div><span>운영시간</span><strong>${escapeHtml(profile.businessHours)}</strong></div><div><span>서비스 지역</span><strong>${escapeHtml(profile.serviceRegion)}</strong></div><div><span>사업장 주소</span><strong>${escapeHtml(profile.address)}</strong></div></div></div></section>`;
}

function companyLegalFooter(profile) {
  return `<span class="footer-legal">${escapeHtml(profile.legalName)} · 대표 ${escapeHtml(profile.representative)} · 사업자등록번호 ${escapeHtml(profile.businessNumber)} · ${escapeHtml(profile.address)} · <a href="${escapeHtml(phoneHref(profile.phone))}">${escapeHtml(profile.phone)}</a> · <a href="${escapeHtml(profile.privacyUrl)}">개인정보 처리방침</a></span>`;
}

function structuredData(profile, pageUrl) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: profile.legalName,
    alternateName: profile.brandName,
    url: pageUrl,
    telephone: profile.phone,
    email: profile.email,
    areaServed: profile.serviceRegion,
    contactPoint: [{ '@type': 'ContactPoint', telephone: profile.phone, email: profile.email, contactType: 'customer service' }]
  };
  return `<script type="application/ld+json">${safeJson(data)}</script>`;
}

function transformCorporateHtml(file, profile, siteBase) {
  const target = join(output, 'nexa-tech-service', file);
  let html = readFileSync(target, 'utf8');
  const pageUrl = corporatePageUrl(siteBase, file);

  html = html.replace(/<span data-demo-disclaimer>[^<]*<\/span>/g, companyLegalFooter(profile));
  html = html.replaceAll('NEXA TECH SERVICE', profile.brandName);
  html = html.replaceAll('<span class="brand-mark">N</span>', `<span class="brand-mark">${escapeHtml(profile.brandMark)}</span>`);
  html = html.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${escapeHtml(pageUrl)}">`);
  html = html.replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${escapeHtml(pageUrl)}">`);
  if (profile.ogImageUrl && !html.includes('property="og:image"')) {
    html = html.replace(/(<meta property="og:url"[^>]*>)/, `$1\n  <meta property="og:image" content="${escapeHtml(profile.ogImageUrl)}">`);
  }

  if (file === 'index.html') {
    if (!html.includes('<!-- NEXA_HOME_STRUCTURED_DATA -->')) throw new Error('home structured-data marker missing');
    if (!html.includes('<!-- NEXA_HOME_COMPANY_PROFILE -->')) throw new Error('home company-profile marker missing');
    html = html.replace('<!-- NEXA_HOME_STRUCTURED_DATA -->', structuredData(profile, pageUrl));
    html = html.replace('<!-- NEXA_HOME_COMPANY_PROFILE -->', companyFactsSection(profile));
  }

  writeFileSync(target, html);
}

const customerApi = endpoint('NEXA_PUBLIC_API_ORIGIN');
const operationsApi = endpoint('NEXA_OPS_API_ORIGIN');
const customerSecureApi = endpoint('NEXA_CUSTOMER_SECURE_ORIGIN');
const publicSite = publicSiteBase('NEXA_PUBLIC_SITE_ORIGIN');
const companyProfile = readCompanyProfile();
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

copy('customer-ui.js');
copy('nexa-family.css');

const corporate = [
  'index.html', 'about.html', 'services.html', 'industries.html', 'cases.html', 'playbook.html', 'contact.html',
  'styles.css', 'styles-100.css', 'clarity.css', 'commercial-scope.css', 'commercial-scope.js', 'app.js'
];
for (const file of corporate) copy(`nexa-tech-service/${file}`);
for (const page of ['index.html','about.html','services.html','industries.html','cases.html','playbook.html','contact.html']) transformCorporateHtml(page, companyProfile, publicSite);
writeFileSync(join(output, 'nexa-tech-service', 'runtime-config.js'), `window.NEXA_INQUIRY_ENDPOINT=${JSON.stringify(customerApi)};\n`);
for (const page of ['index.html','about.html','services.html','industries.html','cases.html','playbook.html','contact.html']) injectConfig(`nexa-tech-service/${page}`, '<script src="./app.js"></script>');

for (const file of ['index.html','styles.css','portal-actions.css','secure-access.css','app.js','secure-access.js']) copy(`nexa-service-domain/${file}`);
writeFileSync(join(output, 'nexa-service-domain', 'runtime-config.js'), `window.NEXA_CUSTOMER_PORTAL_ENDPOINT=${JSON.stringify(customerApi)};\nwindow.NEXA_CUSTOMER_SECURE_ENDPOINT=${JSON.stringify(customerSecureApi)};\n`);
injectConfig('nexa-service-domain/index.html', '<script src="./app.js"></script>');

for (const file of ['index.html','styles.css','responsive-100.css','delivery-100.css','customer-actions.css','commercial-workspace.css','app.js','remote-app.mjs','inquiry-desk.mjs','team-admin.mjs','commercial-workspace.mjs']) copy(`field-service-ops/${file}`);
writeFileSync(join(output, 'field-service-ops', 'runtime-config.js'), `window.NEXA_OPS_CONFIG=Object.freeze({endpoint:${JSON.stringify(operationsApi)}});\n`);
injectConfig('field-service-ops/index.html', '<script type="module" src="./app.js"></script>');

const manifest = {
  version: 2,
  generatedAt: new Date().toISOString(),
  customerApi,
  operationsApi,
  customerSecureApi,
  publicSite,
  company: {
    brandName: companyProfile.brandName,
    legalName: companyProfile.legalName,
    serviceRegion: companyProfile.serviceRegion,
    businessHours: companyProfile.businessHours
  },
  surfaces: ['nexa-tech-service', 'nexa-service-domain', 'field-service-ops'],
  sharedAssets: ['nexa-family.css'],
  excluded: ['server source', 'tests', 'demo-delivery-app.mjs', 'demo-app.mjs', 'credentials']
};
writeFileSync(join(output, 'delivery-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`NEXA delivery web bundle: ${output}`);
