# Engineering Mini Labs · V1

외주 수주 범위의 빈칸을 작은 실행 가능한 증거로 채우는 공개 Lab 묶음입니다. 모든 예시는 가상 데이터이며 외부 사이트 조작, 실제 API Key, 고객 credential, 비공개 사업 코드가 없습니다.

Live: `https://kzone87.github.io/portfolio/mini-labs/`

## 1. CMS Lab

- Unicode-aware slug normalization
- title/body validation
- draft/publish boundary
- invalid content publish 차단

## 2. Extraction Lab

- `key: value` 구조화 추출
- strict CSV header validation
- duplicate header 차단
- row별 column mismatch 차단

## 3. Browser Automation Lab

실제 외부 웹을 조작하지 않는 deterministic workflow contract입니다.

- `NAVIGATE / INPUT / CLICK / ASSERT_TEXT`
- step ID uniqueness
- HTTPS only
- `example.com`, `demo.example.com` allow-list
- failure injection과 step event history

## 4. Security Lab

- exact-origin allow-list
- same-origin redirect normalization
- secret masking
- spreadsheet formula injection 방어
- CSP / nosniff / referrer / permissions headers

## 5. QA / Deployment Lab

필수 release gate:

- tests
- build
- secret scan
- health check
- rollback plan

추가 운영 경고:

- observability
- backup verification

필수 gate가 하나라도 실패하면 `NO_GO`입니다.

## Public boundary

- 실제 CMS/브라우저/배포 인프라에 연결하지 않습니다.
- 실제 credential을 사용하지 않습니다.
- 실제 고객 데이터나 비공개 저장소의 코드/구조를 사용하지 않습니다.
- 모든 engine은 deterministic이며 Node regression test로 검증합니다.

## Verification

```bash
npm test
node --check mini-labs/app.js
node --check mini-labs/engine.mjs
```

관련 테스트: `test/mini-labs.test.mjs`
