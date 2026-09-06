const RAW_DOCUMENTS = [
  {
    id: 'billing-refund-policy', title: '결제·환불 확인 기준', category: 'billing',
    tags: ['invoice','payment','charge','refund','duplicate','결제','청구','환불','중복'],
    sections: [
      { id:'duplicate-charge', title:'중복 결제 문의 확인', text:'고객이 중복 결제를 문의하면 청구서 번호, 결제 참조번호, 결제 시각, 금액을 먼저 대조합니다. 실제 환불 결정은 담당자가 거래내역을 확인한 뒤 승인합니다.' },
      { id:'refund-evidence', title:'환불 전에 남겨야 할 자료', text:'원본 청구서와 결제 참조정보를 문의 기록에 함께 남깁니다. 거래내역이 일치하고 담당자가 확인하기 전에는 환불 완료를 확정하지 않습니다.' }
    ]
  },
  {
    id: 'access-account-policy', title: '계정·권한 변경 확인 기준', category: 'access',
    tags: ['login','password','permission','account','identity','production','로그인','비밀번호','권한','계정','운영'],
    sections: [
      { id:'identity-first', title:'권한 변경 전 사용자 확인', text:'비밀번호 초기화나 권한 변경 전 요청자와 대상 계정을 확인합니다. 중요한 계정의 권한 변경은 승인 가능한 담당자를 확인하고 처리 기록을 남깁니다.' },
      { id:'least-privilege', title:'필요한 권한만 부여', text:'업무에 필요한 최소 권한만 부여합니다. 임시로 높은 권한이 필요한 경우 담당자, 사유, 다시 확인할 시점을 함께 기록합니다.' }
    ]
  },
  {
    id: 'data-import-runbook', title: 'Excel·CSV 업로드 점검 순서', category: 'data',
    tags: ['excel','csv','import','mapping','header','schema','validation','엑셀','데이터','매핑','업로드'],
    sections: [
      { id:'schema-check', title:'컬럼명 먼저 확인', text:'Excel이나 CSV를 불러오기 전에 들어온 컬럼명과 필요한 컬럼을 비교합니다. 빠진 컬럼이나 이름이 바뀐 컬럼은 다른 값으로 임의 처리하지 않고 사용자에게 표시합니다.' },
      { id:'safe-sample', title:'작은 샘플로 먼저 재현', text:'민감정보가 없는 작은 샘플 파일로 업로드 오류를 먼저 재현합니다. 필수값, 데이터 형식, 중복 키, 컬럼 연결 상태를 확인한 뒤 전체 파일을 처리합니다.' }
    ]
  },
  {
    id: 'incident-response-runbook', title: '서비스 오류 대응 순서', category: 'incident',
    tags: ['outage','down','error','fail','production','health','rollback','장애','오류','실패','접속불가'],
    sections: [
      { id:'triage', title:'오류 상황 먼저 정리', text:'서비스 오류가 발생하면 영향을 받은 기능, 시작 시각, 화면에 보이는 오류, 재현 순서, 최근 변경사항을 먼저 기록합니다. 변경하기 전에 현재 서비스 상태를 확인합니다.' },
      { id:'change-safety', title:'되돌릴 수 있는 조치 우선', text:'원인이 확인되지 않은 상태에서 데이터를 삭제하거나 큰 변경을 바로 적용하지 않습니다. 되돌릴 수 있는 임시 조치를 우선하고 영향이 크면 담당자가 추가 확인합니다.' }
    ]
  },
  {
    id: 'security-escalation-policy', title: '보안 의심 문의 처리 기준', category: 'security',
    tags: ['security','breach','leak','fraud','credential','보안','유출','사기','침해'],
    sections: [
      { id:'suspected-breach', title:'유출·이상거래 의심 시 담당자 확인', text:'계정정보 유출, 이상거래, 고객정보 노출이 의심되면 자동으로 결론 내리지 않고 보안 담당자가 확인하도록 전달합니다. 확인되지 않은 원인을 고객에게 확정해 안내하지 않습니다.' },
      { id:'preserve-evidence', title:'원본 정보 보존', text:'발생 시각, 관련 계정, 원문 신고내용, 필요한 기록을 보존합니다. 확인 과정에서 누가 어떤 조치를 했는지도 함께 남깁니다.' }
    ]
  },
  {
    id: 'service-routing-guide', title: '일반 문의 접수 기준', category: 'general',
    tags: ['owner','route','support','담당','문의'],
    sections: [
      { id:'minimum-context', title:'담당자 배정 전 필요한 내용', text:'문의 목적, 영향을 받는 업무, 긴급도, 이미 확인한 내용을 먼저 정리합니다. 정보가 부족하면 임의로 추측하지 않고 필요한 내용을 다시 요청합니다.' }
    ]
  }
];

const STOPWORDS = new Set([
  'a','an','and','are','as','at','be','before','can','for','from','has','have','in','into','is','it','of','on','or','the','to','with',
  'customer','customers','report','reports','reported','request','requester','requests','require','required','requires','review','task','issue','problem','unrelated',
  '고객','요청','검토','업무','문제'
]);
const MIN_EVIDENCE_SCORE = 4;
function normalize(value){return String(value??'').normalize('NFKC').toLocaleLowerCase('en-US').trim();}
function tokenize(value){return [...new Set(normalize(value).match(/[\p{L}\p{N}]+/gu)??[])].filter(token=>token.length>1&&!STOPWORDS.has(token));}
function clip(value,max=240){const text=String(value??'').replace(/\s+/g,' ').trim();return text.length<=max?text:`${text.slice(0,max-3)}...`;}
export const KNOWLEDGE_DOCUMENTS=Object.freeze(RAW_DOCUMENTS.map(document=>Object.freeze({...document,tags:Object.freeze([...document.tags]),sections:Object.freeze(document.sections.map(section=>Object.freeze({...section})))})));
export function listKnowledgeDocuments(){return KNOWLEDGE_DOCUMENTS.map(document=>({id:document.id,title:document.title,category:document.category,tags:[...document.tags],sectionCount:document.sections.length}));}
export function retrieveKnowledge(query,options={}){const normalizedQuery=normalize(query),queryTokens=tokenize(query),requestedLimit=Number(options.limit??3),limit=Number.isInteger(requestedLimit)?Math.max(1,Math.min(5,requestedLimit)):3;if(!normalizedQuery||queryTokens.length===0)return{query:String(query??''),queryTokens:[],coverage:0,evidence:[]};const candidates=[];for(const document of KNOWLEDGE_DOCUMENTS){const titleTokens=new Set(tokenize(document.title)),tagTokens=new Set(document.tags.flatMap(tokenize));for(const section of document.sections){const sectionTokens=new Set(tokenize(`${section.title} ${section.text}`)),matchedTerms=[];let score=0;for(const token of queryTokens){let matched=false;if(titleTokens.has(token)){score+=5;matched=true;}if(tagTokens.has(token)){score+=4;matched=true;}if(sectionTokens.has(token)){score+=2;matched=true;}if(matched)matchedTerms.push(token);}if(normalizedQuery.length>=8&&normalize(section.text).includes(normalizedQuery))score+=8;if(score>=MIN_EVIDENCE_SCORE)candidates.push({id:`${document.id}#${section.id}`,documentId:document.id,title:document.title,section:section.title,category:document.category,excerpt:clip(section.text),score,matchedTerms:[...new Set(matchedTerms)]});}}
candidates.sort((a,b)=>b.score-a.score||b.matchedTerms.length-a.matchedTerms.length||a.id.localeCompare(b.id));const evidence=candidates.slice(0,limit).map((item,index)=>({...item,rank:index+1}));const coveredTerms=new Set(evidence.flatMap(item=>item.matchedTerms));const coverage=queryTokens.length?Number((coveredTerms.size/queryTokens.length).toFixed(2)):0;return{query:String(query??''),queryTokens,coverage,evidence};}
