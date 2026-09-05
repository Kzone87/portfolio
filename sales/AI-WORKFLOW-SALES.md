# AI Workflow · 업무자동화 판매 원고

공개 `AI Workflow Review Desk V1`을 크몽/숨고 외주 수주로 연결하기 위한 판매 초안입니다.

핵심 포지셔닝은 **“AI API 호출”이 아니라 “AI가 제안하고 사람이 승인하는 운영 Workflow”**입니다.

---

# 1. 크몽 상품 등록 원고

## 추천 제목

**AI 문의분류·답변초안·문서요약을 사람 승인 Workflow로 개발합니다**

## 썸네일 문구

```text
AI WORKFLOW AUTOMATION
Structured Output · Human Review
Fallback · Audit · Backend
```

## 첫 설명

AI를 기존 업무에 연결하되 결과를 바로 고객에게 보내거나 DB를 자동 변경하지 않고, **구조화된 결과를 만들고 담당자가 최종 검토·승인하는 Workflow**로 개발합니다.

예:

```text
고객 문의 / 문서 / 업무 데이터
→ AI 분류·요약·초안
→ Structured Output Validation
→ Evaluation / Risk Check
→ 담당자 수정·승인 / 반려
→ 실행·검토 이력 저장
```

공개 `AI Workflow Review Desk V1`에서 API Key 없이 아래 구조를 직접 확인할 수 있습니다.

- prompt version
- provider adapter
- primary → fallback
- structured JSON validation
- risk / confidence / evaluation
- human approve / reject / edit
- Run History / Review Audit
- stale review 409
- HTTP integration test

## 패키지 제안

| 패키지 | 시작가 | 기본 범위 |
| --- | ---: | --- |
| STANDARD | 149만원 | AI 기능 1개, Provider 1개, structured output, 기본 검토 UI |
| DELUXE | 299만원 | Backend provider 호출, evaluation/fallback, run/review history, API test |
| PREMIUM | 499만원부터 | 복수 업무/role/provider, prompt version 운영, approval policy, dashboard 범위 협의 |

> AI provider 사용료, 외부 API 비용, RAG/vector DB, 대규모 문서 색인, 음성/이미지 처리, 실시간 대량 요청은 별도 범위입니다.

## 적합한 의뢰

- 고객문의 자동 분류
- 답변 초안 생성 후 직원 승인
- 상담/영업 메모 요약
- 문서 핵심 정보 추출
- 보고서 초안 생성
- 기존 CRM/관리자 시스템에 AI 보조 기능 추가
- AI 결과를 사람이 검토한 뒤 다음 업무로 넘기는 기능

## 포함 가능한 기능

- AI provider adapter
- Prompt version
- Structured output schema
- Output validation
- Evaluation score / rule
- Risk flag
- Provider fallback
- Human approve / reject / edit
- Review audit
- Run history
- REST API
- stale/concurrent review 방어
- Integration test / CI

## 별도 협의

- RAG / vector search
- 수천~수백만 문서 색인
- Fine-tuning
- 음성 통화/음성합성
- 이미지/영상 생성
- 의료·법률·금융 등 고위험 자동 의사결정
- 개인정보/민감정보 보안 심사
- 24/7 대규모 운영
- 모델/API 사용료

## 구매 전 확인 정보

1. AI가 읽을 입력 데이터
2. 반드시 생성해야 하는 출력 필드
3. 사람이 확인해야 하는 단계
4. 자동 실행하면 안 되는 조건
5. 사용할 AI provider 계정 유무
6. 기존 웹/DB/API 연결 여부
7. 대략적인 일 요청량
8. 희망 일정과 예산

## 공개 증거

- Live Lab: `https://kzone87.github.io/portfolio/ai-workflow-review-desk/`
- Service: `https://kzone87.github.io/portfolio/services/ai-automation.html`
- Source: `Kzone87/portfolio/ai-workflow-review-desk`
- CI: `Kzone87/portfolio/actions`

---

# 2. 숨고 견적 응답 템플릿

안녕하세요. 요청하신 내용은 단순 챗봇보다는 **AI Workflow + 사람 검토 방식**으로 접근하는 것이 적합해 보입니다.

AI 기능은 먼저 아래를 구분하면 견적 범위를 빠르게 잡을 수 있습니다.

- 입력: AI가 무엇을 읽는지
- 출력: 어떤 필드를 만들어야 하는지
- 사람 검토: 누가 언제 승인하는지
- 자동화 금지: 어떤 경우에는 사람이 반드시 처리해야 하는지
- 연동: 기존 DB/관리자페이지/API와 연결되는지

공개 포트폴리오에는 `AI Workflow Review Desk V1`이 있으며 다음 흐름을 구현했습니다.

```text
Task
→ Prompt version
→ Provider adapter
→ Structured output
→ Evaluation / Risk
→ Human approve/reject/edit
→ Audit
```

대략적인 시작 범위는 다음과 같습니다.

- AI prototype + 검토 UI: **149만원부터**
- Backend + fallback + audit: **299만원부터**
- 복수 workflow/role/provider 운영: **499만원부터**

정확한 견적을 위해 아래 5가지만 확인 부탁드립니다.

1. 현재 사람이 처리하는 업무 순서
2. AI가 읽을 데이터 예시
3. 기대 출력 예시
4. 사람이 최종 확인해야 하는 기준
5. 사용 중인 AI/API 계정 유무

전체를 한 번에 개발하기보다 1차에서는 **업무 1개 + provider 1개 + human review**를 먼저 검증하고 이후 자동화 범위를 늘리는 방식도 가능합니다.

---

# 3. 포트폴리오 이미지 순서

플랫폼 업로드용 이미지 권장 순서:

1. **대표 이미지** — `AI가 제안하고 사람이 승인하는 Workflow`
2. Task Queue 전체 화면
3. Prompt / Provider trace
4. Structured Output Editor
5. Evaluation score / Risk flags
6. Primary failure → Fallback 성공
7. Human Approve / Reject
8. Run History / Review Audit
9. Reference architecture
10. REST API / test 결과 화면

이미지 캡션은 기술 이름보다 고객 가치 중심으로 작성합니다.

예:

- `AI 결과를 바로 실행하지 않고 담당자가 최종 승인합니다.`
- `Provider 실패 시 fallback 경로를 기록합니다.`
- `어떤 Prompt와 Provider가 결과를 만들었는지 추적합니다.`
- `이전 화면의 stale 승인으로 최신 결과가 덮이지 않도록 방어합니다.`

---

# 4. 60초 영상 구성

```text
0~7초
문제: AI 결과를 바로 업무에 쓰면 오류와 책임 추적이 어렵습니다.

7~17초
Task 추가 → AI 제안 생성

17~27초
Structured Output + Evaluation 확인

27~37초
Primary provider 실패 → Fallback 성공

37~47초
담당자가 결과 수정 → 승인

47~55초
Run / Review Audit 확인

55~60초
AI Workflow 개발 · 149만원부터
Portfolio / 견적 CTA
```

---

# 5. 범위 방어 규칙

AI 프로젝트에서는 아래를 반드시 견적에서 분리합니다.

## 개발비

- Workflow UI
- Backend/API
- Provider adapter
- Prompt/output schema
- Validation/evaluation
- Audit/test

## 외부 비용

- AI API 사용료
- Vector DB
- 문서 OCR
- 유료 embedding
- 음성/이미지 provider
- 서버/스토리지

## 추가 기능

다음은 기본 수정이 아니라 신규 기능으로 봅니다.

- 새로운 업무 workflow 추가
- 새로운 provider 추가
- 새로운 output schema 추가
- RAG 도입
- 자동 발송/자동 승인 범위 확대
- 신규 외부 시스템 연동

초기 리뷰 확보를 위해 가격을 낮추더라도 **AI Workflow 전체를 싸게 제공하지 않고 업무 1개로 범위를 줄입니다.**

---

# 공개 정책

- 실제 API Key를 판매 문서/공개 demo에 넣지 않습니다.
- 실제 고객 데이터나 비공개 사업 프로젝트를 증거로 사용하지 않습니다.
- 공개 demo는 deterministic mock provider를 기본으로 사용합니다.
