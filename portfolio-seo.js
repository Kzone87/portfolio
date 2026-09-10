(() => {
  const SITE = 'https://kzone87.github.io/portfolio/';
  const GITHUB = 'https://github.com/Kzone87';
  const DESCRIPTION = '업무 시스템, 데이터 자동화, 기업 웹사이트와 내부 운영도구를 실제 업무 흐름으로 구현하고 Source · Tests · CI · Browser QA로 검증하는 Kzone87 풀스택 웹개발 포트폴리오입니다.';

  function ensureMeta(selector, attributes) {
    let node = document.head.querySelector(selector);
    if (!node) {
      node = document.createElement('meta');
      document.head.append(node);
    }
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    return node;
  }

  function ensureLink(selector, attributes) {
    let node = document.head.querySelector(selector);
    if (!node) {
      node = document.createElement('link');
      document.head.append(node);
    }
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    return node;
  }

  ensureMeta('meta[name="author"]', { name: 'author', content: 'Kzone87' });
  ensureMeta('meta[name="robots"]', { name: 'robots', content: 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1' });
  ensureMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'Kzone87 Portfolio' });
  ensureMeta('meta[property="og:locale"]', { property: 'og:locale', content: 'ko_KR' });
  ensureMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary' });
  ensureMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: 'Kzone87 · Full-stack Web Developer' });
  ensureMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: DESCRIPTION });
  ensureLink('link[rel="me"]', { rel: 'me', href: GITHUB });

  if (!document.getElementById('kzone87-structured-data')) {
    const script = document.createElement('script');
    script.id = 'kzone87-structured-data';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          '@id': `${SITE}#website`,
          url: SITE,
          name: 'Kzone87 Portfolio',
          inLanguage: 'ko-KR',
          description: DESCRIPTION,
          publisher: { '@id': `${SITE}#person` }
        },
        {
          '@type': 'ProfilePage',
          '@id': `${SITE}#profile`,
          url: SITE,
          name: 'Kzone87 · Full-stack Web Developer',
          dateModified: '2026-09-10',
          mainEntity: { '@id': `${SITE}#person` },
          isPartOf: { '@id': `${SITE}#website` }
        },
        {
          '@type': 'Person',
          '@id': `${SITE}#person`,
          name: 'Kzone87',
          alternateName: 'KZONE87',
          url: SITE,
          sameAs: [GITHUB],
          jobTitle: 'Full-stack Web Developer',
          description: '업무 시스템과 데이터 자동화를 중심으로 실제 실행 가능한 웹제품을 구현하는 풀스택 웹개발자.',
          knowsAbout: ['Business Systems', 'Workflow Automation', 'TypeScript', 'JavaScript', 'Node.js', 'SQLite', 'SQL', 'REST API', 'Webhook']
        }
      ]
    });
    document.head.append(script);
  }

  document.documentElement.dataset.seoLayer = 'ready';
})();
