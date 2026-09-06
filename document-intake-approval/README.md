# Document Intake & Approval · V1

문서를 업로드하는 화면이 아니라 **제출 → 검증 → 수정요청 → 재제출 → 승인/반려 → 보관**을 추적하는 공개 workflow reference입니다.

실제 파일/OCR/고객 문서를 사용하지 않고 fictional metadata와 deterministic `key: value` extraction으로 동작합니다.

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

같은 텍스트를 deterministic parser로 metadata에 반영합니다. 실제 프로젝트에서는 이 경계를 OCR/문서 AI provider adapter로 교체할 수 있습니다.

## Review control

- `SUBMITTER`: draft 수정 / 추출 / 제출
- `REVIEWER`: submitted 문서 승인 / 수정요청 / 반려
- `ADMIN`: review + finalized 문서 archive

`NEEDS_CHANGES`와 `REJECT`는 review comment를 필수로 요구합니다.

## Stale review defense

모든 주요 변경은 `expectedVersion`을 요구합니다.

```text
409 STALE_DOCUMENT
```

이전 화면에서 본 문서를 뒤늦게 승인하여 최신 수정본을 덮는 문제를 방어합니다.

## Live Review Desk

- 문서 검색/상태 필터
- Draft/Submitted/Needs Changes/Approved/Rejected KPI
- 체크리스트
- metadata JSON 편집
- source text extraction
- submit
- role-aware Human Review
- review queue
- archive
- audit trail

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
- `403 REVIEW_FORBIDDEN`
- `403 ARCHIVE_FORBIDDEN`
- `404 DOCUMENT_NOT_FOUND`
- `409 STALE_DOCUMENT`
- `409 CHECKLIST_INCOMPLETE`
- `409 INVALID_DOCUMENT_ACTION`

## Verification

`npm test`는 extraction, checklist, submit blocking, review RBAC, stale review, needs-changes comment, edit/resubmit, archive RBAC, metrics/filter/audit와 JavaScript syntax를 검증합니다.

## Client-facing value

- 신청서/계약서/정산문서 접수
- 내부 승인 workflow
- 서류 누락 체크
- OCR/AI 추출 전후 validation
- 담당자 review queue
- 수정요청/재제출
- 승인 이력/audit
- 기존 관리자페이지의 문서 승인 모듈

## Public boundary

- fictional metadata only
- no real uploads
- no OCR/API key
- no private repository schema/code
- no customer confidential documents
