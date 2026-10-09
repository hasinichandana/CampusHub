const LeaveRequest = require('../models/LeaveRequest');
const Department = require('../models/Department');
const User = require('../models/User');
const { createNotification, notifyManyUsers } = require('../utils/notificationHelper');
const { logActivity } = require('../utils/activityLogger');

// @desc    Create a new leave request (Student)
// @route   POST /api/leaves
// @access  Private (Student)
const createLeaveRequest = async (req, res, next) => {
  try {
    const { fromDate, toDate, leaveType, reason } = req.body;

    if (!fromDate || !toDate || !leaveType || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Please provide fromDate, toDate, leaveType, and reason'
      });
    }

    if (new Date(fromDate) > new Date(toDate)) {
      return res.status(400).json({
        success: false,
        message: 'Start date (fromDate) cannot be after end date (toDate)'
      });
    }

    // Ensure student has assigned department
    const userDeptId = req.user.departmentId?._id || req.user.departmentId;
    if (!userDeptId && req.user.role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Student must belong to a valid department to submit a leave request'
      });
    }

    let supportingDocumentPath = '';
    if (req.file) {
      supportingDocumentPath = `uploads/leaves/${req.file.filename}`;
    }

    const leaveRequest = await LeaveRequest.create({
      studentId: req.user._id,
      departmentId: userDeptId,
      fromDate,
      toDate,
      leaveType,
      reason,
      supportingDocument: supportingDocumentPath,
      status: 'Pending'
    });

    const populatedLeave = await LeaveRequest.findById(leaveRequest._id)
      .populate('studentId', 'name email phone')
      .populate('departmentId', 'name code');

    // Notification: Notify faculty members in student's department
    if (userDeptId) {
      const facultyMembers = await User.find({ role: 'faculty', departmentId: userDeptId });
      const facultyIds = facultyMembers.map(f => f._id);
      await notifyManyUsers(facultyIds, {
        type: 'LEAVE',
        title: 'New Leave Request',
        message: `${req.user.name} submitted a new ${leaveType} leave request.`,
        relatedEntityType: 'LeaveRequest',
        relatedEntityId: leaveRequest._id
      });
    }

    // Audit Activity Log
    await logActivity({
      req,
      action: 'CREATE',
      module: 'LEAVE',
      entityType: 'LeaveRequest',
      entityId: leaveRequest._id,
      description: `Submitted leave request (${leaveType})`
    });

    res.status(201).json({
      success: true,
      message: 'Leave request submitted successfully',
      data: populatedLeave
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get leave requests (Student: own leaves, Faculty: own dept leaves, Admin: all leaves)
// @route   GET /api/leaves
// @access  Private
const getLeaves = async (req, res, next) => {
  try {
    let query = {};
    const { status, departmentId, studentId, q, search, dateFrom, dateTo, page, limit } = req.query;

    if (req.user.role === 'student') {
      // Students can ONLY view their own leave requests
      query.studentId = req.user._id;
    } else if (req.user.role === 'faculty') {
      // Faculty can ONLY view leave requests from their own department
      const userDeptId = req.user.departmentId?._id || req.user.departmentId;
      query.departmentId = userDeptId;
      if (studentId) query.studentId = studentId;
    } else if (req.user.role === 'admin') {
      if (departmentId) query.departmentId = departmentId;
      if (studentId) query.studentId = studentId;
    }

    if (status) query.status = status;

    const searchTerm = q || search;
    if (searchTerm) {
      query.reason = { $regex: searchTerm, $options: 'i' };
    }

    if (dateFrom || dateTo) {
      query.fromDate = {};
      if (dateFrom) query.fromDate.$gte = new Date(dateFrom);
      if (dateTo) query.fromDate.$lte = new Date(dateTo);
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const total = await LeaveRequest.countDocuments(query);
    const leaves = await LeaveRequest.find(query)
      .populate('studentId', 'name email phone')
      .populate('departmentId', 'name code')
      .populate('reviewedBy', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.status(200).json({
      success: true,
      count: leaves.length,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1
      },
      data: leaves
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single leave request by ID
// @route   GET /api/leaves/:id
// @access  Private
const getLeaveById = async (req, res, next) => {
  try {
    const leave = await LeaveRequest.findById(req.params.id)
      .populate('studentId', 'name email phone')
      .populate('departmentId', 'name code')
      .populate('reviewedBy', 'name email role');

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    // Authorization checks
    if (req.user.role === 'student') {
      if (leave.studentId._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You cannot access another student\'s leave request'
        });
      }
    } else if (req.user.role === 'faculty') {
      const userDeptId = req.user.departmentId?._id || req.user.departmentId;
      if (leave.departmentId._id.toString() !== userDeptId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Faculty access restricted to own department'
        });
      }
    }

    res.status(200).json({
      success: true,
      data: leave
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Approve or Reject leave request (Faculty: own dept, Admin: all)
// @route   PATCH /api/leaves/:id/status
// @access  Private (Faculty, Admin)
const updateLeaveStatus = async (req, res, next) => {
  try {
    const { status, reviewerRemarks } = req.body;

    if (!status || !['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid status (\'Approved\' or \'Rejected\')'
      });
    }

    const leave = await LeaveRequest.findById(req.params.id);

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    // Faculty department boundary check
    if (req.user.role === 'faculty') {
      const userDeptId = req.user.departmentId?._id || req.user.departmentId;
      if (leave.departmentId.toString() !== userDeptId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Faculty access restricted to own department'
        });
      }
    }

    leave.status = status;
    leave.reviewedBy = req.user._id;
    leave.reviewedAt = new Date();
    leave.reviewerRemarks = reviewerRemarks || '';

    await leave.save();

    const updatedLeave = await LeaveRequest.findById(leave._id)
      .populate('studentId', 'name email phone')
      .populate('departmentId', 'name code')
      .populate('reviewedBy', 'name email role');

    // Notification: Notify student of leave status update
    await createNotification({
      recipientId: leave.studentId,
      type: 'LEAVE',
      title: `Leave Request ${status}`,
      message: `Your leave request has been ${status.toLowerCase()}${reviewerRemarks ? `: ${reviewerRemarks}` : '.'}`,
      relatedEntityType: 'LeaveRequest',
      relatedEntityId: leave._id
    });

    // Audit Activity Log
    await logActivity({
      req,
      action: status === 'Approved' ? 'APPROVE' : 'REJECT',
      module: 'LEAVE',
      entityType: 'LeaveRequest',
      entityId: leave._id,
      description: `Leave request ${status.toLowerCase()}`
    });

    res.status(200).json({
      success: true,
      message: `Leave request ${status.toLowerCase()} successfully`,
      data: updatedLeave
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel pending leave request (Student owner only)
// @route   PATCH /api/leaves/:id/cancel
// @access  Private (Student)
const cancelLeaveRequest = async (req, res, next) => {
  try {
    const leave = await LeaveRequest.findById(req.params.id);

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    // Student ownership check
    if (req.user.role === 'student' && leave.studentId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not own this leave request'
      });
    }

    // Can only cancel Pending requests
    if (leave.status !== 'Pending') {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Cannot cancel a leave request with status '${leave.status}'. Only pending requests can be cancelled.`
      });
    }

    leave.status = 'Cancelled';
    await leave.save();

    const updatedLeave = await LeaveRequest.findById(leave._id)
      .populate('studentId', 'name email phone')
      .populate('departmentId', 'name code');

    // Audit Activity Log
    await logActivity({
      req,
      action: 'CANCEL',
      module: 'LEAVE',
      entityType: 'LeaveRequest',
      entityId: leave._id,
      description: 'Cancelled pending leave request'
    });

    res.status(200).json({
      success: true,
      message: 'Leave request cancelled successfully',
      data: updatedLeave
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createLeaveRequest,
  getLeaves,
  getLeaveById,
  updateLeaveStatus,
  cancelLeaveRequest
};
