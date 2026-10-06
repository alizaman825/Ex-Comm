const User = require('../models/User');
const AppError = require('../utils/AppError');
const { COOKIE_NAME, verifyToken } = require('../utils/token');

function readToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  return req.cookies?.[COOKIE_NAME];
}

// Requires a valid JWT (httpOnly cookie or Bearer header); sets req.user.
async function requireAuth(req, _res, next) {
  try {
    const token = readToken(req);
    if (!token) throw new AppError(401, 'Authentication required');
    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw new AppError(401, 'Invalid or expired session');
    }
    const user = await User.findById(payload.sub);
    if (!user) throw new AppError(401, 'Account no longer exists');
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

// Sets req.user when a valid session is present, but never rejects the request.
async function optionalAuth(req, _res, next) {
  try {
    const token = readToken(req);
    if (token) {
      const payload = verifyToken(token);
      req.user = (await User.findById(payload.sub)) || undefined;
    }
  } catch {
    /* invalid token: treat as signed out */
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
