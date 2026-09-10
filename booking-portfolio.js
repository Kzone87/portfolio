function bootBookingPortfolio(){
  if(document.querySelector('.booking-portfolio-showcase')) return;

  const current=window.KZONE_COMMERCIAL_PORTFOLIO||{};
  window.KZONE_COMMERCIAL_PORTFOLIO=Object.freeze({...current,productLines:['NEXA SERVICE SUITE','BOOKING CRM','MONO OPERATIONS','Excel Workbench','OPS KIT']});

  const liveMark=document.querySelector('.studio-meta .live-mark');
  if(liveMark) liveMark.innerHTML='<strong>05</strong><span>PRODUCT LINES<br>실행 가능한 대표 제품군</span>';
  const proofFirst=document.querySelector('.hero-proof span:first-child');
  if(proofFirst) proofFirst.innerHTML='<b>05</b> Product lines';

  const anchor=document.querySelector('.mono-portfolio-featured')||document.querySelector('.mono-case');
  if(!anchor?.parentNode) return;
  const article=document.createElement('article');
  article.className='booking-portfolio-showcase';
  article.innerHTML=`
    <div class="booking-portfolio-copy">
      <div class="booking-portfolio-kicker"><span>CLIENT BOOKING + CRM</span><b>BOOKING CRM</b><em>PUBLIC + STAFF</em></div>
      <h3>홈페이지에서 받은 예약과 문의를 관리자 고객관리까지 이어갑니다.</h3>
      <p>서비스 선택·날짜·시간 예약부터 관리자 확인, 확정·변경·취소·완료, 고객 메모와 문의 처리까지 하나의 흐름으로 만든 소규모 사업자용 예약·고객관리 시스템입니다.</p>
      <div class="booking-portfolio-flow"><span>예약 요청</span><i>→</i><span>일정 확인</span><i>→</i><span>확정</span><i>→</i><span>고객 메모</span><i>→</i><span>완료</span></div>
      <div class="booking-portfolio-actions">
        <a class="booking-primary" href="./booking-crm/">BOOKING CRM 실제 화면 열기 →</a>
        <a href="https://github.com/Kzone87/portfolio/tree/main/booking-crm" target="_blank" rel="noreferrer">Runtime Source ↗</a>
        <a href="https://github.com/Kzone87/portfolio/blob/main/booking-crm/DELIVERY_RUNBOOK.md" target="_blank" rel="noreferrer">Delivery Runbook ↗</a>
        <a href="https://github.com/Kzone87/portfolio/blob/main/test/booking-crm.test.mjs" target="_blank" rel="noreferrer">Tests ↗</a>
      </div>
      <div class="booking-portfolio-proof">
        <article><b>SCHEDULE</b><span>Slot Conflict · Capacity</span></article>
        <article><b>CONTROL</b><span>expectedVersion · Audit</span></article>
        <article><b>SECURITY</b><span>HttpOnly Session · CSRF · RBAC</span></article>
        <article><b>DATA</b><span>SQLite · WAL · Persistence</span></article>
      </div>
    </div>
    <div class="booking-portfolio-preview" aria-hidden="true">
      <div class="booking-browser-bar"><i></i><i></i><i></i><span>LIVE · BOOKING CRM</span></div>
      <div class="booking-live-frame-wrap"><iframe data-src="./booking-crm/" title="BOOKING CRM 실제 공개 화면 미리보기" loading="lazy" tabindex="-1" aria-hidden="true"></iframe><span class="booking-live-badge"><i></i> ACTUAL LIVE SCREEN</span></div>
    </div>`;
  anchor.parentNode.insertBefore(article,anchor);

  if(!document.getElementById('booking-portfolio-style')){
    const style=document.createElement('style');style.id='booking-portfolio-style';style.textContent=`
      .booking-portfolio-showcase{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(360px,.92fr);gap:34px;align-items:center;margin:28px 0 44px;padding:34px;border:1px solid #d9e4ef;border-radius:28px;background:linear-gradient(145deg,#f7fbff,#fff);box-shadow:0 20px 60px rgba(24,63,105,.08)}
      .booking-portfolio-copy{min-width:0}.booking-portfolio-kicker{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:11px;font-weight:900;letter-spacing:.08em;color:#45617d}.booking-portfolio-kicker span{color:#2563eb}.booking-portfolio-kicker em{font-style:normal;padding:4px 7px;background:#eaf2ff;border-radius:99px;color:#2553a8}.booking-portfolio-copy h3{font-size:clamp(28px,3.4vw,46px);line-height:1.12;letter-spacing:-.04em;margin:16px 0}.booking-portfolio-copy>p{font-size:15px;line-height:1.75;color:#5b6d7e;max-width:720px}.booking-portfolio-flow{display:flex;align-items:center;flex-wrap:wrap;gap:7px;margin:22px 0;color:#3b536c;font-size:12px;font-weight:850}.booking-portfolio-flow i{font-style:normal;color:#9aabbc}.booking-portfolio-actions{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}.booking-portfolio-actions a{padding:9px 11px;border:1px solid #d8e2ec;border-radius:9px;color:#244766;text-decoration:none;font-size:11px;font-weight:850;background:#fff}.booking-portfolio-actions .booking-primary{background:#2563eb;border-color:#2563eb;color:#fff}.booking-portfolio-proof{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.booking-portfolio-proof article{padding:12px;border:1px solid #e1e8ef;border-radius:10px;background:#fff}.booking-portfolio-proof b,.booking-portfolio-proof span{display:block}.booking-portfolio-proof b{font-size:9px;letter-spacing:.1em;color:#2563eb}.booking-portfolio-proof span{font-size:10px;color:#697b8c;margin-top:5px;line-height:1.4}.booking-portfolio-preview{min-width:0;overflow:hidden;border:1px solid #d8e2ec;border-radius:18px;background:#fff;box-shadow:0 20px 50px rgba(26,54,93,.12)}.booking-browser-bar{height:34px;display:flex;align-items:center;gap:6px;padding:0 12px;background:#f3f6f9;border-bottom:1px solid #e0e6ed}.booking-browser-bar>i{width:7px;height:7px;border-radius:50%;background:#c5d0da}.booking-browser-bar span{margin-left:6px;font-size:9px;font-weight:900;color:#6d7d8c}.booking-live-frame-wrap{position:relative;height:390px;overflow:hidden}.booking-live-frame-wrap iframe{width:1440px;height:900px;border:0;transform:scale(.38);transform-origin:top left;pointer-events:none}.booking-live-badge{position:absolute;right:10px;bottom:10px;padding:6px 8px;background:rgba(13,31,49,.9);color:#fff;border-radius:99px;font-size:8px;font-weight:900;letter-spacing:.08em}.booking-live-badge i{display:inline-block;width:6px;height:6px;border-radius:50%;background:#42d392;margin-right:5px}
      @media(max-width:980px){.booking-portfolio-showcase{grid-template-columns:1fr}.booking-live-frame-wrap{height:330px}.booking-live-frame-wrap iframe{transform:scale(.34)}}
      @media(max-width:760px){.booking-portfolio-showcase{padding:22px;margin:22px 0 34px;border-radius:20px}.booking-portfolio-preview{display:none}.booking-portfolio-proof{grid-template-columns:1fr 1fr}.booking-portfolio-copy h3{font-size:31px}.booking-portfolio-actions a{width:100%;text-align:center}}
    `;document.head.append(style);
  }
}

if(document.readyState==='complete') bootBookingPortfolio();
else window.addEventListener('load',bootBookingPortfolio,{once:true});
