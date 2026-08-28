const express = require('express');
const { authLimiter, otpRequestLimiter } = require('../middleware/rateLimiter');
const { requireAuth } = require('../middleware/auth.middleware');
const authController = require('../controllers/auth.controller');

const router = express.Router();

router.post('/register', authLimiter, authController.register);
router.post('/verify', authLimiter, authController.verify);
router.post('/resend-code', otpRequestLimiter, authController.resend);
router.post('/login', authLimiter, authController.login);
router.post('/logout', requireAuth, authController.logout);
router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.post('/reset-password', authLimiter, authController.resetPassword);

module.exports = router;
