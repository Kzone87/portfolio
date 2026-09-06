const RAW_DOCUMENTS = [
  {
    id: 'billing-refund-policy',
    title: 'Billing & Refund Review Policy',
    category: 'billing',
    tags: ['invoice', 'payment', 'charge', 'refund', 'duplicate', '결제', '청구', '환불', '중복'],
    sections: [
      {
        id: 'duplicate-charge',
        title: 'Duplicate charge review',
        text: 'When a customer reports a duplicate charge, verify the invoice number, payment reference, charge timestamps, and transaction amount before proposing a refund. A refund decision requires a human billing owner.'
      },
      {
        id: 'refund-evidence',
        title: 'Evidence required for refund',
        text: 'Keep the original invoice and payment reference in the case record. Do not promise a refund until the transaction has been matched and a billing owner has approved the decision.'
      }
    ]
  },
  {
    id: 'access-account-policy',
    title: 'Account Access & Permission Policy',
    category: 'access',
    tags: ['login', 'password', 'permission', 'account', 'identity', 'production', '로그인', '비밀번호', '권한', '계정', '운영'],
    sections: [
      {
        id: 'identity-first',
        title: 'Verify identity before access changes',
        text: 'Before resetting credentials or changing permissions, verify the requester identity and the target account. Production access changes require an authorized owner and should be recorded in the audit trail.'
      },
      {
        id: 'least-privilege',
        title: 'Least privilege',
        text: 'Grant only the minimum permission required for the work. Temporary elevated access should have an owner, reason, and review point instead of remaining open-ended.'
      }
    ]
  },
  {
    id: 'data-import-runbook',
    title: 'Excel & CSV Import Runbook',
    category: 'data',
    tags: ['excel', 'csv', 'import', 'mapping', 'header', 'schema', 'validation', '엑셀', '데이터', '매핑', '업로드'],
    sections: [
      {
        id: 'schema-check',
        title: 'Validate schema before import',
        text: 'Compare incoming column headers with the expected schema before importing. Unknown, missing, or renamed columns should be reported explicitly instead of silently shifted into another field.'
      },
      {
        id: 'safe-sample',
        title: 'Reproduce with a safe sample',
        text: 'Use a small non-sensitive sample to reproduce an import failure. Validate required fields, data types, duplicate keys, and mapping rules before processing the complete file.'
      }
    ]
  },
  {
    id: 'incident-response-runbook',
    title: 'Service Incident Response Runbook',
    category: 'incident',
    tags: ['outage', 'down', 'error', 'fail', 'production', 'health', 'rollback', '장애', '오류', '실패', '접속불가'],
    sections: [
      {
        id: 'triage',
        title: 'Incident triage',
        text: 'For a service outage or production error, capture the affected service, start time, visible error, reproduction steps, and recent deployment changes. Check service health before applying a change.'
      },
      {
        id: 'change-safety',
        title: 'Change safety',
        text: 'Avoid destructive fixes during incident triage. Prefer reversible mitigation and keep a rollback path. Escalate when the impact or root cause is uncertain.'
      }
    ]
  },
  {
    id: 'security-escalation-policy',
    title: 'Security Escalation Policy',
    category: 'security',
    tags: ['security', 'breach', 'leak', 'fraud', 'credential', '보안', '유출', '사기', '침해'],
    sections: [
      {
        id: 'suspected-breach',
        title: 'Suspected breach or leak',
        text: 'A suspected security breach, credential leak, fraud event, or customer-data exposure must be escalated to a human security owner. Do not automatically delete records, rotate unrelated systems, or communicate an unverified root cause.'
      },
      {
        id: 'preserve-evidence',
        title: 'Preserve evidence',
        text: 'Preserve relevant timestamps, logs, affected account identifiers, and the original report. Limit access to the incident record and record each containment decision.'
      }
    ]
  },
  {
    id: 'service-routing-guide',
    title: 'General Service Routing Guide',
    category: 'general',
    tags: ['owner', 'route', 'support', '담당', '문의'],
    sections: [
      {
        id: 'minimum-context',
        title: 'Minimum request context',
        text: 'Before assigning a request, capture the requester goal, affected system or process, urgency, and the evidence already available. Ask for missing context instead of inventing details.'
      }
    ]
  }
];

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'before', 'can', 'for', 'from', 'has', 'have', 'in', 'into', 'is', 'it', 'of', 'on', 'or', 'the', 'to', 'with',
  'customer', 'customers', 'report', 'reports', 'reported', 'request', 'requester', 'requests', 'require', 'required', 'requires', 'review', 'task', 'issue', 'problem', 'unrelated',
  '고객', '요청', '검토', '업무', '문제'
]);

const MIN_EVIDENCE_SCORE = 4;

function normalize(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase('en-US').trim();
}

function tokenize(value) {
  return [...new Set(normalize(value).match(/[\p{L}\p{N}]+/gu) ?? [])]
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

function clip(value, max = 240) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length <= max ? text : `${text.slice(0, max - 3)}...`;
}

export const KNOWLEDGE_DOCUMENTS = Object.freeze(RAW_DOCUMENTS.map((document) => Object.freeze({
  ...document,
  tags: Object.freeze([...document.tags]),
  sections: Object.freeze(document.sections.map((section) => Object.freeze({ ...section })))
})));

export function listKnowledgeDocuments() {
  return KNOWLEDGE_DOCUMENTS.map((document) => ({
    id: document.id,
    title: document.title,
    category: document.category,
    tags: [...document.tags],
    sectionCount: document.sections.length
  }));
}

export function retrieveKnowledge(query, options = {}) {
  const normalizedQuery = normalize(query);
  const queryTokens = tokenize(query);
  const requestedLimit = Number(options.limit ?? 3);
  const limit = Number.isInteger(requestedLimit) ? Math.max(1, Math.min(5, requestedLimit)) : 3;

  if (!normalizedQuery || queryTokens.length === 0) {
    return { query: String(query ?? ''), queryTokens: [], coverage: 0, evidence: [] };
  }

  const candidates = [];
  for (const document of KNOWLEDGE_DOCUMENTS) {
    const titleTokens = new Set(tokenize(document.title));
    const tagTokens = new Set(document.tags.flatMap(tokenize));
    for (const section of document.sections) {
      const sectionTokens = new Set(tokenize(`${section.title} ${section.text}`));
      const matchedTerms = [];
      let score = 0;
      for (const token of queryTokens) {
        let matched = false;
        if (titleTokens.has(token)) {
          score += 5;
          matched = true;
        }
        if (tagTokens.has(token)) {
          score += 4;
          matched = true;
        }
        if (sectionTokens.has(token)) {
          score += 2;
          matched = true;
        }
        if (matched) matchedTerms.push(token);
      }
      if (normalizedQuery.length >= 8 && normalize(section.text).includes(normalizedQuery)) score += 8;
      if (score >= MIN_EVIDENCE_SCORE) {
        candidates.push({
          id: `${document.id}#${section.id}`,
          documentId: document.id,
          title: document.title,
          section: section.title,
          category: document.category,
          excerpt: clip(section.text),
          score,
          matchedTerms: [...new Set(matchedTerms)]
        });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score || b.matchedTerms.length - a.matchedTerms.length || a.id.localeCompare(b.id));
  const evidence = candidates.slice(0, limit).map((item, index) => ({ ...item, rank: index + 1 }));
  const coveredTerms = new Set(evidence.flatMap((item) => item.matchedTerms));
  const coverage = queryTokens.length ? Number((coveredTerms.size / queryTokens.length).toFixed(2)) : 0;
  return { query: String(query ?? ''), queryTokens, coverage, evidence };
}
