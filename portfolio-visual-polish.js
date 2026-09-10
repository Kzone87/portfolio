(() => {
  function installStyles() {
    if (document.getElementById('portfolio-visual-polish-style')) return;

    const style = document.createElement('style');
    style.id = 'portfolio-visual-polish-style';
    style.textContent = `
      /* Experience + recruiter flow: read as one guided-review area, not two stacked hero sections. */
      .portfolio-experience{padding:24px 0 22px}
      .portfolio-experience-shell{gap:18px}
      .portfolio-experience-intro,.portfolio-experience-panel{border-radius:20px;box-shadow:0 10px 30px rgba(15,23,42,.055)}
      .portfolio-experience-intro{padding:22px;gap:18px}
      .portfolio-experience-panel{min-height:260px;padding:24px;grid-template-columns:minmax(0,1.18fr) minmax(210px,.62fr);gap:20px}
      .portfolio-experience-steps{padding:17px;gap:13px;border-radius:15px}
      .portfolio-experience-foot{margin-top:-8px}

      /* Keep the explicit recruiter route, but demote it from a second full-width hero to a contained review strip. */
      .recruiter-path-section{padding:8px 0 42px;background:transparent;color:#fff}
      .recruiter-path-shell{grid-template-columns:minmax(180px,.38fr) minmax(0,1.62fr);gap:24px;align-items:center;padding:22px 24px;border-radius:20px;background:#0f172a;box-shadow:0 14px 34px rgba(15,23,42,.12)}
      .recruiter-path-copy h2{max-width:15ch;font-size:clamp(20px,1.9vw,26px);line-height:1.12}
      .recruiter-path-copy p{margin:9px 0 0;font-size:11px;line-height:1.55;color:#94a3b8}
      .recruiter-path-list{gap:7px}
      .recruiter-path-list a{min-height:62px;grid-template-columns:70px 62px minmax(0,1fr) auto;gap:10px;padding:10px 14px;border-radius:12px}
      .recruiter-path-list b{font-size:14px}
      .recruiter-path-list span{font-size:11px;line-height:1.4}
      .recruiter-path-list em{font-size:10px}

      /* Proof Center: preserve all five evidence stages while removing repetitive vertical bulk. */
      .proof-center-section{padding:60px 0;background:#f7faff}
      .proof-center-heading{gap:26px;margin-bottom:22px}
      .proof-center-heading h2{font-size:clamp(28px,3.4vw,42px)}
      .proof-center-heading p{font-size:14px;line-height:1.65}
      .proof-center-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      .proof-center-card{padding:18px;border-radius:16px;box-shadow:0 8px 24px rgba(15,23,42,.04)}
      .proof-center-card:last-child{grid-column:1/-1}
      .proof-center-card header{margin-bottom:12px}
      .proof-center-card h3{font-size:16px}
      .proof-center-chain{gap:6px}
      .proof-center-chain a{min-height:76px;padding:9px 10px;border-radius:10px}
      .proof-center-chain small{line-height:1.3}

      /* Case studies: keep evidence density, reduce card chrome and repeated whitespace. */
      .case-study-section{padding:60px 0 68px}
      .case-study-heading{margin-bottom:22px}
      .case-study-heading h2{font-size:clamp(28px,3.4vw,42px)}
      .case-study-grid{gap:14px}
      .case-study-grid>article{padding:24px;border-radius:18px;background:#fbfcfe;box-shadow:none}
      .case-study-grid h3{margin:7px 0 15px;font-size:22px}
      .case-study-grid dl{gap:0}
      .case-study-grid dl>div{padding:10px 0}
      .case-study-actions{margin-top:16px}

      /* The legacy proof section is retained for failure-flow context, but its duplicate KPI rail is removed. */
      #evidence.proof-section{padding:0 0 72px;background:#fff}
      #evidence .proof-rail{display:none}
      #evidence .proof-story{width:100%;max-width:none;box-sizing:border-box;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:36px;margin:0;padding:38px 42px;border-radius:22px;background:#0f172a;color:#fff}
      #evidence .proof-story>div>span{color:#60a5fa}
      #evidence .proof-story h2{max-width:12ch;margin-top:7px;color:#fff;font-size:clamp(30px,3.4vw,46px);line-height:1.04}
      #evidence .proof-story p{max-width:620px;margin-top:0;color:#cbd5e1;font-size:.92rem;line-height:1.7}
      #evidence .proof-links{margin-top:18px}
      #evidence .proof-links a{color:#bfdbfe;border-color:rgba(191,219,254,.42)}
      #evidence .proof-links a:hover{color:#fff;border-color:#fff}

      .about-contact-section{padding-top:84px}

      @media(max-width:900px){
        .portfolio-experience-panel{grid-template-columns:1fr;min-height:0}
        .portfolio-experience-steps{grid-template-columns:repeat(3,1fr)}
        .recruiter-path-section{padding:6px 0 34px}
        .recruiter-path-shell{grid-template-columns:1fr;gap:16px;padding:20px}
        .recruiter-path-copy h2{max-width:22ch}
        .recruiter-path-list a{grid-template-columns:70px 62px minmax(0,1fr)}
        .recruiter-path-list em{display:none}
        .proof-center-grid{grid-template-columns:1fr}
        .proof-center-card:last-child{grid-column:auto}
        .proof-center-chain{grid-template-columns:repeat(5,minmax(0,1fr));overflow:visible}
        .proof-center-chain a{min-width:0}
        #evidence .proof-story{grid-template-columns:1fr;gap:18px;padding:32px}
      }

      @media(max-width:640px){
        .portfolio-experience{padding:14px 0 16px}
        .portfolio-experience-intro,.portfolio-experience-panel{padding:18px;border-radius:16px}
        .portfolio-experience-intro{gap:14px}
        .portfolio-experience-steps{grid-template-columns:1fr;gap:10px;padding:14px}
        .portfolio-experience-steps li{font-size:12px}
        .portfolio-experience-foot{margin-top:-4px}

        .recruiter-path-section{padding:4px 0 30px}
        .recruiter-path-shell{padding:18px 16px;border-radius:16px}
        .recruiter-path-copy h2{max-width:none;font-size:22px}
        .recruiter-path-copy p{font-size:11px}
        .recruiter-path-list a{grid-template-columns:62px minmax(0,1fr);gap:4px 9px;min-height:56px;padding:11px 12px}
        .recruiter-path-list i{grid-column:1;grid-row:1}
        .recruiter-path-list b{grid-column:2;grid-row:1}
        .recruiter-path-list span{grid-column:2;grid-row:2}

        .proof-center-section,.case-study-section{padding:42px 0}
        .proof-center-heading{display:block;margin-bottom:18px}
        .proof-center-heading p{margin-top:14px;font-size:13px}
        .proof-center-card{padding:16px;border-radius:14px}
        .proof-center-card header{margin-bottom:10px}
        .proof-center-chain{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
        .proof-center-chain a{min-height:68px;padding:8px 9px}
        .proof-center-chain a:last-child{grid-column:1/-1}
        .proof-center-chain small{font-size:9px}

        .case-study-heading{margin-bottom:18px}
        .case-study-grid>article{padding:19px;border-radius:16px}
        .case-study-grid h3{font-size:20px}
        .case-study-grid dl>div{padding:9px 0}
        .case-study-grid dd{font-size:11px;line-height:1.58}

        #evidence.proof-section{padding:0 0 48px}
        #evidence .proof-story{padding:26px 22px;border-radius:18px}
        #evidence .proof-story h2{font-size:30px}
        #evidence .proof-story p{font-size:.86rem}
        .about-contact-section{padding-top:68px}
      }

      @media(prefers-reduced-motion:reduce){
        .portfolio-experience-intro,.portfolio-experience-panel,.proof-center-card,.case-study-grid>article{scroll-behavior:auto}
      }
    `;
    document.head.append(style);
  }

  function inspect() {
    const proofGrid = document.querySelector('.proof-center-grid');
    const evidenceRail = document.querySelector('#evidence .proof-rail');
    const recruiter = document.querySelector('.recruiter-path-section');
    const recruiterShell = document.querySelector('.recruiter-path-shell');
    const proofStory = document.querySelector('#evidence .proof-story');
    return {
      installed: Boolean(document.getElementById('portfolio-visual-polish-style')),
      proofGrid: proofGrid ? getComputedStyle(proofGrid).gridTemplateColumns : '',
      evidenceRail: evidenceRail ? getComputedStyle(evidenceRail).display : '',
      recruiterHeight: recruiter ? Math.round(recruiter.getBoundingClientRect().height) : 0,
      recruiterContained: Boolean(recruiter && recruiterShell && recruiterShell.getBoundingClientRect().width < recruiter.getBoundingClientRect().width),
      proofStoryWidth: proofStory ? Math.round(proofStory.getBoundingClientRect().width) : 0,
      proofStoryParentWidth: proofStory?.parentElement ? Math.round(proofStory.parentElement.getBoundingClientRect().width) : 0
    };
  }

  function boot() {
    installStyles();
    window.KZONE_VISUAL_POLISH = Object.freeze({ inspect });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();