(() => {
  const STORAGE_KEY = 'kzone87:portfolio-review-mode';

  const MODES = Object.freeze({
    hiring: Object.freeze({
      eyebrow: 'HIRING REVIEW · 90 SECOND PATH',
      title: '업무를 이해하고 끝까지 구현하는 개발자인지 빠르게 확인하세요.',
      copy: '대표 제품 2개와 검증 근거만 보면 설계 범위, 상태·권한 처리, 예외 대응, 테스트와 배포까지 한 번에 판단할 수 있습니다.',
      steps: ['NEXA에서 고객 요청 → 현장 완료 흐름 확인', 'MONO에서 복합 운영 업무와 권한·감사 확인', '검증 섹션에서 Tests · CI · 실패 흐름 확인'],
      links: [
        ['NEXA SERVICE SUITE', '#featured'],
        ['MONO OPERATIONS', './mono-operations/'],
        ['Source · Tests · CI', 'https://github.com/Kzone87/portfolio']
      ]
    }),
    project: Object.freeze({
      eyebrow: 'PROJECT REVIEW · PROBLEM FIRST',
      title: '필요한 기능보다 먼저, 해결하려는 업무 문제와 가장 가까운 사례를 보세요.',
      copy: '운영 시스템, 예약·고객관리, 데이터 자동화, 연동·AI 업무보조를 실제 실행 화면으로 확인한 뒤 같은 구조로 의뢰 범위를 정리할 수 있습니다.',
      steps: ['가장 비슷한 업무 유형의 Live Product 실행', '상태·권한·예외·데이터 유지 범위 확인', '의뢰서에서 현재 업무와 완료 기준 정리'],
      links: [
        ['NEXA 업무 운영', './nexa-tech-service/'],
        ['Booking CRM', './booking-crm/'],
        ['프로젝트 의뢰서', './project-inquiry/']
      ]
    }),
    technical: Object.freeze({
      eyebrow: 'TECHNICAL REVIEW · EVIDENCE FIRST',
      title: '화면 설명이 아니라 실행 코드와 실패 조건까지 검토할 수 있습니다.',
      copy: 'Public Source, 도메인 테스트, same-SHA Live QA, SQLite persistence, RBAC, retry/recovery 같은 구현 근거를 실제 저장소와 실행 제품으로 연결했습니다.',
      steps: ['대표 제품의 실제 Live 화면 확인', 'Source에서 상태·권한·저장 구조 확인', 'Tests · CI에서 정상·실패·배포 검증 확인'],
      links: [
        ['Engineering Evidence', '#evidence'],
        ['GitHub Repository', 'https://github.com/Kzone87/portfolio'],
        ['Delivery Standard', '#delivery']
      ]
    })
  });

  function installStyles() {
    if (document.getElementById('portfolio-experience-style')) return;
    const style = document.createElement('style');
    style.id = 'portfolio-experience-style';
    style.textContent = `
      .portfolio-experience{position:relative;padding:28px 0 34px;background:linear-gradient(180deg,rgba(239,247,255,.72),rgba(255,255,255,.96));border-top:1px solid rgba(15,23,42,.06);border-bottom:1px solid rgba(15,23,42,.08)}
      .portfolio-experience *{box-sizing:border-box}
      .portfolio-experience-shell{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.45fr);gap:24px;align-items:stretch}
      .portfolio-experience-intro,.portfolio-experience-panel{border:1px solid rgba(15,23,42,.10);background:rgba(255,255,255,.88);box-shadow:0 16px 48px rgba(15,23,42,.07)}
      .portfolio-experience-intro{padding:26px;border-radius:24px;display:flex;flex-direction:column;justify-content:space-between;gap:24px}
      .portfolio-experience-kicker{margin:0 0 10px;font-size:12px;font-weight:900;letter-spacing:.16em;color:#2563eb}
      .portfolio-experience-intro h2{margin:0;font-size:clamp(25px,3vw,38px);line-height:1.08;letter-spacing:-.04em;color:#0f172a}
      .portfolio-experience-intro>div>p:last-child{margin:14px 0 0;color:#475569;line-height:1.7;font-size:15px}
      .portfolio-experience-tabs{display:grid;gap:8px}
      .portfolio-experience-tab{width:100%;border:1px solid rgba(15,23,42,.10);border-radius:14px;background:#fff;color:#334155;padding:13px 14px;text-align:left;font:inherit;font-weight:800;cursor:pointer;transition:transform .18s ease,border-color .18s ease,background .18s ease,color .18s ease}
      .portfolio-experience-tab:hover{transform:translateY(-1px);border-color:rgba(37,99,235,.32)}
      .portfolio-experience-tab[aria-selected="true"]{background:#0f172a;color:#fff;border-color:#0f172a}
      .portfolio-experience-tab:focus-visible{outline:3px solid rgba(37,99,235,.34);outline-offset:3px}
      .portfolio-experience-panel{padding:28px;border-radius:24px;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(220px,.7fr);gap:24px;min-height:300px}
      .portfolio-experience-copy{display:flex;flex-direction:column;justify-content:center}
      .portfolio-experience-mode{margin:0 0 10px;color:#2563eb;font-size:12px;font-weight:900;letter-spacing:.14em}
      .portfolio-experience-title{margin:0;color:#0f172a;font-size:clamp(23px,2.5vw,34px);line-height:1.16;letter-spacing:-.035em}
      .portfolio-experience-description{margin:14px 0 0;color:#475569;line-height:1.72;font-size:15px}
      .portfolio-experience-links{display:flex;flex-wrap:wrap;gap:9px;margin-top:22px}
      .portfolio-experience-links a{display:inline-flex;align-items:center;gap:7px;padding:11px 13px;border-radius:12px;background:#eff6ff;color:#1d4ed8;text-decoration:none;font-weight:850;font-size:13px;border:1px solid rgba(37,99,235,.12)}
      .portfolio-experience-links a:first-child{background:#2563eb;color:#fff;border-color:#2563eb}
      .portfolio-experience-links a:hover{text-decoration:none;transform:translateY(-1px)}
      .portfolio-experience-steps{margin:0;padding:20px;border-radius:18px;background:#0f172a;color:#e2e8f0;align-self:stretch;display:flex;flex-direction:column;justify-content:center;gap:16px;counter-reset:path-step}
      .portfolio-experience-steps li{list-style:none;display:grid;grid-template-columns:30px 1fr;gap:10px;align-items:start;font-size:13px;line-height:1.5}
      .portfolio-experience-steps li::before{counter-increment:path-step;content:'0' counter(path-step);font-size:11px;font-weight:900;letter-spacing:.08em;color:#93c5fd;padding-top:2px}
      .portfolio-experience-foot{grid-column:1/-1;margin:-4px 2px 0;color:#64748b;font-size:12px;line-height:1.6}
      @media (max-width:900px){.portfolio-experience-shell{grid-template-columns:1fr}.portfolio-experience-intro{gap:18px}.portfolio-experience-tabs{grid-template-columns:repeat(3,1fr)}.portfolio-experience-tab{text-align:center}.portfolio-experience-panel{grid-template-columns:1fr}.portfolio-experience-steps{display:grid;grid-template-columns:repeat(3,1fr)}}
      @media (max-width:640px){.portfolio-experience{padding:18px 0 24px}.portfolio-experience-intro,.portfolio-experience-panel{padding:20px;border-radius:18px}.portfolio-experience-tabs{grid-template-columns:1fr}.portfolio-experience-tab{text-align:left}.portfolio-experience-steps{grid-template-columns:1fr}.portfolio-experience-links{display:grid}.portfolio-experience-links a{justify-content:space-between}.portfolio-experience-panel{min-height:0}}
      @media (prefers-reduced-motion:reduce){.portfolio-experience-tab,.portfolio-experience-links a{transition:none}.portfolio-experience-tab:hover,.portfolio-experience-links a:hover{transform:none}}
    `;
    document.head.append(style);
  }

  function createSection() {
    const section = document.createElement('section');
    section.className = 'portfolio-experience';
    section.dataset.portfolioExperience = 'true';
    section.setAttribute('aria-labelledby', 'portfolio-experience-title');
    section.innerHTML = `
      <div class="shell portfolio-experience-shell">
        <div class="portfolio-experience-intro">
          <div>
            <p class="portfolio-experience-kicker">START HERE · PURPOSE-BASED REVIEW</p>
            <h2 id="portfolio-experience-title">무엇을 확인하러 오셨나요?</h2>
            <p>방문 목적에 맞는 검토 순서를 먼저 선택하면, 이미 구현된 제품과 검증 근거를 가장 짧은 동선으로 확인할 수 있습니다.</p>
          </div>
          <div class="portfolio-experience-tabs" role="tablist" aria-label="포트폴리오 검토 목적">
            <button class="portfolio-experience-tab" type="button" role="tab" aria-selected="true" data-mode="hiring">채용 검토</button>
            <button class="portfolio-experience-tab" type="button" role="tab" aria-selected="false" data-mode="project">프로젝트 의뢰</button>
            <button class="portfolio-experience-tab" type="button" role="tab" aria-selected="false" data-mode="technical">기술 검토</button>
          </div>
        </div>
        <div class="portfolio-experience-panel" role="tabpanel" aria-live="polite">
          <div class="portfolio-experience-copy">
            <p class="portfolio-experience-mode"></p>
            <h3 class="portfolio-experience-title"></h3>
            <p class="portfolio-experience-description"></p>
            <div class="portfolio-experience-links"></div>
          </div>
          <ol class="portfolio-experience-steps"></ol>
          <p class="portfolio-experience-foot">모든 경로는 같은 공개 제품을 보여주며, 방문 목적에 따라 추천 순서만 바뀝니다. 별도 추적 스크립트나 외부 분석 요청을 사용하지 않습니다.</p>
        </div>
      </div>`;
    return section;
  }

  function safeReadMode() {
    try {
      const value = sessionStorage.getItem(STORAGE_KEY);
      return Object.hasOwn(MODES, value) ? value : 'hiring';
    } catch {
      return 'hiring';
    }
  }

  function safeWriteMode(mode) {
    try {
      sessionStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Session persistence is an enhancement only; the router remains fully usable without it.
    }
  }

  function mount() {
    if (document.querySelector('[data-portfolio-experience="true"]')) return;
    const hero = document.querySelector('.studio-hero');
    if (!hero) return;

    installStyles();
    const section = createSection();
    hero.insertAdjacentElement('afterend', section);

    const tabs = [...section.querySelectorAll('.portfolio-experience-tab')];
    const modeLabel = section.querySelector('.portfolio-experience-mode');
    const title = section.querySelector('.portfolio-experience-title');
    const description = section.querySelector('.portfolio-experience-description');
    const steps = section.querySelector('.portfolio-experience-steps');
    const links = section.querySelector('.portfolio-experience-links');

    const render = (mode, persist = true) => {
      const data = MODES[mode] || MODES.hiring;
      for (const tab of tabs) {
        const selected = tab.dataset.mode === mode;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
      }
      modeLabel.textContent = data.eyebrow;
      title.textContent = data.title;
      description.textContent = data.copy;
      steps.replaceChildren(...data.steps.map((text) => {
        const item = document.createElement('li');
        item.textContent = text;
        return item;
      }));
      links.replaceChildren(...data.links.map(([label, href]) => {
        const link = document.createElement('a');
        link.href = href;
        link.textContent = `${label} →`;
        if (href.startsWith('https://')) {
          link.target = '_blank';
          link.rel = 'noreferrer';
        }
        return link;
      }));
      if (persist) safeWriteMode(mode);
    };

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => render(tab.dataset.mode));
      tab.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        let nextIndex = index;
        if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
        if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = tabs.length - 1;
        const next = tabs[nextIndex];
        render(next.dataset.mode);
        next.focus();
      });
    });

    render(safeReadMode(), false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
