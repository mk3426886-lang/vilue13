/**
 * Vilue — shared utilities
 */

const Vilue_Utils = (() => {
  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function debounce(fn, wait = 300) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }

  // Basic Iraqi phone validation — starts with 07 and is 11 digits total.
  function isValidIraqiPhone(value) {
    return /^07[0-9]{9}$/.test((value || '').trim());
  }

  // Zain Cash numbers specifically start with 078.
  function isValidZainCashPhone(value) {
    return /^078[0-9]{8}$/.test((value || '').trim());
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || '').trim());
  }

  // Arabic or English letters and spaces, for names.
  function isValidName(value) {
    return (value || '').trim().length >= 2 && (value || '').trim().length <= 60;
  }

  function showToast(message, type = 'default', duration = 3000) {
    let toast = qs('#vilue-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'vilue-toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = `toast is-visible${type === 'default' ? '' : ` toast-${type}`}`;
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => toast.classList.remove('is-visible'), duration);
  }

  function formatSlon(amount) {
    return new Intl.NumberFormat(Vilue_I18n.getLang() === 'ar' ? 'ar-IQ' : 'en-US').format(amount);
  }

  function slonToIqd(slon) {
    return slon / 5;
  }

  function setLoading(button, isLoading) {
    if (!button) return;
    button.disabled = isLoading;
    button.dataset.originalText = button.dataset.originalText || button.textContent;
    if (isLoading) {
      button.innerHTML = '<span class="spinner"></span>';
    } else {
      button.textContent = button.dataset.originalText;
    }
  }

  function badgeHtml(verificationBadge) {
    if (!verificationBadge) return '';
    const config = {
      owner: { color: '#F5A524', title: 'توثيق المالك' },
      admin: { color: '#7C5CFF', title: 'توثيق الأدمن' },
      verified: { color: '#1FAF6D', title: 'حساب موثّق' },
    }[verificationBadge];
    if (!config) return '';
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" title="${config.title}" style="display:inline-block; vertical-align:-2px; margin-inline-start:3px;">
      <path d="M12 2l2.4 1.6 2.8-.4 1.1 2.6 2.6 1.1-.4 2.8L22 12l-1.6 2.4.4 2.8-2.6 1.1-1.1 2.6-2.8-.4L12 22l-2.4-1.6-2.8.4-1.1-2.6-2.6-1.1.4-2.8L2 12l1.6-2.4-.4-2.8 2.6-1.1 1.1-2.6 2.8.4L12 2Z" fill="${config.color}"/>
      <path d="M8.5 12.5l2.3 2.3 4.7-4.8" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  return {
    qs, qsa, debounce,
    isValidIraqiPhone, isValidZainCashPhone, isValidEmail, isValidName,
    showToast, formatSlon, slonToIqd, setLoading, badgeHtml,
  };
})();
