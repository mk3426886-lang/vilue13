/**
 * Vilue — API service layer
 *
 * This module is the ONLY place that talks to the backend. Every other
 * module (auth.js, wallet.js, ...) calls through Vilue_Api — never
 * fetch() directly.
 *
 * This app runs against the real backend only — there is no mock/demo
 * mode. /backend must be running (npm run dev) with .env fully
 * configured (Supabase + Gmail) for any page that touches an account
 * or wallet to work.
 */

window.Vilue_API_CONFIG = {
  BASE_URL: 'https://vilue.koyeb.app/api/v1',
};

window.Vilue_Api = (() => {
  async function request(path, { method = 'GET', body, headers = {} } = {}) {
    let res;
    try {
      res = await fetch(`${Vilue_API_CONFIG.BASE_URL}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (networkErr) {
      const err = new Error(
        'Cannot reach the Vilue server. Make sure the backend is running (cd backend && npm run dev).'
      );
      err.code = 'BACKEND_UNREACHABLE';
      throw err;
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 && (data.code === 'SESSION_INVALIDATED' || data.code === 'INVALID_TOKEN')) {
        handleSessionInvalidated();
      }
      const err = new Error(data.message || 'Request failed');
      err.status = res.status;
      Object.assign(err, data); // carries code, userId, retryAfterSeconds, etc.
      throw err;
    }
    return data;
  }

  // Single-device enforcement: if the backend says this session was
  // replaced (logged in elsewhere) or the token is otherwise invalid,
  // clear the local session and send the user back to login.
  function handleSessionInvalidated() {
    try {
      localStorage.removeItem('vilue_session_token');
      localStorage.removeItem('vilue_session_user');
    } catch (e) { /* ignore */ }

    const path = window.location.pathname;
    let loginUrl = 'login.html';
    if (path.includes('/admin/')) loginUrl = '../../pages/login.html';
    else if (!path.includes('/pages/')) loginUrl = 'pages/login.html';

    if (!window.location.href.includes('login.html')) {
      window.location.href = `${loginUrl}?reason=session_replaced`;
    }
  }

  return { request };
})();
