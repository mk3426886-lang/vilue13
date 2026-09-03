/**
 * Vilue — auth module
 * Talks to the real backend only. A JWT is stored on verify/login and
 * sent as a Bearer token on every authenticated request.
 *
 * MVP scope: email + password only. Phone/WhatsApp verification is
 * deferred — see backend/services/whatsapp.service.js for that path
 * once it's enabled.
 */

const Vilue_Auth = (() => {
  const SESSION_TOKEN_KEY = 'vilue_session_token';
  const SESSION_USER_KEY = 'vilue_session_user';
  const DEVICE_ID_KEY = 'vilue_device_id';
  let cachedUser = null;

  // A random ID persisted per browser/install, representing "this device"
  // for the single-device-login enforcement. Generated once, reused forever.
  function getDeviceId() {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  }

  function isAuthenticated() {
    return !!localStorage.getItem(SESSION_TOKEN_KEY);
  }

  function getAccountLanguage() {
    return cachedUser ? cachedUser.language : null;
  }

  function authHeader() {
    const token = localStorage.getItem(SESSION_TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function persistLanguageToAccount(lang) {
    await Vilue_Api.request('/users/me/language', {
      method: 'PATCH',
      body: { lang },
      headers: authHeader(),
    });
    if (cachedUser) cachedUser.language = lang;
  }

  function saveSession(token, user) {
    localStorage.setItem(SESSION_TOKEN_KEY, token);
    localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
    cachedUser = user;
  }

  async function loadSession() {
    if (!isAuthenticated()) return null;
    try {
      const result = await Vilue_Api.request('/users/me', { headers: authHeader() });
      cachedUser = result.user;
      localStorage.setItem(SESSION_USER_KEY, JSON.stringify(result.user));
      return cachedUser;
    } catch (err) {
      if (err.status === 401) {
        logout();
        return null;
      }
      // Backend unreachable etc. — fall back to last-known cached user so the UI can still render.
      const cached = localStorage.getItem(SESSION_USER_KEY);
      cachedUser = cached ? JSON.parse(cached) : null;
      return cachedUser;
    }
  }

  async function register(payload) {
    // payload: { name, email, password, country, governorate, lang }
    return Vilue_Api.request('/auth/register', { method: 'POST', body: payload });
  }

  async function verify(userId, code) {
    const result = await Vilue_Api.request('/auth/verify', {
      method: 'POST', body: { userId, code, deviceId: getDeviceId() },
    });
    saveSession(result.token, result.user);
    return result;
  }

  async function resendCode(userId, lang) {
    return Vilue_Api.request('/auth/resend-code', { method: 'POST', body: { userId, lang } });
  }

  async function login(identifier, password) {
    const result = await Vilue_Api.request('/auth/login', {
      method: 'POST', body: { identifier, password, deviceId: getDeviceId() },
    });
    saveSession(result.token, result.user);
    return result;
  }

  function logout() {
    // Best-effort server-side session clear — don't block the UI on it.
    if (isAuthenticated()) {
      Vilue_Api.request('/auth/logout', { method: 'POST', headers: authHeader() }).catch(() => {});
    }
    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem(SESSION_USER_KEY);
    cachedUser = null;
  }

  return {
    isAuthenticated, getAccountLanguage, persistLanguageToAccount,
    loadSession, register, verify, resendCode, login, logout, authHeader, getDeviceId,
  };
})();
