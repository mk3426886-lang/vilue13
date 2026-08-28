/**
 * Vilue — verification codes repository
 * All `verification_codes` / `verification_code_sends` table access
 * goes through here — otp.service.js never calls Supabase directly.
 */

const { getSupabase } = require('./supabaseClient');

async function countRecentSends(userId, sinceIso) {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from('verification_code_sends')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('sent_at', sinceIso);

  if (error) throw error;
  return count || 0;
}

async function getLastSendTime(userId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('verification_code_sends')
    .select('sent_at')
    .eq('user_id', userId)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? new Date(data.sent_at) : null;
}

async function recordSend(userId) {
  const supabase = getSupabase();
  const { error } = await supabase.from('verification_code_sends').insert({ user_id: userId });
  if (error) throw error;
}

async function upsertCode(userId, codeHash, expiresAt) {
  const supabase = getSupabase();
  const { error } = await supabase.from('verification_codes').upsert({
    user_id: userId,
    code_hash: codeHash,
    attempts: 0,
    expires_at: expiresAt.toISOString(),
  });
  if (error) throw error;
}

async function getCode(userId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('verification_codes')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function incrementAttempts(userId, attempts) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('verification_codes')
    .update({ attempts })
    .eq('user_id', userId);
  if (error) throw error;
}

async function deleteCode(userId) {
  const supabase = getSupabase();
  const { error } = await supabase.from('verification_codes').delete().eq('user_id', userId);
  if (error) throw error;
}

module.exports = {
  countRecentSends, getLastSendTime, recordSend,
  upsertCode, getCode, incrementAttempts, deleteCode,
};
