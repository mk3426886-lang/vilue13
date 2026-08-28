const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const usersController = require('../controllers/users.controller');

const router = express.Router();

router.get('/me', requireAuth, usersController.getMe);
router.patch('/me/language', requireAuth, usersController.updateLanguage);
router.patch('/me/name', requireAuth, usersController.updateName);
router.patch('/me/2fa', requireAuth, usersController.toggleTwoFactor);
router.patch('/me/friend-requests', requireAuth, usersController.toggleFriendRequests);
router.post('/me/avatar', requireAuth, usersController.updateAvatar);

module.exports = router;
