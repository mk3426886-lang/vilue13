/**
 * Vilue — platform settings repository
 * Single-row settings table (fees, rates) + single-row platform wallet
 * (collected fees). Both are admin-editable via /admin routes.
 */

const { getSupabase } = require('./supabaseClient');

async function getSettings() {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('platform_settings').select('*').eq('id', true).maybeSingle();
  if (error) throw error;
  return data;
}

async function updateSettings(fields) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('platform_settings')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', true)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getPlatformWallet() {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('platform_wallet').select('*').eq('id', true).maybeSingle();
  if (error) throw error;
  return data;
}

async function getPublicSettings() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('platform_settings')
    .select('slon_per_iqd, usdt_to_iqd, news_ticker_text, promo_banner_text, promo_banner_image_url')
    .eq('id', true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

module.exports = { getSettings, updateSettings, getPlatformWallet, getPublicSettings };
