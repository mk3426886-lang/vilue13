/**
 * Vilue — notifications repository
 * user_id = null means "broadcast to everyone" (admin-sent).
 */

const { getSupabase } = require('./supabaseClient');

async function listForUser(userId, limit = 50) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

async function countUnread(userId) {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .or(`user_id.eq.${userId},user_id.is.null`)
    .eq('is_read', false);
  if (error) throw error;
  return count || 0;
}

async function markRead(notificationId) {
  const supabase = getSupabase();
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
  if (error) throw error;
}

async function markAllRead(userId) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .or(`user_id.eq.${userId},user_id.is.null`);
  if (error) throw error;
}

async function create({ userId, title, body, type }) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('notifications')
    .insert({ user_id: userId || null, title, body: body || null, type: type || 'info' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

module.exports = { listForUser, countUnread, markRead, markAllRead, create };
