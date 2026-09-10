(() => {
  if (document.getElementById('portfolio-a11y-target-fix')) return;
  const style = document.createElement('style');
  style.id = 'portfolio-a11y-target-fix';
  style.textContent = `
    .site-header a,
    .hero-actions a,
    .proof-links a,
    .contact-grid a,
    .profile-link,
    .portfolio-experience-tab,
    .portfolio-experience-links a,
    .proof-chain a,
    .recruiter-path a,
    .case-study-card a {
      min-width: 24px;
      min-height: 44px;
    }
  `;
  document.head.append(style);
})();
