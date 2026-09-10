import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createCustomerAccessServer } from '../nexa-tech-service/server/customer-access-server.mjs';
import { createCustomerAccessStore } from '../nexa-tech-service/server/customer-access-store.mjs';
import { createInquiryStore } from '../nexa-tech-service/server/inquiry-store.mjs';

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}

async function stop(server) {
  if (!server.listening) return;
  server.close();
  await once(server, 'close');
}

test('NEXA customer readiness performs real inquiry and access datastore operations', async () => {
  const inquiryStore = createInquiryStore();
  const accessStore = createCustomerAccessStore();
  const server = createCustomerAccessServer({
    inquiryStore,
    accessStore,
    allowedOrigins: ['https://service.example'],
    sendOtp: async () => {}
  });
  const root = await listen(server);
  try {
    const response = await fetch(`${root}/api/customer/access/ready`, { headers: { origin: 'https://service.example' } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ready: true,
      service: 'nexa-customer-access',
      inquiryDatabase: true,
      accessDatabase: true
    });
  } finally {
    await stop(server);
    accessStore.close();
    inquiryStore.close();
  }
});

test('NEXA customer readiness fails closed when a required datastore probe fails', async () => {
  const server = createCustomerAccessServer({
    inquiryStore: { list() { throw new Error('database unavailable'); } },
    accessStore: { cleanup() {} },
    allowedOrigins: ['https://service.example'],
    sendOtp: async () => {}
  });
  const root = await listen(server);
  try {
    const response = await fetch(`${root}/api/customer/access/ready`, { headers: { origin: 'https://service.example' } });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).ready, false);
  } finally {
    await stop(server);
  }
});
