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

  // Reveal motion is decoration only. Dynamic portfolio sections may mount after the
  // initial scan, so the bounded fallback always queries the current DOM. Any content
  // added after that fallback is made visible immediately instead of inheriting the
  // global hidden reveal state indefinitely.
  let fallbackDone = false;
  const revealCurrentDom = () => {
    for (const item of document.querySelectorAll('[data-reveal]')) item.classList.add('is-visible');
  };
  const revealAll = () => {
    if (fallbackDone) return;
    fallbackDone = true;
    revealCurrentDom();
    observer.disconnect();
  };

  const lateRevealObserver = new MutationObserver((records) => {
    if (!fallbackDone) return;
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches('[data-reveal]')) node.classList.add('is-visible');
        for (const child of node.querySelectorAll('[data-reveal]')) child.classList.add('is-visible');
      }
    }
  });
  lateRevealObserver.observe(document.body, { childList:true, subtree:true });

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
