import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pages = ['index.html','about.html','services.html','industries.html','cases.html','playbook.html','contact.html'];
for (const page of pages) {
  const html = await readFile(new URL(`../nexa-tech-service/${page}`, import.meta.url), 'utf8');
  test(`${page} keeps customer navigation language`, () => {
    for (const label of ['회사소개','서비스','이용 고객','이용 상황','상담']) assert.ok(html.includes(label), `${page} missing ${label}`);
    assert.ok(!html.includes('적용 예시'), `${page} uses showcase wording`);
  });
}
