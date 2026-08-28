/**
 * Vilue — auth middleware
 * Verifies the JWT issued at login/verify and attaches req.userId.
 * Any route that needs "who is the logged-in user" uses this.
 */

const jwt = require('jsonwebtoken');
const usersRepo = require('../database/users.repo');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ code: 'NO_TOKEN', message: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Single-device enforcement: this token's session id must still be
    // the account's current active one — otherwise it was logged in
    // elsewhere (or logged out) since this token was issued.
    const state = await usersRepo.getSessionState(payload.sub);
    if (!state || state.active_session_id !== payload.jti) {
      return res.status(401).json({ code: 'SESSION_INVALIDATED', message: 'Logged in from another device' });
    }
    if (state.is_suspended) {
      return res.status(403).json({ code: 'ACCOUNT_SUSPENDED', message: 'Account suspended' });
    }

    req.userId = payload.sub;
    req.isAdmin = !!payload.isAdmin;
    req.isOwner = !!payload.isOwner;
    next();
  } catch (err) {
    return res.status(401).json({ code: 'INVALID_TOKEN', message: 'Invalid or expired session' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.isAdmin) {
    return res.status(403).json({ code: 'ADMIN_REQUIRED', message: 'Admin access required' });
  }
  next();
}

function requireOwner(req, res, next) {
  if (!req.isOwner) {
    return res.status(403).json({ code: 'OWNER_REQUIRED', message: 'Owner access required' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, requireOwner };
