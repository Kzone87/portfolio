(() => {
  const selector = 'iframe[data-preview-src]';
  const mobile = window.matchMedia('(max-width: 760px)');
  const registered = new WeakSet();
  const loaded = new WeakSet();

  function load(frame) {
    if (!frame || loaded.has(frame) || mobile.matches) return false;
    const src = frame.dataset.previewSrc;
    if (!src) return false;
    frame.src = src;
    frame.dataset.previewLoaded = 'true';
    loaded.add(frame);
    return true;
  }

  const observer = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          load(entry.target);
          observer.unobserve(entry.target);
        }
      }, { rootMargin: '500px 0px', threshold: 0.01 })
    : null;

  function register(frame) {
    if (!frame || registered.has(frame)) return;
    registered.add(frame);
    frame.loading = 'lazy';
    frame.dataset.previewLoaded = 'false';
    if (mobile.matches) return;
    if (observer) observer.observe(frame);
    else load(frame);
  }

  function scan(root = document) {
    if (root.matches?.(selector)) register(root);
    root.querySelectorAll?.(selector).forEach(register);
  }

  const mutationObserver = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) scan(node);
      }
    }
  });

  function inspect() {
    const frames = [...document.querySelectorAll(selector)];
    return Object.freeze({
      total: frames.length,
      loaded: frames.filter((frame) => frame.dataset.previewLoaded === 'true').length,
      deferred: frames.filter((frame) => frame.dataset.previewLoaded !== 'true').length,
      mobileSuppressed: mobile.matches,
      externalLoaded: frames.filter((frame) => frame.dataset.previewLoaded === 'true' && /^https:\/\//.test(frame.src) && !frame.src.startsWith(location.origin)).length
    });
  }

  function boot() {
    scan();
    mutationObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  mobile.addEventListener?.('change', (event) => {
    if (!event.matches) scan();
  });

  window.KZONE_PERFORMANCE_GATE = Object.freeze({ inspect, load, scan });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
