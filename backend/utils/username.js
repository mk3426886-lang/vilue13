/**
 * Vilue — username validation
 * Server-side is the source of truth; the frontend check in utils.js is
 * a convenience copy of the same format rule, but only this file's
 * result can be trusted.
 */

// Deliberately short, common-term denylist. This is a basic first line of
// defense, not a complete profanity filter — expand as needed.
const BLOCKED_SUBSTRINGS = [
  'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'dick', 'pussy', 'nigger',
  'nigga', 'faggot', 'rape', 'whore', 'slut', 'admin', 'vilue', 'support',
  'moderator',
];

function isValidFormat(username) {
  return /^[a-zA-Z0-9]{3,20}$/.test(username || '');
}

function containsBlockedWord(username) {
  const lower = (username || '').toLowerCase();
  return BLOCKED_SUBSTRINGS.some((word) => lower.includes(word));
}

function validateUsername(username) {
  if (!isValidFormat(username)) {
    return { valid: false, code: 'USERNAME_INVALID_FORMAT' };
  }
  if (containsBlockedWord(username)) {
    return { valid: false, code: 'USERNAME_NOT_ALLOWED' };
  }
  return { valid: true };
}

module.exports = { validateUsername };
