const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth.middleware');
const supportController = require('../controllers/support.controller');

const router = express.Router();

router.use(requireAuth);

router.post('/', supportController.send);
router.get('/mine', supportController.mine);
router.get('/admin/all', requireAdmin, supportController.adminList);
router.post('/admin/:messageId/reply', requireAdmin, supportController.adminReply);

module.exports = router;
