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

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    // Genuine token problem (expired, malformed, bad signature) — this
    // really does mean the session is over, so the frontend should log
    // the person out.
    return res.status(401).json({ code: 'INVALID_TOKEN', message: 'Invalid or expired session' });
  }

  // Single-device enforcement: this token's session id must still be
  // the account's current active one — otherwise it was logged in
  // elsewhere (or logged out) since this token was issued.
  let state;
  try {
    state = await usersRepo.getSessionState(payload.sub);
  } catch (err) {
    // A DB/network hiccup while checking session state is NOT proof the
    // session was replaced — treating it as one used to force-log-out
    // people for reasons that had nothing to do with their actual
    // login. Fail this one request instead; the token stays valid so
    // the very next request can succeed normally.
    return res.status(503).json({ code: 'SESSION_CHECK_FAILED', message: 'تعذّر التحقق من الجلسة، حاول مرة أخرى' });
  }

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
