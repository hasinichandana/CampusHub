const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  getRegistrationDepartments,
  verifyEmail,
  resendEmailVerification,
  requestPasswordReset,
  resetPassword,
  verifyTwoFactorLogin,
  beginTwoFactorSetup,
  confirmTwoFactorSetup,
  disableTwoFactor,
  getMe,
  logoutUser
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.get('/departments', getRegistrationDepartments);
router.post('/register', registerUser);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendEmailVerification);
router.post('/login', loginUser);
router.post('/login/verify-otp', verifyTwoFactorLogin);
router.post('/forgot-password', requestPasswordReset);
router.post('/reset-password', resetPassword);
router.post('/two-factor/setup', protect, beginTwoFactorSetup);
router.post('/two-factor/enable', protect, confirmTwoFactorSetup);
router.post('/two-factor/disable', protect, disableTwoFactor);
router.get('/me', protect, getMe);
router.post('/logout', logoutUser);

module.exports = router;
