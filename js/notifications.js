/**
 * Vilue — notifications module (frontend)
 */

const Vilue_Notifications = (() => {
  async function list() {
    return Vilue_Api.request('/notifications', { headers: Vilue_Auth.authHeader() });
  }

  async function unreadCount() {
    return Vilue_Api.request('/notifications/unread-count', { headers: Vilue_Auth.authHeader() });
  }

  async function markRead(id) {
    return Vilue_Api.request(`/notifications/${id}/read`, { method: 'POST', headers: Vilue_Auth.authHeader() });
  }

  async function markAllRead() {
    return Vilue_Api.request('/notifications/mark-all-read', { method: 'POST', headers: Vilue_Auth.authHeader() });
  }

  async function adminSend({ userId, title, body }) {
    return Vilue_Api.request('/notifications/admin/send', {
      method: 'POST', headers: Vilue_Auth.authHeader(), body: { userId, title, body },
    });
  }

  return { list, unreadCount, markRead, markAllRead, adminSend };
})();
