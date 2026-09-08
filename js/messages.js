/**
 * Vilue — messages module (frontend)
 * Polling-based chat — no WebSockets. The chat page refreshes the
 * conversation on an interval rather than receiving instant push updates.
 */

window.Vilue_Messages = (() => {
  async function getConversation(friendId) {
    return Vilue_Api.request(`/messages/${friendId}`, { headers: Vilue_Auth.authHeader() });
  }

  async function sendText(friendId, content) {
    return Vilue_Api.request(`/messages/${friendId}`, {
      method: 'POST', headers: Vilue_Auth.authHeader(), body: { content },
    });
  }

  async function sendGift(friendId, giftType, quantity) {
    return Vilue_Api.request(`/messages/${friendId}/gift`, {
      method: 'POST', headers: Vilue_Auth.authHeader(), body: { giftType, quantity },
    });
  }

  async function getGiftCatalog() {
    return Vilue_Api.request('/messages/gift-catalog', { headers: Vilue_Auth.authHeader() });
  }

  return { getConversation, sendText, sendGift, getGiftCatalog };
})();
