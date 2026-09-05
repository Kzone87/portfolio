# 크몽 서비스 등록용 원고

이 문서는 공개 포트폴리오의 실제 기능 범위를 기준으로 작성한 **크몽 등록용 초안**입니다. 가격은 시작 범위이며 구매 전 요구사항을 확인한 뒤 범위를 확정하는 것을 전제로 합니다.

---

# 상품 1 · 관리자페이지 / 사내 업무관리 웹 시스템

## 추천 제목

**엑셀·수기 업무를 고객관리 관리자페이지와 업무시스템으로 개발합니다**

## 썸네일 핵심 문구

```text
고객관리 · 업무상태 · 권한
관리자 웹 시스템 개발
React + Spring Boot
```

## 첫 설명

Excel, 메신저, 수기로 관리하던 고객·거래처와 업무 진행상황을 **검색·등록·수정·상태처리가 가능한 웹 시스템**으로 전환합니다.

단순 화면 제작보다 실제 운영 흐름을 먼저 확인합니다.

```text
고객 등록
→ 업무 접수
→ 담당자 처리
→ 상태 변경
→ 변경 이력
→ 결과 조회/출력
```

공개 포트폴리오 `Business Ops Dashboard V6`에서 고객/업무 관계, ADMIN/STAFF 권한, 상태 머신, Audit History, 우선순위·마감일, 테스트·CI를 확인할 수 있습니다.

## 패키지 제안

| 패키지 | 시작가 | 기본 범위 |
| --- | ---: | --- |
| STANDARD | 149만원 | 업무 도메인 1개, CRUD, 검색/필터, 기본 관리자 화면 |
| DELUXE | 299만원 | 고객+업무 관계, 상태처리, DB/API, 기본 권한 |
| PREMIUM | 499만원부터 | 다중 업무도메인, RBAC, Audit, Excel, Dashboard, 배포 범위 협의 |

> 최종 가격은 화면 개수보다 데이터 관계, 권한, 상태 전이, 외부 연동, 기존 코드 유무에 따라 달라집니다.

## 포함 가능한 기능

- 고객 / 거래처 / 회원 CRUD
- 업무 / 주문 / 신청 CRUD
- 검색 / 필터 / 정렬
- 접수 → 진행 → 완료/취소 상태
- 관리자 / 직원 역할 권한
- 변경 이력
- 우선순위 / 마감일
- Excel/CSV import-export
- REST API / DB
- Swagger/OpenAPI
- 자동화 테스트 / CI

## 별도 협의

- 결제
- 문자/메일 대량 발송
- 외부 ERP/CRM 대규모 연동
- 복잡한 승인결재
- 실시간 채팅/알림
- 대규모 데이터 migration
- 디자인 원본 제작
- 서버/도메인/유료 API 사용료

## 상담 전에 필요한 정보

1. 현재 Excel/사이트/메신저로 어떻게 업무하는지
2. 사용하는 사람 종류와 대략적인 인원
3. 반드시 필요한 화면/기능
4. 업무 상태가 있다면 처리 순서
5. 예산과 일정

## 공개 증거

- Repository: `Kzone87/user-directory-api`
- Case: Business Ops Dashboard V6
- Evidence: React/TypeScript, Spring Boot, MyBatis, RBAC, Audit, State Machine, CI

---

# 상품 2 · Excel / CSV 반복업무 자동화

## 추천 제목

**반복되는 엑셀 CSV 정리·검증·변환 업무를 자동화 도구로 개발합니다**

## 썸네일 핵심 문구

```text
Excel · CSV 업무자동화
검증 · 정리 · 컬럼매핑 · Export
API Key 없이도 가능
```

## 첫 설명

매달 같은 Excel 파일을 열어 공백을 지우고, 전화번호를 맞추고, 잘못된 값을 찾고, 컬럼명을 바꾸고, 다시 저장하는 업무를 **반복 가능한 자동화 도구**로 바꿉니다.

필요하면 파일을 서버에 올리지 않고 브라우저 안에서만 처리하는 local-first 방식으로 구성할 수 있습니다.

```text
Excel/CSV Import
→ Validation
→ Normalize
→ Column Mapping
→ Review
→ Export
```

공개 `Customer Data Workbench V2.4`에서 Rule Builder, 중복 제거, Undo/Redo, Recipe, Validation Report, Column Mapping을 직접 확인할 수 있습니다.

## 패키지 제안

| 패키지 | 시작가 | 기본 범위 |
| --- | ---: | --- |
| STANDARD | 49만원 | 명확한 단일 변환/정리 자동화 1개 |
| DELUXE | 149만원 | Import + 검증 + 정리 + 결과 Export 업무 흐름 |
| PREMIUM | 299만원부터 | Rule Builder / Mapping / 여러 파일 규칙 / 웹 UI 고도화 |

## 포함 가능한 기능

- XLSX / XLS / CSV import
- 필수값 검사
- 이메일 / 전화번호 / 숫자 검사
- 허용값 Rule
- 공백 / 이메일 / 전화번호 정규화
- 중복 제거
- Column Mapping
- 일괄 수정
- 검수 Report
- CSV / XLSX export
- Undo / 원본 복원
- 반복 작업 Recipe

## 특히 적합한 의뢰

- ERP 업로드 전 Excel 검증
- 거래처 명단 정리
- 회원/상품/재고 데이터 정규화
- 서로 다른 업체 양식 통합
- 매월 반복되는 보고자료 변환
- 서버 업로드가 부담되는 내부 파일 처리

## 상담 전에 필요한 정보

- 실제 샘플 Excel/CSV의 개인정보 제거본
- 지금 사람이 하고 있는 작업 순서
- 입력 파일 종류와 개수
- 최대 행 수
- 최종 결과 파일 예시

## 공개 증거

- Live: `https://kzone87.github.io/customer-map-planner/`
- Mapping: `https://kzone87.github.io/customer-map-planner/mapping.html`
- Repository: `Kzone87/customer-map-planner`

---

# 상품 3 · REST API / 외부 시스템 연동

## 추천 제목

**기존 웹서비스와 외부 API를 연결하고 데이터 동기화 기능을 개발합니다**

## 썸네일 핵심 문구

```text
REST API · 시스템 연동
Sync Job · 실패이력 · 중복방지
기존 서비스 연결
```

## 첫 설명

A 시스템의 데이터를 B 시스템으로 옮기거나, 기존 프런트엔드에 API를 붙이거나, 반복 동기화 작업을 운영할 수 있도록 **연동 경계와 실패 처리까지 포함한 기능**을 개발합니다.

단순 API 호출 1회보다 다음을 중요하게 봅니다.

```text
Connection
→ Sync Job
→ Execute
→ Success / Failed
→ Run History
→ Retry / Duplicate Prevention
```

공개 `Integration Control Center V2`에는 Connection / Job / Run 모델, 400/404/409 오류 계약, Idempotency-Key 기반 중복 실행 방지, HTTP integration test가 포함되어 있습니다.

## 패키지 제안

| 패키지 | 시작가 | 기본 범위 |
| --- | ---: | --- |
| STANDARD | 49만원 | 명확한 API 기능 1개 또는 기존 API 연결 1건 |
| DELUXE | 149만원 | 데이터 변환 + 저장 + 오류처리 포함 연동 흐름 |
| PREMIUM | 299만원부터 | 다중 Connection / Job / Run / 이력 / 중복방지 운영 기능 |

## 포함 가능한 기능

- REST API CRUD
- Request/Response validation
- 외부 API 호출
- 데이터 변환/정규화
- DB 저장
- 400/404/409 오류 계약
- 실패 이력
- Idempotency
- Retry 기준
- Webhook 수신 경계
- OpenAPI
- integration test

## 별도 협의

- 제3자 API 이용료
- OAuth 인증 승인 절차
- 결제/금융/민감정보 연동
- 초고빈도 동기화
- Queue / Worker / 대용량 batch
- 운영 모니터링과 장기 장애 대응

## 공개 증거

- Live Lab: `https://kzone87.github.io/portfolio/integration-control-center/`
- Source: `Kzone87/portfolio/integration-control-center`

---

# 공통 구매 전 안내 문구

구매 전 메시지로 아래 내용을 보내주시면 패키지 적합 여부와 범위를 먼저 확인합니다.

1. 현재 방식
2. 해결하려는 문제
3. 반드시 필요한 결과
4. 기존 소스/DB 유무
5. 외부 연동 유무
6. 희망 일정과 예산 범위

요구사항이 아직 정리되지 않았어도 괜찮습니다. 다만 **합의되지 않은 기능을 무제한으로 포함하는 방식은 사용하지 않고**, 구현할 것/제외할 것/완료 조건을 먼저 정리합니다.
