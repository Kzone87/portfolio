# BOOKING CRM Delivery Runbook

## 1. Scope

단일 사업장 또는 소규모 팀을 위한 예약·문의·고객관리 서비스 기준입니다. 공개 포트폴리오의 가상 브랜드/데이터를 실제 고객 정보로 교체한 뒤 운영합니다.

## 2. Runtime requirements

- Node.js 24+
- writable persistent directory for SQLite
- HTTPS reverse proxy (Nginx/Caddy/Cloudflare Tunnel 등)
- process supervisor (systemd/PM2/container)
- daily backup destination

Required production environment:

```text
NODE_ENV=production
BOOKING_DB_PATH=/var/lib/booking-crm/booking.sqlite
BOOKING_ADMIN_PASSWORD=<strong-initial-password>
BOOKING_ALLOWED_ORIGIN=https://booking.example.com
BOOKING_PORT=8798
```

Production은 DB path, admin password, allowed origin 중 하나라도 빠지면 시작하지 않습니다.

## 3. Security boundary

- 직원 로그인은 scrypt password hash 사용
- 인증은 HttpOnly Session + SameSite=Strict cookie 사용
- 관리자 mutation은 CSRF header 필요
- Role은 브라우저 요청 body가 아니라 서버 session에서 결정
- 로그인/공개 예약·문의 endpoint에 process-level rate limit 적용
- 브라우저 Origin allowlist 적용
- 개인정보/고객 메모는 관리자 API에서만 반환
- HTTPS와 reverse-proxy rate limit/WAF는 배포환경에서 추가

## 4. Data workflow

### Booking
`REQUESTED → CONFIRMED → COMPLETED`

예외: `REQUESTED` 또는 `CONFIRMED`에서 `CANCELLED` 가능.

- 같은 서비스 capacity를 초과하는 겹치는 시간은 `409 SLOT_CONFLICT`
- stale version은 `409 STALE_BOOKING`
- 완료/취소 상태의 재처리는 거부

### Inquiry
`NEW → CONTACTED → CLOSED`

### Customer
연락처 기준으로 기존 고객을 재사용하고 예약/문의와 연결합니다. 고객 메모는 직원 작업으로만 수정합니다.

## 5. Backup / restore

운영 DB는 persistent volume에 둡니다. 최소 하루 1회 백업하며 배포 전에는 반드시 추가 snapshot을 만듭니다.

권장 절차:

1. service stop 또는 maintenance window 확보
2. SQLite WAL checkpoint 확인
3. DB 파일 + `-wal` / `-shm` 상태 확인 후 일관된 snapshot 생성
4. backup SHA-256 기록
5. 별도 경로에서 `/ready`와 핵심 조회로 restore drill

## 6. Acceptance gates

- `npm test` PASS
- booking domain conflict/version/state tests PASS
- commercial HTTP auth/CSRF/persistence/audit test PASS
- PR Chrome 1440×1000 / 768×1024 / 390×844 PASS
- 실제 고객 예약 생성 → 관리자 확인 → 확정 → 메모 → 완료 PASS
- 문의 생성 → 관리자 CONTACTED → CLOSED PASS
- console.error / pageerror / requestfailed / unexpected HTTP >=400 없음
- horizontal overflow 없음
- main merge 이후 same-SHA GitHub Pages deploy PASS
- same-SHA production public Chrome QA PASS

## 7. Handover

실제 고객사 납품 시 다음을 고객 정보로 교체/확정합니다.

- 브랜드명/로고/서비스 목록/예약 소요시간/capacity
- 영업일/휴무일/시간대
- 관리자 계정
- 개인정보 처리 문구 및 보유기간
- 운영 도메인/HTTPS
- backup 보존기간과 restore 담당자
- 알림(SMS/이메일/카카오 등)이 범위에 포함되면 해당 provider credential과 실패 정책

외부 알림 provider는 현재 reference runtime에 임의로 포함하지 않습니다. 실제 계약 범위와 provider가 정해진 뒤 server-side secret으로 연결합니다.
