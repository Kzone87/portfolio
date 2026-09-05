# Kzone87 Portfolio

공개 포트폴리오 허브입니다. 대표 프로젝트를 선별해 각 프로젝트의 문제 정의, 기술 선택, 구현 범위와 운영 관점을 한곳에서 보여주는 역할을 합니다.

## Portfolio structure

### Active private services

- **PrintHub** — 인쇄 견적·책등/표지 계산·브라우저 PDF 프리프레스 도구를 중심으로 개발 중인 서비스
- **Exchange Dashboard** — React/TypeScript + Cloudflare Workers/D1/R2 기반 금융 운영 대시보드

두 프로젝트는 실서비스 개발 중이므로 소스 코드는 비공개 상태를 유지합니다.

### Public engineering projects

- **Customer Map Planner** (`Kzone87/customer-map-planner`) — Excel 거래처 데이터를 Kakao Maps에 지오코딩하고, 거리 기반 클러스터링·라벨 배치·A4 출력을 수행하는 업무 도구. GitHub Actions 회귀 테스트와 Pages 데모 배포를 사용합니다.
  - Live Demo: https://kzone87.github.io/customer-map-planner/
- **User Directory API** (`Kzone87/user-directory-api`) — Spring Boot + MyBatis + Validation + H2 + Excel export + MockMvc + GitHub Actions CI로 재구성한 백엔드 프로젝트.

### Team project experience

- **MilkyWay · 은하수책방** — Java/JSP/Servlet/MySQL 기반 온라인 서점 팀 프로젝트. Kzone87은 SHA-256 + salt 기반 비밀번호 처리, 네이버 로그인 연동, 장바구니↔위시리스트 이동, 마이페이지 주문취소·회원 상태 처리, 관리자 로그인/라우팅, Tomcat 10 Jakarta Servlet 전환에 기여했습니다.
  - 원본 팀 저장소는 현재 포트폴리오에서 직접 링크하지 않습니다. 공개 저장소의 자격증명·외부 API 설정을 정리한 뒤 소스 링크를 추가할 예정입니다.

## Why this repository is intentionally small

포트폴리오 허브 안에 다른 프로젝트의 소스 사본을 복제하지 않습니다. 각 프로젝트는 독립 저장소에서 이력과 README를 관리하고, 이 저장소는 프로젝트 간 맥락과 개발 방향을 보여주는 역할만 합니다.

## Run locally

빌드 단계가 없는 정적 사이트입니다.

```bash
python -m http.server 8080
```

그 다음 `http://localhost:8080`을 엽니다.
