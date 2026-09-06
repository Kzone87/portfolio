# 숨고 견적 응답 템플릿 · Final Catalog

숨고에서는 고객 요청을 다시 요약하고 **현재 문제 → 1차 범위 → 시작 예산 → 추가 확인사항** 순서로 짧게 답변합니다.

## 공통 첫 문장

안녕하세요. 요청하신 내용을 기준으로 먼저 실제 업무 흐름을 정리한 뒤, 1차에서 꼭 필요한 기능만 고정해 개발하는 방식이 적합합니다. 공개 포트폴리오에는 유사한 운영 흐름을 직접 확인할 수 있는 Live Demo와 테스트/CI 증거가 있습니다.

## 관리자페이지 / 업무관리 시스템

공개 사례: **Business Ops Dashboard V8**  
고객/거래처 → 업무 → 담당자 → 상태 → 승인 → 이력/보고서 흐름을 구현했습니다.

- 관리자 모듈: 149만원부터
- 풀스택 업무시스템: 299만원부터
- 고급 승인·복수연동: 499만원부터

확인: 사용자 역할, 핵심 데이터, 상태 흐름, 승인자, 필요한 보고서.

## Excel / CSV 자동화

공개 사례: **Customer Data Workbench V3**  
검증, 정리, Column Mapping, Compare, Batch/Migration까지 재현합니다.

- 단일 자동화: 49만원부터
- 반복 Workflow: 149만원부터
- Batch/Migration: 299만원부터

확인: 대표 입력 파일, 원하는 출력, 현재 수작업 순서, 월 파일 수.

## API / 기존 시스템 연동

공개 사례: **Integration Control Center V3**  
Webhook, Idempotency, Retry, Dead Letter와 실행 이력을 구현했습니다.

- 작은 API: 49만원부터
- 연동 Workflow: 149만원부터
- 운영형 Integration: 299만원부터

확인: Source/Target, API 문서, 인증 방식, 데이터 종류, 실패 시 처리.

## AI Workflow

공개 사례: **AI Workflow Review Desk V2**  
근거 검색 → Structured Output → Evaluation → Human Review → Audit 흐름입니다.

- Prototype: 149만원부터
- Backend/Audit: 299만원부터
- 복수 Workflow/RAG Ops: 499만원부터

확인: AI 입력, 기대 출력, 근거 데이터, 사람이 반드시 승인할 조건, provider 계정.

## 쇼핑몰 주문·운영

공개 사례: **Commerce Ops Console V1**  
주문, Hold, 출고, 배송, 반품, 부분환불, 고액 환불 승인과 Audit를 구현했습니다.

- 주문관리: 149만원부터
- Commerce Ops: 299만원부터

확인: 상품/주문 데이터, 결제·배송 연동, 환불 규칙, 관리자 역할.

## 예약 / 배차 / 현장서비스

공개 사례: **Booking & Field Service Ops V1**  
일정 충돌 차단, 담당자 배정, Dispatch → On-site → Complete, 긴급 ADMIN override가 있습니다.

- 예약관리: 149만원부터
- Field Ops: 299만원부터

확인: 예약 단위, 담당자 수, 영업시간, 이동/소요시간, 긴급 배정 정책.

## 문서접수 / 검수 / 승인

공개 사례: **Document Intake & Approval V1**  
Checklist → Submit → Review → Needs Changes/Approve/Reject → Archive를 구현했습니다.

- 접수/검수: 149만원부터
- Approval Workflow: 299만원부터

확인: 문서 종류, 필수항목, 첨부파일, 검토자/승인자, 수정요청 방식.

## 공통 마무리

정확한 견적을 위해 아래 네 가지만 우선 알려주시면 됩니다.

1. 현재 처리 방식
2. 가장 불편한 점
3. 개발 후 반드시 가능해야 하는 결과
4. 희망 예산과 일정

전체를 한 번에 만들기보다 실제 사용 가능한 1차 버전을 먼저 완료한 뒤 권한·연동·자동화를 추가하는 방식도 가능합니다.
