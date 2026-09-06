const menuButton = document.querySelector('.menu-button');
const nav = document.querySelector('.site-nav');

function closeMenu() {
  if (!menuButton || !nav) return;
  nav.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', '메뉴 열기');
  menuButton.textContent = '메뉴';
}

if (menuButton && nav) {
  menuButton.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
    menuButton.textContent = open ? '닫기' : '메뉴';
  });

  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav.classList.contains('open')) {
      closeMenu();
      menuButton.focus();
    }
  });
}

document.querySelectorAll('.faq-item').forEach((item, index) => {
  const button = item.querySelector('.faq-button');
  const answer = item.querySelector('.faq-answer');
  if (!button || !answer) return;

  const answerId = `faq-answer-${index + 1}`;
  answer.id = answerId;
  button.setAttribute('aria-controls', answerId);
  answer.setAttribute('aria-hidden', 'true');

  button.addEventListener('click', () => {
    const open = item.classList.toggle('open');
    button.setAttribute('aria-expanded', String(open));
    answer.setAttribute('aria-hidden', String(!open));
    const indicator = button.querySelector('span:last-child');
    if (indicator) indicator.textContent = open ? '−' : '+';
  });
});

const form = document.querySelector('#contact-form');
const message = document.querySelector('#form-message');

if (form && message) {
  const requiredFields = ['company', 'name', 'phone', 'service', 'detail'];

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    message.className = 'form-message';

    requiredFields.forEach((fieldName) => {
      const field = form.elements.namedItem(fieldName);
      if (field instanceof HTMLElement) field.removeAttribute('aria-invalid');
    });

    const data = new FormData(form);
    const company = String(data.get('company') || '').trim();
    const name = String(data.get('name') || '').trim();
    const phone = String(data.get('phone') || '').trim();
    const service = String(data.get('service') || '').trim();
    const detail = String(data.get('detail') || '').trim();
    const consent = data.get('consent');

    const invalid = [];
    if (company.length < 2) invalid.push('company');
    if (name.length < 2) invalid.push('name');
    if (phone.replace(/\D/g, '').length < 9) invalid.push('phone');
    if (!service) invalid.push('service');
    if (detail.length < 10) invalid.push('detail');

    invalid.forEach((fieldName) => {
      const field = form.elements.namedItem(fieldName);
      if (field instanceof HTMLElement) field.setAttribute('aria-invalid', 'true');
    });

    if (invalid.length || !consent) {
      message.textContent = '입력 내용을 다시 확인해 주세요. 회사명·담당자·연락처·서비스·문의 내용을 입력하고 개인정보 수집에 동의해야 합니다.';
      message.classList.add('error');
      const firstInvalid = invalid.length ? form.elements.namedItem(invalid[0]) : form.elements.namedItem('consent');
      if (firstInvalid instanceof HTMLElement) firstInvalid.focus();
      return;
    }

    message.textContent = '문의가 정상적으로 접수되었습니다. 이 페이지는 포트폴리오용 가상 기업 사이트이므로 실제 전송은 이루어지지 않습니다.';
    form.reset();
  });
}
