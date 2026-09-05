# AI Workflow Review Desk · V1

API Key 없이 기본 실행되는 **AI integration + human review reference project**입니다.

실제 AI provider를 호출하지 않고 deterministic mock provider를 사용하지만, 업무 시스템에 AI를 붙일 때 필요한 핵심 경계를 그대로 분리합니다.

```text
Task
  ↓
Prompt version
  ↓
Provider adapter
  ↓
Structured output validation
  ↓
Evaluation / risk flags
  ↓
Human approve / reject / edit
  ↓
Run + Review audit
```

## 왜 이 프로젝트를 만들었는가

외주에서 AI 기능은 단순히 모델 API를 한 번 호출하는 것으로 끝나지 않습니다.

운영 가능한 기능이 되려면 다음 문제가 함께 해결돼야 합니다.

- 모델 출력 형식이 깨졌을 때 어떻게 막을지
- primary provider가 실패하면 어떻게 fallback할지
- 어떤 prompt/version으로 생성했는지 어떻게 기록할지
- 위험도가 높은 결과를 자동 처리하지 않고 어떻게 사람에게 넘길지
- 사람이 수정/승인/반려한 결과를 어떻게 추적할지
- 같은 업무를 동시에 검토했을 때 stale decision을 어떻게 막을지
- 공개 demo에서 credential을 어떻게 분리할지

이 프로젝트는 그 경계를 공개 코드로 보여주는 사례입니다.

## V1 기능

### Browser Live Lab

- 업무 queue
- 신규 task 입력
- `triage-v1 / triage-v2` prompt 선택
- deterministic mock generation
- primary → fallback provider
- structured output editor
- category / risk / confidence
- evaluation score / flags
- human approve / reject
- run history
- review audit
- 외부 network request 없음
- localStorage/sessionStorage 없음
- API Key 없음

### Engine

`engine.mjs`

- task input validation
- structured output schema validation
- deterministic provider adapter registry
- provider fallback
- risk classification
- confidence calculation
- evaluation
- review state machine

### Node REST API reference

`server/app.mjs`

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
- `400 EXPECTED_VERSION_REQUIRED`
- `400 INVALID_OUTPUT`
- `404 TASK_NOT_FOUND`
- `409 STALE_REVIEW`
- `409 TASK_FINALIZED`
- `409 INVALID_REVIEW_STATE`

## Human-in-the-loop 원칙

V1에서는 AI output을 자동 승인하지 않습니다.

평가 결과가 좋아도 최종 상태는 `GENERATED`이며 사람이 승인해야 `APPROVED`가 됩니다.

고위험 또는 낮은 평가 결과는 `NEEDS_REVIEW`로 라우팅합니다.

```text
PENDING
  ↓ generate
GENERATED / NEEDS_REVIEW
  ├─ approve → APPROVED
  └─ reject  → REJECTED
```

## Fallback 재현

샘플 입력에 아래 marker를 넣으면 실제 credential 없이 실패 흐름을 재현할 수 있습니다.

```text
[FAIL_PRIMARY]
```

primary mock provider가 실패하고 fallback provider가 처리합니다.

```text
mock-primary:FAILED → mock-fallback:SUCCESS
```

`[FAIL_ALL]`은 provider 전체 실패를 재현합니다.

## Stale review 방어

REST review endpoint는 `expectedVersion`을 요구합니다.

```json
{
  "decision": "APPROVE",
  "expectedVersion": 2,
  "reviewer": "demo-reviewer"
}
```

현재 task version과 다르면 `409 STALE_REVIEW`를 반환합니다.

즉 이전 화면에서 본 결과를 뒤늦게 승인해 최신 결과를 덮는 문제를 막습니다.

## 실제 AI provider로 확장할 때

공개 V1은 mock provider만 사용합니다.

실제 프로젝트에서는 `PROVIDERS` adapter 경계에 승인된 provider를 연결할 수 있습니다.

```text
mock-primary
mock-fallback
      ↓ replace/add
OpenAI / Claude / Gemini / Local model adapter
```

원칙:

- API Key는 browser bundle에 넣지 않음
- server secret/environment에서 관리
- provider raw response를 바로 업무 데이터로 저장하지 않음
- schema validation 후 사용
- timeout/retry/rate-limit 정책 분리
- prompt version과 provider를 run audit에 기록
- 고위험 작업은 human approval 유지

## 실행

### Static Lab

GitHub Pages에서 `ai-workflow-review-desk/`를 열면 됩니다.

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

- structured output
- fallback
- high-risk routing
- human review
- HTTP API
- stale review 409
- finalized task regeneration 방어
- audit history
- credential pattern 비노출
- browser network/storage 비사용

## 포트폴리오에서 보여주는 역량

- AI integration architecture
- structured output validation
- provider abstraction
- retry/fallback model
- human-in-the-loop workflow
- prompt versioning
- evaluation / risk routing
- optimistic concurrency / stale review defense
- auditability
- REST API contract
- testable credential-free demo

## 공개 범위

이 프로젝트는 공개 포트폴리오용 가상 업무 데이터만 사용합니다.

- 실제 고객 데이터 없음
- 실제 API Key 없음
- 비공개 사업 프로젝트 코드/구조 사용 없음
