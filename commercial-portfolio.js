window.KZONE_COMMERCIAL_PORTFOLIO = Object.freeze({
  inquiryPage: './project-inquiry/',
  deliveryStages: ['요구사항 확인','범위·견적 확정','개발·검수','배포·인수인계'],
  monoSuite: Object.freeze({
    home: './mono-operations/',
    modules: ['./commerce-ops-console/','./document-intake-approval/','./ai-workflow-review-desk/','./integration-control-center/']
  })
});

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
      <div class="mono-live-frame-wrap">
        <iframe src="./mono-operations/" title="MONO OPERATIONS 실제 통합 업무함 미리보기" loading="lazy" tabindex="-1" aria-hidden="true"></iframe>
        <span class="mono-live-badge"><i></i> ACTUAL LIVE SCREEN</span>
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

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',upgradeMonoPortfolioShowcase,{once:true});
else upgradeMonoPortfolioShowcase();
