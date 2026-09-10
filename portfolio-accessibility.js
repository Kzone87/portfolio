(() => {
  let reviewObserver = null;

  function installStyles() {
    if (document.getElementById('portfolio-a11y-style')) return;
    const style = document.createElement('style');
    style.id = 'portfolio-a11y-style';
    style.textContent = `
      .portfolio-experience-tab,.portfolio-experience-links a,.studio-header nav a,.hero-actions a,.proof-links a,.nexa-proof-links a,.mono-proof-links a{min-width:24px;min-height:44px;display:inline-flex;align-items:center}
      .recruiter-path-list a,.proof-center-chain a,.case-study-actions a{min-width:24px;min-height:44px}
      .studio-header nav a{padding-block:10px}
      :where(a,button,[role="tab"]):focus-visible{outline:3px solid rgba(37,99,235,.48)!important;outline-offset:3px!important}
      @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto!important}*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}
    `;
    document.head.append(style);
  }

  function associateReviewTabs() {
    const section = document.querySelector('[data-portfolio-experience="true"]');
    if (!section) return false;
    const panel = section.querySelector('[role="tabpanel"]');
    const tabs = [...section.querySelectorAll('[role="tab"]')];
    if (!panel || !tabs.length) return false;
    panel.id ||= 'portfolio-review-panel';
    tabs.forEach((tab, index) => {
      tab.id ||= `portfolio-review-tab-${index + 1}`;
      tab.setAttribute('aria-controls', panel.id);
    });
    const syncLabel = () => {
      const selected = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true');
      if (selected) panel.setAttribute('aria-labelledby', selected.id);
    };
    syncLabel();
    if (!section.dataset.a11yAssociated) {
      section.dataset.a11yAssociated = 'true';
      const observer = new MutationObserver(syncLabel);
      tabs.forEach((tab) => observer.observe(tab, { attributes: true, attributeFilter: ['aria-selected'] }));
    }
    return true;
  }

  function markLandmarks() {
    document.querySelector('#proof-center')?.setAttribute('aria-label', '프로젝트 검증 증거 센터');
    document.querySelector('#recruiter-path')?.setAttribute('aria-label', '채용 담당자 90초 검토 경로');
    document.querySelector('#case-studies')?.setAttribute('aria-label', '설계 판단과 검증 중심 사례 연구');
  }

  function watchLateLayers() {
    if (reviewObserver) return;
    reviewObserver = new MutationObserver(() => {
      associateReviewTabs();
      markLandmarks();
    });
    reviewObserver.observe(document.documentElement, { childList:true, subtree:true });
  }

  function inspect() {
    associateReviewTabs();
    markLandmarks();
    const selectedTabs = [...document.querySelectorAll('[role="tab"][aria-selected="true"]')];
    const controls = [...document.querySelectorAll('a,button,[role="tab"]')].filter((element) => {
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
    const tiny = controls.filter((element) => {
      if (!element.closest('.portfolio-experience,.recruiter-path-section,.proof-center-section,.case-study-section,.hero-actions,.studio-header')) return false;
      const box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && (box.width < 24 || box.height < 24);
    });
    return Object.freeze({
      h1Count: document.querySelectorAll('h1').length,
      skipLink: Boolean(document.querySelector('.skip-link[href="#top"]')),
      tabCount: document.querySelectorAll('[role="tab"]').length,
      selectedTabCount: selectedTabs.length,
      unassociatedTabs: [...document.querySelectorAll('[role="tab"]')].filter((tab) => !tab.getAttribute('aria-controls') || !document.getElementById(tab.getAttribute('aria-controls'))).length,
      tinyCriticalControls: tiny.length
    });
  }

  function boot() {
    installStyles();
    associateReviewTabs();
    markLandmarks();
    watchLateLayers();
    window.KZONE_ACCESSIBILITY_GATE = Object.freeze({ inspect, associateReviewTabs });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  window.addEventListener('load', () => { associateReviewTabs(); markLandmarks(); }, { once: true });
})();
