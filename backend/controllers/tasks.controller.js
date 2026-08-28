/**
 * Vilue — tasks controller
 * "المهام" — Telegram channel-join campaigns. A user reserves the full
 * reward budget up front; funds only leave the reserve as real joins
 * happen (via the Telegram webhook), and unused reserve is refundable
 * any time via cancel.
 */

const tasksRepo = require('../database/tasks.repo');
const usersRepo = require('../database/users.repo');

async function create(req, res) {
  try {
    const { channelUsername, rewardPerJoin, targetJoins } = req.body;
    const reward = Number(rewardPerJoin);
    const target = Number(targetJoins);

    if (!channelUsername || !/^@[\w\d_]{5,32}$/.test(channelUsername.trim())) {
      return res.status(400).json({ code: 'INVALID_CHANNEL', message: 'Channel must look like @channelname' });
    }
    if (!reward || reward < 40) {
      return res.status(400).json({ code: 'REWARD_TOO_LOW', message: 'Reward must be at least 40 SLON per join' });
    }
    if (!target || target < 1000 || target > 100000) {
      return res.status(400).json({ code: 'INVALID_TARGET', message: 'Target must be between 1,000 and 100,000' });
    }

    const user = await usersRepo.findById(req.userId);
    if (!user.telegram_user_id) {
      return res.status(400).json({ code: 'TELEGRAM_NOT_LINKED', message: 'Link your Telegram account first' });
    }

    const task = await tasksRepo.createTask(req.userId, channelUsername.trim(), reward, target);
    return res.status(201).json({ task });
  } catch (err) {
    const dbCode = (err.message || '').match(/INSUFFICIENT_BALANCE|WALLET_NOT_FOUND|REWARD_TOO_LOW|INVALID_TARGET/);
    if (dbCode) return res.status(400).json({ code: dbCode[0], message: dbCode[0] });
    return res.status(500).json({ code: 'CREATE_FAILED', message: err.message });
  }
}

async function mine(req, res) {
  try {
    const tasks = await tasksRepo.listMine(req.userId);
    return res.status(200).json({ tasks });
  } catch (err) {
    return res.status(500).json({ code: 'FETCH_FAILED', message: err.message });
  }
}

async function browse(req, res) {
  try {
    const tasks = await tasksRepo.listActive();
    return res.status(200).json({ tasks });
  } catch (err) {
    return res.status(500).json({ code: 'FETCH_FAILED', message: err.message });
  }
}

async function cancel(req, res) {
  try {
    const task = await tasksRepo.cancelTask(req.userId, req.params.taskId);
    return res.status(200).json({ task });
  } catch (err) {
    const dbCode = (err.message || '').match(/TASK_NOT_FOUND|TASK_NOT_CANCELLABLE/);
    if (dbCode) return res.status(400).json({ code: dbCode[0], message: dbCode[0] });
    return res.status(500).json({ code: 'CANCEL_FAILED', message: err.message });
  }
}

// ---- Admin ----
async function adminListPending(req, res) {
  try {
    const tasks = await tasksRepo.listPending();
    return res.status(200).json({ tasks });
  } catch (err) {
    return res.status(500).json({ code: 'FETCH_FAILED', message: err.message });
  }
}

async function adminReview(req, res) {
  try {
    const { action, note } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ code: 'INVALID_ACTION', message: 'action must be approve or reject' });
    }
    const task = await tasksRepo.review(req.params.taskId, action, note);
    return res.status(200).json({ task });
  } catch (err) {
    return res.status(500).json({ code: 'REVIEW_FAILED', message: err.message });
  }
}

module.exports = { create, mine, browse, cancel, adminListPending, adminReview };
