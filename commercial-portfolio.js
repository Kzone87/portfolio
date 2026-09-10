// Client-ready portfolio presentation layer. Public product data remains fictional unless explicitly stated otherwise.
window.KZONE_COMMERCIAL_PORTFOLIO = Object.freeze({
  inquiryPage: './project-inquiry/',
  deliveryStages: ['업무 흐름 확인','범위·인수기준 확정','개발·검수','배포·인수인계'],
  productLines: ['NEXA SERVICE SUITE','MONO OPERATIONS','Excel Workbench','OPS KIT'],
  monoSuite: Object.freeze({
    home: './mono-operations/',
    modules: ['./commerce-ops-console/','./document-intake-approval/','./ai-workflow-review-desk/','./integration-control-center/']
  })
});

function upgradeClientPositioning(){
  const heroOverline=document.querySelector('.hero-main .overline');
  if(heroOverline) heroOverline.textContent='KZONE87 · BUSINESS SYSTEMS · AUTOMATION · DELIVERY';

  const heroCopy=document.querySelector('.hero-main .hero-copy');
  if(heroCopy) heroCopy.innerHTML='반복되는 관리·승인·배차·주문·문서·데이터 업무를 분석해 <strong>실제 사용자가 운영할 수 있는 웹 시스템</strong>으로 구현합니다. 화면뿐 아니라 권한, 상태, 예외처리, 검수와 배포까지 함께 설계합니다.';

  const actions=document.querySelector('.hero-main .hero-actions');
  if(actions){
    const contact=actions.querySelector('a[href="#contact"]');
    if(contact){ contact.href='./project-inquiry/'; contact.textContent='프로젝트 의뢰서 →'; }
  }

  const liveMark=document.querySelector('.studio-meta .live-mark');
  if(liveMark) liveMark.innerHTML='<strong>04</strong><span>PRODUCT LINES<br>실행 가능한 대표 제품군</span>';
  const proofFirst=document.querySelector('.hero-proof span:first-child');
  if(proofFirst) proofFirst.innerHTML='<b>04</b> Product lines';
  const stack=document.querySelector('.studio-stack');
  if(stack) stack.textContent='TypeScript · JavaScript · Node.js · SQLite/SQL · REST/Webhook';

  const nav=document.querySelector('.studio-header nav');
  if(nav&&!nav.querySelector('a[href="#delivery"]')){
    const contact=nav.querySelector('a[href="#contact"]');
    contact?.insertAdjacentHTML('beforebegin','<a href="#delivery">납품</a>');
  }

  const mini=document.querySelector('.work-mini-banner');
  if(mini){
    const title=mini.querySelector('h2');
    const copy=mini.querySelector('p');
    const link=mini.querySelector('a');
    if(title) title.textContent='운영 전 검사·추출·보안·배포 점검 도구';
    if(copy) copy.textContent='작은 작업을 서버 전송 없이 브라우저에서 검사하고 결과와 증빙을 만드는 local-first Operations Utility Suite입니다. Content Preflight, Data Extractor, Workflow Dry-Run, Security Check, Release Gate를 제공합니다.';
    if(link) link.textContent='OPS KIT 실제 도구 열기 →';
  }

  const contactIntro=document.querySelector('.contact-intro');
  if(contactIntro){
    const title=contactIntro.querySelector('h3');
    const copy=contactIntro.querySelector('p');
    if(title) title.textContent='실제 구축 범위를 이야기하고 싶다면';
    if(copy) copy.textContent='먼저 공개 제품을 확인한 뒤, 필요한 업무 흐름과 완료 기준을 의뢰서로 정리할 수 있습니다.';
  }
  const note=document.querySelector('.contact-note');
  if(note) note.innerHTML='공개 의뢰서는 서버 전송 없이 상담 초안을 정리·복사·다운로드할 수 있습니다. 공개 가능한 1차 내용은 <a href="https://github.com/Kzone87/portfolio/issues/new?template=project-inquiry.yml" target="_blank" rel="noreferrer">GitHub 공개 문의</a>로도 남길 수 있으며, 비공개 endpoint가 연결된 운영환경에서는 같은 양식을 비공개로 접수할 수 있습니다.';
}

function previewFrame(src,title){
  return `<iframe data-preview-src="${src}" title="${title}" loading="lazy" tabindex="-1" aria-hidden="true"></iframe>`;
}

function upgradeNexaLivePreview(){
  const preview=document.querySelector('.nexa-preview');
  if(!preview||preview.dataset.livePreview==='true') return;
  preview.dataset.livePreview='true';
  preview.classList.remove('preview-placeholder');
  preview.classList.add('nexa-live-preview');
  preview.innerHTML=`
    <div class="browser-bar"><i></i><i></i><i></i><span>LIVE · NEXA TECH SERVICE</span></div>
    <div class="nexa-live-frame-wrap" data-live-preview="nexa">
      ${previewFrame('./nexa-tech-service/','NEXA TECH SERVICE 실제 공개 화면 미리보기')}
      <span class="product-live-badge"><i></i> ACTUAL LIVE SCREEN</span>
    </div>`;
}

function upgradeExcelLivePreview(){
  const preview=document.querySelector('.excel-preview');
  if(!preview||preview.dataset.livePreview==='true') return;
  preview.dataset.livePreview='true';
  preview.classList.remove('preview-placeholder');
  preview.classList.add('excel-live-preview');
  preview.innerHTML=`
    <div class="browser-bar"><i></i><i></i><i></i><span>LIVE · EXCEL WORKBENCH</span></div>
    <div class="excel-live-frame-wrap" data-live-preview="excel">
      ${previewFrame('https://kzone87.github.io/customer-map-planner/','Excel Workbench 실제 공개 화면 미리보기')}
      <span class="product-live-badge"><i></i> ACTUAL LIVE SCREEN</span>
    </div>`;
}

function upgradeMonoPortfolioShowcase(){
  const mono=document.querySelector('.mono-case');
  if(!mono||mono.dataset.portfolioUpgraded==='true') return;
  mono.dataset.portfolioUpgraded='true';
  mono.classList.add('mono-portfolio-featured');

  const pair=mono.closest('.studio-pair');
  if(pair&&pair.parentNode){
    pair.parentNode.insertBefore(mono,pair);
    pair.classList.add('single-secondary-case');
  }

  const watermark=mono.querySelector('.case-watermark');
  if(watermark) watermark.textContent='M';

  const kicker=mono.querySelector('.project-kicker');
  if(kicker) kicker.innerHTML='<span>FLAGSHIP OPERATIONS SUITE</span><b>MONO OPERATIONS</b><em>4 MODULES</em>';

  const title=mono.querySelector('h3');
  if(title) title.textContent='주문·문서·고객지원·데이터 연동을 하나의 운영 흐름으로 관리합니다.';

  const lead=mono.querySelector('.project-lead');
  if(lead) lead.textContent='주문·문서·고객지원·데이터 연동 업무를 하나의 직원 계정과 통합 업무함, 권한, 감사이력으로 운영하는 중소기업용 Back-office Operations Suite입니다.';

  const preview=mono.querySelector('.mono-preview');
  if(preview){
    preview.classList.remove('preview-placeholder');
    preview.classList.add('mono-live-preview');
    preview.setAttribute('aria-hidden','true');
    preview.innerHTML=`
      <div class="browser-bar"><i></i><i></i><i></i><span>LIVE · MONO OPERATIONS</span></div>
      <div class="mono-live-frame-wrap" data-live-preview="mono">
        ${previewFrame('./mono-operations/','MONO OPERATIONS 실제 통합 업무함 미리보기')}
        <span class="product-live-badge"><i></i> ACTUAL LIVE SCREEN</span>
      </div>`;
  }

  const grid=mono.querySelector('.mono-bento');
  if(grid){
    grid.classList.remove('mono-bento');
    grid.classList.add('mono-surface-links');
    grid.setAttribute('aria-label','MONO 제품 화면 바로가기');
    grid.innerHTML=`
      <a class="mono-surface-link mono-suite-home" href="./mono-operations/">
        <span class="surface-audience">전체 운영</span><strong>MONO OPERATIONS</strong><small>통합 업무함 · 권한 · 감사이력 · 모듈 이동</small><b>통합 운영 화면 열기 <i aria-hidden="true">→</i></b>
      </a>
      <a class="mono-surface-link" href="./commerce-ops-console/">
        <span class="surface-audience">주문 담당</span><strong>MONO MARKET</strong><small>주문 · 출고 · 배송 · 환불 승인</small><b>주문 운영 열기 <i aria-hidden="true">→</i></b>
      </a>
      <a class="mono-surface-link" href="./document-intake-approval/">
        <span class="surface-audience">문서 담당</span><strong>MONO OFFICE</strong><small>문서 접수 · 추출 · 검수 · 승인</small><b>문서 운영 열기 <i aria-hidden="true">→</i></b>
      </a>
      <a class="mono-surface-link" href="./ai-workflow-review-desk/">
        <span class="surface-audience">상담 담당</span><strong>MONO SUPPORT</strong><small>근거 검색 · AI 제안 · Human Review</small><b>고객지원 열기 <i aria-hidden="true">→</i></b>
      </a>
      <a class="mono-surface-link" href="./integration-control-center/">
        <span class="surface-audience">연동 담당</span><strong>MONO DATA HUB</strong><small>Webhook · Retry · Dead Letter · 복구</small><b>데이터 연동 열기 <i aria-hidden="true">→</i></b>
      </a>`;
  }

  const copy=mono.querySelector('.flagship-copy');
  if(copy&&!copy.querySelector('.mono-engineering-proof')){
    copy.insertAdjacentHTML('beforeend',`
      <section class="mono-engineering-proof" aria-label="MONO 상용 납품 검증">
        <div class="mono-proof-head"><span>COMMERCIAL DELIVERY EVIDENCE</span><strong>공개 화면뿐 아니라 실제 HTTP · SQLite Runtime과 납품 패키지까지 같은 코드베이스에서 검증합니다.</strong></div>
        <div class="mono-proof-grid">
          <article><b>WORKFLOW</b><span>Work Inbox → Domain Modules → Audit</span></article>
          <article><b>CONTROL</b><span>HttpOnly Session · CSRF · Server-side RBAC</span></article>
          <article><b>RELIABILITY</b><span>SQLite · Versioning · HMAC · Retry / DLQ</span></article>
          <article><b>DELIVERY</b><span>Backup / Restore · Manifest · Chrome QA</span></article>
        </div>
        <div class="mono-proof-links">
          <a href="https://github.com/Kzone87/portfolio/tree/main/mono-operations" target="_blank" rel="noreferrer">Commercial Runtime Source ↗</a>
          <a href="https://github.com/Kzone87/portfolio/blob/main/mono-operations/DELIVERY_RUNBOOK.md" target="_blank" rel="noreferrer">Delivery Runbook ↗</a>
          <a href="https://github.com/Kzone87/portfolio/blob/main/test/mono-commercial-http.test.mjs" target="_blank" rel="noreferrer">Commercial Tests ↗</a>
          <a href="https://github.com/Kzone87/portfolio/blob/main/.github/workflows/mono-commercial-runtime-qa.yml" target="_blank" rel="noreferrer">Runtime QA ↗</a>
        </div>
      </section>`);
  }
}

function addDeliverySection(){
  if(document.getElementById('delivery')) return;
  const contact=document.getElementById('contact');
  if(!contact) return;
  contact.insertAdjacentHTML('beforebegin',`
    <section id="delivery" class="client-delivery-section">
      <div class="shell">
        <div class="section-heading editorial-heading" data-reveal>
          <div><span>DELIVERY STANDARD</span><h2>실제 납품은 화면에서 끝나지 않습니다.</h2></div>
          <p>업무 흐름과 완료 기준을 먼저 정하고, 프로젝트 범위에 따라 운영에 필요한 데이터·권한·검수·배포·인수인계까지 함께 구성합니다.</p>
        </div>
        <div class="client-delivery-grid">
          <article data-reveal><span>01</span><h3>업무 흐름</h3><p>누가 무엇을 처리하고 어떤 상태로 넘어가는지, 정상 흐름과 막혀야 하는 흐름을 함께 정의합니다.</p><b>상태 전이 · Validation · 예외처리</b></article>
          <article data-reveal><span>02</span><h3>권한·데이터</h3><p>직원 역할과 민감 작업의 권한 경계를 서버에서 확인하고, 필요한 데이터가 재접속 후에도 유지되도록 설계합니다.</p><b>RBAC · Persistence · Audit</b></article>
          <article data-reveal><span>03</span><h3>검수·배포</h3><p>자동 테스트와 실제 브라우저에서 핵심 업무를 다시 검증하고, 배포된 동일 버전이 정상인지 확인합니다.</p><b>CI · Browser QA · Same-SHA</b></article>
          <article data-reveal><span>04</span><h3>인수인계</h3><p>프로젝트 범위에 따라 설치·환경설정·백업/복구·운영 문서와 인수 기준을 정리해 넘깁니다.</p><b>Runbook · Backup/Restore · Acceptance</b></article>
        </div>
        <div class="client-acceptance" data-reveal>
          <div><span>ACCEPTANCE</span><strong>“코드가 있다”가 아니라 실제 사용 흐름이 통과해야 완료로 봅니다.</strong><p>정상 처리, 권한 차단, 잘못된 입력, 실패·복구, 반응형 화면과 배포본까지 프로젝트별 인수기준으로 확인합니다.</p></div>
          <a href="./project-inquiry/">내 프로젝트 범위 정리하기 <b>→</b></a>
        </div>
        <p class="client-trust-boundary" data-reveal><strong>표시 원칙</strong> 공개 포트폴리오의 브랜드·기업·업무 데이터는 시연용 가상 사례입니다. 실제 고객 실적이나 성과 수치를 꾸며서 사용하지 않고, 공개 가능한 코드·테스트·배포 기록으로 구현 범위를 보여줍니다.</p>
      </div>
    </section>`);
}

function bootClientReadyPortfolio(){
  upgradeClientPositioning();
  upgradeNexaLivePreview();
  upgradeMonoPortfolioShowcase();
  upgradeExcelLivePreview();
  addDeliverySection();
  window.KZONE_PERFORMANCE_GATE?.scan(document);
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bootClientReadyPortfolio,{once:true});
else bootClientReadyPortfolio();