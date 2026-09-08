# NEXA Service Operations · Small Business Delivery

NEXA TECH SERVICE의 **직원용 서비스 운영시스템**입니다. 고객 상담 접수부터 고객 연락 확인, 현장 방문 요청 생성, 기사 배차, 출동, 현장 도착, 완료와 상담 종료까지 한 Workspace에서 처리합니다.

공개 GitHub Pages는 fictional data를 사용하는 실행형 demo입니다. 실제 납품 환경에서는 같은 UI가 Node API에 연결되고, 직원 로그인·세션·권한·SQLite 영속성·감사로그를 사용합니다.

## 실제 직원 흐름

```text
고객 상담
  ↓
상담 접수함
  ↓
고객 연락 확인
  ↓
방문 필요 판단
  ↓
현장 방문 요청 생성
  ↓
REQUESTED
  ↓
기사 배정
SCHEDULED
  ↓
DISPATCHED
  ↓
ON_SITE
  ↓
COMPLETED
  ↓
상담 종료
```

직원은 API를 직접 호출할 필요가 없습니다. `상담 접수`, `배차 운영`, `직원 계정` 화면에서 업무를 처리합니다.

## 직원 인증

Production browser는 더 이상 `window.NEXA_OPS_CONFIG.token` 같은 장기 Bearer credential을 사용하지 않습니다.

```text
직원 로그인
→ 서버 비밀번호 검증
→ HttpOnly session cookie
→ /api/me
→ 서버 Principal
→ STAFF / ADMIN 권한
```

보안 경계:

- 비밀번호는 SQLite에 scrypt hash + random salt로 저장
- session token은 브라우저에서 JavaScript로 읽을 수 없는 `HttpOnly` cookie
- `SameSite=Lax`
- production cookie는 `Secure`
- mutation은 session CSRF token 필요
- Origin allowlist
- 비활성화/비밀번호 재설정 시 기존 session 폐기
- 마지막 활성 ADMIN은 비활성화/강등 불가
- browser request body의 `actor` / `role`은 신뢰하지 않음
- machine-to-machine 연동에 한해 별도 Bearer service principal을 유지할 수 있음

## 직원 계정 관리

ADMIN은 화면에서:

- 직원 계정 생성
- STAFF / ADMIN 역할 관리
- 팀/이름 수정
- 계정 활성/비활성
- 비밀번호 재설정
- 인증 변경 이력 확인

을 할 수 있습니다.

## 상담 접수함

NEXA TECH SERVICE의 public Inquiry DB를 같은 운영 Workspace에서 읽습니다.

직원은:

1. PENDING 상담 확인
2. 고객 연락 후 CONTACTED
3. 실제 현장 주소·기사 전달내용·우선순위 확인
4. `방문 요청 생성`
5. Field Job 생성
6. 배차 화면에서 일정 배정
7. 현장 작업 완료 후 상담 CLOSED

순서로 처리합니다.

방문 요청은 `Idempotency-Key`를 사용하므로 네트워크 재시도 시 같은 Field Job이 중복 생성되지 않습니다. Field Job이 진행 중이면 상담을 CLOSED로 종료할 수 없습니다.

## Field Job 상태

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

### 일정 충돌

동일 기사에게 활성 작업이 겹치면:

```text
409 SLOT_CONFLICT
```

끝나는 시각과 다음 작업 시작 시각이 같은 경우는 허용하는 half-open interval입니다.

### 긴급 override

충돌 override는 아래 세 조건을 모두 요구합니다.

- Job priority = `URGENT`
- 인증 Principal role = `ADMIN`
- override reason 5자 이상

성공한 예외는 `SCHEDULE_OVERRIDE` audit에 충돌 Job ID와 사유를 기록합니다.

### Optimistic concurrency

모든 주요 mutation은 `expectedVersion`을 요구합니다.

```text
409 STALE_JOB
```

SQLite write 자체도 `UPDATE ... WHERE id=? AND version=?`으로 다시 확인합니다.

## Production 실행

```bash
npm run start:field-service-api
```

권장 구성은 **직원 UI와 API를 같은 origin으로 reverse proxy**하는 방식입니다.

```text
https://ops.example.com/
  /                    → static field-service-ops UI
  /api/*               → Node Service Operations API
```

이렇게 하면 HttpOnly session cookie와 Origin 정책을 단순하고 안전하게 유지할 수 있습니다.

### 최초 production 환경변수

```text
NODE_ENV=production

NEXA_OPS_DB_PATH=/persistent-data/nexa-ops.sqlite
NEXA_INQUIRY_DB_PATH=/persistent-data/nexa-inquiries.sqlite

NEXA_OPS_ALLOWED_ORIGINS=https://ops.example.com

NEXA_OPS_BOOTSTRAP_ADMIN_JSON={"id":"ops-admin","username":"admin","name":"Operations Admin","team":"Operations","password":"<initial-long-password>"}
NEXA_OPS_AGENTS_JSON=[{"id":1,"name":"Field Agent 1","region":"Central","active":true}]
```

`NEXA_OPS_BOOTSTRAP_ADMIN_JSON`은 **사용자 테이블이 비어 있는 최초 기동에서만** 초기 ADMIN을 만듭니다. 계정이 생성된 뒤에는 운영 관리자 화면에서 직원을 관리합니다.

선택적 machine-to-machine principal:

```text
NEXA_OPS_PRINCIPALS_JSON=[{"token":"<service-secret>","id":"nexa-inquiry-service","name":"NEXA Inquiry Service","role":"STAFF","team":"System"}]
```

브라우저 직원 로그인용으로 이 token을 사용하지 않습니다.

### Session 설정

기본값:

```text
NEXA_OPS_SESSION_MAX_MS=28800000
NEXA_OPS_SESSION_IDLE_MS=1800000
```

- 절대 session 최대: 8시간
- 유휴 만료: 30분

## 주요 API

Public:

```text
GET  /api/health
POST /api/auth/login
```

Authenticated employee:

```text
POST /api/auth/logout
GET  /api/me

GET  /api/inquiries
GET  /api/inquiries/:id
GET  /api/inquiries/:id/audits
POST /api/inquiries/:id/contacted
POST /api/inquiries/:id/visit-request
POST /api/inquiries/:id/close

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

ADMIN:

```text
GET  /api/admin/users
GET  /api/admin/auth-audits
POST /api/admin/users
POST /api/admin/users/:id
POST /api/admin/users/:id/password
```

## Backup / restore boundary

실제 운영 데이터는 최소 다음 두 SQLite 파일을 함께 백업해야 합니다.

```text
NEXA_OPS_DB_PATH
NEXA_INQUIRY_DB_PATH
```

WAL mode를 사용하므로 운영 중 raw file copy보다 SQLite online backup 또는 서비스 정지 후 checkpoint + file backup 방식을 사용합니다. 복구 시 두 DB를 같은 시점의 backup set으로 복원하는 것을 권장합니다.

## Public demo boundary

공개 GitHub Pages:

- fictional customer/company/address only
- 로그인 없이 local demo 실행
- 상담 접수함 → 방문 요청 → 배차 UI 체험 가능
- 직원 계정 관리도 fictional local state
- 실제 production credential 없음

Production:

- session login
- server-trusted role/actor
- persistent SQLite
- real inquiry inbox
- persistent field jobs/audits
- account lifecycle

## Verification

`npm test`에서 기존 Field Ops 도메인 테스트와 함께 다음 delivery 경계를 검증합니다.

- password login / invalid login
- HttpOnly session cookie
- CSRF rejection
- server actor spoof protection
- employee inquiry inbox
- CONTACTED → Field Job handoff
- idempotent visit creation
- active Field Job이 있을 때 inquiry close 차단
- Schedule → Dispatch → On Site → Complete → Inquiry Close
- account create/update/password reset/session revocation
- last ADMIN protection
- browser production UI에서 configured Bearer token 제거
- public demo / production remote mode 분리

## 납품 범위

이 저장소는 NEXA 제품군을 공개 검증하기 위한 fictional brand/data를 사용합니다. 실제 고객 납품 시에는 고객사의 도메인, 직원 계정, 기사 목록, 개인정보 처리방침, 백업 정책, TLS/reverse proxy와 운영환경을 별도 구성해야 합니다.
