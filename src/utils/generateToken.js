const jwt = require('jsonwebtoken');

function generateToken(user) {
  return jwt.sign(
    { id: user._id.toString(), username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
  );
}

module.exports = generateToken;
