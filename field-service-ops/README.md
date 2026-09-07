# NEXA Service Operations · Field Service Ops

NEXA TECH SERVICE의 방문 요청을 담당 기사 일정에 배정하고 일정 충돌을 방지한 뒤 Dispatch, 현장 도착, 완료/취소/No-show까지 처리하는 **현장서비스 운영 시스템**입니다.

공개 Live 화면은 fictional data를 사용하는 브라우저 실행형 제품이며, Node API는 같은 도메인 규칙에 SQLite 영속성·인증 Principal·Origin allowlist를 추가한 운영 실행 경계를 제공합니다.

## Workflow

```text
REQUESTED
   ↓ schedule
SCHEDULED
   ↓ dispatch
DISPATCHED
   ↓ arrive
ON_SITE
   ↓ complete
COMPLETED

SCHEDULED / DISPATCHED → NO_SHOW
non-terminal            → CANCELLED
```

## Scheduling conflict

동일 Field Agent에게 활성 작업이 겹치면 store가 배정을 거절합니다.

```text
Agent A
09:00 ───── 10:00  Job #1
        09:30 ───── 10:30  New Job
             ↓
        409 SLOT_CONFLICT
```

끝나는 시각과 다음 작업 시작 시각이 같은 경우는 충돌로 보지 않는 half-open interval 방식입니다.

## Emergency override

충돌 override는 아래 세 조건을 모두 요구합니다.

- Job priority = `URGENT`
- 인증된 Principal role = `ADMIN`
- override reason 5자 이상

API는 요청 body의 `role`과 `actor`를 신뢰하지 않습니다. 인증된 Principal의 `role`과 `id`를 서버에서 다시 주입하며, 성공한 긴급 예외는 `SCHEDULE_OVERRIDE` audit에 충돌 Job ID와 사유를 기록합니다.

## Optimistic version + DB write guard

모든 주요 변경은 `expectedVersion`을 요구합니다.

현재 version과 다르면:

```text
409 STALE_JOB
```

SQLite store에서는 `UPDATE ... WHERE id=? AND version=?` 조건으로 실제 write 시점에도 version을 다시 확인합니다. 오래 열린 Dispatch 화면의 stale action이 최신 상태를 덮지 못하도록 메모리 규칙과 DB 조건을 함께 사용합니다.

## Live Dispatch Board

공개 정적 화면에서:

- 작업 검색 / 상태 필터
- Active / Scheduled / Dispatched / On Site / Urgent KPI
- Agent 선택
- 일정 배정 / 변경 / 재배정
- 시간 충돌 메시지
- STAFF / ADMIN 업무 흐름 재현
- 긴급 override
- Dispatch / On Site / Complete
- Cancel / No-show
- Agent별 활성 일정
- Audit Trail

을 직접 실행할 수 있습니다.

브라우저 Live 제품은 외부 서버 없이 실행되도록 `server/store.mjs`의 동일 도메인 규칙을 사용합니다. 실제 Node API는 별도의 `sqlite-store.mjs`를 사용해 데이터를 영속화합니다.

## REST API

```bash
npm run start:field-service-api
```

기본 포트는 `8792`이며, 로컬 실행에서도 기본 저장소는 다음 SQLite 파일입니다.

```text
field-service-ops/server/data/nexa-ops.sqlite
```

로컬 개발에서는 fictional seed가 기본으로 생성됩니다. 실제 운영 설정에서는 `NODE_ENV=production`으로 실행하고 실제 Agent bootstrap과 인증 Principal을 환경변수로 제공합니다.

### Production environment

```text
NODE_ENV=production
NEXA_OPS_DB_PATH=/persistent-data/nexa-ops.sqlite
NEXA_OPS_ALLOWED_ORIGINS=https://ops.example.com
NEXA_OPS_PRINCIPALS_JSON=[{"token":"<long-secret>","id":"dispatcher-1","name":"Dispatcher","role":"STAFF"},{"token":"<long-secret>","id":"ops-admin","name":"Operations Admin","role":"ADMIN"}]
NEXA_OPS_AGENTS_JSON=[{"id":1,"name":"Field Agent 1","region":"Central","active":true}]
```

Production mode에서는 인증 Principal이 없으면 서버가 시작되지 않습니다. Token은 저장소에 넣지 않고 환경변수 또는 배포 플랫폼의 secret으로 주입합니다.

### Endpoints

```text
GET  /api/health
GET  /api/agents
GET  /api/metrics
GET  /api/jobs
GET  /api/jobs/:id
GET  /api/audits
POST /api/jobs
POST /api/jobs/:id/schedule
POST /api/jobs/:id/reschedule
POST /api/jobs/:id/reassign
POST /api/jobs/:id/dispatch
POST /api/jobs/:id/on-site
POST /api/jobs/:id/complete
POST /api/jobs/:id/cancel
POST /api/jobs/:id/no-show
```

`/api/health`를 제외한 업무 API는 production mode에서 Bearer 인증이 필요합니다.

## Security boundary

- request body의 `actor` / `role` 무시
- 인증 Principal에서 actor / role 결정
- STAFF / ADMIN 권한 경계
- production Origin allowlist
- `Cache-Control: no-store`
- `X-Content-Type-Options: nosniff`
- 64 KiB JSON body limit
- credential / token 저장소 커밋 금지

브라우저 정적 Live 제품의 역할 전환은 도메인 규칙을 체험하기 위한 UI이며, production API의 권한 판단 근거가 아닙니다.

## Error contract

- `400 INVALID_JOB`
- `400 EXPECTED_VERSION_REQUIRED`
- `400 INVALID_JSON`
- `401 AUTH_REQUIRED`
- `401 INVALID_AUTH_TOKEN`
- `403 ORIGIN_NOT_ALLOWED`
- `404 JOB_NOT_FOUND`
- `404 AGENT_NOT_FOUND`
- `409 STALE_JOB`
- `409 SLOT_CONFLICT`
- `409 INVALID_JOB_ACTION`
- `413 BODY_TOO_LARGE`

## Verification

`npm test`에서:

- ISO slot validation
- overlap / half-open boundary semantics
- Job initial state / KPI
- agents / queue API
- normal overlap 409
- 인증 없는 production API 401
- body의 ADMIN/actor 위조 차단
- 인증된 ADMIN emergency override + audit
- allowlist 밖 Origin 403
- stale dispatch 409
- Schedule → Dispatch → On Site → Complete
- Reassign conflict
- terminal state protection
- SQLite 재시작 후 Job/version/audit persistence
- browser/server syntax

을 검증합니다.

## Client-facing value

- 예약/방문 일정 관리자
- 설치/점검/방문 서비스 Dispatch
- Field Agent 일정관리
- 출장 서비스 예약 시스템
- 일정 충돌 방지
- 긴급 일정 override 정책
- 진행 상태 + audit
- 기존 CRM/ERP의 현장업무 모듈

## Public boundary

- fictional public data only
- no real customer addresses
- no private business code/schema
- no production credentials
- no fabricated SLA or customer performance claims
