/**
 * Vilue — tasks module (frontend)
 * "المهام" — Telegram channel-join campaigns.
 */

const Vilue_Tasks = (() => {
  async function create({ channelUsername, rewardPerJoin, targetJoins }) {
    return Vilue_Api.request('/tasks', {
      method: 'POST', headers: Vilue_Auth.authHeader(), body: { channelUsername, rewardPerJoin, targetJoins },
    });
  }

  async function mine() {
    return Vilue_Api.request('/tasks/mine', { headers: Vilue_Auth.authHeader() });
  }

  async function browse() {
    return Vilue_Api.request('/tasks/browse', { headers: Vilue_Auth.authHeader() });
  }

  async function cancel(taskId) {
    return Vilue_Api.request(`/tasks/${taskId}/cancel`, { method: 'POST', headers: Vilue_Auth.authHeader() });
  }

  async function generateLinkCode() {
    return Vilue_Api.request('/telegram/link/generate-code', { method: 'POST', headers: Vilue_Auth.authHeader() });
  }

  async function linkStatus() {
    return Vilue_Api.request('/telegram/link/status', { headers: Vilue_Auth.authHeader() });
  }

  return { create, mine, browse, cancel, generateLinkCode, linkStatus };
})();
