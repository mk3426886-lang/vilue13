/**
 * Vilue — Notification service
 * Single entry point for sending a verification code. Callers never pick
 * between email.service and whatsapp.service directly — they call
 * sendOtp() with the contact and its type, and this module routes it.
 */

const emailService = require('./email.service');
const whatsappService = require('./whatsapp.service');

async function sendOtp({ contact, contactType, code, lang = 'ar' }) {
  if (contactType === 'email') {
    return emailService.sendOtpEmail(contact, code, lang);
  }
  if (contactType === 'phone') {
    return whatsappService.sendOtpWhatsapp(contact, code, lang);
  }
  throw new Error(`Unknown contact type: ${contactType}`);
}

module.exports = { sendOtp };
