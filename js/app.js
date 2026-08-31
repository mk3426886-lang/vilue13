/**
 * Vilue — app bootstrap
 * Runs on every page. Initializes translations/direction, wires the
 * language switch control, and restores an existing session where relevant.
 */

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
