# Document Intake & Approval · V1

문서를 **접수 → 필수값 검증 → 수정/추출 → 제출 → 승인·수정요청·반려 → 보관**까지 추적하는 공개 workflow reference입니다.

공개 포트폴리오에서는 실제 파일/OCR/고객 문서를 저장하지 않고 fictional metadata와 deterministic `key: value` extraction으로 동작합니다. 화면의 `새 문서 접수`는 파일 업로드 대신 공개 데모용 원문 텍스트를 받으며, 실제 프로젝트에서는 동일 경계를 업로드/OCR provider adapter로 교체할 수 있습니다.

## Status workflow

```text
DRAFT
  ↓ checklist + submit
SUBMITTED
  ├─ APPROVE       → APPROVED → ARCHIVED
  ├─ NEEDS_CHANGES → NEEDS_CHANGES → edit/extract → submit
  └─ REJECT        → REJECTED → ARCHIVED
```

## Document types / checklist

- `INVOICE`: `documentNo`, `party`, `amount`
- `APPLICATION`: `applicantName`, `email`
- `CONTRACT`: `documentNo`, `counterparty`, `effectiveDate`

필수 metadata가 빠지면 제출 시 `409 CHECKLIST_INCOMPLETE`를 반환합니다.

## Extraction simulation

공개 데모에서는 OCR/API를 호출하지 않습니다.

```text
documentNo: INV-2026-0901
party: Alpha Supply
amount: 125000
```

같은 텍스트를 deterministic parser로 metadata에 반영합니다.

## Role boundary

- `SUBMITTER`: 새 문서 접수 / draft 수정 / 추출 / 제출
- `REVIEWER`: submitted 문서 승인 / 수정요청 / 반려
- `ADMIN`: review + finalized 문서 archive

역할 제어는 버튼 숨김에만 의존하지 않고 domain store / REST boundary에서도 강제합니다. 작성자 동작을 REVIEWER/ADMIN이 직접 호출하면 `403 AUTHOR_FORBIDDEN`, 검수 권한 우회는 `403 REVIEW_FORBIDDEN`, 보관 권한 우회는 `403 ARCHIVE_FORBIDDEN`을 반환합니다.

## Auditable review

승인·수정 요청·반려 **모든 검수 결정은 4~500자의 결정 근거**를 요구합니다. 처리 결과, 담당 역할, 문서 version, 결정 근거는 audit trail에서 다시 확인할 수 있습니다.

## Stale review defense

모든 주요 변경은 `expectedVersion`을 요구하며 화면에도 현재 version을 표시합니다.

```text
409 STALE_DOCUMENT
```

이전 화면에서 본 문서를 뒤늦게 승인하여 최신 수정본을 덮는 문제를 방어합니다.

## Live Operations Desk

- 새 문서 접수
- 제목/거래처/문서번호 검색
- 상태/문서종류 필터 + 초기화
- 검수 대기/수정 요청/필수값 미완료 우선 처리 큐
- Draft/Submitted/Needs Changes/Approved/Rejected KPI
- 원문 미리보기 + 필수값 checklist
- metadata 수정 / deterministic extraction
- submit
- role-aware Human Review
- version visibility
- ADMIN archive
- audit trail
- mobile quick navigation

정적 Live Lab과 Node REST reference는 같은 domain store를 사용합니다.

## REST API

```bash
npm run start:document-api
```

기본 포트 `8793`.

```text
GET  /api/health
GET  /api/metrics
GET  /api/documents
GET  /api/documents/:id
GET  /api/audits
POST /api/documents
POST /api/documents/:id/update
POST /api/documents/:id/extract
POST /api/documents/:id/submit
POST /api/documents/:id/review
POST /api/documents/:id/archive
```

## Error contract

- `400 INVALID_DOCUMENT`
- `400 EXPECTED_VERSION_REQUIRED`
- `403 AUTHOR_FORBIDDEN`
- `403 REVIEW_FORBIDDEN`
- `403 ARCHIVE_FORBIDDEN`
- `404 DOCUMENT_NOT_FOUND`
- `409 STALE_DOCUMENT`
- `409 CHECKLIST_INCOMPLETE`
- `409 INVALID_DOCUMENT_ACTION`

## Verification

`npm test`는 extraction, checklist, submit blocking, 작성/검수/보관 RBAC, stale version, 검수 근거 필수, 수정요청→재제출, metrics/filter/audit와 100점 UI 계약을 검증합니다.

`Document live Pages QA`는 같은 commit SHA의 GitHub Pages 배포가 끝난 뒤 실제 Chrome에서 다음을 검증합니다.

```text
1440 / 768 / 390 render
→ search/filter
→ new intake
→ incomplete submit block
→ extraction
→ submit
→ REVIEWER approval with rationale
→ ADMIN archive
→ audit trail
```

## Client-facing value

- 신청서/계약서/정산문서 접수
- 내부 승인 workflow
- 서류 누락 체크
- OCR/AI 추출 전후 validation
- 담당자 review queue
- 수정요청/재제출
- 승인 근거/audit
- 기존 관리자페이지의 문서 승인 모듈

## Public boundary

- fictional metadata only
- no real uploads
- no OCR/API key
- no private repository schema/code
- no customer confidential documents
