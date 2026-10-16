const Announcement = require('../models/Announcement');
const User = require('../models/User');
const { createNotification, notifyManyUsers } = require('../utils/notificationHelper');
const { logActivity } = require('../utils/activityLogger');
const { addTextSearch, parsePagination } = require('../utils/queryFilters');

const VALID_ANNOUNCEMENT_TRANSITIONS = {
  Draft: ['Published', 'Archived'],
  Published: ['Archived', 'Draft'],
  Archived: []
};

// Helper: Notify users when an announcement is published
const notifyForAnnouncement = async (announcement) => {
  try {
    let userQuery = { status: 'active' };

    if (announcement.audience === 'Department' && announcement.departmentId) {
      userQuery.departmentId = announcement.departmentId;
    }

    const recipients = await User.find(userQuery).select('_id');
    const recipientIds = recipients.map(u => u._id);

    await notifyManyUsers(recipientIds, {
      type: 'ANNOUNCEMENT',
      title: `Announcement: ${announcement.title}`,
      message: announcement.content.length > 120 ? announcement.content.substring(0, 117) + '...' : announcement.content,
      relatedEntityType: 'Announcement',
      relatedEntityId: announcement._id
    });
  } catch (err) {
    console.error('[Announcement Notification Error]:', err.message);
  }
};

// @desc    Create a new announcement (Faculty, Admin)
// @route   POST /api/announcements
// @access  Private (Faculty, Admin)
const createAnnouncement = async (req, res, next) => {
  try {
    if (req.user.role === 'student') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Students cannot create announcements'
      });
    }

    const { title, content, type, departmentId, audience, status, publishAt, expiresAt } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Please provide announcement title and content'
      });
    }

    let targetAudience = audience || 'College';
    let assignedDeptId = departmentId;

    // Faculty Rules
    if (req.user.role === 'faculty') {
      if (audience && audience === 'College') {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Faculty members are not authorized to create college-wide announcements'
        });
      }
      targetAudience = 'Department';
      const userDeptId = req.user.departmentId?._id || req.user.departmentId;
      if (!userDeptId) {
        return res.status(403).json({
          success: false,
          message: 'Faculty must belong to a department to create department announcements'
        });
      }
      assignedDeptId = userDeptId;
    }

    if (publishAt && expiresAt && new Date(publishAt) > new Date(expiresAt)) {
      return res.status(400).json({
        success: false,
        message: 'Publish date (publishAt) cannot be after expiration date (expiresAt)'
      });
    }

    const announcement = await Announcement.create({
      title,
      content,
      type: type || 'General',
      departmentId: assignedDeptId || undefined,
      audience: targetAudience,
      createdBy: req.user._id,
      status: status || 'Draft',
      publishAt: publishAt || new Date(),
      expiresAt: expiresAt || undefined
    });

    const populatedAnnouncement = await Announcement.findById(announcement._id)
      .populate('createdBy', 'name email role')
      .populate('departmentId', 'name code');

    // Notification if published immediately
    if (announcement.status === 'Published') {
      await notifyForAnnouncement(announcement);
    }

    // Audit Activity Log
    await logActivity({
      req,
      action: status === 'Published' ? 'PUBLISH' : 'CREATE',
      module: 'ANNOUNCEMENT',
      entityType: 'Announcement',
      entityId: announcement._id,
      description: `Created announcement: "${title}"`
    });

    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: populatedAnnouncement
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get relevant announcements (Filtered by role and audience)
// @route   GET /api/announcements
// @access  Private
const getAnnouncements = async (req, res, next) => {
  try {
    let query = {};
    const { status, type, audience, departmentId, q, search, dateFrom, dateTo, page, limit } = req.query;
    const now = new Date();

    if (req.user.role === 'student') {
      const studentDeptId = req.user.departmentId?._id || req.user.departmentId;
      
      query.status = 'Published';
      query.publishAt = { $lte: now };
      query.$or = [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: now } }
      ];

      // Student relevance filter
      query.$and = [
        {
          $or: [
            { audience: 'College' },
            { audience: 'Department', departmentId: studentDeptId }
          ]
        }
      ];
    } else if (req.user.role === 'faculty') {
      const facultyDepartmentId = req.user.departmentId?._id || req.user.departmentId;
      const publishedForFaculty = {
        status: 'Published',
        publishAt: { $lte: now },
        $and: [
          {
            $or: [
              { expiresAt: { $exists: false } },
              { expiresAt: null },
              { expiresAt: { $gt: now } }
            ]
          },
          {
            $or: [
              { audience: 'College' },
              ...(facultyDepartmentId
                ? [{ audience: 'Department', departmentId: facultyDepartmentId }]
                : [])
            ]
          }
        ]
      };

      if (status && status !== 'Published') {
        query.status = status;
        query.createdBy = req.user._id;
      } else if (status === 'Published') {
        query.status = 'Published';
        query.publishAt = { $lte: now };
        query.$and = publishedForFaculty.$and;
      } else {
        query.$or = [
          { createdBy: req.user._id },
          publishedForFaculty
        ];
      }
    } else if (req.user.role === 'admin') {
      if (status) query.status = status;
      if (audience) query.audience = audience;
      if (departmentId) query.departmentId = departmentId;
    }

    if (type) query.type = type;

    const searchError = addTextSearch(query, q || search, ['title', 'content']);
    if (searchError) {
      return res.status(400).json({ success: false, message: searchError });
    }

    if (dateFrom || dateTo) {
      const publishAtRange = {};
      if (dateFrom) publishAtRange.$gte = new Date(dateFrom);
      if (dateTo) publishAtRange.$lte = new Date(dateTo);
      query.$and = query.$and || [];
      query.$and.push({ publishAt: publishAtRange });
    }

    const pagination = parsePagination(page, limit);
    if (!pagination) {
      return res.status(400).json({ success: false, message: 'page must be positive and limit must be between 1 and 100' });
    }

    const total = await Announcement.countDocuments(query);
    const announcements = await Announcement.find(query)
      .populate('createdBy', 'name email role')
      .populate('departmentId', 'name code')
      .sort({ publishAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit);

    res.status(200).json({
      success: true,
      count: announcements.length,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit) || 1
      },
      data: announcements
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single announcement by ID
// @route   GET /api/announcements/:id
// @access  Private
const getAnnouncementById = async (req, res, next) => {
  try {
    const announcement = await Announcement.findById(req.params.id)
      .populate('createdBy', 'name email role')
      .populate('departmentId', 'name code');

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    const now = new Date();

    if (req.user.role === 'student') {
      // Must be published, active, and relevant
      if (announcement.status !== 'Published' || new Date(announcement.publishAt) > now) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Students can only view published active announcements'
        });
      }

      if (announcement.expiresAt && new Date(announcement.expiresAt) <= now) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Announcement has expired'
        });
      }

      const studentDeptId = req.user.departmentId?._id || req.user.departmentId;
      if (announcement.audience === 'Department' && announcement.departmentId._id.toString() !== studentDeptId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You cannot access announcements for another department'
        });
      }
    } else if (req.user.role === 'faculty') {
      const isOwner = announcement.createdBy._id.toString() === req.user._id.toString();
      const facultyDepartmentId = req.user.departmentId?._id || req.user.departmentId;
      const isPublishedForFaculty = announcement.status === 'Published' &&
        new Date(announcement.publishAt) <= now &&
        (!announcement.expiresAt || new Date(announcement.expiresAt) > now) &&
        (announcement.audience === 'College' ||
          (announcement.audience === 'Department' &&
            facultyDepartmentId &&
            announcement.departmentId?._id.toString() === facultyDepartmentId.toString()));

      if (!isOwner && !isPublishedForFaculty) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Faculty can only view their own drafts and relevant published announcements'
        });
      }
    }

    res.status(200).json({
      success: true,
      data: announcement
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update announcement (Faculty owner, Admin)
// @route   PUT /api/announcements/:id
// @access  Private (Faculty, Admin)
const updateAnnouncement = async (req, res, next) => {
  try {
    if (req.user.role === 'student') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Students cannot edit announcements'
      });
    }

    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Ownership Check for Faculty
    if (req.user.role === 'faculty' && announcement.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only edit announcements created by yourself'
      });
    }

    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({
        success: false,
        message: 'Announcement updates must be a JSON object'
      });
    }

    const allowedFields = ['title', 'content', 'type', 'publishAt', 'expiresAt'];
    if (req.user.role === 'admin') {
      allowedFields.push('departmentId', 'audience');
    }

    const unsupportedFields = Object.keys(req.body).filter(field => !allowedFields.includes(field));
    if (unsupportedFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Unsupported announcement fields: ${unsupportedFields.join(', ')}`
      });
    }

    if (Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Provide at least one announcement field to update'
      });
    }

    const nextPublishAt = req.body.publishAt || announcement.publishAt;
    const nextExpiresAt = req.body.expiresAt || announcement.expiresAt;
    if (
      Number.isNaN(new Date(nextPublishAt).getTime()) ||
      (nextExpiresAt && Number.isNaN(new Date(nextExpiresAt).getTime())) ||
      (nextExpiresAt && new Date(nextPublishAt) > new Date(nextExpiresAt))
    ) {
      return res.status(400).json({
        success: false,
        message: 'Announcement publication and expiration dates must be valid, and publication cannot be after expiration'
      });
    }

    const nextAudience = req.body.audience || announcement.audience;
    const nextDepartmentId = req.body.departmentId || announcement.departmentId;
    if (nextAudience === 'Department' && !nextDepartmentId) {
      return res.status(400).json({
        success: false,
        message: 'Department announcements must target a department'
      });
    }

    const updatedAnnouncement = await Announcement.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    })
      .populate('createdBy', 'name email role')
      .populate('departmentId', 'name code');

    await logActivity({
      req,
      action: 'UPDATE',
      module: 'ANNOUNCEMENT',
      entityType: 'Announcement',
      entityId: announcement._id,
      description: `Updated announcement: "${updatedAnnouncement.title}"`
    });

    res.status(200).json({
      success: true,
      message: 'Announcement updated successfully',
      data: updatedAnnouncement
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete announcement (Faculty owner, Admin)
// @route   DELETE /api/announcements/:id
// @access  Private (Faculty, Admin)
const deleteAnnouncement = async (req, res, next) => {
  try {
    if (req.user.role === 'student') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Students cannot delete announcements'
      });
    }

    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Ownership Check for Faculty
    if (req.user.role === 'faculty' && announcement.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only delete announcements created by yourself'
      });
    }

    await Announcement.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Announcement deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update announcement status (Faculty owner, Admin)
// @route   PATCH /api/announcements/:id/status
// @access  Private (Faculty, Admin)
const updateAnnouncementStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (req.user.role === 'student') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Students cannot update announcement status'
      });
    }

    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Faculty Ownership Check
    if (req.user.role === 'faculty' && announcement.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only update status for announcements created by yourself'
      });
    }

    // Status Transition Validation
    const allowedTransitions = VALID_ANNOUNCEMENT_TRANSITIONS[announcement.status] || [];
    if (!allowedTransitions.includes(status) && announcement.status !== status) {
      return res.status(400).json({
        success: false,
        message: `Invalid announcement status transition from '${announcement.status}' to '${status}'. Allowed transitions: [${allowedTransitions.join(', ')}]`
      });
    }

    const oldStatus = announcement.status;
    announcement.status = status;
    if (status === 'Published' && !announcement.publishAt) {
      announcement.publishAt = new Date();
    }

    await announcement.save();

    // Notification if status changed to Published
    if (status === 'Published' && oldStatus !== 'Published') {
      await notifyForAnnouncement(announcement);
    }

    // Audit Activity Log
    await logActivity({
      req,
      action: status === 'Published' ? 'PUBLISH' : status === 'Archived' ? 'ARCHIVE' : 'UPDATE',
      module: 'ANNOUNCEMENT',
      entityType: 'Announcement',
      entityId: announcement._id,
      description: `Updated announcement status to ${status}`
    });

    res.status(200).json({
      success: true,
      message: `Announcement status updated to '${status}' successfully`,
      data: announcement
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createAnnouncement,
  getAnnouncements,
  getAnnouncementById,
  updateAnnouncement,
  deleteAnnouncement,
  updateAnnouncementStatus
};
