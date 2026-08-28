const express = require('express');
const settingsRepo = require('../database/settings.repo');

const router = express.Router();

router.get('/public', async (req, res) => {
  try {
    const settings = await settingsRepo.getPublicSettings();
    return res.status(200).json({ settings });
  } catch (err) {
    return res.status(500).json({ code: 'FETCH_FAILED', message: err.message });
  }
});

module.exports = router;
