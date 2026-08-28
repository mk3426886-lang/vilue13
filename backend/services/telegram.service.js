/**
 * Vilue — Telegram bot service
 *
 * Setup required (see /.env.example):
 *   TELEGRAM_BOT_TOKEN    — from @BotFather on Telegram
 *   TELEGRAM_BOT_USERNAME — the bot's @username, shown to users when linking
 *   TELEGRAM_WEBHOOK_SECRET — a random string only you and Telegram know,
 *                             appended to the webhook URL to verify requests
 *
 * One-time setup after deploying the backend (this can't be done from
 * inside this app — it's a direct call to Telegram's API):
 *   https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://your-backend.com/api/v1/telegram/webhook/<TELEGRAM_WEBHOOK_SECRET>
 *
 * The bot must also be added as an ADMIN of every channel that will
 * host a join task — Telegram only sends member-join/leave events for
 * chats the bot administers.
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

module.exports = { sendMessage };
