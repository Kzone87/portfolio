import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const file = join(root, 'portfolio-a11y-fix.js');
const source = readFileSync(file, 'utf8');
const loader = readFileSync(join(root, 'home-motion.js'), 'utf8');

test('portfolio accessibility target fix has valid JavaScript syntax', () => {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('portfolio navigation and quality actions guarantee WCAG minimum target width', () => {
  assert.match(source, /\.site-header a/);
  assert.match(source, /\.portfolio-experience-tab/);
  assert.match(source, /\.proof-chain a/);
  assert.match(source, /min-width:\s*24px/);
  assert.match(source, /min-height:\s*44px/);
  assert.match(loader, /import\(['"]\.\/portfolio-a11y-fix\.js['"]\)/);
});
