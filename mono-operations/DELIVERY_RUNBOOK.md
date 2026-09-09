# MONO OPERATIONS · Commercial Delivery Runbook

이 문서는 `mono-operations/server/commercial-app.mjs`를 고객사 운영 서버에 설치하는 기준 절차입니다. GitHub Pages의 공개 데모와 상용 Runtime은 분리됩니다. 상용 Runtime은 실제 SQLite DB, 직원 계정, 서버측 AI credential, 암호화된 Integration secret을 사용합니다.

## 1. 지원 환경

- Linux x64 권장 (Ubuntu 24.04 LTS 기준)
- Node.js 24 LTS 계열
- reverse proxy: Nginx 또는 동등 제품
- TLS 인증서 필수
- 단일 서버 / 단일 MONO 프로세스 기준
- SQLite 파일은 로컬 영속 디스크에 저장

다중 애플리케이션 인스턴스가 필요한 규모에서는 SQLite/프로세스 내 worker 대신 PostgreSQL + 외부 durable queue로 확장해야 합니다.

## 2. 디렉터리

권장 예시:

```text
/opt/mono-operations/app
/var/lib/mono-operations/mono.sqlite
/var/backups/mono-operations/
/etc/mono-operations/mono.env
```

애플리케이션 프로세스는 전용 OS 계정(`mono`)으로 실행하고 DB/backup 디렉터리는 해당 계정만 쓰기 가능하게 설정합니다.

## 3. Secret 생성

DB에 저장되는 Integration secret은 AES-256-GCM으로 암호화됩니다. `MONO_SECRET_KEY`는 DB와 별도 보관해야 합니다.

```bash
openssl rand -base64 32
```

키를 잃으면 저장된 Integration secret을 복호화할 수 없습니다. DB backup과 별도로 secret manager/운영 금고에 백업하십시오.

## 4. Production 환경변수

`.env.example`을 참고합니다.

필수:

- `NODE_ENV=production`
- `MONO_DB_PATH`
- `MONO_SECRET_KEY`
- `MONO_PUBLIC_ORIGIN=https://...`
- `MONO_AI_PROVIDERS`
- `MONO_INTEGRATION_ALLOW_HOSTS`

Production에서는 이 값이 빠지거나 유효하지 않으면 서버가 fail closed 합니다.

### AI provider

`MONO_AI_PROVIDERS`는 서버에서만 읽는 JSON 배열입니다.

```json
[
  {
    "id": "primary",
    "baseUrl": "https://api.openai.com/v1",
    "apiKey": "SERVER_SIDE_SECRET",
    "model": "MODEL_NAME",
    "timeoutMs": 15000
  }
]
```

OpenAI-compatible Chat Completions JSON 응답을 사용하는 provider를 지원합니다. 여러 provider를 배열에 넣으면 앞 provider 실패 시 다음 provider로 넘어갑니다. API key는 브라우저로 전송되지 않습니다.

### Integration outbound allow-list

SSRF 방지를 위해 outbound destination hostname을 명시적으로 허용합니다.

```text
MONO_INTEGRATION_ALLOW_HOSTS=erp.example.com,warehouse.example.com
```

Production outbound URL은 HTTPS만 허용합니다.

## 5. 최초 관리자 계정

새 DB의 최초 실행에서만 다음 값을 설정합니다.

```text
MONO_BOOTSTRAP_ADMIN_EMAIL=admin@example.com
MONO_BOOTSTRAP_ADMIN_NAME=Operations Admin
MONO_BOOTSTRAP_ADMIN_PASSWORD=<12자 이상 강한 비밀번호>
```

첫 관리자 생성 확인 후 **`MONO_BOOTSTRAP_ADMIN_PASSWORD`는 환경파일에서 제거**합니다. 이후 계정 추가는 관리자 API 또는 offline admin command를 사용합니다.

```bash
node scripts/mono-admin.mjs add-user \
  admin@example.com operator@example.com "Operator" OPERATOR '<password>'
```

역할:

- `OPERATOR`
- `REVIEWER`
- `MANAGER`
- `ADMIN`

실제 권한 판정은 역할명이 아니라 capability를 서버에서 확인합니다.

## 6. 실행

Repository 기준:

```bash
npm run start:mono-commercial
```

기본 bind는 `127.0.0.1:8796`입니다. 외부에 Node 포트를 직접 공개하지 않고 Nginx가 TLS를 종료한 뒤 proxy하도록 구성합니다.

## 7. Reverse proxy

`deploy/nginx.conf.example`을 기준으로 다음을 유지합니다.

- HTTPS only
- HTTP → HTTPS redirect
- `Host`, `X-Forwarded-For`, `X-Forwarded-Proto`
- request body size 제한
- upstream timeout

Proxy를 신뢰하는 배포에서는 `MONO_TRUST_PROXY=1`을 사용합니다.

## 8. 인증 / 보안 경계

상용 Runtime은 다음을 강제합니다.

- password: scrypt hash + per-user salt
- session: random token의 SHA-256 hash만 DB 저장
- cookie: HttpOnly + SameSite=Strict + Production Secure
- mutation: CSRF token 검증
- same-origin 검사
- server-side capability RBAC
- login rate limit
- input/body size limit
- CSP / HSTS / frame deny / nosniff
- optimistic version / stale-write 409
- 중요 변경 Audit
- browser credential 저장 금지

## 9. MARKET

상태 흐름:

```text
NEW → PICKING → SHIPPED → DELIVERED
  └────────────→ CANCELLED (허용 단계에서만)
```

환불은 OPERATOR가 요청할 수 있으나 승인/반려는 `refunds.approve` capability가 있어야 합니다. 결정 note는 Audit에 남습니다.

## 10. OFFICE

```text
DRAFT → SUBMITTED → APPROVED → ARCHIVED
                    ├→ NEEDS_CHANGES → SUBMITTED
                    └→ REJECTED
```

작성/제출과 검수 권한을 분리하고 모든 변경은 expectedVersion을 요구합니다.

## 11. SUPPORT

```text
문의 등록
 → 역할 ACL 적용 Knowledge 검색
 → 서버측 AI provider
 → structured output validation
 → NEEDS_REVIEW
 → 사람 승인 / 반려
```

AI가 자동으로 최종 승인하지 않습니다. 생성 시 사용한 Evidence snapshot, provider, Human Review가 DB에 남습니다.

## 12. DATA HUB

Inbound webhook:

```text
HMAC signature
 → event-id dedup
 → DB event
 → durable DB queue
 → outbound HTTP
 → SUCCESS / RETRY
 → exponential backoff
 → DEAD LETTER
```

- Integration secret: AES-256-GCM encrypted at rest
- inbound: `X-MONO-Signature: sha256=<hex>` 필수
- outbound: HTTPS + hostname allow-list
- 동일 `connection + eventId`: 중복 run 생성 금지
- retry queue/dead-letter: SQLite 영속화
- 프로세스 재시작 후 PENDING/expired LEASED work 재처리 가능

## 13. Backup

서비스 실행 중에도 SQLite snapshot을 생성할 수 있습니다.

```bash
MONO_DB_PATH=/var/lib/mono-operations/mono.sqlite \
npm run backup:mono
```

`VACUUM INTO` snapshot 후 `PRAGMA integrity_check`를 수행합니다.

권장:

- 매일 자동 backup
- 최소 7~30일 보관
- DB와 `MONO_SECRET_KEY`는 서로 다른 저장소에 보관
- 정기 restore drill 실시

## 14. Restore

**서버 프로세스를 먼저 중지합니다.**

```bash
MONO_DB_PATH=/var/lib/mono-operations/mono.sqlite \
npm run restore:mono -- /var/backups/mono-operations/mono-2026-09-10.sqlite
```

절차:

1. backup integrity check
2. 현재 DB pre-restore copy 생성
3. backup을 임시 파일에 복사
4. 임시 파일 integrity check
5. 원자적 rename
6. WAL/SHM 제거
7. 최종 integrity check
8. 서버 시작 후 `/ready` 확인

## 15. Health check

```text
GET /health
GET /ready
```

`/ready`가 200이 아니면 reverse proxy/LB에서 트래픽을 보내지 않습니다.

## 16. 배포 전 Acceptance Gate

고객사 납품 완료는 다음이 모두 PASS일 때만 인정합니다.

- Production config fail-closed
- 최초 관리자 / 직원 로그인
- 세션/CSRF/RBAC
- MARKET 실제 상태 전이 + 환불 관리자 승인
- OFFICE 작성 → 제출 → Reviewer 승인 → Archive
- SUPPORT authorized evidence → 실제 provider → Human Review
- DATA HUB signed webhook → dedup → outbound → retry → DLQ
- stale version 409
- Audit
- DB 재시작 persistence
- backup 생성 + integrity
- restore 후 동일 데이터 확인
- actual HTTP server browser QA 1440 / 768 / 390
- pageerror / console.error / unexpected HTTP >= 400 / requestfailed 0
- horizontal overflow 0
- public demo same-SHA Pages QA 회귀 PASS
- 납품 artifact에 `deploy/.env.example`을 포함한 모든 운영 파일 존재
- `MANIFEST.json`의 모든 파일이 실제 artifact에 존재하고 bytes/SHA-256이 일치

### Delivery artifact 무결성

`npm run build:mono-delivery`가 만드는 `dist/mono-operations-delivery`가 납품 원본입니다. GitHub Actions artifact 업로드 시 dotfile을 포함해야 하므로 `include-hidden-files: true`를 유지합니다. 특히 `deploy/.env.example`은 실제 Secret이 아니라 고객사가 Production 환경변수를 구성하기 위한 템플릿이며 납품 패키지에서 빠져서는 안 됩니다.

최종 납품 증빙에서는 GitHub Actions에서 내려받은 **실제 artifact ZIP**을 다시 열어 `MANIFEST.json`을 기준으로 모든 파일의 존재 여부, byte 크기, SHA-256을 재검증합니다. 빌드 디렉터리만 정상이고 업로드 artifact가 불완전한 상태는 납품 완료로 인정하지 않습니다.

## 17. 범위 경계

이 납품형은 **중소기업 단일 조직 / 단일 서버 운영** 기준입니다. 다음 요구가 생기면 별도 확장 설계가 필요합니다.

- 수평 확장 여러 API instance
- 매우 높은 webhook throughput
- multi-tenant SaaS
- SSO/SAML/SCIM
- 대규모 문서 검색/vector DB
- 규제산업 전용 보존/감사 정책
- HA database / multi-region DR

이 경계를 벗어나는 요구를 “현재 코드 그대로 지원”한다고 판매하지 않습니다.
