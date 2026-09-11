/**
 * Vilue — storage service
 * Uploads deposit receipt images (optional) to a Supabase Storage
 * bucket named "receipts". Create that bucket once in Supabase:
 * Dashboard → Storage → New bucket → name it exactly "receipts"
 * (private is fine — the admin panel is the only reader for now).
 */

const { getSupabase } = require('../database/supabaseClient');

const BUCKET = 'receipts';
const PRODUCTS_BUCKET = 'products';

/**
 * @param {string} userId
 * @param {string} base64Image - data URL or raw base64 (jpeg/png)
 * @returns {Promise<string>} storage path (not a public URL — bucket is private)
 */
async function uploadReceiptImage(userId, base64Image) {
  const supabase = getSupabase();

  const matches = base64Image.match(/^data:(image\/\w+);base64,(.+)$/);
  const mimeType = matches ? matches[1] : 'image/jpeg';
  const raw = matches ? matches[2] : base64Image;
  const ext = mimeType.split('/')[1] || 'jpg';

  const buffer = Buffer.from(raw, 'base64');
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: mimeType,
    upsert: false,
  });

  if (error) throw error;
  return path;
}

/** Generates a short-lived signed URL for the admin panel to view a receipt. */
async function getReceiptSignedUrl(path, expiresInSeconds = 300) {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

/**
 * Deletes a receipt image once its deposit request has been reviewed
 * (approved or rejected) — nobody needs to look at it again after that,
 * so this keeps the "receipts" bucket from growing forever. Called from
 * admin.controller.js right after a review completes. Failures here are
 * logged but never block the review itself — losing an old receipt
 * image is not worth failing an approval/rejection over.
 */
async function deleteReceiptImage(path) {
  if (!path) return;
  const supabase = getSupabase();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) console.error('[storage] failed to delete receipt image:', error.message);
}

/**
 * Uploads a marketplace product image to the public "products" bucket.
 * Create it once in Supabase: Storage → New bucket → name it exactly
 * "products" → mark it PUBLIC (product photos need to be viewable by
 * anyone browsing the marketplace, unlike private deposit receipts).
 * @returns {Promise<string>} public URL
 */
async function uploadProductImage(sellerId, base64Image) {
  const supabase = getSupabase();

  const matches = base64Image.match(/^data:(image\/\w+);base64,(.+)$/);
  const mimeType = matches ? matches[1] : 'image/jpeg';
  const raw = matches ? matches[2] : base64Image;
  const ext = mimeType.split('/')[1] || 'jpg';

  const buffer = Buffer.from(raw, 'base64');
  const path = `${sellerId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(PRODUCTS_BUCKET).upload(path, buffer, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(PRODUCTS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Uploads a user's profile picture to the public "avatars" bucket.
 * Create it once in Supabase: Storage → New bucket → name it exactly
 * "avatars" → mark it PUBLIC.
 * @returns {Promise<string>} public URL
 */
async function uploadAvatarImage(userId, base64Image) {
  const supabase = getSupabase();

  const matches = base64Image.match(/^data:(image\/\w+);base64,(.+)$/);
  const mimeType = matches ? matches[1] : 'image/jpeg';
  const raw = matches ? matches[2] : base64Image;
  const ext = mimeType.split('/')[1] || 'jpg';

  const buffer = Buffer.from(raw, 'base64');
  const path = `${userId}/avatar-${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from('avatars').upload(path, buffer, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}

module.exports = { uploadReceiptImage, getReceiptSignedUrl, deleteReceiptImage, uploadProductImage, uploadAvatarImage };
