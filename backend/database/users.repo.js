/**
 * Vilue — users repository
 * All `users` table access goes through here — controllers/services
 * never call Supabase directly for user data.
 *
 * Identity model: no username. Every user has a 12-digit random public
 * ID (display_user_id) used for login, transfers, and display.
 */

const { getSupabase } = require('./supabaseClient');
const { v4: uuidv4 } = require('uuid');

function generateDisplayUserId() {
  // 12 digits, first digit non-zero so it always reads as a full 12-digit number.
  const first = String(Math.floor(1 + Math.random() * 9));
  let rest = '';
  for (let i = 0; i < 11; i += 1) rest += Math.floor(Math.random() * 10);
  return first + rest;
}

async function findByEmailOrDisplayId(email, displayUserId) {
  const supabase = getSupabase();
  const orParts = [`email.eq.${email}`];
  if (displayUserId) orParts.push(`display_user_id.eq.${displayUserId}`);
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .or(orParts.join(','))
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function findByDisplayId(displayUserId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('users').select('*').eq('display_user_id', displayUserId).maybeSingle();
  if (error) throw error;
  return data;
}

async function findById(id) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

async function findByEmail(email) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
  if (error) throw error;
  return data;
}

async function countUsers() {
  const supabase = getSupabase();
  const { count, error } = await supabase.from('users').select('id', { count: 'exact', head: true });
  if (error) throw error;
  return count || 0;
}

async function createUser({ name, email, passwordHash, country, governorate, language, referredBy }) {
  const supabase = getSupabase();

  // Retry on the (very rare) collision of the random 12-digit ID.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const displayUserId = generateDisplayUserId();
    const { data, error } = await supabase
      .from('users')
      .insert({
        id: uuidv4(),
        display_user_id: displayUserId,
        name,
        email,
        password_hash: passwordHash,
        country,
        governorate,
        language,
        referred_by: referredBy || null,
      })
      .select()
      .single();

    if (!error) return data;
    if (error.code !== '23505') throw error; // 23505 = unique_violation, retry only for that
  }

  throw new Error('Failed to allocate a unique user ID, please try again');
}

async function getReferralCount(userId) {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('referred_by', userId);
  if (error) throw error;
  return count || 0;
}

async function markVerified(userId) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('users')
    .update({ is_verified: true, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}

async function updateLanguage(userId, language) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('users')
    .update({ language, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}

async function updateName(userId, name) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('users')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}

async function updatePasswordHash(userId, passwordHash) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('users')
    .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}

async function setTwoFactorEnabled(userId, enabled) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('users')
    .update({ two_fa_enabled: enabled, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}

async function setAllowFriendRequests(userId, enabled) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('users')
    .update({ allow_friend_requests: enabled, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}

// ---- Single-device session enforcement ----

async function getSessionState(userId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('users')
    .select('active_session_id, active_device_id, last_device_switch_at, is_suspended')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function setSession(userId, { sessionId, deviceId, isSwitch }) {
  const supabase = getSupabase();
  const update = {
    active_session_id: sessionId,
    active_device_id: deviceId,
    updated_at: new Date().toISOString(),
  };
  if (isSwitch) update.last_device_switch_at = new Date().toISOString();

  const { error } = await supabase.from('users').update(update).eq('id', userId);
  if (error) throw error;
}

async function clearSession(userId) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('users')
    .update({ active_session_id: null, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}

// ---- Brute-force lockout ----
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

async function registerFailedLogin(userId) {
  const supabase = getSupabase();
  const { data: user } = await supabase.from('users').select('failed_login_attempts').eq('id', userId).maybeSingle();
  const attempts = (user ? user.failed_login_attempts : 0) + 1;
  const update = { failed_login_attempts: attempts, updated_at: new Date().toISOString() };
  if (attempts >= MAX_FAILED_ATTEMPTS) {
    update.locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
  }
  await supabase.from('users').update(update).eq('id', userId);
}

async function clearFailedLogins(userId) {
  const supabase = getSupabase();
  await supabase.from('users').update({ failed_login_attempts: 0, locked_until: null }).eq('id', userId);
}

// ---- Admin: ban / delete / edit ID ----
async function adminBanUser(userId, { reason, durationHours }) {
  const supabase = getSupabase();
  const bannedUntil = durationHours ? new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString() : null;
  const { error } = await supabase
    .from('users')
    .update({
      is_suspended: true, ban_reason: reason || null, banned_until: bannedUntil,
      active_session_id: null, updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
  if (error) throw error;
}

async function adminUnbanUser(userId) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('users')
    .update({ is_suspended: false, ban_reason: null, banned_until: null, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}

async function adminDeleteUser(userId) {
  const supabase = getSupabase();
  const anonymizedEmail = `deleted_${userId.slice(0, 8)}@deleted.vilue`;
  const { error } = await supabase
    .from('users')
    .update({
      email: anonymizedEmail, name: '(حساب محذوف)', is_deleted: true, is_suspended: true,
      active_session_id: null, updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
  if (error) throw error;
}

async function adminSetDisplayId(userId, newDisplayId) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('users')
    .update({ display_user_id: newDisplayId, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}

async function updateAvatar(userId, avatarUrl) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('users')
    .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}

// ---- Telegram linking ----
async function setLinkCode(userId, code, expiresAt) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('users')
    .update({ telegram_link_code: code, telegram_link_code_expires_at: expiresAt })
    .eq('id', userId);
  if (error) throw error;
}

async function findByLinkCode(code) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('users').select('*').eq('telegram_link_code', code).maybeSingle();
  if (error) throw error;
  return data;
}

async function completeTelegramLink(userId, telegramUserId, telegramUsername) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('users')
    .update({
      telegram_user_id: telegramUserId, telegram_username: telegramUsername || null,
      telegram_link_code: null, telegram_link_code_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
  if (error) throw error;
}

async function findByTelegramId(telegramUserId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('users').select('*').eq('telegram_user_id', telegramUserId).maybeSingle();
  if (error) throw error;
  return data;
}

module.exports = {
  findByEmailOrDisplayId, findByDisplayId, findById, findByEmail, createUser, countUsers, getReferralCount,
  markVerified, updateLanguage, updateName, updatePasswordHash, setTwoFactorEnabled, setAllowFriendRequests,
  getSessionState, setSession, clearSession,
  registerFailedLogin, clearFailedLogins,
  adminBanUser, adminUnbanUser, adminDeleteUser, adminSetDisplayId, updateAvatar,
  setLinkCode, findByLinkCode, completeTelegramLink, findByTelegramId,
};
