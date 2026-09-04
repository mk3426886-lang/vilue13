/**
 * Vilue — session service
 *
 * Enforces "one active login at a time": each login/verify call must
 * supply a deviceId (a random ID the frontend generates once and
 * persists in localStorage — see js/app.js). Logging in from a new
 * device immediately invalidates the previous device's session (its
 * JWT stops passing requireAuth) and switches to the new one — no
 * cooldown or waiting period.
 */

const { v4: uuidv4 } = require('uuid');
const usersRepo = require('../database/users.repo');

/**
 * @returns {Promise<string>} the new session id (JWT jti) to embed in the token
 */
async function establishSession(userId, deviceId) {
  const state = await usersRepo.getSessionState(userId);
  const newSessionId = uuidv4();
  const isFirstEver = !state.active_device_id;

  await usersRepo.setSession(userId, { sessionId: newSessionId, deviceId, isSwitch: isFirstEver });
  return newSessionId;
}

module.exports = { establishSession };