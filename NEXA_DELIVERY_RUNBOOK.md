# NEXA Delivery Runbook

이 문서는 NEXA TECH SERVICE / CUSTOMER SERVICE / SERVICE OPERATIONS를 **단일 서버 또는 소규모 VM 기반의 소규모 기업 운영환경**에 납품할 때 사용하는 기준입니다.

NEXA의 공개 GitHub Pages는 fictional data를 사용하는 시연환경입니다. 이 문서의 production 절차는 공개 Pages가 아니라 고객사 전용 서버에 배포하는 실행구조를 설명합니다.

## 1. Delivery scope

### Customer surfaces

```text
NEXA TECH SERVICE
서비스 탐색 · 상담 접수
        ↓
NEXA CUSTOMER SERVICE
접수 조회 · 방문 일정 · 추가 문의 · 일정변경/취소 요청 · 처리결과 확인
```

### Employee surface

```text
NEXA SERVICE OPERATIONS
직원 로그인
→ 상담 접수함
→ 고객 연락 확인
→ 고객 추가 요청 처리
→ 방문 요청 생성
→ 기사 배차
→ 출동
→ 현장 도착
→ 완료/취소/방문불가
→ 상담 종료
```

### Runtime services

- Customer Inquiry API: Node.js 24 + SQLite
- Service Operations API: Node.js 24 + SQLite
- Employee authentication: HttpOnly session cookie + CSRF + server-side RBAC
- Reverse proxy / TLS: Caddy, nginx 또는 동등한 TLS reverse proxy
- Static web: `npm run build:nexa-delivery` 결과물만 공개

## 2. Intended operating size

이 구성은 단일 사업자 또는 소규모 서비스 조직의 상담·배차·현장업무를 위한 **single-node 운영구조**입니다.

- SQLite는 동일 서버의 영속 디스크에 둡니다.
- 여러 리전 active-active, 무중단 DB cluster, 대규모 multi-tenant SaaS는 이 납품 범위가 아닙니다.
- 고객 데이터 민감도가 높아지거나 규제 대상 정보가 추가되면 고객 인증, 암호화, 보존정책을 해당 규제에 맞게 다시 설계해야 합니다.

## 3. Server layout

권장 예시:

```text
/srv/nexa/
├─ app/        # repository / server code, web root 아님
├─ web/        # build:nexa-delivery 결과만 배포
├─ data/       # SQLite persistent data
└─ backups/    # local backup snapshots
```

`app/` 디렉터리를 HTTP document root로 설정하지 마세요. `server/`, 테스트, 운영문서가 공개되지 않도록 `web/` 결과물만 정적 파일로 제공합니다.

실행 OS 계정은 NEXA 전용 계정을 사용하고 `data/`와 `backups/`는 해당 계정만 읽고 쓸 수 있도록 권한을 제한합니다.

## 4. Required software

- Node.js 24
- reverse proxy with HTTPS
- persistent local disk
- 서비스 관리자(systemd, supervisor, container orchestrator 등)

애플리케이션은 npm runtime dependency 없이 Node.js built-in API를 사용합니다.

## 5. Environment configuration

`deploy/nexa.env.example`을 기준으로 실제 배포 플랫폼의 환경변수/secret store에 값을 등록합니다.

### Never put in the repository

- 직원 초기 비밀번호
- `NEXA_OPS_PRINCIPALS_JSON`의 service token
- `NEXA_FIELD_OPS_SERVICE_TOKEN`
- `NEXA_INQUIRY_ADMINS_JSON`
- 고객사 실제 데이터가 들어 있는 SQLite 파일
- backup 파일

### First ADMIN bootstrap

첫 production 시작 시 직원 DB가 비어 있으면 `NEXA_OPS_BOOTSTRAP_ADMIN_JSON`을 secret store에서 일시적으로 주입합니다.

예시 구조만 참고합니다.

```json
{"id":"ops-admin","username":"admin","name":"Operations Admin","team":"Operations","password":"<secret>"}
```

첫 로그인이 확인되고 DB에 ADMIN 계정이 생성되면 bootstrap secret을 runtime 설정에서 제거합니다. 이후 직원 생성, 권한 변경, 비활성화와 비밀번호 재설정은 SERVICE OPERATIONS의 `직원 계정` 화면에서 수행합니다.

마지막 활성 ADMIN은 비활성화하거나 STAFF로 낮출 수 없습니다.

## 6. Machine-to-machine handoff

Customer Inquiry API가 방문 요청을 Service Operations에 전달할 때 브라우저 자격정보를 사용하지 않습니다.

```text
Inquiry API
  NEXA_FIELD_OPS_SERVICE_TOKEN
       ↓
Service Operations API
  NEXA_OPS_PRINCIPALS_JSON
```

같은 service token을 양쪽 secret store에 설정하되 repository나 정적 web bundle에는 넣지 않습니다. 이 Principal은 사람이 로그인하는 계정과 분리합니다.

## 7. Build public web package

고객/직원 브라우저에 공개할 정적 파일은 repository 전체가 아니라 delivery build로 생성합니다. 실제 고객 납품 build는 API 주소뿐 아니라 **실제 고객 도메인과 공개 회사정보 파일을 필수 입력**으로 요구합니다. 둘 중 하나라도 빠지거나 유효하지 않으면 build가 실패합니다.

`nexa-tech-service/company-profile.example.json`을 복사해 고객사가 확인한 공개정보로 작성하되, 실제 고객정보 파일은 source control 밖의 배포 설정 경로에 둡니다.

필수 공개 회사정보:

- 상호/브랜드명과 브랜드 마크
- 법인·사업자명
- 대표자명
- 사업자등록번호
- 사업장 주소
- 대표 전화와 이뮔일
- 실제 운영시간
- 실제 서비스 가능 지역
- 개인정보 처리방침 URL
- 선택: OG 공유 이뮔지 URL

```bash
NEXA_PUBLIC_API_ORIGIN=https://service.example.com \
NEXA_OPS_API_ORIGIN=https://ops.example.com \
NEXA_CUSTOMER_SECURE_ORIGIN=https://service.example.com \
NEXA_PUBLIC_SITE_ORIGIN=https://service.example.com \
NEXA_COMPANY_PROFILE_FILE=/srv/nexa/app/deploy/company-profile.json \
NEXA_DELIVERY_DIR=/srv/nexa/web \
npm run build:nexa-delivery
```

build는 TECH SERVICE 7개 페이지의 가상 브랜드 고지를 실제 고객의 법적 Footer로 교체하고, HOME에는 회사·운영 정보 영역을 생성합니다. 또한 실제 고객 도메인으로 canonical/OG URL을 바꾸고 Organization JSON-LD를 생성합니다. 공개 GitHub Pages 원본은 계속 fictional NEXA 고지를 유지하므로 실제 고객정보를 공개 포트폴리오에 섞지 않습니다.

빌드 결과에는:

- 고객 기업사이트
- 고객 서비스 Portal
- 직원 Operations UI
- API endpoint runtime config
- 공용 UI dictionary
- 고객이 확인한 공개 회사정보가 반영된 기업사이트 HTML

만 포함됩니다.

다음은 제외됩니다.

- server source
- tests
- scripts
- public demo application/data
- credentials
- `company-profile.example.json`
- 실제 company profile 원본 JSON

API endpoint는 URL만 포함합니다. 브라우저용 config에 password/token을 넣지 않습니다. 고객 개인정보나 secret은 company profile에 넣지 말고 공개 가능한 사업자/연락 정보만 사용합니다.

## 8. Reverse proxy and TLS

`deploy/Caddyfile.example`은 두 도메인을 분리하는 예시입니다.

```text
service.example.com
→ Customer static web
→ /api/* : Inquiry API :8796

ops.example.com
→ Employee static web
→ /api/* : Operations API :8792
```

직원 Operations surface를 고객 도메인에서 제공하지 않고, 고객 surface도 직원 도메인에서 제공하지 않는 구성을 권장합니다.

Production browser origin은 반드시 `NEXA_*_ALLOWED_ORIGINS`에 명시합니다. `*`는 production에서 허용하지 않습니다.

TLS는 reverse proxy에서 종료하고 외부 HTTP 접근은 HTTPS로 redirect합니다.

## 9. Start order

권장 시작 순서:

1. 영속 디스크 mount 확인
2. SQLite 경로와 권한 확인
3. Service Operations API 시작
4. `GET /api/health` 확인
5. `GET /api/ready` 확인
6. Customer Inquiry API 시작
7. Inquiry `GET /api/health`에서 `fieldOpsHandoff: true` 확인
8. reverse proxy 시작/재로드
9. 고객/직원 web smoke test

Production 필수 DB 경로, origin, Agent 또는 인증 설정이 빠지면 서버가 fail-closed로 시작을 거부합니다.

## 10. Health and readiness

### Operations

```text
GET /api/health
GET /api/ready
```

- `health`: 프로세스와 서버 경계가 살아 있는지 확인
- `ready`: 작업 DB, 직원 계정 저장소와 상담 DB가 읽기 가능한지 확인

reverse proxy의 readiness 또는 배포 후 smoke check에는 `/api/ready`를 사용합니다.

### Inquiry

```text
GET /api/health
```

Inquiry API는 production 시작 시 영속 Inquiry DB, origin allowlist와 Field Ops 연결 설정을 검증합니다. health 응답의 `fieldOpsHandoff`와 `legacyCustomerAccess`를 확인합니다. Production 기본값은 `legacyCustomerAccess: false`이며 고객 조회·추가요청은 Secure Customer Access API를 통해 처리합니다.

## 11. Backup

백업 명령:

```bash
NEXA_OPS_DB_PATH=/srv/nexa/data/nexa-ops.sqlite \
NEXA_OPS_AUTH_DB_PATH=/srv/nexa/data/nexa-ops.sqlite \
NEXA_INQUIRY_DB_PATH=/srv/nexa/data/inquiries.sqlite \
NEXA_BACKUP_DIR=/srv/nexa/backups \
npm run backup:nexa
```

백업은 SQLite `VACUUM INTO`로 일관된 snapshot을 생성합니다.

각 backup set에는:

- SQLite snapshot
- 생성시간
- logical DB keys
- byte size
- SHA-256 checksum
- manifest JSON

이 포함됩니다.

Operations와 Auth가 같은 SQLite 파일을 쓰면 한 번만 snapshot합니다.

### Suggested policy

실제 보존기간은 고객사 정책으로 확정합니다. 소규모 운영의 시작점으로는 다음을 권장할 수 있습니다.

- 매일 자동 backup
- 최근 일별 backup + 주별 backup 별도 보존
- 최소 한 사본은 애플리케이션 서버와 다른 저장소에 보관
- 정기적으로 restore drill 수행

이는 서비스 보장 수치가 아니라 운영 시작을 위한 권장사항입니다.

## 12. Restore

**두 API 프로세스를 먼저 중지한 뒤 수행합니다.**

```bash
NEXA_RESTORE_CONFIRM=RESTORE_NEXA \
NEXA_OPS_DB_PATH=/srv/nexa/data/nexa-ops.sqlite \
NEXA_OPS_AUTH_DB_PATH=/srv/nexa/data/nexa-ops.sqlite \
NEXA_INQUIRY_DB_PATH=/srv/nexa/data/inquiries.sqlite \
npm run restore:nexa -- /srv/nexa/backups/manifest-YYYYMMDDTHHMMSSsssZ.json
```

Restore는 다음 순서로 동작합니다.

1. 명시적 confirmation 검사
2. manifest 구조 검사
3. backup SHA-256 checksum 검사
4. backup SQLite `quick_check`
5. 현재 DB를 `.pre-restore-*` 파일로 보존
6. temporary file에 복원
7. SQLite `quick_check`
8. target 교체
9. 최종 `quick_check`
10. 검증 실패 시 pre-restore copy로 복귀

Restore 후 두 API를 다시 시작하고 health/readiness 및 업무 smoke test를 수행합니다.

## 13. Employee account lifecycle

- 직원은 username/password로 로그인합니다.
- password hash/salt는 서버 SQLite에만 저장합니다.
- 인증 성공 시 HttpOnly session cookie를 사용합니다.
- production cookie는 `Secure`, `SameSite=Lax`를 사용합니다.
- session mutation은 CSRF token을 요구합니다.
- idle/absolute expiry가 적용됩니다.
- 직원 비활성화 또는 비밀번호 재설정 시 기존 session은 폐기됩니다.
- actor와 role은 브라우저 request body를 신뢰하지 않고 서버 session Principal에서 결정합니다.

퇴사/권한 변경 시 직원 계정을 즉시 비활성화하고 변경 이력을 확인합니다.

## 14. Customer request security boundary

Customer Service는 회원계정 없이 다음 두 정보를 일치시켜 요청을 조회합니다.

- 예측하기 어려운 접수번호
- 상담 시 등록한 전체 연락처

조회와 고객 추가 요청에는 rate limit이 적용됩니다. 존재하지 않는 접수번호와 잘못된 연락처는 동일한 not-found 응답을 사용합니다.

고객 응답에는 직원 인증정보, 고객 전화번호, 이메일, 담당자명 등 내부/개인 필드를 포함하지 않습니다.

고객은 기사 일정이나 Field Job 상태를 직접 변경할 수 없습니다. `일정 변경 요청`, `방문 취소 요청`, `추가 문의`를 Queue에 남기고 직원이 확인한 뒤 처리결과를 기록합니다.

Production 고객 Portal은 접수번호 확인 후 등록 연락처 또는 이메일로 일회용 인증번호를 보내고, 검증 성공 시 HttpOnly 고객 세션을 생성합니다. 의료·금융·신원정보 등 고위험 데이터를 추가하는 경우 현재 OTP webhook을 고객사의 승인된 IAM/MFA 또는 SSO 정책으로 교체해야 합니다.

## 15. Daily operator checklist

운영 담당자 권장 확인순서:

1. 상담 접수함의 `접수 대기`
2. 고객 추가 요청 `처리 대기`
3. 긴급 방문 요청
4. 미배정 Field Job
5. 기사별 일정 충돌/공백
6. 출동 중·현장 작업 중 상태
7. 완료 작업과 종료 가능한 상담
8. 최근 변경 이력 / auth audit
9. backup 성공 여부

## 16. Incident checklist

### 직원 로그인이 안 될 때

- `/api/health` 및 `/api/ready`
- reverse proxy origin
- 직원 active 상태
- session expiry
- system clock
- auth audit

### 상담은 들어왔는데 배차로 넘어가지 않을 때

- Inquiry status가 `CONTACTED`인지 확인
- 방문 주소/요약 입력 확인
- Inquiry API health의 `fieldOpsHandoff`
- service token 양쪽 설정 일치 확인
- 동일 inquiry의 handoff/audit 확인

같은 handoff는 deterministic Idempotency-Key를 사용하므로 네트워크 장애 후 재시도해도 중복 Field Job 생성을 막습니다.

### 일정 저장이 안 될 때

- `STALE_JOB`: 최신 데이터를 새로 불러온 뒤 다시 처리
- `SLOT_CONFLICT`: 다른 기사/시간 선택
- 긴급 override: ADMIN + 긴급 작업 + 명시적 사유 필요

## 17. Deployment acceptance smoke test

납품 전 최소 다음을 실제 deployment environment에서 확인합니다.

```text
[ ] 고객 사이트 HTTPS 접속
[ ] 실제 상담 POST → Inquiry 생성
[ ] 직원 로그인
[ ] 상담 접수함에서 신규 상담 확인
[ ] 고객 연락 확인
[ ] 방문 요청 생성 → Field Job 1건
[ ] 기사 일정 배정
[ ] 고객 Portal에서 방문 일정 확인
[ ] 고객 일정 변경 요청 생성
[ ] 직원 화면에서 추가 요청 확인/처리
[ ] 고객 Portal에서 처리 결과 확인
[ ] Dispatch → On Site → Complete
[ ] 상담 종료
[ ] 직원 비활성화/session revoke
[ ] /api/health + /api/ready
[ ] backup 생성 + checksum
[ ] restore drill
[ ] 모바일/좁은 화면 overflow 확인
```

## 18. Handover package

고객 인수인계에는 최소 다음을 포함합니다.

- application source revision
- public web delivery bundle
- environment variable 목록
- secret 전달 경로(소스와 분리)
- DB/backup 위치
- backup schedule
- restore 절차
- 최초 ADMIN 이후 계정관리 방법
- 서비스 시작/중지 방법
- reverse proxy/TLS configuration
- acceptance smoke 결과
- 알려진 범위와 확장 필요조건

이 기준을 충족해야 NEXA를 단순 공개 데모가 아니라 **소규모 기업에 배포 가능한 서비스 운영시스템 패키지**로 판정합니다.

## Commercial customer access

The production customer portal uses a separate secure-access process on port `8797`.

- `POST /api/customer/access/challenge` creates a short-lived OTP challenge without revealing whether the request number exists.
- Production keeps the old full-phone lookup/action endpoints disabled by default (`NEXA_ALLOW_LEGACY_CUSTOMER_ACCESS=0`) so OTP cannot be bypassed.
- The OTP is stored only as a hash. A challenge expires, has a bounded attempt count, and is single-use.
- Production startup requires `NEXA_CUSTOMER_OTP_WEBHOOK_URL`; the server does not claim an SMS/email was sent when no provider is configured.
- A verified OTP creates an `HttpOnly`, `SameSite=Lax`, `Secure` customer session in production.
- Customer mutations require the session plus `x-csrf-token`.
- Service history is limited to the same company plus the verified phone/email identity. A customer cannot enumerate another company's requests.
- Work reports expose service-safe fields only. Employee credentials, customer email/phone, internal auth/audit data and server secrets are not returned.

Required production values are documented in `deploy/nexa.env.example`. Route `/api/customer/access/*` to the secure-access process before the generic Inquiry API route.

## Commercial field workflow

The employee workspace provides four views over the same server-side jobs and state machine:

- **Day** — the existing dispatcher timeline and queue.
- **Week** — seven-day agent scheduling. Eligible jobs can be dragged to another agent/day; the operation still uses `expectedVersion`, server RBAC and slot-conflict validation.
- **Map** — an address/location board with a direct external map-search link for each customer site. No client-side geocoding secret is embedded in the public bundle.
- **Field View** — technician-oriented mobile cards for dispatch, arrival, completion, persisted checklist, work note and one compressed field photo (JPEG/PNG/WebP, <=800KB).

Field reports are stored in the Operations SQLite database and are included in the NEXA backup/restore lifecycle. Customer secure reports can show the service-safe work note/photo after authentication.

For a production technician account, use the same employee name as the configured agent profile or add an organization-specific account-to-agent mapping during deployment. Never silently map an unmatched production employee to another technician.

## Commercial acceptance boundary

This delivery profile is intended for a small service company on a single managed VM/server. It includes session auth, CSRF, SQLite persistence, audit history, customer OTP access, backup/restore, HTTPS reverse-proxy boundaries and responsive customer/employee surfaces. It is not represented as a multi-region enterprise SaaS, regulated medical/financial identity platform, or guaranteed SLA product. If the customer stores higher-risk personal data, replace the OTP webhook/provider and identity policy with the customer's approved IAM/MFA requirements.
