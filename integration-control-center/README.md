# Integration Control Center · V3

외부 시스템 간 데이터 동기화 작업을 운영하는 상황을 가정한 **공개 Integration control-plane + REST API reference implementation**입니다.

V2의 Connection / Job / Run / Idempotency 위에 V3는 **Webhook event ingestion, event deduplication, retry lineage, retry limit, dead-letter handling**을 추가합니다. 실제 API Key, 비공개 서비스, 고객 데이터는 사용하지 않습니다.

## V3 architecture

```text
External System
   ↓ Webhook
Event Validation
   ↓
Event ID Deduplication
   ↓
Matching Sync Job
   ↓
Run
├─ SUCCESS
└─ FAILED
     ↓ retry
 Retry lineage / retryCount
     ↓ max 3
 DEAD_LETTER
```

기존 수동/스케줄형 실행도 유지합니다.

```text
Operator UI
   ↓
Integration REST API
   ├─ Connections
   ├─ Sync Jobs
   ├─ Job status
   ├─ Runs / history
   ├─ Idempotency protection
   ├─ Webhook events
   ├─ Retry
   └─ Dead letters
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
- `GET /api/runs/:id`
- `POST /api/runs/:id/retry`
- `POST /api/webhooks/:connectionId`
- `GET /api/webhook-events`
- `GET /api/dead-letters`

### Webhook contract

```json
{
  "eventId": "order-evt-1001",
  "type": "order.updated",
  "payload": {
    "orderId": "O-1001"
  }
}
```

지원 event type은 공개 demo allow-list로 제한합니다.

- `customer.updated`
- `order.updated`
- `inventory.updated`
- `invoice.updated`

같은 `connectionId + eventId`를 재전송하면 새 run을 만들지 않고 기존 webhook event를 replay합니다.

## Retry semantics

FAILED run만 `POST /api/runs/:id/retry`로 재시도할 수 있습니다.

각 retry run은 다음 정보를 보존합니다.

```text
retryOf
retryCount
trigger = RETRY
```

최대 3회까지 실패하면 최종 run은 `DEAD_LETTER`가 되고 `/api/dead-letters`에서 운영자가 확인할 수 있습니다.

공개 테스트에서는 `simulateFailure: true` payload로 일시적 실패 후 성공 retry를 재현하고, `warehouse-demo`의 ERROR 상태로 지속 실패 → dead-letter 흐름도 재현합니다.

## Existing V2 guarantees retained

### Job creation validation

서버가 connection ID, entity, schedule, failure policy를 allow-list로 다시 검증합니다. 잘못된 입력은 `400`, 없는 resource는 `404`, paused job 실행·재시도 불가·비활성 webhook 같은 운영 충돌은 `409`로 응답합니다.

### Idempotent manual runs

`POST /api/jobs/:id/runs`는 선택적으로 `Idempotency-Key` 헤더를 받습니다. 같은 job에 같은 key를 재전송하면 새 실행을 중복 기록하지 않고 기존 run을 재사용합니다.

## Browser control plane

정적 UI에서는 Connection / Job / Run 운영 흐름을 API Key 없이 시뮬레이션합니다. 서버 reference implementation은 브라우저 데모와 분리되어 있으며 외부 credential을 포함하지 않습니다.

## Local verification

```bash
npm test
npm run start:integration-api
```

API 기본 주소는 `http://localhost:8787`이며 `PORT` 환경변수로 변경할 수 있습니다.

## What V3 demonstrates

- REST resource design
- webhook ingestion + validation
- event-id deduplication
- retry lineage and retry limit
- dead-letter workflow
- run history and detail resource
- manual-run idempotency
- explicit `400 / 404 / 409` error contract
- HTTP-level integration tests
- dependency-free Node server boundary

현재 저장소는 공개 검증을 위해 in-memory store를 사용합니다. 실제 납품형에서는 DB persistence, durable queue, exponential backoff, webhook signature verification, secret manager, RBAC, observability를 요구사항에 맞춰 추가할 수 있습니다.
