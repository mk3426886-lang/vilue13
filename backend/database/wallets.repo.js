/**
 * Vilue — wallets repository
 * Balance reads are plain queries; every balance CHANGE goes through a
 * Postgres function (see wallet_functions.sql) via supabase.rpc() so the
 * change is atomic — never a raw update() on balance_slon from here.
 */

const { getSupabase } = require('./supabaseClient');

async function createWallet(userId) {
  const supabase = getSupabase();
  const { error } = await supabase.from('wallets').insert({ user_id: userId, balance_slon: 0 });
  if (error) throw error;
}

async function getWallet(userId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getTransactions(userId, limit = 50) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

async function requestDeposit(userId, amountSlon, method, meta) {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('request_deposit', {
    p_user_id: userId, p_amount_slon: amountSlon, p_method: method, p_meta: meta || {},
  });
  if (error) throw error;
  return data;
}

async function requestWithdrawal(userId, amountSlon, method, meta) {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('request_withdrawal', {
    p_user_id: userId, p_amount_slon: amountSlon, p_method: method, p_meta: meta || {},
  });
  if (error) throw error;
  return data;
}

async function cancelWithdrawal(userId, transactionId) {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('cancel_withdrawal', {
    p_user_id: userId, p_transaction_id: transactionId,
  });
  if (error) throw error;
  return data;
}

async function transferSlon(senderId, receiverDisplayId, amountSlon) {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('transfer_slon', {
    p_sender_id: senderId, p_receiver_display_id: receiverDisplayId, p_amount_slon: amountSlon,
  });
  if (error) throw error;
  return data;
}

// ---- Admin ----
async function listPendingDeposits() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('*, users!wallet_transactions_user_id_fkey(display_user_id, name, email)')
    .eq('type', 'deposit').eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

async function listPendingWithdrawals() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('*, users!wallet_transactions_user_id_fkey(display_user_id, name, email)')
    .eq('type', 'withdrawal').eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

async function reviewDeposit(transactionId, action, adminNote) {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('admin_review_deposit', {
    p_transaction_id: transactionId, p_action: action, p_admin_note: adminNote || null,
  });
  if (error) throw error;
  return data;
}

async function reviewWithdrawal(transactionId, action, adminNote) {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('admin_review_withdrawal', {
    p_transaction_id: transactionId, p_action: action, p_admin_note: adminNote || null,
  });
  if (error) throw error;
  return data;
}

module.exports = {
  createWallet, getWallet, getTransactions,
  requestDeposit, requestWithdrawal, cancelWithdrawal, transferSlon,
  listPendingDeposits, listPendingWithdrawals, reviewDeposit, reviewWithdrawal,
};
