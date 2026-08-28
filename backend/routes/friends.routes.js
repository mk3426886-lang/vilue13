const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const friendsController = require('../controllers/friends.controller');

const router = express.Router();

router.use(requireAuth);

router.post('/requests', friendsController.sendRequest);
router.get('/requests/incoming', friendsController.listIncoming);
router.get('/requests/outgoing', friendsController.listOutgoing);
router.post('/requests/:requestId/respond', friendsController.respond);
router.get('/', friendsController.listFriends);
router.delete('/:friendId', friendsController.removeFriend);

module.exports = router;
