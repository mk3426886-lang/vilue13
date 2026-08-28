const { getSupabase } = require('./supabaseClient');

async function createTask(creatorId, channelUsername, rewardPerJoin, targetJoins) {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('create_task', {
    p_creator_id: creatorId, p_channel_username: channelUsername,
    p_reward_per_join: rewardPerJoin, p_target_joins: targetJoins,
  });
  if (error) throw error;
  return data;
}

async function listMine(creatorId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('tasks').select('*').eq('creator_id', creatorId).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

async function listActive(limit = 40) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('tasks')
    .select('id, channel_username, reward_per_join_slon, target_joins, joins_count, created_at')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

async function getById(taskId) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('tasks').select('*').eq('id', taskId).maybeSingle();
  if (error) throw error;
  return data;
}

async function findActiveByChannel(channelUsername) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('channel_username', channelUsername)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function cancelTask(userId, taskId) {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('cancel_task', { p_user_id: userId, p_task_id: taskId });
  if (error) throw error;
  return data;
}

async function processJoin(taskId, userId, telegramUserId) {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('process_task_join', {
    p_task_id: taskId, p_user_id: userId, p_telegram_user_id: telegramUserId,
  });
  if (error) throw error;
  return data;
}

async function processLeave(taskId, userId) {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('process_task_leave', { p_task_id: taskId, p_user_id: userId });
  if (error) throw error;
  return data;
}

async function findParticipant(taskId, userId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('task_participants').select('*').eq('task_id', taskId).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

// ---- Admin ----
async function listPending() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('tasks')
    .select('*, users(display_user_id, name, email)')
    .eq('status', 'pending_review')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

async function review(taskId, action, note) {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('admin_review_task', {
    p_task_id: taskId, p_action: action, p_admin_note: note || null,
  });
  if (error) throw error;
  return data;
}

module.exports = {
  createTask, listMine, listActive, getById, findActiveByChannel, cancelTask,
  processJoin, processLeave, findParticipant, listPending, review,
};
