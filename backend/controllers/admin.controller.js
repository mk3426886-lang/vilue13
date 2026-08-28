/**
 * Vilue — admin controller
 * Every route here is protected by requireAuth + requireAdmin.
 */

const { getSupabase } = require('../database/supabaseClient');
const walletsRepo = require('../database/wallets.repo');
const settingsRepo = require('../database/settings.repo');
const usersRepo = require('../database/users.repo');
const { getReceiptSignedUrl, uploadProductImage } = require('../services/storage.service');

async function listUsers(req, res) {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('users')
      .select('id, display_user_id, name, email, governorate, is_verified, is_suspended, is_admin, is_owner, verification_badge, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    return res.status(200).json({ users: data });
  } catch (err) {
    return res.status(500).json({ code: 'FETCH_FAILED', message: err.message });
  }
}

async function setUserSuspended(req, res) {
  try {
    const { userId } = req.params;
    const { suspended } = req.body;
    const supabase = getSupabase();
    const { error } = await supabase
      .from('users')
      .update({ is_suspended: !!suspended, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (error) throw error;
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ code: 'UPDATE_FAILED', message: err.message });
  }
}

async function listPendingDeposits(req, res) {
  try {
    const deposits = await walletsRepo.listPendingDeposits();
    return res.status(200).json({ deposits });
  } catch (err) {
    return res.status(500).json({ code: 'FETCH_FAILED', message: err.message });
  }
}

async function listPendingWithdrawals(req, res) {
  try {
    const withdrawals = await walletsRepo.listPendingWithdrawals();
    return res.status(200).json({ withdrawals });
  } catch (err) {
    return res.status(500).json({ code: 'FETCH_FAILED', message: err.message });
  }
}

async function reviewDeposit(req, res) {
  try {
    const { transactionId } = req.params;
    const { action, note } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ code: 'INVALID_ACTION', message: 'action must be approve or reject' });
    }
    const tx = await walletsRepo.reviewDeposit(transactionId, action, note);
    return res.status(200).json({ transaction: tx });
  } catch (err) {
    return res.status(500).json({ code: 'REVIEW_FAILED', message: err.message });
  }
}

async function reviewWithdrawal(req, res) {
  try {
    const { transactionId } = req.params;
    const { action, note } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ code: 'INVALID_ACTION', message: 'action must be approve or reject' });
    }
    const tx = await walletsRepo.reviewWithdrawal(transactionId, action, note);
    return res.status(200).json({ transaction: tx });
  } catch (err) {
    return res.status(500).json({ code: 'REVIEW_FAILED', message: err.message });
  }
}

async function getReceiptUrl(req, res) {
  try {
    const { path } = req.query;
    if (!path) return res.status(400).json({ code: 'MISSING_PATH', message: 'path query param is required' });
    const url = await getReceiptSignedUrl(path);
    return res.status(200).json({ url });
  } catch (err) {
    return res.status(500).json({ code: 'FETCH_FAILED', message: err.message });
  }
}

// ---- Platform settings (fees/rates) — any admin can view, any admin can edit ----
async function getSettings(req, res) {
  try {
    const settings = await settingsRepo.getSettings();
    return res.status(200).json({ settings });
  } catch (err) {
    return res.status(500).json({ code: 'FETCH_FAILED', message: err.message });
  }
}

const EDITABLE_SETTINGS_FIELDS = [
  'slon_per_iqd', 'usdt_to_iqd',
  'withdrawal_fee_type', 'withdrawal_fee_value',
  'transfer_fee_type', 'transfer_fee_value',
  'deposit_fee_type', 'deposit_fee_value',
  'gift_commission_type', 'gift_commission_value',
  'marketplace_listing_fee_slon',
  'marketplace_commission_type', 'marketplace_commission_value',
  'task_commission_type', 'task_commission_value',
  'news_ticker_text', 'promo_banner_text', 'promo_banner_image_url',
];
const TYPE_FIELDS = new Set(['withdrawal_fee_type', 'transfer_fee_type', 'deposit_fee_type', 'gift_commission_type', 'marketplace_commission_type', 'task_commission_type']);
const TEXT_FIELDS = new Set(['news_ticker_text', 'promo_banner_text', 'promo_banner_image_url']);

async function updateSettings(req, res) {
  try {
    const fields = {};
    for (const key of EDITABLE_SETTINGS_FIELDS) {
      if (req.body[key] === undefined) continue;

      if (TYPE_FIELDS.has(key)) {
        if (!['percent', 'fixed'].includes(req.body[key])) {
          return res.status(400).json({ code: 'INVALID_VALUE', message: `${key} must be "percent" or "fixed"` });
        }
        fields[key] = req.body[key];
        continue;
      }

      if (TEXT_FIELDS.has(key)) {
        fields[key] = String(req.body[key]).slice(0, 500);
        continue;
      }

      const num = Number(req.body[key]);
      if (Number.isNaN(num) || num < 0) {
        return res.status(400).json({ code: 'INVALID_VALUE', message: `${key} must be a non-negative number` });
      }
      fields[key] = num;
    }
    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ code: 'NO_FIELDS', message: 'No valid settings fields provided' });
    }
    const settings = await settingsRepo.updateSettings(fields);
    return res.status(200).json({ settings });
  } catch (err) {
    return res.status(500).json({ code: 'UPDATE_FAILED', message: err.message });
  }
}

async function uploadBannerImage(req, res) {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) return res.status(400).json({ code: 'MISSING_IMAGE', message: 'imageBase64 is required' });
    const url = await uploadProductImage(req.userId, imageBase64); // reuses the public "products" bucket
    const settings = await settingsRepo.updateSettings({ promo_banner_image_url: url });
    return res.status(200).json({ settings });
  } catch (err) {
    return res.status(500).json({ code: 'UPLOAD_FAILED', message: err.message });
  }
}

async function getPlatformWallet(req, res) {
  try {
    const wallet = await settingsRepo.getPlatformWallet();
    return res.status(200).json({ balanceSlon: Number(wallet.balance_slon), updatedAt: wallet.updated_at });
  } catch (err) {
    return res.status(500).json({ code: 'FETCH_FAILED', message: err.message });
  }
}

// ---- Verification badges — any admin can grant/revoke a user's "verified" badge ----
async function setVerificationBadge(req, res) {
  try {
    const { userId } = req.params;
    const { verified } = req.body;

    const supabase = getSupabase();
    const { data: target, error: fetchErr } = await supabase.from('users').select('is_admin, is_owner').eq('id', userId).maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!target) return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'User not found' });
    if (target.is_admin || target.is_owner) {
      return res.status(400).json({ code: 'CANNOT_EDIT_ADMIN_BADGE', message: "Admin/owner badges are managed via promote/demote, not this endpoint" });
    }

    const { error } = await supabase
      .from('users')
      .update({ verification_badge: verified ? 'verified' : null, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ code: 'UPDATE_FAILED', message: err.message });
  }
}

// ---- Admin hierarchy — OWNER ONLY: create/remove sub-admins ----
// A promoted sub-admin gets verification_badge='admin' — visually distinct
// from the owner's own 'owner' badge, per the required hierarchy.
async function promoteToAdmin(req, res) {
  try {
    const { userId } = req.params;
    const supabase = getSupabase();

    const { data: target, error: fetchErr } = await supabase.from('users').select('is_owner').eq('id', userId).maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!target) return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'User not found' });

    const { error } = await supabase
      .from('users')
      .update({ is_admin: true, verification_badge: 'admin', updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ code: 'UPDATE_FAILED', message: err.message });
  }
}

async function demoteAdmin(req, res) {
  try {
    const { userId } = req.params;
    const supabase = getSupabase();

    const { data: target, error: fetchErr } = await supabase.from('users').select('is_owner').eq('id', userId).maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!target) return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'User not found' });
    if (target.is_owner) {
      return res.status(400).json({ code: 'CANNOT_DEMOTE_OWNER', message: 'The owner account cannot be demoted' });
    }

    const { error } = await supabase
      .from('users')
      .update({ is_admin: false, verification_badge: null, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ code: 'UPDATE_FAILED', message: err.message });
  }
}

// ---- Ban / delete / edit ID — any admin can act on non-owner accounts ----
async function banUser(req, res) {
  try {
    const { userId } = req.params;
    const { reason, durationHours } = req.body;
    const supabase = getSupabase();
    const { data: target } = await supabase.from('users').select('is_owner').eq('id', userId).maybeSingle();
    if (!target) return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'User not found' });
    if (target.is_owner) return res.status(400).json({ code: 'CANNOT_BAN_OWNER', message: 'The owner account cannot be banned' });

    await usersRepo.adminBanUser(userId, { reason, durationHours: durationHours ? Number(durationHours) : null });
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ code: 'BAN_FAILED', message: err.message });
  }
}

async function unbanUser(req, res) {
  try {
    await usersRepo.adminUnbanUser(req.params.userId);
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ code: 'UNBAN_FAILED', message: err.message });
  }
}

async function deleteUser(req, res) {
  try {
    const { userId } = req.params;
    const supabase = getSupabase();
    const { data: target } = await supabase.from('users').select('is_owner').eq('id', userId).maybeSingle();
    if (!target) return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'User not found' });
    if (target.is_owner) return res.status(400).json({ code: 'CANNOT_DELETE_OWNER', message: 'The owner account cannot be deleted' });

    await usersRepo.adminDeleteUser(userId);
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ code: 'DELETE_FAILED', message: err.message });
  }
}

async function setDisplayId(req, res) {
  try {
    const { userId } = req.params;
    const { newId } = req.body;
    if (!newId || !/^\d{6,12}$/.test(newId.trim())) {
      return res.status(400).json({ code: 'INVALID_ID', message: 'ID must be 6-12 digits' });
    }
    await usersRepo.adminSetDisplayId(userId, newId.trim());
    return res.status(200).json({ success: true });
  } catch (err) {
    if ((err.message || '').includes('duplicate')) {
      return res.status(409).json({ code: 'ID_ALREADY_USED', message: 'That ID is already taken' });
    }
    return res.status(500).json({ code: 'UPDATE_FAILED', message: err.message });
  }
}

async function getUserDetails(req, res) {
  try {
    const { userId } = req.params;
    const supabase = getSupabase();

    const { data: user, error: userErr } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
    if (userErr) throw userErr;
    if (!user) return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'User not found' });

    const wallet = await walletsRepo.getWallet(userId);
    const transactions = await walletsRepo.getTransactions(userId, 20);

    const { data: listings } = await supabase.from('marketplace_products').select('*').eq('seller_id', userId).order('created_at', { ascending: false });
    const { data: friends } = await supabase
      .from('friend_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'accepted')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

    return res.status(200).json({
      user: {
        id: user.id, userId: user.display_user_id, name: user.name, email: user.email,
        governorate: user.governorate, language: user.language,
        isVerified: user.is_verified, isSuspended: user.is_suspended, isAdmin: user.is_admin,
        isOwner: user.is_owner, verificationBadge: user.verification_badge,
        banReason: user.ban_reason, bannedUntil: user.banned_until, isDeleted: user.is_deleted,
        createdAt: user.created_at,
      },
      wallet: wallet ? { balanceSlon: Number(wallet.balance_slon) } : null,
      recentTransactions: transactions,
      listings: listings || [],
      friendCount: friends ? friends.length : 0,
    });
  } catch (err) {
    return res.status(500).json({ code: 'FETCH_FAILED', message: err.message });
  }
}

module.exports = {
  listUsers, setUserSuspended, listPendingDeposits, listPendingWithdrawals,
  reviewDeposit, reviewWithdrawal, getReceiptUrl,
  getSettings, updateSettings, uploadBannerImage, getPlatformWallet,
  setVerificationBadge, promoteToAdmin, demoteAdmin,
  banUser, unbanUser, deleteUser, setDisplayId, getUserDetails,
};
