const PROJECTS = {
  feature: {
    label: '작은 기능 / 기존 서비스 보완',
    base: 1,
    phase: '변경 대상 기능 1개와 영향 범위를 먼저 고정하고 구현·검증합니다.'
  },
  excel: {
    label: 'Excel / CSV 업무자동화',
    base: 2,
    phase: '대표 입력 파일 1종을 기준으로 Import → 검증 → 정리 → Export 핵심 흐름부터 완성합니다.'
  },
  admin: {
    label: '관리자페이지 / 업무관리 시스템',
    base: 2,
    phase: '핵심 데이터 1~2개와 CRUD·검색·주요 상태 처리부터 1차 운영 버전으로 만듭니다.'
  },
  ai: {
    label: 'AI Workflow / 업무자동화',
    base: 2,
    phase: 'AI가 처리할 업무 1개를 정하고 Input → Structured Output → Human Review 핵심 흐름부터 검증합니다.'
  },
  integration: {
    label: 'REST API / 시스템 연동',
    base: 2,
    phase: 'Source → Target 한 방향의 핵심 데이터 흐름과 실패 처리부터 검증합니다.'
  }
};

const PACKAGE_LEVELS = [
  { max: 1, name: 'STANDARD', budget: '49~99만원', note: '범위가 명확한 작은 기능 또는 단일 자동화에 적합합니다.' },
  { max: 3, name: 'DELUXE', budget: '149~299만원', note: '하나의 업무 흐름을 실제 사용 가능한 도구로 구현하는 범위입니다.' },
  { max: 5, name: 'PREMIUM', budget: '299~499만원', note: '여러 데이터 관계·권한·상태·AI/연동이 함께 필요한 운영 시스템 범위입니다.' },
  { max: Infinity, name: 'CUSTOM', budget: '499만원 이상', note: '복수 모듈·고급 권한·대규모 연동을 단계별 프로젝트로 나누는 편이 적합합니다.' }
];

const ALLOWED = {
  projectType: new Set(Object.keys(PROJECTS)),
  existing: new Set(['new', 'existing']),
  roles: new Set(['single', 'multi']),
  data: new Set(['simple', 'relational']),
  integrations: new Set(['none', 'one', 'multiple']),
  operation: new Set(['basic', 'advanced']),
  schedule: new Set(['normal', 'urgent'])
};

export function sanitizeScopeInput(value = {}) {
  const output = {};
  for (const [key, allowed] of Object.entries(ALLOWED)) {
    const candidate = typeof value[key] === 'string' ? value[key] : '';
    output[key] = allowed.has(candidate) ? candidate : [...allowed][0];
  }
  return output;
}

export function evaluateScope(rawInput) {
  const input = sanitizeScopeInput(rawInput);
  const project = PROJECTS[input.projectType];
  let score = project.base;
  const reasons = [];

  if (input.projectType === 'ai') {
    reasons.push('AI output schema와 사람의 승인 지점 정의 필요');
  }
  if (input.existing === 'existing') {
    score += 1;
    reasons.push('기존 소스 분석과 회귀 확인 필요');
  }
  if (input.roles === 'multi') {
    score += 1;
    reasons.push('복수 사용자 역할/권한 필요');
  }
  if (input.data === 'relational') {
    score += 1;
    reasons.push('여러 데이터 관계 필요');
  }
  if (input.integrations === 'one') {
    score += 1;
    reasons.push(input.projectType === 'ai' ? 'AI provider/API 연동 1개' : '외부 서비스/API 연동 1개');
  } else if (input.integrations === 'multiple') {
    score += 2;
    reasons.push(input.projectType === 'ai' ? '복수 AI/외부 provider 연동' : '복수 외부 서비스/API 연동');
  }
  if (input.operation === 'advanced') {
    score += 1;
    reasons.push(input.projectType === 'ai' ? 'Evaluation/Audit/Fallback 등 운영 고도화' : 'Audit/실시간/대량처리 등 운영 고도화');
  }
  if (input.schedule === 'urgent') {
    score += 1;
    reasons.push('일정 제약이 큰 프로젝트');
  }

  const packageInfo = PACKAGE_LEVELS.find((item) => score <= item.max);
  return {
    input,
    score,
    projectLabel: project.label,
    packageName: packageInfo.name,
    budget: packageInfo.budget,
    packageNote: packageInfo.note,
    firstPhase: project.phase,
    reasons: reasons.length ? reasons : ['복잡도 추가 조건이 적은 기본 범위']
  };
}

export function buildBrief(result) {
  const i = result.input;
  const labels = {
    existing: i.existing === 'existing' ? '기존 시스템 수정' : '신규 개발',
    roles: i.roles === 'multi' ? '복수 역할/권한' : '단일 관리자 중심',
    data: i.data === 'relational' ? '관계형 데이터 여러 개' : '단순 데이터 구조',
    integrations: i.integrations === 'none' ? '외부 연동 없음' : i.integrations === 'one' ? '외부 연동 1개' : '외부 연동 여러 개',
    operation: i.operation === 'advanced' ? '운영 고도화 필요' : '기본 운영 기능',
    schedule: i.schedule === 'urgent' ? '일정 제약 큼' : '일반 일정'
  };

  return [
    '[1차 개발 범위 문의]',
    `프로젝트 유형: ${result.projectLabel}`,
    `개발 형태: ${labels.existing}`,
    `사용자/권한: ${labels.roles}`,
    `데이터 구조: ${labels.data}`,
    `외부 연동: ${labels.integrations}`,
    `운영 요구: ${labels.operation}`,
    `일정: ${labels.schedule}`,
    '',
    `예상 패키지 가이드: ${result.packageName}`,
    `예산 참고 구간: ${result.budget}`,
    `추천 1차 범위: ${result.firstPhase}`,
    '',
    '현재 업무 방식:',
    '가장 불편한 점:',
    '개발 후 반드시 가능해야 하는 결과:'
  ].join('\n');
}

export const scopeCatalog = Object.freeze({
  projectTypes: Object.fromEntries(Object.entries(PROJECTS).map(([key, value]) => [key, value.label])),
  packages: PACKAGE_LEVELS.map(({ name, budget }) => ({ name, budget }))
});
