export class ProviderError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
  }
}

function normalizeOutput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ProviderError('AI_OUTPUT_INVALID');
  const answer = String(value.answer ?? '').trim();
  const category = String(value.category ?? 'GENERAL').trim().toUpperCase().slice(0, 40);
  const risk = String(value.risk ?? 'MEDIUM').trim().toUpperCase();
  const confidence = Number(value.confidence);
  const recommendedAction = String(value.recommendedAction ?? '').trim().slice(0, 500);
  if (answer.length < 10 || answer.length > 8000) throw new ProviderError('AI_OUTPUT_INVALID');
  if (!['LOW','MEDIUM','HIGH'].includes(risk)) throw new ProviderError('AI_OUTPUT_INVALID');
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new ProviderError('AI_OUTPUT_INVALID');
  return { answer, category, risk, confidence, recommendedAction };
}

function promptFor(task, evidence) {
  const evidenceText = evidence.length
    ? evidence.map((item, index) => `[${index + 1}] ${item.title}\n${item.excerpt}`).join('\n\n')
    : '[No authorized evidence found]';
  return {
    system: [
      'You are an internal customer-support drafting assistant.',
      'Use only the authorized evidence supplied below.',
      'Never claim an action was completed. Never make a final business decision.',
      'If evidence is insufficient, say so and set risk to HIGH.',
      'Return JSON only with: answer, category, risk, confidence, recommendedAction.'
    ].join(' '),
    user: `Task title: ${task.title}\nTask content: ${task.content}\n\nAuthorized evidence:\n${evidenceText}`
  };
}

async function callProvider(provider, task, evidence, fetchImpl) {
  const baseUrl = String(provider.baseUrl ?? '').replace(/\/$/, '');
  const apiKey = String(provider.apiKey ?? '');
  const model = String(provider.model ?? '');
  if (!baseUrl || !apiKey || !model) throw new ProviderError('AI_PROVIDER_CONFIG_INVALID');
  const prompt = promptFor(task, evidence);
  let response;
  try {
    response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user }
        ]
      }),
      signal: AbortSignal.timeout(Math.max(1000, Number(provider.timeoutMs ?? 15_000)))
    });
  } catch (error) {
    throw new ProviderError(error?.name === 'TimeoutError' ? 'AI_PROVIDER_TIMEOUT' : 'AI_PROVIDER_NETWORK');
  }
  if (!response.ok) throw new ProviderError(`AI_PROVIDER_HTTP_${response.status}`);
  let payload;
  try { payload = await response.json(); } catch { throw new ProviderError('AI_PROVIDER_BAD_JSON'); }
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new ProviderError('AI_PROVIDER_BAD_SHAPE');
  let decoded;
  try { decoded = JSON.parse(content); } catch { throw new ProviderError('AI_OUTPUT_INVALID_JSON'); }
  return normalizeOutput(decoded);
}

export function createAiProviderChain({ providers, fetchImpl = globalThis.fetch } = {}) {
  const chain = Array.isArray(providers) ? providers.filter(Boolean) : [];
  if (!chain.length) throw new ProviderError('AI_PROVIDERS_REQUIRED');
  return {
    async generate({ task, evidence }) {
      const attempts = [];
      for (const provider of chain) {
        const id = String(provider.id ?? provider.model ?? 'provider').slice(0, 120);
        try {
          const output = await callProvider(provider, task, evidence, fetchImpl);
          const evidenceCoverage = evidence.length ? 1 : 0;
          const evaluation = {
            evidenceCoverage,
            requiresHumanReview: true,
            flags: [
              ...(evidence.length ? ['EVIDENCE_FOUND'] : ['NO_EVIDENCE']),
              ...(output.risk === 'HIGH' ? ['HIGH_RISK'] : []),
              ...(output.confidence < 0.7 ? ['LOW_CONFIDENCE'] : [])
            ]
          };
          attempts.push({ providerId:id, status:'SUCCESS' });
          return { providerId:id, output, evaluation, attempts };
        } catch (error) {
          attempts.push({ providerId:id, status:'FAILED', code:error?.code ?? 'AI_PROVIDER_FAILED' });
        }
      }
      const failure = new ProviderError('AI_ALL_PROVIDERS_FAILED');
      failure.attempts = attempts;
      throw failure;
    }
  };
}
