const { getSupabase } = require('./supabaseClient');

async function create(userId, message) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('support_messages')
    .insert({ user_id: userId, message })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function listForUser(userId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('support_messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

async function listAll(status) {
  const supabase = getSupabase();
  let query = supabase
    .from('support_messages')
    .select('*, users(display_user_id, name, email)')
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function reply(messageId, adminReply) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('support_messages')
    .update({ admin_reply: adminReply, status: 'resolved', updated_at: new Date().toISOString() })
    .eq('id', messageId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

module.exports = { create, listForUser, listAll, reply };
