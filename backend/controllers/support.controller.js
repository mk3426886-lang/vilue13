const supportRepo = require('../database/support.repo');
const notificationsRepo = require('../database/notifications.repo');

async function send(req, res) {
  try {
    const { message } = req.body;
    if (!message || message.trim().length < 3) {
      return res.status(400).json({ code: 'INVALID_MESSAGE', message: 'Message is too short' });
    }
    const record = await supportRepo.create(req.userId, message.trim());
    return res.status(201).json({ message: record });
  } catch (err) {
    return res.status(500).json({ code: 'SEND_FAILED', message: err.message });
  }
}

async function mine(req, res) {
  try {
    const messages = await supportRepo.listForUser(req.userId);
    return res.status(200).json({ messages });
  } catch (err) {
    return res.status(500).json({ code: 'FETCH_FAILED', message: err.message });
  }
}

// ---- Admin ----
async function adminList(req, res) {
  try {
    const messages = await supportRepo.listAll(req.query.status);
    return res.status(200).json({ messages });
  } catch (err) {
    return res.status(500).json({ code: 'FETCH_FAILED', message: err.message });
  }
}

async function adminReply(req, res) {
  try {
    const { reply } = req.body;
    if (!reply) return res.status(400).json({ code: 'MISSING_REPLY', message: 'Reply is required' });
    const record = await supportRepo.reply(req.params.messageId, reply);
    await notificationsRepo.create({
      userId: record.user_id, title: 'رد فريق الدعم 💬', body: reply, type: 'support',
    });
    return res.status(200).json({ message: record });
  } catch (err) {
    return res.status(500).json({ code: 'REPLY_FAILED', message: err.message });
  }
}

module.exports = { send, mine, adminList, adminReply };
