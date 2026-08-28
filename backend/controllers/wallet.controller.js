/**
 * Vilue — wallet controller
 *
 * Deposit (Zain Cash / Super Qi): manual-review — creates a pending
 * request, admin approves/rejects from the admin panel. MasterCard is a
 * clearly-marked placeholder (no real payment gateway is configured).
 *
 * Withdrawal (Zain Cash): funds are held immediately on request, and can
 * be self-cancelled within 15 minutes if still pending. MasterCard
 * withdrawal is a placeholder for the same reason as MasterCard deposit.
 *
 * Transfer (Vilue-to-Vilue): instant, atomic, no admin review needed.
 *
 * 2FA: when the user has two_fa_enabled, withdrawals and transfers
 * require a valid emailed code (see /wallet/2fa/send-code) passed as
 * `code` in the request body — verified BEFORE any balance change runs.
 */

const usersRepo = require('../database/users.repo');
const walletsRepo = require('../database/wallets.repo');
const otpService = require('../services/otp.service');
const { isValidZainCashPhone } = require('../utils/phone');
const { uploadReceiptImage } = require('../services/storage.service');

const PLACEHOLDER_METHODS = new Set(['mastercard']);

async function requireTwoFactorIfEnabled(userId, code) {
  const user = await usersRepo.findById(userId);
  if (!user.two_fa_enabled) return;

  if (!code) {
    const err = new Error('2fa_required');
    err.code = 'TWO_FA_REQUIRED';
    throw err;
  }
  await otpService.verifyOtp({ userId, code });
}

async function getMyWallet(req, res) {
  try {
    const wallet = await walletsRepo.getWallet(req.userId);
    if (!wallet) return res.status(404).json({ code: 'WALLET_NOT_FOUND', message: 'Wallet not found' });

    const balanceSlon = Number(wallet.balance_slon);
    return res.status(200).json({
      balanceSlon,
      balanceIqd: balanceSlon / 5,
      updatedAt: wallet.updated_at,
    });
  } catch (err) {
    return res.status(500).json({ code: 'FETCH_FAILED', message: err.message });
  }
}

async function getMyTransactions(req, res) {
  try {
    const rows = await walletsRepo.getTransactions(req.userId);
    return res.status(200).json({ transactions: rows });
  } catch (err) {
    return res.status(500).json({ code: 'FETCH_FAILED', message: err.message });
  }
}

async function sendTwoFactorCode(req, res) {
  try {
    const user = await usersRepo.findById(req.userId);
    if (!user) return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'User not found' });

    await otpService.requestOtp({
      userId: user.id, contact: user.email, contactType: 'email', lang: user.language || 'ar',
    });
    return res.status(200).json({ sent: true });
  } catch (err) {
    const status = err.code === 'OTP_RATE_LIMITED' || err.code === 'OTP_COOLDOWN' ? 429 : 500;
    return res.status(status).json({ code: err.code || 'SEND_FAILED', message: err.message, retryAfterSeconds: err.retryAfterSeconds });
  }
}

async function deposit(req, res) {
  try {
    const { amountSlon, method, senderAccountName, note, receiptImageBase64 } = req.body;
    const amount = Number(amountSlon);

    if (!amount || amount <= 0) {
      return res.status(400).json({ code: 'INVALID_AMOUNT', message: 'Invalid amount' });
    }
    if (!['zaincash', 'superqi', 'mastercard'].includes(method)) {
      return res.status(400).json({ code: 'INVALID_METHOD', message: 'Invalid deposit method' });
    }
    if (PLACEHOLDER_METHODS.has(method)) {
      return res.status(501).json({ code: 'METHOD_NOT_AVAILABLE', message: 'MasterCard deposits are not connected yet — this needs a real payment gateway account.' });
    }
    if ((method === 'superqi' || method === 'zaincash') && !senderAccountName) {
      return res.status(400).json({ code: 'MISSING_SENDER_INFO', message: 'senderAccountName is required for manual-review deposits' });
    }

    // Receipt image is optional — helps admin review go faster, but a
    // deposit request can be submitted without one.
    let receiptUrl = null;
    if (receiptImageBase64) {
      try {
        receiptUrl = await uploadReceiptImage(req.userId, receiptImageBase64);
      } catch (uploadErr) {
        // Don't fail the whole deposit request just because the optional
        // image upload failed — proceed without it.
        receiptUrl = null;
      }
    }

    const tx = await walletsRepo.requestDeposit(req.userId, amount, method, {
      sender_account_name: senderAccountName || null,
      note: note || null,
      receipt_url: receiptUrl,
    });

    return res.status(201).json({ transaction: tx });
  } catch (err) {
    return res.status(500).json({ code: 'DEPOSIT_FAILED', message: err.message });
  }
}

async function withdraw(req, res) {
  try {
    const { amountSlon, method, phone, code } = req.body;
    const amount = Number(amountSlon);

    if (!amount || amount <= 0) {
      return res.status(400).json({ code: 'INVALID_AMOUNT', message: 'Invalid amount' });
    }
    if (!['zaincash', 'mastercard'].includes(method)) {
      return res.status(400).json({ code: 'INVALID_METHOD', message: 'Invalid withdrawal method' });
    }
    if (PLACEHOLDER_METHODS.has(method)) {
      return res.status(501).json({ code: 'METHOD_NOT_AVAILABLE', message: 'MasterCard withdrawals are not connected yet — this needs a real payment gateway account.' });
    }
    if (method === 'zaincash' && !isValidZainCashPhone(phone)) {
      return res.status(400).json({ code: 'INVALID_PHONE', message: 'Zain Cash number must start with 078 and be 11 digits' });
    }

    await requireTwoFactorIfEnabled(req.userId, code);

    const tx = await walletsRepo.requestWithdrawal(req.userId, amount, method, { phone: phone || null });
    return res.status(201).json({ transaction: tx });
  } catch (err) {
    if (err.code === 'TWO_FA_REQUIRED' || err.code === 'OTP_INVALID' || err.code === 'OTP_EXPIRED') {
      return res.status(400).json({ code: err.code, message: err.message });
    }
    const dbCode = (err.message || '').match(/INSUFFICIENT_BALANCE|WALLET_NOT_FOUND/);
    if (dbCode) return res.status(400).json({ code: dbCode[0], message: 'Insufficient balance' });
    return res.status(500).json({ code: 'WITHDRAW_FAILED', message: err.message });
  }
}

async function cancelWithdrawal(req, res) {
  try {
    const { transactionId } = req.params;
    const tx = await walletsRepo.cancelWithdrawal(req.userId, transactionId);
    return res.status(200).json({ transaction: tx });
  } catch (err) {
    const dbCode = (err.message || '').match(/TX_NOT_FOUND|TX_NOT_CANCELLABLE|CANCEL_WINDOW_EXPIRED/);
    if (dbCode) return res.status(400).json({ code: dbCode[0], message: 'Cannot cancel this withdrawal' });
    return res.status(500).json({ code: 'CANCEL_FAILED', message: err.message });
  }
}

async function transfer(req, res) {
  try {
    const { receiverId, amountSlon, code } = req.body;
    const amount = Number(amountSlon);

    if (!receiverId) {
      return res.status(400).json({ code: 'MISSING_RECEIVER', message: 'Receiver ID is required' });
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({ code: 'INVALID_AMOUNT', message: 'Invalid amount' });
    }

    await requireTwoFactorIfEnabled(req.userId, code);

    const tx = await walletsRepo.transferSlon(req.userId, receiverId.trim(), amount);
    return res.status(201).json({ transaction: tx });
  } catch (err) {
    if (err.code === 'TWO_FA_REQUIRED' || err.code === 'OTP_INVALID' || err.code === 'OTP_EXPIRED') {
      return res.status(400).json({ code: err.code, message: err.message });
    }
    const dbCode = (err.message || '').match(/INSUFFICIENT_BALANCE|RECEIVER_NOT_FOUND|CANNOT_TRANSFER_TO_SELF|WALLET_NOT_FOUND/);
    if (dbCode) return res.status(400).json({ code: dbCode[0], message: dbCode[0] });
    return res.status(500).json({ code: 'TRANSFER_FAILED', message: err.message });
  }
}

module.exports = {
  getMyWallet, getMyTransactions, sendTwoFactorCode,
  deposit, withdraw, cancelWithdrawal, transfer,
};
