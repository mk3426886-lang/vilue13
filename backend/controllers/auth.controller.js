/**
 * Vilue — auth controller
 *
 * Identity model: no username. Every account gets a random 12-digit
 * public ID at registration (see users.repo.js) used for login,
 * transfers, and display — nothing chosen by the user.
 *
 * MVP scope: registration/login is email-only. Phone number + WhatsApp
 * verification are deferred to a later stage.
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const otpService = require('../services/otp.service');
const sessionService = require('../services/session.service');
const usersRepo = require('../database/users.repo');
const walletsRepo = require('../database/wallets.repo');

function issueToken(user, sessionId) {
  return jwt.sign(
    { sub: user.id, jti: sessionId, displayUserId: user.display_user_id, isAdmin: !!user.is_admin, isOwner: !!user.is_owner },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

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

async function register(req, res) {
  try {
    const { name, email, password, country, governorate, lang, referralId } = req.body;

    if (!name || !email || !password || !governorate) {
      return res.status(400).json({ code: 'MISSING_FIELDS', message: 'Missing required fields' });
    }

    const existing = await usersRepo.findByEmail(email);
    if (existing) {
      return res.status(409).json({ code: 'DUPLICATE_ACCOUNT', message: 'Account already exists' });
    }

    // Referral ID is required — except for the very first account ever
    // created on a fresh install (there's nobody to refer them).
    let referredById = null;
    const totalUsers = await usersRepo.countUsers();
    if (totalUsers > 0) {
      if (!referralId || !/^\d{6,12}$/.test(referralId.trim())) {
        return res.status(400).json({ code: 'REFERRAL_REQUIRED', message: 'A valid referral ID is required' });
      }
      const referrer = await usersRepo.findByDisplayId(referralId.trim());
      if (!referrer) {
        return res.status(400).json({ code: 'REFERRAL_NOT_FOUND', message: 'No user with that referral ID' });
      }
      referredById = referrer.id;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await usersRepo.createUser({
      name,
      email,
      passwordHash,
      country: country || 'IQ',
      governorate,
      language: lang || 'ar',
      referredBy: referredById,
    });

    await walletsRepo.createWallet(user.id);

    await otpService.requestOtp({
      userId: user.id,
      contact: email,
      contactType: 'email',
      lang: lang || 'ar',
    });

    return res.status(201).json({ userId: user.id, message: 'verification_code_sent' });
  } catch (err) {
    console.error('[register] failed:', err.message);
    return res.status(500).json({ code: 'REGISTER_FAILED', message: err.message });
  }
}

async function verify(req, res) {
  try {
    const { userId, code, deviceId } = req.body;
    if (!deviceId) {
      return res.status(400).json({ code: 'MISSING_DEVICE_ID', message: 'deviceId is required' });
    }

    await otpService.verifyOtp({ userId, code });
    await usersRepo.markVerified(userId);

    const user = await usersRepo.findById(userId);
    const sessionId = await sessionService.establishSession(user.id, deviceId);
    const token = issueToken(user, sessionId);

    return res.status(200).json({ verified: true, token, user: toPublicUser(user) });
  } catch (err) {
    if (err.code === 'DEVICE_SWITCH_COOLDOWN') {
      return res.status(403).json({ code: err.code, message: err.message, retryAt: err.retryAt });
    }
    const status = err.code === 'OTP_INVALID' || err.code === 'OTP_EXPIRED' ? 400 : 429;
    return res.status(status).json({ code: err.code || 'VERIFY_FAILED', message: err.message });
  }
}

async function resend(req, res) {
  try {
    const { userId, lang } = req.body;
    const user = await usersRepo.findById(userId);
    if (!user) return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'User not found' });

    await otpService.requestOtp({
      userId: user.id,
      contact: user.email,
      contactType: 'email',
      lang: lang || user.language || 'ar',
    });

    return res.status(200).json({ sent: true });
  } catch (err) {
    const status = err.code === 'OTP_RATE_LIMITED' || err.code === 'OTP_COOLDOWN' ? 429 : 500;
    return res.status(status).json({
      code: err.code || 'RESEND_FAILED',
      message: err.message,
      retryAfterSeconds: err.retryAfterSeconds,
    });
  }
}

async function login(req, res) {
  try {
    const { identifier, password, deviceId } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ code: 'MISSING_FIELDS', message: 'Missing credentials' });
    }
    if (!deviceId) {
      return res.status(400).json({ code: 'MISSING_DEVICE_ID', message: 'deviceId is required' });
    }

    const isNumericId = /^\d{6,12}$/.test(identifier.trim());
    const user = isNumericId
      ? await usersRepo.findByDisplayId(identifier.trim())
      : await usersRepo.findByEmail(identifier.trim());

    if (!user) {
      return res.status(401).json({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
    }

    // Brute-force lockout — checked before password compare so a locked
    // account can't be used to keep guessing.
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(429).json({
        code: 'ACCOUNT_LOCKED',
        message: 'Too many failed attempts — try again later',
        retryAt: user.locked_until,
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      await usersRepo.registerFailedLogin(user.id);
      return res.status(401).json({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
    }
    await usersRepo.clearFailedLogins(user.id);

    if (!user.is_verified) {
      return res.status(403).json({ code: 'ACCOUNT_NOT_VERIFIED', message: 'Account not verified', userId: user.id });
    }

    if (user.is_deleted) {
      return res.status(403).json({ code: 'ACCOUNT_DELETED', message: 'This account no longer exists' });
    }

    if (user.is_suspended) {
      // Auto-lift an expired temporary ban.
      if (user.banned_until && new Date(user.banned_until) <= new Date()) {
        await usersRepo.adminUnbanUser(user.id);
      } else {
        return res.status(403).json({
          code: 'ACCOUNT_SUSPENDED',
          message: 'Account suspended',
          reason: user.ban_reason || null,
          bannedUntil: user.banned_until || null,
        });
      }
    }

    const sessionId = await sessionService.establishSession(user.id, deviceId);
    const token = issueToken(user, sessionId);
    return res.status(200).json({ token, user: toPublicUser(user) });
  } catch (err) {
    if (err.code === 'DEVICE_SWITCH_COOLDOWN') {
      return res.status(403).json({ code: err.code, message: err.message, retryAt: err.retryAt });
    }
    return res.status(500).json({ code: 'LOGIN_FAILED', message: err.message });
  }
}

async function logout(req, res) {
  try {
    await usersRepo.clearSession(req.userId);
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ code: 'LOGOUT_FAILED', message: err.message });
  }
}

// ---- Forgot password ----
// Always responds the same way whether or not the email exists, to
// avoid leaking which emails are registered.
async function forgotPassword(req, res) {
  try {
    const { email, lang } = req.body;
    if (!email) return res.status(400).json({ code: 'MISSING_EMAIL', message: 'Email is required' });

    const user = await usersRepo.findByEmail(email.trim());
    if (user) {
      await otpService.requestOtp({
        userId: user.id, contact: user.email, contactType: 'email', lang: lang || user.language || 'ar',
      }).catch(() => {}); // swallow rate-limit errors here too — response stays generic
    }
    return res.status(200).json({ sent: true });
  } catch (err) {
    return res.status(200).json({ sent: true }); // never reveal internal errors either
  }
}

async function resetPassword(req, res) {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ code: 'MISSING_FIELDS', message: 'Missing fields' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters' });
    }

    const user = await usersRepo.findByEmail(email.trim());
    if (!user) {
      return res.status(400).json({ code: 'OTP_INVALID', message: 'Invalid code' }); // generic, no enumeration
    }

    await otpService.verifyOtp({ userId: user.id, code });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await usersRepo.updatePasswordHash(user.id, passwordHash);

    return res.status(200).json({ success: true });
  } catch (err) {
    const status = err.code === 'OTP_INVALID' || err.code === 'OTP_EXPIRED' ? 400 : 500;
    return res.status(status).json({ code: err.code || 'RESET_FAILED', message: err.message });
  }
}

module.exports = { register, verify, resend, login, logout, forgotPassword, resetPassword };