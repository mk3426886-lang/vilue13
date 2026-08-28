const { getSupabase } = require('./supabaseClient');

async function getConversation(userA, userB, limit = 100) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(`and(sender_id.eq.${userA},receiver_id.eq.${userB}),and(sender_id.eq.${userB},receiver_id.eq.${userA})`)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data;
}

async function sendText(senderId, receiverId, content) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('messages')
    .insert({ sender_id: senderId, receiver_id: receiverId, content })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function sendGift(senderId, receiverId, giftType, amountSlon) {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('send_gift', {
    p_sender_id: senderId, p_receiver_id: receiverId, p_gift_type: giftType, p_gift_value_slon: amountSlon,
  });
  if (error) throw error;
  return data;
}

module.exports = { getConversation, sendText, sendGift };
