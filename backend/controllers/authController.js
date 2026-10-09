const User = require('../models/User');
const Department = require('../models/Department');
const generateToken = require('../utils/generateToken');
const { logActivity } = require('../utils/activityLogger');

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res, next) => {
  try {
    const { name, email, password, role, departmentId, phone } = req.body;

    // Basic Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password'
      });
    }

    const assignedRole = role || 'student';

    // Department required for student and faculty
    if ((assignedRole === 'student' || assignedRole === 'faculty') && !departmentId) {
      return res.status(400).json({
        success: false,
        message: 'Department is required for students and faculty members'
      });
    }

    // Verify department exists if provided
    if (departmentId) {
      const deptExists = await Department.findById(departmentId);
      if (!deptExists) {
        return res.status(404).json({
          success: false,
          message: 'Specified department does not exist'
        });
      }
    }

    // Check for existing user
    const userExists = await User.findOne({ email: email.toLowerCase() });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create User (Pre-save hook will hash password)
    const user = await User.create({
      name,
      email,
      password,
      role: assignedRole,
      departmentId: departmentId || undefined,
      phone: phone || '',
      status: 'active'
    });

    // Populate department info for response
    const populatedUser = await User.findById(user._id)
      .select('-password')
      .populate('departmentId', 'name code');

    const token = generateToken(user._id);

    // Audit Activity Log
    await logActivity({
      req,
      userId: user._id,
      action: 'CREATE',
      module: 'AUTH',
      entityType: 'User',
      entityId: user._id,
      description: `User registered with role ${assignedRole}`,
      metadata: { role: assignedRole, email: user.email }
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: populatedUser,
        token
      }
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
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Check for user and explicitly include password for comparison
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

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

    // Fetch user without password, populated with department details
    const userProfile = await User.findById(user._id)
      .select('-password')
      .populate('departmentId', 'name code');

    const token = generateToken(user._id);

    // Audit Activity Log
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

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: userProfile,
        token
      }
    });
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
  getMe,
  logoutUser
};
