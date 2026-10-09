const User = require('../models/User');

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

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select('-password')
      .populate('departmentId', 'name code')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.status(200).json({
      success: true,
      count: users.length,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1
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
