/**
 * Vilue — admin module (frontend)
 * Every call requires the logged-in user's JWT to carry isAdmin — the
 * backend re-checks this on every request regardless of what the UI shows.
 */

window.Vilue_Admin = (() => {
  async function listUsers() {
    return Vilue_Api.request('/admin/users', { headers: Vilue_Auth.authHeader() });
  }

  async function setUserSuspended(userId, suspended) {
    return Vilue_Api.request(`/admin/users/${userId}/suspend`, {
      method: 'PATCH', headers: Vilue_Auth.authHeader(), body: { suspended },
    });
  }

  async function listPendingDeposits() {
    return Vilue_Api.request('/admin/deposits/pending', { headers: Vilue_Auth.authHeader() });
  }

  async function listPendingWithdrawals() {
    return Vilue_Api.request('/admin/withdrawals/pending', { headers: Vilue_Auth.authHeader() });
  }

  async function reviewDeposit(transactionId, action, note) {
    return Vilue_Api.request(`/admin/deposits/${transactionId}/review`, {
      method: 'POST', headers: Vilue_Auth.authHeader(), body: { action, note },
    });
  }

  async function reviewWithdrawal(transactionId, action, note) {
    return Vilue_Api.request(`/admin/withdrawals/${transactionId}/review`, {
      method: 'POST', headers: Vilue_Auth.authHeader(), body: { action, note },
    });
  }

  async function getSettings() {
    return Vilue_Api.request('/admin/settings', { headers: Vilue_Auth.authHeader() });
  }

  async function updateSettings(fields) {
    return Vilue_Api.request('/admin/settings', {
      method: 'PATCH', headers: Vilue_Auth.authHeader(), body: fields,
    });
  }

  async function getPlatformWallet() {
    return Vilue_Api.request('/admin/platform-wallet', { headers: Vilue_Auth.authHeader() });
  }

  async function setVerificationBadge(userId, verified) {
    return Vilue_Api.request(`/admin/users/${userId}/verify`, {
      method: 'PATCH', headers: Vilue_Auth.authHeader(), body: { verified },
    });
  }

  async function promoteToAdmin(userId) {
    return Vilue_Api.request(`/admin/users/${userId}/promote-admin`, {
      method: 'POST', headers: Vilue_Auth.authHeader(),
    });
  }

  async function demoteAdmin(userId) {
    return Vilue_Api.request(`/admin/users/${userId}/demote-admin`, {
      method: 'POST', headers: Vilue_Auth.authHeader(),
    });
  }

  return {
    listUsers, setUserSuspended, listPendingDeposits, listPendingWithdrawals, reviewDeposit, reviewWithdrawal,
    getSettings, updateSettings, getPlatformWallet, setVerificationBadge, promoteToAdmin, demoteAdmin,
  };
})();
