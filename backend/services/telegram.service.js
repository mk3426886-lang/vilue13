/**
 * Vilue — Telegram bot service
 *
 * Setup required (see /.env.example):
 *   TELEGRAM_BOT_TOKEN    — from @BotFather on Telegram
 *   TELEGRAM_BOT_USERNAME — the bot's @username, shown to users when linking
 *   TELEGRAM_WEBHOOK_SECRET — a random string only you and Telegram know,
 *                             appended to the webhook URL to verify requests
 *
 * ⚠️ CRITICAL — this is why joins used to silently never get counted:
 * Telegram does NOT send chat_member (join/leave) updates to a webhook
 * by default, even when the bot is an admin of the channel. You must
 * register the webhook with allowed_updates explicitly including
 * "chat_member", or every join/leave event is dropped before it ever
 * reaches this backend — with no error anywhere, it just never arrives.
 *
 * One-time setup after deploying the backend — call setupWebhook() once
 * (e.g. via `node -e "require('./backend/services/telegram.service').setupWebhook().then(console.log)"`
 * from the server, or hit it through a one-off admin route) instead of
 * hand-building the URL, since a manually typed one is easy to get
 * wrong and silently miss allowed_updates.
 *
 * The bot must also be added as an ADMIN of every channel that will
 * host a join task — Telegram only sends member-join/leave events for
 * chats the bot administers at all, on top of the allowed_updates
 * requirement above.
 */

async function callBotApi(method, payload) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured');

  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.ok) {
    const err = new Error(data.description || 'Telegram API error');
    err.details = data;
    throw err;
  }
  return data.result;
}

async function sendMessage(chatId, text) {
  return callBotApi('sendMessage', { chat_id: chatId, text });
}

/**
 * Registers the webhook with Telegram, explicitly including
 * "chat_member" in allowed_updates — the one thing that was missing.
 * Requires BACKEND_URL (e.g. https://vilue.koyeb.app) and
 * TELEGRAM_WEBHOOK_SECRET to be set.
 */
async function setupWebhook() {
  const backendUrl = process.env.BACKEND_URL;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!backendUrl || !secret) {
    throw new Error('BACKEND_URL and TELEGRAM_WEBHOOK_SECRET must both be set to register the webhook');
  }
  return callBotApi('setWebhook', {
    url: `${backendUrl}/api/v1/telegram/webhook/${secret}`,
    allowed_updates: ['message', 'chat_member'],
  });
}

module.exports = { sendMessage, setupWebhook };
