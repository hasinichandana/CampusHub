const User = require('../models/User');
const Department = require('../models/Department');
const mongoose = require('mongoose');
const generateToken = require('../utils/generateToken');
const { logActivity } = require('../utils/activityLogger');
const AuthChallenge = require('../models/AuthChallenge');
const { createAndSendChallenge, consumeChallenge, purposes } = require('../utils/authChallenges');

const isValidEmail = (email) => typeof email === 'string'
  && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

const passwordIsValid = (password) => typeof password === 'string'
  && password.length >= 8
  && password.length <= 128;

const sendAuthenticationResponse = async (user, req, res) => {
  const userProfile = await User.findById(user._id)
    .select('-password')
    .populate('departmentId', 'name code');
  const token = generateToken(user._id, user.authTokenVersion || 0);

  await logActivity({
    req,
    userId: user._id,
    action: 'LOGIN',
    module: 'AUTH',
    entityType: 'User',
    entityId: user._id,
    description: `User ${user.name} logged in successfully`,
    metadata: { role: user.role, email: user.email }
  });

  return res.status(200).json({
    success: true,
    message: 'Login successful',
    data: { user: userProfile, token }
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res, next) => {
  try {
    const { name, email, password, departmentId, phone } = req.body;

    // Basic Validation
    if (!name || !isValidEmail(email) || !passwordIsValid(password)) {
      return res.status(400).json({
        success: false,
        message: 'Provide a name, valid email address, and password of at least 8 characters'
      });
    }

    if (!departmentId) {
      return res.status(400).json({
        success: false,
        message: 'Department is required for student registration'
      });
    }

    // Verify department exists if provided
    if (!mongoose.isValidObjectId(departmentId)) {
      return res.status(400).json({ success: false, message: 'Select a valid department' });
    }
    const deptExists = await Department.findById(departmentId);
    if (!deptExists || deptExists.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Specified department does not exist or is inactive'
      });
    }

    // Check for existing user
    const normalizedEmail = email.trim().toLowerCase();
    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create User (Pre-save hook will hash password)
    const user = await User.create({
      name,
      email: normalizedEmail,
      password,
      role: 'student',
      departmentId,
      phone: phone || '',
      status: 'active',
      emailVerified: false
    });

    let challenge;
    try {
      challenge = await createAndSendChallenge(user, purposes.emailVerification);
    } catch (error) {
      await User.findByIdAndDelete(user._id);
      throw error;
    }

    // Audit Activity Log
    await logActivity({
      req,
      userId: user._id,
      action: 'CREATE',
      module: 'AUTH',
      entityType: 'User',
      entityId: user._id,
      description: 'Student account registered; email verification pending',
      metadata: { role: user.role, email: user.email }
    });

    res.status(201).json({
      success: true,
      message: 'Account created. Enter the verification code sent to your email.',
      data: { challengeId: challenge._id.toString(), email: user.email }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Authenticate user & get token (Login)
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate email & password presence
    if (!isValidEmail(email) || typeof password !== 'string' || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Check for user and explicitly include password for comparison
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check account status
    if (user.status === 'inactive') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact the administrator.'
      });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        needsEmailVerification: true,
        email: user.email,
        message: 'Verify your email before signing in.'
      });
    }

    if (user.twoFactorEnabled) {
      const challenge = await createAndSendChallenge(user, purposes.twoFactorLogin);
      return res.status(200).json({
        success: true,
        requiresTwoFactor: true,
        message: 'A sign-in code was sent to your email.',
        data: { challengeId: challenge._id.toString(), email: user.email }
      });
    }

    return sendAuthenticationResponse(user, req, res);
  } catch (error) {
    next(error);
  }
};

const getRegistrationDepartments = async (req, res, next) => {
  try {
    const departments = await Department.find({ status: 'active' }).select('name code').sort({ name: 1 });
    res.status(200).json({ success: true, data: departments });
  } catch (error) {
    next(error);
  }
};

const verifyEmail = async (req, res, next) => {
  try {
    const { challengeId, code } = req.body;
    if (!mongoose.isValidObjectId(challengeId)) {
      return res.status(400).json({ success: false, message: 'Verification code is invalid or expired.' });
    }
    const challenge = await AuthChallenge.findOne({
      _id: challengeId,
      purpose: purposes.emailVerification,
      consumedAt: null,
      expiresAt: { $gt: new Date() }
    });

    if (!challenge) {
      return res.status(400).json({ success: false, message: 'Verification code is invalid or expired.' });
    }
    const valid = await consumeChallenge({
      challengeId,
      userId: challenge.userId,
      purpose: purposes.emailVerification,
      code
    });
    if (!valid) {
      return res.status(400).json({ success: false, message: 'Verification code is invalid or expired.' });
    }

    const user = await User.findByIdAndUpdate(challenge.userId, { emailVerified: true }, { new: true });
    if (!user || user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'This account cannot be activated.' });
    }

    await logActivity({
      req,
      userId: user._id,
      action: 'VERIFY_EMAIL',
      module: 'AUTH',
      entityType: 'User',
      entityId: user._id,
      description: 'User verified email address'
    });

    return sendAuthenticationResponse(user, req, res);
  } catch (error) {
    next(error);
  }
};

const resendEmailVerification = async (req, res, next) => {
  try {
    const normalizedEmail = String(req.body.email || '').trim().toLowerCase();
    let challengeId = new mongoose.Types.ObjectId().toString();
    if (isValidEmail(normalizedEmail)) {
      const user = await User.findOne({ email: normalizedEmail, emailVerified: false });
      if (user) {
        const challenge = await createAndSendChallenge(user, purposes.emailVerification);
        challengeId = challenge._id.toString();
      }
    }
    res.status(200).json({
      success: true,
      message: 'If this address has an unverified account, a new code has been sent.',
      data: { challengeId }
    });
  } catch (error) {
    next(error);
  }
};

const requestPasswordReset = async (req, res, next) => {
  try {
    const normalizedEmail = String(req.body.email || '').trim().toLowerCase();
    let challengeId = new mongoose.Types.ObjectId().toString();
    if (isValidEmail(normalizedEmail)) {
      const user = await User.findOne({ email: normalizedEmail, status: 'active' });
      if (user) {
        const challenge = await createAndSendChallenge(user, purposes.passwordReset);
        challengeId = challenge._id.toString();
      }
    }
    res.status(200).json({
      success: true,
      message: 'If an active account uses that email, a password reset code has been sent.',
      data: { challengeId }
    });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { email, challengeId, code, password } = req.body;
    if (!isValidEmail(email) || !passwordIsValid(password) || !mongoose.isValidObjectId(challengeId)) {
      return res.status(400).json({
        success: false,
        message: 'Provide a valid email address and a new password of at least 8 characters.'
      });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase(), status: 'active' });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Reset code is invalid or expired.' });
    }
    const valid = await consumeChallenge({
      challengeId,
      userId: user._id,
      purpose: purposes.passwordReset,
      code
    });
    if (!valid) {
      return res.status(400).json({ success: false, message: 'Reset code is invalid or expired.' });
    }

    user.password = password;
    user.authTokenVersion = (user.authTokenVersion || 0) + 1;
    await user.save();
    await AuthChallenge.updateMany(
      {
        userId: user._id,
        purpose: { $in: [purposes.passwordReset, purposes.twoFactorLogin] },
        consumedAt: null
      },
      { $set: { consumedAt: new Date() } }
    );
    await logActivity({
      req,
      userId: user._id,
      action: 'PASSWORD_RESET',
      module: 'AUTH',
      entityType: 'User',
      entityId: user._id,
      description: 'User reset password using email verification'
    });
    res.status(200).json({ success: true, message: 'Password reset successfully. You can now sign in.' });
  } catch (error) {
    next(error);
  }
};

const verifyTwoFactorLogin = async (req, res, next) => {
  try {
    const { challengeId, code } = req.body;
    if (!mongoose.isValidObjectId(challengeId)) {
      return res.status(400).json({ success: false, message: 'Sign-in code is invalid or expired.' });
    }
    const challenge = await AuthChallenge.findOne({
      _id: challengeId,
      purpose: purposes.twoFactorLogin,
      consumedAt: null,
      expiresAt: { $gt: new Date() }
    });
    if (!challenge) {
      return res.status(400).json({ success: false, message: 'Sign-in code is invalid or expired.' });
    }
    const valid = await consumeChallenge({
      challengeId,
      userId: challenge.userId,
      purpose: purposes.twoFactorLogin,
      code
    });
    if (!valid) {
      return res.status(400).json({ success: false, message: 'Sign-in code is invalid or expired.' });
    }

    const user = await User.findById(challenge.userId);
    if (!user || user.status !== 'active' || !user.emailVerified || !user.twoFactorEnabled) {
      return res.status(403).json({ success: false, message: 'This account cannot sign in.' });
    }
    return sendAuthenticationResponse(user, req, res);
  } catch (error) {
    next(error);
  }
};

const beginTwoFactorSetup = async (req, res, next) => {
  try {
    const { password } = req.body;
    const user = await User.findById(req.user._id).select('+password');
    if (!user || !(await user.matchPassword(password || ''))) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }
    if (user.twoFactorEnabled) {
      return res.status(400).json({ success: false, message: 'Two-step sign-in is already enabled.' });
    }

    const challenge = await createAndSendChallenge(user, purposes.twoFactorSetup);
    res.status(200).json({
      success: true,
      message: 'A confirmation code was sent to your email.',
      data: { challengeId: challenge._id.toString() }
    });
  } catch (error) {
    next(error);
  }
};

const confirmTwoFactorSetup = async (req, res, next) => {
  try {
    const { challengeId, code } = req.body;
    if (!mongoose.isValidObjectId(challengeId)) {
      return res.status(400).json({ success: false, message: 'Confirmation code is invalid or expired.' });
    }
    const valid = await consumeChallenge({
      challengeId,
      userId: req.user._id,
      purpose: purposes.twoFactorSetup,
      code
    });
    if (!valid) {
      return res.status(400).json({ success: false, message: 'Confirmation code is invalid or expired.' });
    }

    await User.findByIdAndUpdate(req.user._id, { twoFactorEnabled: true });
    await AuthChallenge.updateMany(
      { userId: req.user._id, purpose: purposes.twoFactorSetup, consumedAt: null },
      { $set: { consumedAt: new Date() } }
    );
    res.status(200).json({ success: true, message: 'Two-step sign-in is enabled.' });
  } catch (error) {
    next(error);
  }
};

const disableTwoFactor = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('+password');
    if (!user || !(await user.matchPassword(req.body.password || ''))) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }
    user.twoFactorEnabled = false;
    await user.save();
    await AuthChallenge.updateMany(
      { userId: user._id, purpose: purposes.twoFactorLogin, consumedAt: null },
      { $set: { consumedAt: new Date() } }
    );
    res.status(200).json({ success: true, message: 'Two-step sign-in is disabled.' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user profile
// @route   GET /api/auth/me
// @access  Private (Protected)
const getMe = async (req, res, next) => {
  try {
    // req.user is populated by protect middleware
    res.status(200).json({
      success: true,
      message: 'User profile retrieved successfully',
      data: {
        user: req.user
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user / clear token
// @route   POST /api/auth/logout
// @access  Public
const logoutUser = async (req, res, next) => {
  try {
    if (req.user) {
      await logActivity({
        req,
        userId: req.user._id,
        action: 'LOGOUT',
        module: 'AUTH',
        entityType: 'User',
        entityId: req.user._id,
        description: `User ${req.user.name} logged out`
      });
    }

    res.status(200).json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
};
