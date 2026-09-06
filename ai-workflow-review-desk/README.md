# AI Workflow Review Desk · V2

API Key 없이 기본 실행되는 **evidence-grounded AI integration + human review reference project**입니다.

V2는 V1의 structured output, provider fallback, risk evaluation, optimistic concurrency, human approval 경계를 유지하면서 **Local Knowledge Retrieval과 Evidence Audit**를 추가합니다.

```text
Task
  ↓
Local Knowledge
  ↓
Deterministic Retrieval
  ↓
Evidence Snapshot
  ↓
Prompt version
  ↓
Provider adapter
  ↓
Structured output validation
  ↓
Evaluation / evidence coverage / risk flags
  ↓
Human approve / reject / edit
  ↓
Run + Review + Evidence audit
```

## 왜 RAG를 추가했는가

업무용 AI는 답변을 생성하는 것만으로는 부족합니다.

실제 운영에서는 다음을 설명할 수 있어야 합니다.

- 어떤 내부 정책·Runbook을 근거로 제안했는가
- 검색 근거가 없는데도 AI가 확신하고 있지는 않은가
- 같은 요청을 다시 생성했을 때 어떤 근거 snapshot을 사용했는가
- 사람이 승인한 시점에 어떤 evidence를 보고 있었는가
- provider가 fallback돼도 retrieval context가 보존되는가
- 실제 credential 없이도 이 경계를 테스트할 수 있는가

V2는 이 질문을 공개 코드와 deterministic test로 보여줍니다.

## V2 기능

### Local Knowledge Base

`knowledge.mjs`

공개 데모용 가상 정책·Runbook을 코드에 포함합니다.

- Billing & Refund Review Policy
- Account Access & Permission Policy
- Excel & CSV Import Runbook
- Service Incident Response Runbook
- Security Escalation Policy
- General Service Routing Guide

실제 고객 문서나 비공개 사업 문서는 사용하지 않습니다.

### Deterministic Retrieval

질의를 정규화하고 토큰 기반 relevance score로 section을 정렬합니다.

결과에는 다음이 포함됩니다.

- source/document ID
- title
- section
- excerpt
- score
- matched terms
- rank
- query coverage

외부 vector DB, embedding API, web search를 사용하지 않으므로 공개 demo와 CI에서 항상 재현 가능합니다.

### Evidence-aware Generation

Generation은 task의 제목/본문으로 먼저 retrieval을 수행하고 같은 retrieval snapshot을 provider adapter에 전달합니다.

```text
Task → retrieveKnowledge() → Evidence → Provider
```

primary provider가 실패해 fallback provider가 실행돼도 evidence snapshot은 동일합니다.

### Evaluation

기존 risk/confidence 평가에 evidence 상태를 추가했습니다.

- `HIGH_RISK`
- `MEDIUM_RISK`
- `LOW_CONFIDENCE`
- `EVIDENCE_FOUND`
- `LOW_EVIDENCE_COVERAGE`
- `NO_EVIDENCE`
- `PROVIDER_FAILURE`

근거가 없으면 평가 점수를 낮추고 자동 신뢰하지 않도록 `NEEDS_REVIEW`로 보냅니다.

### Human Review + Evidence Audit

최종 승인/반려는 여전히 사람만 수행합니다.

Review record에는 기존 decision/output뿐 아니라 다음이 기록됩니다.

- evidence IDs
- evidence coverage
- reviewed task version
- reviewer
- edited 여부

따라서 “무슨 결과를 승인했는가”뿐 아니라 **“어떤 근거를 보고 승인했는가”**도 추적할 수 있습니다.

## Browser Live Lab

GitHub Pages에서 서버 없이 동작합니다.

- 업무 queue
- 신규 task 입력
- `triage-grounded-v2 / triage-v2 / triage-v1`
- deterministic local retrieval
- evidence rank/score/matched terms 표시
- provider fallback trace
- structured output editor
- category / risk / confidence
- evaluation score / flags / evidence coverage
- human approve / reject
- provider + evidence run history
- evidence-aware review audit
- local knowledge catalog
- 외부 network request 없음
- localStorage/sessionStorage 없음
- API Key 없음

## Node REST API reference

`server/app.mjs`

### Knowledge / Retrieval

- `GET /api/knowledge`
- `POST /api/retrieval`

예:

```json
{
  "query": "Excel import mapping schema failure",
  "limit": 3
}
```

### Workflow

- `GET /api/health`
- `GET /api/prompts`
- `GET /api/tasks`
- `POST /api/tasks`
- `POST /api/tasks/:id/generate`
- `POST /api/tasks/:id/review`
- `GET /api/runs`
- `GET /api/reviews`

주요 오류 계약:

- `400 INVALID_TASK`
- `400 INVALID_RETRIEVAL_QUERY`
- `400 EXPECTED_VERSION_REQUIRED`
- `400 INVALID_OUTPUT`
- `400 INVALID_JSON`
- `404 TASK_NOT_FOUND`
- `409 STALE_REVIEW`
- `409 TASK_FINALIZED`
- `409 INVALID_REVIEW_STATE`
- `413 BODY_TOO_LARGE`

## Human-in-the-loop 상태 머신

```text
PENDING
  ↓ generate + retrieval
GENERATED / NEEDS_REVIEW
  ├─ approve → APPROVED
  └─ reject  → REJECTED
```

다음 경우 `NEEDS_REVIEW`가 됩니다.

- HIGH risk
- evaluation score 80 미만
- matching evidence 없음

평가 결과가 좋아도 자동 `APPROVED`는 없습니다.

## Fallback 재현

```text
[FAIL_PRIMARY]
```

을 task에 넣으면:

```text
retrieval snapshot
      ↓
mock-primary:FAILED
      ↓ same evidence
mock-fallback:SUCCESS
```

`[FAIL_ALL]`은 provider 전체 실패를 재현합니다.

## Stale review 방어

REST review endpoint는 `expectedVersion`을 요구합니다.

현재 task version과 다르면:

```text
409 STALE_REVIEW
```

을 반환합니다. 오래된 화면에서 최신 결과를 덮어 승인하는 문제를 막습니다.

## 실제 RAG/AI provider로 확장할 때

공개 V2는 deterministic local knowledge + mock provider를 사용합니다.

실제 프로젝트에서는 경계를 유지한 채 다음 adapter를 교체할 수 있습니다.

```text
Local deterministic retrieval
        ↓ replace/add
Vector DB / Search / Document index

Mock provider
        ↓ replace/add
OpenAI / Claude / Gemini / Local model
```

원칙:

- API Key를 browser bundle에 넣지 않음
- server secret/environment에서 관리
- source ACL을 retrieval 전에 적용
- retrieved evidence ID/version을 run에 snapshot
- provider raw response를 바로 업무 데이터로 저장하지 않음
- structured schema validation 후 사용
- timeout/retry/rate-limit 정책 분리
- prompt version/provider/evidence를 audit에 기록
- 근거 부족·고위험 작업은 human approval 유지

## 실행

### Static Lab

GitHub Pages에서:

```text
/ai-workflow-review-desk/
```

### Node API

```bash
npm run start:ai-review-api
```

기본 주소:

```text
http://127.0.0.1:8790
```

## 테스트

루트에서:

```bash
npm test
```

검증 범위:

- local retrieval relevance/ranking
- evidence snapshot
- no-evidence routing
- structured output
- fallback + evidence preservation
- high-risk routing
- human review
- knowledge/retrieval HTTP API
- stale review 409
- finalized task regeneration 방어
- evidence-aware review audit
- credential pattern 비노출
- browser network/storage 비사용
- 전체 portfolio 회귀 테스트

## 포트폴리오에서 보여주는 역량

- RAG / retrieval architecture
- source evidence traceability
- local knowledge indexing boundary
- AI integration architecture
- structured output validation
- provider abstraction / fallback
- human-in-the-loop workflow
- prompt versioning
- evaluation / risk / evidence routing
- optimistic concurrency
- auditability
- REST API contract
- credential-free deterministic test design

## 공개 범위

이 프로젝트는 공개 포트폴리오용 가상 업무 데이터와 가상 정책 문서만 사용합니다.

- 실제 고객 데이터 없음
- 실제 API Key 없음
- 외부 AI/search API 호출 없음
- 비공개 사업 프로젝트 코드/구조/데이터 사용 없음
