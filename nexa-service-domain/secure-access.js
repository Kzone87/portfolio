(()=>{
  const secureEndpoint=String(window.NEXA_CUSTOMER_SECURE_ENDPOINT||'').trim().replace(/\/+$/,'');
  const demo=!secureEndpoint;
  const form=document.getElementById('lookup-form');
  if(!form||!window.NEXA_PORTAL_RENDER)return;

  const phoneLabel=document.getElementById('request-phone')?.closest('label');
  if(phoneLabel)phoneLabel.hidden=true;
  const legacySubmit=form.querySelector('button[type="submit"]');
  if(legacySubmit)legacySubmit.hidden=true;
  const help=document.getElementById('lookup-help');
  if(help)help.textContent=demo
    ?'공개 시연에서는 인증번호 받기를 누르면 데모 인증번호가 안내됩니다.'
    :'접수번호 확인 후 등록 연락처 또는 이메일로 일회용 인증번호를 전송합니다.';

  const firstLabel=form.querySelector('label');
  if(firstLabel&&!firstLabel.querySelector('.secure-access-badge')){
    const badge=document.createElement('span');
    badge.className='secure-access-badge';
    badge.textContent='일회용 인증번호로 보호';
    firstLabel.append(badge);
  }

  const challenge=document.createElement('div');
  challenge.className='secure-challenge';
  const channel=document.createElement('select');
  channel.id='secure-channel';
  channel.setAttribute('aria-label','인증번호 수신 방법');
  channel.append(new Option('등록 연락처로 받기','sms'),new Option('등록 이메일로 받기','email'));
  const sendButton=document.createElement('button');
  sendButton.id='secure-send';
  sendButton.type='button';
  sendButton.textContent='인증번호 받기';
  challenge.append(channel,sendButton);

  const codeWrap=document.createElement('div');
  codeWrap.className='secure-code';
  codeWrap.hidden=true;
  const codeInput=document.createElement('input');
  codeInput.id='secure-code';
  codeInput.inputMode='numeric';
  codeInput.autocomplete='one-time-code';
  codeInput.maxLength=6;
  codeInput.placeholder='6자리 인증번호';
  codeInput.setAttribute('aria-label','6자리 인증번호');
  const verifyButton=document.createElement('button');
  verifyButton.id='secure-verify';
  verifyButton.type='button';
  verifyButton.textContent='인증 확인';
  codeWrap.append(codeInput,verifyButton);
  form.insertBefore(challenge,legacySubmit);
  form.insertBefore(codeWrap,legacySubmit);

  let challengeId='';
  let csrfToken='';
  let verified=false;
  let currentId='';
  const msg=document.getElementById('lookup-message');
  const setMsg=(text,error=false)=>{
    if(!msg)return;
    msg.textContent=text;
    msg.className=`lookup-message${error?' error':''}`;
  };

  const customerStatus=value=>({
    PENDING:'상담 접수',CONTACTED:'지원 확인 중',CLOSED:'상담 처리 완료',
    REQUESTED:'방문 일정 확인 중',SCHEDULED:'방문 일정 확정',DISPATCHED:'기사 출동 중',
    ON_SITE:'현장 작업 중',COMPLETED:'작업 완료',CANCELLED:'방문 취소',NO_SHOW:'방문 일정 재확인'
  }[String(value||'').toUpperCase()]||'진행상태 확인');
  const actionLabel=item=>item?.type==='MESSAGE'&&String(item?.note||'').startsWith('[재방문 요청]')?'재방문 요청':({MESSAGE:'추가 문의',RESCHEDULE:'일정 변경 요청',CANCEL:'방문 취소 요청'}[item?.type]||'고객 요청');
  const fmt=value=>value?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value)):'-';
  const addText=(parent,tag,text,cls='')=>{const node=document.createElement(tag);if(cls)node.className=cls;node.textContent=text;parent.append(node);return node;};

  async function request(path,opt={}){
    const method=opt.method||'GET';
    const headers={...(opt.body?{'content-type':'application/json'}:{}),...(csrfToken&&method!=='GET'&&method!=='HEAD'?{'x-csrf-token':csrfToken}:{})};
    const response=await fetch(`${secureEndpoint}${path}`,{method,headers,credentials:'include',cache:'no-store',body:opt.body?JSON.stringify(opt.body):undefined});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload?.error?.message||'요청을 처리하지 못했습니다.');
    return payload;
  }

  function demoReport(data){
    return {
      requestId:data.id,
      status:data.visit?.status||data.status,
      address:data.visit?.address||data.handoff?.address||'',
      summary:data.visit?.summary||data.handoff?.summary||'',
      scheduledAt:data.visit?.startAt||'',
      completedAt:data.visit?.status==='COMPLETED'?'2026-09-09T06:05:00.000Z':'',
      service:data.service||'고장·장애 현장지원',
      fieldReport:data.visit?.fieldReport||{
        checks:{customer:true,access:true,result:true},
        note:'출력 품질과 급지 상태를 확인하고 테스트 출력으로 정상 작동을 확인했습니다.',
        photo:null,
        updatedAt:'2026-09-09T06:03:00.000Z'
      }
    };
  }

  function renderReport(container,report,data){
    container.replaceChildren();
    const dl=document.createElement('dl');
    const rows=[
      ['접수번호',report.requestId||data.id],['서비스',report.service||data.service||'-'],['진행상태',customerStatus(report.status||data.status)],
      ['방문 장소',report.address||'-'],['작업 내용',report.summary||'-'],['방문 일정',report.scheduledAt?fmt(report.scheduledAt):'-'],
      ['완료 시각',report.completedAt?fmt(report.completedAt):'작업 진행 중']
    ];
    for(const [key,value] of rows){const row=document.createElement('div');addText(row,'dt',key);addText(row,'dd',String(value));dl.append(row)}
    container.append(dl);

    const field=report.fieldReport;
    if(field){
      const detail=document.createElement('div');detail.className='field-report-detail';
      addText(detail,'strong','기사 작업기록');
      const checks=document.createElement('ul');checks.className='field-report-checks';
      const checkRows=[['customer','고객 요청 확인'],['access','현장 접근·작업환경 확인'],['result','작업 후 정상 여부 확인']];
      for(const [key,label] of checkRows)addText(checks,'li',`${field.checks?.[key]?'✓':'–'} ${label}`);
      detail.append(checks);
      addText(detail,'p',field.note||'별도 작업 메모가 없습니다.','field-report-note');
      if(field.updatedAt)addText(detail,'small',`현장 기록 ${fmt(field.updatedAt)}`);
      if(field.photo?.data&&/^data:image\/(jpeg|png|webp);base64,/i.test(field.photo.data)){
        const figure=document.createElement('figure');figure.className='field-report-photo';
        const image=document.createElement('img');image.src=field.photo.data;image.alt='현장 작업 사진';image.loading='lazy';
        figure.append(image);if(field.photo.name)addText(figure,'figcaption',field.photo.name);detail.append(figure);
      }
      container.append(detail);
    }else{
      addText(container,'p','현장 작업기록은 기사 작업 후 표시됩니다.','field-report-empty');
    }

    const copyButton=document.createElement('button');copyButton.type='button';copyButton.className='report-download';copyButton.textContent='보고서 내용 복사';
    copyButton.addEventListener('click',async()=>{
      const checks=field?.checks||{};
      const text=[
        '[NEXA 서비스 작업 보고서]',`접수번호: ${report.requestId||data.id}`,`서비스: ${report.service||data.service||'-'}`,
        `진행상태: ${customerStatus(report.status||data.status)}`,`방문 장소: ${report.address||'-'}`,`작업 내용: ${report.summary||'-'}`,
        `기사 작업기록: ${field?.note||'아직 없음'}`,`고객 요청 확인: ${checks.customer?'완료':'-'}`,`작업환경 확인: ${checks.access?'완료':'-'}`,`정상 여부 확인: ${checks.result?'완료':'-'}`
      ].join('\n');
      try{await navigator.clipboard.writeText(text);setMsg('작업 보고서 내용을 복사했습니다.')}catch{setMsg('자동 복사를 사용할 수 없습니다.',true)}
    });
    container.append(copyButton);
  }

  async function renderHistory(data){
    let box=document.querySelector('.secure-history');
    if(!box){box=document.createElement('section');box.className='secure-history';document.getElementById('request-view')?.append(box)}
    let historyData,report;
    if(demo){historyData={items:[{id:data.id,status:data.visit?.status||data.status,service:data.service||'고장·장애 현장지원',createdAt:data.createdAt,updatedAt:data.updatedAt}]};report=demoReport(data)}
    else [historyData,report]=await Promise.all([request('/api/customer/access/history'),request(`/api/customer/access/report?requestId=${encodeURIComponent(data.id)}`)]);

    box.replaceChildren();
    const historySection=document.createElement('section');addText(historySection,'span','서비스 이력','card-label');addText(historySection,'h2','최근 요청·작업');
    const list=document.createElement('div');list.className='service-history-list';
    for(const item of (historyData.items||[]).slice(0,8)){
      const row=document.createElement('article');row.className='history-row';
      addText(row,'strong',item.id||'서비스 요청');addText(row,'span',`${item.service||'서비스 요청'} · ${customerStatus(item.status)}`);addText(row,'small',fmt(item.updatedAt||item.createdAt));list.append(row);
    }
    if(!list.childElementCount)addText(list,'div','최근 서비스 이력이 없습니다.','customer-action-empty');
    historySection.append(list);

    const reportSection=document.createElement('section');addText(reportSection,'span','작업 보고서','card-label');addText(reportSection,'h2','현재 요청 보고서');
    const reportBox=document.createElement('div');reportBox.className='service-report';renderReport(reportBox,report,data);reportSection.append(reportBox);
    box.append(historySection,reportSection);
  }

  async function loadSecure(){
    const data=demo?structuredClone(window.NEXA_PORTAL_DEMO_REQUEST):await request('/api/customer/access/request');
    window.NEXA_PORTAL_RENDER(data);currentId=data.id;
    history.replaceState(null,'',`${location.pathname}?request=${encodeURIComponent(data.id)}`);
    await renderHistory(data);
  }

  sendButton.addEventListener('click',async()=>{
    const id=String(document.getElementById('request-id')?.value||'').trim().toUpperCase();
    if(!/^NX-[A-Z0-9-]{6,24}$/.test(id)){setMsg('접수번호를 확인해 주세요.',true);return}
    currentId=id;verified=false;csrfToken='';setMsg('인증번호를 요청하고 있습니다.');
    try{
      if(demo){challengeId='demo';codeWrap.hidden=false;setMsg('공개 시연 인증번호는 246810 입니다.')}
      else{const payload=await request('/api/customer/access/challenge',{method:'POST',body:{id,channel:channel.value}});challengeId=payload.challengeId||'';codeWrap.hidden=false;setMsg('등록된 연락수단으로 인증번호를 보냈습니다.')}
      codeInput.focus();
    }catch(error){setMsg(error.message,true)}
  });

  verifyButton.addEventListener('click',async()=>{
    const value=String(codeInput.value||'').trim();
    if(!/^\d{6}$/.test(value)){setMsg('6자리 인증번호를 입력해 주세요.',true);return}
    try{
      if(demo){if(currentId!==window.NEXA_PORTAL_DEMO_REQUEST.id||value!=='246810')throw new Error('인증번호를 확인해 주세요.');csrfToken='demo-csrf'}
      else{const payload=await request('/api/customer/access/verify',{method:'POST',body:{challengeId,code:value}});csrfToken=payload.csrfToken||''}
      verified=true;await loadSecure();setMsg('인증이 완료되었습니다. 최신 서비스 정보를 불러왔습니다.');
    }catch(error){verified=false;setMsg(error.message,true)}
  });

  form.addEventListener('submit',event=>{
    event.preventDefault();event.stopImmediatePropagation();
    if(!verified)setMsg('먼저 인증번호 확인을 완료해 주세요.',true);
    else loadSecure().catch(error=>setMsg(error.message,true));
  },{capture:true});

  const actionForm=document.getElementById('customer-action-form');
  actionForm?.addEventListener('submit',async event=>{
    if(!verified)return;
    event.preventDefault();event.stopImmediatePropagation();
    const type=document.getElementById('customer-action-type')?.value||'MESSAGE';
    let note=String(document.getElementById('customer-action-note')?.value||'').trim();
    const preferredAt=type==='RESCHEDULE'?String(document.getElementById('customer-action-preferred')?.value||''):'';
    const actionMessage=document.getElementById('customer-action-message');
    if(note.length<3){if(actionMessage)actionMessage.textContent='요청 내용을 3자 이상 입력해 주세요.';return}
    try{
      const payloadType=type==='REVISIT'?'MESSAGE':type;
      if(type==='REVISIT')note=`[재방문 요청] ${note}`;
      if(demo){const data=window.NEXA_PORTAL_DEMO_REQUEST;data.customerActions.unshift({id:Date.now(),type:payloadType,state:'OPEN',note,preferredAt,resolution:'',createdAt:new Date().toISOString()});window.NEXA_PORTAL_RENDER(data);await renderHistory(data)}
      else{await request('/api/customer/access/action',{method:'POST',body:{type:payloadType,note,preferredAt}});await loadSecure()}
      const noteInput=document.getElementById('customer-action-note');if(noteInput)noteInput.value='';
      if(actionMessage)actionMessage.textContent=`${actionLabel({type:payloadType,note})}이 접수되었습니다.`;
    }catch(error){if(actionMessage)actionMessage.textContent=error.message}
  },{capture:true});

  const select=document.getElementById('customer-action-type');
  if(select&&!select.querySelector('[value="REVISIT"]')){const option=document.createElement('option');option.value='REVISIT';option.textContent='재방문 요청';select.append(option)}
})();
