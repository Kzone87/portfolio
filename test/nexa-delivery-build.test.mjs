import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

function build(env) {
  return spawnSync(process.execPath, ['scripts/nexa-build-delivery.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, ...env },
    encoding: 'utf8'
  });
}

function writeProfile(root, overrides = {}) {
  const path = join(root, 'company-profile.json');
  const profile = {
    brandName: 'A1 PRINT CARE',
    brandMark: 'A1',
    legalName: '에이원프린트케어 주식회사',
    representative: '김대표',
    businessNumber: '123-45-67890',
    address: '서울특별시 테스트구 납품로 100',
    phone: '02-1234-5678',
    email: 'service@a1.example',
    businessHours: '평일 09:00–18:00',
    serviceRegion: '서울·경기 협의 지역',
    privacyUrl: 'https://a1.example/privacy',
    ogImageUrl: 'https://a1.example/og.png',
    ...overrides
  };
  writeFileSync(path, `${JSON.stringify(profile, null, 2)}\n`);
  return path;
}

function validEnv(root, output) {
  return {
    NEXA_DELIVERY_DIR: output,
    NEXA_PUBLIC_API_ORIGIN: 'https://service.example.invalid',
    NEXA_OPS_API_ORIGIN: 'https://ops.example.invalid',
    NEXA_CUSTOMER_SECURE_ORIGIN: 'https://secure.example.invalid',
    NEXA_PUBLIC_SITE_ORIGIN: 'https://a1.example',
    NEXA_COMPANY_PROFILE_FILE: writeProfile(root)
  };
}

test('delivery build exports only public web assets and injects real customer identity without credentials', () => {
  const root = mkdtempSync(join(tmpdir(), 'nexa-delivery-build-'));
  const output = join(root, 'web');
  try {
    const result = build(validEnv(root, output));
    assert.equal(result.status, 0, result.stderr);
    for (const path of [
      'nexa-family.css',
      'nexa-tech-service/index.html', 'nexa-tech-service/runtime-config.js',
      'nexa-service-domain/index.html', 'nexa-service-domain/runtime-config.js', 'nexa-service-domain/secure-access.css', 'nexa-service-domain/secure-access.js',
      'field-service-ops/index.html', 'field-service-ops/runtime-config.js',
      'field-service-ops/remote-app.mjs', 'customer-ui.js', 'delivery-manifest.json'
    ]) assert.equal(existsSync(join(output, path)), true, `missing delivery asset ${path}`);

    for (const path of [
      'field-service-ops/server/app.mjs', 'field-service-ops/demo-app.mjs', 'field-service-ops/demo-delivery-app.mjs',
      'nexa-tech-service/server/app.mjs', 'test', 'scripts', 'nexa-tech-service/company-profile.example.json'
    ]) assert.equal(existsSync(join(output, path)), false, `private/development asset leaked: ${path}`);

    const familyCss = readFileSync(join(output, 'nexa-family.css'), 'utf8');
    assert.match(familyCss, /--nexa-brand:#1565e8/);
    assert.match(familyCss, /--nexa-navy:#102a43/);

    const customerConfig = readFileSync(join(output, 'nexa-tech-service/runtime-config.js'), 'utf8');
    const portalConfig = readFileSync(join(output, 'nexa-service-domain/runtime-config.js'), 'utf8');
    const opsConfig = readFileSync(join(output, 'field-service-ops/runtime-config.js'), 'utf8');
    assert.match(customerConfig, /https:\/\/service\.example\.invalid/);
    assert.match(portalConfig, /https:\/\/service\.example\.invalid/);
    assert.match(portalConfig, /https:\/\/secure\.example\.invalid/);
    assert.match(opsConfig, /https:\/\/ops\.example\.invalid/);
    const allConfig = `${customerConfig}\n${portalConfig}\n${opsConfig}`;
    assert.doesNotMatch(allConfig, /password|token|secret|authorization/i);

    const home = readFileSync(join(output, 'nexa-tech-service/index.html'), 'utf8');
    assert.match(home, /A1 PRINT CARE/);
    assert.match(home, /에이원프린트케어 주식회사/);
    assert.match(home, /김대표/);
    assert.match(home, /123-45-67890/);
    assert.match(home, /02-1234-5678/);
    assert.match(home, /서울·경기 협의 지역/);
    assert.match(home, /평일 09:00–18:00/);
    assert.match(home, /https:\/\/a1\.example\/privacy/);
    assert.match(home, /<link rel="canonical" href="https:\/\/a1\.example\/">/);
    assert.match(home, /<meta property="og:url" content="https:\/\/a1\.example\/">/);
    assert.match(home, /<meta property="og:image" content="https:\/\/a1\.example\/og\.png">/);
    assert.match(home, /application\/ld\+json/);
    assert.match(home, /company-profile-section/);
    assert.doesNotMatch(home, /포트폴리오 시연을 위해 구성한 가상 브랜드/);

    const contact = readFileSync(join(output, 'nexa-tech-service/contact.html'), 'utf8');
    const portal = readFileSync(join(output, 'nexa-service-domain/index.html'), 'utf8');
    const ops = readFileSync(join(output, 'field-service-ops/index.html'), 'utf8');
    assert.match(contact, /runtime-config\.js[\s\S]*app\.js/);
    assert.match(portal, /runtime-config\.js[\s\S]*app\.js/);
    assert.match(ops, /runtime-config\.js[\s\S]*type="module" src="\.\/app\.js"/);

    const manifest = JSON.parse(readFileSync(join(output, 'delivery-manifest.json'), 'utf8'));
    assert.equal(manifest.version, 2);
    assert.equal(manifest.publicSite, 'https://a1.example');
    assert.equal(manifest.company.brandName, 'A1 PRINT CARE');
    assert.equal(manifest.company.legalName, '에이원프린트케어 주식회사');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('delivery build refuses missing company identity, missing public site, or insecure remote URLs', () => {
  const root = mkdtempSync(join(tmpdir(), 'nexa-delivery-build-invalid-'));
  try {
    const missing = build({
      NEXA_DELIVERY_DIR: join(root, 'missing'),
      NEXA_PUBLIC_API_ORIGIN: 'https://service.example.invalid',
      NEXA_OPS_API_ORIGIN: 'https://ops.example.invalid',
      NEXA_CUSTOMER_SECURE_ORIGIN: 'https://secure.example.invalid',
      NEXA_PUBLIC_SITE_ORIGIN: '',
      NEXA_COMPANY_PROFILE_FILE: ''
    });
    assert.notEqual(missing.status, 0);

    const profilePath = writeProfile(root);
    const insecure = build({
      NEXA_DELIVERY_DIR: join(root, 'insecure'),
      NEXA_PUBLIC_API_ORIGIN: 'http://service.example.invalid',
      NEXA_OPS_API_ORIGIN: 'https://ops.example.invalid',
      NEXA_CUSTOMER_SECURE_ORIGIN: 'https://secure.example.invalid',
      NEXA_PUBLIC_SITE_ORIGIN: 'https://a1.example',
      NEXA_COMPANY_PROFILE_FILE: profilePath
    });
    assert.notEqual(insecure.status, 0);
    assert.match(insecure.stderr, /must use HTTPS/);

    const badProfile = writeProfile(root, { email: 'not-an-email' });
    const invalidIdentity = build({
      NEXA_DELIVERY_DIR: join(root, 'bad-profile'),
      NEXA_PUBLIC_API_ORIGIN: 'https://service.example.invalid',
      NEXA_OPS_API_ORIGIN: 'https://ops.example.invalid',
      NEXA_CUSTOMER_SECURE_ORIGIN: 'https://secure.example.invalid',
      NEXA_PUBLIC_SITE_ORIGIN: 'https://a1.example',
      NEXA_COMPANY_PROFILE_FILE: badProfile
    });
    assert.notEqual(invalidIdentity.status, 0);
    assert.match(invalidIdentity.stderr, /email is invalid/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
