const $ = id => document.getElementById(id);
const STATUS_LABELS = Object.freeze({
  PENDING: '접수 대기',
  CONTACTED: '고객 확인',
  CLOSED: '상담 종료'
});
const HANDOFF_LABELS = Object.freeze({
  PENDING: '방문 요청 전달 중',
  COMPLETED: '현장 운영 전달 완료'
});
const AUDIT_LABELS = Object.freeze({
  STATUS_CHANGE: '상담 상태 변경',
  VISIT_REQUEST_PREPARED: '방문 요청 준비',
  VISIT_REQUEST_CREATED: '현장 운영 전달'
});

const node = (tag, cls = '', text = '') => {
  const value = document.createElement(tag);
  if (cls) value.className = cls;
  if (text) value.textContent = text;
  return value;
};

function fmt(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(value));
}

function safeError(error, fallback = '상담 업무를 처리하지 못했습니다.') {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function mountInquiryDesk({ adapter, principal, onVisitCreated = () => {}, onCount = () => {} }) {
  const el = {
    search: $('inquiry-search'),
    statusFilter: $('inquiry-status-filter'),
    list: $('inquiry-list'),
    empty: $('inquiry-empty'),
    detail: $('inquiry-detail'),
    status: $('inquiry-detail-status'),
    title: $('inquiry-detail-title'),
    meta: $('inquiry-detail-meta'),
    contact: $('inquiry-contact'),
    context: $('inquiry-context'),
    copy: $('inquiry-detail-copy'),
    handoff: $('inquiry-handoff'),
    audits: $('inquiry-audits'),
    message: $('inquiry-message'),
    contacted: $('inquiry-contacted'),
    close: $('inquiry-close'),
    address: $('visit-address'),
    summary: $('visit-summary'),
    priority: $('visit-priority'),
    visit: $('visit-create')
  };

  if (!el.list || !el.detail) return { refresh: async () => {}, select: async () => {}, destroy: () => {} };

  const state = { items: [], selectedId: null, selected: null, audits: [] };

  function message(copy, error = false) {
    if (!el.message) return;
    el.message.textContent = copy || '';
    el.message.dataset.error = error ? 'true' : 'false';
  }

  function visibleItems() {
    const query = String(el.search?.value || '').trim().toLowerCase();
    const status = String(el.statusFilter?.value || '');
    return state.items.filter(item => !status || item.status === status).filter(item => {
      if (!query) return true;
      return [item.id, item.company, item.name, item.phone, item.service, item.detail]
        .some(value => String(value || '').toLowerCase().includes(query));
    });
  }

  function renderList() {
    const items = visibleItems();
    el.list.replaceChildren();
    for (const item of items) {
      const button = node('button', `inquiry-card${item.id === state.selectedId ? ' active' : ''}`);
      button.type = 'button';
      button.setAttribute('aria-label', `${item.company} ${STATUS_LABELS[item.status] || item.status}`);
      const head = node('div', 'inquiry-card-head');
      head.append(node('strong', '', item.company), node('span', `inquiry-state ${item.status}`, STATUS_LABELS[item.status] || item.status));
      button.append(
        head,
        node('p', '', item.detail || item.service || '상담 내용 확인'),
        node('small', '', `${item.id} · ${item.name || '담당자'} · ${fmt(item.createdAt)}`)
      );
      button.addEventListener('click', () => select(item.id));
      el.list.append(button);
    }
    if (!items.length) el.list.append(node('div', 'empty compact', '조건에 맞는 상담 요청이 없습니다.'));
  }

  function renderAudits() {
    if (!el.audits) return;
    el.audits.replaceChildren();
    for (const audit of state.audits.slice(0, 12)) {
      const row = node('article', 'inquiry-audit-row');
      const title = AUDIT_LABELS[audit.action] || (audit.toStatus ? `${STATUS_LABELS[audit.toStatus] || audit.toStatus}` : '상담 변경');
      row.append(node('strong', '', title), node('span', '', `${audit.actor || 'system'} · ${fmt(audit.createdAt)}`));
      el.audits.append(row);
    }
    if (!state.audits.length) el.audits.append(node('div', 'empty compact', '아직 변경 이력이 없습니다.'));
  }

  function line(label, value) {
    const div = node('div');
    div.append(node('dt', '', label), node('dd', '', value));
    return div;
  }

  function renderDetail() {
    const item = state.selected;
    el.empty.hidden = Boolean(item);
    el.detail.hidden = !item;
    if (!item) return;

    if (el.status) {
      el.status.textContent = STATUS_LABELS[item.status] || item.status;
      el.status.className = `inquiry-state ${item.status}`;
    }
    if (el.title) el.title.textContent = `${item.company} · ${item.id}`;
    if (el.meta) el.meta.textContent = `${item.service || '서비스 상담'} · 접수 ${fmt(item.createdAt)} · v${item.version}`;
    if (el.contact) {
      el.contact.replaceChildren(
        line('담당자', item.name || '-'),
        line('연락처', item.phone || '-'),
        line('이메일', item.email || '-')
      );
    }
    if (el.context) {
      el.context.replaceChildren(
        line('업종', item.industry || '-'),
        line('사업장', item.sites || '-'),
        line('장비 수', item.assets || '-'),
        line('업무 영향', item.impact || '-'),
        line('이용 방식', item.engagement || '-')
      );
    }
    if (el.copy) el.copy.textContent = item.detail || '-';

    if (el.handoff) {
      const handoff = item.handoff;
      if (!handoff) {
        el.handoff.textContent = '아직 현장 방문 요청이 만들어지지 않았습니다.';
      } else {
        el.handoff.replaceChildren(
          node('strong', '', HANDOFF_LABELS[handoff.state] || handoff.state),
          node('span', '', handoff.fieldJobId ? `Field Job #${handoff.fieldJobId}` : '현장 운영 전달 대기'),
          node('small', '', `${handoff.address || ''}${handoff.summary ? ` · ${handoff.summary}` : ''}`)
        );
      }
    }

    const canContact = item.status === 'PENDING';
    const canVisit = item.status === 'CONTACTED' && !item.handoff;
    const canClose = item.status !== 'CLOSED';
    if (el.contacted) el.contacted.disabled = !canContact;
    if (el.visit) el.visit.disabled = !canVisit;
    if (el.close) el.close.disabled = !canClose;
    if (el.priority) {
      const urgent = [...el.priority.options].find(option => option.value === 'URGENT');
      if (urgent) urgent.disabled = principal?.role !== 'ADMIN';
      if (principal?.role !== 'ADMIN' && el.priority.value === 'URGENT') el.priority.value = 'NORMAL';
    }
    if (canVisit) {
      if (el.summary && !el.summary.value) el.summary.value = item.detail || item.service || '';
    } else {
      if (el.address) el.address.value = item.handoff?.address || '';
      if (el.summary) el.summary.value = item.handoff?.summary || item.detail || '';
      if (el.priority) el.priority.value = item.handoff?.priority || 'NORMAL';
    }
    renderAudits();
  }

  async function select(id) {
    state.selectedId = id;
    renderList();
    message('');
    try {
      const [item, audits] = await Promise.all([adapter.get(id), adapter.audits(id)]);
      state.selected = item;
      state.audits = audits.items || [];
      renderDetail();
    } catch (error) {
      state.selected = null;
      renderDetail();
      message(safeError(error, '상담 요청을 불러오지 못했습니다.'), true);
    }
  }

  async function refresh({ preserveSelection = true } = {}) {
    try {
      const payload = await adapter.list();
      state.items = payload.items || [];
      onCount(state.items.filter(item => item.status !== 'CLOSED').length);
      renderList();
      const nextId = preserveSelection && state.selectedId && state.items.some(item => item.id === state.selectedId)
        ? state.selectedId
        : (state.items.find(item => item.status !== 'CLOSED') || state.items[0])?.id;
      if (nextId) await select(nextId);
      else {
        state.selectedId = null;
        state.selected = null;
        state.audits = [];
        renderDetail();
      }
    } catch (error) {
      message(safeError(error, '상담 접수함을 불러오지 못했습니다.'), true);
      throw error;
    }
  }

  async function run(action) {
    const item = state.selected;
    if (!item) return;
    message('');
    try {
      if (action === 'contacted') {
        await adapter.contacted(item.id, item.version);
        message('고객 연락 확인 상태로 변경했습니다.');
      } else if (action === 'visit') {
        const address = String(el.address?.value || '').trim();
        const summary = String(el.summary?.value || '').trim();
        const priority = String(el.priority?.value || 'NORMAL');
        if (address.length < 5) throw new Error('확인된 방문 주소를 입력해 주세요.');
        if (summary.length < 5) throw new Error('기사에게 전달할 요청 내용을 입력해 주세요.');
        if (priority === 'URGENT' && principal?.role !== 'ADMIN') throw new Error('긴급 방문 요청은 운영 관리자 권한이 필요합니다.');
        const result = await adapter.visit(item.id, item.version, { address, summary, priority });
        message(`방문 요청을 생성했습니다.${result.fieldJob?.id ? ` Field Job #${result.fieldJob.id}` : ''}`);
        if (result.fieldJob) onVisitCreated(result.fieldJob);
      } else if (action === 'close') {
        if (!window.confirm('이 상담 요청을 종료하시겠습니까?')) return;
        await adapter.close(item.id, item.version);
        message('상담 요청을 종료했습니다.');
      }
      await refresh();
    } catch (error) {
      message(safeError(error), true);
      if (error?.code === 'STALE_INQUIRY') await refresh();
    }
  }

  const onSearch = () => renderList();
  el.search?.addEventListener('input', onSearch);
  el.statusFilter?.addEventListener('change', onSearch);
  el.contacted?.addEventListener('click', () => run('contacted'));
  el.visit?.addEventListener('click', () => run('visit'));
  el.close?.addEventListener('click', () => run('close'));

  return {
    refresh,
    select,
    destroy() {
      el.search?.removeEventListener('input', onSearch);
      el.statusFilter?.removeEventListener('change', onSearch);
    }
  };
}
