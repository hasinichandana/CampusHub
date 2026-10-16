const path = require('path');
const fs = require('fs');
const DocumentRequest = require('../models/DocumentRequest');
const User = require('../models/User');
const { createNotification, notifyManyUsers } = require('../utils/notificationHelper');
const { logActivity } = require('../utils/activityLogger');
const { parsePagination } = require('../utils/queryFilters');

const VALID_DOCUMENT_TRANSITIONS = {
  Pending: ['Under Review', 'Approved', 'Rejected'],
  'Under Review': ['Approved', 'Rejected'],
  Approved: ['Completed'],
  Rejected: [],
  Completed: []
};

// @desc    Create a new document request (Student)
// @route   POST /api/documents
// @access  Private (Student, Admin)
const createDocumentRequest = async (req, res, next) => {
  try {
    const { documentType, purpose } = req.body;

    if (!documentType || !purpose) {
      return res.status(400).json({
        success: false,
        message: 'Please provide documentType and purpose'
      });
    }

    const userDeptId = req.user.departmentId?._id || req.user.departmentId;
    if (!userDeptId && req.user.role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Student must belong to a valid department to request a document'
      });
    }

    let supportingDocumentPath = '';
    if (req.file) {
      supportingDocumentPath = `uploads/documents/${req.file.filename}`;
    }

    const docRequest = await DocumentRequest.create({
      studentId: req.user._id,
      departmentId: userDeptId,
      documentType,
      purpose,
      supportingDocument: supportingDocumentPath,
      status: 'Pending'
    });

    const populatedDoc = await DocumentRequest.findById(docRequest._id)
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
      type: 'DOCUMENT',
      title: 'New Document Request Submitted',
      message: `${req.user.name} requested document: "${documentType}".`,
      relatedEntityType: 'DocumentRequest',
      relatedEntityId: docRequest._id
    });

    // Audit Activity Log
    await logActivity({
      req,
      action: 'CREATE',
      module: 'DOCUMENT',
      entityType: 'DocumentRequest',
      entityId: docRequest._id,
      description: `Requested document: ${documentType}`
    });

    res.status(201).json({
      success: true,
      message: 'Document request submitted successfully',
      data: populatedDoc
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get document requests (Student: own, Faculty: dept, Admin: all)
// @route   GET /api/documents
// @access  Private
const getDocumentRequests = async (req, res, next) => {
  try {
    let query = {};
    const { status, documentType, departmentId, studentId, q, search, dateFrom, dateTo, page, limit } = req.query;

    if (req.user.role === 'student') {
      query.studentId = req.user._id;
    } else if (req.user.role === 'faculty') {
      const userDeptId = req.user.departmentId?._id || req.user.departmentId;
      query.departmentId = userDeptId;
      if (studentId) query.studentId = studentId;
    } else if (req.user.role === 'admin') {
      if (departmentId) query.departmentId = departmentId;
      if (studentId) query.studentId = studentId;
    }

    if (status) query.status = status;
    if (documentType) query.documentType = documentType;

    const searchTerm = q || search;
    if (searchTerm) {
      query.$or = [
        { documentType: { $regex: searchTerm, $options: 'i' } },
        { purpose: { $regex: searchTerm, $options: 'i' } }
      ];
    }

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    const pagination = parsePagination(page, limit);
    if (!pagination) {
      return res.status(400).json({ success: false, message: 'page must be positive and limit must be between 1 and 100' });
    }

    const total = await DocumentRequest.countDocuments(query);
    const docs = await DocumentRequest.find(query)
      .populate('studentId', 'name email phone')
      .populate('departmentId', 'name code')
      .populate('reviewedBy', 'name email role')
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit);

    res.status(200).json({
      success: true,
      count: docs.length,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit) || 1
      },
      data: docs
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single document request by ID
// @route   GET /api/documents/:id
// @access  Private
const getDocumentRequestById = async (req, res, next) => {
  try {
    const docRequest = await DocumentRequest.findById(req.params.id)
      .populate('studentId', 'name email phone')
      .populate('departmentId', 'name code')
      .populate('reviewedBy', 'name email role');

    if (!docRequest) {
      return res.status(404).json({
        success: false,
        message: 'Document request not found'
      });
    }

    // Role Access Checks
    if (req.user.role === 'student') {
      if (docRequest.studentId._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You cannot access another student\'s document request'
        });
      }
    } else if (req.user.role === 'faculty') {
      const userDeptId = req.user.departmentId?._id || req.user.departmentId;
      if (docRequest.departmentId._id.toString() !== userDeptId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Faculty access restricted to own department requests'
        });
      }
    }

    res.status(200).json({
      success: true,
      data: docRequest
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update document request status (Faculty, Admin)
// @route   PATCH /api/documents/:id/status
// @access  Private (Faculty, Admin)
const updateDocumentStatus = async (req, res, next) => {
  try {
    const { status, remarks } = req.body;

    if (req.user.role === 'student') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Students are not authorized to update document request status'
      });
    }

    if (!status || !['Pending', 'Under Review', 'Approved', 'Rejected', 'Completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid status'
      });
    }

    const docRequest = await DocumentRequest.findById(req.params.id);
    if (!docRequest) {
      return res.status(404).json({
        success: false,
        message: 'Document request not found'
      });
    }

    // Faculty Department Access Check
    if (req.user.role === 'faculty') {
      const userDeptId = req.user.departmentId?._id || req.user.departmentId;
      if (docRequest.departmentId.toString() !== userDeptId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Faculty access restricted to own department'
        });
      }
    }

    // Validate Status Transition
    const allowedNextStatuses = VALID_DOCUMENT_TRANSITIONS[docRequest.status] || [];
    if (!allowedNextStatuses.includes(status) && docRequest.status !== status) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from '${docRequest.status}' to '${status}'. Allowed transitions: [${allowedNextStatuses.join(', ')}]`
      });
    }

    docRequest.status = status;
    if (remarks !== undefined) {
      docRequest.remarks = remarks;
    }

    docRequest.reviewedBy = req.user._id;
    docRequest.reviewedAt = new Date();

    if (status === 'Completed') {
      docRequest.completedAt = new Date();
    }

    await docRequest.save();

    const updatedDoc = await DocumentRequest.findById(docRequest._id)
      .populate('studentId', 'name email phone')
      .populate('departmentId', 'name code')
      .populate('reviewedBy', 'name email role');

    // Notification: Notify student of document status update
    await createNotification({
      recipientId: docRequest.studentId,
      type: 'DOCUMENT',
      title: `Document Request ${status}`,
      message: `Your request for "${docRequest.documentType}" has been ${status.toLowerCase()}.`,
      relatedEntityType: 'DocumentRequest',
      relatedEntityId: docRequest._id
    });

    // Audit Activity Log
    await logActivity({
      req,
      action: status === 'Approved' ? 'APPROVE' : status === 'Rejected' ? 'REJECT' : 'UPDATE',
      module: 'DOCUMENT',
      entityType: 'DocumentRequest',
      entityId: docRequest._id,
      description: `Updated document request status to ${status}`
    });

    res.status(200).json({
      success: true,
      message: `Document request status updated to '${status}' successfully`,
      data: updatedDoc
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload completed document (Admin, Faculty)
// @route   PATCH /api/documents/:id/complete
// @access  Private (Faculty, Admin)
const uploadCompletedDocument = async (req, res, next) => {
  try {
    if (req.user.role === 'student') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Students are not authorized to upload generated documents'
      });
    }

    const docRequest = await DocumentRequest.findById(req.params.id);
    if (!docRequest) {
      return res.status(404).json({
        success: false,
        message: 'Document request not found'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload the completed document file'
      });
    }

    docRequest.generatedDocument = `uploads/generated/${req.file.filename}`;
    docRequest.status = 'Completed';
    docRequest.completedAt = new Date();
    docRequest.reviewedBy = req.user._id;
    docRequest.reviewedAt = new Date();

    if (req.body.remarks) {
      docRequest.remarks = req.body.remarks;
    }

    await docRequest.save();

    const updatedDoc = await DocumentRequest.findById(docRequest._id)
      .populate('studentId', 'name email phone')
      .populate('departmentId', 'name code')
      .populate('reviewedBy', 'name email role');

    // Notification: Notify student completed document is ready
    await createNotification({
      recipientId: docRequest.studentId,
      type: 'DOCUMENT',
      title: 'Document Ready for Download',
      message: `Your requested document (${docRequest.documentType}) is completed and ready for download.`,
      relatedEntityType: 'DocumentRequest',
      relatedEntityId: docRequest._id
    });

    // Audit Activity Log
    await logActivity({
      req,
      action: 'UPDATE',
      module: 'DOCUMENT',
      entityType: 'DocumentRequest',
      entityId: docRequest._id,
      description: 'Uploaded completed document file'
    });

    res.status(200).json({
      success: true,
      message: 'Completed document uploaded successfully',
      data: updatedDoc
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Download document request file (Student owner, Dept Faculty, Admin)
// @route   GET /api/documents/:id/download
// @access  Private
const downloadDocumentFile = async (req, res, next) => {
  try {
    const docRequest = await DocumentRequest.findById(req.params.id);

    if (!docRequest) {
      return res.status(404).json({
        success: false,
        message: 'Document request not found'
      });
    }

    // Role-based access control
    if (req.user.role === 'student') {
      if (docRequest.studentId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You cannot access another student's document"
        });
      }
    } else if (req.user.role === 'faculty') {
      const userDeptId = req.user.departmentId?._id || req.user.departmentId;
      if (docRequest.departmentId.toString() !== userDeptId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Faculty access restricted to own department requests'
        });
      }
    }

    const { type } = req.query; // 'supporting' or 'generated'
    let targetRelativePath = '';

    if (type === 'supporting') {
      targetRelativePath = docRequest.supportingDocument;
    } else if (type === 'generated') {
      targetRelativePath = docRequest.generatedDocument;
    } else {
      // Default: generatedDocument if present, otherwise supportingDocument
      targetRelativePath = docRequest.generatedDocument || docRequest.supportingDocument;
    }

    if (!targetRelativePath) {
      return res.status(404).json({
        success: false,
        message: 'Requested document file is not available for this request'
      });
    }

    const absoluteFilePath = path.resolve(__dirname, '..', targetRelativePath);
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
        message: 'Document file not found on server'
      });
    }

    // Activity Log
    await logActivity({
      req,
      action: 'DOWNLOAD',
      module: 'DOCUMENT',
      entityType: 'DocumentRequest',
      entityId: docRequest._id,
      description: `Downloaded document file (${path.basename(targetRelativePath)})`
    });

    res.download(absoluteFilePath, path.basename(targetRelativePath));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createDocumentRequest,
  getDocumentRequests,
  getDocumentRequestById,
  updateDocumentStatus,
  uploadCompletedDocument,
  downloadDocumentFile
};
