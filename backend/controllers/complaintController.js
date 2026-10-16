const path = require('path');
const fs = require('fs');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const { createNotification, notifyManyUsers } = require('../utils/notificationHelper');
const { logActivity } = require('../utils/activityLogger');
const { addTextSearch, parsePagination } = require('../utils/queryFilters');

const VALID_COMPLAINT_TRANSITIONS = {
  Submitted: ['Assigned', 'In Progress'],
  Assigned: ['In Progress'],
  'In Progress': ['Resolved'],
  Resolved: ['Closed', 'In Progress'],
  Closed: ['In Progress']
};

// @desc    Create a new complaint (Student)
// @route   POST /api/complaints
// @access  Private (Student, Admin)
const createComplaint = async (req, res, next) => {
  try {
    const { category, subject, description } = req.body;

    if (!category || !subject || !description) {
      return res.status(400).json({
        success: false,
        message: 'Please provide category, subject, and description'
      });
    }

    const userDeptId = req.user.departmentId?._id || req.user.departmentId;
    if (!userDeptId && req.user.role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Student must belong to a valid department to submit a complaint'
      });
    }

    let attachmentPath = '';
    if (req.file) {
      attachmentPath = `uploads/complaints/${req.file.filename}`;
    }

    const complaint = await Complaint.create({
      studentId: req.user._id,
      departmentId: userDeptId,
      category,
      subject,
      description,
      attachment: attachmentPath,
      status: 'Submitted'
    });

    const populatedComplaint = await Complaint.findById(complaint._id)
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
      type: 'COMPLAINT',
      title: 'New Complaint Submitted',
      message: `A new complaint has been submitted: "${subject}".`,
      relatedEntityType: 'Complaint',
      relatedEntityId: complaint._id
    });

    // Audit Activity Log
    await logActivity({
      req,
      action: 'CREATE',
      module: 'COMPLAINT',
      entityType: 'Complaint',
      entityId: complaint._id,
      description: `Submitted complaint: "${subject}"`
    });

    res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully',
      data: populatedComplaint
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get complaints (Student: own, Faculty: assigned/dept, Admin: all)
// @route   GET /api/complaints
// @access  Private
const getComplaints = async (req, res, next) => {
  try {
    let query = {};
    const { status, category, departmentId, assignedTo, q, search, page, limit } = req.query;

    if (req.user.role === 'student') {
      query.studentId = req.user._id;
    } else if (req.user.role === 'faculty') {
      const userDeptId = req.user.departmentId?._id || req.user.departmentId;
      query.$or = [
        { assignedTo: req.user._id },
        { departmentId: userDeptId }
      ];
    } else if (req.user.role === 'admin') {
      if (departmentId) query.departmentId = departmentId;
      if (assignedTo) query.assignedTo = assignedTo;
    }

    if (status) query.status = status;
    if (category) query.category = category;

    const searchError = addTextSearch(query, q || search, ['subject', 'description']);
    if (searchError) {
      return res.status(400).json({ success: false, message: searchError });
    }

    const pagination = parsePagination(page, limit);
    if (!pagination) {
      return res.status(400).json({ success: false, message: 'page must be positive and limit must be between 1 and 100' });
    }

    const total = await Complaint.countDocuments(query);
    const complaints = await Complaint.find(query)
      .populate('studentId', 'name email phone')
      .populate('departmentId', 'name code')
      .populate('assignedTo', 'name email role phone')
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit);

    res.status(200).json({
      success: true,
      count: complaints.length,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit) || 1
      },
      data: complaints
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single complaint by ID
// @route   GET /api/complaints/:id
// @access  Private
const getComplaintById = async (req, res, next) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate('studentId', 'name email phone')
      .populate('departmentId', 'name code')
      .populate('assignedTo', 'name email role phone');

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    // Role Access Checks
    if (req.user.role === 'student') {
      if (complaint.studentId._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You cannot access another student\'s complaint'
        });
      }
    } else if (req.user.role === 'faculty') {
      const userDeptId = req.user.departmentId?._id || req.user.departmentId;
      const isAssigned = complaint.assignedTo && complaint.assignedTo._id.toString() === req.user._id.toString();
      const isSameDept = complaint.departmentId._id.toString() === userDeptId.toString();

      if (!isAssigned && !isSameDept) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Faculty access restricted to assigned complaints or own department'
        });
      }
    }

    res.status(200).json({
      success: true,
      data: complaint
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Assign or Reassign complaint to faculty (Admin)
// @route   PATCH /api/complaints/:id/assign
// @access  Private (Admin)
const assignComplaint = async (req, res, next) => {
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
        message: 'Complaints can only be assigned to valid Faculty or Admin members'
      });
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    complaint.assignedTo = assignedTo;
    complaint.assignedAt = new Date();
    if (complaint.status === 'Submitted') {
      complaint.status = 'Assigned';
    }

    await complaint.save();

    const updatedComplaint = await Complaint.findById(complaint._id)
      .populate('studentId', 'name email phone')
      .populate('departmentId', 'name code')
      .populate('assignedTo', 'name email role phone');

    // Notification: Notify assigned faculty member
    await createNotification({
      recipientId: assignedTo,
      type: 'COMPLAINT',
      title: 'Complaint Assigned',
      message: `You have been assigned to complaint: "${complaint.subject}".`,
      relatedEntityType: 'Complaint',
      relatedEntityId: complaint._id
    });

    // Audit Activity Log
    await logActivity({
      req,
      action: 'ASSIGN',
      module: 'COMPLAINT',
      entityType: 'Complaint',
      entityId: complaint._id,
      description: `Assigned complaint to ${facultyUser.name}`
    });

    res.status(200).json({
      success: true,
      message: `Complaint assigned to ${facultyUser.name} successfully`,
      data: updatedComplaint
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update complaint status & response (Faculty, Admin)
// @route   PATCH /api/complaints/:id/status
// @access  Private (Faculty, Admin)
const updateComplaintStatus = async (req, res, next) => {
  try {
    const { status, response } = req.body;

    if (req.user.role === 'student') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Students are not authorized to update complaint status'
      });
    }

    if (!status || !['Submitted', 'Assigned', 'In Progress', 'Resolved', 'Closed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid status'
      });
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    // Faculty Access Check
    if (req.user.role === 'faculty') {
      const userDeptId = req.user.departmentId?._id || req.user.departmentId;
      const isAssigned = complaint.assignedTo && complaint.assignedTo.toString() === req.user._id.toString();
      const isSameDept = complaint.departmentId.toString() === userDeptId.toString();

      if (!isAssigned && !isSameDept) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You can only update complaints assigned to you or in your department'
        });
      }
    }

    // Validate Status Transition
    const allowedNextStatuses = VALID_COMPLAINT_TRANSITIONS[complaint.status] || [];
    if (!allowedNextStatuses.includes(status) && complaint.status !== status) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from '${complaint.status}' to '${status}'. Allowed transitions: [${allowedNextStatuses.join(', ')}]`
      });
    }

    complaint.status = status;
    if (response !== undefined) {
      complaint.response = response;
    }

    if (status === 'Resolved') {
      complaint.resolvedAt = new Date();
    } else if (status === 'Closed') {
      complaint.closedAt = new Date();
    }

    await complaint.save();

    const updatedComplaint = await Complaint.findById(complaint._id)
      .populate('studentId', 'name email phone')
      .populate('departmentId', 'name code')
      .populate('assignedTo', 'name email role phone');

    // Notification: Notify student of complaint update
    await createNotification({
      recipientId: complaint.studentId,
      type: 'COMPLAINT',
      title: `Complaint ${status}`,
      message: `Your complaint "${complaint.subject}" is now ${status.toLowerCase()}.`,
      relatedEntityType: 'Complaint',
      relatedEntityId: complaint._id
    });

    // Audit Activity Log
    await logActivity({
      req,
      action: status === 'Resolved' ? 'RESOLVE' : status === 'Closed' ? 'CLOSE' : 'UPDATE',
      module: 'COMPLAINT',
      entityType: 'Complaint',
      entityId: complaint._id,
      description: `Updated complaint status to ${status}`
    });

    res.status(200).json({
      success: true,
      message: `Complaint status updated to '${status}' successfully`,
      data: updatedComplaint
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Download complaint attachment (Student owner, Assigned Faculty/Dept Faculty, Admin)
// @route   GET /api/complaints/:id/download
// @access  Private
const downloadComplaintAttachment = async (req, res, next) => {
  try {
    const complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    // Role Access Checks
    if (req.user.role === 'student') {
      if (complaint.studentId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You cannot access another student's complaint attachment"
        });
      }
    } else if (req.user.role === 'faculty') {
      const userDeptId = req.user.departmentId?._id || req.user.departmentId;
      const isAssigned = complaint.assignedTo && complaint.assignedTo.toString() === req.user._id.toString();
      const isSameDept = complaint.departmentId.toString() === userDeptId.toString();

      if (!isAssigned && !isSameDept) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Faculty access restricted to assigned complaints or own department'
        });
      }
    }

    if (!complaint.attachment) {
      return res.status(404).json({
        success: false,
        message: 'No attachment found for this complaint'
      });
    }

    const absoluteFilePath = path.resolve(__dirname, '..', complaint.attachment);
    const uploadBase = path.resolve(__dirname, '../uploads');

    // Prevent Path Traversal
    if (!absoluteFilePath.startsWith(uploadBase)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Invalid file path'
      });
    }

    if (!fs.existsSync(absoluteFilePath)) {
      return res.status(404).json({
        success: false,
        message: 'Complaint attachment file not found on server'
      });
    }

    // Activity Log
    await logActivity({
      req,
      action: 'DOWNLOAD',
      module: 'COMPLAINT',
      entityType: 'Complaint',
      entityId: complaint._id,
      description: 'Downloaded complaint attachment'
    });

    res.download(absoluteFilePath, path.basename(complaint.attachment));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createComplaint,
  getComplaints,
  getComplaintById,
  assignComplaint,
  updateComplaintStatus,
  downloadComplaintAttachment
};
