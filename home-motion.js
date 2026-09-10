(() => {
  const excelKicker = document.querySelector('.excel-case .project-kicker span');
  if (excelKicker) excelKicker.textContent = 'Excel 정리 작업실 · Excel Workbench';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion || !('IntersectionObserver' in window)) return;

  document.documentElement.classList.add('motion-ready');
  const items = [...document.querySelectorAll('[data-reveal]')];
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

  for (const item of items) observer.observe(item);

  // Reveal animation must never become a content-visibility dependency. This fallback
  // prevents fast anchor jumps, full-page captures and unusual viewport behavior from
  // leaving entire sections transparent after the initial motion window.
  let fallbackDone = false;
  const revealAll = () => {
    if (fallbackDone) return;
    fallbackDone = true;
    for (const item of items) item.classList.add('is-visible');
    observer.disconnect();
  };
  window.setTimeout(revealAll, 1200);
  window.addEventListener('hashchange', revealAll, { once:true });
})();

const portfolioLayers = [
  import('./portfolio-performance.js'),
  import('./portfolio-experience.js'),
  import('./booking-portfolio.js'),
  import('./portfolio-proof-center.js'),
  import('./portfolio-accessibility.js'),
  import('./portfolio-seo.js')
];

Promise.allSettled(portfolioLayers).then(() => import('./portfolio-visual-polish.js'));
