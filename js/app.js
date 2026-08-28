/**
 * Vilue — app bootstrap
 * Runs on every page. Initializes translations/direction, wires the
 * language switch control, and restores an existing session where relevant.
 */

document.addEventListener('DOMContentLoaded', async () => {
  await Vilue_I18n.init();

  Vilue_Utils.qsa('[data-lang-option]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const lang = btn.getAttribute('data-lang-option');
      if (lang === Vilue_I18n.getLang()) return;
      await Vilue_I18n.setLanguage(lang);
    });
  });

  document.dispatchEvent(new CustomEvent('vilue:app-ready'));
});
