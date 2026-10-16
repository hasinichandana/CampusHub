const ActivityLog = require('../models/ActivityLog');
const { parsePagination } = require('../utils/queryFilters');

// @desc    Get system activity logs (Admin only)
// @route   GET /api/activity-logs
// @access  Private (Admin)
const getActivityLogs = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Admin access required to view activity logs'
      });
    }

    const { action, module, userId, entityType, dateFrom, dateTo, page, limit } = req.query;
    let query = {};

    if (action) query.action = action;
    if (module) query.module = module;
    if (userId) query.userId = userId;
    if (entityType) query.entityType = entityType;

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    const pagination = parsePagination(page, limit);
    if (!pagination) {
      return res.status(400).json({ success: false, message: 'page must be positive and limit must be between 1 and 100' });
    }

    const total = await ActivityLog.countDocuments(query);
    const logs = await ActivityLog.find(query)
      .populate('userId', 'name email role departmentId')
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit);

    res.status(200).json({
      success: true,
      count: logs.length,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit) || 1
      },
      data: logs
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single activity log detail (Admin only)
// @route   GET /api/activity-logs/:id
// @access  Private (Admin)
const getActivityLogById = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Admin access required to view activity logs'
      });
    }

    const log = await ActivityLog.findById(req.params.id)
      .populate('userId', 'name email role departmentId');

    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Activity log entry not found'
      });
    }

    res.status(200).json({
      success: true,
      data: log
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getActivityLogs,
  getActivityLogById
};
