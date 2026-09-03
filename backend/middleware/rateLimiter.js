/**
 * Vilue — rate limiting middleware
 * General request-level throttling (separate from the OTP-specific
 * 5-per-15-min rule enforced inside otp.service.js).
 */

const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.', code: 'RATE_LIMITED' },
});

const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // hard ceiling at the HTTP layer; otp.service enforces the real 5-per-user rule
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many verification requests.', code: 'RATE_LIMITED' },
});

module.exports = { authLimiter, otpRequestLimiter };
