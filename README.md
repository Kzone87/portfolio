# Kzone87 Portfolio

공개 포트폴리오 허브입니다. 서로 다른 역량을 검증할 수 있는 공개 프로젝트 세 개만 선별해 문제 정의, 구현 범위와 검증 가능한 증거를 한곳에서 연결합니다.

**Live portfolio:** https://kzone87.github.io/portfolio/

## Selected work

### 1. Customer Map Planner

Excel 거래처 데이터를 Kakao Maps에 지오코딩하고, 거리 기반 연결 클러스터링·라벨 배치·A4 출력을 수행하는 브라우저 업무 자동화 도구입니다.

- Live Demo: https://kzone87.github.io/customer-map-planner/
- Repository: https://github.com/Kzone87/customer-map-planner
- CI: https://github.com/Kzone87/customer-map-planner/actions
- Focus: workflow automation, geocoding, clustering, browser-side data handling, print layout

### 2. User Directory API

초기 Spring/MyBatis 학습 코드를 다시 설계해 CRUD, 검색, validation, 예외 계약, Excel export와 MockMvc 통합 테스트를 갖춘 실행 가능한 REST API로 재구성한 백엔드 프로젝트입니다.

- Repository: https://github.com/Kzone87/user-directory-api
- CI: https://github.com/Kzone87/user-directory-api/actions
- Focus: layered backend architecture, MyBatis, REST error contract, OpenAPI, automated tests

### 3. MilkyWay · 은하수책방

Java/JSP/Servlet/MySQL 기반 온라인 서점 팀 프로젝트입니다. 개인 Case Study에서 실제 Git 이력으로 확인되는 기여 범위와 현재 기준의 개선 판단을 분리해 설명합니다.

- Contribution Case Study: https://github.com/Kzone87/milkyway-bookstore-case-study
- Original Team Repository: https://github.com/fullstackteampj/MillkyWay
- Security hardening PR: https://github.com/fullstackteampj/MillkyWay/pull/49
- Focus: team Git/PR workflow, authentication, external API integration, order/cancellation state handling, legacy security modernization

## Portfolio principle

이 허브에는 개인사업용 비공개 프로젝트나 다른 저장소의 소스 사본을 넣지 않습니다. 공개 가능한 작업 중에서 다음 세 축을 증명하는 프로젝트만 유지합니다.

1. **실제 업무 문제 해결** — Customer Map Planner
2. **개인 백엔드 설계 역량** — User Directory API
3. **팀 협업 및 기여 증거** — MilkyWay

## Run locally

빌드 단계가 없는 정적 사이트입니다.

```bash
python -m http.server 8080
```

그 다음 `http://localhost:8080`을 엽니다.
