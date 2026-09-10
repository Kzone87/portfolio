(() => {
  const ROOT = 'https://github.com/Kzone87/portfolio';

  const PROOFS = Object.freeze([
    {
      id: 'nexa',
      name: 'NEXA SERVICE SUITE',
      summary: '고객 상담 → 지원 확인 → 방문 요청 → 기사 배정 → 현장 작업 → 완료까지 연결한 서비스 운영 제품군',
      links: [
        ['Live', './nexa-tech-service/'],
        ['Source', `${ROOT}/tree/main/nexa-tech-service`],
        ['Domain Tests', `${ROOT}/blob/main/test/nexa-bundle-100.test.mjs`],
        ['CI', `${ROOT}/actions/workflows/nexa-live-pages-qa.yml`],
        ['Deployment QA', `${ROOT}/blob/main/scripts/nexa-live-page-qa.mjs`]
      ]
    },
    {
      id: 'booking',
      name: 'BOOKING CRM',
      summary: '예약·문의 접수부터 일정 충돌 방지, 고객 메모, 상태 변경과 관리자 운영까지 연결한 Booking + CRM',
      links: [
        ['Live', './booking-crm/'],
        ['Source', `${ROOT}/tree/main/booking-crm`],
        ['Domain Tests', `${ROOT}/blob/main/test/booking-crm.test.mjs`],
        ['CI', `${ROOT}/actions/workflows/booking-crm-live-qa.yml`],
        ['Deployment QA', `${ROOT}/blob/main/scripts/booking-crm-live-qa.mjs`]
      ]
    },
    {
      id: 'mono',
      name: 'MONO OPERATIONS',
      summary: '주문·문서·지원·데이터 연동을 계정·권한·감사이력과 함께 운영하는 Back-office Operations Suite',
      links: [
        ['Live', './mono-operations/'],
        ['Source', `${ROOT}/tree/main/mono-operations`],
        ['Domain Tests', `${ROOT}/blob/main/test/mono-commercial-http.test.mjs`],
        ['CI', `${ROOT}/actions/workflows/mono-commercial-runtime-qa.yml`],
        ['Deployment QA', `${ROOT}/actions/workflows/mono-live-pages-qa.yml`]
      ]
    },
    {
      id: 'excel',
      name: 'EXCEL WORKBENCH',
      summary: 'XLSX·XLS·CSV 정리, 검증, 비교, 매핑, 다중 파일 Batch를 브라우저에서 수행하는 local-first 데이터 도구',
      links: [
        ['Live', 'https://kzone87.github.io/customer-map-planner/'],
        ['Source', 'https://github.com/Kzone87/customer-map-planner'],
        ['Domain Tests', 'https://github.com/Kzone87/customer-map-planner/tree/main/src'],
        ['CI', 'https://github.com/Kzone87/customer-map-planner/actions'],
        ['Deployment QA', 'https://kzone87.github.io/customer-map-planner/']
      ]
    },
    {
      id: 'ops-kit',
      name: 'OPS KIT',
      summary: 'Content Preflight, Data Extractor, Workflow Dry-Run, Security Check, Release Gate를 제공하는 local-first 운영 유틸리티',
      links: [
        ['Live', './mini-labs/'],
        ['Source', `${ROOT}/tree/main/mini-labs`],
        ['Domain Tests', `${ROOT}/blob/main/test/mini-labs.test.mjs`],
        ['CI', `${ROOT}/actions/workflows/ops-kit-live-pages-qa.yml`],
        ['Deployment QA', `${ROOT}/blob/main/scripts/ops-kit-live-page-qa.mjs`]
      ]
    }
  ]);

  const CASES = Object.freeze([
    {
      id: 'case-nexa',
      name: 'NEXA SERVICE SUITE',
      problem: '신규 고객 상담, 기존 고객 요청, 기사 배차와 현장 작업이 서로 분리되면 상태와 책임이 끊기기 쉽습니다.',
      decision: '고객 요청을 하나의 상태 흐름으로 보고 customer request → field job → customer portal 관계를 설계했습니다.',
      edge: '일정 충돌, stale expectedVersion, 역할별 접근 차단처럼 실제 운영에서 막혀야 하는 조건을 정상 흐름과 같은 수준으로 다뤘습니다.',
      build: 'SQLite persistence, audit, 서버 측 권한 검증, 고객/직원 surface 분리, backup/restore와 delivery build를 구현했습니다.',
      verify: '도메인 테스트와 동일 SHA GitHub Pages E2E로 공개 화면과 구현 증거를 연결합니다.',
      href: './nexa-tech-service/'
    },
    {
      id: 'case-booking',
      name: 'BOOKING CRM',
      problem: '예약을 받는 화면만 있으면 일정 중복, 문의 후속 처리, 고객 메모와 상태 이력이 운영자에게 남지 않습니다.',
      decision: '예약 요청을 Queue로 받고 확정·변경·취소·완료를 상태 전이로 만들며 고객 단위 이력을 연결했습니다.',
      edge: 'slot conflict, capacity guard, optimistic expectedVersion, 인증·CSRF·역할 경계를 서버에서 검증합니다.',
      build: 'Node 24 + SQLite/WAL, HttpOnly session, audit, 직원 운영 API와 납품용 backup/restore·runbook을 구성했습니다.',
      verify: '도메인 테스트, 보안·인수 회귀 테스트, 1440/768/390 실제 Chrome QA를 통과하도록 유지합니다.',
      href: './booking-crm/'
    },
    {
      id: 'case-mono',
      name: 'MONO OPERATIONS',
      problem: '주문·문서·고객지원·연동이 각각 다른 도구에 흩어지면 운영자가 실패와 재처리 원인을 추적하기 어렵습니다.',
      decision: '하나의 직원 계정, 통합 업무함, 모듈별 권한, 감사이력을 공통 운영 축으로 두고 각 도메인을 분리했습니다.',
      edge: '고위험 승인, optimistic version, HMAC webhook, retry queue, dead-letter와 recovery 경로를 명시했습니다.',
      build: 'SQLite runtime, server-side RBAC, CSRF, 암호화된 연결 secret, backup/restore와 commercial delivery artifact를 구현했습니다.',
      verify: 'HTTP/Store/UI 테스트와 commercial runtime QA, live Pages QA를 별도로 운영해 화면과 서버 경계를 함께 검증합니다.',
      href: './mono-operations/'
    }
  ]);

  function isExternal(href) {
    return href.startsWith('https://');
  }

  function link(label, href, className = '') {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = label;
    if (className) a.className = className;
    if (isExternal(href)) {
      a.target = '_blank';
      a.rel = 'noreferrer';
    }
    return a;
  }

  function installStyles() {
    if (document.getElementById('portfolio-quality-style')) return;
    const style = document.createElement('style');
    style.id = 'portfolio-quality-style';
    style.textContent = `
      html{scroll-padding-top:92px}
      [id]{scroll-margin-top:92px}
      .site-header a,.hero-actions a,.proof-links a,.contact-grid a,.profile-link,.portfolio-experience-tab,.portfolio-experience-links a,.quality-cta,.proof-chain a,.recruiter-path a,.case-study-card a{min-height:44px;display:inline-flex;align-items:center}
      a:focus-visible,button:focus-visible,[tabindex]:focus-visible{outline:3px solid #2563eb!important;outline-offset:4px!important;box-shadow:0 0 0 6px rgba(37,99,235,.13)}
      .portfolio-quality-status{display:inline-flex;align-items:center;gap:7px;font-size:11px;font-weight:900;letter-spacing:.07em;color:#1d4ed8}.portfolio-quality-status i{width:8px;height:8px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 4px rgba(34,197,94,.12)}
      .recruiter-path{padding:28px 0 36px;background:#0b1728;color:#e5edf6;border-bottom:1px solid rgba(255,255,255,.08)}
      .recruiter-path-grid{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.5fr);gap:28px;align-items:center}
      .recruiter-path-copy>span,.proof-center-head>div>span,.case-study-head>div>span{display:block;font-size:11px;font-weight:900;letter-spacing:.15em;color:#75a7ff;margin-bottom:10px}
      .recruiter-path h2{margin:0;font-size:clamp(27px,3vw,42px);letter-spacing:-.04em;line-height:1.08;color:#fff}.recruiter-path p{margin:13px 0 0;color:#aebed1;line-height:1.65}
      .recruiter-path-list{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.recruiter-path-card{padding:18px;border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);text-decoration:none;color:#fff;min-width:0}.recruiter-path-card:hover{background:rgba(255,255,255,.075)}.recruiter-path-card b,.recruiter-path-card strong,.recruiter-path-card span{display:block}.recruiter-path-card b{font-size:10px;letter-spacing:.13em;color:#8eb8ff}.recruiter-path-card strong{margin-top:8px;font-size:17px;line-height:1.25}.recruiter-path-card span{margin-top:7px;color:#aebed1;font-size:12px;line-height:1.5}
      .proof-center{padding:72px 0;background:#f8fbff;border-top:1px solid #e4ebf2;border-bottom:1px solid #e4ebf2}.proof-center-head,.case-study-head{display:grid;grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);gap:30px;align-items:end;margin-bottom:28px}.proof-center-head h2,.case-study-head h2{margin:0;font-size:clamp(30px,4vw,52px);letter-spacing:-.045em;line-height:1.05;color:#0f172a}.proof-center-head p,.case-study-head p{margin:0;color:#526579;line-height:1.75}
      .proof-center-grid{display:grid;gap:12px}.proof-product{display:grid;grid-template-columns:minmax(190px,.75fr) minmax(0,1.25fr);gap:22px;padding:22px;border:1px solid #dce6ef;border-radius:20px;background:#fff;box-shadow:0 12px 36px rgba(15,23,42,.045)}.proof-product-name span{display:block;font-size:10px;letter-spacing:.12em;font-weight:900;color:#2563eb}.proof-product-name h3{margin:8px 0 8px;color:#0f172a;font-size:20px;letter-spacing:-.02em}.proof-product-name p{margin:0;color:#607286;font-size:12px;line-height:1.55}.proof-chain{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;align-self:center}.proof-chain a{position:relative;justify-content:center;text-align:center;padding:10px 8px;border-radius:11px;border:1px solid #dbe4ed;background:#f8fafc;color:#26435f;text-decoration:none;font-size:10px;font-weight:900;line-height:1.2}.proof-chain a::before{content:attr(data-step);position:absolute;top:5px;left:7px;font-size:8px;color:#94a3b8}.proof-chain a:hover{border-color:#9ec2ff;background:#eef5ff;color:#1d4ed8}.proof-chain a:first-child{background:#2563eb;border-color:#2563eb;color:#fff}.proof-chain a:first-child::before{color:#bfdbfe}
      .case-studies{padding:72px 0;background:#fff}.case-study-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.case-study-card{border:1px solid #dce5ee;border-radius:22px;padding:24px;background:linear-gradient(180deg,#fff,#f9fbfd);display:flex;flex-direction:column}.case-study-card>span{font-size:10px;font-weight:900;letter-spacing:.12em;color:#2563eb}.case-study-card h3{font-size:24px;letter-spacing:-.035em;line-height:1.12;color:#0f172a;margin:10px 0 18px}.case-study-story{display:grid;gap:12px;flex:1}.case-study-story div{padding-top:11px;border-top:1px solid #e4eaf0}.case-study-story b{display:block;font-size:9px;letter-spacing:.12em;color:#64748b;margin-bottom:4px}.case-study-story p{margin:0;color:#465b70;font-size:12px;line-height:1.6}.case-study-card>a{margin-top:20px;padding:0 12px;border-radius:10px;background:#0f172a;color:#fff;text-decoration:none;justify-content:space-between;font-size:12px;font-weight:850}
      [data-preview-state="deferred"]{background-image:linear-gradient(110deg,rgba(226,232,240,.35) 8%,rgba(248,250,252,.8) 18%,rgba(226,232,240,.35) 33%);background-size:200% 100%;animation:preview-deferred 2.4s linear infinite}[data-preview-state="loaded"]{background-image:none;animation:none}@keyframes preview-deferred{to{background-position-x:-200%}}
      @media(max-width:980px){.recruiter-path-grid,.proof-center-head,.case-study-head{grid-template-columns:1fr}.proof-product{grid-template-columns:1fr}.case-study-grid{grid-template-columns:1fr}.proof-chain{grid-template-columns:repeat(5,minmax(92px,1fr));overflow-x:auto;padding-bottom:4px}.recruiter-path-list{grid-template-columns:1fr 1fr 1fr}}
      @media(max-width:760px){html{scroll-padding-top:76px}[id]{scroll-margin-top:76px}.recruiter-path{padding:24px 0}.recruiter-path-list{grid-template-columns:1fr}.proof-center,.case-studies{padding:52px 0}.proof-chain{grid-template-columns:1fr 1fr}.proof-chain a{justify-content:flex-start;padding-left:28px}.case-study-card{padding:20px}.nexa-live-preview iframe,.mono-live-preview iframe,.excel-live-preview iframe,.booking-portfolio-preview iframe{display:none!important}}
      @media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
    `;
    document.head.append(style);
  }

  function activateFrame(frame) {
    if (!(frame instanceof HTMLIFrameElement)) return;
    if (!frame.dataset.src || frame.dataset.previewLoaded === 'true') return;
    if (window.matchMedia('(max-width:760px)').matches) {
      frame.closest('.browser-preview,.booking-portfolio-preview')?.setAttribute('data-preview-state', 'mobile-disabled');
      return;
    }
    frame.src = frame.dataset.src;
    frame.dataset.previewLoaded = 'true';
    frame.closest('.browser-preview,.booking-portfolio-preview')?.setAttribute('data-preview-state', 'loaded');
  }

  function installPerformanceGate() {
    const observeFrame = (frame) => {
      if (!(frame instanceof HTMLIFrameElement) || !frame.dataset.src || frame.dataset.previewObserved === 'true') return;
      frame.dataset.previewObserved = 'true';
      frame.closest('.browser-preview,.booking-portfolio-preview')?.setAttribute('data-preview-state', 'deferred');
      if (window.matchMedia('(max-width:760px)').matches) return;
      if (!('IntersectionObserver' in window)) {
        activateFrame(frame);
        return;
      }
      const io = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        activateFrame(frame);
        io.disconnect();
      }, { rootMargin: '500px 0px', threshold: 0.01 });
      io.observe(frame.closest('.browser-preview,.booking-portfolio-preview') || frame);
    };

    document.querySelectorAll('iframe[data-src]').forEach(observeFrame);
    const mutation = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches?.('iframe[data-src]')) observeFrame(node);
          node.querySelectorAll?.('iframe[data-src]').forEach(observeFrame);
        }
      }
    });
    mutation.observe(document.documentElement, { childList: true, subtree: true });
    window.KZONE_ACTIVATE_PREVIEW = activateFrame;
  }

  function addRecruiterPath() {
    if (document.getElementById('recruiter-path')) return;
    const hero = document.querySelector('.studio-hero');
    if (!hero) return;
    const section = document.createElement('section');
    section.id = 'recruiter-path';
    section.className = 'recruiter-path';
    section.setAttribute('aria-labelledby', 'recruiter-path-title');
    section.innerHTML = `
      <div class="shell recruiter-path-grid">
        <div class="recruiter-path-copy">
          <span>RECRUITER · 90 SECOND REVIEW</span>
          <h2 id="recruiter-path-title">세 군데만 보면 핵심 역량 판단이 끝납니다.</h2>
          <p>제품 수를 훑기보다 복잡한 업무 흐름, 운영 시스템 설계, 실패·검증 근거를 순서대로 보도록 압축했습니다.</p>
        </div>
        <nav class="recruiter-path-list" aria-label="90초 채용 검토 경로">
          <a class="recruiter-path-card" href="#featured"><b>00–35 SEC</b><strong>1. NEXA</strong><span>고객 요청부터 현장 완료까지 end-to-end 흐름</span></a>
          <a class="recruiter-path-card" href="./mono-operations/"><b>35–65 SEC</b><strong>2. MONO</strong><span>권한·감사·실패 복구가 있는 운영 시스템</span></a>
          <a class="recruiter-path-card" href="#proof-center"><b>65–90 SEC</b><strong>3. EVIDENCE</strong><span>Source · Tests · CI · Deployment QA 검증</span></a>
        </nav>
      </div>`;
    hero.insertAdjacentElement('afterend', section);
  }

  function addProofCenter() {
    if (document.getElementById('proof-center')) return;
    const featured = document.getElementById('featured');
    if (!featured) return;
    const section = document.createElement('section');
    section.id = 'proof-center';
    section.className = 'proof-center';
    section.setAttribute('aria-labelledby', 'proof-center-title');
    section.innerHTML = `
      <div class="shell">
        <div class="proof-center-head">
          <div><span>PROOF CENTER · FIVE-STEP TRACE</span><h2 id="proof-center-title">설명보다 검증 경로를 보여줍니다.</h2></div>
          <p>각 제품은 실제 화면만 보여주는 데서 끝나지 않습니다. Live → Source → Domain Tests → CI → Deployment QA를 같은 카드에서 따라가며 구현 범위와 검증 수준을 확인할 수 있습니다.</p>
        </div>
        <div class="proof-center-grid"></div>
      </div>`;
    const grid = section.querySelector('.proof-center-grid');
    for (const product of PROOFS) {
      const article = document.createElement('article');
      article.className = 'proof-product';
      article.dataset.proofProduct = product.id;
      const info = document.createElement('div');
      info.className = 'proof-product-name';
      info.innerHTML = `<span>VERIFIABLE PRODUCT</span><h3>${product.name}</h3><p>${product.summary}</p>`;
      const chain = document.createElement('nav');
      chain.className = 'proof-chain';
      chain.setAttribute('aria-label', `${product.name} 검증 경로`);
      product.links.forEach(([label, href], index) => {
        const a = link(label, href);
        a.dataset.step = `0${index + 1}`;
        chain.append(a);
      });
      article.append(info, chain);
      grid.append(article);
    }
    featured.insertAdjacentElement('afterend', section);
  }

  function addCaseStudies() {
    if (document.getElementById('case-studies')) return;
    const proof = document.getElementById('proof-center');
    if (!proof) return;
    const section = document.createElement('section');
    section.id = 'case-studies';
    section.className = 'case-studies';
    section.setAttribute('aria-labelledby', 'case-study-title');
    section.innerHTML = `
      <div class="shell">
        <div class="case-study-head">
          <div><span>ENGINEERING CASE STUDIES</span><h2 id="case-study-title">무엇을 만들었는지가 아니라 왜 그렇게 설계했는지.</h2></div>
          <p>면접이나 기술 검토에서 바로 설명할 수 있도록 대표 프로젝트를 문제 → 설계 판단 → 어려운 예외 → 구현 → 검증의 다섯 단계로 압축했습니다.</p>
        </div>
        <div class="case-study-grid"></div>
      </div>`;
    const grid = section.querySelector('.case-study-grid');
    const labels = [['PROBLEM','problem'],['DESIGN DECISION','decision'],['HARD EDGE','edge'],['IMPLEMENTATION','build'],['VERIFICATION','verify']];
    for (const item of CASES) {
      const article = document.createElement('article');
      article.className = 'case-study-card';
      article.id = item.id;
      article.innerHTML = `<span>EVIDENCE-DRIVEN CASE</span><h3>${item.name}</h3><div class="case-study-story"></div>`;
      const story = article.querySelector('.case-study-story');
      for (const [labelText, key] of labels) {
        const row = document.createElement('div');
        row.innerHTML = `<b>${labelText}</b><p>${item[key]}</p>`;
        story.append(row);
      }
      const cta = link('실제 제품에서 확인하기 →', item.href);
      article.append(cta);
      grid.append(article);
    }
    proof.insertAdjacentElement('afterend', section);
  }

  function enhanceHeaderNav() {
    const nav = document.querySelector('.studio-header nav');
    if (!nav) return;
    if (!nav.querySelector('a[href="#proof-center"]')) {
      const evidence = nav.querySelector('a[href="#evidence"]');
      const a = document.createElement('a');
      a.href = '#proof-center';
      a.textContent = 'Proof';
      evidence?.insertAdjacentElement('beforebegin', a);
    }
  }

  function boot() {
    installStyles();
    installPerformanceGate();
    addRecruiterPath();
    addProofCenter();
    addCaseStudies();
    enhanceHeaderNav();
    document.documentElement.dataset.qualitySuite = 'ready';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
