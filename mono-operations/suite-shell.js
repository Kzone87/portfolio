const stylesheet=document.createElement('link');stylesheet.rel='stylesheet';stylesheet.href='../mono-operations/suite-shell.css';document.head.append(stylesheet);
const path=location.pathname;
const modules=[
  ['../mono-operations/','HOME','/mono-operations/'],
  ['../commerce-ops-console/','MARKET','/commerce-ops-console/'],
  ['../document-intake-approval/','OFFICE','/document-intake-approval/'],
  ['../ai-workflow-review-desk/','SUPPORT','/ai-workflow-review-desk/'],
  ['../integration-control-center/','DATA HUB','/integration-control-center/']
];
const bar=document.createElement('nav');
bar.className='mono-suite-bar';
bar.setAttribute('aria-label','MONO OPERATIONS 제품 메뉴');
const brand=document.createElement('a');brand.className='mono-suite-brand';brand.href='../mono-operations/';brand.innerHTML='<b>M</b><span>MONO OPERATIONS</span>';
const nav=document.createElement('div');nav.className='mono-suite-nav';
for(const [href,label,match] of modules){const a=document.createElement('a');a.href=href;a.textContent=label;if(path.includes(match))a.setAttribute('aria-current','page');nav.append(a);}
const user=document.createElement('div');user.className='mono-suite-user';user.innerHTML='<span>공개 시연</span><strong>김서준 · 운영 관리자</strong>';
bar.append(brand,nav,user);document.body.prepend(bar);
const legacy=document.querySelector('.topbar a[href="../"]');if(legacy){legacy.href='../mono-operations/';legacy.textContent='업무 홈';legacy.setAttribute('aria-label','MONO OPERATIONS 업무 홈으로 이동');}