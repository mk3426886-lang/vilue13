/**
 * Vilue — users controller
 * Returns the authenticated user's own profile, read from Supabase.
 */

const usersRepo = require('../database/users.repo');
const { uploadAvatarImage } = require('../services/storage.service');

function toPublicUser(user) {
  return {
    id: user.id,
    userId: user.display_user_id,
    name: user.name,
    email: user.email,
    governorate: user.governorate,
    language: user.language,
    verified: user.is_verified,
    isAdmin: !!user.is_admin,
    isOwner: !!user.is_owner,
    verificationBadge: user.verification_badge || null,
    twoFaEnabled: !!user.two_fa_enabled,
    allowFriendRequests: user.allow_friend_requests !== false,
    avatarUrl: user.avatar_url || null,
  };
}

async function getMe(req, res) {
  try {
    const user = await usersRepo.findById(req.userId);
    if (!user) return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'User not found' });
    const referralCount = await usersRepo.getReferralCount(user.id);
    return res.status(200).json({ user: { ...toPublicUser(user), referralCount } });
  } catch (err) {
    return res.status(500).json({ code: 'FETCH_FAILED', message: err.message });
  }
}

async function updateLanguage(req, res) {
  try {
    const { lang } = req.body;
    if (!['ar', 'en'].includes(lang)) {
      return res.status(400).json({ code: 'INVALID_LANG', message: 'lang must be ar or en' });
    }
    await usersRepo.updateLanguage(req.userId, lang);
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ code: 'UPDATE_FAILED', message: err.message });
  }
}

async function updateName(req, res) {
  try {
    const { name } = req.body;
    const trimmed = (name || '').trim();
    if (trimmed.length < 2 || trimmed.length > 60) {
      return res.status(400).json({ code: 'INVALID_NAME', message: 'Name must be 2-60 characters' });
    }
    await usersRepo.updateName(req.userId, trimmed);
    return res.status(200).json({ success: true, name: trimmed });
  } catch (err) {
    return res.status(500).json({ code: 'UPDATE_FAILED', message: err.message });
  }
}

async function toggleTwoFactor(req, res) {
  try {
    const { enabled } = req.body;
    await usersRepo.setTwoFactorEnabled(req.userId, !!enabled);
    return res.status(200).json({ twoFaEnabled: !!enabled });
  } catch (err) {
    return res.status(500).json({ code: 'UPDATE_FAILED', message: err.message });
  }
}

async function toggleFriendRequests(req, res) {
  try {
    const { enabled } = req.body;
    await usersRepo.setAllowFriendRequests(req.userId, !!enabled);
    return res.status(200).json({ allowFriendRequests: !!enabled });
  } catch (err) {
    return res.status(500).json({ code: 'UPDATE_FAILED', message: err.message });
  }
}

async function updateAvatar(req, res) {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) return res.status(400).json({ code: 'MISSING_IMAGE', message: 'imageBase64 is required' });
    const url = await uploadAvatarImage(req.userId, imageBase64);
    await usersRepo.updateAvatar(req.userId, url);
    return res.status(200).json({ avatarUrl: url });
  } catch (err) {
    return res.status(500).json({ code: 'UPLOAD_FAILED', message: err.message });
  }
}

module.exports = { getMe, updateLanguage, updateName, toggleTwoFactor, toggleFriendRequests, updateAvatar };
