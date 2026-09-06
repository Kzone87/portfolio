# AI Workflow · 업무자동화 판매 원고

공개 `AI Workflow Review Desk V2`를 크몽/숨고 외주 수주로 연결하기 위한 판매 원고입니다.

핵심 포지셔닝은 **“AI API 호출”이 아니라 “업무 근거를 검색하고, AI가 구조화된 제안을 만들고, 사람이 근거와 함께 최종 승인하는 운영 Workflow”**입니다.

---

# 1. 크몽 상품 등록 원고

## 추천 제목

**AI 문의분류·답변초안·사내문서 검색을 사람 승인 Workflow로 개발합니다**

## 썸네일 문구

```text
AI WORKFLOW AUTOMATION
Local RAG · Structured Output
Human Review · Evidence Audit
```

## 첫 설명

AI를 기존 업무에 연결하되 결과를 바로 고객에게 보내거나 DB를 자동 변경하지 않고, **관련 정책·FAQ·Runbook 근거를 찾고 구조화된 결과를 만든 뒤 담당자가 최종 검토·승인하는 Workflow**로 개발합니다.

예:

```text
고객 문의 / 문서 / 업무 데이터
→ Local Knowledge Retrieval
→ Evidence Snapshot
→ AI 분류·요약·초안
→ Structured Output Validation
→ Evaluation / Risk / Evidence Check
→ 담당자 수정·승인 / 반려
→ 실행·근거·검토 이력 저장
```

공개 `AI Workflow Review Desk V2`에서 API Key 없이 아래 구조를 직접 확인할 수 있습니다.

- local knowledge catalog
- deterministic retrieval ranking
- matched terms / evidence coverage
- prompt version
- Provider Adapter
- primary → fallback
- Structured Output validation
- risk / confidence / evaluation
- Human Review approve / reject / edit
- Run / Review / Evidence Audit
- stale review 409
- HTTP integration test

## 패키지 제안

| 패키지 | 시작가 | 기본 범위 |
| --- | ---: | --- |
| STANDARD | 149만원 | AI 기능 1개, Provider 1개, Structured Output, 기본 검토 UI |
| DELUXE | 299만원 | Backend provider 호출, evaluation/fallback, run/review history, 소규모 local knowledge retrieval 협의 |
| PREMIUM | 499만원부터 | 복수 workflow/role/provider/knowledge source, approval policy, evidence audit, dashboard 범위 협의 |

> AI provider 사용료, 외부 API 비용, 대규모 RAG/vector DB, 수천~수백만 문서 색인, OCR, 음성/이미지 처리, 실시간 대량 요청은 별도 범위입니다.

## 적합한 의뢰

- 고객문의 자동 분류
- 답변 초안 생성 후 직원 승인
- 사내 정책/FAQ 기반 상담 보조
- 상담/영업 메모 요약
- 문서 핵심 정보 추출
- 보고서 초안 생성
- 기존 CRM/관리자 시스템에 AI 보조 기능 추가
- AI 결과를 사람이 검토한 뒤 다음 업무로 넘기는 기능
- 어떤 근거 문서가 사용됐는지 이력이 필요한 업무

## 포함 가능한 기능

- AI Provider Adapter
- Prompt version
- Local knowledge catalog
- Retrieval ranking / evidence snapshot
- Structured Output schema
- Output validation
- Evaluation score / rule
- Risk / evidence flag
- Provider fallback
- Human Review approve / reject / edit
- Review / Evidence Audit
- Run history
- REST API
- stale/concurrent review 방어
- Integration test / CI

## 별도 협의

- 대규모 RAG / vector search
- 수천~수백만 문서 색인
- 문서 접근권한/tenant별 검색 정책
- OCR / embedding pipeline
- Fine-tuning
- 음성 통화/음성합성
- 이미지/영상 생성
- 의료·법률·금융 등 고위험 자동 의사결정
- 개인정보/민감정보 보안 심사
- 24/7 대규모 운영
- 모델/API 사용료

## 구매 전 확인 정보

1. AI가 읽을 입력 데이터
2. 참고해야 할 정책·FAQ·문서가 있는지
3. 반드시 생성해야 하는 출력 필드
4. 사람이 확인해야 하는 단계
5. 자동 실행하면 안 되는 조건
6. 사용할 AI provider 계정 유무
7. 기존 웹/DB/API 연결 여부
8. 문서 수와 갱신 방식
9. 대략적인 일 요청량
10. 희망 일정과 예산

## 공개 증거

- Live Lab: `https://kzone87.github.io/portfolio/ai-workflow-review-desk/`
- Service: `https://kzone87.github.io/portfolio/services/ai-automation.html`
- Source: `Kzone87/portfolio/ai-workflow-review-desk`
- CI: `Kzone87/portfolio/actions`

---

# 2. 숨고 견적 응답 템플릿

안녕하세요. 요청하신 내용은 단순 챗봇보다는 **AI Workflow + 근거 검색 + 사람 검토 방식**으로 접근하는 것이 적합해 보입니다.

AI 기능은 먼저 아래를 구분하면 견적 범위를 빠르게 잡을 수 있습니다.

- 입력: AI가 무엇을 읽는지
- 근거: 어떤 정책/FAQ/문서를 참고해야 하는지
- 출력: 어떤 필드를 만들어야 하는지
- 사람 검토: 누가 언제 승인하는지
- 자동화 금지: 어떤 경우에는 사람이 반드시 처리해야 하는지
- 연동: 기존 DB/관리자페이지/API와 연결되는지

공개 포트폴리오에는 `AI Workflow Review Desk V2`가 있으며 다음 흐름을 구현했습니다.

```text
Task
→ Local Knowledge Retrieval
→ Evidence Snapshot
→ Prompt version
→ Provider Adapter
→ Structured Output
→ Evaluation / Risk / Evidence
→ Human Review approve/reject/edit
→ Run / Review / Evidence Audit
```

대략적인 시작 범위는 다음과 같습니다.

- AI prototype + 검토 UI: **149만원부터**
- Backend + fallback + audit: **299만원부터**
- 복수 workflow/role/provider 운영: **499만원부터**

정확한 견적을 위해 아래 6가지만 확인 부탁드립니다.

1. 현재 사람이 처리하는 업무 순서
2. AI가 읽을 데이터 예시
3. AI가 참고해야 할 정책/문서 예시
4. 기대 출력 예시
5. 사람이 최종 확인해야 하는 기준
6. 사용 중인 AI/API 계정 유무

전체를 한 번에 개발하기보다 1차에서는 **업무 1개 + provider 1개 + small knowledge set + Human Review**를 먼저 검증하고 이후 자동화 범위를 늘리는 방식도 가능합니다.

---

# 3. 포트폴리오 이미지 순서

플랫폼 업로드용 이미지 권장 순서:

1. **대표 이미지** — `AI가 근거를 찾고 사람이 승인하는 Workflow`
2. Task Queue 전체 화면
3. Local Knowledge Catalog
4. Retrieval Evidence rank / score / matched terms
5. Structured Output Editor
6. Evaluation score / Risk / Evidence flags
7. Primary failure → Fallback 성공
8. Human Approve / Reject
9. Run / Review / Evidence Audit
10. REST API / test 결과 화면

이미지 캡션 예시:

- `AI 결과를 바로 실행하지 않고 담당자가 최종 승인합니다.`
- `관련 정책과 Runbook을 검색하고 어떤 근거가 사용됐는지 남깁니다.`
- `Provider 실패 시 fallback 경로와 동일 evidence snapshot을 기록합니다.`
- `근거가 없거나 coverage가 낮은 결과는 사람 검토 우선순위를 높입니다.`
- `이전 화면의 stale 승인으로 최신 결과가 덮이지 않도록 방어합니다.`

---

# 4. 60초 영상 구성

```text
0~7초
문제: AI 답변만 보여주면 근거와 책임 추적이 어렵습니다.

7~16초
Task 추가 → Local Knowledge 검색

16~25초
Evidence rank / coverage 확인

25~34초
Structured Output + Evaluation 확인

34~42초
Primary provider 실패 → Fallback 성공

42~51초
담당자가 결과와 근거 확인 → 수정·승인

51~57초
Run / Review / Evidence Audit 확인

57~60초
AI Workflow 개발 · 149만원부터
Portfolio / 견적 CTA
```

---

# 5. 범위 방어 규칙

AI 프로젝트에서는 아래를 반드시 견적에서 분리합니다.

## 개발비

- Workflow UI
- Backend/API
- Provider Adapter
- Prompt/output schema
- Validation/evaluation
- Local retrieval / evidence audit 범위
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
- 새로운 knowledge source/권한 정책 추가
- 대규모 vector RAG 도입
- 자동 발송/자동 승인 범위 확대
- 신규 외부 시스템 연동

초기 리뷰 확보를 위해 가격을 낮추더라도 **AI Workflow 전체를 싸게 제공하지 않고 업무 1개로 범위를 줄입니다.**

---

# 공개 정책

- 실제 API Key를 판매 문서/공개 demo에 넣지 않습니다.
- 실제 고객 데이터나 비공개 사업 프로젝트를 증거로 사용하지 않습니다.
- 공개 demo는 deterministic local retrieval + mock provider를 기본으로 사용합니다.
- 공개 knowledge corpus는 전부 가상 정책/Runbook입니다.
