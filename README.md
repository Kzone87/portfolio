# Kzone87 · Business Web Development Portfolio

업무용 웹 시스템, 관리자 기능, Excel/CSV 자동화, REST API와 기존 웹서비스 개선을 중심으로 구성한 **외주 개발 포트폴리오**입니다.

**Live Portfolio:** https://kzone87.github.io/portfolio/

## Positioning

단순 홈페이지 제작보다 다음처럼 **운영 과정에서 반복해서 사용하는 기능**을 중심으로 개발합니다.

- React/TypeScript 관리자 화면
- Spring Boot REST API와 DB
- 고객/연락처 CRUD, 검색, 필터, pagination
- 접수 → 진행 → 완료/취소 같은 업무 상태 처리
- Excel/CSV import, validation, normalization, export
- 브라우저에서만 동작하는 local-first 업무 자동화 도구
- 기존 서비스의 버그 수정, credential 정리, 단계적 현대화

## Public case studies

### 1. Business Ops Dashboard · V2 — Full-stack operations system

React/TypeScript 관리자 UI와 Spring Boot/MyBatis REST API를 연결한 풀스택 업무관리 시스템입니다.

- 연락처 검색·CRUD
- Excel export
- 업무 접수 / 담당자 / 상태 필터
- `RECEIVED → IN_PROGRESS → DONE / CANCELLED` 상태 머신
- 조건부 status UPDATE를 이용한 stale/concurrent transition 방어
- validation 및 400/404/409 오류 계약
- OpenAPI, MockMvc integration tests, frontend/backend CI

Repository: https://github.com/Kzone87/user-directory-api

### 2. Customer Data Workbench · V2 — API-free data automation

기존 지도 중심 프로젝트를 외주 활용 범위가 더 넓은 **Excel/CSV 데이터 자동화 도구**로 재설계했습니다.

- XLSX / XLS / CSV import
- 서버 업로드 없이 브라우저 메모리에서 처리
- 빈 값 / 이메일 / 전화번호 / 완전 중복 품질 점검
- 공백·이메일·전화번호 normalization
- 완전 중복 제거
- 검색 / pagination
- Undo / Redo / 원본 복원
- 반복 작업 Recipe 저장 및 재실행
- CSV / XLSX export
- 외부 API Key와 Backend 불필요

Live Demo: https://kzone87.github.io/customer-map-planner/

Repository: https://github.com/Kzone87/customer-map-planner

### 3. MilkyWay — Team & legacy maintenance evidence

Java/JSP/Servlet/MySQL 팀 프로젝트에서 실제 Git 기록으로 확인되는 개인 기여와 이후 보안 정리 작업을 구분해 기록한 Case Study입니다.

이 프로젝트는 대표 신규 개발작보다 다음 역량을 보조합니다.

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
| DB / validation / error contract | Business Ops Dashboard |
| Business state machine | Business Ops Dashboard |
| Excel export | Business Ops Dashboard |
| XLSX/XLS/CSV local processing | Customer Data Workbench |
| Data quality / normalization | Customer Data Workbench |
| Undo / Recipe workflow | Customer Data Workbench |
| Team collaboration | MilkyWay Case Study |
| Legacy maintenance | MilkyWay Case Study |

## Delivery principles

1. 현재 업무 흐름과 완료 조건을 먼저 확인합니다.
2. 포함 범위와 제외 범위를 구분합니다.
3. validation, 오류 처리, 상태 전이를 정상 기능의 일부로 봅니다.
4. 프로젝트 성격에 따라 자동화 테스트, CI 또는 재현 가능한 검증 절차를 둡니다.
5. API Key와 credential은 소스 코드에 직접 포함하지 않습니다.
6. 납품 시 실행/배포 방법과 필요한 환경설정을 문서화합니다.

## Project inquiry documents

- [Services & scope](./SERVICES.md)
- [Project brief template](./PROJECT-BRIEF.md)

## Portfolio policy

이 포트폴리오는 **공개 가능한 저장소와 검증 가능한 기록만** 사용합니다. 공개할 수 없는 사업 프로젝트의 소스·구조·데이터는 검토하거나 포트폴리오 증거로 사용하지 않습니다.
