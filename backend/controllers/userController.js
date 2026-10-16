const User = require('../models/User');
const { parsePagination } = require('../utils/queryFilters');

// @desc    Get user directory (Admin: all, Faculty: own dept only, Student: forbidden)
// @route   GET /api/users
// @access  Private (Admin, Faculty)
const getUsers = async (req, res, next) => {
  try {
    if (req.user.role === 'student') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Students cannot access user directory'
      });
    }

    const { q, search, role, departmentId, status, page, limit } = req.query;
    let query = {};

    // Faculty department isolation
    if (req.user.role === 'faculty') {
      const facultyDeptId = req.user.departmentId?._id || req.user.departmentId;
      query.departmentId = facultyDeptId;
    } else if (req.user.role === 'admin') {
      if (departmentId) {
        query.departmentId = departmentId;
      }
    }

    if (role) query.role = role;
    if (status) query.status = status;

    const searchTerm = q || search;
    if (searchTerm) {
      query.$or = [
        { name: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } }
      ];
    }

    const pagination = parsePagination(page, limit);
    if (!pagination) {
      return res.status(400).json({ success: false, message: 'page must be positive and limit must be between 1 and 100' });
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select('-password')
      .populate('departmentId', 'name code')
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit);

    res.status(200).json({
      success: true,
      count: users.length,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit) || 1
      },
      data: users
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers
};
