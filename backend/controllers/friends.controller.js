/**
 * Vilue — friends controller
 * Friends are added by the recipient's 12-digit public ID, matching
 * the app's identity model (no username).
 */

const friendsRepo = require('../database/friends.repo');
const usersRepo = require('../database/users.repo');

function toPublicFriend(u) {
  if (!u) return null;
  return {
    id: u.id,
    userId: u.display_user_id,
    name: u.name,
    verificationBadge: u.is_owner ? 'owner' : (u.is_admin ? 'admin' : u.verification_badge),
  };
}

async function sendRequest(req, res) {
  try {
    const { receiverId } = req.body; // 12-digit display id
    if (!receiverId || !/^\d{6,12}$/.test(receiverId.trim())) {
      return res.status(400).json({ code: 'INVALID_RECEIVER_ID', message: 'Invalid receiver ID' });
    }

    const receiver = await usersRepo.findByDisplayId(receiverId.trim());
    if (!receiver) {
      return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'No user with that ID' });
    }
    if (receiver.id === req.userId) {
      return res.status(400).json({ code: 'CANNOT_ADD_SELF', message: 'You cannot add yourself' });
    }
    if (!receiver.allow_friend_requests) {
      return res.status(403).json({ code: 'REQUESTS_DISABLED', message: 'This user is not accepting friend requests' });
    }

    const existing = await friendsRepo.findPairRequest(req.userId, receiver.id);
    if (existing) {
      if (existing.status === 'accepted') {
        return res.status(409).json({ code: 'ALREADY_FRIENDS', message: 'Already friends' });
      }
      if (existing.status === 'pending') {
        return res.status(409).json({ code: 'REQUEST_ALREADY_PENDING', message: 'A request is already pending' });
      }
      // status === 'rejected' — allow sending a new one, clear the old row.
      await friendsRepo.deleteRequest(existing.id);
    }

    const request = await friendsRepo.createRequest(req.userId, receiver.id);
    return res.status(201).json({ request });
  } catch (err) {
    return res.status(500).json({ code: 'REQUEST_FAILED', message: err.message });
  }
}

async function listIncoming(req, res) {
  try {
    const rows = await friendsRepo.getIncoming(req.userId);
    return res.status(200).json({
      requests: rows.map((r) => ({ id: r.id, createdAt: r.created_at, user: toPublicFriend(r.sender) })),
    });
  } catch (err) {
    return res.status(500).json({ code: 'FETCH_FAILED', message: err.message });
  }
}

async function listOutgoing(req, res) {
  try {
    const rows = await friendsRepo.getOutgoing(req.userId);
    return res.status(200).json({
      requests: rows.map((r) => ({ id: r.id, createdAt: r.created_at, user: toPublicFriend(r.receiver) })),
    });
  } catch (err) {
    return res.status(500).json({ code: 'FETCH_FAILED', message: err.message });
  }
}

async function listFriends(req, res) {
  try {
    const rows = await friendsRepo.listFriends(req.userId);
    return res.status(200).json({ friends: rows.map(toPublicFriend) });
  } catch (err) {
    return res.status(500).json({ code: 'FETCH_FAILED', message: err.message });
  }
}

async function respond(req, res) {
  try {
    const { requestId } = req.params;
    const { action } = req.body; // 'accept' | 'reject'
    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ code: 'INVALID_ACTION', message: 'action must be accept or reject' });
    }

    const request = await friendsRepo.getRequestById(requestId);
    if (!request || request.receiver_id !== req.userId) {
      return res.status(404).json({ code: 'REQUEST_NOT_FOUND', message: 'Request not found' });
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ code: 'REQUEST_NOT_PENDING', message: 'Request already handled' });
    }

    const updated = await friendsRepo.setRequestStatus(requestId, action === 'accept' ? 'accepted' : 'rejected');
    return res.status(200).json({ request: updated });
  } catch (err) {
    return res.status(500).json({ code: 'RESPOND_FAILED', message: err.message });
  }
}

async function removeFriend(req, res) {
  try {
    const { friendId } = req.params; // the friend's internal uuid
    const existing = await friendsRepo.findAcceptedPair(req.userId, friendId);
    if (!existing) {
      return res.status(404).json({ code: 'NOT_FRIENDS', message: 'You are not friends with this user' });
    }
    await friendsRepo.deleteRequest(existing.id);
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ code: 'REMOVE_FAILED', message: err.message });
  }
}

module.exports = { sendRequest, listIncoming, listOutgoing, listFriends, respond, removeFriend };
