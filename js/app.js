/**
 * Vilue — app bootstrap
 * Runs on every page. Initializes translations/direction, wires the
 * language switch control, applies the saved dark/light theme, and
 * restores an existing session where relevant.
 */

// Dark mode — applied immediately when this script runs (not inside
// DOMContentLoaded) so the page repaints with the right theme as early
// as possible instead of flashing light-then-dark.
const THEME_KEY = 'vilue_theme';

window.Vilue_Theme = {
  get() {
    try { return localStorage.getItem(THEME_KEY) || 'light'; } catch (e) { return 'light'; }
  },
  set(theme) {
    const value = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', value);
    try { localStorage.setItem(THEME_KEY, value); } catch (e) { /* ignore */ }
  },
  toggle() {
    const next = window.Vilue_Theme.get() === 'dark' ? 'light' : 'dark';
    window.Vilue_Theme.set(next);
    return next;
  },
};

if (window.Vilue_Theme.get() === 'dark') {
  document.documentElement.setAttribute('data-theme', 'dark');
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await Vilue_I18n.init();
  } catch (e) {
    // Never let a translation/network hiccup stop the app from becoming
    // interactive — this used to mean every button on the page stayed
    // unresponsive until the user manually refreshed.
  }

  Vilue_Utils.qsa('[data-lang-option]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const lang = btn.getAttribute('data-lang-option');
      if (lang === Vilue_I18n.getLang()) return;
      try {
        await Vilue_I18n.setLanguage(lang);
      } catch (e) { /* ignore — setLanguage already falls back internally */ }
    });
  });

  document.dispatchEvent(new CustomEvent('vilue:app-ready'));
});
