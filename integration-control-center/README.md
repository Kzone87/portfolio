# Integration Control Center · V2

외부 시스템 간 데이터 동기화 작업을 운영하는 상황을 가정한 **공개 Integration control-plane + REST API reference implementation**입니다.

V1은 브라우저 `localStorage` 기반 정적 운영 데모였고, V2는 같은 도메인을 서버 경계로 확장합니다. 실제 API Key, 비공개 서비스, 고객 데이터는 사용하지 않습니다.

## V2 architecture

```text
Operator UI
   ↓
Integration REST API
   ├─ Connections
   ├─ Sync Jobs
   ├─ Job status
   ├─ Runs / history
   └─ Idempotency protection
        ↓
In-memory public demo store
```

## REST API

- `GET /health`
- `GET /api/connections`
- `GET /api/jobs`
- `POST /api/jobs`
- `PATCH /api/jobs/:id/status`
- `POST /api/jobs/:id/runs`
- `GET /api/runs?limit=50`

### Job creation contract

```json
{
  "name": "Customer sync",
  "source": "crm-demo",
  "target": "erp-demo",
  "entity": "customers",
  "schedule": "hourly",
  "policy": "retry-3"
}
```

서버가 connection ID, entity, schedule, failure policy를 allow-list로 다시 검증합니다. 잘못된 입력은 `400`, 없는 job은 `404`, paused job 실행이나 동일 상태 재적용 같은 운영 충돌은 `409`로 응답합니다.

## Idempotent runs

`POST /api/jobs/:id/runs`는 선택적으로 `Idempotency-Key` 헤더를 받습니다. 같은 job에 같은 key를 재전송하면 새 실행을 중복 기록하지 않고 기존 run을 재사용합니다.

## V1 control plane

정적 UI에서는 다음 흐름을 직접 조작할 수 있습니다.

- Connection Registry: `ACTIVE / PAUSED / ERROR`
- Sync Job: Source / Target / Entity / Schedule / Failure policy
- Job 상태: ACTIVE / PAUSED
- 실행 / 일시정지 / 재개
- Run History: SUCCESS / FAILED / 처리 건수 / 실패 사유
- Dashboard metrics

## Local verification

```bash
npm test
npm run start:integration-api
```

API 기본 주소는 `http://localhost:8787`이며 `PORT` 환경변수로 변경할 수 있습니다.

## What V2 demonstrates

- REST resource design
- validation + allow-listing
- explicit `400 / 404 / 409` error contract
- connection health failure recording
- run history
- idempotent execution semantics
- HTTP-level integration tests
- dependency-free Node server boundary

현재 저장소에서는 공개 검증을 위해 in-memory store를 사용합니다. 실제 납품형 V3에서는 DB persistence, scheduler/queue, retry backoff, webhook signature verification, secret manager, RBAC, structured logging을 추가하는 방향으로 확장할 수 있습니다.
