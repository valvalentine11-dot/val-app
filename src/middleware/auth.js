const jwt = require('jsonwebtoken');
const User = require('../models/User');

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

// Requires a valid, non-expired JWT. Attaches req.user.
async function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ message: 'Authentication required. Provide a Bearer token.' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'User for this token no longer exists.' });
    }
    req.user = user;
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired. Please log in again.' });
    }
    return res.status(401).json({ message: 'Invalid token.' });
  }
}

// Does not fail if there's no/invalid token, but attaches req.user if valid.
async function optionalAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) return next();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (user) req.user = user;
    return next();
  } catch (err) {
    return next();
  }
}

module.exports = { requireAuth, optionalAuth };
