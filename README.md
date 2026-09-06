# Kzone87 · Business Web Development Portfolio

중소기업의 반복 업무를 **웹 시스템 · 데이터 자동화 · AI · API 연동**으로 전환하는 외주 개발 포트폴리오입니다. 기술 목록이 아니라 고객 문제별로 바로 보여줄 수 있는 공개 Live Demo, Source, Test/CI 증거를 갖추는 것을 목표로 합니다.

**Live Portfolio:** https://kzone87.github.io/portfolio/  
**Services:** https://kzone87.github.io/portfolio/services/  
**1분 범위 가이드:** https://kzone87.github.io/portfolio/scope-estimator/  
**Project Brief:** [PROJECT-BRIEF.md](./PROJECT-BRIEF.md)

## Starting price

| 구간 | 시작가 | 적합한 범위 |
| --- | ---: | --- |
| STANDARD | **49만원부터** | 작은 기능, 단일 API, 단일 Excel 자동화, 버그/보안 보완 |
| DELUXE | **149만원부터** | 관리자 모듈, 데이터 Workflow, AI prototype, 연동/예약/문서 흐름 1개 |
| PREMIUM | **299만원부터** | 관계형 데이터·권한·상태·Audit가 연결된 운영시스템 |
| CUSTOM | **499만원부터** | 복수 모듈·고급 승인·복수 연동·대규모 migration/운영 고도화 |

월 운영지원은 CARE 15만원, OPS 30만원, PRIORITY 50만원부터 제공합니다. 외부 API/AI provider, 서버/도메인, 대규모 데이터 이관 등은 별도입니다.

# Seven flagship public cases

## 1. Business Ops Dashboard · V8

**수주 연결:** 관리자페이지 / CRM / ERP-lite / 승인 / 업무관리 / Dashboard / Reporting

- React/TypeScript + Spring Boot/MyBatis
- Customer domain + Customer → Work Order FK
- ADMIN/STAFF RBAC
- Work Order state machine + optimistic/stale transition defense
- transactional Activity Audit
- LOW/NORMAL/HIGH/URGENT + Due Date
- Approval request → ADMIN approve/reject → DONE gate
- Operations Analytics: overdue, workload, status/priority distribution, completion trend
- 기간별 CSV/XLSX Reporting
- frontend/backend CI

Repository: https://github.com/Kzone87/user-directory-api

## 2. Customer Data Workbench · V3

**수주 연결:** Excel/CSV 자동화 / 데이터 정리 / 검증 / 비교 / Batch / Migration

- XLSX/XLS/CSV local-first import
- normalize / dedupe / Undo / Recipe
- required/email/number/enum Rule Builder
- Column Mapping + collision defense
- Dataset Compare: ADDED / REMOVED / CHANGED / UNCHANGED
- WorkflowPreset: Mapping + Operations + Rules + Target Schema
- multi-file Batch/Migration
- SUCCESS / VALIDATION_FAILED / ERROR 파일별 격리
- Migration Report + combined XLSX
- Vitest + strict TypeScript + Vite production build

Live: https://kzone87.github.io/customer-map-planner/  
Repository: https://github.com/Kzone87/customer-map-planner

## 3. AI Workflow Review Desk · V2

**수주 연결:** AI 업무자동화 / Local RAG / 문의분류 / 답변초안 / Human Review

- fictional Local Knowledge corpus
- deterministic retrieval + rank/score/matched terms/coverage
- evidence snapshot preserved with generation run
- Structured Output + risk/confidence evaluation
- primary → fallback provider
- NO_EVIDENCE / LOW_EVIDENCE_COVERAGE review routing
- Human approve / reject / edit
- stale review 409
- evidence-aware Run / Review Audit
- `/api/knowledge`, `/api/retrieval` reference endpoints

Live: https://kzone87.github.io/portfolio/ai-workflow-review-desk/

## 4. Integration Control Center · V3

**수주 연결:** REST API / Webhook / Scheduler / 시스템 동기화 / Retry 운영

- Connection → Job → Run control plane
- Manual / Hourly / Daily schedule model
- `Idempotency-Key` duplicate run replay
- Webhook `eventId` deduplication
- validation + 400/404/409 contract
- FAILED run retry + `retryOf` lineage
- retry limit + persistent failure → DEAD_LETTER
- credential-free Live Lab + Node REST reference + HTTP tests

Live: https://kzone87.github.io/portfolio/integration-control-center/

## 5. Commerce Ops Console · V1

**수주 연결:** 쇼핑몰 관리자 / 주문 / 배송 / 반품 / 환불 / Ecommerce Ops

- Operational / Payment / Fulfillment state 분리
- Hold / Release
- Picking / Ship / Deliver / Return / Cancel
- partial/full refund request
- 고액·위험 환불 ADMIN approval
- optimistic `expectedVersion` stale-action defense
- KPI + immutable-style Audit
- Live Console + REST API + HTTP tests

Live: https://kzone87.github.io/portfolio/commerce-ops-console/

## 6. Booking & Field Service Ops · V1

**수주 연결:** 예약 / 배차 / 출장 / 설치 / 점검 / 현장서비스

- REQUESTED → SCHEDULED → DISPATCHED → ON_SITE → COMPLETED
- half-open time-slot overlap logic
- 동일 Field Agent 일정 충돌 차단
- Reschedule / Reassign / Cancel / No-show
- conflict override는 `URGENT + ADMIN + explicit reason`만 허용
- optimistic version + Audit
- Live Dispatch Board + REST API + tests

Live: https://kzone87.github.io/portfolio/field-service-ops/

## 7. Document Intake & Approval · V1

**수주 연결:** 신청서 / 계약서 / 증빙 / 파일접수 / 검수 / 승인

- DRAFT → SUBMITTED → NEEDS_CHANGES / APPROVED / REJECTED → ARCHIVED
- 문서 유형별 validation checklist
- deterministic key:value metadata extraction demo
- SUBMITTER / REVIEWER / ADMIN boundaries
- NEEDS_CHANGES comment + edit/resubmit
- stale review 409
- ADMIN-only archive + Audit
- Live Review Desk + REST API + tests

Live: https://kzone87.github.io/portfolio/document-intake-approval/

# Engineering Mini Labs · V1

큰 Flagship으로 만들 필요가 없는 외주 영역도 실행 가능한 작은 증거로 보완합니다.

- CMS validation / publish gate
- key:value / strict CSV Extraction
- allow-listed deterministic Browser Automation workflow
- Origin / Redirect / Spreadsheet Formula / Secret masking / Security Headers
- QA & Deployment GO/NO_GO release gate

Live: https://kzone87.github.io/portfolio/mini-labs/

# Legacy / maintenance evidence

`milkyway-bookstore-case-study`는 기존 Java/JSP 팀 프로젝트의 공개 Git 기록과 보안 정리 작업을 분리해 기록한 유지보수 Case Study입니다.

Repository: https://github.com/Kzone87/milkyway-bookstore-case-study

# Commercial sales kit

- [SERVICES.md](./SERVICES.md)
- [크몽 상품 등록 원고](./sales/KMONG-LISTINGS.md)
- [숨고 맞춤견적 템플릿](./sales/SOOMGO-QUOTES.md)
- [AI Workflow 판매 원고](./sales/AI-WORKFLOW-SALES.md)
- [Portfolio Screenshot / 60초 영상 구성](./sales/PORTFOLIO-ASSETS.md)
- [Scope 방어 규칙](./sales/SCOPE-RULES.md)
- [월 유지보수 상품](./sales/MAINTENANCE.md)
- [견적서 템플릿](./sales/QUOTE-TEMPLATE.md)

# Delivery principles

1. 현재 업무 흐름과 완료 조건을 먼저 확인합니다.
2. 포함/제외 범위를 고정합니다.
3. 정상 흐름뿐 아니라 validation, 권한, 상태 전이, 실패·재시도·동시성 경계를 구현합니다.
4. AI는 근거·output schema·Human Review·provider secret 경계를 분리합니다.
5. 공개 가능한 프로젝트는 자동 테스트와 CI로 회귀를 고정합니다.
6. API Key와 credential은 공개 browser/source에 직접 포함하지 않습니다.
7. 납품 시 실행·배포·환경설정과 운영 경계를 문서화합니다.

# Public-only portfolio policy

이 포트폴리오는 **공개 가능한 저장소와 검증 가능한 공개 기록만 사용합니다.** 비공개 사업 프로젝트의 소스·구조·데이터는 포트폴리오 증거로 검토하거나 재사용하지 않습니다.
