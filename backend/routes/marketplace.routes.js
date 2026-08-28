const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth.middleware');
const marketplaceController = require('../controllers/marketplace.controller');

const router = express.Router();

// Public browsing — no auth required
router.get('/products', marketplaceController.browse);
router.get('/products/:productId', marketplaceController.getOne);

// Requires login
router.post('/products', requireAuth, marketplaceController.create);
router.get('/my-listings', requireAuth, marketplaceController.mine);
router.get('/my-purchases', requireAuth, marketplaceController.myPurchases);
router.post('/products/:productId/buy', requireAuth, marketplaceController.buy);

// Admin
router.post('/admin/products', requireAuth, requireAdmin, marketplaceController.adminCreate);
router.get('/admin/pending', requireAuth, requireAdmin, marketplaceController.adminListPending);
router.post('/admin/products/:productId/review', requireAuth, requireAdmin, marketplaceController.adminReview);
router.patch('/admin/products/:productId/hidden', requireAuth, requireAdmin, marketplaceController.adminSetHidden);

module.exports = router;
