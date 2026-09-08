import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
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

test('delivery build exports only public web assets and injects endpoint config without credentials', () => {
  const root = mkdtempSync(join(tmpdir(), 'nexa-delivery-build-'));
  const output = join(root, 'web');
  try {
    const result = build({
      NEXA_DELIVERY_DIR: output,
      NEXA_PUBLIC_API_ORIGIN: 'https://service.example.invalid',
      NEXA_OPS_API_ORIGIN: 'https://ops.example.invalid'
    });
    assert.equal(result.status, 0, result.stderr);
    for (const path of [
      'nexa-tech-service/index.html', 'nexa-tech-service/runtime-config.js',
      'nexa-service-domain/index.html', 'nexa-service-domain/runtime-config.js',
      'field-service-ops/index.html', 'field-service-ops/runtime-config.js',
      'field-service-ops/remote-app.mjs', 'customer-ui.js', 'delivery-manifest.json'
    ]) assert.equal(existsSync(join(output, path)), true, `missing delivery asset ${path}`);

    for (const path of [
      'field-service-ops/server/app.mjs', 'field-service-ops/demo-app.mjs', 'field-service-ops/demo-delivery-app.mjs',
      'nexa-tech-service/server/app.mjs', 'test', 'scripts'
    ]) assert.equal(existsSync(join(output, path)), false, `private/development asset leaked: ${path}`);

    const customerConfig = readFileSync(join(output, 'nexa-tech-service/runtime-config.js'), 'utf8');
    const portalConfig = readFileSync(join(output, 'nexa-service-domain/runtime-config.js'), 'utf8');
    const opsConfig = readFileSync(join(output, 'field-service-ops/runtime-config.js'), 'utf8');
    assert.match(customerConfig, /https:\/\/service\.example\.invalid/);
    assert.match(portalConfig, /https:\/\/service\.example\.invalid/);
    assert.match(opsConfig, /https:\/\/ops\.example\.invalid/);
    const allConfig = `${customerConfig}\n${portalConfig}\n${opsConfig}`;
    assert.doesNotMatch(allConfig, /password|token|secret|authorization/i);

    const contact = readFileSync(join(output, 'nexa-tech-service/contact.html'), 'utf8');
    const portal = readFileSync(join(output, 'nexa-service-domain/index.html'), 'utf8');
    const ops = readFileSync(join(output, 'field-service-ops/index.html'), 'utf8');
    assert.match(contact, /runtime-config\.js[\s\S]*app\.js/);
    assert.match(portal, /runtime-config\.js[\s\S]*app\.js/);
    assert.match(ops, /runtime-config\.js[\s\S]*type="module" src="\.\/app\.js"/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('delivery build refuses missing or insecure remote endpoints', () => {
  const root = mkdtempSync(join(tmpdir(), 'nexa-delivery-build-invalid-'));
  try {
    const missing = build({ NEXA_DELIVERY_DIR: join(root, 'missing'), NEXA_PUBLIC_API_ORIGIN: '', NEXA_OPS_API_ORIGIN: '' });
    assert.notEqual(missing.status, 0);
    const insecure = build({
      NEXA_DELIVERY_DIR: join(root, 'insecure'),
      NEXA_PUBLIC_API_ORIGIN: 'http://service.example.invalid',
      NEXA_OPS_API_ORIGIN: 'https://ops.example.invalid'
    });
    assert.notEqual(insecure.status, 0);
    assert.match(insecure.stderr, /must use HTTPS/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
