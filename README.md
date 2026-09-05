# Kzone87 Portfolio

공개 포트폴리오 허브입니다. 공개 프로젝트 세 개를 단순 카드로 나열하지 않고, 각 프로젝트의 문제 정의·사용 흐름·설계 판단·검증 근거를 별도 engineering detail 페이지까지 연결해 보여줍니다.

**Live portfolio:** https://kzone87.github.io/portfolio/

## Selected work

### 1. Customer Map Planner

Excel 거래처 데이터를 검색·선택하고 Kakao Maps에 batch geocoding한 뒤, 거리 기반 연결 클러스터링·라벨 배치·실패 주소 재시도·Excel 재출력·A4 인쇄를 수행하는 브라우저 업무 자동화 도구입니다.

- Engineering Detail: `/projects/customer-map-planner.html`
- Live Demo: https://kzone87.github.io/customer-map-planner/
- Repository: https://github.com/Kzone87/customer-map-planner
- CI: https://github.com/Kzone87/customer-map-planner/actions
- Focus: workflow automation, recoverable geocoding, clustering, browser-side data boundary, print layout

### 2. User Directory

초기 Spring/MyBatis 학습 코드를 브라우저 관리 UI, REST/OpenAPI, validation/error contract, pagination/sort, Excel export, H2/MySQL dual runtime, Testcontainers와 Docker 실행 구성을 갖춘 작은 backend application으로 재설계했습니다.

- Engineering Detail: `/projects/user-directory-api.html`
- Repository: https://github.com/Kzone87/user-directory-api
- CI: https://github.com/Kzone87/user-directory-api/actions
- Focus: layered backend architecture, MyBatis, browser-to-API flow, real MySQL verification, container runtime

### 3. MilkyWay · 은하수책방

Java/JSP/Servlet/MySQL 기반 온라인 서점 팀 프로젝트입니다. 실제 PR에 연결된 기여 증거와 2026년 legacy security hardening을 분리해 설명하고, 별도 Case Study 저장소에는 시각적 `index.html` presentation도 유지합니다.

- Contribution Detail: `/projects/milkyway.html`
- Contribution Case Study: https://github.com/Kzone87/milkyway-bookstore-case-study
- Original Team Repository: https://github.com/fullstackteampj/MillkyWay
- Security hardening PR: https://github.com/fullstackteampj/MillkyWay/pull/49
- Focus: team Git/PR workflow, authentication, external API integration, order/cancellation state handling, legacy security modernization

## Portfolio principle

개인사업용 비공개 프로젝트는 이 공개 포트폴리오의 개발·평가 범위에 포함하지 않습니다. 공개 프로젝트는 다음 세 축을 분리해 증명합니다.

1. **실제 업무 문제 해결과 사용자 복구 흐름** — Customer Map Planner
2. **개인 backend/application 설계와 실행 가능성** — User Directory
3. **팀 협업, 실제 기여 증거와 유지보수 판단** — MilkyWay

## Verification

Portfolio 자체도 정적 링크가 깨진 채 배포되지 않도록 GitHub Actions에서 다음을 확인합니다.

- homepage → 세 detail page 연결
- detail page의 로컬 CSS/HTML 자산 존재 여부
- `target="_blank"` 링크의 `rel="noreferrer"`

GitHub Pages는 `main` 기준으로 공개 사이트를 배포합니다.

## Run locally

```bash
python -m http.server 8080
```

그 다음 `http://localhost:8080`을 엽니다.
