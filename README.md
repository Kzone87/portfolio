# Kzone87 · Business Web Development Portfolio

업무용 웹 시스템, 관리자 기능, Excel/CSV 기반 업무 자동화, REST API와 기존 웹서비스 개선을 중심으로 정리한 외주 개발 포트폴리오입니다.

**Live Portfolio:** https://kzone87.github.io/portfolio/

## What I build

- **업무용 웹 시스템 / 관리자 기능** — 거래처, 회원, 주문, 신청 데이터의 조회·등록·수정·상태 처리
- **Excel / 반복 업무 자동화** — XLSX/CSV 입력 검증, 데이터 가공, 검색 결과 export, 지도·출력 자동화
- **REST API / 데이터 연동** — CRUD, 검색, 정렬, pagination, validation, 오류 계약, 외부 API 연동
- **기존 서비스 개선** — 버그 수정, 기능 추가, credential 정리, 레거시 코드의 단계적 개선

## Public case studies

### 1. Customer Map Planner — Business workflow automation

Excel 거래처 데이터를 읽어 주소를 지오코딩하고, 거리 기반으로 그룹화한 뒤 라벨 배치와 A4 출력을 자동화하는 브라우저 업무 도구입니다.

- Live Demo: https://kzone87.github.io/customer-map-planner/
- Repository: https://github.com/Kzone87/customer-map-planner
- Evidence: input validation, geocoding cache, clustering logic, print layout, regression tests, CI

### 2. User Directory API — Business data backend

관리자/내부 업무시스템에서 사용할 수 있는 사용자 데이터 REST API 예제입니다. 검색, CRUD, pagination/sort, Excel export, validation, OpenAPI와 MockMvc 통합 테스트를 포함합니다.

- Repository: https://github.com/Kzone87/user-directory-api
- Evidence: layered architecture, MyBatis, error contract, Excel export, OpenAPI, automated tests, CI

### 3. MilkyWay — Team & legacy maintenance evidence

Java/JSP/Servlet/MySQL 기반 온라인 서점 팀 프로젝트에서 실제 Git 기록으로 확인되는 개인 기여와 이후 보안 정리 작업을 구분해 기록한 Case Study입니다.

- Case Study: https://github.com/Kzone87/milkyway-bookstore-case-study
- Original Team Repository: https://github.com/fullstackteampj/MillkyWay

이 프로젝트는 대표 외주작이 아니라 **팀 협업, 상태 처리, 외부 API 연동, 레거시 유지보수 경험을 보조하는 증거**로 사용합니다.

## Delivery principles

1. 개발 전 현재 업무 흐름과 완료 조건을 먼저 정리합니다.
2. 합의한 범위와 제외 범위를 구분합니다.
3. 입력 검증, 오류 처리와 데이터 경계를 기능의 일부로 봅니다.
4. 프로젝트 성격에 따라 테스트, CI 또는 재현 가능한 검증 절차를 둡니다.
5. API key와 credential은 소스 코드에 직접 포함하지 않습니다.
6. 납품 시 실행/배포 방법과 필요한 설정을 문서화합니다.

## Project inquiry documents

- [Services & scope](./SERVICES.md)
- [Project brief template](./PROJECT-BRIEF.md)

## Portfolio policy

이 포트폴리오는 **공개 가능한 저장소와 검증 가능한 기록만** 사용합니다. 사업 진행 중인 비공개 프로젝트나 그 소스·구조·기능은 공개 포트폴리오의 검토 및 설명 대상에 포함하지 않습니다.
