/**
 * Vilue — marketplace repository
 * Listing creation, review, and purchase go through Postgres functions
 * (see marketplace_functions.sql) for atomicity — never a raw insert/
 * update on balances from here.
 */

const { getSupabase } = require('./supabaseClient');

async function createListing(sellerId, { title, description, priceSlon, imageUrl, category, isDigital, deliveryContent }, isAdminListing = false) {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('create_listing', {
    p_seller_id: sellerId,
    p_title: title,
    p_description: description || null,
    p_price_slon: priceSlon,
    p_image_url: imageUrl || null,
    p_category: category || null,
    p_is_admin_listing: isAdminListing,
    p_is_digital: !!isDigital,
    p_delivery_content: deliveryContent || null,
  });
  if (error) throw error;
  return data;
}

const PUBLIC_PRODUCT_COLS = 'id, seller_id, created_by_admin, title, description, price_slon, image_url, category, is_digital, status, created_at';

async function listApproved({ category, search, limit = 40, offset = 0 } = {}) {
  const supabase = getSupabase();
  let query = supabase
    .from('marketplace_products')
    .select(PUBLIC_PRODUCT_COLS)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (category) query = query.eq('category', category);
  if (search) query = query.ilike('title', `%${search}%`);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function getProduct(productId) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('marketplace_products').select(PUBLIC_PRODUCT_COLS).eq('id', productId).maybeSingle();
  if (error) throw error;
  return data;
}

async function listMine(sellerId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('marketplace_products')
    .select('*')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

async function listMyPurchases(buyerId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('marketplace_orders')
    .select('*, marketplace_products(title, image_url)')
    .eq('buyer_id', buyerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

async function purchase(buyerId, productId) {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('purchase_product', {
    p_buyer_id: buyerId, p_product_id: productId,
  });
  if (error) throw error;
  return data;
}

// ---- Admin ----
async function listPending() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('marketplace_products')
    .select('*, users(display_user_id, name, email)')
    .eq('status', 'pending_review')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

async function review(productId, action, note) {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('admin_review_listing', {
    p_product_id: productId, p_action: action, p_admin_note: note || null,
  });
  if (error) throw error;
  return data;
}

async function setHidden(productId, hidden) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('marketplace_products')
    .update({ status: hidden ? 'hidden' : 'approved', updated_at: new Date().toISOString() })
    .eq('id', productId);
  if (error) throw error;
}

module.exports = {
  createListing, listApproved, getProduct, listMine, listMyPurchases, purchase,
  listPending, review, setHidden,
};
