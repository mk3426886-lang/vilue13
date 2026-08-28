const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth.middleware');
const tasksController = require('../controllers/tasks.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/browse', tasksController.browse);
router.post('/', tasksController.create);
router.get('/mine', tasksController.mine);
router.post('/:taskId/cancel', tasksController.cancel);

router.get('/admin/pending', requireAdmin, tasksController.adminListPending);
router.post('/admin/:taskId/review', requireAdmin, tasksController.adminReview);

module.exports = router;
