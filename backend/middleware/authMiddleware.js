const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  // Check for Authorization header starting with "Bearer "
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Extract token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'campushub_jwt_secret_key_2026_super_secure'
      );

      // Get user from database excluding password field
      const authenticatedUser = await User.findById(decoded.id)
        .select('-password')
        .populate('departmentId', 'name code');

      if (!authenticatedUser) {
        return res.status(401).json({
          success: false,
          message: 'Not authorized, user account no longer exists'
        });
      }

      if ((decoded.tokenVersion || 0) !== authenticatedUser.authTokenVersion) {
        return res.status(401).json({
          success: false,
          message: 'Not authorized, session has been revoked'
        });
      }

      req.user = authenticatedUser;

      // Check account status
      if (req.user.status === 'inactive') {
        return res.status(403).json({
          success: false,
          message: 'Your account has been deactivated. Please contact the administrator.'
        });
      }

      next();
    } catch (error) {
      console.error('Authentication Middleware Error:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Not authorized, invalid or expired token'
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, token missing in request headers'
    });
  }
};

module.exports = { protect };
