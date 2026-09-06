# Development Services · Starting Scope

고객이 기술 스택을 몰라도 **현재 업무 문제 → 적합한 공개 사례 → 시작 범위**로 연결할 수 있도록 서비스를 정리했습니다. 모든 금액은 시작가이며 최종 견적은 권한, 데이터 관계, 상태 전이, 외부 연동, 기존 코드, 데이터 규모와 배포 조건을 확인한 뒤 고정합니다.

## 가격 구간

| 구간 | 시작가 | 대표 범위 |
| --- | ---: | --- |
| STANDARD | **49만원부터** | 작은 기능, 버그/보안 보완, 단일 API, 단일 Excel 자동화 |
| DELUXE | **149만원부터** | 업무 Workflow 1개, 관리자 모듈, AI prototype, 예약/문서/연동 기능 |
| PREMIUM | **299만원부터** | 관계형 데이터 + 권한 + 상태 + Audit가 연결된 운영시스템 |
| CUSTOM | **499만원부터** | 복수 모듈, 고급 승인, 복수 외부연동, 대규모 migration/운영 고도화 |

# 1. 관리자 · CRM · 업무관리

공개 증거: **Business Ops Dashboard V8**  
상세: [admin-system.html](./services/admin-system.html)

- Customer / Work Order 관계형 데이터
- ADMIN / STAFF RBAC
- 상태 머신, Priority, Due Date
- transactional Audit
- Approval Workflow
- Operations Analytics
- CSV/XLSX Reporting
- REST API / DB / frontend+backend CI

**149만원부터**, 풀스택 운영시스템은 **299만원부터**.

# 2. Excel · CSV 업무자동화

공개 증거: **Customer Data Workbench V3**  
상세: [excel-automation.html](./services/excel-automation.html)

- XLSX/XLS/CSV import
- Validation Rules / normalization / dedupe
- Column Mapping
- Dataset Compare
- WorkflowPreset
- Multi-file Batch/Migration
- 오류 Report + combined XLSX
- local-first 저비용 구성 가능

단일 자동화 **49만원부터**, 반복 Workflow **149만원부터**, Batch/Migration **299만원부터**.

# 3. REST API · 시스템 연동

공개 증거: **Integration Control Center V3**  
상세: [api-integration.html](./services/api-integration.html)

- REST API / validation / 400·404·409
- Connection / Job / Run
- Webhook event deduplication
- Idempotency-Key
- Scheduler model
- Retry / retryOf lineage
- Retry limit / Dead Letter
- HTTP integration test / CI

작은 API **49만원부터**, 연동 Workflow **149만원부터**, 운영형 Integration **299만원부터**.

# 4. AI Workflow · Local RAG

공개 증거: **AI Workflow Review Desk V2**  
상세: [ai-automation.html](./services/ai-automation.html)

- Local Knowledge retrieval
- Evidence rank / score / coverage
- Prompt/provider adapter
- Structured Output validation
- Evaluation / Risk flags
- Primary → Fallback
- Human approve / reject / edit
- Evidence-aware Run / Review Audit
- stale review 409

Prototype **149만원부터**, Backend/Audit Workflow **299만원부터**, 복수 업무/RAG 운영 고도화 **499만원부터**.

# 5. 쇼핑몰 주문 · 운영관리

공개 증거: **Commerce Ops Console V1**  
상세: [commerce-ops.html](./services/commerce-ops.html)

- Order / Payment / Fulfillment 상태 분리
- Hold / Release
- Picking / Ship / Deliver / Return / Cancel
- Partial/Full Refund
- 고액 환불 ADMIN approval
- optimistic version + Audit
- 운영 KPI / REST API

주문관리 **149만원부터**, 운영형 Ecommerce **299만원부터**.

# 6. 예약 · 배차 · 현장서비스

공개 증거: **Booking & Field Service Ops V1**  
상세: [field-service.html](./services/field-service.html)

- 예약 시간대 / Agent assignment
- 동일 Agent overlap 차단
- Reschedule / Reassign
- Dispatch → On-site → Complete
- Cancel / No-show
- URGENT + ADMIN conflict override
- optimistic version + Audit

예약관리 **149만원부터**, Field Ops **299만원부터**.

# 7. 문서접수 · 검수 · 승인

공개 증거: **Document Intake & Approval V1**  
상세: [document-workflow.html](./services/document-workflow.html)

- 문서 유형별 checklist
- Metadata extraction / validation
- SUBMITTED review queue
- NEEDS_CHANGES + resubmit
- APPROVED / REJECTED
- SUBMITTER / REVIEWER / ADMIN
- stale review 409 / archive / Audit

접수·검수 **149만원부터**, 승인 Workflow **299만원부터**.

# Engineering Mini Labs

공개 Live: [mini-labs/](./mini-labs/)

- CMS validation / publish gate
- Key:value / strict CSV extraction
- allow-listed deterministic Browser Automation
- Origin / Redirect / Spreadsheet Formula / Secret masking / Security Headers
- QA/Deployment GO/NO_GO release gate

작은 독립 기능이나 기존 서비스 보완은 **49만원부터** 범위를 나눕니다.

# 기존 시스템 개선 · 유지보수

- 버그 원인 분석과 기능 보완
- validation / credential / environment 경계 개선
- 테스트 추가
- 레거시 현대화 단계 설계
- 경미한 외부 API 호환성 수정

월 Retainer:

| 플랜 | 비용 | 포함시간 | 대응 시작 기준 |
| --- | ---: | ---: | --- |
| CARE | **15만원/월** | 1시간 | 영업일 2일 이내 |
| OPS | **30만원/월** | 3시간 | 영업일 1일 이내 |
| PRIORITY | **50만원/월** | 5시간 | 영업일 기준 당일 |

신규 기능, 24/7 on-call, 대규모 DB 변경, 신규 외부 연동은 유지보수 기본 범위에 포함하지 않습니다.

# 별도 협의 항목

- 문자 / 메일 / 결제 / 지도 / AI provider 사용료
- 서버 / DB / 도메인 / 스토리지
- 대규모 데이터 migration
- 복잡한 권한·승인 단계
- 실시간 대량 처리 / queue worker
- OCR / vector DB / 대규모 문서 색인
- 디자인 원본 제작
- 24/7 모니터링/on-call

# 진행 방식

1. 현재 업무 흐름 확인
2. 개발 후 반드시 가능한 결과 정의
3. 포함/제외 범위 고정
4. 권한·상태·AI/외부 연동 경계 확정
5. 고정 견적
6. 구현 + 정상/실패 흐름 검증
7. 검수/납품 + 실행·배포 문서
8. 필요한 경우 월 운영지원

# 빠른 견적에 필요한 4가지

1. **현재 방식**
2. **가장 불편한 점**
3. **꼭 필요한 결과**
4. **예산 / 일정**

상세 입력: [PROJECT-BRIEF.md](./PROJECT-BRIEF.md)  
1분 가이드: https://kzone87.github.io/portfolio/scope-estimator/
