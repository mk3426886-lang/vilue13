const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const messagesController = require('../controllers/messages.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/gift-catalog', messagesController.getGiftCatalog);
router.get('/:friendId', messagesController.getConversation);
router.post('/:friendId', messagesController.sendText);
router.post('/:friendId/gift', messagesController.sendGift);

module.exports = router;
