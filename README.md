# Kzone87 · Full-stack Web Developer

업무 시스템과 데이터 자동화를 중심으로 **실제로 실행 가능한 웹제품**을 만드는 포트폴리오입니다.

> 화면 하나보다 업무 흐름 전체를 구현합니다. 요구사항을 상태·권한·예외처리로 구체화하고, 공개 가능한 프로젝트는 Live Demo · Source · Tests · CI로 검증합니다.

**Live Portfolio:** https://kzone87.github.io/portfolio/

## What I build

- **업무 운영 시스템** — 주문, 승인, 문서 검수, 예약·배차, 관리자 업무
- **데이터 자동화** — Excel/CSV 정리, 검증, 비교, 다중 파일 Batch
- **API·AI 업무보조** — REST, Webhook, Retry, 근거자료 기반 제안 + Human Review
- **기업 웹 + 내부 운영** — 외부 고객용 사이트와 직원용 운영도구 연결

## Public delivery-style cases

### 1. NEXA TECH SERVICE

기업용 기술서비스를 가정해 **외부 기업 홈페이지 + 내부 현장운영 시스템**을 하나의 범위로 구성했습니다.

- 회사소개 · 서비스 · 사례 · 문의
- 기사별 시간축과 미배정 작업 큐
- 일정 충돌 차단
- URGENT + ADMIN + 사유가 필요한 긴급 예외
- REQUESTED → SCHEDULED → DISPATCHED → ON_SITE → COMPLETED
- optimistic version + audit history

**Corporate site:** https://kzone87.github.io/portfolio/nexa-tech-service/  
**Field operations:** https://kzone87.github.io/portfolio/field-service-ops/

### 2. MONO OPERATIONS

하나의 커머스 운영조직을 가정해 서로 다른 백오피스 업무를 각각의 목적에 맞는 제품 화면으로 구현했습니다.

#### MONO MARKET · 주문 운영
- 주문 검색·필터
- 결제/업무/배송 상태 분리
- Hold / Picking / Ship / Deliver / Return
- 고액·위험 환불 관리자 검토
- audit + stale action defense

Live: https://kzone87.github.io/portfolio/commerce-ops-console/

#### MONO OFFICE · 문서 검수
- 접수함 / 문서 미리보기 / 검수 패널
- 필수값 validation
- 수정 요청 → 재제출 → 승인/반려
- 역할 경계 + version conflict + audit

Live: https://kzone87.github.io/portfolio/document-intake-approval/

#### MONO SUPPORT · 상담 지원
- 문의함 / 상담 내용 / 고객·근거자료
- local knowledge retrieval
- evidence-aware structured output
- risk/confidence evaluation
- Human approve / reject / edit

Live: https://kzone87.github.io/portfolio/ai-workflow-review-desk/

#### MONO DATA HUB · 데이터 연동
- Connection → Job → Run
- schedule / webhook / idempotency
- 실패 재시도와 retry lineage
- persistent failure → dead letter
- 연결 복구와 실행 이력

Live: https://kzone87.github.io/portfolio/integration-control-center/

### 3. Excel 정리 작업실

별도 TypeScript 저장소에서 운영하는 local-first 데이터 작업 제품입니다.

- XLSX / XLS / CSV import
- normalize / dedupe / Undo / Recipe
- required / email / number / enum validation
- Column Mapping
- 두 파일 Compare
- Workflow Preset + multi-file Batch
- SUCCESS / VALIDATION_FAILED / ERROR 격리
- spreadsheet-safe export
- Vitest + strict TypeScript + Vite multi-page build

**Live:** https://kzone87.github.io/customer-map-planner/  
**Repository:** https://github.com/Kzone87/customer-map-planner

### 4. OPS KIT

대형 시스템까지 필요하지 않은 작은 반복업무를 독립 실행 도구로 구성합니다.

- 게시 전 내용 검사
- key:value / table 데이터 추출
- 제한된 반복 입력 자동화

Live: https://kzone87.github.io/portfolio/mini-labs/

## Engineering evidence

공개 포트폴리오에서는 정상 흐름만 보여주지 않습니다.

- validation과 잘못된 입력
- 권한 차이
- 상태 전이 규칙
- optimistic/stale conflict
- 일정 충돌
- 고위험 작업의 human approval
- retry / recovery / dead-letter
- destructive action confirmation
- audit history
- responsive / keyboard accessibility

테스트와 정적 검증은 GitHub Actions에서 계속 실행됩니다.

**Portfolio CI:** https://github.com/Kzone87/portfolio/actions  
**Excel CI:** https://github.com/Kzone87/customer-map-planner/actions

## Stack demonstrated publicly

- TypeScript / JavaScript
- Node.js
- Java / Spring
- SQL
- HTML / CSS
- REST API / Webhook
- Vitest / Node test runner
- GitHub Actions / GitHub Pages

## Contact

민감한 개인정보를 공개하지 않고도 대화를 시작할 수 있도록 GitHub Issue 양식을 제공합니다.

- **채용·협업 문의:** https://github.com/Kzone87/portfolio/issues/new?template=hiring.yml
- **외주·프로젝트 문의:** https://github.com/Kzone87/portfolio/issues/new?template=project-inquiry.yml
- **GitHub:** https://github.com/Kzone87

> Issue는 공개됩니다. 이메일, 전화번호, 계정정보, 고객 데이터, 내부 문서 등 민감한 정보는 작성하지 마세요.

## Portfolio boundary

이 포트폴리오의 기업명·브랜드·운영 데이터는 공개 시연을 위해 구성한 가상 사례입니다. 실제 고객 실적이나 매출 수치로 오인될 수 있는 주장을 만들지 않으며, 공개 가능한 독립 구현과 검증 가능한 저장소 기록만 사용합니다.
