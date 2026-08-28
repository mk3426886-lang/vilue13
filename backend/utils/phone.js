/**
 * Vilue — phone validation
 * Server-side is the source of truth for anything financial (withdrawals).
 */

function isValidIraqiPhone(value) {
  return /^07[0-9]{9}$/.test((value || '').trim());
}

function isValidZainCashPhone(value) {
  return /^078[0-9]{8}$/.test((value || '').trim());
}

module.exports = { isValidIraqiPhone, isValidZainCashPhone };
