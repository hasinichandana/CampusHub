const path = require('path');
const fs = require('fs');
const AcademicResource = require('../models/AcademicResource');
const User = require('../models/User');
const Department = require('../models/Department');
const { logActivity } = require('../utils/activityLogger');
const { addTextSearch, parsePagination } = require('../utils/queryFilters');

const getSafeResourceFilePath = (filePath) => {
  if (typeof filePath !== 'string') return null;

  const normalizedPath = filePath.replace(/\\/g, '/');
  if (!normalizedPath.startsWith('uploads/academic-resources/')) return null;

  const resourceBase = path.resolve(__dirname, '../uploads/academic-resources');
  const absolutePath = path.resolve(__dirname, '..', normalizedPath);
  const relativePath = path.relative(resourceBase, absolutePath);

  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return null;
  }

  return absolutePath;
};

// Helper to get relative file path
const getRelativePath = (fullPath) => {
  const normalized = fullPath.replace(/\\/g, '/');
  const index = normalized.indexOf('uploads/');
  return index !== -1 ? normalized.substring(index) : fullPath;
};

// @desc    Create a new academic resource (Faculty, Admin)
// @route   POST /api/academic-resources
// @access  Private (Faculty, Admin)
const createResource = async (req, res, next) => {
  try {
    if (req.user.role === 'student') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Students cannot upload academic resources'
      });
    }

    const { title, description, category, subject, semester, academicYear, unit, departmentId } = req.body;

    const VALID_CATEGORIES = ['NOTES', 'STUDY_MATERIAL', 'QUESTION_BANK', 'PREVIOUS_PAPER'];
    const uppercaseCategory = category ? category.toUpperCase() : '';

    if (!title || !category || !subject || !semester || !academicYear) {
      return res.status(400).json({
        success: false,
        message: 'Please provide title, category, subject, semester, and academicYear'
      });
    }

    if (!VALID_CATEGORIES.includes(uppercaseCategory)) {
      return res.status(400).json({
        success: false,
        message: `Invalid category '${category}'. Allowed categories: [${VALID_CATEGORIES.join(', ')}]`
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a resource file'
      });
    }

    let assignedDeptId;
    if (req.user.role === 'faculty') {
      assignedDeptId = req.user.departmentId?._id || req.user.departmentId;
      if (!assignedDeptId) {
        return res.status(403).json({
          success: false,
          message: 'Faculty must belong to a department to upload academic resources'
        });
      }
    } else {
      assignedDeptId = departmentId || req.user.departmentId;
    }

    const relativeFilePath = getRelativePath(req.file.path);

    const resource = await AcademicResource.create({
      title,
      description: description || '',
      category: category.toUpperCase(),
      subject,
      departmentId: assignedDeptId,
      semester: parseInt(semester, 10),
      academicYear,
      unit: unit || '',
      fileName: req.file.originalname,
      filePath: relativeFilePath,
      fileType: req.file.mimetype || path.extname(req.file.originalname),
      fileSize: req.file.size,
      uploadedBy: req.user._id,
      status: 'ACTIVE'
    });

    const populatedResource = await AcademicResource.findById(resource._id)
      .populate('uploadedBy', 'name email role')
      .populate('departmentId', 'name code');

    // Activity Log
    await logActivity({
      req,
      action: 'CREATE',
      module: 'ACADEMIC_RESOURCE',
      entityType: 'AcademicResource',
      entityId: resource._id,
      description: `Uploaded ${category} resource: "${title}"`,
      metadata: { category, subject, semester, academicYear }
    });

    res.status(201).json({
      success: true,
      message: 'Academic resource uploaded successfully',
      data: populatedResource
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get academic resources (Role-scoped filtering & search)
// @route   GET /api/academic-resources
// @access  Private
const getResources = async (req, res, next) => {
  try {
    let query = {};
    const {
      category,
      subject,
      department,
      departmentId,
      semester,
      academicYear,
      unit,
      search,
      q,
      status,
      page,
      limit
    } = req.query;

    // Role-based boundary checks
    if (req.user.role === 'student') {
      query.status = 'ACTIVE';
      // Student is restricted to active resources
      if (departmentId || department) {
        query.departmentId = departmentId || department;
      }
    } else if (req.user.role === 'faculty') {
      const userDeptId = req.user.departmentId?._id || req.user.departmentId;
      query.departmentId = userDeptId;
      if (status) query.status = status;
    } else if (req.user.role === 'admin') {
      if (departmentId || department) {
        query.departmentId = departmentId || department;
      }
      if (status) query.status = status;
    }

    if (category) query.category = category.toUpperCase();
    if (subject) query.subject = { $regex: subject, $options: 'i' };
    if (semester) query.semester = parseInt(semester, 10);
    if (academicYear) query.academicYear = academicYear;
    if (unit) query.unit = { $regex: unit, $options: 'i' };

    const searchError = addTextSearch(query, q || search, ['title', 'description', 'subject']);
    if (searchError) {
      return res.status(400).json({ success: false, message: searchError });
    }

    const pagination = parsePagination(page, limit);
    if (!pagination) {
      return res.status(400).json({ success: false, message: 'page must be positive and limit must be between 1 and 100' });
    }

    const total = await AcademicResource.countDocuments(query);
    const resources = await AcademicResource.find(query)
      .populate('uploadedBy', 'name email role')
      .populate('departmentId', 'name code')
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit);

    res.status(200).json({
      success: true,
      count: resources.length,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit) || 1
      },
      data: resources
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single academic resource by ID
// @route   GET /api/academic-resources/:id
// @access  Private
const getResourceById = async (req, res, next) => {
  try {
    const resource = await AcademicResource.findById(req.params.id)
      .populate('uploadedBy', 'name email role')
      .populate('departmentId', 'name code');

    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Academic resource not found'
      });
    }

    // Role checks
    if (req.user.role === 'student' && resource.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Students can only view active resources'
      });
    } else if (req.user.role === 'faculty') {
      const userDeptId = req.user.departmentId?._id || req.user.departmentId;
      const isOwner = resource.uploadedBy._id.toString() === req.user._id.toString();
      const isSameDept = resource.departmentId._id.toString() === userDeptId.toString();

      if (!isOwner && !isSameDept) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Faculty access restricted to own department resources'
        });
      }
    }

    res.status(200).json({
      success: true,
      data: resource
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Download academic resource file
// @route   GET /api/academic-resources/:id/download
// @access  Private
const downloadResource = async (req, res, next) => {
  try {
    const resource = await AcademicResource.findById(req.params.id);

    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Academic resource not found'
      });
    }

    // Role boundary checks
    if (req.user.role === 'student' && resource.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Cannot download archived resources'
      });
    } else if (req.user.role === 'faculty') {
      const userDeptId = req.user.departmentId?._id || req.user.departmentId;
      const isOwner = resource.uploadedBy.toString() === req.user._id.toString();
      const isSameDept = resource.departmentId.toString() === userDeptId.toString();

      if (!isOwner && !isSameDept) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Faculty access restricted to own department resources'
        });
      }
    }

    const absoluteFilePath = getSafeResourceFilePath(resource.filePath);
    if (!absoluteFilePath) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Invalid file path'
      });
    }

    if (!fs.existsSync(absoluteFilePath) || !fs.statSync(absoluteFilePath).isFile()) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }

    // Audit Activity Log
    await logActivity({
      req,
      action: 'DOWNLOAD',
      module: 'ACADEMIC_RESOURCE',
      entityType: 'AcademicResource',
      entityId: resource._id,
      description: `Downloaded resource file "${resource.title}"`,
      metadata: { fileName: resource.fileName }
    });

    res.download(absoluteFilePath, resource.fileName);
  } catch (error) {
    next(error);
  }
};

// @desc    Update academic resource (Faculty owner, Admin)
// @route   PUT /api/academic-resources/:id
// @access  Private (Faculty, Admin)
const updateResource = async (req, res, next) => {
  try {
    if (req.user.role === 'student') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Students cannot edit academic resources'
      });
    }

    const resource = await AcademicResource.findById(req.params.id);
    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Academic resource not found'
      });
    }

    // Faculty Ownership Check
    if (req.user.role === 'faculty' && resource.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only edit resources uploaded by yourself'
      });
    }

    const updateFields = { ...req.body };
    if (updateFields.category) updateFields.category = updateFields.category.toUpperCase();

    if (req.file) {
      // Delete old file if it exists
      const oldPath = getSafeResourceFilePath(resource.filePath);
      if (oldPath && fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }

      updateFields.fileName = req.file.originalname;
      updateFields.filePath = getRelativePath(req.file.path);
      updateFields.fileType = req.file.mimetype || path.extname(req.file.originalname);
      updateFields.fileSize = req.file.size;
    }

    const updatedResource = await AcademicResource.findByIdAndUpdate(req.params.id, updateFields, {
      new: true,
      runValidators: true
    })
      .populate('uploadedBy', 'name email role')
      .populate('departmentId', 'name code');

    // Audit Activity Log
    await logActivity({
      req,
      action: 'UPDATE',
      module: 'ACADEMIC_RESOURCE',
      entityType: 'AcademicResource',
      entityId: resource._id,
      description: `Updated academic resource "${updatedResource.title}"`
    });

    res.status(200).json({
      success: true,
      message: 'Academic resource updated successfully',
      data: updatedResource
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete academic resource (Faculty owner, Admin)
// @route   DELETE /api/academic-resources/:id
// @access  Private (Faculty, Admin)
const deleteResource = async (req, res, next) => {
  try {
    if (req.user.role === 'student') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Students cannot delete academic resources'
      });
    }

    const resource = await AcademicResource.findById(req.params.id);
    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Academic resource not found'
      });
    }

    // Faculty Ownership Check
    if (req.user.role === 'faculty' && resource.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only delete resources uploaded by yourself'
      });
    }

    // Physical File Cleanup
    const fileAbsolutePath = getSafeResourceFilePath(resource.filePath);
    if (fileAbsolutePath && fs.existsSync(fileAbsolutePath)) {
      fs.unlinkSync(fileAbsolutePath);
    }

    await AcademicResource.findByIdAndDelete(req.params.id);

    // Audit Activity Log
    await logActivity({
      req,
      action: 'DELETE',
      module: 'ACADEMIC_RESOURCE',
      entityType: 'AcademicResource',
      entityId: resource._id,
      description: `Deleted academic resource "${resource.title}"`
    });

    res.status(200).json({
      success: true,
      message: 'Academic resource deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update resource status ACTIVE/ARCHIVED (Admin only)
// @route   PATCH /api/academic-resources/:id/status
// @access  Private (Admin)
const updateResourceStatus = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Admin access required to archive or activate resources'
      });
    }

    const { status } = req.body;
    if (!status || !['ACTIVE', 'ARCHIVED'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid status (\'ACTIVE\' or \'ARCHIVED\')'
      });
    }

    const resource = await AcademicResource.findById(req.params.id);
    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Academic resource not found'
      });
    }

    resource.status = status;
    await resource.save();

    // Audit Activity Log
    await logActivity({
      req,
      action: status === 'ARCHIVED' ? 'ARCHIVE' : 'UPDATE',
      module: 'ACADEMIC_RESOURCE',
      entityType: 'AcademicResource',
      entityId: resource._id,
      description: `Changed resource status to ${status}`
    });

    res.status(200).json({
      success: true,
      message: `Resource status updated to '${status}' successfully`,
      data: resource
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createResource,
  getResources,
  getResourceById,
  downloadResource,
  updateResource,
  deleteResource,
  updateResourceStatus
};
