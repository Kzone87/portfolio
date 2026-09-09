# MONO OPERATIONS

주문·문서·고객지원·데이터 연동 업무를 하나의 직원 계정과 업무함, 권한, 감사이력으로 운영하는 중소기업용 Back-office Operations Suite입니다.

## Product modules

- **MONO MARKET** — 주문, 출고, 배송, 보류, 반품, 환불 검토
- **MONO OFFICE** — 문서 접수, 추출, 필수값 검증, 검수, 승인, 보관
- **MONO SUPPORT** — 고객 문의, 사내 근거자료 검색, AI 업무보조 제안, Human Review
- **MONO DATA HUB** — 외부 데이터 연동, Webhook, 중복 방지, Retry, Dead Letter

## Shared operating model

`mono-operations/`은 네 모듈을 다시 구현하지 않습니다. 각 도메인 엔진을 유지하면서 공통 운영 계층을 제공합니다.

- 통합 Work Inbox
- 우선순위 Queue
- capability 기반 서버 권한
- optimistic version / stale-write 방어
- 공통 Audit
- health / readiness
- production fail-closed 구성

## Roles

- `OPERATOR`
- `REVIEWER`
- `MANAGER`
- `ADMIN`

권한은 역할명 자체가 아니라 `orders.fulfill`, `refunds.approve`, `documents.review`, `support.review`, `integrations.retry` 같은 capability로 판정합니다.

## Public demo vs delivery runtime

GitHub Pages는 가상 데이터만 사용하는 공개 브라우저 데모입니다. 실제 납품형 Runtime은 `mono-operations/server/` 경계를 사용합니다.

Production에서는 다음을 요구합니다.

- `MONO_DB_PATH` — 영속 SQLite 경로
- `MONO_API_TOKENS` — 서버 환경에서 관리되는 인증 token → actor mapping
- 브라우저에 credential 저장 금지
- 서버 측 capability 검증
- expectedVersion 기반 stale update 차단
- Audit 기록

Production 설정이 빠지면 서버는 시작 단계에서 fail closed 합니다.

## API

- `GET /health`
- `GET /ready`
- `GET /api/me`
- `GET /api/work-items`
- `POST /api/work-items/:id/acknowledge`
- `GET /api/audit`

인증 API는 `Authorization: Bearer ...`를 요구합니다.

## Verification

Root에서:

```bash
npm test
```

Public live QA는 same-SHA GitHub Pages 배포가 끝난 뒤 실제 Chrome으로 다음을 확인합니다.

- MONO hub + MARKET + OFFICE + SUPPORT + DATA HUB
- 1440×1000
- 768×1024
- 390×844
- HTTP 4xx/5xx
- requestfailed
- console.error
- pageerror
- horizontal overflow
- Work Inbox filter
- OPERATOR 권한 차단
- MANAGER 처리 허용
- Audit 반영
- 모듈 전환 링크

모든 gate가 통과하기 전에는 MONO OPERATIONS 100/100으로 판정하지 않습니다.
