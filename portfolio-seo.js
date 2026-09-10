(() => {
  const canonical = 'https://kzone87.github.io/portfolio/';
  const description = '업무 시스템, 데이터 자동화, API 연동과 운영도구를 실제 업무 흐름·테스트·배포 검증까지 구현하는 Kzone87 풀스택 웹개발 포트폴리오입니다.';

  function meta(selector, attrs) {
    let node = document.head.querySelector(selector);
    if (!node) {
      node = document.createElement('meta');
      document.head.append(node);
    }
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  }

  function addStructuredData() {
    if (document.getElementById('kzone87-structured-data')) return;
    const data = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Person',
          '@id': `${canonical}#person`,
          name: 'Kzone87',
          url: canonical,
          jobTitle: 'Full-stack Web Developer',
          sameAs: ['https://github.com/Kzone87'],
          knowsAbout: ['Business Systems','Web Application Development','Data Automation','REST API','Webhook Integration','Node.js','JavaScript','TypeScript','SQL','SQLite']
        },
        {
          '@type': 'ProfilePage',
          '@id': `${canonical}#profile`,
          url: canonical,
          name: 'Kzone87 · Full-stack Web Developer',
          description,
          mainEntity: { '@id': `${canonical}#person` },
          inLanguage: 'ko-KR'
        },
        {
          '@type': 'WebSite',
          '@id': `${canonical}#website`,
          url: canonical,
          name: 'Kzone87 Portfolio',
          description,
          publisher: { '@id': `${canonical}#person` },
          inLanguage: 'ko-KR'
        }
      ]
    };
    const script = document.createElement('script');
    script.id = 'kzone87-structured-data';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data);
    document.head.append(script);
  }

  function boot() {
    meta('meta[name="robots"]', { name: 'robots', content: 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1' });
    meta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'Kzone87 Portfolio' });
    meta('meta[property="og:locale"]', { property: 'og:locale', content: 'ko_KR' });
    meta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary' });
    meta('meta[name="twitter:title"]', { name: 'twitter:title', content: 'Kzone87 · Full-stack Web Developer' });
    meta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
    const descriptionMeta = document.head.querySelector('meta[name="description"]');
    if (descriptionMeta) descriptionMeta.content = description;
    const canonicalLink = document.head.querySelector('link[rel="canonical"]');
    if (canonicalLink) canonicalLink.href = canonical;
    addStructuredData();
    window.KZONE_SEO_GATE = Object.freeze({ canonical, structuredTypes: ['Person','ProfilePage','WebSite'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
