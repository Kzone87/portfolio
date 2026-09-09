# Kzone87 · Full-stack Web Developer

업무 시스템과 데이터 자동화를 중심으로 **실제로 실행 가능한 웹제품**을 만드는 포트폴리오입니다.

> 화면 하나보다 업무 흐름 전체를 구현합니다. 요구사항을 상태·권한·예외처리로 구체화하고, 공개 가능한 프로젝트는 Live Product · Source · Tests · CI · Browser QA로 검증합니다.

**Live Portfolio:** https://kzone87.github.io/portfolio/

## What I build

- **업무 운영 시스템** — 주문, 승인, 문서 검수, 예약·배차, 관리자 업무
- **데이터 자동화** — Excel/CSV 정리, 검증, 비교, 다중 파일 Batch
- **API·AI 업무보조** — REST, Webhook, Retry, 근거자료 기반 제안 + Human Review
- **기업 웹 + 내부 운영** — 외부 고객용 사이트와 직원용 운영도구 연결

## Four public product lines

### 1. NEXA SERVICE SUITE

기업용 기술서비스를 가정해 **신규 고객 홈페이지 + 기존 고객 포털 + 직원 현장운영 시스템**을 하나의 업무 흐름으로 구성했습니다.

- 상담 접수 → 지원 확인 → 방문 요청 → 기사 배정 → 현장 작업 → 완료·후속관리
- 직원 계정과 역할 경계
- 일정 충돌 차단과 version conflict
- customer request → field job → customer portal 연결
- SQLite persistence, audit, backup/restore
- delivery build와 실제 브라우저 E2E 검증

**Customer site:** https://kzone87.github.io/portfolio/nexa-tech-service/  
**Customer service:** https://kzone87.github.io/portfolio/nexa-service-domain/  
**Field operations:** https://kzone87.github.io/portfolio/field-service-ops/

### 2. MONO OPERATIONS

주문·문서·고객지원·데이터 연동을 **하나의 직원 계정, 통합 업무함, 권한, 감사이력**으로 운영하는 Back-office Operations Suite입니다.

- **MONO MARKET** — 주문 · 출고 · 배송 · 고위험 환불 승인
- **MONO OFFICE** — 문서 접수 · 추출 · 검수 · 승인/반려
- **MONO SUPPORT** — 근거 검색 · AI 제안 · Human Review
- **MONO DATA HUB** — Webhook · persistent retry queue · Dead Letter · 복구
- HttpOnly session, CSRF, server-side RBAC
- SQLite persistence, optimistic version, audit
- HMAC webhook, encrypted connection secret, retry/DLQ
- backup/restore, delivery manifest, commercial runtime Chrome QA

**Suite:** https://kzone87.github.io/portfolio/mono-operations/  
**Market:** https://kzone87.github.io/portfolio/commerce-ops-console/  
**Office:** https://kzone87.github.io/portfolio/document-intake-approval/  
**Support:** https://kzone87.github.io/portfolio/ai-workflow-review-desk/  
**Data Hub:** https://kzone87.github.io/portfolio/integration-control-center/

### 3. Excel Workbench

별도 TypeScript 저장소에서 운영하는 local-first 데이터 작업 제품입니다.

- XLSX / XLS / CSV import
- 다중 Sheet 선택과 대용량 guardrail
- normalize / dedupe / Undo / Recipe
- required / email / number / enum validation
- Column Mapping
- 두 파일 Compare
- Workflow Preset + multi-file Batch
- 설정 JSON export/import
- spreadsheet-safe export
- dependency audit + strict TypeScript + Vitest + real Chrome QA

**Live:** https://kzone87.github.io/customer-map-planner/  
**Repository:** https://github.com/Kzone87/customer-map-planner

### 4. OPS KIT

서버 전송이나 외부 사이트 자동조작 없이, 작은 운영 작업을 **입력 → 검사 → 결과 → 증빙**으로 끝내는 local-first Operations Utility Suite입니다.

- **Content Preflight** — 게시 전 길이 · slug · placeholder · 링크 밀도 검사
- **Data Extractor** — key:value 및 quoted CSV 구조화
- **Workflow Dry-Run** — public HTTPS workflow 계획 검증과 실패 시뮬레이션
- **Security Check** — origin · redirect · spreadsheet formula · secret 경계 검사
- **Release Gate** — 필수 배포조건 GO / NO-GO 판정
- 입력 크기 제한, secret masking, private URL 차단
- 명시적 다운로드 시에만 JSON/추출 결과 생성
- CSP `connect-src 'none'`으로 외부 네트워크 요청 차단

**Live:** https://kzone87.github.io/portfolio/mini-labs/

## Delivery standard

실제 납품은 단순 화면 구현으로 끝내지 않습니다. 프로젝트 범위에 맞춰 다음 인수기준을 먼저 정하고 검증합니다.

1. **업무 흐름** — 상태 전이, validation, 정상·예외 흐름
2. **권한·데이터** — 역할 경계, persistence, audit
3. **검수·배포** — automated tests, browser QA, deployed version 확인
4. **인수인계** — 환경설정, 운영 문서, backup/restore 등 합의된 납품물

프로젝트마다 필요한 수준은 다르므로, 기능과 제외범위·운영환경·인수기준을 먼저 합의하는 방식으로 진행합니다.

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
- same-SHA GitHub Pages + real Chrome live QA

테스트와 정적 검증은 GitHub Actions에서 계속 실행됩니다.

**Portfolio CI:** https://github.com/Kzone87/portfolio/actions  
**Excel CI:** https://github.com/Kzone87/customer-map-planner/actions

## Stack demonstrated publicly

- TypeScript / JavaScript
- Node.js
- SQLite / SQL
- HTML / CSS
- REST API / Webhook
- Vitest / Node test runner
- GitHub Actions / GitHub Pages

## Contact

GitHub 계정 없이도 먼저 프로젝트 요구사항을 정리할 수 있습니다.

- **프로젝트 의뢰서 준비:** https://kzone87.github.io/portfolio/project-inquiry/
- **채용·협업 공개 문의:** https://github.com/Kzone87/portfolio/issues/new?template=hiring.yml
- **외주·프로젝트 공개 문의:** https://github.com/Kzone87/portfolio/issues/new?template=project-inquiry.yml
- **GitHub:** https://github.com/Kzone87

공개 프로젝트 의뢰 페이지는 내용을 서버로 보내지 않고 **상담 초안 작성 · 복사 · TXT 다운로드**를 지원합니다. 운영환경에서 비공개 inquiry endpoint가 연결되면 같은 양식을 비공개 접수 화면으로 사용할 수 있습니다.

> GitHub Issue는 공개됩니다. 이메일, 전화번호, 계정정보, 고객 데이터, 내부 문서 등 민감한 정보는 작성하지 마세요.

## Portfolio boundary

이 포트폴리오의 기업명·브랜드·운영 데이터는 공개 시연을 위해 구성한 가상 사례입니다. 실제 고객 실적이나 매출 수치를 꾸며서 사용하지 않으며, 공개 가능한 독립 구현과 검증 가능한 코드·테스트·배포 기록으로 구현 범위를 보여줍니다.
