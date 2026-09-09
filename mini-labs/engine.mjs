const txt = (value) => String(value ?? '').trim();

export const LIMITS = Object.freeze({
  contentTitle: 120,
  contentBody: 10000,
  textInputBytes: 100000,
  keyValueLines: 2000,
  csvRows: 5000,
  csvColumns: 100,
  workflowSteps: 30,
  selectorLength: 300,
  stepValueLength: 2000
});

const utf8Bytes = (value) => new TextEncoder().encode(String(value ?? '')).length;

function assertTextLimit(value, limit = LIMITS.textInputBytes, code = 'INPUT_TOO_LARGE') {
  if (utf8Bytes(value) > limit) throw new Error(code);
}

export function slugify(value) {
  return txt(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// CONTENT PREFLIGHT
export function validateContent(input = {}) {
  const title = txt(input.title);
  const body = txt(input.body);
  const slug = slugify(input.slug || title);
  assertTextLimit(body, LIMITS.contentBody * 4, 'BODY_TOO_LARGE');

  const errors = [];
  const warnings = [];
  if (title.length < 3 || title.length > LIMITS.contentTitle) errors.push('TITLE_LENGTH');
  if (body.length < 20 || body.length > LIMITS.contentBody) errors.push('BODY_LENGTH');
  if (!slug) errors.push('SLUG_REQUIRED');
  if (/\b(?:todo|tbd)\b/i.test(`${title}\n${body}`) || /\{\{[^}]+\}\}/.test(body)) warnings.push('PLACEHOLDER_FOUND');
  if ((body.match(/https?:\/\//g) || []).length > 20) warnings.push('LINK_DENSITY_HIGH');

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    content: { title, body, slug, status: input.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT' }
  };
}

export function publishContent(input) {
  const result = validateContent(input);
  if (!result.valid) throw new Error(`CONTENT_INVALID:${result.errors.join(',')}`);
  return { ...result.content, status: 'PUBLISHED', publishedAt: 'DETERMINISTIC-LOCAL' };
}

// DATA EXTRACTOR
export function parseKeyValueText(source) {
  assertTextLimit(source);
  const lines = String(source ?? '').split(/\r?\n/);
  if (lines.length > LIMITS.keyValueLines) throw new Error('TOO_MANY_LINES');
  const out = {};
  for (const line of lines) {
    if (!line.trim()) continue;
    const match = line.match(/^\s*([^:]{1,60})\s*:\s*(.*?)\s*$/);
    if (!match) continue;
    const key = slugify(match[1]).replaceAll('-', '_');
    if (!key) continue;
    if (key in out) throw new Error(`DUPLICATE_KEY:${key}`);
    out[key] = match[2].slice(0, 1000);
  }
  return out;
}

export function parseCsvMatrix(source) {
  assertTextLimit(source);
  const input = String(source ?? '').replace(/^\uFEFF/, '');
  if (!input.trim()) return [];

  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ',') {
      row.push(field.trim());
      field = '';
    } else if (char === '\n') {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (quoted) throw new Error('UNCLOSED_QUOTE');
  row.push(field.trim());
  if (row.some((value) => value !== '') || rows.length === 0) rows.push(row);
  return rows.filter((items) => items.some((value) => value !== ''));
}

export function extractTableRows(csv) {
  const matrix = parseCsvMatrix(csv);
  if (!matrix.length) return [];
  if (matrix.length - 1 > LIMITS.csvRows) throw new Error('TOO_MANY_ROWS');
  const headers = matrix[0].map(txt);
  if (headers.length > LIMITS.csvColumns) throw new Error('TOO_MANY_COLUMNS');
  if (headers.some((value) => !value) || new Set(headers).size !== headers.length) throw new Error('INVALID_HEADERS');

  return matrix.slice(1).map((values, rowIndex) => {
    if (values.length !== headers.length) throw new Error(`COLUMN_MISMATCH:${rowIndex + 2}`);
    return Object.fromEntries(headers.map((header, index) => [header, txt(values[index])]));
  });
}

export function extractionSummary(source, csv) {
  const values = parseKeyValueText(source);
  const rows = extractTableRows(csv);
  return {
    values,
    rows,
    counts: { fields: Object.keys(values).length, rows: rows.length, columns: rows.length ? Object.keys(rows[0]).length : 0 }
  };
}

// WORKFLOW DRY-RUN — validates and simulates only. It never navigates or sends network requests.
const STEP_TYPES = new Set(['NAVIGATE', 'INPUT', 'CLICK', 'ASSERT_TEXT', 'WAIT_FOR']);

function isPrivateHost(hostname) {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local')) return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^169\.254\./.test(host) || /^192\.168\./.test(host)) return true;
  const match = host.match(/^172\.(\d{1,3})\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

export function validateAutomationPlan(plan) {
  if (!Array.isArray(plan) || plan.length < 1 || plan.length > LIMITS.workflowSteps) throw new Error('PLAN_LENGTH');
  const ids = new Set();
  return plan.map((step, index) => {
    const id = txt(step?.id || `step-${index + 1}`);
    const type = txt(step?.type).toUpperCase();
    const target = txt(step?.target);
    const value = txt(step?.value);
    if (!id || id.length > 80) throw new Error('INVALID_STEP_ID');
    if (ids.has(id)) throw new Error('DUPLICATE_STEP_ID');
    ids.add(id);
    if (!STEP_TYPES.has(type)) throw new Error('UNSUPPORTED_STEP');
    if (!target || target.length > LIMITS.selectorLength) throw new Error('TARGET_REQUIRED');
    if (value.length > LIMITS.stepValueLength) throw new Error('STEP_VALUE_TOO_LARGE');

    if (type === 'NAVIGATE') {
      let url;
      try { url = new URL(target); } catch { throw new Error('INVALID_URL'); }
      if (url.protocol !== 'https:' || url.username || url.password || isPrivateHost(url.hostname)) throw new Error('NAVIGATION_NOT_SAFE');
    }
    return { id, type, target, value };
  });
}

export function simulateAutomation(plan, options = {}) {
  const validated = validateAutomationPlan(plan);
  const failAt = txt(options.failAt);
  const events = [];
  for (const step of validated) {
    if (step.id === failAt) {
      events.push({ stepId: step.id, type: step.type, status: 'FAILED', error: 'SIMULATED_FAILURE' });
      return { status: 'FAILED', events, completed: events.filter((event) => event.status === 'SUCCESS').length, total: validated.length };
    }
    events.push({ stepId: step.id, type: step.type, status: 'SUCCESS' });
  }
  return { status: 'SUCCESS', events, completed: events.length, total: validated.length };
}

// SECURITY CHECK
export function isAllowedOrigin(origin, allowed = ['https://example.com']) {
  try {
    const url = new URL(origin);
    return url.protocol === 'https:' && allowed.includes(url.origin);
  } catch {
    return false;
  }
}

export function safeRedirect(value, base = 'https://example.com') {
  try {
    const target = new URL(value, base);
    const origin = new URL(base).origin;
    if (target.origin !== origin) return '/';
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return '/';
  }
}

export function maskSecret(value) {
  const secret = String(value ?? '');
  if (!secret) return '(비어 있음)';
  if (secret.length <= 4) return '*'.repeat(secret.length);
  return `${secret.slice(0, 2)}${'*'.repeat(Math.min(12, secret.length - 4))}${secret.slice(-2)}`;
}

export function safeSpreadsheetCell(value) {
  const source = String(value ?? '');
  return /^[=+\-@]/.test(source) ? `'${source}` : source;
}

export function securityHeaders() {
  return {
    'content-security-policy': "default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()'
  };
}

export function auditSecurityInputs(input = {}) {
  const allowedOrigin = txt(input.allowedOrigin || 'https://example.com');
  const origin = txt(input.origin);
  const base = txt(input.base || allowedOrigin);
  const redirect = txt(input.redirect);
  const cell = String(input.spreadsheetCell ?? '');
  const secret = String(input.secret ?? '');
  const safeCell = safeSpreadsheetCell(cell);
  const normalizedRedirect = safeRedirect(redirect, base);
  const findings = [
    { id: 'origin', ok: isAllowedOrigin(origin, [allowedOrigin]), label: 'Origin exact match' },
    { id: 'redirect', ok: normalizedRedirect !== '/', label: 'Same-origin redirect' },
    { id: 'spreadsheet', ok: safeCell === cell, label: 'Spreadsheet formula risk absent' },
    { id: 'secret', ok: secret.length >= 8, label: 'Secret length baseline' }
  ];
  return {
    pass: findings.every((finding) => finding.ok),
    findings,
    normalizedRedirect,
    safeCell,
    maskedSecret: maskSecret(secret),
    headers: securityHeaders()
  };
}

// RELEASE GATE
export function evaluateRelease(input = {}) {
  const checks = [
    ['tests', Boolean(input.tests)],
    ['build', Boolean(input.build)],
    ['secretScan', Boolean(input.secretScan)],
    ['healthCheck', Boolean(input.healthCheck)],
    ['rollbackPlan', Boolean(input.rollbackPlan)]
  ];
  const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
  const warnings = [];
  if (!input.observability) warnings.push('OBSERVABILITY_MISSING');
  if (!input.backupVerified) warnings.push('BACKUP_NOT_VERIFIED');
  return { ready: failed.length === 0, failed, warnings, score: Math.round(((checks.length - failed.length) / checks.length) * 100) };
}

export function deploymentDecision(input = {}) {
  const result = input && Array.isArray(input.failed) && typeof input.ready === 'boolean' ? input : evaluateRelease(input);
  return { ...result, decision: result.ready ? 'GO' : 'NO_GO', reason: result.ready ? 'required release gates passed' : `blocked by ${result.failed.join(', ')}` };
}

function compactDetails(value, depth = 0) {
  if (depth > 4) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => compactDetails(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 50).map(([key, item]) => [key, compactDetails(item, depth + 1)]));
  }
  if (typeof value === 'string') return value.slice(0, 2000);
  return value;
}

function hashText(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function createEvidence({ tool, status, summary, details = {}, generatedAt = new Date().toISOString() }) {
  const core = {
    schemaVersion: 1,
    product: 'OPS KIT',
    tool: txt(tool),
    status: txt(status),
    summary: txt(summary).slice(0, 500),
    generatedAt,
    details: compactDetails(details)
  };
  return { ...core, fingerprint: hashText(JSON.stringify(core)) };
}

export function evidenceToJson(evidence) {
  return `${JSON.stringify(evidence, null, 2)}\n`;
}
