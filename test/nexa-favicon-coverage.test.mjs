import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const load = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const pages = [
  'nexa-tech-service/index.html',
  'nexa-tech-service/about.html',
  'nexa-tech-service/services.html',
  'nexa-tech-service/industries.html',
  'nexa-tech-service/cases.html',
  'nexa-tech-service/playbook.html',
  'nexa-tech-service/contact.html',
  'nexa-service-domain/index.html',
  'field-service-ops/index.html'
];

test('every public NEXA surface declares the repository-local favicon', async () => {
  for (const page of pages) {
    const html = await load(page);
    assert.match(html, /<link rel="icon" href="\.\.\/favicon\.svg" type="image\/svg\+xml">/, `${page} must declare ../favicon.svg`);
    assert.doesNotMatch(html, /href="\/favicon\.ico"/, `${page} must not request the github.io host-root favicon`);
  }
});
