# 포트폴리오 이미지 / 60초 영상 구성 · Final

기술 목록보다 **고객이 자기 업무에 적용되는 흐름을 빠르게 이해하는 화면**을 우선합니다.

## 공통 이미지 원칙

각 Flagship은 5~8장으로 구성합니다.

1. 고객 문제 / Before
2. 메인 Dashboard 또는 Queue
3. 핵심 Workflow
4. 실패·검증·권한 경계
5. Audit / History
6. Report / 결과
7. Architecture / 공개 Source
8. CI / Test

## Business Ops Dashboard V8

- Customer + Work Order
- Priority / Due Date
- Approval request / ADMIN decision
- Audit timeline
- Operations Analytics
- CSV/XLSX Reporting

## Customer Data Workbench V3

- Main quality profile
- Rule Builder
- Column Mapping
- Dataset Compare
- Batch/Migration workspace
- Migration Report / combined XLSX

## AI Workflow Review Desk V2

- Knowledge Catalog
- ranked Evidence Review
- Structured Output / Evaluation
- provider fallback
- Human edit + Approve/Reject
- evidence-aware Review Audit

## Integration Control Center V3

- Connection / Job / Run
- Webhook event
- duplicate event defense
- failed run → Retry
- retryOf lineage
- Dead Letter

## Commerce Ops Console V1

- Ops KPI
- order state split
- Hold / Release
- Picking / Shipment
- Refund queue
- STAFF blocked / ADMIN approve
- Audit trail

## Booking & Field Service Ops V1

- Dispatch Board
- Agent schedule
- normal slot conflict
- URGENT ADMIN override
- Dispatch → On-site → Complete
- Audit

## Document Intake & Approval V1

- Checklist
- metadata extraction
- Submit queue
- Needs Changes
- resubmit
- Approve / Reject
- Archive / Audit

## Engineering Mini Labs V1

한 장의 5-panel montage 또는 짧은 GIF:

- CMS publish gate
- strict Extraction
- Automation failure injection
- Security defenses
- QA/Deployment NO_GO → GO

# 60초 영상 공통 구조

```text
0~7초   고객 문제
7~15초  입력/접수
15~30초 핵심 Workflow
30~42초 실패/권한/검증 경계
42~52초 Audit/결과/Report
52~57초 공개 Source + CI
57~60초 서비스 시작가 + 견적 CTA
```

## 추천 첫 영상 순서

1. Business Ops V8 — 관리자/CRM 대표
2. Data Workbench V3 — Excel 자동화 대표
3. AI Review Desk V2 — AI 대표
4. Integration V3 — API 연동 대표
5. Commerce V1
6. Field Service V1
7. Document V1

캡션은 기술명보다 고객 가치 중심으로 작성합니다. 예: `승인 전에는 업무를 완료할 수 없습니다`, `겹치는 기사 일정은 서버에서 차단합니다`, `근거 없는 AI 답변은 검토 대상으로 보냅니다`.
