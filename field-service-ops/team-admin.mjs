const $ = id => document.getElementById(id);
const node = (tag, cls = '', text = '') => {
  const value = document.createElement(tag);
  if (cls) value.className = cls;
  if (text) value.textContent = text;
  return value;
};

function safeError(error, fallback = '직원 계정을 처리하지 못했습니다.') {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function mountTeamAdmin({ adapter, currentUserId }) {
  const el = {
    list: $('team-list'),
    empty: $('team-empty'),
    detail: $('team-detail'),
    title: $('team-user-title'),
    name: $('team-name'),
    team: $('team-team'),
    agent: $('team-agent'),
    role: $('team-role'),
    active: $('team-active'),
    save: $('team-save'),
    password: $('team-password'),
    reset: $('team-reset-password'),
    message: $('team-message'),
    createForm: $('team-create-form'),
    newId: $('new-user-id'),
    newUsername: $('new-user-username'),
    newName: $('new-user-name'),
    newTeam: $('new-user-team'),
    newAgent: $('new-user-agent'),
    newRole: $('new-user-role'),
    newPassword: $('new-user-password'),
    audits: $('team-auth-audits')
  };
  if (!el.list) return { refresh: async () => {} };

  const state = { items: [], selectedId: null, audits: [], agents: [] };

  function message(copy, error = false) {
    if (!el.message) return;
    el.message.textContent = copy || '';
    el.message.dataset.error = error ? 'true' : 'false';
  }

  function selected() {
    return state.items.find(item => item.id === state.selectedId) || null;
  }

  function renderList() {
    el.list.replaceChildren();
    for (const user of state.items) {
      const button = node('button', `team-user-card${user.id === state.selectedId ? ' active' : ''}${user.active ? '' : ' disabled'}`);
      button.type = 'button';
      const head = node('div', 'team-user-card-head');
      head.append(node('strong', '', user.name), node('span', `team-role-badge ${user.role}`, user.role === 'ADMIN' ? '운영 관리자' : '배차 담당자'));
      button.append(
        head,
        node('p', '', `${user.username} · ${user.team || '운영팀'}${user.agentId ? ` · ${state.agents.find(agent => Number(agent.id) === Number(user.agentId))?.name || `기사 #${user.agentId}`}` : ''}`),
        node('small', '', user.active ? (user.id === currentUserId ? '현재 로그인 계정' : '사용 중') : '비활성화')
      );
      button.addEventListener('click', () => {
        state.selectedId = user.id;
        renderList();
        renderDetail();
      });
      el.list.append(button);
    }
    if (!state.items.length) el.list.append(node('div', 'empty compact', '등록된 직원 계정이 없습니다.'));
  }

  function fillAgentSelect(select, selectedValue = '') {
    if (!select) return;
    const current = String(selectedValue || '');
    select.replaceChildren();
    const none = document.createElement('option'); none.value = ''; none.textContent = '운영/배차 전용'; select.append(none);
    for (const agent of state.agents.filter(item => item.active !== false)) {
      const option = document.createElement('option'); option.value = String(agent.id); option.textContent = `${agent.name}${agent.region ? ` · ${agent.region}` : ''}`; select.append(option);
    }
    if ([...select.options].some(option => option.value === current)) select.value = current;
  }

  function renderDetail() {
    const user = selected();
    if (el.empty) el.empty.hidden = Boolean(user);
    if (el.detail) el.detail.hidden = !user;
    if (!user) return;
    if (el.title) el.title.textContent = `${user.name} · ${user.username}`;
    if (el.name) el.name.value = user.name;
    if (el.team) el.team.value = user.team || '';
    fillAgentSelect(el.agent, user.agentId || '');
    if (el.role) el.role.value = user.role;
    if (el.active) {
      el.active.checked = Boolean(user.active);
      el.active.disabled = user.id === currentUserId;
    }
    if (el.role) el.role.disabled = user.id === currentUserId && user.role === 'ADMIN';
    if (el.password) el.password.value = '';
  }

  function renderAudits() {
    if (!el.audits) return;
    el.audits.replaceChildren();
    for (const audit of state.audits.slice(0, 20)) {
      const row = node('article', 'team-audit-row');
      row.append(
        node('strong', '', audit.action || '계정 변경'),
        node('span', '', `${audit.actor || 'system'} · ${new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(audit.createdAt))}`)
      );
      if (audit.detail) row.append(node('p', '', audit.detail));
      el.audits.append(row);
    }
    if (!state.audits.length) el.audits.append(node('div', 'empty compact', '계정 변경 이력이 없습니다.'));
  }

  async function refresh({ preserveSelection = true } = {}) {
    try {
      const [users, audits, agents] = await Promise.all([adapter.listUsers(), adapter.authAudits(), adapter.listAgents ? adapter.listAgents() : Promise.resolve({ items: [] })]);
      state.items = users.items || [];
      state.audits = audits.items || [];
      state.agents = agents.items || [];
      fillAgentSelect(el.newAgent, el.newAgent?.value || '');
      if (!preserveSelection || !state.items.some(user => user.id === state.selectedId)) {
        state.selectedId = state.items.find(user => user.id === currentUserId)?.id || state.items[0]?.id || null;
      }
      renderList();
      renderDetail();
      renderAudits();
    } catch (error) {
      message(safeError(error, '직원 계정 목록을 불러오지 못했습니다.'), true);
      throw error;
    }
  }

  el.save?.addEventListener('click', async () => {
    const user = selected();
    if (!user) return;
    message('');
    try {
      await adapter.updateUser(user.id, {
        name: String(el.name?.value || '').trim(),
        team: String(el.team?.value || '').trim(),
        agentId: el.agent?.value ? Number(el.agent.value) : null,
        role: String(el.role?.value || 'STAFF'),
        active: Boolean(el.active?.checked)
      });
      message('직원 계정을 저장했습니다.');
      await refresh();
    } catch (error) {
      message(safeError(error), true);
    }
  });

  el.reset?.addEventListener('click', async () => {
    const user = selected();
    const password = String(el.password?.value || '');
    if (!user) return;
    if (password.length < 10) {
      message('새 비밀번호는 10자 이상 입력해 주세요.', true);
      return;
    }
    if (!window.confirm(`${user.name} 계정의 비밀번호를 재설정하시겠습니까? 기존 세션은 종료됩니다.`)) return;
    try {
      await adapter.resetPassword(user.id, password);
      if (el.password) el.password.value = '';
      message('비밀번호를 재설정하고 기존 세션을 종료했습니다.');
      await refresh();
    } catch (error) {
      message(safeError(error), true);
    }
  });

  el.createForm?.addEventListener('submit', async event => {
    event.preventDefault();
    message('');
    const payload = {
      id: String(el.newId?.value || '').trim(),
      username: String(el.newUsername?.value || '').trim(),
      name: String(el.newName?.value || '').trim(),
      team: String(el.newTeam?.value || '').trim(),
      agentId: el.newAgent?.value ? Number(el.newAgent.value) : null,
      role: String(el.newRole?.value || 'STAFF'),
      password: String(el.newPassword?.value || '')
    };
    try {
      const created = await adapter.createUser(payload);
      el.createForm.reset();
      state.selectedId = created.id;
      message('새 직원 계정을 만들었습니다.');
      await refresh();
    } catch (error) {
      message(safeError(error), true);
    }
  });

  return { refresh };
}
