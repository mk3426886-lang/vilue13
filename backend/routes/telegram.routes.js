const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const telegramController = require('../controllers/telegram.controller');

const router = express.Router();

router.post('/link/generate-code', requireAuth, telegramController.generateLinkCode);
router.get('/link/status', requireAuth, telegramController.linkStatus);

// Public — Telegram calls this directly. Protected by the secret path
// segment instead of a login, since Telegram can't send auth headers.
router.post('/webhook/:secret', (req, res, next) => {
  if (req.params.secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return res.status(404).end();
  }
  next();
}, telegramController.webhook);

module.exports = router;
