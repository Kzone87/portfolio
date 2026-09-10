import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const experiencePath = join(root, 'portfolio-experience.js');
const motionPath = join(root, 'home-motion.js');
const experience = readFileSync(experiencePath, 'utf8');
const motion = readFileSync(motionPath, 'utf8');

test('portfolio experience client script has valid JavaScript syntax', () => {
  const result = spawnSync(process.execPath, ['--check', experiencePath], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('home entry loads the audience-guided experience layer', () => {
  assert.match(motion, /import\(['"]\.\/portfolio-experience\.js['"]\)/);
});

test('experience exposes hiring, project and technical review modes', () => {
  for (const mode of ['hiring', 'project', 'technical']) {
    assert.match(experience, new RegExp(`data-mode=["']${mode}["']`));
  }
  assert.match(experience, /role="tablist"/);
  assert.match(experience, /role="tabpanel"/);
  assert.match(experience, /aria-selected/);
  assert.match(experience, /ArrowLeft/);
  assert.match(experience, /ArrowRight/);
});

test('experience routes visitors to real portfolio evidence and conversion paths', () => {
  for (const target of [
    '#featured',
    '#evidence',
    '#delivery',
    './nexa-tech-service/',
    './booking-crm/',
    './mono-operations/',
    './project-inquiry/',
    'https://github.com/Kzone87/portfolio'
  ]) {
    assert.ok(experience.includes(target), `missing portfolio target: ${target}`);
  }
});

test('experience remains local-first and does not add analytics or network tracking', () => {
  assert.doesNotMatch(experience, /\bfetch\s*\(/);
  assert.doesNotMatch(experience, /XMLHttpRequest/);
  assert.doesNotMatch(experience, /sendBeacon/);
  assert.doesNotMatch(experience, /localStorage/);
  assert.match(experience, /sessionStorage/);
});

test('experience includes reduced-motion and mobile behavior', () => {
  assert.match(experience, /prefers-reduced-motion:reduce/);
  assert.match(experience, /@media \(max-width:900px\)/);
  assert.match(experience, /@media \(max-width:640px\)/);
});
