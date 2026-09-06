export const OPS_STATUS = Object.freeze({ ACTIVE: 'ACTIVE', ON_HOLD: 'ON_HOLD', CANCELLED: 'CANCELLED', CLOSED: 'CLOSED' });
export const PAYMENT_STATUS = Object.freeze({ PAID: 'PAID', REFUND_PENDING: 'REFUND_PENDING', PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED', REFUNDED: 'REFUNDED' });
export const FULFILLMENT_STATUS = Object.freeze({ UNFULFILLED: 'UNFULFILLED', PICKING: 'PICKING', SHIPPED: 'SHIPPED', DELIVERED: 'DELIVERED', RETURNED: 'RETURNED' });
export const REFUND_STATUS = Object.freeze({ REQUESTED: 'REQUESTED', APPROVED: 'APPROVED', REJECTED: 'REJECTED' });

export const REFUND_REASONS = Object.freeze(['CUSTOMER_REQUEST', 'DUPLICATE', 'DAMAGED', 'LOST', 'FRAUD_REVIEW', 'OTHER']);
export const HOLD_REASONS = Object.freeze(['ADDRESS_CHECK', 'STOCK_CHECK', 'PAYMENT_REVIEW', 'FRAUD_REVIEW', 'CUSTOMER_REQUEST', 'OTHER']);
export const HIGH_VALUE_REFUND_THRESHOLD = 100000;

function text(value) { return String(value ?? '').trim(); }
function integer(value) { const n = Number(value); return Number.isInteger(n) ? n : NaN; }
function money(value) { const n = Number(value); return Number.isFinite(n) ? Math.round(n) : NaN; }
function clone(value) { return structuredClone(value); }

export function assertExpectedVersion(order, expectedVersion) {
  const expected = integer(expectedVersion);
  if (!Number.isInteger(expected) || expected < 1) throw new Error('expectedVersion must be a positive integer');
  if (order.version !== expected) throw new Error(`STALE_ORDER_VERSION:${expected}:${order.version}`);
}

export function validateOrderInput(input) {
  const orderNo = text(input?.orderNo);
  const customerName = text(input?.customerName);
  const email = text(input?.email).toLowerCase();
  const total = money(input?.total);
  const currency = text(input?.currency || 'KRW').toUpperCase();
  const itemCount = integer(input?.itemCount ?? 1);
  if (orderNo.length < 3 || orderNo.length > 40) throw new Error('orderNo must be 3-40 characters');
  if (customerName.length < 2 || customerName.length > 80) throw new Error('customerName must be 2-80 characters');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('email must be valid');
  if (!Number.isInteger(total) || total <= 0 || total > 100000000) throw new Error('total must be a positive integer up to 100000000');
  if (!['KRW', 'USD', 'JPY'].includes(currency)) throw new Error('unsupported currency');
  if (!Number.isInteger(itemCount) || itemCount < 1 || itemCount > 999) throw new Error('itemCount must be 1-999');
  return { orderNo, customerName, email, total, currency, itemCount };
}

export function createOrder(input, meta = {}) {
  const normalized = validateOrderInput(input);
  return {
    id: integer(meta.id),
    ...normalized,
    opsStatus: OPS_STATUS.ACTIVE,
    paymentStatus: PAYMENT_STATUS.PAID,
    fulfillmentStatus: FULFILLMENT_STATUS.UNFULFILLED,
    version: 1,
    holdReason: null,
    trackingNo: null,
    refundedAmount: 0,
    createdAt: text(meta.createdAt),
    updatedAt: text(meta.createdAt)
  };
}

export function refundableAmount(order) {
  return Math.max(0, order.total - Number(order.refundedAmount ?? 0));
}

export function deriveFlags(order) {
  const flags = [];
  if (order.opsStatus === OPS_STATUS.ON_HOLD) flags.push('ON_HOLD');
  if (order.paymentStatus === PAYMENT_STATUS.REFUND_PENDING) flags.push('REFUND_PENDING');
  if (order.fulfillmentStatus === FULFILLMENT_STATUS.UNFULFILLED) flags.push('NOT_FULFILLED');
  if (order.fulfillmentStatus === FULFILLMENT_STATUS.RETURNED) flags.push('RETURNED');
  if (order.total >= 500000) flags.push('HIGH_VALUE_ORDER');
  return flags;
}

function changed(order, patch, timestamp) {
  return { ...order, ...patch, version: order.version + 1, updatedAt: timestamp || order.updatedAt };
}

export function holdOrder(order, reason, timestamp = '') {
  if (![OPS_STATUS.ACTIVE].includes(order.opsStatus)) throw new Error('order cannot be held from current state');
  const normalizedReason = text(reason).toUpperCase();
  if (!HOLD_REASONS.includes(normalizedReason)) throw new Error('unsupported hold reason');
  return changed(order, { opsStatus: OPS_STATUS.ON_HOLD, holdReason: normalizedReason }, timestamp);
}

export function releaseOrder(order, timestamp = '') {
  if (order.opsStatus !== OPS_STATUS.ON_HOLD) throw new Error('only held orders can be released');
  return changed(order, { opsStatus: OPS_STATUS.ACTIVE, holdReason: null }, timestamp);
}

export function startPicking(order, timestamp = '') {
  if (order.opsStatus !== OPS_STATUS.ACTIVE) throw new Error('order must be active before picking');
  if (order.fulfillmentStatus !== FULFILLMENT_STATUS.UNFULFILLED) throw new Error('only unfulfilled orders can start picking');
  return changed(order, { fulfillmentStatus: FULFILLMENT_STATUS.PICKING }, timestamp);
}

export function markShipped(order, trackingNo, timestamp = '') {
  if (order.opsStatus !== OPS_STATUS.ACTIVE) throw new Error('order must be active before shipping');
  if (order.fulfillmentStatus !== FULFILLMENT_STATUS.PICKING) throw new Error('only picking orders can be shipped');
  const tracking = text(trackingNo);
  if (tracking.length < 4 || tracking.length > 80) throw new Error('trackingNo must be 4-80 characters');
  return changed(order, { fulfillmentStatus: FULFILLMENT_STATUS.SHIPPED, trackingNo: tracking }, timestamp);
}

export function markDelivered(order, timestamp = '') {
  if (order.fulfillmentStatus !== FULFILLMENT_STATUS.SHIPPED) throw new Error('only shipped orders can be delivered');
  const nextOps = order.paymentStatus === PAYMENT_STATUS.REFUNDED ? OPS_STATUS.CLOSED : order.opsStatus;
  return changed(order, { fulfillmentStatus: FULFILLMENT_STATUS.DELIVERED, opsStatus: nextOps }, timestamp);
}

export function recordReturn(order, timestamp = '') {
  if (![FULFILLMENT_STATUS.SHIPPED, FULFILLMENT_STATUS.DELIVERED].includes(order.fulfillmentStatus)) {
    throw new Error('only shipped or delivered orders can be returned');
  }
  return changed(order, { fulfillmentStatus: FULFILLMENT_STATUS.RETURNED, opsStatus: OPS_STATUS.ON_HOLD, holdReason: 'CUSTOMER_REQUEST' }, timestamp);
}

export function cancelOrder(order, timestamp = '') {
  if (![FULFILLMENT_STATUS.UNFULFILLED, FULFILLMENT_STATUS.PICKING].includes(order.fulfillmentStatus)) throw new Error('shipped orders cannot be cancelled');
  if ([OPS_STATUS.CANCELLED, OPS_STATUS.CLOSED].includes(order.opsStatus)) throw new Error('order is already terminal');
  return changed(order, { opsStatus: OPS_STATUS.CANCELLED }, timestamp);
}

export function validateRefundRequest(order, input) {
  if (order.opsStatus === OPS_STATUS.CANCELLED && refundableAmount(order) === 0) throw new Error('order has no refundable balance');
  const amount = money(input?.amount);
  const reason = text(input?.reason).toUpperCase();
  const note = text(input?.note);
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('refund amount must be a positive integer');
  if (amount > refundableAmount(order)) throw new Error('refund amount exceeds refundable balance');
  if (!REFUND_REASONS.includes(reason)) throw new Error('unsupported refund reason');
  if (note.length > 500) throw new Error('refund note must be at most 500 characters');
  const requiresApproval = amount >= HIGH_VALUE_REFUND_THRESHOLD || ['DAMAGED', 'LOST', 'FRAUD_REVIEW'].includes(reason);
  return { amount, reason, note, requiresApproval };
}

export function requestRefund(order, input, meta = {}) {
  if (order.paymentStatus === PAYMENT_STATUS.REFUND_PENDING) throw new Error('another refund is already pending');
  if (order.paymentStatus === PAYMENT_STATUS.REFUNDED) throw new Error('order is already fully refunded');
  const normalized = validateRefundRequest(order, input);
  const timestamp = text(meta.createdAt);
  const refund = {
    id: integer(meta.id),
    orderId: order.id,
    amount: normalized.amount,
    reason: normalized.reason,
    note: normalized.note,
    requiresApproval: normalized.requiresApproval,
    status: REFUND_STATUS.REQUESTED,
    requestedBy: text(meta.requestedBy || 'ops-user').slice(0, 80),
    decidedBy: null,
    decisionNote: null,
    createdAt: timestamp,
    decidedAt: null
  };
  return {
    order: changed(order, { paymentStatus: PAYMENT_STATUS.REFUND_PENDING }, timestamp),
    refund
  };
}

export function decideRefund(order, refund, input, timestamp = '') {
  if (refund.status !== REFUND_STATUS.REQUESTED) throw new Error('refund is already decided');
  if (order.paymentStatus !== PAYMENT_STATUS.REFUND_PENDING) throw new Error('order is not waiting for a refund decision');
  const decision = text(input?.decision).toUpperCase();
  if (!['APPROVE', 'REJECT'].includes(decision)) throw new Error('decision must be APPROVE or REJECT');
  const decidedBy = text(input?.decidedBy || 'ops-admin').slice(0, 80);
  const decisionNote = text(input?.decisionNote).slice(0, 500);
  if (decision === 'REJECT') {
    return {
      order: changed(order, { paymentStatus: order.refundedAmount > 0 ? PAYMENT_STATUS.PARTIALLY_REFUNDED : PAYMENT_STATUS.PAID }, timestamp),
      refund: { ...refund, status: REFUND_STATUS.REJECTED, decidedBy, decisionNote, decidedAt: timestamp }
    };
  }
  const newRefundedAmount = order.refundedAmount + refund.amount;
  const fullyRefunded = newRefundedAmount >= order.total;
  const nextPayment = fullyRefunded ? PAYMENT_STATUS.REFUNDED : PAYMENT_STATUS.PARTIALLY_REFUNDED;
  const nextOps = fullyRefunded && [FULFILLMENT_STATUS.DELIVERED, FULFILLMENT_STATUS.RETURNED].includes(order.fulfillmentStatus)
    ? OPS_STATUS.CLOSED
    : order.opsStatus;
  return {
    order: changed(order, { refundedAmount: newRefundedAmount, paymentStatus: nextPayment, opsStatus: nextOps }, timestamp),
    refund: { ...refund, status: REFUND_STATUS.APPROVED, decidedBy, decisionNote, decidedAt: timestamp }
  };
}

export function allowedActions(order) {
  if ([OPS_STATUS.CANCELLED, OPS_STATUS.CLOSED].includes(order.opsStatus)) return [];
  const actions = [];
  if (order.opsStatus === OPS_STATUS.ACTIVE) actions.push('HOLD');
  if (order.opsStatus === OPS_STATUS.ON_HOLD) actions.push('RELEASE');
  if (order.opsStatus === OPS_STATUS.ACTIVE && order.fulfillmentStatus === FULFILLMENT_STATUS.UNFULFILLED) actions.push('START_PICKING', 'CANCEL');
  if (order.opsStatus === OPS_STATUS.ACTIVE && order.fulfillmentStatus === FULFILLMENT_STATUS.PICKING) actions.push('SHIP', 'CANCEL');
  if (order.fulfillmentStatus === FULFILLMENT_STATUS.SHIPPED) actions.push('DELIVER', 'RETURN');
  if (order.fulfillmentStatus === FULFILLMENT_STATUS.DELIVERED) actions.push('RETURN');
  if (![PAYMENT_STATUS.REFUND_PENDING, PAYMENT_STATUS.REFUNDED].includes(order.paymentStatus) && refundableAmount(order) > 0) actions.push('REQUEST_REFUND');
  return actions;
}

export function computeMetrics(orders, refunds = []) {
  const active = orders.filter((order) => order.opsStatus === OPS_STATUS.ACTIVE).length;
  const holds = orders.filter((order) => order.opsStatus === OPS_STATUS.ON_HOLD).length;
  const unfulfilled = orders.filter((order) => [FULFILLMENT_STATUS.UNFULFILLED, FULFILLMENT_STATUS.PICKING].includes(order.fulfillmentStatus) && ![OPS_STATUS.CANCELLED, OPS_STATUS.CLOSED].includes(order.opsStatus)).length;
  const pendingRefunds = refunds.filter((refund) => refund.status === REFUND_STATUS.REQUESTED).length;
  const highValuePending = refunds.filter((refund) => refund.status === REFUND_STATUS.REQUESTED && refund.requiresApproval).length;
  const grossValue = orders.reduce((sum, order) => sum + order.total, 0);
  const refundedValue = orders.reduce((sum, order) => sum + Number(order.refundedAmount ?? 0), 0);
  return { active, holds, unfulfilled, pendingRefunds, highValuePending, grossValue, refundedValue };
}

export function snapshotOrder(order) {
  return clone({ ...order, flags: deriveFlags(order), allowedActions: allowedActions(order), refundableAmount: refundableAmount(order) });
}
