import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const url='https://kzone87.github.io/portfolio/document-intake-approval/';
const output='document-live-qa-artifacts';
const chromePath=process.env.CHROME_PATH;
if(!chromePath)throw new Error('CHROME_PATH is required');
await mkdir(output,{recursive:true});

const browser=await chromium.launch({executablePath:chromePath,headless:true,args:['--no-sandbox']});
const failures=[];
const viewports=[{name:'desktop',width:1440,height:1000},{name:'tablet',width:768,height:1024},{name:'mobile',width:390,height:844}];

async function gotoWithRetry(page){let last;for(let attempt=1;attempt<=8;attempt+=1){try{const response=await page.goto(url,{waitUntil:'networkidle',timeout:30_000});if(!response||response.status()>=400)throw new Error(`HTTP ${response?.status()??'no-response'} ${url}`);return;}catch(error){last=error;await page.waitForTimeout(attempt*1200);}}throw last;}
function collectRuntimeErrors(page,errors){page.on('pageerror',error=>errors.push(`pageerror: ${error.message}`));page.on('response',response=>{if(response.status()>=400)errors.push(`http ${response.status()}: ${response.url()}`);});page.on('requestfailed',request=>errors.push(`requestfailed: ${request.url()} · ${request.failure()?.errorText||'unknown error'}`));page.on('console',message=>{if(message.type()==='error')errors.push(`console: ${message.text()}`);});}
async function assertNoHorizontalOverflow(page,label){const sizes=await page.evaluate(()=>({clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,bodyScrollWidth:document.body?.scrollWidth||0}));if(sizes.scrollWidth>sizes.clientWidth+2||sizes.bodyScrollWidth>sizes.clientWidth+2)throw new Error(`${label}: horizontal overflow ${JSON.stringify(sizes)}`);}

for(const viewport of viewports){const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},locale:'ko-KR',timezoneId:'Asia/Seoul'});const page=await context.newPage();const errors=[];collectRuntimeErrors(page,errors);try{await gotoWithRetry(page);await page.locator('#doc-list .doc-card').first().waitFor({state:'visible',timeout:15_000});const body=await page.locator('body').innerText();for(const required of ['문서 접수·검수','새 문서 접수','지금 먼저 확인할 업무','검수 패널','최근 변경 이력'])if(!body.includes(required))throw new Error(`${viewport.name}: missing copy ${required}`);if(viewport.name==='mobile')await page.locator('.mobile-nav').waitFor({state:'visible',timeout:10_000});await assertNoHorizontalOverflow(page,`document/${viewport.name}`);await page.screenshot({path:`${output}/document-${viewport.name}.png`,fullPage:true});if(errors.length)throw new Error(`${viewport.name}: ${errors.join(' | ')}`);console.log(`PASS document render ${viewport.width}x${viewport.height}`);}catch(error){failures.push(error instanceof Error?error.message:String(error));}finally{await context.close();}}

{
  const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'ko-KR',timezoneId:'Asia/Seoul'});
  const page=await context.newPage();const errors=[];collectRuntimeErrors(page,errors);
  try{
    await gotoWithRetry(page);

    await page.locator('#search').fill('파트너');
    await page.locator('#visible-doc-count').filter({hasText:'1건'}).waitFor({timeout:10_000});
    await page.locator('.doc-card[data-doc-id="2"]').waitFor({state:'visible',timeout:10_000});
    await page.locator('#reset-filters').click();
    await page.locator('#visible-doc-count').filter({hasText:'4건'}).waitFor({timeout:10_000});

    await page.locator('[data-quick-filter="SUBMITTED"]').click();
    await page.locator('#visible-doc-count').filter({hasText:'1건'}).waitFor({timeout:10_000});
    await page.locator('.doc-card[data-doc-id="2"]').waitFor({state:'visible',timeout:10_000});
    await page.locator('#reset-filters').click();

    await page.locator('#intake-title').fill('QA 4번 공급사 인보이스');
    await page.locator('#intake-source').fill('documentNo: QA-DOC-260909\nparty: QA Supply\namount: 248000');
    await page.locator('#create-document').click();
    await page.locator('#message').filter({hasText:'새 문서를 접수했습니다.'}).waitFor({timeout:10_000});
    await page.locator('#doc-title').filter({hasText:'QA 4번 공급사 인보이스'}).waitFor({timeout:10_000});
    if((await page.locator('#version').innerText()).trim()!=='v1')throw new Error('new document did not start at v1');
    await page.locator('#status').filter({hasText:'작성 중'}).waitFor({timeout:10_000});
    await page.locator('#check-result').filter({hasText:'확인 필요'}).waitFor({timeout:10_000});

    await page.locator('#submit').click();
    await page.locator('#message').filter({hasText:'필수 항목을 모두 채운 뒤 다시 검수 요청해 주세요.'}).waitFor({timeout:10_000});
    if((await page.locator('#version').innerText()).trim()!=='v1')throw new Error('blocked submit unexpectedly advanced version');

    await page.locator('#extract').click();
    await page.locator('#message').filter({hasText:'원문에서 값을 채웠습니다.'}).waitFor({timeout:10_000});
    if((await page.locator('#version').innerText()).trim()!=='v2')throw new Error('extraction did not advance document to v2');
    await page.locator('#check-result').filter({hasText:'확인 완료'}).waitFor({timeout:10_000});

    await page.locator('#submit').click();
    await page.locator('#message').filter({hasText:'검수 요청을 제출했습니다.'}).waitFor({timeout:10_000});
    if((await page.locator('#version').innerText()).trim()!=='v3')throw new Error('submit did not advance document to v3');
    await page.locator('#status').filter({hasText:'검수 대기'}).waitFor({timeout:10_000});
    await page.locator('#q-submitted').filter({hasText:'2건'}).waitFor({timeout:10_000});

    await page.locator('#role').selectOption('REVIEWER');
    if(!(await page.locator('#edit-section').isHidden()))throw new Error('REVIEWER must not see author edit controls');
    await page.locator('#review-section').waitFor({state:'visible',timeout:10_000});
    await page.locator('[data-decision="APPROVE"]').click();
    await page.locator('#message').filter({hasText:'검수 근거를 4자 이상 입력해 주세요.'}).waitFor({timeout:10_000});
    await page.locator('#status').filter({hasText:'검수 대기'}).waitFor({timeout:10_000});

    const rationale='문서번호, 거래처, 금액 및 원문 대조 확인 완료';
    await page.locator('#comment').fill(rationale);
    await page.locator('[data-decision="APPROVE"]').click();
    await page.locator('#message').filter({hasText:'문서를 승인했습니다.'}).waitFor({timeout:10_000});
    await page.locator('#status').filter({hasText:'승인'}).waitFor({timeout:10_000});
    if((await page.locator('#version').innerText()).trim()!=='v4')throw new Error('review approval did not advance document to v4');

    await page.locator('#role').selectOption('ADMIN');
    await page.locator('#archive').waitFor({state:'visible',timeout:10_000});
    await page.locator('#archive').click();
    await page.locator('#message').filter({hasText:'문서를 보관 처리했습니다.'}).waitFor({timeout:10_000});
    await page.locator('#status').filter({hasText:'보관'}).waitFor({timeout:10_000});
    if((await page.locator('#version').innerText()).trim()!=='v5')throw new Error('archive did not advance document to v5');

    const auditText=await page.locator('#audit-list').innerText();
    for(const required of ['등록 · 문서 #5','값 추출 · 문서 #5','검수 요청 · 문서 #5','승인 · 문서 #5','보관 · 문서 #5','문서 작성자','검수 담당자','관리자',rationale])if(!auditText.includes(required))throw new Error(`audit trail missing: ${required}`);

    await assertNoHorizontalOverflow(page,'document/interaction');
    await page.screenshot({path:`${output}/document-interaction-final.png`,fullPage:true});
    if(errors.length)throw new Error(`interaction: ${errors.join(' | ')}`);
    console.log('PASS document intake -> checklist block -> extraction -> submit -> REVIEWER approval -> ADMIN archive -> audit');
  }catch(error){failures.push(error instanceof Error?error.message:String(error));}finally{await context.close();}
}

await browser.close();
if(failures.length){console.error('\nDOCUMENT LIVE QA FAILURES');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('\nDOCUMENT LIVE PAGES QA: PASS');
