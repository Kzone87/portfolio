import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import {
  FULFILLMENT_STATUS,
  OPS_STATUS,
  PAYMENT_STATUS,
  REFUND_STATUS,
  computeMetrics,
  createOrder,
  holdOrder,
  releaseOrder,
  requestRefund,
  decideRefund,
  snapshotOrder
} from '../commerce-ops-console/engine.mjs';
import { createCommerceServer } from '../commerce-ops-console/server/app.mjs';

async function withServer(run) {
  const server = createCommerceServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try { await run(baseUrl); }
  finally {
    server.close();
    await once(server, 'close');
  }
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) }
  });
  const body = await response.json();
  return { response, body };
}

test('commerce engine separates operational, payment and fulfillment state', () => {
  const order = createOrder({ orderNo: 'ORD-TEST-1', customerName: 'Test Buyer', email: 'BUYER@EXAMPLE.COM', total: 150000, currency: 'krw', itemCount: 2 }, { id: 10, createdAt: '2026-09-06T00:00:00Z' });
  assert.equal(order.opsStatus, OPS_STATUS.ACTIVE);
  assert.equal(order.paymentStatus, PAYMENT_STATUS.PAID);
  assert.equal(order.fulfillmentStatus, FULFILLMENT_STATUS.UNFULFILLED);
  assert.equal(order.email, 'buyer@example.com');
  assert.equal(order.currency, 'KRW');
  assert.equal(snapshotOrder(order).refundableAmount, 150000);
});

test('hold and release preserve fulfillment while advancing optimistic version', () => {
  const order = createOrder({ orderNo: 'ORD-HOLD', customerName: 'Hold Buyer', email: 'hold@example.com', total: 90000, itemCount: 1 }, { id: 11, createdAt: '2026-09-06T00:00:00Z' });
  const held = holdOrder(order, 'ADDRESS_CHECK', '2026-09-06T01:00:00Z');
  assert.equal(held.opsStatus, OPS_STATUS.ON_HOLD);
  assert.equal(held.fulfillmentStatus, FULFILLMENT_STATUS.UNFULFILLED);
  assert.equal(held.version, 2);
  const released = releaseOrder(held, '2026-09-06T02:00:00Z');
  assert.equal(released.opsStatus, OPS_STATUS.ACTIVE);
  assert.equal(released.holdReason, null);
  assert.equal(released.version, 3);
});

test('high-value refund is flagged for human approval and updates financial state only after decision', () => {
  const order = createOrder({ orderNo: 'ORD-REFUND', customerName: 'Refund Buyer', email: 'refund@example.com', total: 300000, itemCount: 1 }, { id: 12, createdAt: '2026-09-06T00:00:00Z' });
  const requested = requestRefund(order, { amount: 120000, reason: 'CUSTOMER_REQUEST', note: 'partial refund' }, { id: 30, requestedBy: 'staff', createdAt: '2026-09-06T01:00:00Z' });
  assert.equal(requested.refund.status, REFUND_STATUS.REQUESTED);
  assert.equal(requested.refund.requiresApproval, true);
  assert.equal(requested.order.paymentStatus, PAYMENT_STATUS.REFUND_PENDING);
  assert.equal(requested.order.refundedAmount, 0);

  const approved = decideRefund(requested.order, requested.refund, { decision: 'APPROVE', decidedBy: 'admin' }, '2026-09-06T02:00:00Z');
  assert.equal(approved.refund.status, REFUND_STATUS.APPROVED);
  assert.equal(approved.order.paymentStatus, PAYMENT_STATUS.PARTIALLY_REFUNDED);
  assert.equal(approved.order.refundedAmount, 120000);
  assert.equal(snapshotOrder(approved.order).refundableAmount, 180000);
});

test('metrics expose holds, unfulfilled work and refund review pressure', () => {
  const orders = [
    { total: 100000, refundedAmount: 0, opsStatus: 'ACTIVE', paymentStatus: 'PAID', fulfillmentStatus: 'UNFULFILLED' },
    { total: 200000, refundedAmount: 50000, opsStatus: 'ON_HOLD', paymentStatus: 'REFUND_PENDING', fulfillmentStatus: 'DELIVERED' }
  ];
  const refunds = [{ status: 'REQUESTED', requiresApproval: true }];
  assert.deepEqual(computeMetrics(orders, refunds), {
    active: 1, holds: 1, unfulfilled: 1, pendingRefunds: 1, highValuePending: 1, grossValue: 300000, refundedValue: 50000
  });
});

test('HTTP API lists seeded operational pressure and supports filters', async () => {
  await withServer(async (baseUrl) => {
    const health = await request(baseUrl, '/api/health');
    assert.equal(health.response.status, 200);
    assert.equal(health.body.service, 'commerce-ops-console');

    const metrics = await request(baseUrl, '/api/metrics');
    assert.equal(metrics.response.status, 200);
    assert.equal(metrics.body.holds, 1);
    assert.equal(metrics.body.pendingRefunds, 1);
    assert.equal(metrics.body.highValuePending, 1);

    const held = await request(baseUrl, '/api/orders?opsStatus=ON_HOLD');
    assert.equal(held.response.status, 200);
    assert.equal(held.body.items.length, 1);
    assert.equal(held.body.items[0].orderNo, 'ORD-260902');
  });
});

test('HTTP order workflow ships with version checks and audit history', async () => {
  await withServer(async (baseUrl) => {
    const shipped = await request(baseUrl, '/api/orders/3/ship', {
      method: 'POST',
      body: JSON.stringify({ expectedVersion: 2, trackingNo: 'TRACK-3333', actor: 'warehouse-user' })
    });
    assert.equal(shipped.response.status, 200);
    assert.equal(shipped.body.fulfillmentStatus, 'SHIPPED');
    assert.equal(shipped.body.version, 3);

    const stale = await request(baseUrl, '/api/orders/3/deliver', {
      method: 'POST',
      body: JSON.stringify({ expectedVersion: 2, actor: 'warehouse-user' })
    });
    assert.equal(stale.response.status, 409);
    assert.equal(stale.body.error.code, 'STALE_ORDER');

    const delivered = await request(baseUrl, '/api/orders/3/deliver', {
      method: 'POST',
      body: JSON.stringify({ expectedVersion: 3, actor: 'warehouse-user' })
    });
    assert.equal(delivered.response.status, 200);
    assert.equal(delivered.body.fulfillmentStatus, 'DELIVERED');

    const audits = await request(baseUrl, '/api/audits?orderId=3');
    assert.equal(audits.response.status, 200);
    assert.ok(audits.body.items.some((item) => item.action === 'SHIP' && item.actor === 'warehouse-user'));
    assert.ok(audits.body.items.some((item) => item.action === 'DELIVER'));
  });
});

test('HTTP sensitive refund workflow requires ADMIN and current order version', async () => {
  await withServer(async (baseUrl) => {
    const requested = await request(baseUrl, '/api/orders/3/refunds', {
      method: 'POST',
      body: JSON.stringify({ expectedVersion: 2, amount: 120000, reason: 'CUSTOMER_REQUEST', note: 'customer asked for partial refund', actor: 'support-user' })
    });
    assert.equal(requested.response.status, 200);
    assert.equal(requested.body.refund.requiresApproval, true);
    assert.equal(requested.body.order.paymentStatus, 'REFUND_PENDING');
    assert.equal(requested.body.order.version, 3);

    const stale = await request(baseUrl, `/api/refunds/${requested.body.refund.id}/decision`, {
      method: 'POST',
      body: JSON.stringify({ expectedVersion: 2, decision: 'APPROVE', decidedBy: 'ops-admin', role: 'ADMIN' })
    });
    assert.equal(stale.response.status, 409);
    assert.equal(stale.body.error.code, 'STALE_ORDER');

    const forbidden = await request(baseUrl, `/api/refunds/${requested.body.refund.id}/decision`, {
      method: 'POST',
      body: JSON.stringify({ expectedVersion: 3, decision: 'APPROVE', decidedBy: 'support-user', role: 'STAFF' })
    });
    assert.equal(forbidden.response.status, 403);
    assert.equal(forbidden.body.error.code, 'REFUND_APPROVAL_FORBIDDEN');

    const approved = await request(baseUrl, `/api/refunds/${requested.body.refund.id}/decision`, {
      method: 'POST',
      body: JSON.stringify({ expectedVersion: 3, decision: 'APPROVE', decidedBy: 'ops-admin', role: 'ADMIN', decisionNote: 'verified' })
    });
    assert.equal(approved.response.status, 200);
    assert.equal(approved.body.refund.status, 'APPROVED');
    assert.equal(approved.body.order.paymentStatus, 'PARTIALLY_REFUNDED');
    assert.equal(approved.body.order.refundedAmount, 120000);

    const audits = await request(baseUrl, '/api/audits?orderId=3');
    assert.ok(audits.body.items.some((item) => item.action === 'REQUEST_REFUND'));
    assert.ok(audits.body.items.some((item) => item.action === 'APPROVE_REFUND' && item.actor === 'ops-admin'));
  });
});

test('HTTP seeded sensitive refund cannot be decided by STAFF', async () => {
  await withServer(async (baseUrl) => {
    const forbidden = await request(baseUrl, '/api/refunds/1/decision', {
      method: 'POST',
      body: JSON.stringify({ expectedVersion: 5, decision: 'REJECT', decidedBy: 'demo-staff', role: 'STAFF' })
    });
    assert.equal(forbidden.response.status, 403);
    assert.equal(forbidden.body.error.code, 'REFUND_APPROVAL_FORBIDDEN');
  });
});

test('HTTP API validates order creation and rejects impossible transitions', async () => {
  await withServer(async (baseUrl) => {
    const invalid = await request(baseUrl, '/api/orders', {
      method: 'POST',
      body: JSON.stringify({ orderNo: 'x', customerName: 'A', email: 'bad', total: -1 })
    });
    assert.equal(invalid.response.status, 400);
    assert.equal(invalid.body.error.code, 'INVALID_ORDER');

    const impossible = await request(baseUrl, '/api/orders/1/ship', {
      method: 'POST',
      body: JSON.stringify({ expectedVersion: 1, trackingNo: 'TRACK-1', actor: 'warehouse-user' })
    });
    assert.equal(impossible.response.status, 409);
    assert.equal(impossible.body.error.code, 'INVALID_ORDER_ACTION');
  });
});
