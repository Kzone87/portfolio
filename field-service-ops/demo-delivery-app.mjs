import './demo-app.mjs';
import { mountInquiryDesk } from './inquiry-desk.mjs';
import { mountTeamAdmin } from './team-admin.mjs';

const $ = id => document.getElementById(id);
const CURRENT_USER = Object.freeze({ id: 'ops-admin', username: 'kim.hyunsu', name: '김현수', role: 'ADMIN', team: '서울 운영팀' });
const inquiryBadge = $('inquiry-badge');
const teamTab = $('team-tab');
if (teamTab) teamTab.hidden = false;

function activateWorkspace(name) {
  document.querySelectorAll('[data-workspace-tab]').forEach(button => {
    const active = button.dataset.workspaceTab === name;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  document.querySelectorAll('.workspace-view').forEach(view => { view.hidden = view.id !== `${name}-workspace`; });
  if (name === 'inquiries') inquiryDesk.refresh().catch(() => {});
  if (name === 'team') teamAdmin.refresh().catch(() => {});
}
document.querySelectorAll('[data-workspace-tab]').forEach(button => button.addEventListener('click', () => activateWorkspace(button.dataset.workspaceTab)));

const now = () => new Date().toISOString();
const demoInquiries = [
  {
    id: 'NX-260907-0142',
    company: '감마스튜디오',
    name: '김민지',
    phone: '010-9876-4821',
    email: 'minji@gamma.example',
    industry: '생산·인쇄·제조',
    sites: '1개 사업장',
    assets: '1–5대',
    impact: '처리량·품질에 큰 영향이 생김',
    service: '고장·장애 현장지원',
    engagement: '고장 날 때 현장지원',
    detail: '디지털 인쇄장비 출력 품질이 불안정해 현장 점검이 필요합니다.',
    status: 'PENDING',
    version: 1,
    createdAt: '2026-09-07T08:03:00.000Z',
    updatedAt: '2026-09-07T08:03:00.000Z',
    handoff: null,
    audits: []
  },
  {
    id: 'NX-260907-0188',
    company: '알파오피스',
    name: '박서연',
    phone: '010-4421-7788',
    email: 'sy.park@alpha.example',
    industry: '기업·교육·공공 사무환경',
    sites: '2–5개 사업장',
    assets: '6–20대',
    impact: '대체 장비가 있어 일정 조율 가능',
    service: '정기점검·예방관리',
    engagement: '정기관리 방식 검토',
    detail: '지점별 복합기 점검 일정을 한 번에 관리하고 싶습니다.',
    status: 'CONTACTED',
    version: 2,
    createdAt: '2026-09-07T06:15:00.000Z',
    updatedAt: '2026-09-07T07:10:00.000Z',
    handoff: null,
    audits: [{ action: 'STATUS_CHANGE', actor: 'ops-admin', toStatus: 'CONTACTED', createdAt: '2026-09-07T07:10:00.000Z' }]
  },
  {
    id: 'NX-260906-0094',
    company: '델타리테일',
    name: '이정우',
    phone: '010-3112-5590',
    email: '',
    industry: '유통·프랜차이즈·다지점',
    sites: '6개 이상 사업장',
    assets: '21대 이상',
    impact: '생산·영업 등 핵심 업무가 멈춤',
    service: '여러 사업장 장비관리',
    engagement: '정기관리 방식 검토',
    detail: '여러 지점의 고장 요청과 방문 결과를 본사에서 같이 보고 싶습니다.',
    status: 'CLOSED',
    version: 4,
    createdAt: '2026-09-06T05:30:00.000Z',
    updatedAt: '2026-09-07T04:40:00.000Z',
    handoff: { state: 'COMPLETED', fieldJobId: 4, address: '서울 영등포구 시장로 44', summary: '최종 가동 상태 확인', priority: 'NORMAL' },
    audits: [
      { action: 'VISIT_REQUEST_CREATED', actor: 'ops-admin', createdAt: '2026-09-06T07:00:00.000Z' },
      { action: 'STATUS_CHANGE', actor: 'ops-admin', toStatus: 'CLOSED', createdAt: '2026-09-07T04:40:00.000Z' }
    ]
  }
];

function clone(value) { return structuredClone(value); }
function requireInquiry(id) {
  const item = demoInquiries.find(inquiry => inquiry.id === id);
  if (!item) throw new Error('상담 요청을 찾을 수 없습니다.');
  return item;
}
function version(item, expectedVersion) {
  if (Number(item.version) !== Number(expectedVersion)) {
    const error = new Error('상담 상태가 이미 변경되었습니다.');
    error.code = 'STALE_INQUIRY';
    throw error;
  }
}
const demoInquiryAdapter = {
  async list() { return { items: demoInquiries.map(clone).reverse() }; },
  async get(id) { return clone(requireInquiry(id)); },
  async audits(id) { return { items: clone(requireInquiry(id).audits).reverse() }; },
  async contacted(id, expectedVersion) {
    const item = requireInquiry(id); version(item, expectedVersion);
    if (item.status !== 'PENDING') throw new Error('현재 상태에서는 고객 연락 확인을 처리할 수 없습니다.');
    item.status = 'CONTACTED'; item.version += 1; item.updatedAt = now();
    item.audits.push({ action: 'STATUS_CHANGE', actor: CURRENT_USER.id, toStatus: 'CONTACTED', createdAt: item.updatedAt });
    return clone(item);
  },
  async visit(id, expectedVersion, input) {
    const item = requireInquiry(id); version(item, expectedVersion);
    if (item.status !== 'CONTACTED' || item.handoff) throw new Error('고객 연락 확인 후 방문 요청을 만들 수 있습니다.');
    item.handoff = { state: 'COMPLETED', fieldJobId: 3, address: input.address, summary: input.summary, priority: input.priority };
    item.version += 2; item.updatedAt = now();
    item.audits.push({ action: 'VISIT_REQUEST_PREPARED', actor: CURRENT_USER.id, createdAt: item.updatedAt });
    item.audits.push({ action: 'VISIT_REQUEST_CREATED', actor: CURRENT_USER.id, createdAt: item.updatedAt });
    return { inquiry: clone(item), handoff: clone(item.handoff), fieldJob: { id: 3 } };
  },
  async close(id, expectedVersion) {
    const item = requireInquiry(id); version(item, expectedVersion);
    if (item.status === 'CLOSED') throw new Error('이미 종료된 상담입니다.');
    item.status = 'CLOSED'; item.version += 1; item.updatedAt = now();
    item.audits.push({ action: 'STATUS_CHANGE', actor: CURRENT_USER.id, toStatus: 'CLOSED', createdAt: item.updatedAt });
    return clone(item);
  }
};

const demoUsers = [
  { id: 'ops-admin', username: 'kim.hyunsu', name: '김현수', team: '서울 운영팀', role: 'ADMIN', active: true, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
  { id: 'dispatcher-2', username: 'lee.soyeon', name: '이소연', team: '서울 운영팀', role: 'STAFF', active: true, createdAt: '2026-08-14T00:00:00.000Z', updatedAt: '2026-08-14T00:00:00.000Z' },
  { id: 'dispatcher-3', username: 'park.jun', name: '박준', team: '경기 운영팀', role: 'STAFF', active: false, createdAt: '2026-08-20T00:00:00.000Z', updatedAt: '2026-09-03T00:00:00.000Z' }
];
const demoAuthAudits = [
  { id: 3, userId: 'dispatcher-3', actor: 'ops-admin', action: 'USER_UPDATE', detail: 'STAFF · disabled', createdAt: '2026-09-03T03:12:00.000Z' },
  { id: 2, userId: 'dispatcher-2', actor: 'ops-admin', action: 'USER_CREATE', detail: 'lee.soyeon · STAFF', createdAt: '2026-08-14T01:05:00.000Z' },
  { id: 1, userId: 'ops-admin', actor: 'bootstrap', action: 'USER_CREATE', detail: 'kim.hyunsu · ADMIN', createdAt: '2026-08-01T00:00:00.000Z' }
];
const demoTeamAdapter = {
  async listUsers() { return { items: clone(demoUsers) }; },
  async authAudits() { return { items: clone(demoAuthAudits) }; },
  async createUser(input) {
    if (demoUsers.some(user => user.id === input.id || user.username === String(input.username).toLowerCase())) throw new Error('이미 사용 중인 계정입니다.');
    if (String(input.password || '').length < 10) throw new Error('비밀번호는 10자 이상이어야 합니다.');
    const item = { id: input.id, username: String(input.username).toLowerCase(), name: input.name, team: input.team, role: input.role, active: true, createdAt: now(), updatedAt: now() };
    demoUsers.push(item); demoAuthAudits.unshift({ id: Date.now(), userId: item.id, actor: CURRENT_USER.id, action: 'USER_CREATE', detail: `${item.username} · ${item.role}`, createdAt: now() });
    return clone(item);
  },
  async updateUser(id, input) {
    const item = demoUsers.find(user => user.id === id); if (!item) throw new Error('직원 계정을 찾을 수 없습니다.');
    if (item.id === CURRENT_USER.id && input.active === false) throw new Error('현재 로그인 계정은 비활성화할 수 없습니다.');
    Object.assign(item, { name: input.name, team: input.team, role: input.role, active: input.active, updatedAt: now() });
    demoAuthAudits.unshift({ id: Date.now(), userId: item.id, actor: CURRENT_USER.id, action: 'USER_UPDATE', detail: `${item.role} · ${item.active ? 'active' : 'disabled'}`, createdAt: now() });
    return clone(item);
  },
  async resetPassword(id, password) {
    if (String(password || '').length < 10) throw new Error('비밀번호는 10자 이상이어야 합니다.');
    const item = demoUsers.find(user => user.id === id); if (!item) throw new Error('직원 계정을 찾을 수 없습니다.');
    demoAuthAudits.unshift({ id: Date.now(), userId: item.id, actor: CURRENT_USER.id, action: 'PASSWORD_RESET', detail: '', createdAt: now() });
    return clone(item);
  }
};

const inquiryDesk = mountInquiryDesk({
  adapter: demoInquiryAdapter,
  principal: CURRENT_USER,
  onCount: count => { if (inquiryBadge) inquiryBadge.textContent = String(count); },
  onVisitCreated: fieldJob => {
    activateWorkspace('dispatch');
    queueMicrotask(() => {
      const target = [...document.querySelectorAll('#job-list .job-card')].find(button => button.textContent.includes(`#${fieldJob.id}`));
      target?.click();
    });
  }
});
const teamAdmin = mountTeamAdmin({ adapter: demoTeamAdapter, currentUserId: CURRENT_USER.id });

inquiryDesk.refresh().catch(() => {});
