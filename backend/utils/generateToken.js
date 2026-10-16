const jwt = require('jsonwebtoken');

const generateToken = (userId, tokenVersion = 0) => {
  return jwt.sign(
    { id: userId, tokenVersion },
    process.env.JWT_SECRET || 'campushub_jwt_secret_key_2026_super_secure',
    {
      expiresIn: process.env.JWT_EXPIRE || '30d'
    }
  );
};

module.exports = generateToken;
