/**
 * Vilue — friends repository
 */

const { getSupabase } = require('./supabaseClient');

const PUBLIC_USER_COLS = 'id, display_user_id, name, verification_badge, is_admin, is_owner';

async function findPairRequest(userA, userB) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('friend_requests')
    .select('*')
    .or(`and(sender_id.eq.${userA},receiver_id.eq.${userB}),and(sender_id.eq.${userB},receiver_id.eq.${userA})`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function createRequest(senderId, receiverId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('friend_requests')
    .insert({ sender_id: senderId, receiver_id: receiverId, status: 'pending' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getRequestById(requestId) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('friend_requests').select('*').eq('id', requestId).maybeSingle();
  if (error) throw error;
  return data;
}

async function setRequestStatus(requestId, status) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('friend_requests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', requestId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteRequest(requestId) {
  const supabase = getSupabase();
  const { error } = await supabase.from('friend_requests').delete().eq('id', requestId);
  if (error) throw error;
}

async function getIncoming(userId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('friend_requests')
    .select(`id, created_at, sender:users!friend_requests_sender_id_fkey(${PUBLIC_USER_COLS})`)
    .eq('receiver_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

async function getOutgoing(userId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('friend_requests')
    .select(`id, created_at, receiver:users!friend_requests_receiver_id_fkey(${PUBLIC_USER_COLS})`)
    .eq('sender_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

async function listFriends(userId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('friend_requests')
    .select(`
      id, sender_id, receiver_id,
      sender:users!friend_requests_sender_id_fkey(${PUBLIC_USER_COLS}),
      receiver:users!friend_requests_receiver_id_fkey(${PUBLIC_USER_COLS})
    `)
    .eq('status', 'accepted')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
  if (error) throw error;

  return (data || []).map((row) => (row.sender_id === userId ? row.receiver : row.sender));
}

async function findAcceptedPair(userA, userB) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('friend_requests')
    .select('*')
    .eq('status', 'accepted')
    .or(`and(sender_id.eq.${userA},receiver_id.eq.${userB}),and(sender_id.eq.${userB},receiver_id.eq.${userA})`)
    .maybeSingle();
  if (error) throw error;
  return data;
}

module.exports = {
  findPairRequest, createRequest, getRequestById, setRequestStatus, deleteRequest,
  getIncoming, getOutgoing, listFriends, findAcceptedPair,
};
