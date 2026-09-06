import { retrieveKnowledge } from './knowledge.mjs';

export const TASK_STATUS = Object.freeze({
  PENDING: 'PENDING',
  GENERATED: 'GENERATED',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
});

export const RUN_STATUS = Object.freeze({
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED'
});

export const PROMPTS = Object.freeze({
  'triage-v1': {
    id: 'triage-v1',
    label: 'Support triage v1',
    description: 'Summarize an inbound request, classify it, assess risk, and propose the next action.'
  },
  'triage-v2': {
    id: 'triage-v2',
    label: 'Support triage v2',
    description: 'Adds stronger risk detection and more conservative confidence scoring.'
  },
  'triage-grounded-v2': {
    id: 'triage-grounded-v2',
    label: 'Evidence-grounded triage v2',
    description: 'Retrieves local policy evidence before generation and records the evidence snapshot with the run.'
  }
});

const CATEGORY_RULES = [
  ['security', ['security', 'breach', 'leak', 'fraud', 'credential', '보안', '유출', '사기', '침해']],
  ['billing', ['invoice', 'payment', 'refund', 'charge', 'billing', '결제', '환불', '청구']],
  ['access', ['login', 'password', 'permission', 'account', '로그인', '비밀번호', '권한', '계정']],
  ['data', ['excel', 'csv', 'import', 'export', 'mapping', '엑셀', '데이터', '업로드', '다운로드']],
  ['incident', ['down', 'error', 'broken', 'outage', 'fail', '장애', '오류', '실패', '접속불가']],
  ['general', []]
];

const HIGH_RISK = ['security', 'breach', 'leak', 'delete all', 'fraud', '보안', '유출', '전체삭제', '사기', '침해'];
const MEDIUM_RISK = ['urgent', 'production', 'money', 'deadline', '긴급', '운영', '금액', '마감'];

function normalizeText(value) {
  return String(value ?? '').trim();
}

function lower(value) {
  return normalizeText(value).toLocaleLowerCase('en-US');
}

function includesAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function classify(text) {
  const normalized = lower(text);
  for (const [category, words] of CATEGORY_RULES) {
    if (words.length === 0 || includesAny(normalized, words)) return category;
  }
  return 'general';
}

function assessRisk(text) {
  const normalized = lower(text);
  if (includesAny(normalized, HIGH_RISK)) return 'HIGH';
  if (includesAny(normalized, MEDIUM_RISK)) return 'MEDIUM';
  return 'LOW';
}

function buildSummary(text) {
  const cleaned = normalizeText(text).replace(/\s+/g, ' ');
  if (!cleaned) return 'No request content provided.';
  return cleaned.length > 120 ? `${cleaned.slice(0, 117)}...` : cleaned;
}

function buildBaseAction(category, risk) {
  if (risk === 'HIGH') return 'Escalate to a human owner before any automated action.';
  if (category === 'security') return 'Preserve evidence and route the case to a human security owner.';
  if (category === 'billing') return 'Verify transaction details and route to billing support.';
  if (category === 'access') return 'Verify identity and account state before changing access.';
  if (category === 'incident') return 'Collect reproduction details and check service health.';
  if (category === 'data') return 'Validate the input format and reproduce with a safe sample.';
  return 'Review the request and assign it to the appropriate owner.';
}

function buildAction(category, risk, retrieval) {
  const base = buildBaseAction(category, risk);
  const top = retrieval?.evidence?.[0];
  if (!top) return `${base} No matching local evidence was found, so confirm the decision manually.`;
  const grounded = `${base} Use “${top.title} / ${top.section}” as the supporting local evidence.`;
  return grounded.length > 300 ? grounded.slice(0, 300) : grounded;
}

function confidenceFor({ text, risk, promptVersion }) {
  const length = normalizeText(text).length;
  let score = length >= 40 ? 92 : length >= 15 ? 84 : 72;
  if (risk === 'HIGH') score -= 18;
  if (risk === 'MEDIUM') score -= 7;
  if (promptVersion === 'triage-v2' || promptVersion === 'triage-grounded-v2') score += risk === 'LOW' ? 2 : -2;
  return Math.max(45, Math.min(97, score));
}

export function validateTaskInput(input) {
  const title = normalizeText(input?.title);
  const content = normalizeText(input?.content);
  if (title.length < 2 || title.length > 100) throw new Error('title must be 2-100 characters');
  if (content.length < 5 || content.length > 4000) throw new Error('content must be 5-4000 characters');
  return { title, content };
}

export function validateStructuredOutput(output) {
  const allowedCategories = new Set(['billing', 'access', 'incident', 'data', 'security', 'general']);
  const allowedRisks = new Set(['LOW', 'MEDIUM', 'HIGH']);
  if (!output || typeof output !== 'object') return false;
  if (typeof output.summary !== 'string' || output.summary.length < 1 || output.summary.length > 300) return false;
  if (!allowedCategories.has(output.category)) return false;
  if (!allowedRisks.has(output.risk)) return false;
  if (typeof output.nextAction !== 'string' || output.nextAction.length < 1 || output.nextAction.length > 300) return false;
  if (!Number.isInteger(output.confidence) || output.confidence < 0 || output.confidence > 100) return false;
  return true;
}

export function evaluateOutput(output, retrieval = null) {
  if (!validateStructuredOutput(output)) {
    return { score: 0, flags: ['SCHEMA_INVALID'], requiresHumanReview: true };
  }
  const flags = [];
  let score = output.confidence;
  if (output.risk === 'HIGH') {
    score -= 20;
    flags.push('HIGH_RISK');
  } else if (output.risk === 'MEDIUM') {
    score -= 8;
    flags.push('MEDIUM_RISK');
  }
  if (output.confidence < 80) flags.push('LOW_CONFIDENCE');

  if (retrieval) {
    if (!Array.isArray(retrieval.evidence) || retrieval.evidence.length === 0) {
      score -= 18;
      flags.push('NO_EVIDENCE');
    } else {
      flags.push('EVIDENCE_FOUND');
      if (retrieval.coverage < 0.25) {
        score -= 10;
        flags.push('LOW_EVIDENCE_COVERAGE');
      }
    }
  }

  score = Math.max(0, Math.min(100, score));
  return {
    score,
    flags,
    requiresHumanReview: true
  };
}

function mockGenerate(task, promptVersion, providerId, retrieval) {
  const content = normalizeText(task.content);
  if (providerId === 'mock-primary' && content.includes('[FAIL_PRIMARY]')) {
    throw new Error('simulated primary provider failure');
  }
  if (providerId === 'mock-fallback' && content.includes('[FAIL_ALL]')) {
    throw new Error('simulated fallback provider failure');
  }
  const risk = assessRisk(content);
  const category = classify(content);
  const output = {
    summary: buildSummary(content.replaceAll('[FAIL_PRIMARY]', '').replaceAll('[FAIL_ALL]', '').trim()),
    category,
    risk,
    nextAction: buildAction(category, risk, retrieval),
    confidence: confidenceFor({ text: content, risk, promptVersion })
  };
  if (!validateStructuredOutput(output)) throw new Error('provider returned invalid structured output');
  return output;
}

export const PROVIDERS = Object.freeze({
  'mock-primary': {
    id: 'mock-primary',
    label: 'Deterministic Mock Primary',
    generate: (task, promptVersion, retrieval) => mockGenerate(task, promptVersion, 'mock-primary', retrieval)
  },
  'mock-fallback': {
    id: 'mock-fallback',
    label: 'Deterministic Mock Fallback',
    generate: (task, promptVersion, retrieval) => mockGenerate(task, promptVersion, 'mock-fallback', retrieval)
  }
});

export function runGeneration(task, options = {}) {
  const promptVersion = PROMPTS[options.promptVersion] ? options.promptVersion : 'triage-grounded-v2';
  const providerOrder = Array.isArray(options.providerOrder) && options.providerOrder.length
    ? options.providerOrder.filter((id) => PROVIDERS[id])
    : ['mock-primary', 'mock-fallback'];
  const retrieval = retrieveKnowledge(`${task.title ?? ''} ${task.content ?? ''}`, { limit: 3 });

  const attempts = [];
  for (const providerId of providerOrder) {
    try {
      const output = PROVIDERS[providerId].generate(task, promptVersion, retrieval);
      const evaluation = evaluateOutput(output, retrieval);
      return {
        status: RUN_STATUS.SUCCESS,
        providerId,
        promptVersion,
        output,
        evaluation,
        retrieval,
        attempts: [...attempts, { providerId, status: RUN_STATUS.SUCCESS }]
      };
    } catch (error) {
      attempts.push({ providerId, status: RUN_STATUS.FAILED, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return {
    status: RUN_STATUS.FAILED,
    providerId: null,
    promptVersion,
    output: null,
    evaluation: { score: 0, flags: ['PROVIDER_FAILURE'], requiresHumanReview: true },
    retrieval,
    attempts
  };
}

export function nextTaskStatus(run) {
  if (run.status !== RUN_STATUS.SUCCESS) return TASK_STATUS.PENDING;
  if (!run.retrieval?.evidence?.length) return TASK_STATUS.NEEDS_REVIEW;
  if (run.output.risk === 'HIGH' || run.evaluation.score < 80) return TASK_STATUS.NEEDS_REVIEW;
  return TASK_STATUS.GENERATED;
}

export function applyHumanReview(task, decision, editedOutput = null) {
  if (![TASK_STATUS.GENERATED, TASK_STATUS.NEEDS_REVIEW].includes(task.status)) {
    throw new Error('task is not ready for review');
  }
  if (!['APPROVE', 'REJECT'].includes(decision)) throw new Error('unsupported review decision');
  const output = editedOutput ?? task.output;
  if (decision === 'APPROVE' && !validateStructuredOutput(output)) throw new Error('approved output must match the schema');
  return {
    ...task,
    output,
    status: decision === 'APPROVE' ? TASK_STATUS.APPROVED : TASK_STATUS.REJECTED,
    version: task.version + 1
  };
}