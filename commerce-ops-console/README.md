# Commerce Ops Console · V1

주문 조회 화면이 아니라 **주문 예외를 안전하게 처리하는 운영 콘솔**을 보여주는 공개 포트폴리오 프로젝트입니다.

실제 결제·배송 provider, 고객 데이터, API Key를 사용하지 않고 fictional data와 deterministic domain logic만으로 실행됩니다.

## Core domain

단일 `orderStatus`로 모든 것을 표현하지 않고 운영 상태를 세 축으로 분리합니다.

```text
Order
├─ Ops Status
│  ├─ ACTIVE
│  ├─ ON_HOLD
│  ├─ CANCELLED
│  └─ CLOSED
├─ Payment Status
│  ├─ PAID
│  ├─ REFUND_PENDING
│  ├─ PARTIALLY_REFUNDED
│  └─ REFUNDED
└─ Fulfillment Status
   ├─ UNFULFILLED
   ├─ PICKING
   ├─ SHIPPED
   ├─ DELIVERED
   └─ RETURNED
```

이 구조로 다음과 같은 실제 운영 조합을 표현할 수 있습니다.

- 결제 완료 + 주소 검수 Hold
- Picking 진행 중 + 정상 결제
- 배송 완료 + 부분 환불 검토
- 반품 접수 + 환불 대기

## Live Console

`commerce-ops-console/` 정적 페이지에서 다음을 재현합니다.

- 주문번호 / 고객 / 이메일 검색
- Ops / Fulfillment 필터
- Active / Hold / Fulfillment / Refund KPI
- Hold / Release
- Picking 시작
- Tracking 입력 후 Ship
- Deliver / Return / Cancel
- Refund Request
- 고액 또는 위험 사유 환불의 `ADMIN_REQUIRED` 표시
- STAFF / ADMIN demo role 전환
- ADMIN 전용 민감 환불 승인/반려
- Order version 표시
- Audit Trail

브라우저 Live Console은 REST API를 흉내 내는 별도 코드를 두지 않고 `server/store.mjs`의 동일한 domain store를 직접 재사용합니다.

## Refund policy

```text
Refund request
   ↓
amount / reason validation
   ↓
REFUND_PENDING
   ↓
>= 100,000 KRW
or DAMAGED / LOST / FRAUD_REVIEW
   ↓
ADMIN approval required
   ↓
approve / reject
   ↓
PARTIALLY_REFUNDED / REFUNDED / PAID
```

`HIGH_VALUE_REFUND_THRESHOLD = 100000`은 공개 demo policy 값입니다. 실제 프로젝트에서는 고객 업무 규칙으로 교체합니다.

## Optimistic concurrency

모든 주요 주문 변경은 `expectedVersion`을 요구합니다.

```json
{
  "expectedVersion": 3,
  "trackingNo": "TRACK-3333",
  "actor": "warehouse-user"
}
```

현재 주문 version과 다르면 reference API는:

```text
409 STALE_ORDER
```

를 반환합니다.

오래 열린 관리자 화면에서 뒤늦은 액션이 최신 주문 상태를 덮는 문제를 방어하는 예시입니다.

## REST API reference

기본 실행:

```bash
npm run start:commerce-api
```

기본 주소:

```text
http://127.0.0.1:8791
```

주요 endpoint:

```text
GET  /api/health
GET  /api/metrics
GET  /api/orders
GET  /api/orders/:id
POST /api/orders
GET  /api/refunds
GET  /api/audits
POST /api/orders/:id/hold
POST /api/orders/:id/release
POST /api/orders/:id/pick
POST /api/orders/:id/ship
POST /api/orders/:id/deliver
POST /api/orders/:id/return
POST /api/orders/:id/cancel
POST /api/orders/:id/refunds
POST /api/refunds/:id/decision
```

## Error contract

대표 오류:

- `400 INVALID_ORDER`
- `400 EXPECTED_VERSION_REQUIRED`
- `400 INVALID_JSON`
- `404 ORDER_NOT_FOUND`
- `404 REFUND_NOT_FOUND`
- `403 REFUND_APPROVAL_FORBIDDEN`
- `409 STALE_ORDER`
- `409 INVALID_ORDER_ACTION`

## Verification

루트에서:

```bash
npm test
```

검증 범위:

- 주문 입력 정규화
- operational/payment/fulfillment state 분리
- Hold / Release version 증가
- 고액 환불 approval flag
- partial refund financial state
- KPI 계산
- HTTP search/filter
- Ship → Deliver transition
- stale version 409
- STAFF의 민감 환불 승인 403
- ADMIN refund approval
- audit history
- 잘못된 주문 생성 400
- 불가능한 상태 전이 409
- JavaScript syntax check

## Client-facing value

이 프로젝트가 연결되는 외주 범위:

- 쇼핑몰/주문 관리자페이지
- 주문 CS 운영도구
- 결제/환불 approval workflow
- 출고/배송 상태 관리
- 반품/교환 예외 처리
- 주문 상태 migration
- 운영 KPI dashboard
- 기존 쇼핑몰 backend에 admin console 추가
- REST API와 관리자 UX 동시 구축

## Public boundary

- fictional customer/order data only
- no payment gateway credentials
- no real shipment API
- no private business repository code
- no private customer schema
- no secret embedded in browser code
