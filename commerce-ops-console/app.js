import { createStore, DomainError } from './server/store.mjs';

const store = createStore();
const state = { selectedId: 1, role: 'STAFF' };
const $ = (id) => document.getElementById(id);

const el = {
  role: $('role'), search: $('search'), opsFilter: $('ops-filter'), fulfillmentFilter: $('fulfillment-filter'),
  orderList: $('order-list'), emptyDetail: $('empty-detail'), detail: $('detail'), orderTitle: $('order-title'), orderCustomer: $('order-customer'), orderVersion: $('order-version'),
  opsStatus: $('ops-status'), paymentStatus: $('payment-status'), fulfillmentStatus: $('fulfillment-status'), refundable: $('refundable'), flags: $('flags'), actions: $('actions'),
  holdReason: $('hold-reason'), tracking: $('tracking'), refundAmount: $('refund-amount'), refundReason: $('refund-reason'), refundNote: $('refund-note'), requestRefund: $('request-refund'), statusMessage: $('status-message'),
  refundList: $('refund-list'), auditList: $('audit-list'),
  mActive: $('m-active'), mHold: $('m-hold'), mUnfulfilled: $('m-unfulfilled'), mRefund: $('m-refund'), mHigh: $('m-high')
};

function money(value, currency = 'KRW') {
  try { return new Intl.NumberFormat('ko-KR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value); }
  catch { return `${Number(value).toLocaleString()} ${currency}`; }
}

function node(tag, className = '', text = '') {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text) item.textContent = text;
  return item;
}

function badge(value) { return node('span', `badge ${value}`, value); }
function actor() { return state.role === 'ADMIN' ? 'demo-admin' : 'demo-staff'; }
function selectedOrder() {
  try { return state.selectedId ? store.getOrder(state.selectedId) : null; }
  catch { return null; }
}

function setMessage(message, error = false) {
  el.statusMessage.textContent = message;
  el.statusMessage.dataset.error = error ? 'true' : 'false';
}

function renderMetrics() {
  const metrics = store.metrics();
  el.mActive.textContent = String(metrics.active);
  el.mHold.textContent = String(metrics.holds);
  el.mUnfulfilled.textContent = String(metrics.unfulfilled);
  el.mRefund.textContent = String(metrics.pendingRefunds);
  el.mHigh.textContent = String(metrics.highValuePending);
}

function renderOrders() {
  const orders = store.listOrders({ query: el.search.value, opsStatus: el.opsFilter.value, fulfillmentStatus: el.fulfillmentFilter.value });
  el.orderList.replaceChildren();
  if (!orders.length) {
    el.orderList.append(node('div', 'empty compact', '조건에 맞는 주문이 없습니다.'));
    return;
  }
  for (const order of orders) {
    const button = node('button', `order-card${order.id === state.selectedId ? ' active' : ''}`);
    button.type = 'button';
    const head = node('div', 'order-card-head');
    head.append(node('strong', '', order.orderNo), badge(order.opsStatus));
    const customer = node('p', '', `${order.customerName} · ${money(order.total, order.currency)}`);
    const states = node('div', 'mini-states');
    states.append(badge(order.paymentStatus), badge(order.fulfillmentStatus));
    const meta = node('small', '', `v${order.version} · ${order.itemCount} item${order.itemCount > 1 ? 's' : ''}`);
    button.append(head, customer, states, meta);
    button.addEventListener('click', () => { state.selectedId = order.id; setMessage(''); render(); });
    el.orderList.append(button);
  }
}

function perform(action) {
  const order = selectedOrder();
  if (!order) return;
  try {
    if (action === 'HOLD') store.hold(order.id, { expectedVersion: order.version, reason: el.holdReason.value, actor: actor() });
    else if (action === 'RELEASE') store.release(order.id, { expectedVersion: order.version, actor: actor() });
    else if (action === 'START_PICKING') store.startPicking(order.id, { expectedVersion: order.version, actor: actor() });
    else if (action === 'SHIP') store.ship(order.id, { expectedVersion: order.version, trackingNo: el.tracking.value, actor: actor() });
    else if (action === 'DELIVER') store.deliver(order.id, { expectedVersion: order.version, actor: actor() });
    else if (action === 'RETURN') store.returnOrder(order.id, { expectedVersion: order.version, actor: actor() });
    else if (action === 'CANCEL') {
      if (!window.confirm('이 주문을 취소 처리하시겠습니까?')) return;
      store.cancel(order.id, { expectedVersion: order.version, actor: actor() });
    }
    setMessage(`${action} 처리 완료 · 최신 version으로 갱신했습니다.`);
  } catch (error) {
    setMessage(error instanceof Error ? error.message : '처리에 실패했습니다.', true);
  }
  render();
}

function actionLabel(action) {
  return ({ HOLD: 'Hold', RELEASE: 'Hold 해제', START_PICKING: 'Picking 시작', SHIP: '출고', DELIVER: '배송완료', RETURN: '반품접수', CANCEL: '주문취소' })[action] ?? action;
}

function renderDetail() {
  const order = selectedOrder();
  el.emptyDetail.hidden = Boolean(order);
  el.detail.hidden = !order;
  if (!order) return;

  el.orderTitle.textContent = order.orderNo;
  el.orderCustomer.textContent = `${order.customerName} · ${order.email} · ${money(order.total, order.currency)}`;
  el.orderVersion.textContent = `VERSION ${order.version}`;
  el.opsStatus.textContent = order.opsStatus;
  el.paymentStatus.textContent = order.paymentStatus;
  el.fulfillmentStatus.textContent = order.fulfillmentStatus;
  el.refundable.textContent = money(order.refundableAmount, order.currency);
  el.flags.replaceChildren(...(order.flags.length ? order.flags.map(badge) : [node('span', 'muted', 'No operational flags')]));

  el.actions.replaceChildren();
  for (const action of order.allowedActions.filter((item) => item !== 'REQUEST_REFUND')) {
    const button = node('button', `action ${action}`, actionLabel(action));
    button.type = 'button';
    button.addEventListener('click', () => perform(action));
    el.actions.append(button);
  }
  if (!el.actions.children.length) el.actions.append(node('span', 'muted', '현재 수행 가능한 주문 상태 작업이 없습니다.'));

  const canRefund = order.allowedActions.includes('REQUEST_REFUND');
  el.requestRefund.disabled = !canRefund;
  el.refundAmount.max = String(order.refundableAmount);
  if (!el.refundAmount.value || Number(el.refundAmount.value) > order.refundableAmount) {
    el.refundAmount.value = String(Math.min(order.refundableAmount, 120000));
  }
}

function renderRefunds() {
  const refunds = store.listRefunds('REQUESTED');
  el.refundList.replaceChildren();
  if (!refunds.length) {
    el.refundList.append(node('div', 'empty compact', '대기 중인 환불이 없습니다.'));
    return;
  }
  for (const refund of refunds) {
    const order = store.getOrder(refund.orderId);
    const card = node('article', 'refund-card');
    const top = node('div', 'refund-top');
    const title = node('div');
    title.append(node('strong', '', `${order.orderNo} · ${money(refund.amount, order.currency)}`), node('p', '', `${refund.reason} · requested by ${refund.requestedBy}`));
    top.append(title, badge(refund.requiresApproval ? 'ADMIN_REQUIRED' : 'STANDARD_REVIEW'));
    const note = node('p', 'refund-note', refund.note || 'No note');
    const controls = node('div', 'refund-actions');
    const blocked = refund.requiresApproval && state.role !== 'ADMIN';
    for (const decision of ['APPROVE', 'REJECT']) {
      const button = node('button', decision === 'APPROVE' ? 'approve' : 'reject', decision === 'APPROVE' ? '승인' : '반려');
      button.type = 'button';
      button.disabled = blocked;
      button.addEventListener('click', () => {
        try {
          store.decideRefund(refund.id, { expectedVersion: order.version, decision, role: state.role, decidedBy: actor(), decisionNote: 'Live Lab review' });
          setMessage(`Refund ${decision} 완료 · ${order.orderNo}`);
        } catch (error) {
          setMessage(error instanceof DomainError || error instanceof Error ? error.message : '환불 결정 실패', true);
        }
        render();
      });
      controls.append(button);
    }
    if (blocked) controls.append(node('span', 'role-hint', 'ADMIN 역할로 전환해야 결정할 수 있습니다.'));
    card.append(top, note, controls);
    el.refundList.append(card);
  }
}

function renderAudit() {
  const audits = store.listAudits();
  el.auditList.replaceChildren();
  for (const item of audits.slice(0, 18)) {
    const row = node('article', 'audit-row');
    const top = node('div');
    top.append(node('strong', '', `${item.action} · Order #${item.orderId}`), node('span', '', `v${item.orderVersion}`));
    row.append(top, node('p', '', `${item.actor}${item.detail ? ` · ${item.detail}` : ''}`));
    el.auditList.append(row);
  }
}

function render() {
  renderMetrics();
  renderOrders();
  renderDetail();
  renderRefunds();
  renderAudit();
}

el.role.addEventListener('change', () => { state.role = el.role.value; setMessage(`Demo role을 ${state.role}로 전환했습니다.`); render(); });
for (const input of [el.search, el.opsFilter, el.fulfillmentFilter]) input.addEventListener('input', renderOrders);

el.requestRefund.addEventListener('click', () => {
  const order = selectedOrder();
  if (!order) return;
  try {
    const result = store.requestRefund(order.id, {
      expectedVersion: order.version,
      amount: Number(el.refundAmount.value),
      reason: el.refundReason.value,
      note: el.refundNote.value,
      actor: actor()
    });
    setMessage(result.refund.requiresApproval ? '환불 요청 완료 · ADMIN 승인 큐로 이동했습니다.' : '환불 요청 완료 · 일반 검토 큐로 이동했습니다.');
    el.refundNote.value = '';
  } catch (error) {
    setMessage(error instanceof Error ? error.message : '환불 요청 실패', true);
  }
  render();
});

render();
