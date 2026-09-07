const menuButton = document.querySelector('.menu-button');
const nav = document.querySelector('.site-nav');

function closeMenu({ restoreFocus = false } = {}) {
  if (!menuButton || !nav) return;
  nav.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', '메뉴 열기');
  menuButton.textContent = '메뉴';
  if (restoreFocus) menuButton.focus();
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
    if (event.key === 'Escape' && nav.classList.contains('open')) closeMenu({ restoreFocus: true });
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900 && nav.classList.contains('open')) closeMenu();
  });
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const revealItems = [...document.querySelectorAll('[data-reveal]')];
if (!reduceMotion && revealItems.length && 'IntersectionObserver' in window) {
  document.documentElement.classList.add('motion-ready');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -32px' });
  revealItems.forEach((item) => observer.observe(item));
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

const filterButtons = [...document.querySelectorAll('[data-case-filter]')];
const caseCards = [...document.querySelectorAll('[data-case]')];
if (filterButtons.length && caseCards.length) {
  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const filter = button.dataset.caseFilter || 'all';
      filterButtons.forEach((item) => item.classList.toggle('active', item === button));
      caseCards.forEach((card) => {
        card.hidden = filter !== 'all' && card.dataset.case !== filter;
      });
    });
  });
}

const form = document.querySelector('#contact-form');
const message = document.querySelector('#form-message');
const summary = document.querySelector('#form-summary');
const summaryText = document.querySelector('#form-summary-text');
const copyButton = document.querySelector('#copy-request');
let currentRequestText = '';

function formField(formElement, name) {
  return formElement.elements.namedItem(name);
}

function clearInvalidState(formElement) {
  [...formElement.querySelectorAll('[aria-invalid="true"]')].forEach((field) => field.removeAttribute('aria-invalid'));
}

function markInvalid(formElement, names) {
  names.forEach((name) => {
    const field = formField(formElement, name);
    if (field instanceof HTMLElement) field.setAttribute('aria-invalid', 'true');
  });
}

function requestLine(label, value) {
  return `${label}: ${value || '미입력'}`;
}

if (form && message) {
  form.addEventListener('input', (event) => {
    const field = event.target;
    if (field instanceof HTMLElement && field.hasAttribute('aria-invalid')) field.removeAttribute('aria-invalid');
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearInvalidState(form);
    message.className = 'form-message';
    message.textContent = '';
    if (summary) summary.classList.remove('open');
    if (copyButton) copyButton.classList.remove('visible');

    const data = new FormData(form);
    const values = {
      company: String(data.get('company') || '').trim(),
      name: String(data.get('name') || '').trim(),
      phone: String(data.get('phone') || '').trim(),
      email: String(data.get('email') || '').trim(),
      industry: String(data.get('industry') || '').trim(),
      sites: String(data.get('sites') || '').trim(),
      assets: String(data.get('assets') || '').trim(),
      impact: String(data.get('impact') || '').trim(),
      service: String(data.get('service') || '').trim(),
      engagement: String(data.get('engagement') || '').trim(),
      detail: String(data.get('detail') || '').trim(),
      consent: data.get('consent')
    };

    const invalid = [];
    if (values.company.length < 2) invalid.push('company');
    if (values.name.length < 2) invalid.push('name');
    if (values.phone.replace(/\D/g, '').length < 9) invalid.push('phone');
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) invalid.push('email');
    if (!values.industry) invalid.push('industry');
    if (!values.impact) invalid.push('impact');
    if (!values.service) invalid.push('service');
    if (values.detail.length < 10) invalid.push('detail');
    if (!values.consent) invalid.push('consent');

    if (invalid.length) {
      markInvalid(form, invalid);
      message.textContent = '필수 항목을 확인해 주세요. 잘못된 첫 항목으로 이동했습니다.';
      message.classList.add('error');
      const firstInvalid = formField(form, invalid[0]);
      if (firstInvalid instanceof HTMLElement) firstInvalid.focus();
      return;
    }

    currentRequestText = [
      '[NEXA TECH SERVICE 유지보수 상담]',
      requestLine('회사·조직', values.company),
      requestLine('담당자', values.name),
      requestLine('연락처', values.phone),
      requestLine('이메일', values.email || '선택 안 함'),
      requestLine('업종', values.industry),
      requestLine('사업장 규모', values.sites),
      requestLine('장비 규모', values.assets),
      requestLine('업무 영향', values.impact),
      requestLine('관심 서비스', values.service),
      requestLine('희망 방식', values.engagement),
      `현재 문제:\n${values.detail}`
    ].join('\n');

    if (summaryText) summaryText.textContent = currentRequestText;
    if (summary) summary.classList.add('open');
    if (copyButton) copyButton.classList.add('visible');
    message.textContent = '상담 요청서를 만들었습니다. 내용을 확인한 뒤 복사할 수 있습니다.';
    summary?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
  });
}

if (copyButton) {
  copyButton.addEventListener('click', async () => {
    if (!currentRequestText) return;
    try {
      await navigator.clipboard.writeText(currentRequestText);
      if (message) message.textContent = '상담 요청서를 클립보드에 복사했습니다.';
    } catch {
      if (message) {
        message.textContent = '자동 복사를 사용할 수 없습니다. 미리보기 내용을 직접 선택해 복사해 주세요.';
        message.classList.add('error');
      }
    }
  });
}
