/**
 * Vilue — i18n engine
 * Loads /locales/{lang}.json and applies translations to any element
 * carrying a data-i18n attribute. No text should be hard-coded in HTML/JS.
 *
 * Usage in HTML:
 *   <span data-i18n="welcome.tagline"></span>
 *   <input data-i18n-placeholder="auth.namePlaceholder">
 */

const Vilue_I18n = (() => {
  const SUPPORTED = ['ar', 'en'];
  const DEFAULT_LANG = 'ar';
  const STORAGE_KEY = 'vilue_lang';

  let currentLang = DEFAULT_LANG;
  let dict = {};

  function resolvePath(obj, path) {
    return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined) ? acc[key] : undefined, obj);
  }

  function getStoredLang() {
    try {
      const fromAccount = window.Vilue_Auth ? Vilue_Auth.getAccountLanguage() : null;
      if (fromAccount && SUPPORTED.includes(fromAccount)) return fromAccount;
      const local = localStorage.getItem(STORAGE_KEY);
      if (local && SUPPORTED.includes(local)) return local;
    } catch (e) { /* localStorage unavailable */ }
    return DEFAULT_LANG;
  }

  async function loadDictionary(lang) {
    const res = await fetch(`/locales/${lang}.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Failed to load locale: ${lang}`);
    return res.json();
  }

  function applyDirection(lang) {
    const meta = dict.meta || {};
    const dir = meta.dir || (lang === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', dir);
  }

  function applyTranslations(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      const value = resolvePath(dict, el.getAttribute('data-i18n'));
      if (typeof value === 'string') el.textContent = value;
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const value = resolvePath(dict, el.getAttribute('data-i18n-placeholder'));
      if (typeof value === 'string') el.setAttribute('placeholder', value);
    });
    root.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
      const value = resolvePath(dict, el.getAttribute('data-i18n-aria-label'));
      if (typeof value === 'string') el.setAttribute('aria-label', value);
    });
    document.querySelectorAll('[data-lang-option]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-lang-option') === currentLang);
    });
  }

  function t(path, vars) {
    let value = resolvePath(dict, path);
    if (typeof value !== 'string') return path;
    if (vars) {
      Object.keys(vars).forEach((k) => {
        value = value.replace(`{${k}}`, vars[k]);
      });
    }
    return value;
  }

  async function setLanguage(lang, { persist = true } = {}) {
    if (!SUPPORTED.includes(lang)) lang = DEFAULT_LANG;
    dict = await loadDictionary(lang);
    currentLang = lang;
    applyDirection(lang);
    applyTranslations();

    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* ignore */ }
      if (window.Vilue_Auth && Vilue_Auth.isAuthenticated()) {
        Vilue_Auth.persistLanguageToAccount(lang);
      }
    }

    document.dispatchEvent(new CustomEvent('vilue:language-changed', { detail: { lang } }));
  }

  async function init() {
    const lang = getStoredLang();
    await setLanguage(lang, { persist: false });
  }

  function getLang() {
    return currentLang;
  }

  return { init, setLanguage, t, getLang, applyTranslations, SUPPORTED };
})();
