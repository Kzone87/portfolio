# Integration Control Center · V1 Lab

외부 시스템 간 데이터 동기화 작업을 운영하는 상황을 가정한 **정적 공개 포트폴리오 데모**입니다.

이 V1은 실제 API Key나 외부 서비스에 연결하지 않습니다. 모든 Connection, Job, Run은 공개용 가상 데이터와 브라우저 `localStorage`를 사용합니다.

## V1 scope

- Connection Registry
  - `ACTIVE / PAUSED / ERROR` 상태 표시
  - REST API / Webhook / File import / Batch export 유형
- Sync Job 구성
  - Source / Target
  - Entity
  - Manual / Hourly / Daily schedule
  - Retry ×3 / Stop / Skip invalid row failure policy
- Job 상태
  - ACTIVE / PAUSED
  - 실행 / 일시정지 / 재개
- Run History
  - SUCCESS / FAILED
  - 실행 시각
  - 처리 행 수
  - 실패 원인
- Dashboard metrics
  - Connections
  - Active jobs
  - Failed runs
  - Run history count
- 안전한 공개 데모
  - 실제 credential 없음
  - 외부 network call 없음
  - localStorage 데이터도 allow-list와 구조 검증 후 사용
  - 사용자 입력은 DOM `textContent`로 렌더링

## Why this case exists

외주 개발에서 시스템 연동은 단순히 API를 한 번 호출하는 문제가 아닙니다.

```text
Connection
   ↓
Sync Job
   ├─ Source / Target
   ├─ Entity
   ├─ Schedule
   └─ Failure policy
   ↓
Run
   ├─ SUCCESS
   └─ FAILED
   ↓
Audit / retry / operations
```

V1은 이 흐름의 **control-plane UI와 상태 모델**을 가볍게 보여주기 위한 프로젝트입니다.

## Production expansion path

실제 납품 프로젝트에서는 다음을 서버 측으로 이동해야 합니다.

- API Key / OAuth token → secret manager 또는 server-side environment
- scheduler → worker / cron / queue
- run state → database
- retry → queue + exponential backoff
- webhook verification → server signature validation
- idempotency key / duplicate prevention
- rate-limit handling
- per-connection timeout / circuit breaker
- structured logs / alerting
- RBAC / audit actor

즉 현재 V1은 **실제 API를 흉내 내는 척하는 제품이 아니라, 통합 운영 시스템의 상태와 UX를 공개 코드로 설명하는 Lab**입니다.
