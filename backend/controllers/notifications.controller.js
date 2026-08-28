const notificationsRepo = require('../database/notifications.repo');

async function list(req, res) {
  try {
    const notifications = await notificationsRepo.listForUser(req.userId);
    return res.status(200).json({ notifications });
  } catch (err) {
    return res.status(500).json({ code: 'FETCH_FAILED', message: err.message });
  }
}

async function unreadCount(req, res) {
  try {
    const count = await notificationsRepo.countUnread(req.userId);
    return res.status(200).json({ count });
  } catch (err) {
    return res.status(500).json({ code: 'FETCH_FAILED', message: err.message });
  }
}

async function markRead(req, res) {
  try {
    await notificationsRepo.markRead(req.params.notificationId);
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ code: 'UPDATE_FAILED', message: err.message });
  }
}

async function markAllRead(req, res) {
  try {
    await notificationsRepo.markAllRead(req.userId);
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ code: 'UPDATE_FAILED', message: err.message });
  }
}

// ---- Admin: send a notification to one user or broadcast to everyone ----
async function adminSend(req, res) {
  try {
    const { userId, title, body } = req.body;
    if (!title) return res.status(400).json({ code: 'MISSING_TITLE', message: 'Title is required' });
    const notification = await notificationsRepo.create({ userId: userId || null, title, body, type: 'admin' });
    return res.status(201).json({ notification });
  } catch (err) {
    return res.status(500).json({ code: 'SEND_FAILED', message: err.message });
  }
}

module.exports = { list, unreadCount, markRead, markAllRead, adminSend };
