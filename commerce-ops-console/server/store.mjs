import {
  OPS_STATUS,
  PAYMENT_STATUS,
  FULFILLMENT_STATUS,
  REFUND_STATUS,
  assertExpectedVersion,
  cancelOrder,
  computeMetrics,
  createOrder,
  decideRefund,
  holdOrder,
  markDelivered,
  markShipped,
  recordReturn,
  releaseOrder,
  requestRefund,
  snapshotOrder,
  startPicking
} from '../engine.mjs';

export class DomainError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = 'DomainError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function clone(value) { return structuredClone(value); }
function nowIso() { return new Date().toISOString(); }

function mapEngineError(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith('STALE_ORDER_VERSION:')) return new DomainError(409, 'STALE_ORDER', message);
  if (/expectedVersion/.test(message)) return new DomainError(400, 'EXPECTED_VERSION_REQUIRED', message);
  return new DomainError(409, 'INVALID_ORDER_ACTION', message);
}

export function createStore() {
  const seededAt = '2026-09-06T00:00:00.000Z';
  const state = {
    orderSeq: 5,
    refundSeq: 2,
    auditSeq: 8,
    orders: [
      {
        id: 1, orderNo: 'ORD-260901', customerName: 'Alice Kim', email: 'alice@example.com', total: 89000, currency: 'KRW', itemCount: 2,
        opsStatus: OPS_STATUS.ACTIVE, paymentStatus: PAYMENT_STATUS.PAID, fulfillmentStatus: FULFILLMENT_STATUS.UNFULFILLED,
        version: 1, holdReason: null, trackingNo: null, refundedAmount: 0, createdAt: seededAt, updatedAt: seededAt
      },
      {
        id: 2, orderNo: 'ORD-260902', customerName: 'Beta Studio', email: 'ops@beta.example', total: 680000, currency: 'KRW', itemCount: 5,
        opsStatus: OPS_STATUS.ON_HOLD, paymentStatus: PAYMENT_STATUS.PAID, fulfillmentStatus: FULFILLMENT_STATUS.UNFULFILLED,
        version: 2, holdReason: 'ADDRESS_CHECK', trackingNo: null, refundedAmount: 0, createdAt: seededAt, updatedAt: seededAt
      },
      {
        id: 3, orderNo: 'ORD-260903', customerName: 'Chris Lee', email: 'chris@example.com', total: 240000, currency: 'KRW', itemCount: 1,
        opsStatus: OPS_STATUS.ACTIVE, paymentStatus: PAYMENT_STATUS.PAID, fulfillmentStatus: FULFILLMENT_STATUS.PICKING,
        version: 2, holdReason: null, trackingNo: null, refundedAmount: 0, createdAt: seededAt, updatedAt: seededAt
      },
      {
        id: 4, orderNo: 'ORD-260904', customerName: 'Delta Works', email: 'buyer@delta.example', total: 330000, currency: 'KRW', itemCount: 3,
        opsStatus: OPS_STATUS.ACTIVE, paymentStatus: PAYMENT_STATUS.REFUND_PENDING, fulfillmentStatus: FULFILLMENT_STATUS.DELIVERED,
        version: 4, holdReason: null, trackingNo: 'CJ-12345678', refundedAmount: 0, createdAt: seededAt, updatedAt: seededAt
      }
    ],
    refunds: [
      {
        id: 1, orderId: 4, amount: 180000, reason: 'DAMAGED', note: 'Package damage reported after delivery.', requiresApproval: true,
        status: REFUND_STATUS.REQUESTED, requestedBy: 'demo-staff', decidedBy: null, decisionNote: null, createdAt: seededAt, decidedAt: null
      }
    ],
    audits: [
      { id: 1, orderId: 2, actor: 'demo-staff', action: 'HOLD', detail: 'ADDRESS_CHECK', orderVersion: 2, createdAt: seededAt },
      { id: 2, orderId: 3, actor: 'demo-staff', action: 'START_PICKING', detail: '', orderVersion: 2, createdAt: seededAt },
      { id: 3, orderId: 4, actor: 'demo-staff', action: 'START_PICKING', detail: '', orderVersion: 2, createdAt: seededAt },
      { id: 4, orderId: 4, actor: 'demo-staff', action: 'SHIP', detail: 'CJ-12345678', orderVersion: 3, createdAt: seededAt },
      { id: 5, orderId: 4, actor: 'demo-staff', action: 'DELIVER', detail: '', orderVersion: 4, createdAt: seededAt },
      { id: 6, orderId: 4, actor: 'demo-staff', action: 'REQUEST_REFUND', detail: 'DAMAGED · 180000 KRW', orderVersion: 4, createdAt: seededAt },
      { id: 7, orderId: 4, actor: 'system', action: 'REFUND_REVIEW_REQUIRED', detail: 'high-value or risk-sensitive refund', orderVersion: 4, createdAt: seededAt }
    ]
  };

  function findOrder(id) { return state.orders.find((item) => item.id === Number(id)); }
  function requireOrder(id) {
    const order = findOrder(id);
    if (!order) throw new DomainError(404, 'ORDER_NOT_FOUND', 'order not found');
    return order;
  }
  function requireRefund(id) {
    const refund = state.refunds.find((item) => item.id === Number(id));
    if (!refund) throw new DomainError(404, 'REFUND_NOT_FOUND', 'refund not found');
    return refund;
  }
  function audit(order, action, actor, detail = '') {
    state.audits.push({ id: state.auditSeq++, orderId: order.id, actor: String(actor || 'ops-user').slice(0, 80), action, detail: String(detail || '').slice(0, 500), orderVersion: order.version, createdAt: nowIso() });
  }
  function replaceOrder(next) {
    const index = state.orders.findIndex((item) => item.id === next.id);
    state.orders[index] = next;
    return next;
  }
  function mutateOrder(id, expectedVersion, actor, action, fn, detail = '') {
    const order = requireOrder(id);
    try { assertExpectedVersion(order, expectedVersion); } catch (error) { throw mapEngineError(error); }
    let next;
    try { next = fn(clone(order), nowIso()); } catch (error) { throw mapEngineError(error); }
    replaceOrder(next);
    audit(next, action, actor, detail);
    return snapshotOrder(next);
  }

  return {
    listOrders(filters = {}) {
      const query = String(filters.query ?? '').trim().toLowerCase();
      const opsStatus = String(filters.opsStatus ?? '').trim();
      const paymentStatus = String(filters.paymentStatus ?? '').trim();
      const fulfillmentStatus = String(filters.fulfillmentStatus ?? '').trim();
      return state.orders
        .filter((order) => !query || [order.orderNo, order.customerName, order.email].some((value) => String(value).toLowerCase().includes(query)))
        .filter((order) => !opsStatus || order.opsStatus === opsStatus)
        .filter((order) => !paymentStatus || order.paymentStatus === paymentStatus)
        .filter((order) => !fulfillmentStatus || order.fulfillmentStatus === fulfillmentStatus)
        .map(snapshotOrder);
    },

    getOrder(id) { return snapshotOrder(requireOrder(id)); },
    listRefunds(status = '') { return state.refunds.filter((item) => !status || item.status === status).map(clone); },
    listAudits(orderId = null) { return state.audits.filter((item) => orderId === null || item.orderId === Number(orderId)).map(clone).reverse(); },
    metrics() { return computeMetrics(state.orders, state.refunds); },

    createOrder(input, actor = 'ops-user') {
      let order;
      try { order = createOrder(input, { id: state.orderSeq++, createdAt: nowIso() }); }
      catch (error) { throw new DomainError(400, 'INVALID_ORDER', error instanceof Error ? error.message : 'invalid order'); }
      state.orders.push(order);
      audit(order, 'CREATE', actor, `${order.orderNo} · ${order.total} ${order.currency}`);
      return snapshotOrder(order);
    },

    hold(id, input = {}) { return mutateOrder(id, input.expectedVersion, input.actor, 'HOLD', (order, ts) => holdOrder(order, input.reason, ts), input.reason); },
    release(id, input = {}) { return mutateOrder(id, input.expectedVersion, input.actor, 'RELEASE', (order, ts) => releaseOrder(order, ts)); },
    startPicking(id, input = {}) { return mutateOrder(id, input.expectedVersion, input.actor, 'START_PICKING', (order, ts) => startPicking(order, ts)); },
    ship(id, input = {}) { return mutateOrder(id, input.expectedVersion, input.actor, 'SHIP', (order, ts) => markShipped(order, input.trackingNo, ts), input.trackingNo); },
    deliver(id, input = {}) { return mutateOrder(id, input.expectedVersion, input.actor, 'DELIVER', (order, ts) => markDelivered(order, ts)); },
    returnOrder(id, input = {}) { return mutateOrder(id, input.expectedVersion, input.actor, 'RETURN', (order, ts) => recordReturn(order, ts)); },
    cancel(id, input = {}) { return mutateOrder(id, input.expectedVersion, input.actor, 'CANCEL', (order, ts) => cancelOrder(order, ts)); },

    requestRefund(id, input = {}) {
      const order = requireOrder(id);
      try { assertExpectedVersion(order, input.expectedVersion); } catch (error) { throw mapEngineError(error); }
      let result;
      try {
        result = requestRefund(clone(order), input, { id: state.refundSeq++, requestedBy: input.actor, createdAt: nowIso() });
      } catch (error) { throw mapEngineError(error); }
      replaceOrder(result.order);
      state.refunds.push(result.refund);
      audit(result.order, 'REQUEST_REFUND', input.actor, `${result.refund.reason} · ${result.refund.amount} ${result.order.currency}`);
      if (result.refund.requiresApproval) audit(result.order, 'REFUND_REVIEW_REQUIRED', 'system', 'high-value or risk-sensitive refund');
      return { order: snapshotOrder(result.order), refund: clone(result.refund) };
    },

    decideRefund(refundId, input = {}) {
      const refund = requireRefund(refundId);
      const order = requireOrder(refund.orderId);
      try { assertExpectedVersion(order, input.expectedVersion); } catch (error) { throw mapEngineError(error); }
      let result;
      try { result = decideRefund(clone(order), clone(refund), input, nowIso()); }
      catch (error) { throw mapEngineError(error); }
      replaceOrder(result.order);
      const refundIndex = state.refunds.findIndex((item) => item.id === refund.id);
      state.refunds[refundIndex] = result.refund;
      audit(result.order, result.refund.status === REFUND_STATUS.APPROVED ? 'APPROVE_REFUND' : 'REJECT_REFUND', input.decidedBy, `${result.refund.amount} ${result.order.currency}`);
      return { order: snapshotOrder(result.order), refund: clone(result.refund) };
    }
  };
}
