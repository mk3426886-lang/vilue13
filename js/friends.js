/**
 * Vilue — friends module (frontend)
 */

window.Vilue_Friends = (() => {
  async function sendRequest(receiverId) {
    return Vilue_Api.request('/friends/requests', {
      method: 'POST', headers: Vilue_Auth.authHeader(), body: { receiverId },
    });
  }

  async function listIncoming() {
    return Vilue_Api.request('/friends/requests/incoming', { headers: Vilue_Auth.authHeader() });
  }

  async function listOutgoing() {
    return Vilue_Api.request('/friends/requests/outgoing', { headers: Vilue_Auth.authHeader() });
  }

  async function listFriends() {
    return Vilue_Api.request('/friends', { headers: Vilue_Auth.authHeader() });
  }

  async function respond(requestId, action) {
    return Vilue_Api.request(`/friends/requests/${requestId}/respond`, {
      method: 'POST', headers: Vilue_Auth.authHeader(), body: { action },
    });
  }

  async function removeFriend(friendId) {
    return Vilue_Api.request(`/friends/${friendId}`, { method: 'DELETE', headers: Vilue_Auth.authHeader() });
  }

  return { sendRequest, listIncoming, listOutgoing, listFriends, respond, removeFriend };
})();
