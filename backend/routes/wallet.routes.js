const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const walletController = require('../controllers/wallet.controller');

const router = express.Router();

router.get('/me', requireAuth, walletController.getMyWallet);
router.get('/transactions', requireAuth, walletController.getMyTransactions);
router.post('/2fa/send-code', requireAuth, walletController.sendTwoFactorCode);
router.post('/deposit', requireAuth, walletController.deposit);
router.post('/withdraw', requireAuth, walletController.withdraw);
router.post('/withdraw/:transactionId/cancel', requireAuth, walletController.cancelWithdrawal);
router.post('/transfer', requireAuth, walletController.transfer);

module.exports = router;
