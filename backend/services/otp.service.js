/**
 * Vilue — OTP service
 *
 * Implements the verification rules from the spec:
 *   - 6-digit codes
 *   - max 5 codes requested per user per 15 minutes
 *   - resend cooldown between sends
 *   - codes expire after OTP_TTL_MINUTES
 *   - codes are never stored in plain text (bcrypt hash only)
 *   - brute-force protection on verify attempts
 *
 * Backed by Supabase (`verification_codes` / `verification_code_sends`
 * tables via otp.repo.js) — state now survives a server restart.
 */

const bcrypt = require('bcrypt');
const notificationService = require('./notification.service');
const otpRepo = require('../database/otp.repo');

const OTP_LENGTH = Number(process.env.OTP_LENGTH || 6);
const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 10);
const OTP_MAX_PER_15_MIN = Number(process.env.OTP_MAX_PER_15_MIN || 5);
const OTP_RESEND_COOLDOWN_SECONDS = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 30);
const MAX_VERIFY_ATTEMPTS = 5;

function generateCode() {
  const min = 10 ** (OTP_LENGTH - 1);
  const max = 10 ** OTP_LENGTH - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
}

async function requestOtp({ userId, contact, contactType, lang = 'ar' }) {
  const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const recentCount = await otpRepo.countRecentSends(userId, windowStart);

  if (recentCount >= OTP_MAX_PER_15_MIN) {
    const err = new Error('otp_rate_limited');
    err.code = 'OTP_RATE_LIMITED';
    throw err;
  }

  const lastSent = await otpRepo.getLastSendTime(userId);
  if (lastSent && Date.now() - lastSent.getTime() < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
    const err = new Error('otp_cooldown');
    err.code = 'OTP_COOLDOWN';
    err.retryAfterSeconds = Math.ceil(
      (OTP_RESEND_COOLDOWN_SECONDS * 1000 - (Date.now() - lastSent.getTime())) / 1000
    );
    throw err;
  }

  const code = generateCode();
  const hash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await otpRepo.upsertCode(userId, hash, expiresAt);
  await otpRepo.recordSend(userId);

  await notificationService.sendOtp({ contact, contactType, code, lang });

  return { sent: true };
}

async function verifyOtp({ userId, code }) {
  const record = await otpRepo.getCode(userId);

  if (!record) {
    const err = new Error('otp_not_found');
    err.code = 'OTP_NOT_FOUND';
    throw err;
  }

  if (new Date() > new Date(record.expires_at)) {
    await otpRepo.deleteCode(userId);
    const err = new Error('otp_expired');
    err.code = 'OTP_EXPIRED';
    throw err;
  }

  if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
    await otpRepo.deleteCode(userId);
    const err = new Error('otp_too_many_attempts');
    err.code = 'OTP_TOO_MANY_ATTEMPTS';
    throw err;
  }

  const isValid = await bcrypt.compare(code, record.code_hash);

  if (!isValid) {
    await otpRepo.incrementAttempts(userId, record.attempts + 1);
    const err = new Error('otp_invalid');
    err.code = 'OTP_INVALID';
    throw err;
  }

  await otpRepo.deleteCode(userId);
  return { verified: true };
}

module.exports = { requestOtp, verifyOtp };
