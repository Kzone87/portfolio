import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../nexa-service-domain/index.html', import.meta.url), 'utf8');

test('NEXA service flow ends in customer actions', () => {
  for (const href of ['../nexa-tech-service/services.html','../nexa-tech-service/contact.html','../nexa-tech-service/playbook.html','../nexa-tech-service/']) {
    assert.ok(html.includes(`href="${href}"`), `missing customer action ${href}`);
  }
  assert.ok(!html.includes('../field-service-ops/'), 'customer service flow must not route into staff workspace');
});
