# Development Services & Starting Scope

외주 상담에서 바로 예산 범위를 잡을 수 있도록 서비스를 **작은 기능 → 업무자동화 → 풀스택 업무시스템**으로 나눕니다.

> 아래 금액은 **시작가**입니다. 최종 견적은 사용자 권한, 데이터 구조, 상태 전이, 외부 연동, 기존 코드 수정 여부, 배포·운영 조건을 확인한 뒤 고정합니다.

## Package A · STANDARD — 49만원부터

### 적합한 의뢰

- 기존 웹서비스 버그 수정 또는 기능 1개 추가
- 작은 REST API 1개 또는 명확한 CRUD 보완
- Excel/CSV 단일 반복작업 자동화
- 기존 코드의 환경변수/credential 분리
- 작은 데이터 변환 도구

### 기본 납품 기준

- 합의한 기능 구현
- 잘못된 입력/실패 상황 기본 처리
- 변경된 파일과 실행 방법 정리
- 가능하면 재현 가능한 테스트 또는 검수 절차

### 이 패키지보다 커지는 기준

여러 화면이 서로 연결되거나 DB 관계, 사용자 권한, 업무 상태, 외부 API 연동이 추가되면 DELUXE 이상으로 범위를 다시 산정합니다.

---

## Package B · DELUXE — 149만원부터

### 적합한 의뢰

- 관리자 CRUD / 검색 / 필터
- Excel/CSV import → validation → export
- 반복 업무를 브라우저 또는 내부 웹 도구로 전환
- 간단한 업무 상태 처리
- 기존 프런트엔드에 연결할 API/DB 기능
- 외부 API 1~2개 연동

### 가능한 범위

- 거래처 / 회원 / 주문 / 신청 데이터 CRUD
- 검색, 필터, 정렬, pagination
- Excel/CSV import, validation, normalization, export
- Column Mapping / 데이터 형식 표준화
- 서버 validation과 일관된 오류 응답
- 기본 API/DB 설계
- 필요 시 local-first 브라우저 처리

### 대표 공개 증거

- Customer Data Workbench V2.4
- Integration Control Center V2

---

## Package C · PREMIUM — 299만원부터

### 적합한 의뢰

- 고객·거래처와 업무를 함께 관리하는 사내 시스템
- 관리자/직원처럼 역할이 나뉘는 운영 화면
- 접수 → 진행 → 완료/취소 등 상태 머신
- 변경 이력, 권한, DB, REST API가 함께 필요한 프로젝트
- 기존 수작업을 핵심 업무 웹시스템으로 전환

### 가능한 범위

- React/TypeScript 관리자 UI
- Spring Boot REST API
- MyBatis/DB 관계형 데이터
- RBAC
- 업무 상태 머신
- Audit History
- Priority / Due date planning
- Excel/CSV import-export
- OpenAPI / integration test / CI

### 대표 공개 증거

- Business Ops Dashboard V6

---

# 별도 협의 항목

다음 항목은 프로젝트에 따라 별도 비용 또는 외부 서비스 비용이 발생할 수 있습니다.

- 문자 / 메일 / 결제 / 지도 / AI 등 유료 API 사용료
- 서버 / DB / 도메인 / 스토리지 비용
- 디자인 원본 제작 또는 브랜드 디자인
- 대규모 기존 데이터 migration
- 복잡한 권한 체계와 승인 단계
- 실시간 기능 / 대용량 트래픽 / queue worker
- 장기 운영·모니터링·유지보수
- 기존 코드가 크거나 문서화되지 않은 프로젝트의 사전 분석

# 범위를 줄여 시작하는 방법

초기 예산이 제한적이면 전체 시스템을 한 번에 만들지 않고 아래처럼 나눌 수 있습니다.

```text
1차: 핵심 CRUD / Import / 상태처리
2차: 권한 / Audit / 자동화
3차: 외부 API / Dashboard / 운영 고도화
```

중요한 것은 1차 버전도 실제 사용 가능한 완료 조건을 가지는 것입니다.

---

# 주요 개발 범위

## 업무용 웹 시스템 / 관리자 기능

- 거래처 / 회원 / 주문 / 신청 데이터 CRUD
- 검색, 필터, 정렬, pagination
- 접수 → 진행 → 완료/취소 상태 처리
- 관리자 Dashboard / 목록 / 상세 / 등록 / 수정
- RBAC / Audit History
- REST API / DB
- Excel/CSV import-export

## Excel · CSV · 반복 업무 자동화

- XLSX / XLS / CSV 읽기
- 필수값 / 이메일 / 전화번호 / 사용자 규칙 validation
- 데이터 정규화 / 중복 제거
- Column Mapping
- 검색 / 필터 / 일괄 변환
- CSV / XLSX export
- Undo / 원본 복원 / Recipe
- 필요 시 서버 업로드 없는 local-first 구성

## REST API · 시스템 연동

- CRUD REST API
- Request / Response validation
- 400 / 404 / 409 오류 계약
- DB 연동
- 외부 API 데이터 변환
- Connection / Job / Run 운영 모델
- 실패 이력 / 중복 실행 방지 / idempotency
- OpenAPI / integration test / CI

## 기존 웹서비스 개선

- 오류 원인 분석 / 버그 수정
- 기능 추가
- credential / environment 분리
- 책임 혼재 코드 단계적 개선
- 테스트 추가
- 프레임워크 현대화 범위 설계

---

# 진행 방식

1. **현재 업무 확인** — 지금 누가 무엇을 어떻게 처리하는지 확인
2. **필수 결과 확인** — 프로젝트 완료 후 반드시 가능해야 하는 행동 정의
3. **범위/제외 확정** — 견적에 포함되는 것과 빠지는 것을 문서화
4. **고정 견적** — 확인된 범위를 기준으로 금액과 일정을 결정
5. **구현/검증** — 정상 흐름 + validation + 실패 상황 확인
6. **검수/납품** — 소스, 실행·배포 방법, 필요한 설정 전달

# 견적에 큰 영향을 주는 요소

- 사용자 종류와 권한 수
- 업무 상태 전이의 복잡도
- DB 테이블과 데이터 관계
- 외부 API / 결제 / 메일 / 문자 연동
- Excel/CSV 파일 형식의 다양성
- 데이터 양과 처리량
- 기존 코드 수정 여부
- 배포 환경과 운영 지원
- 테스트 / 문서 요구 수준

# 1차 견적에 필요한 최소 정보

기술 언어를 정해서 문의할 필요는 없습니다. 아래 네 가지면 먼저 범위를 나눌 수 있습니다.

1. **현재 방식** — 지금 Excel, 사이트, 메신저 등으로 어떻게 처리하는지
2. **가장 불편한 점** — 반복 입력, 오류, 검색, 승인 등 무엇을 줄이고 싶은지
3. **꼭 필요한 결과** — 관리자 화면, Excel 출력, 승인, API 연동 등
4. **예산/일정** — 대략적인 예산 범위와 반드시 맞춰야 하는 일정

더 자세한 내용은 [`PROJECT-BRIEF.md`](./PROJECT-BRIEF.md)에 정리하면 됩니다.
