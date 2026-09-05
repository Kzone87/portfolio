# Kzone87 · Business Web Development Portfolio

업무용 웹 시스템, Excel/CSV 자동화, REST API와 시스템 연동을 **실제 외주 상품으로 연결하기 위한 공개 포트폴리오**입니다.

**Live Portfolio:** https://kzone87.github.io/portfolio/

## Commercial packages

| Package | 시작가 | 적합한 의뢰 |
| --- | ---: | --- |
| STANDARD | **49만원부터** | 버그 수정, 기능 1개, 작은 API, 단일 자동화 |
| DELUXE | **149만원부터** | 관리자 CRUD, Excel/CSV 업무자동화, 간단한 API/DB 연동 |
| PREMIUM | **299만원부터** | 고객·업무관리, 권한, 상태, DB, REST API가 연결된 업무시스템 |

금액은 시작가이며 최종 견적은 사용자 권한, 데이터 관계, 업무 상태, 외부 연동, 기존 코드 수정, 데이터 규모, 배포·운영 조건을 확인한 뒤 고정합니다.

상세 범위: [SERVICES.md](./SERVICES.md)  
빠른 견적 요청: [PROJECT-BRIEF.md](./PROJECT-BRIEF.md)

## Marketplace sales kit

실제 플랫폼 등록과 견적 대응에 사용할 판매 문서는 [`sales/`](./sales/)에 분리했습니다.

- [크몽 3개 상품 등록 원고](./sales/KMONG-LISTINGS.md)
- [숨고 맞춤견적 응답 템플릿](./sales/SOOMGO-QUOTES.md)
- [포트폴리오 이미지·60초 영상 구성](./sales/PORTFOLIO-ASSETS.md)
- [외주 범위·가격 방어 규칙](./sales/SCOPE-RULES.md)

## Positioning

단순 홈페이지 제작보다 **회사의 반복 업무를 운영 가능한 시스템으로 바꾸는 개발**을 중심으로 합니다.

- React/TypeScript 관리자 화면
- Spring Boot REST API와 DB
- 고객/거래처 CRM과 관계형 업무 데이터
- 접수 → 진행 → 완료/취소 업무 상태 머신
- ADMIN/STAFF 역할 권한과 변경 이력
- 우선순위·마감일 기반 업무 planning
- Excel/CSV import, validation, normalization, column mapping, export
- 브라우저에서만 동작하는 local-first 업무 자동화
- API integration control-plane, sync job, run history, idempotency
- 기존 서비스의 버그 수정과 단계적 현대화

## Public case studies

### 1. Business Ops Dashboard · V6 — Full-stack CRM & operations system

React/TypeScript 관리자 UI와 Spring Boot/MyBatis REST API를 연결한 풀스택 고객·업무 운영 시스템입니다.

**연결 가능한 외주 상품:** 고객·업무관리 / 관리자 웹 시스템 / PREMIUM 299만원부터

- Customer domain: `LEAD / ACTIVE / INACTIVE`
- 고객 검색·등록·수정
- Customer → Work Order foreign key
- 업무 접수 / 담당자 / 상태 필터
- `RECEIVED → IN_PROGRESS → DONE / CANCELLED` 상태 머신
- 조건부 status UPDATE를 이용한 stale/concurrent transition 방어
- Spring Security `ADMIN / STAFF` RBAC
- 트랜잭션 Work Order Audit History
- `LOW / NORMAL / HIGH / URGENT` 우선순위
- optional due date
- 기한 초과 / 오늘 마감 / 긴급 / 진행 중 Planning Panel
- Planning Panel에서 priority·due date를 포함한 실제 업무 접수
- validation 및 400/401/403/404/409 오류 계약
- OpenAPI, MockMvc integration tests, frontend/backend CI

Repository: https://github.com/Kzone87/user-directory-api

### 2. Customer Data Workbench · V2.4 — Local-first Excel/CSV automation

Excel/CSV 데이터를 서버로 업로드하지 않고 브라우저에서 정리·검증·표준화·재출력하는 local-first 업무 자동화 도구입니다.

**연결 가능한 외주 상품:** Excel/CSV 반복업무 자동화 / DELUXE 149만원부터

- XLSX / XLS / CSV import
- 서버 업로드 없이 브라우저 메모리에서 처리
- 빈 값 / 이메일 / 전화번호 / 완전 중복 품질 점검
- 공백·이메일·전화번호 normalization
- 중복 제거
- 검색 / pagination
- Undo / Redo / 원본 복원
- 반복 작업 Recipe 저장 및 재실행
- `required / email / number / enum` Rule Builder
- Rule localStorage 저장과 파일별 재검증
- Column Mapping Workspace
- duplicate source / target / untouched-column collision 방어
- safe column swap
- CSV / XLSX export
- Vite multi-page production build
- 외부 API Key와 Backend 불필요

Live Demo: https://kzone87.github.io/customer-map-planner/

Column Mapping: https://kzone87.github.io/customer-map-planner/mapping.html

Repository: https://github.com/Kzone87/customer-map-planner

### 3. Integration Control Center · V2 — Integration operations + REST API

외부 시스템 간 동기화 작업을 `Connection → Sync Job → Run` 단위로 운영하는 공개 사례입니다. 웹 Lab은 credential-free simulation으로 유지하고, 저장소에는 같은 도메인의 **Node REST API reference implementation과 HTTP integration tests**를 제공합니다.

**연결 가능한 외주 상품:** API·시스템 연동 / DELUXE 149만원부터

- Connection Registry: `ACTIVE / PAUSED / ERROR`
- Source / Target sync job 구성
- Customer / Order / Inventory / Invoice entity
- Manual / Hourly / Daily schedule
- Retry ×3 / Stop / Skip-row failure policy
- Job `ACTIVE / PAUSED` 운영 상태
- `GET /api/connections`, `GET/POST /api/jobs`
- `PATCH /api/jobs/:id/status`
- `POST /api/jobs/:id/runs`
- `GET /api/runs`
- validation + `400 / 404 / 409` error contract
- connection health failure를 FAILED run으로 기록
- `Idempotency-Key` 기반 duplicate run 방지
- Node HTTP-level integration tests
- 실제 credential / 비공개 API 없음

Live Lab: https://kzone87.github.io/portfolio/integration-control-center/

Source: ./integration-control-center/

### 4. MilkyWay — Team & legacy maintenance evidence

Java/JSP/Servlet/MySQL 팀 프로젝트에서 실제 Git 기록으로 확인되는 개인 기여와 이후 보안 정리 작업을 구분해 기록한 Case Study입니다.

**연결 가능한 외주 상품:** 기존 서비스 기능 수정 / 유지보수 / STANDARD 49만원부터

- 팀 Git / PR 협업
- 인증·주문·상태 처리
- 외부 API 연동
- legacy security hardening
- 전면 재개발보다 위험을 줄이는 단계적 현대화 판단

Case Study: https://github.com/Kzone87/milkyway-bookstore-case-study

## Portfolio coverage

| Area | Public evidence |
| --- | --- |
| React / TypeScript admin UI | Business Ops Dashboard |
| Spring Boot / MyBatis API | Business Ops Dashboard |
| Customer CRM / relational data | Business Ops Dashboard |
| RBAC / authentication boundary | Business Ops Dashboard |
| Business state machine / audit history | Business Ops Dashboard |
| Priority / due-date planning | Business Ops Dashboard |
| DB / validation / HTTP error contract | Business Ops Dashboard |
| XLSX/XLS/CSV local processing | Customer Data Workbench |
| Data quality / normalization | Customer Data Workbench |
| User validation rules | Customer Data Workbench |
| Column mapping / schema standardization | Customer Data Workbench |
| Undo / Recipe workflow | Customer Data Workbench |
| Integration job control-plane UX | Integration Control Center |
| REST API / idempotency / run history | Integration Control Center |
| Team collaboration | MilkyWay Case Study |
| Legacy maintenance | MilkyWay Case Study |

## Delivery principles

1. 현재 업무 흐름과 완료 조건을 먼저 확인합니다.
2. 포함 범위와 제외 범위를 구분합니다.
3. validation, 권한, 오류 처리, 상태 전이를 정상 기능의 일부로 봅니다.
4. 프로젝트 성격에 따라 자동화 테스트, CI 또는 재현 가능한 검증 절차를 둡니다.
5. API Key와 credential은 소스 코드에 직접 포함하지 않습니다.
6. 납품 시 실행/배포 방법과 필요한 환경설정을 문서화합니다.

## Fast estimate

1차 상담에는 아래 네 가지면 충분합니다.

1. 현재 업무 방식
2. 가장 불편한 점
3. 개발 후 반드시 가능해야 하는 결과
4. 대략적인 예산과 일정

## Portfolio policy

이 포트폴리오는 **공개 가능한 저장소와 검증 가능한 기록만** 사용합니다. 공개할 수 없는 사업 프로젝트의 소스·구조·데이터는 검토하거나 포트폴리오 증거로 사용하지 않습니다.
