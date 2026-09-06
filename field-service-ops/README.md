# Booking & Field Service Ops · V1

예약 요청부터 담당 Field Agent 배정, 일정 충돌 방지, Dispatch, 현장 도착, 완료/취소/No-show까지 운영하는 **가상의 일반 현장서비스 Dispatch 시스템**입니다.

특정 실제 업종이나 비공개 사업 데이터를 사용하지 않습니다. 모든 고객·주소·담당자는 공개 포트폴리오용 fictional data입니다.

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
- role = `ADMIN`
- override reason 5자 이상

성공하면 `SCHEDULE_OVERRIDE` audit에 충돌 Job ID와 사유를 기록합니다.

## Optimistic version

모든 주요 변경은 `expectedVersion`을 요구합니다.

현재 version과 다르면:

```text
409 STALE_JOB
```

오래 열린 Dispatch 화면에서 이전 상태를 기준으로 한 배정·완료 처리가 최신 상태를 덮는 문제를 방어합니다.

## Live Dispatch Board

정적 Live Lab에서:

- 작업 검색 / 상태 필터
- Active / Scheduled / Dispatched / On Site / Urgent KPI
- Agent 선택
- 일정 배정 / 변경 / 재배정
- 시간 충돌 메시지
- STAFF / ADMIN 역할 전환
- 긴급 override
- Dispatch / On Site / Complete
- Cancel / No-show
- Agent별 활성 일정
- Audit Trail

을 재현합니다.

브라우저는 별도 가짜 규칙을 만들지 않고 `server/store.mjs`를 직접 재사용합니다.

## REST API reference

```bash
npm run start:field-service-api
```

기본 포트 `8792`.

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

## Error contract

- `400 INVALID_JOB`
- `400 EXPECTED_VERSION_REQUIRED`
- `404 JOB_NOT_FOUND`
- `404 AGENT_NOT_FOUND`
- `409 STALE_JOB`
- `409 SLOT_CONFLICT`
- `409 INVALID_JOB_ACTION`

## Verification

`npm test`에서:

- ISO slot validation
- overlap / boundary semantics
- Job initial state
- KPI
- agents / queue API
- normal overlap 409
- ADMIN emergency override + audit
- stale dispatch 409
- Schedule → Dispatch → On Site → Complete
- Reassign conflict
- terminal state protection
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

- fictional data only
- no real customer addresses
- no private business code/schema
- no external map/calendar API
- no credentials
