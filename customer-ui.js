export const STATUS_LABELS = Object.freeze({
  ACTIVE: '처리 중', ON_HOLD: '처리 보류', CANCELLED: '취소됨', CLOSED: '처리 완료',
  PAID: '결제 완료', REFUND_PENDING: '환불 검토 중', PARTIALLY_REFUNDED: '부분 환불', REFUNDED: '환불 완료',
  UNFULFILLED: '출고 전', PICKING: '상품 준비 중', SHIPPED: '배송 중', DELIVERED: '배송 완료', RETURNED: '반품 접수',
  REQUESTED: '접수됨', SCHEDULED: '예약 완료', DISPATCHED: '출동 중', ON_SITE: '현장 작업 중', COMPLETED: '완료', NO_SHOW: '방문 불가',
  DRAFT: '작성 중', SUBMITTED: '검수 대기', NEEDS_CHANGES: '수정 요청', APPROVED: '승인', REJECTED: '반려', ARCHIVED: '보관',
  PENDING: '처리 대기', GENERATED: 'AI 정리 완료', NEEDS_REVIEW: '담당자 확인 필요',
  SUCCESS: '성공', FAILED: '실패', PAUSED: '일시정지', ERROR: '확인 필요',
  NORMAL: '일반', URGENT: '긴급', HIGH: '높음', LOW: '낮음', MEDIUM: '보통',
  INVOICE: '인보이스', APPLICATION: '신청서', CONTRACT: '계약서',
  ADMIN_REQUIRED: '관리자 확인 필요', STANDARD_REVIEW: '일반 검토',
  NOT_FULFILLED: '출고 필요', HIGH_VALUE_ORDER: '고액 주문',
  ADDRESS_CHECK: '주소 확인', STOCK_CHECK: '재고 확인', PAYMENT_REVIEW: '결제 확인', FRAUD_REVIEW: '이상 거래 확인', CUSTOMER_REQUEST: '고객 요청', OTHER: '기타',
  DUPLICATE: '중복 결제', DAMAGED: '상품 파손', LOST: '배송 분실'
});

export const ACTION_LABELS = Object.freeze({
  CREATE: '등록', HOLD: '처리 보류', RELEASE: '보류 해제', START_PICKING: '상품 준비 시작', SHIP: '출고 처리', DELIVER: '배송 완료', RETURN: '반품 접수', CANCEL: '취소',
  REQUEST_REFUND: '환불 검토 요청', REFUND_REVIEW_REQUIRED: '관리자 확인 요청', APPROVE_REFUND: '환불 승인', REJECT_REFUND: '환불 반려',
  SCHEDULE: '일정 배정', RESCHEDULE: '일정 변경', REASSIGN: '담당자 변경', SCHEDULE_OVERRIDE: '긴급 일정 예외 적용', DISPATCH: '출동 시작', ON_SITE: '현장 도착', COMPLETE: '작업 완료', NO_SHOW: '방문 불가 처리',
  EDIT: '내용 수정', EXTRACT: '값 추출', SUBMIT: '검수 요청', APPROVE: '승인', NEEDS_CHANGES: '수정 요청', REJECT: '반려', ARCHIVE: '보관'
});

export const ROLE_LABELS = Object.freeze({ STAFF: '직원', ADMIN: '관리자', SUBMITTER: '문서 작성자', REVIEWER: '검수 담당자' });
export const FIELD_LABELS = Object.freeze({ documentNo: '문서번호', party: '거래처', amount: '금액', applicantName: '신청자명', email: '이메일', counterparty: '계약 상대', effectiveDate: '적용일' });
export const CATEGORY_LABELS = Object.freeze({ billing: '결제·환불', access: '계정·권한', incident: '서비스 장애', data: '데이터 처리', security: '보안 확인', general: '일반 문의' });

export function uiLabel(value, fallback = '') {
  const key = String(value ?? '').trim();
  const mapped = STATUS_LABELS[key] ?? ACTION_LABELS[key] ?? ROLE_LABELS[key] ?? CATEGORY_LABELS[key];
  return mapped ?? (fallback || key);
}

export function friendlyActor(value) {
  const actor = String(value ?? '');
  if (actor.includes('admin')) return '관리자';
  if (actor.includes('reviewer')) return '검수 담당자';
  if (actor.includes('staff') || actor === 'dispatcher') return '담당 직원';
  if (actor.includes('field-agent')) return '현장 기사';
  if (actor.includes('submitter')) return '문서 작성자';
  if (actor === 'system') return '자동 처리';
  return '담당자';
}

export function friendlyError(error, fallback = '현재 상태에서는 이 작업을 처리할 수 없습니다.') {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const rules = [
    [/STALE_|expectedVersion/i, '다른 작업으로 내용이 먼저 변경되었습니다. 화면을 다시 확인해 주세요.'],
    [/overlapping|SLOT_CONFLICT/i, '선택한 담당자의 기존 일정과 시간이 겹칩니다. 다른 시간이나 담당자를 선택해 주세요.'],
    [/ADMIN role|FORBIDDEN/i, '이 작업은 관리자 권한에서만 처리할 수 있습니다.'],
    [/trackingNo/i, '출고하려면 운송장 번호를 입력해 주세요.'],
    [/refund amount/i, '환불 가능 금액 안에서 금액을 입력해 주세요.'],
    [/hold reason|unsupported hold/i, '보류 사유를 다시 선택해 주세요.'],
    [/CHECKLIST_INCOMPLETE|required metadata/i, '필수 항목을 모두 채운 뒤 다시 검수 요청해 주세요.'],
    [/comment/i, '수정 요청 또는 반려 사유를 입력해 주세요.'],
    [/current state|cannot|only .* can|already terminal/i, fallback],
    [/invalid|unsupported/i, '입력 내용을 다시 확인해 주세요.']
  ];
  for (const [pattern, text] of rules) if (pattern.test(message)) return text;
  return fallback;
}
