/**
 * Vilue — Telegram controller
 * Handles: (1) generating a link code for a logged-in user, and
 * (2) receiving Telegram's webhook for /start <code> link messages
 * and chat_member (join/leave) events for task channels.
 */

const usersRepo = require('../database/users.repo');
const tasksRepo = require('../database/tasks.repo');
const telegramService = require('../services/telegram.service');

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
}

async function generateLinkCode(req, res) {
  try {
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await usersRepo.setLinkCode(req.userId, code, expiresAt);

    return res.status(200).json({
      code,
      botUsername: process.env.TELEGRAM_BOT_USERNAME || null,
      expiresAt,
    });
  } catch (err) {
    return res.status(500).json({ code: 'LINK_FAILED', message: err.message });
  }
}

async function linkStatus(req, res) {
  try {
    const user = await usersRepo.findById(req.userId);
    return res.status(200).json({
      linked: !!user.telegram_user_id,
      telegramUsername: user.telegram_username || null,
    });
  } catch (err) {
    return res.status(500).json({ code: 'FETCH_FAILED', message: err.message });
  }
}

// ---- Webhook (public — verified by the secret in the URL path) ----
async function webhook(req, res) {
  // Always 200 quickly — Telegram retries aggressively on non-200/slow responses.
  res.status(200).json({ ok: true });

  try {
    const update = req.body;

    // Case 1: a /start <code> message — completes account linking.
    if (update.message && update.message.text) {
      const match = update.message.text.trim().match(/^\/start\s+(\d{6})$/);
      if (match) {
        const code = match[1];
        const user = await usersRepo.findByLinkCode(code);
        const chatId = update.message.chat.id;
        const fromUser = update.message.from;

        if (!user || new Date(user.telegram_link_code_expires_at) < new Date()) {
          await telegramService.sendMessage(chatId, 'الرمز غير صحيح أو منتهي الصلاحية. اطلب رمزاً جديداً من التطبيق.').catch(() => {});
          return;
        }

        await usersRepo.completeTelegramLink(user.id, fromUser.id, fromUser.username || null);
        await telegramService.sendMessage(chatId, '✅ تم ربط حسابك بفيليو بنجاح!').catch(() => {});
        return;
      }
    }

    // Case 2: a chat_member update — someone joined or left a channel.
    if (update.chat_member) {
      const chat = update.chat_member.chat; // { id, username, ... }
      const newStatus = update.chat_member.new_chat_member.status; // 'member' | 'left' | 'kicked' | ...
      const oldStatus = update.chat_member.old_chat_member.status;
      const telegramUser = update.chat_member.new_chat_member.user;

      if (!chat.username) return; // task channels are matched by @username
      const channelHandle = `@${chat.username}`;

      const task = await tasksRepo.findActiveByChannel(channelHandle);
      if (!task) return;

      const vilueUser = await usersRepo.findByTelegramId(telegramUser.id);
      if (!vilueUser) return; // not a linked Vilue account — nothing to credit/penalize

      const wasMember = oldStatus === 'member' || oldStatus === 'administrator' || oldStatus === 'creator';
      const isMember = newStatus === 'member' || newStatus === 'administrator' || newStatus === 'creator';

      if (!wasMember && isMember) {
        await tasksRepo.processJoin(task.id, vilueUser.id, telegramUser.id).catch(() => {});
      } else if (wasMember && !isMember) {
        await tasksRepo.processLeave(task.id, vilueUser.id).catch(() => {});
      }
    }
  } catch (err) {
    // Webhook already responded 200 — just log server-side.
    console.error('Telegram webhook processing error:', err.message);
  }
}

module.exports = { generateLinkCode, linkStatus, webhook };
