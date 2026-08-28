/**
 * Vilue — session service
 *
 * Enforces "one active login at a time": each login/verify call must
 * supply a deviceId (a random ID the frontend generates once and
 * persists in localStorage — see js/app.js). Logging in from the same
 * deviceId is always allowed (it's just refreshing that device's
 * session). Logging in from a DIFFERENT deviceId immediately invalidates
 * the previous device's session (its JWT stops passing requireAuth),
 * but is only allowed once per DEVICE_SWITCH_COOLDOWN_HOURS — logging
 * in from yet another device within that window is blocked.
 */

const { v4: uuidv4 } = require('uuid');
const usersRepo = require('../database/users.repo');

const DEVICE_SWITCH_COOLDOWN_HOURS = 48;

/**
 * @returns {Promise<string>} the new session id (JWT jti) to embed in the token
 * @throws {Error} with .code = 'DEVICE_SWITCH_COOLDOWN' and .retryAt when blocked
 */
async function establishSession(userId, deviceId) {
  const state = await usersRepo.getSessionState(userId);
  const newSessionId = uuidv4();

  const isFirstEver = !state.active_device_id;
  const isSameDevice = state.active_device_id === deviceId;

  if (isFirstEver || isSameDevice) {
    await usersRepo.setSession(userId, { sessionId: newSessionId, deviceId, isSwitch: isFirstEver });
    return newSessionId;
  }

  // Different device — only allowed once per cooldown window.
  const lastSwitch = state.last_device_switch_at ? new Date(state.last_device_switch_at) : null;
  const cooldownMs = DEVICE_SWITCH_COOLDOWN_HOURS * 60 * 60 * 1000;

  if (lastSwitch && Date.now() - lastSwitch.getTime() < cooldownMs) {
    const err = new Error('device_switch_cooldown');
    err.code = 'DEVICE_SWITCH_COOLDOWN';
    err.retryAt = new Date(lastSwitch.getTime() + cooldownMs).toISOString();
    throw err;
  }

  await usersRepo.setSession(userId, { sessionId: newSessionId, deviceId, isSwitch: true });
  return newSessionId;
}

module.exports = { establishSession, DEVICE_SWITCH_COOLDOWN_HOURS };
