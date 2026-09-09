# OPS KIT · Operations Utility Suite

Live: `https://kzone87.github.io/portfolio/mini-labs/`

OPS KIT는 개발·운영 전 작은 검증 작업을 브라우저에서 로컬로 처리하는 utility suite입니다. 입력값을 서버에 업로드하지 않고, 각 도구가 입력 → 검사 → 결과 → 증빙 JSON 흐름을 제공합니다.

## Product boundary

- 계정/로그인 없음
- 사용자 입력 서버 전송 없음
- 사용자 입력 자동 저장 없음
- 외부 API 호출 없음
- 외부 웹사이트 자동 조작 없음
- 결과 파일은 사용자가 명시적으로 다운로드할 때만 브라우저에서 생성
- Public GitHub Pages는 정적 UI/engine만 배포

Workflow Dry-Run은 자동화 계획을 검증하고 실패를 시뮬레이션할 뿐 실제 브라우저 자동화 실행기가 아닙니다.

## 1. Content Preflight

- 제목 3~120자
- 본문 20~10,000자
- Unicode-aware slug 생성
- TODO/TBD/template placeholder 경고
- 과도한 URL 밀도 경고
- 검사 결과 증빙 JSON

## 2. Data Extractor

- `key: value` 구조화
- duplicate key 차단
- quoted CSV parser
- comma-in-quote / escaped quote 지원
- duplicate/empty header 차단
- row column mismatch 차단
- 입력당 100KB 제한
- key:value 최대 2,000줄
- CSV 최대 5,000행 / 100열
- 추출 결과 JSON 다운로드
- 별도 증빙 JSON 다운로드

## 3. Workflow Dry-Run

- JSON workflow 입력
- `NAVIGATE / INPUT / CLICK / ASSERT_TEXT / WAIT_FOR`
- 최대 30단계
- step id 중복 차단
- public HTTPS NAVIGATE만 허용
- localhost/private IPv4/credential-in-URL 차단
- 실제 network/navigation 없음
- 임의 step id 실패 시뮬레이션
- step event evidence

## 4. Security Check

- exact HTTPS origin 비교
- same-origin redirect normalization
- spreadsheet formula injection 방어 예시
- secret masking
- 기본 security header set 제공
- raw secret은 evidence에 포함하지 않음

## 5. Release Gate

필수 gate:

- automated tests
- production build
- secret scan
- health check
- rollback plan

필수 하나라도 실패하면 `NO_GO`입니다.

추가 운영 경고:

- observability
- backup verification

## Evidence contract

각 실행 증빙은 다음 정보를 포함합니다.

- `schemaVersion`
- `product`
- `tool`
- `status`
- `summary`
- `generatedAt`
- tool-specific result details
- `fingerprint`

Evidence는 입력 원문 전체를 자동 저장하는 용도가 아닙니다. 특히 Security Check의 secret 원문은 evidence에 기록하지 않습니다.

## Security / privacy

페이지에는 meta CSP가 적용되어 `connect-src 'none'`으로 외부 네트워크 요청을 차단합니다. 모든 결과 DOM은 `textContent` 기반으로 렌더링하며 사용자 입력을 HTML로 삽입하지 않습니다.

## Release acceptance

100점 완료 조건은 코드 존재가 아니라 아래 전체 통과입니다.

1. current `main` 기준 source review
2. Node regression tests
3. PR CI
4. OPS KIT dedicated real-Chrome QA
5. merge to `main`
6. final main CI
7. same-SHA GitHub Pages deployment
8. production Chrome 1440 / 768 / 390 render
9. 5개 실제 tool workflow interaction
10. console error / pageerror / requestfailed / HTTP >= 400 / horizontal overflow 없음
11. final evidence artifact 생성

## Local verification

```bash
npm test
node --check mini-labs/app.js
node --check mini-labs/engine.mjs
```

관련 테스트:

- `test/mini-labs.test.mjs`
- `test/mini-ui-quality.test.mjs`
- `test/ops-kit-service-grade.test.mjs`
