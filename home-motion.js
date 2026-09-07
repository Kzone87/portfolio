(() => {
  const palette = document.createElement('link');
  palette.rel = 'stylesheet';
  palette.href = './home-light.css';
  document.head.appendChild(palette);

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
})();
