/**
 * Vilue — messages controller
 * Messaging is only allowed between accepted friends. This is a
 * polling-based chat (no WebSockets) — the frontend refreshes on an
 * interval rather than receiving instant push updates.
 */

const messagesRepo = require('../database/messages.repo');
const friendsRepo = require('../database/friends.repo');
const notificationsRepo = require('../database/notifications.repo');

// Matches the default gift catalog from the spec — admin-editable
// pricing could be added later; these are the base SLON values.
const GIFT_CATALOG = {
  rose: 100, roses: 1000, balloon: 1000, heart: 1500, airplane: 50000, world_cup: 10000,
};

async function requireFriends(userA, userB) {
  const pair = await friendsRepo.findAcceptedPair(userA, userB);
  if (!pair) {
    const err = new Error('not_friends');
    err.code = 'NOT_FRIENDS';
    throw err;
  }
}

async function getConversation(req, res) {
  try {
    const { friendId } = req.params;
    await requireFriends(req.userId, friendId);
    const messages = await messagesRepo.getConversation(req.userId, friendId);
    return res.status(200).json({ messages });
  } catch (err) {
    if (err.code === 'NOT_FRIENDS') return res.status(403).json({ code: err.code, message: 'You are not friends with this user' });
    return res.status(500).json({ code: 'FETCH_FAILED', message: err.message });
  }
}

async function sendText(req, res) {
  try {
    const { friendId } = req.params;
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ code: 'EMPTY_MESSAGE', message: 'Message cannot be empty' });
    }
    await requireFriends(req.userId, friendId);
    const message = await messagesRepo.sendText(req.userId, friendId, content.trim().slice(0, 2000));
    return res.status(201).json({ message });
  } catch (err) {
    if (err.code === 'NOT_FRIENDS') return res.status(403).json({ code: err.code, message: 'You are not friends with this user' });
    return res.status(500).json({ code: 'SEND_FAILED', message: err.message });
  }
}

async function sendGift(req, res) {
  try {
    const { friendId } = req.params;
    const { giftType, quantity } = req.body;
    const qty = Math.max(1, Number(quantity) || 1);

    if (!GIFT_CATALOG[giftType]) {
      return res.status(400).json({ code: 'INVALID_GIFT', message: 'Unknown gift type' });
    }
    await requireFriends(req.userId, friendId);

    const totalValue = GIFT_CATALOG[giftType] * qty;
    const message = await messagesRepo.sendGift(req.userId, friendId, `${giftType}:${qty}`, totalValue);

    return res.status(201).json({ message });
  } catch (err) {
    if (err.code === 'NOT_FRIENDS') return res.status(403).json({ code: err.code, message: 'You are not friends with this user' });
    const dbCode = (err.message || '').match(/INSUFFICIENT_BALANCE|WALLET_NOT_FOUND|CANNOT_GIFT_SELF/);
    if (dbCode) return res.status(400).json({ code: dbCode[0], message: dbCode[0] });
    return res.status(500).json({ code: 'GIFT_FAILED', message: err.message });
  }
}

function getGiftCatalog(req, res) {
  return res.status(200).json({ catalog: GIFT_CATALOG });
}

module.exports = { getConversation, sendText, sendGift, getGiftCatalog };
