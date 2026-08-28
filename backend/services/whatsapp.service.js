/**
 * Vilue — WhatsApp service
 *
 * Uses the official WhatsApp Business Cloud API (Meta) over plain HTTPS —
 * no third-party SDK needed, just fetch(). This is the officially
 * supported route, unlike libraries that puppeteer a personal WhatsApp
 * Web session (those risk an unannounced number ban and must never be
 * used for a financial product's verification flow).
 *
 * Setup required (see /.env.example):
 *   WHATSAPP_PHONE_NUMBER_ID — from Meta for Developers → WhatsApp → API Setup
 *   WHATSAPP_ACCESS_TOKEN    — temporary (dev) or permanent (System User) token
 *   WHATSAPP_API_VERSION     — e.g. v20.0
 *
 * Setup steps (one-time):
 *   1. Create a Meta Developer account → business.facebook.com
 *   2. Create an App → add the "WhatsApp" product
 *   3. Add/verify a business phone number (a free test number is provided
 *      for development; a real number is required to go live)
 *   4. Create a message template for OTPs (Meta requires templates for
 *      the first message in a 24h window) and get it approved
 *   5. Copy the Phone Number ID + generate an access token into .env
 */

const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v20.0';

function getConfig() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) {
    throw new Error(
      'WhatsApp service not configured — set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN in .env'
    );
  }
  return { phoneNumberId, accessToken };
}

/**
 * Sends a pre-approved template message. Meta requires OTP-type messages
 * to go through an approved template (e.g. "vilue_otp") — free-form text
 * only works within an existing 24h customer-initiated conversation.
 */
async function sendTemplateMessage(toPhone, templateName, languageCode, bodyParams = []) {
  const { phoneNumberId, accessToken } = getConfig();

  const res = await fetch(
    `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components: [
            {
              type: 'body',
              parameters: bodyParams.map((text) => ({ type: 'text', text })),
            },
          ],
        },
      }),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error?.message || 'WhatsApp send failed');
    err.details = data;
    throw err;
  }
  return data;
}

async function sendOtpWhatsapp(toPhone, code, lang = 'ar') {
  // "vilue_otp" must be created and approved in Meta Business Manager first.
  const languageCode = lang === 'ar' ? 'ar' : 'en_US';
  return sendTemplateMessage(toPhone, 'vilue_otp', languageCode, [code]);
}

module.exports = { sendTemplateMessage, sendOtpWhatsapp };
