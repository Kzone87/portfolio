# BOOKING CRM

예약·문의·고객관리를 하나의 운영 흐름으로 연결하는 소규모 사업자용 Booking CRM reference product입니다.

## 공개 제품

- 고객 예약: 서비스 선택 → 날짜/시간 → 예약 요청
- 예약 전 문의: 문의 유형 → 내용 → 관리자 Inbox
- 직원 Workspace: 예약 Queue, 상태 필터, 상세, 일정 변경, 확정/완료/취소
- 고객관리: 예약 고객 연결, 고객 메모
- 감사이력: 예약/문의/고객 메모 변경 기록
- 반응형: desktop / tablet / mobile

공개 GitHub Pages는 개인정보를 서버에 저장하지 않는 local demo입니다. 새로고침하면 상태가 초기화됩니다.

## 상용 Runtime

`server/app.mjs` + `server/store.mjs`는 Node 24 `node:sqlite` 기반의 실제 서버 경계입니다.

- SQLite persistence / WAL
- 직원 password(scrypt)
- HttpOnly session cookie
- CSRF token
- server-side STAFF/ADMIN role check
- login/public intake rate limit
- browser Origin allowlist
- booking slot conflict
- optimistic `version`
- inquiry status workflow
- customer memo
- audit log
- `/health` / `/ready`
- production fail-closed env validation

## API

- `POST /api/bookings`
- `POST /api/inquiries`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `GET /api/admin/bookings`
- `PATCH /api/admin/bookings/:id`
- `GET /api/admin/inquiries`
- `PATCH /api/admin/inquiries/:id`
- `GET /api/admin/customers`
- `PATCH /api/admin/customers/:id`
- `GET /api/admin/audit`

## 상태 모델

예약: `REQUESTED → CONFIRMED → COMPLETED` 또는 `REQUESTED/CONFIRMED → CANCELLED`

문의: `NEW → CONTACTED → CLOSED` 또는 `NEW → CLOSED`

종료 상태는 다시 변경하지 않습니다. 모든 관리자 mutation은 current `expectedVersion`과 CSRF를 요구합니다.

## 실행

```bash
npm run start:booking-crm
```

개발 기본 관리자:

- email: `admin@booking.local`
- password: `booking-demo-1234`

Production에서는 기본 비밀번호가 허용되지 않으며 `BOOKING_DB_PATH`, `BOOKING_ADMIN_PASSWORD`, `BOOKING_ALLOWED_ORIGIN`을 반드시 지정해야 합니다.

## 납품 기준

자세한 설치·운영·검수 범위는 `DELIVERY_RUNBOOK.md`를 기준으로 합니다. 최종 완료는 source test뿐 아니라 same-SHA public Pages와 실제 Chrome 업무흐름 검증까지 포함합니다.
