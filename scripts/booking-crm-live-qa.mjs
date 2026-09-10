import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';

const base=(process.env.BOOKING_LIVE_URL||'https://kzone87.github.io/portfolio/booking-crm/').replace(/\/?$/,'/');
const chrome=process.env.CHROME_PATH;
if(!chrome) throw new Error('CHROME_PATH_REQUIRED');
const out=process.env.BOOKING_QA_ARTIFACT_DIR||'booking-crm-live-qa-artifacts';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:chrome,args:['--no-sandbox']});
const viewports=[[1440,1000],[768,1024],[390,844]];

async function attachGuards(page,label){
  const errors=[];
  page.on('console',msg=>{if(msg.type()==='error')errors.push(`console.error ${msg.text()}`)});
  page.on('pageerror',err=>errors.push(`pageerror ${err.message}`));
  page.on('requestfailed',req=>errors.push(`requestfailed ${req.url()} ${req.failure()?.errorText||''}`));
  page.on('response',res=>{if(res.status()>=400) errors.push(`http ${res.status()} ${res.url()}`)});
  return ()=>{if(errors.length)throw new Error(`${label}: ${errors.join(' | ')}`)};
}

for(const [width,height] of viewports){
  const page=await browser.newPage({viewport:{width,height}});const guard=await attachGuards(page,`render ${width}`);
  await page.goto(base,{waitUntil:'networkidle'});
  await page.getByRole('heading',{name:/예약을 받고/}).waitFor();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+2);
  if(overflow)throw new Error(`horizontal overflow ${width}x${height}`);
  await page.screenshot({path:path.join(out,`booking-crm-${width}.png`),fullPage:true});
  guard();await page.close();console.log(`PASS BOOKING CRM render ${width}x${height}`);
}

for(const [width,height] of viewports){
  const portfolioBase=base.replace(/booking-crm\/$/,'');
  const page=await browser.newPage({viewport:{width,height}});const guard=await attachGuards(page,`portfolio booking ${width}`);
  await page.goto(portfolioBase,{waitUntil:'networkidle'});
  await page.locator('.booking-portfolio-showcase').waitFor({state:'visible',timeout:15000});
  const body=await page.locator('.booking-portfolio-showcase').innerText();
  for(const phrase of ['BOOKING CRM','예약 요청','고객 메모']) if(!body.includes(phrase)) throw new Error(`portfolio booking missing ${phrase} at ${width}`);
  const count=await page.locator('.studio-meta .live-mark strong').innerText();if(count.trim()!=='05')throw new Error(`portfolio product line count ${count}`);
  if(width>760){
    const preview=page.locator('.booking-portfolio-preview');
    const iframe=preview.locator('iframe[data-src="./booking-crm/"]');
    if(await iframe.getAttribute('src')) throw new Error(`portfolio booking iframe loaded eagerly at ${width}`);
    await preview.scrollIntoViewIfNeeded();
    const handle=await iframe.elementHandle();
    await page.waitForFunction(el=>el?.dataset.previewLoaded==='true'&&Boolean(el.getAttribute('src')),handle,{timeout:15000});
    const frame=page.frameLocator('.booking-portfolio-preview iframe');
    await frame.locator('body').waitFor({state:'visible',timeout:15000});
    const text=await frame.locator('body').innerText();
    if(!text.includes('BOOKING CRM')||!text.includes('고객 예약·문의'))throw new Error(`portfolio booking deferred live iframe missing at ${width}`)
  }else{
    const display=await page.locator('.booking-portfolio-preview').evaluate(el=>getComputedStyle(el).display);
    if(display!=='none')throw new Error('booking portfolio mobile iframe should be hidden');
    if(await page.locator('.booking-portfolio-preview iframe').getAttribute('src'))throw new Error('booking portfolio mobile iframe must not load');
  }
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+2);if(overflow)throw new Error(`portfolio horizontal overflow ${width}x${height}`);
  await page.screenshot({path:path.join(out,`portfolio-booking-${width}.png`),fullPage:true});guard();await page.close();console.log(`PASS portfolio BOOKING CRM ${width}x${height}`);
}

const page=await browser.newPage({viewport:{width:1440,height:1000}});const guard=await attachGuards(page,'workflow');
await page.goto(base,{waitUntil:'networkidle'});
await page.locator('[data-slot="11:30"]').click();
await page.locator('#booking-form input[name="name"]').fill('테스트고객');
await page.locator('#booking-form input[name="phone"]').fill('010-4444-5555');
await page.locator('#booking-form textarea[name="note"]').fill('창가 자리 요청');
await page.locator('#booking-form button[type="submit"]').click();
await page.locator('#booking-ticket').getByText('테스트고객').waitFor();
await page.getByRole('button',{name:'관리자에서 확인하기',exact:true}).click();
await page.locator('.booking-row').filter({hasText:'테스트고객'}).click();
await page.getByRole('button',{name:'예약 확정',exact:true}).click();
await page.locator('#booking-detail .status').filter({hasText:'확정'}).waitFor();
await page.locator('#customer-memo').fill('VIP 후보 · 다음 상담 시 재확인');
await page.getByRole('button',{name:'고객 메모 저장',exact:true}).click();
await page.getByRole('button',{name:'고객 예약',exact:true}).click();
await page.locator('#inquiry-form input[name="name"]').fill('문의고객');
await page.locator('#inquiry-form input[name="phone"]').fill('010-7777-8888');
await page.locator('#inquiry-form textarea[name="message"]').fill('주말 예약 가능 여부 문의');
await page.locator('#inquiry-form button[type="submit"]').click();
await page.locator('#inquiry-result').getByText(/문의가 데모 Inbox에 등록/).waitFor();
await page.getByRole('button',{name:'관리자',exact:true}).click();
await page.locator('.inquiry-item').filter({hasText:'문의고객'}).getByRole('button',{name:'연락완료',exact:true}).click();
await page.locator('.inquiry-item').filter({hasText:'문의고객'}).getByRole('button',{name:'종료',exact:true}).click();
await page.locator('.inquiry-item').filter({hasText:'문의고객'}).getByText('종료',{exact:true}).waitFor();
await page.screenshot({path:path.join(out,'booking-crm-workflow.png'),fullPage:true});
guard();
console.log('PASS BOOKING CRM customer booking -> admin confirm -> CRM memo -> inquiry close');
await page.close();await browser.close();
console.log('BOOKING CRM LIVE QA: PASS');
