import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const base='https://kzone87.github.io/portfolio';
const output='mono-live-qa-artifacts';
const chromePath=process.env.CHROME_PATH;
if(!chromePath) throw new Error('CHROME_PATH is required');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:chromePath,headless:true,args:['--no-sandbox']});
const failures=[];
const viewports=[{name:'desktop',width:1440,height:1000},{name:'tablet',width:768,height:1024},{name:'mobile',width:390,height:844}];
const pages=[
  {name:'portfolio',url:`${base}/`,required:['MONO OPERATIONS','중소기업용 Back-office Operations Suite','MONO MARKET','MONO OFFICE','MONO SUPPORT','MONO DATA HUB']},
  {name:'operations',url:`${base}/mono-operations/`,required:['MONO OPERATIONS','통합 업무함','MARKET','OFFICE','SUPPORT','DATA HUB']},
  {name:'market',url:`${base}/commerce-ops-console/`,required:['MONO MARKET','주문 운영','환불 검토']},
  {name:'office',url:`${base}/document-intake-approval/`,required:['MONO OFFICE','문서 접수·검수','검수 패널']},
  {name:'support',url:`${base}/ai-workflow-review-desk/`,required:['MONO SUPPORT','고객 문의','업무보조 제안']},
  {name:'data-hub',url:`${base}/integration-control-center/`,required:['MONO DATA HUB','데이터 전달 작업','장애 복구 절차']}
];
function collect(page,errors){page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));page.on('response',r=>{if(r.status()>=400)errors.push(`http ${r.status()}: ${r.url()}`)});page.on('requestfailed',r=>errors.push(`requestfailed: ${r.url()} · ${r.failure()?.errorText||'unknown'}`));page.on('console',m=>{if(m.type()==='error')errors.push(`console: ${m.text()}`)})}
async function goto(page,url){let last;for(let i=1;i<=8;i++){try{const r=await page.goto(url,{waitUntil:'networkidle',timeout:30000});if(!r||r.status()>=400)throw new Error(`HTTP ${r?.status()??'none'} ${url}`);return}catch(e){last=e;await page.waitForTimeout(i*1000)}}throw last}
async function noOverflow(page,label){const s=await page.evaluate(()=>({clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,bodyScrollWidth:document.body?.scrollWidth||0}));if(s.scrollWidth>s.clientWidth+2||s.bodyScrollWidth>s.clientWidth+2)throw new Error(`${label}: horizontal overflow ${JSON.stringify(s)}`)}
async function revealPortfolioSections(page,vpName){
  const items=page.locator('[data-reveal]');
  const count=await items.count();
  for(let i=0;i<count;i++){
    await items.nth(i).scrollIntoViewIfNeeded();
    await page.waitForTimeout(70);
  }
  const mono=page.locator('.mono-portfolio-featured');
  await mono.scrollIntoViewIfNeeded();
  await page.waitForTimeout(240);
  const visual=await mono.evaluate(el=>{const style=getComputedStyle(el);const rect=el.getBoundingClientRect();return {opacity:Number(style.opacity),visibility:style.visibility,display:style.display,width:rect.width,height:rect.height}});
  if(visual.display==='none'||visual.visibility==='hidden'||visual.opacity<0.98||visual.width<20||visual.height<20)throw new Error(`portfolio/${vpName}: MONO flagship is not visually revealed ${JSON.stringify(visual)}`);
  await mono.screenshot({path:`${output}/portfolio-mono-${vpName}.png`});
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.waitForTimeout(120);
}
for(const spec of pages){for(const vp of viewports){const context=await browser.newContext({viewport:{width:vp.width,height:vp.height},locale:'ko-KR',timezoneId:'Asia/Seoul'});const page=await context.newPage();const errors=[];collect(page,errors);try{await goto(page,spec.url);const body=await page.locator('body').innerText();for(const text of spec.required)if(!body.includes(text))throw new Error(`${spec.name}/${vp.name}: missing ${text}`);if(spec.name==='portfolio'){
      await page.locator('.mono-portfolio-featured').waitFor({state:'visible',timeout:10000});
      const links=page.locator('.mono-portfolio-featured .mono-surface-link');if(await links.count()!==5)throw new Error(`portfolio/${vp.name}: MONO must expose suite home plus four modules`);
      const suiteHref=await links.first().getAttribute('href');if(suiteHref!=='./mono-operations/')throw new Error(`portfolio/${vp.name}: integrated suite link is incorrect`);
      const frameSrc=await page.locator('.mono-live-preview iframe').getAttribute('src');if(frameSrc!=='./mono-operations/')throw new Error(`portfolio/${vp.name}: live preview must render the deployed MONO suite`);
      await revealPortfolioSections(page,vp.name);
      if(vp.name==='desktop'){
        const frameBody=page.frameLocator('.mono-live-preview iframe').locator('body');await frameBody.waitFor({state:'visible',timeout:10000});const previewText=await frameBody.innerText();if(!previewText.includes('MONO OPERATIONS')||!previewText.includes('통합 업무함'))throw new Error('portfolio/desktop: embedded live MONO screen did not render');
      }
    }else if(spec.name!=='operations') await page.locator('.mono-suite-switcher').waitFor({state:'visible',timeout:10000});if(spec.name==='operations'&&vp.name==='mobile')await page.locator('.mobile-tabs').waitFor({state:'visible'});await noOverflow(page,`${spec.name}/${vp.name}`);await page.screenshot({path:`${output}/${spec.name}-${vp.name}.png`,fullPage:true});if(errors.length)throw new Error(`${spec.name}/${vp.name}: ${errors.join(' | ')}`);console.log(`PASS mono ${spec.name} render ${vp.width}x${vp.height}`)}catch(e){failures.push(e instanceof Error?e.message:String(e))}finally{await context.close()}}}
{
  const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'ko-KR',timezoneId:'Asia/Seoul'});const page=await context.newPage();const errors=[];collect(page,errors);try{
    await goto(page,`${base}/mono-operations/`);
    await page.locator('#queue-list .queue-item').first().waitFor({state:'visible',timeout:10000});
    if((await page.locator('#queue-count').innerText()).trim()!=='6건')throw new Error('initial integrated work count must be 6');
    await page.locator('[data-module="DATA_HUB"]').click();
    if((await page.locator('#queue-count').innerText()).trim()!=='1건')throw new Error('DATA HUB filter must isolate one item');
    await page.locator('[data-module="ALL"]').click();
    await page.locator('.queue-item[data-id="W-1001"]').click();
    const message=await page.locator('#detail-message').innerText();
    if(!message.includes('권한이 없습니다'))throw new Error('OPERATOR must be blocked from refunds.approve');
    await page.locator('#acknowledge').click();
    if(!(await page.locator('#detail-message').innerText()).includes('권한이 없어'))throw new Error('blocked action must explain permission denial');
    await page.locator('#role').selectOption('MANAGER');
    if(!(await page.locator('#detail-message').innerText()).includes('처리할 수 있습니다'))throw new Error('MANAGER must gain refunds.approve capability');
    await page.locator('#acknowledge').click();
    await page.locator('#detail-status').filter({hasText:'확인 완료'}).waitFor({timeout:10000});
    if(!(await page.locator('#audit-list').innerText()).includes('W-1001 고액 환불 승인 대기 확인 처리'))throw new Error('suite audit must record authorized work completion');
    if((await page.locator('#m-done').innerText()).trim()!=='1')throw new Error('completed metric must advance');
    const href=await page.locator('.module-grid a').first().getAttribute('href');if(href!=='../commerce-ops-console/')throw new Error('MARKET module deep link is incorrect');
    await noOverflow(page,'operations/interaction');
    await page.screenshot({path:`${output}/operations-interaction-final.png`,fullPage:true});
    if(errors.length)throw new Error(`interaction: ${errors.join(' | ')}`);
    console.log('PASS mono integrated inbox -> filter -> OPERATOR block -> MANAGER authorize -> audit -> module link');
  }catch(e){failures.push(e instanceof Error?e.message:String(e))}finally{await context.close()}
}
await browser.close();
if(failures.length){console.error('\nMONO LIVE QA FAILURES');for(const f of failures)console.error(`- ${f}`);process.exit(1)}
console.log('\nMONO OPERATIONS LIVE PAGES QA: PASS');
