# NEXA TECH SERVICE

기업용 출력·인쇄·사무장비 유지보수와 현장 기술지원을 가정한 고객용 기업 홈페이지입니다.

## Product boundary

공개 GitHub Pages와 실제 납품 환경은 같은 고객 UI를 사용하되 상담 전송 경계를 다르게 둡니다.

### Public portfolio

- fictional brand / fictional scenarios
- 서비스·이용고객·이용상황·상담 UI 실행
- 상담 form validation
- 상담 내용 preview / clipboard copy
- 외부 서버로 실제 개인정보를 전송하지 않음

### Delivery runtime

실제 납품 시 `window.NEXA_INQUIRY_ENDPOINT`에 API base URL을 설정하면 기존 상담 form이 실제 접수 API를 사용합니다.

```html
<script>
window.NEXA_INQUIRY_ENDPOINT = 'https://service-api.example.com';
</script>
<script src="./app.js"></script>
```

이 설정이 있을 때만 버튼 문구가 `상담 요청 보내기`로 바뀌고 `POST /api/inquiries`를 호출합니다. 설정이 없으면 공개 Portfolio와 동일하게 preview-only로 동작합니다.

## Inquiry workflow

```text
Customer form
   ↓ validation / rate limit
PENDING
   ↓ admin contacted
CONTACTED
   ↓ admin close
CLOSED
```

상태 변경은 `expectedVersion`을 요구하고 SQLite의 조건부 UPDATE로 stale update를 차단합니다. 관리자 상태 변경은 `inquiry_audits`에 인증 Principal ID와 함께 기록합니다.

## Run inquiry API

```bash
npm run start:nexa-inquiry-api
```

기본 포트: `8796`

로컬 DB 기본 위치:

```text
nexa-tech-service/server/data/inquiries.sqlite
```

## Production configuration

```text
NODE_ENV=production
NEXA_INQUIRY_DB_PATH=/persistent-data/inquiries.sqlite
NEXA_INQUIRY_ALLOWED_ORIGINS=https://www.example.com
NEXA_INQUIRY_ADMINS_JSON=[{"token":"<long-secret>","id":"service-coordinator"}]
NEXA_INQUIRY_TRUST_PROXY=1
NEXA_INQUIRY_RATE_MAX=5
NEXA_INQUIRY_RATE_WINDOW_MS=600000
```

Production mode에서는 허용 Origin과 관리자 Principal이 없으면 서버가 시작되지 않습니다. Token은 저장소에 커밋하지 않고 환경변수 또는 배포 플랫폼 secret으로 주입합니다.

`NEXA_INQUIRY_TRUST_PROXY=1`은 신뢰할 수 있는 reverse proxy 뒤에서만 사용합니다. 이 설정이 켜지면 rate-limit client key를 계산할 때 첫 `X-Forwarded-For` 값을 사용합니다.

## API

### Public

```text
GET  /api/health
POST /api/inquiries
```

### Admin

```text
GET  /api/admin/inquiries?status=PENDING
GET  /api/admin/inquiries/:id
GET  /api/admin/inquiries/:id/audits
POST /api/admin/inquiries/:id/contacted
POST /api/admin/inquiries/:id/close
```

Admin API는 Bearer 인증이 필요합니다.

## Stored customer data

실제 접수 API를 사용하는 경우 다음 상담 데이터가 SQLite에 저장됩니다.

- 회사·조직명
- 담당자명
- 연락처
- 선택 입력 이메일
- 업종 / 사업장 수 / 장비 수
- 업무 영향
- 관심 서비스 / 이용 방식
- 상담 상세내용
- 상태 / version / 생성·수정 시각

공개 GitHub Pages에서는 이 데이터를 서버에 저장하지 않습니다.

## Verification

`npm test`에서 고객 페이지 회귀테스트와 함께 다음을 검증합니다.

- server/client validation boundary
- PENDING creation
- rate limit
- Origin allowlist
- admin authentication
- versioned PENDING → CONTACTED → CLOSED
- stale update rejection
- audit identity
- SQLite persistence after reopen
- public preview-only / configured real-submit dual mode
