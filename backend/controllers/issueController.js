const CampusIssue = require('../models/CampusIssue');
const User = require('../models/User');
const Department = require('../models/Department');
const { createNotification, notifyManyUsers } = require('../utils/notificationHelper');
const { logActivity } = require('../utils/activityLogger');

// Allowed status transitions mapping
const VALID_STATUS_TRANSITIONS = {
  Reported: ['Assigned', 'In Progress'],
  Assigned: ['In Progress'],
  'In Progress': ['Resolved'],
  Resolved: ['Closed', 'In Progress'],
  Closed: ['In Progress'] // Admin re-open if needed
};

// @desc    Create a new campus issue (Student)
// @route   POST /api/issues
// @access  Private (Student, Admin)
const createIssue = async (req, res, next) => {
  try {
    const { title, category, description, location } = req.body;

    if (!title || !category || !description || !location) {
      return res.status(400).json({
        success: false,
        message: 'Please provide title, category, description, and location'
      });
    }

    const userDeptId = req.user.departmentId?._id || req.user.departmentId;
    if (!userDeptId && req.user.role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Student must belong to a valid department to report an issue'
      });
    }

    let imagePath = '';
    if (req.file) {
      imagePath = `uploads/issues/${req.file.filename}`;
    }

    const issue = await CampusIssue.create({
      studentId: req.user._id,
      departmentId: userDeptId,
      title,
      category,
      description,
      location,
      image: imagePath,
      status: 'Reported'
    });

    const populatedIssue = await CampusIssue.findById(issue._id)
      .populate('studentId', 'name email phone')
      .populate('departmentId', 'name code');

    // Notification: Notify admins and department faculty
    const staffMembers = await User.find({
      $or: [
        { role: 'admin' },
        { role: 'faculty', departmentId: userDeptId }
      ]
    });
    const staffIds = staffMembers.map(s => s._id);
    await notifyManyUsers(staffIds, {
      type: 'ISSUE',
      title: 'New Campus Issue Reported',
      message: `${req.user.name} reported issue: "${title}".`,
      relatedEntityType: 'CampusIssue',
      relatedEntityId: issue._id
    });

    // Audit Activity Log
    await logActivity({
      req,
      action: 'CREATE',
      module: 'ISSUE',
      entityType: 'CampusIssue',
      entityId: issue._id,
      description: `Reported issue: "${title}"`
    });

    res.status(201).json({
      success: true,
      message: 'Campus issue reported successfully',
      data: populatedIssue
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get campus issues (Student: own issues, Faculty: assigned issues, Admin: all issues)
// @route   GET /api/issues
// @access  Private
const getIssues = async (req, res, next) => {
  try {
    let query = {};
    const { status, category, departmentId, assignedTo, q, search, page, limit } = req.query;

    if (req.user.role === 'student') {
      // Students can ONLY view their own issues
      query.studentId = req.user._id;
    } else if (req.user.role === 'faculty') {
      // Faculty can ONLY view issues assigned to them
      query.assignedTo = req.user._id;
    } else if (req.user.role === 'admin') {
      // Admin can filter by departmentId or assignedTo
      if (departmentId) query.departmentId = departmentId;
      if (assignedTo) query.assignedTo = assignedTo;
    }

    if (status) query.status = status;
    if (category) query.category = category;

    const searchTerm = q || search;
    if (searchTerm) {
      query.$or = [
        { title: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } }
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const total = await CampusIssue.countDocuments(query);
    const issues = await CampusIssue.find(query)
      .populate('studentId', 'name email phone')
      .populate('departmentId', 'name code')
      .populate('assignedTo', 'name email role phone')
      .populate('closedBy', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.status(200).json({
      success: true,
      count: issues.length,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1
      },
      data: issues
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single campus issue by ID
// @route   GET /api/issues/:id
// @access  Private
const getIssueById = async (req, res, next) => {
  try {
    const issue = await CampusIssue.findById(req.params.id)
      .populate('studentId', 'name email phone')
      .populate('departmentId', 'name code')
      .populate('assignedTo', 'name email role phone')
      .populate('closedBy', 'name email role');

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: 'Campus issue not found'
      });
    }

    // Role Access Checks
    if (req.user.role === 'student') {
      if (issue.studentId._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You cannot access another student\'s reported issue'
        });
      }
    } else if (req.user.role === 'faculty') {
      if (!issue.assignedTo || issue.assignedTo._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Faculty access restricted to issues assigned directly to you'
        });
      }
    }

    res.status(200).json({
      success: true,
      data: issue
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Assign or Reassign campus issue (Admin)
// @route   PATCH /api/issues/:id/assign
// @access  Private (Admin)
const assignIssue = async (req, res, next) => {
  try {
    const { assignedTo } = req.body;

    if (!assignedTo) {
      return res.status(400).json({
        success: false,
        message: 'Please provide assignedTo user ID'
      });
    }

    const facultyUser = await User.findById(assignedTo);
    if (!facultyUser || (facultyUser.role !== 'faculty' && facultyUser.role !== 'admin')) {
      return res.status(400).json({
        success: false,
        message: 'Issues can only be assigned to valid Faculty or Admin members'
      });
    }

    const issue = await CampusIssue.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({
        success: false,
        message: 'Campus issue not found'
      });
    }

    issue.assignedTo = assignedTo;
    issue.assignedAt = new Date();
    if (issue.status === 'Reported') {
      issue.status = 'Assigned';
    }

    await issue.save();

    const updatedIssue = await CampusIssue.findById(issue._id)
      .populate('studentId', 'name email phone')
      .populate('departmentId', 'name code')
      .populate('assignedTo', 'name email role phone');

    // Notification: Notify assigned faculty member
    await createNotification({
      recipientId: assignedTo,
      type: 'ISSUE',
      title: 'Campus Issue Assigned',
      message: `You have been assigned to campus issue: "${issue.title}".`,
      relatedEntityType: 'CampusIssue',
      relatedEntityId: issue._id
    });

    // Audit Activity Log
    await logActivity({
      req,
      action: 'ASSIGN',
      module: 'ISSUE',
      entityType: 'CampusIssue',
      entityId: issue._id,
      description: `Assigned issue to ${facultyUser.name}`
    });

    res.status(200).json({
      success: true,
      message: `Issue assigned to ${facultyUser.name} successfully`,
      data: updatedIssue
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update campus issue status & resolution remarks (Faculty assigned, Admin)
// @route   PATCH /api/issues/:id/status
// @access  Private (Faculty, Admin)
const updateIssueStatus = async (req, res, next) => {
  try {
    const { status, resolutionRemarks } = req.body;

    if (!status || !['Reported', 'Assigned', 'In Progress', 'Resolved', 'Closed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid issue status (\'In Progress\', \'Resolved\', or \'Closed\')'
      });
    }

    const issue = await CampusIssue.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({
        success: false,
        message: 'Campus issue not found'
      });
    }

    // Role Authorization Checks
    if (req.user.role === 'student') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Students are not authorized to update issue status'
      });
    }

    // Faculty Access Check: Must be assigned to this issue
    if (req.user.role === 'faculty') {
      if (!issue.assignedTo || issue.assignedTo.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You can only update issues assigned to you'
        });
      }
    }

    // Validate Status Transition
    const allowedNextStatuses = VALID_STATUS_TRANSITIONS[issue.status] || [];
    if (!allowedNextStatuses.includes(status) && issue.status !== status) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from '${issue.status}' to '${status}'. Allowed transitions from '${issue.status}': [${allowedNextStatuses.join(', ')}]`
      });
    }

    issue.status = status;
    if (resolutionRemarks !== undefined) {
      issue.resolutionRemarks = resolutionRemarks;
    }

    if (status === 'Resolved') {
      issue.resolvedAt = new Date();
    } else if (status === 'Closed') {
      issue.closedAt = new Date();
      issue.closedBy = req.user._id;
    }

    await issue.save();

    const updatedIssue = await CampusIssue.findById(issue._id)
      .populate('studentId', 'name email phone')
      .populate('departmentId', 'name code')
      .populate('assignedTo', 'name email role phone')
      .populate('closedBy', 'name email role');

    // Notification: Notify reporting student of status update
    await createNotification({
      recipientId: issue.studentId,
      type: 'ISSUE',
      title: status === 'Closed' ? 'Campus Issue Closed' : `Campus Issue ${status}`,
      message: status === 'Closed'
        ? `Your reported issue "${issue.title}" has been closed.`
        : `Your reported issue "${issue.title}" status is now ${status}.`,
      relatedEntityType: 'CampusIssue',
      relatedEntityId: issue._id
    });

    // Audit Activity Log
    await logActivity({
      req,
      action: status === 'Resolved' ? 'RESOLVE' : status === 'Closed' ? 'CLOSE' : 'UPDATE',
      module: 'ISSUE',
      entityType: 'CampusIssue',
      entityId: issue._id,
      description: `Updated issue status to ${status}`
    });

    res.status(200).json({
      success: true,
      message: `Issue status updated to '${status}' successfully`,
      data: updatedIssue
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createIssue,
  getIssues,
  getIssueById,
  assignIssue,
  updateIssueStatus
};
