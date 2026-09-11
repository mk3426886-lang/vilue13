/**
 * Vilue — marketplace controller
 * Browsing approved products is public (no auth). Creating a listing,
 * buying, and viewing "my listings/purchases" require login. Review
 * and hide/unhide require admin.
 */

const marketplaceRepo = require('../database/marketplace.repo');
const { uploadProductImage } = require('../services/storage.service');

const MAX_TITLE = 80;
const MAX_DESCRIPTION = 1000;

async function browse(req, res) {
  try {
    const { category, search, limit, offset } = req.query;
    const products = await marketplaceRepo.listApproved({
      category: category || undefined,
      search: search || undefined,
      limit: limit ? Number(limit) : 40,
      offset: offset ? Number(offset) : 0,
    });
    return res.status(200).json({ products });
  } catch (err) {
    return res.status(500).json({ code: 'FETCH_FAILED', message: err.message });
  }
}

async function getOne(req, res) {
  try {
    const product = await marketplaceRepo.getProduct(req.params.productId);
    if (!product) return res.status(404).json({ code: 'PRODUCT_NOT_FOUND', message: 'Product not found' });
    return res.status(200).json({ product });
  } catch (err) {
    return res.status(500).json({ code: 'FETCH_FAILED', message: err.message });
  }
}

async function create(req, res) {
  try {
    const { title, description, priceSlon, category, imageBase64, isDigital, deliveryContent, quantity, productType } = req.body;
    const price = Number(priceSlon);
    const type = productType === 'credit_code' ? 'credit_code' : 'item';

    if (!title || title.trim().length < 3 || title.length > MAX_TITLE) {
      return res.status(400).json({ code: 'INVALID_TITLE', message: `Title must be 3-${MAX_TITLE} characters` });
    }
    if (description && description.length > MAX_DESCRIPTION) {
      return res.status(400).json({ code: 'INVALID_DESCRIPTION', message: 'Description too long' });
    }
    if (!price || price <= 0) {
      return res.status(400).json({ code: 'INVALID_PRICE', message: 'Invalid price' });
    }
    if (type === 'item' && isDigital && (!deliveryContent || !deliveryContent.trim())) {
      return res.status(400).json({ code: 'MISSING_DELIVERY_CONTENT', message: 'Digital products need delivery content' });
    }

    // Seller enters 0 in the quantity field to mean "unlimited" — that
    // becomes NULL in the database. A credit_code listing's quantity is
    // always derived from its code pool (starts empty; see addCodes).
    let quantityValue = null;
    if (type === 'item') {
      const qty = Number(quantity);
      quantityValue = (quantity === undefined || quantity === '' || qty === 0) ? null : qty;
      if (quantityValue !== null && (!Number.isInteger(quantityValue) || quantityValue < 0)) {
        return res.status(400).json({ code: 'INVALID_QUANTITY', message: 'Quantity must be a whole number, 0 or more' });
      }
    }

    let imageUrl = null;
    if (imageBase64) {
      try {
        imageUrl = await uploadProductImage(req.userId, imageBase64);
      } catch (uploadErr) {
        imageUrl = null; // optional — proceed without the image
      }
    }

    const product = await marketplaceRepo.createListing(req.userId, {
      title: title.trim(), description, priceSlon: price, imageUrl, category,
      quantity: quantityValue, productType: type,
      deliveryContent: deliveryContent ? deliveryContent.trim() : null,
    }, false);

    return res.status(201).json({ product });
  } catch (err) {
    const dbCode = (err.message || '').match(/INSUFFICIENT_BALANCE|WALLET_NOT_FOUND/);
    if (dbCode) return res.status(400).json({ code: dbCode[0], message: 'Insufficient balance for the listing fee' });
    return res.status(500).json({ code: 'CREATE_FAILED', message: err.message });
  }
}

// Seller uploads their pool of one-time codes for a credit_code
// listing (one per line from the frontend). Each buyer gets exactly
// one, atomically claimed — never handed out twice.
async function addCodes(req, res) {
  try {
    const { codes } = req.body;
    if (!Array.isArray(codes) || codes.length === 0) {
      return res.status(400).json({ code: 'NO_CODES_PROVIDED', message: 'Provide a non-empty list of codes' });
    }
    const cleaned = codes.map((c) => String(c).trim()).filter(Boolean);
    if (cleaned.length === 0) {
      return res.status(400).json({ code: 'NO_CODES_PROVIDED', message: 'Provide a non-empty list of codes' });
    }
    const inserted = await marketplaceRepo.addProductCodes(req.params.productId, req.userId, cleaned, !!req.isAdmin);
    return res.status(200).json({ added: inserted });
  } catch (err) {
    const dbCode = (err.message || '').match(/PRODUCT_NOT_FOUND|NOT_OWNER|NOT_CREDIT_CODE_PRODUCT|NO_CODES_PROVIDED/);
    if (dbCode) return res.status(400).json({ code: dbCode[0], message: dbCode[0] });
    return res.status(500).json({ code: 'ADD_CODES_FAILED', message: err.message });
  }
}

async function mine(req, res) {
  try {
    const products = await marketplaceRepo.listMine(req.userId);
    return res.status(200).json({ products });
  } catch (err) {
    return res.status(500).json({ code: 'FETCH_FAILED', message: err.message });
  }
}

async function myPurchases(req, res) {
  try {
    const orders = await marketplaceRepo.listMyPurchases(req.userId);
    return res.status(200).json({ orders });
  } catch (err) {
    return res.status(500).json({ code: 'FETCH_FAILED', message: err.message });
  }
}

async function buy(req, res) {
  try {
    const order = await marketplaceRepo.purchase(req.userId, req.params.productId);
    return res.status(201).json({
      order,
      deliveryContent: order.code_value || null,
    });
  } catch (err) {
    const dbCode = (err.message || '').match(/PRODUCT_NOT_FOUND|PRODUCT_NOT_AVAILABLE|CANNOT_BUY_OWN_LISTING|INSUFFICIENT_BALANCE|WALLET_NOT_FOUND|OUT_OF_STOCK/);
    if (dbCode) return res.status(400).json({ code: dbCode[0], message: dbCode[0] });
    return res.status(500).json({ code: 'PURCHASE_FAILED', message: err.message });
  }
}

// ---- Admin ----
async function adminCreate(req, res) {
  try {
    const { title, description, priceSlon, category, imageBase64, isDigital, deliveryContent, quantity, productType } = req.body;
    const price = Number(priceSlon);
    const type = productType === 'credit_code' ? 'credit_code' : 'item';

    if (!title || title.trim().length < 3) {
      return res.status(400).json({ code: 'INVALID_TITLE', message: 'Invalid title' });
    }
    if (!price || price <= 0) {
      return res.status(400).json({ code: 'INVALID_PRICE', message: 'Invalid price' });
    }

    let quantityValue = null;
    if (type === 'item') {
      const qty = Number(quantity);
      quantityValue = (quantity === undefined || quantity === '' || qty === 0) ? null : qty;
    }

    let imageUrl = null;
    if (imageBase64) {
      try {
        imageUrl = await uploadProductImage(req.userId, imageBase64);
      } catch (e) { imageUrl = null; }
    }

    const product = await marketplaceRepo.createListing(req.userId, {
      title: title.trim(), description, priceSlon: price, imageUrl, category,
      quantity: quantityValue, productType: type,
      deliveryContent: deliveryContent ? deliveryContent.trim() : null,
    }, true);

    return res.status(201).json({ product });
  } catch (err) {
    return res.status(500).json({ code: 'CREATE_FAILED', message: err.message });
  }
}

async function adminListPending(req, res) {
  try {
    const products = await marketplaceRepo.listPending();
    return res.status(200).json({ products });
  } catch (err) {
    return res.status(500).json({ code: 'FETCH_FAILED', message: err.message });
  }
}

async function adminReview(req, res) {
  try {
    const { action, note } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ code: 'INVALID_ACTION', message: 'action must be approve or reject' });
    }
    const product = await marketplaceRepo.review(req.params.productId, action, note);
    return res.status(200).json({ product });
  } catch (err) {
    return res.status(500).json({ code: 'REVIEW_FAILED', message: err.message });
  }
}

async function adminSetHidden(req, res) {
  try {
    const { hidden } = req.body;
    await marketplaceRepo.setHidden(req.params.productId, !!hidden);
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ code: 'UPDATE_FAILED', message: err.message });
  }
}

// Seller deletes their own listing; admins can delete any listing.
async function deleteProduct(req, res) {
  try {
    await marketplaceRepo.deleteListing(req.params.productId, req.userId, !!req.isAdmin || !!req.isOwner);
    return res.status(200).json({ success: true });
  } catch (err) {
    const dbCode = (err.message || '').match(/PRODUCT_NOT_FOUND|NOT_OWNER/);
    if (dbCode) return res.status(dbCode[0] === 'NOT_OWNER' ? 403 : 404).json({ code: dbCode[0], message: dbCode[0] });
    return res.status(500).json({ code: 'DELETE_FAILED', message: err.message });
  }
}

module.exports = {
  browse, getOne, create, addCodes, deleteProduct, mine, myPurchases, buy,
  adminCreate, adminListPending, adminReview, adminSetHidden,
};
