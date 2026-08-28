const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth.middleware');
const notificationsController = require('../controllers/notifications.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/', notificationsController.list);
router.get('/unread-count', notificationsController.unreadCount);
router.post('/:notificationId/read', notificationsController.markRead);
router.post('/mark-all-read', notificationsController.markAllRead);
router.post('/admin/send', requireAdmin, notificationsController.adminSend);

module.exports = router;
