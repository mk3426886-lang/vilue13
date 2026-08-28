const express = require('express');
const { requireAuth, requireAdmin, requireOwner } = require('../middleware/auth.middleware');
const adminController = require('../controllers/admin.controller');

const router = express.Router();

router.use(requireAuth, requireAdmin);

// Any admin
router.get('/users', adminController.listUsers);
router.get('/users/:userId', adminController.getUserDetails);
router.patch('/users/:userId/suspend', adminController.setUserSuspended);
router.patch('/users/:userId/verify', adminController.setVerificationBadge);
router.patch('/users/:userId/display-id', adminController.setDisplayId);
router.post('/users/:userId/ban', adminController.banUser);
router.post('/users/:userId/unban', adminController.unbanUser);
router.delete('/users/:userId', adminController.deleteUser);
router.get('/deposits/pending', adminController.listPendingDeposits);
router.get('/withdrawals/pending', adminController.listPendingWithdrawals);
router.post('/deposits/:transactionId/review', adminController.reviewDeposit);
router.post('/withdrawals/:transactionId/review', adminController.reviewWithdrawal);
router.get('/receipt-url', adminController.getReceiptUrl);
router.get('/settings', adminController.getSettings);
router.patch('/settings', adminController.updateSettings);
router.post('/settings/banner-image', adminController.uploadBannerImage);
router.get('/platform-wallet', adminController.getPlatformWallet);

// Owner only
router.post('/users/:userId/promote-admin', requireOwner, adminController.promoteToAdmin);
router.post('/users/:userId/demote-admin', requireOwner, adminController.demoteAdmin);

module.exports = router;
