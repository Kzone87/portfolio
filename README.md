# Kzone87 · Business Web Development Portfolio

업무용 웹 시스템, 관리자 기능, Excel/CSV 자동화, REST API와 시스템 연동 운영을 중심으로 구성한 **외주 개발 포트폴리오**입니다.

**Live Portfolio:** https://kzone87.github.io/portfolio/

## Positioning

단순 홈페이지 제작보다 다음처럼 **운영 과정에서 반복해서 사용하는 기능**을 중심으로 개발합니다.

- React/TypeScript 관리자 화면
- Spring Boot REST API와 DB
- 고객/거래처 CRM과 관계형 업무 데이터
- 접수 → 진행 → 완료/취소 업무 상태 머신
- ADMIN/STAFF 역할 권한과 변경 이력
- 우선순위·마감일 기반 업무 planning
- Excel/CSV import, validation, normalization, column mapping, export
- 브라우저에서만 동작하는 local-first 업무 자동화
- API integration control-plane과 sync job 운영 UI
- 기존 서비스의 버그 수정과 단계적 현대화

## Public case studies

### 1. Business Ops Dashboard · V6 — Full-stack CRM & operations system

React/TypeScript 관리자 UI와 Spring Boot/MyBatis REST API를 연결한 풀스택 고객·업무 운영 시스템입니다.

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
- source → standard target mapping
- duplicate source / target / untouched-column collision 방어
- safe column swap
- CSV / XLSX export
- Vite multi-page production build
- 외부 API Key와 Backend 불필요

Live Demo: https://kzone87.github.io/customer-map-planner/

Column Mapping: https://kzone87.github.io/customer-map-planner/mapping.html

Repository: https://github.com/Kzone87/customer-map-planner

### 3. Integration Control Center · V1 Lab — Integration operations control-plane

외부 시스템 간 동기화 작업을 운영하는 상황을 가정한 공개 정적 데모입니다. 실제 credential이나 외부 network call 없이 상태 모델과 운영 UX에 집중합니다.

- Connection Registry: `ACTIVE / PAUSED / ERROR`
- Source / Target sync job 구성
- Customer / Order / Inventory / Invoice entity
- Manual / Hourly / Daily schedule
- Retry ×3 / Stop / Skip-row failure policy
- Job 일시정지·재개
- SUCCESS / FAILED run simulation
- 처리 건수와 실행 시각 Run History
- localStorage persistence
- 저장 데이터 allow-list / 구조 재검증
- 실제 API Key 없음

Live Lab: https://kzone87.github.io/portfolio/integration-control-center/

Source: ./integration-control-center/

### 4. MilkyWay — Team & legacy maintenance evidence

Java/JSP/Servlet/MySQL 팀 프로젝트에서 실제 Git 기록으로 확인되는 개인 기여와 이후 보안 정리 작업을 구분해 기록한 Case Study입니다.

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
| Integration job control-plane UX | Integration Control Center Lab |
| Failure policy / run history model | Integration Control Center Lab |
| Team collaboration | MilkyWay Case Study |
| Legacy maintenance | MilkyWay Case Study |

## Delivery principles

1. 현재 업무 흐름과 완료 조건을 먼저 확인합니다.
2. 포함 범위와 제외 범위를 구분합니다.
3. validation, 권한, 오류 처리, 상태 전이를 정상 기능의 일부로 봅니다.
4. 프로젝트 성격에 따라 자동화 테스트, CI 또는 재현 가능한 검증 절차를 둡니다.
5. API Key와 credential은 소스 코드에 직접 포함하지 않습니다.
6. 납품 시 실행/배포 방법과 필요한 환경설정을 문서화합니다.

## Project inquiry documents

- [Services & scope](./SERVICES.md)
- [Project brief template](./PROJECT-BRIEF.md)

## Portfolio policy

이 포트폴리오는 **공개 가능한 저장소와 검증 가능한 기록만** 사용합니다. 공개할 수 없는 사업 프로젝트의 소스·구조·데이터는 검토하거나 포트폴리오 증거로 사용하지 않습니다.
