(() => {
  const repo = 'https://github.com/Kzone87/portfolio';
  const evidence = Object.freeze([
    {
      id: 'nexa', name: 'NEXA SERVICE SUITE', audience: 'Customer + Portal + Field Ops',
      live: './nexa-tech-service/', source: `${repo}/tree/main/nexa-tech-service`, tests: `${repo}/blob/main/test/nexa-bundle-100.test.mjs`, ci: `${repo}/actions`, qa: `${repo}/blob/main/.github/workflows/nexa-live-pages-qa.yml`
    },
    {
      id: 'booking', name: 'BOOKING CRM', audience: 'Customer Booking + Staff CRM',
      live: './booking-crm/', source: `${repo}/tree/main/booking-crm`, tests: `${repo}/blob/main/test/booking-crm.test.mjs`, ci: `${repo}/actions`, qa: `${repo}/blob/main/.github/workflows/booking-crm-live-qa.yml`
    },
    {
      id: 'mono', name: 'MONO OPERATIONS', audience: 'Back-office Operations Suite',
      live: './mono-operations/', source: `${repo}/tree/main/mono-operations`, tests: `${repo}/blob/main/test/mono-commercial-http.test.mjs`, ci: `${repo}/actions`, qa: `${repo}/blob/main/.github/workflows/mono-commercial-runtime-qa.yml`
    },
    {
      id: 'excel', name: 'EXCEL WORKBENCH', audience: 'Local-first Data Workbench',
      live: 'https://kzone87.github.io/customer-map-planner/', source: 'https://github.com/Kzone87/customer-map-planner', tests: 'https://github.com/Kzone87/customer-map-planner/tree/main/src', ci: 'https://github.com/Kzone87/customer-map-planner/actions', qa: 'https://github.com/Kzone87/customer-map-planner/actions'
    },
    {
      id: 'ops', name: 'OPS KIT', audience: 'Local-first Operations Utilities',
      live: './mini-labs/', source: `${repo}/tree/main/mini-labs`, tests: `${repo}/tree/main/test`, ci: `${repo}/actions`, qa: `${repo}/blob/main/.github/workflows/ops-kit-live-pages-qa.yml`
    }
  ]);

  function externalAttrs(href) {
    return href.startsWith('https://') ? ' target="_blank" rel="noreferrer"' : '';
  }

  function proofCard(item) {
    const stages = [
      ['01', 'LIVE', '실제 실행 화면', item.live],
      ['02', 'SOURCE', '구현 코드', item.source],
      ['03', 'TESTS', '도메인·회귀 검증', item.tests],
      ['04', 'CI', '자동 검증 기록', item.ci],
      ['05', 'DEPLOY QA', '배포본 검증', item.qa]
    ];
    return `<article class="proof-center-card" data-proof-product="${item.id}">
      <header><span>${item.audience}</span><h3>${item.name}</h3></header>
      <div class="proof-center-chain">${stages.map(([number, label, copy, href]) => `<a href="${href}"${externalAttrs(href)}><i>${number}</i><b>${label}</b><small>${copy}</small><em aria-hidden="true">→</em></a>`).join('')}</div>
    </article>`;
  }

  function addProofCenter() {
    if (document.getElementById('proof-center')) return;
    const evidenceSection = document.getElementById('evidence');
    if (!evidenceSection) return;
    const section = document.createElement('section');
    section.id = 'proof-center';
    section.className = 'proof-center-section';
    section.innerHTML = `<div class="shell">
      <div class="proof-center-heading">
        <div><span>PROOF CENTER · VERIFY, DON'T TRUST</span><h2>설명 대신 5단계 증거로 확인하세요.</h2></div>
        <p>각 제품을 <strong>Live → Source → Tests → CI → Deployment QA</strong> 순서로 바로 검증할 수 있습니다. 공개 시연 데이터와 실제 고객 실적은 명확히 구분합니다.</p>
      </div>
      <div class="proof-center-grid">${evidence.map(proofCard).join('')}</div>
    </div>`;
    evidenceSection.insertAdjacentElement('beforebegin', section);
  }

  function addRecruiterPath() {
    if (document.getElementById('recruiter-path')) return;
    const featured = document.getElementById('featured');
    if (!featured) return;
    const nexa = document.querySelector('.nexa-showcase');
    const mono = document.querySelector('.mono-portfolio-featured') || document.querySelector('.mono-case');
    if (nexa) nexa.id = 'recruiter-nexa';
    if (mono) mono.id = 'recruiter-mono';

    const section = document.createElement('section');
    section.id = 'recruiter-path';
    section.className = 'recruiter-path-section';
    section.innerHTML = `<div class="shell recruiter-path-shell">
      <div class="recruiter-path-copy">
        <span>RECRUITER 90-SECOND FLOW</span>
        <h2>90초면 핵심 개발 역량을 검토할 수 있습니다.</h2>
        <p>프로젝트 개수를 세는 대신, <strong>업무 흐름 설계 → 복합 운영 제어 → 검증 근거</strong>의 세 장면만 보도록 압축했습니다.</p>
      </div>
      <ol class="recruiter-path-list">
        <li data-recruiter-step="1"><a href="#recruiter-nexa"><i>01 · 35 SEC</i><b>NEXA</b><span>고객 요청이 직원 운영과 현장 완료까지 이어지는 end-to-end 흐름</span><em>확인하기 →</em></a></li>
        <li data-recruiter-step="2"><a href="#recruiter-mono"><i>02 · 35 SEC</i><b>MONO</b><span>주문·문서·지원·연동을 권한·감사·복구까지 포함해 운영하는 구조</span><em>확인하기 →</em></a></li>
        <li data-recruiter-step="3"><a href="#proof-center"><i>03 · 20 SEC</i><b>PROOF</b><span>Live · Source · Tests · CI · Deployment QA가 실제로 연결되는지 검증</span><em>확인하기 →</em></a></li>
      </ol>
    </div>`;
    featured.insertAdjacentElement('beforebegin', section);
  }

  function addCaseStudies() {
    if (document.getElementById('case-studies')) return;
    const proof = document.getElementById('proof-center');
    if (!proof) return;
    const section = document.createElement('section');
    section.id = 'case-studies';
    section.className = 'case-study-section';
    section.innerHTML = `<div class="shell">
      <div class="case-study-heading"><span>EVIDENCE-DRIVEN CASE STUDIES</span><h2>무엇을 만들었는지가 아니라 왜 그렇게 설계했는지 보여줍니다.</h2><p>과장된 성과 숫자 대신 문제, 설계 판단, 까다로운 예외, 구현 방식, 검증 근거를 연결합니다.</p></div>
      <div class="case-study-grid">
        <article>
          <header><span>CASE 01</span><h3>NEXA · 서비스 요청부터 현장 완료까지</h3></header>
          <dl>
            <div><dt>PROBLEM</dt><dd>고객 상담, 일정 요청, 직원 배정, 현장 작업이 분리되면 상태와 책임이 끊깁니다.</dd></div>
            <div><dt>DECISION</dt><dd>고객·기존 고객·직원 화면은 분리하되 request와 field job을 같은 상태 흐름으로 연결했습니다.</dd></div>
            <div><dt>HARD EDGE</dt><dd>중복 요청, 일정 충돌, stale version, 권한 경계, 실패한 Field Ops handoff를 정상 흐름만큼 중요하게 다뤘습니다.</dd></div>
            <div><dt>IMPLEMENTATION</dt><dd>SQLite persistence, server-side identity/RBAC, optimistic version, idempotency, audit, backup/restore를 결합했습니다.</dd></div>
            <div><dt>VERIFICATION</dt><dd>고객 → 직원 → 현장 → 고객 복귀 E2E와 same-SHA Pages Chrome QA로 실제 배포본을 확인합니다.</dd></div>
          </dl>
          <div class="case-study-actions"><a href="./nexa-tech-service/">Live Product →</a><a href="${repo}/blob/main/test/nexa-bundle-100.test.mjs" target="_blank" rel="noreferrer">E2E Evidence ↗</a></div>
        </article>
        <article>
          <header><span>CASE 02</span><h3>MONO · 복합 Back-office를 하나의 운영 경계로</h3></header>
          <dl>
            <div><dt>PROBLEM</dt><dd>주문, 문서, 고객지원, 데이터 연동이 따로 움직이면 권한·감사·복구 방식도 제각각이 됩니다.</dd></div>
            <div><dt>DECISION</dt><dd>도메인 모듈은 분리하면서 직원 세션, RBAC, audit, versioning과 운영 Inbox를 공통 경계로 통합했습니다.</dd></div>
            <div><dt>HARD EDGE</dt><dd>고위험 환불 승인, 리뷰 역할 분리, AI human review, webhook 중복, retry와 dead-letter를 명시적 상태로 만들었습니다.</dd></div>
            <div><dt>IMPLEMENTATION</dt><dd>HttpOnly session, CSRF, SQLite, HMAC, encrypted secret, persistent retry queue, backup/restore를 사용합니다.</dd></div>
            <div><dt>VERIFICATION</dt><dd>상용 HTTP runtime 회귀 테스트와 실제 Chrome runtime QA를 함께 통과해야 납품 가능 상태로 봅니다.</dd></div>
          </dl>
          <div class="case-study-actions"><a href="./mono-operations/">Live Product →</a><a href="${repo}/blob/main/test/mono-commercial-http.test.mjs" target="_blank" rel="noreferrer">Runtime Evidence ↗</a></div>
        </article>
      </div>
    </div>`;
    proof.insertAdjacentElement('afterend', section);
  }

  function installStyles() {
    if (document.getElementById('portfolio-proof-center-style')) return;
    const style = document.createElement('style');
    style.id = 'portfolio-proof-center-style';
    style.textContent = `
      .recruiter-path-section,.proof-center-section,.case-study-section{padding:72px 0;border-top:1px solid rgba(15,23,42,.08)}
      .recruiter-path-section{background:#0f172a;color:#fff}.recruiter-path-shell{display:grid;grid-template-columns:minmax(250px,.72fr) minmax(0,1.28fr);gap:38px;align-items:start}.recruiter-path-copy>span,.proof-center-heading span,.case-study-heading>span{display:block;margin-bottom:10px;font-size:11px;font-weight:900;letter-spacing:.15em;color:#60a5fa}.recruiter-path-copy h2,.proof-center-heading h2,.case-study-heading h2{margin:0;letter-spacing:-.04em;line-height:1.1;font-size:clamp(28px,4vw,46px)}.recruiter-path-copy p{color:#cbd5e1;line-height:1.75}.recruiter-path-list{display:grid;gap:10px;margin:0;padding:0}.recruiter-path-list li{list-style:none}.recruiter-path-list a{min-height:104px;display:grid;grid-template-columns:100px 100px 1fr auto;align-items:center;gap:16px;padding:18px 20px;border:1px solid rgba(148,163,184,.22);border-radius:18px;background:rgba(255,255,255,.05);color:#fff;text-decoration:none}.recruiter-path-list a:hover{background:rgba(255,255,255,.09)}.recruiter-path-list i{font-style:normal;font-size:10px;letter-spacing:.1em;color:#93c5fd}.recruiter-path-list b{font-size:18px}.recruiter-path-list span{color:#cbd5e1;font-size:13px;line-height:1.55}.recruiter-path-list em{font-style:normal;font-size:12px;font-weight:800;color:#93c5fd}
      .proof-center-section{background:#f8fbff}.proof-center-heading{display:grid;grid-template-columns:1fr .8fr;gap:30px;align-items:end;margin-bottom:28px}.proof-center-heading p,.case-study-heading p{margin:0;color:#526579;line-height:1.75}.proof-center-grid{display:grid;gap:14px}.proof-center-card{padding:22px;border:1px solid #dbe5ef;border-radius:20px;background:#fff;box-shadow:0 12px 36px rgba(15,23,42,.05)}.proof-center-card header{display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin-bottom:16px}.proof-center-card header span{font-size:10px;font-weight:850;letter-spacing:.08em;color:#64748b}.proof-center-card h3{margin:0;font-size:18px;letter-spacing:-.02em}.proof-center-chain{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.proof-center-chain a{position:relative;min-height:96px;display:flex;flex-direction:column;justify-content:center;padding:12px;border:1px solid #e3eaf1;border-radius:12px;text-decoration:none;color:#26384a;background:#fbfdff}.proof-center-chain a:hover{border-color:#93b8e8;background:#f4f9ff}.proof-center-chain i{font-style:normal;font-size:9px;color:#2563eb;font-weight:900}.proof-center-chain b{font-size:11px;margin-top:5px}.proof-center-chain small{font-size:10px;color:#6b7d8f;margin-top:4px;line-height:1.35}.proof-center-chain em{position:absolute;right:8px;top:8px;font-style:normal;color:#94a3b8;font-size:10px}
      .case-study-section{background:#fff}.case-study-heading{max-width:900px;margin-bottom:28px}.case-study-heading h2{margin-bottom:14px}.case-study-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.case-study-grid>article{padding:28px;border-radius:22px;border:1px solid #dce5ee;background:linear-gradient(145deg,#fff,#f9fbfd)}.case-study-grid header span{font-size:10px;color:#2563eb;font-weight:900;letter-spacing:.12em}.case-study-grid h3{font-size:24px;line-height:1.2;letter-spacing:-.03em;margin:8px 0 20px}.case-study-grid dl{display:grid;gap:10px;margin:0}.case-study-grid dl>div{display:grid;grid-template-columns:105px 1fr;gap:12px;padding:12px 0;border-top:1px solid #e8edf2}.case-study-grid dt{font-size:9px;font-weight:900;letter-spacing:.1em;color:#2563eb}.case-study-grid dd{margin:0;color:#526579;font-size:12px;line-height:1.65}.case-study-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:20px}.case-study-actions a{min-height:44px;display:inline-flex;align-items:center;padding:10px 13px;border-radius:10px;background:#0f172a;color:#fff;text-decoration:none;font-size:11px;font-weight:850}.case-study-actions a+ a{background:#eff6ff;color:#1d4ed8}
      .recruiter-path-list a:focus-visible,.proof-center-chain a:focus-visible,.case-study-actions a:focus-visible{outline:3px solid rgba(37,99,235,.48);outline-offset:3px}
      @media(max-width:900px){.recruiter-path-shell,.proof-center-heading,.case-study-grid{grid-template-columns:1fr}.recruiter-path-list a{grid-template-columns:84px 80px 1fr}.recruiter-path-list em{display:none}.proof-center-chain{grid-template-columns:repeat(5,minmax(120px,1fr));overflow-x:auto;padding-bottom:4px}}
      @media(max-width:640px){.recruiter-path-section,.proof-center-section,.case-study-section{padding:48px 0}.recruiter-path-list a{grid-template-columns:1fr;gap:7px;min-height:128px}.proof-center-card{padding:18px}.proof-center-card header{display:block}.proof-center-card h3{margin-top:5px}.proof-center-chain{grid-template-columns:1fr;overflow:visible}.proof-center-chain a{min-height:72px}.case-study-grid>article{padding:21px}.case-study-grid dl>div{grid-template-columns:1fr;gap:5px}}
      @media(prefers-reduced-motion:reduce){.recruiter-path-list a,.proof-center-chain a,.case-study-actions a{scroll-behavior:auto;transition:none}}
    `;
    document.head.append(style);
  }

  function boot() {
    installStyles();
    addRecruiterPath();
    addProofCenter();
    addCaseStudies();
    const nav = document.querySelector('.studio-header nav');
    if (nav && !nav.querySelector('a[href="#proof-center"]')) {
      const evidenceLink = nav.querySelector('a[href="#evidence"]');
      if (evidenceLink) evidenceLink.href = '#proof-center';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
