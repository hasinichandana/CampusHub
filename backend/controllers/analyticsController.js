const User = require('../models/User');
const Department = require('../models/Department');
const LeaveRequest = require('../models/LeaveRequest');
const CampusIssue = require('../models/CampusIssue');
const Complaint = require('../models/Complaint');
const DocumentRequest = require('../models/DocumentRequest');
const Event = require('../models/Event');
const EventRegistration = require('../models/EventRegistration');
const Announcement = require('../models/Announcement');
const Notification = require('../models/Notification');

// @desc    Admin System Overview Analytics
// @route   GET /api/analytics/admin/overview
// @access  Private (Admin)
const getAdminOverview = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Admin authorization required'
      });
    }

    const [
      totalUsers,
      totalDepartments,
      studentCount,
      facultyCount,
      adminCount,
      totalLeaves,
      pendingLeaves,
      totalIssues,
      openIssues,
      totalComplaints,
      openComplaints,
      totalDocuments,
      pendingDocuments,
      totalEvents,
      publishedEvents,
      totalAnnouncements
    ] = await Promise.all([
      User.countDocuments(),
      Department.countDocuments(),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'faculty' }),
      User.countDocuments({ role: 'admin' }),
      LeaveRequest.countDocuments(),
      LeaveRequest.countDocuments({ status: 'Pending' }),
      CampusIssue.countDocuments(),
      CampusIssue.countDocuments({ status: { $nin: ['Resolved', 'Closed'] } }),
      Complaint.countDocuments(),
      Complaint.countDocuments({ status: { $nin: ['Resolved', 'Closed'] } }),
      DocumentRequest.countDocuments(),
      DocumentRequest.countDocuments({ status: { $in: ['Pending', 'Under Review'] } }),
      Event.countDocuments(),
      Event.countDocuments({ status: 'Published' }),
      Announcement.countDocuments()
    ]);

    // Department breakdowns
    const deptBreakdown = await User.aggregate([
      { $match: { role: { $in: ['student', 'faculty'] } } },
      { $group: { _id: '$departmentId', count: { $sum: 1 } } },
      { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'dept' } },
      { $unwind: '$dept' },
      { $project: { _id: 0, departmentId: '$_id', name: '$dept.name', code: '$dept.code', count: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        users: { total: totalUsers, students: studentCount, faculty: facultyCount, admins: adminCount },
        departments: { total: totalDepartments },
        leaves: { total: totalLeaves, pending: pendingLeaves },
        issues: { total: totalIssues, open: openIssues },
        complaints: { total: totalComplaints, open: openComplaints },
        documents: { total: totalDocuments, pending: pendingDocuments },
        events: { total: totalEvents, published: publishedEvents },
        announcements: { total: totalAnnouncements },
        departmentBreakdown: deptBreakdown
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin Users Analytics
// @route   GET /api/analytics/admin/users
// @access  Private (Admin)
const getAdminUsersAnalytics = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
    }

    const [total, students, faculty, admins, active, inactive, byDepartment] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'faculty' }),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ status: 'active' }),
      User.countDocuments({ status: 'inactive' }),
      User.aggregate([
        { $group: { _id: '$departmentId', count: { $sum: 1 } } },
        { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'dept' } },
        { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
        { $project: { departmentName: { $ifNull: ['$dept.name', 'Unassigned'] }, count: 1 } }
      ])
    ]);

    res.status(200).json({
      success: true,
      data: { total, students, faculty, admins, active, inactive, byDepartment }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin Leaves Analytics
// @route   GET /api/analytics/admin/leaves
// @access  Private (Admin)
const getAdminLeavesAnalytics = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
    }

    const [total, pending, approved, rejected, cancelled, byDepartment] = await Promise.all([
      LeaveRequest.countDocuments(),
      LeaveRequest.countDocuments({ status: 'Pending' }),
      LeaveRequest.countDocuments({ status: 'Approved' }),
      LeaveRequest.countDocuments({ status: 'Rejected' }),
      LeaveRequest.countDocuments({ status: 'Cancelled' }),
      LeaveRequest.aggregate([
        { $group: { _id: '$departmentId', count: { $sum: 1 } } },
        { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'dept' } },
        { $unwind: '$dept' },
        { $project: { departmentName: '$dept.name', count: 1 } }
      ])
    ]);

    res.status(200).json({
      success: true,
      data: { total, pending, approved, rejected, cancelled, byDepartment }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin Campus Issues Analytics
// @route   GET /api/analytics/admin/issues
// @access  Private (Admin)
const getAdminIssuesAnalytics = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
    }

    const [total, reported, assigned, inProgress, resolved, closed, byCategory, byDepartment] = await Promise.all([
      CampusIssue.countDocuments(),
      CampusIssue.countDocuments({ status: 'Reported' }),
      CampusIssue.countDocuments({ status: 'Assigned' }),
      CampusIssue.countDocuments({ status: 'In Progress' }),
      CampusIssue.countDocuments({ status: 'Resolved' }),
      CampusIssue.countDocuments({ status: 'Closed' }),
      CampusIssue.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ]),
      CampusIssue.aggregate([
        { $group: { _id: '$departmentId', count: { $sum: 1 } } },
        { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'dept' } },
        { $unwind: '$dept' },
        { $project: { departmentName: '$dept.name', count: 1 } }
      ])
    ]);

    res.status(200).json({
      success: true,
      data: { total, reported, assigned, inProgress, resolved, closed, byCategory, byDepartment }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin Complaints Analytics
// @route   GET /api/analytics/admin/complaints
// @access  Private (Admin)
const getAdminComplaintsAnalytics = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
    }

    const [total, submitted, assigned, inProgress, resolved, closed, byCategory, byDepartment] = await Promise.all([
      Complaint.countDocuments(),
      Complaint.countDocuments({ status: 'Submitted' }),
      Complaint.countDocuments({ status: 'Assigned' }),
      Complaint.countDocuments({ status: 'In Progress' }),
      Complaint.countDocuments({ status: 'Resolved' }),
      Complaint.countDocuments({ status: 'Closed' }),
      Complaint.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ]),
      Complaint.aggregate([
        { $group: { _id: '$departmentId', count: { $sum: 1 } } },
        { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'dept' } },
        { $unwind: '$dept' },
        { $project: { departmentName: '$dept.name', count: 1 } }
      ])
    ]);

    res.status(200).json({
      success: true,
      data: { total, submitted, assigned, inProgress, resolved, closed, byCategory, byDepartment }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin Document Requests Analytics
// @route   GET /api/analytics/admin/documents
// @access  Private (Admin)
const getAdminDocumentsAnalytics = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
    }

    const [total, pending, underReview, approved, rejected, completed, byType, byDepartment] = await Promise.all([
      DocumentRequest.countDocuments(),
      DocumentRequest.countDocuments({ status: 'Pending' }),
      DocumentRequest.countDocuments({ status: 'Under Review' }),
      DocumentRequest.countDocuments({ status: 'Approved' }),
      DocumentRequest.countDocuments({ status: 'Rejected' }),
      DocumentRequest.countDocuments({ status: 'Completed' }),
      DocumentRequest.aggregate([
        { $group: { _id: '$documentType', count: { $sum: 1 } } }
      ]),
      DocumentRequest.aggregate([
        { $group: { _id: '$departmentId', count: { $sum: 1 } } },
        { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'dept' } },
        { $unwind: '$dept' },
        { $project: { departmentName: '$dept.name', count: 1 } }
      ])
    ]);

    res.status(200).json({
      success: true,
      data: { total, pending, underReview, approved, rejected, completed, byType, byDepartment }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin Events Analytics
// @route   GET /api/analytics/admin/events
// @access  Private (Admin)
const getAdminEventsAnalytics = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
    }

    const [total, draft, published, cancelled, completed, registrationsCount, byDepartment, topEvents] = await Promise.all([
      Event.countDocuments(),
      Event.countDocuments({ status: 'Draft' }),
      Event.countDocuments({ status: 'Published' }),
      Event.countDocuments({ status: 'Cancelled' }),
      Event.countDocuments({ status: 'Completed' }),
      EventRegistration.countDocuments({ status: 'Registered' }),
      Event.aggregate([
        { $group: { _id: '$departmentId', count: { $sum: 1 } } },
        { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'dept' } },
        { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
        { $project: { departmentName: { $ifNull: ['$dept.name', 'College Wide'] }, count: 1 } }
      ]),
      EventRegistration.aggregate([
        { $match: { status: 'Registered' } },
        { $group: { _id: '$eventId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'events', localField: '_id', foreignField: '_id', as: 'event' } },
        { $unwind: '$event' },
        { $project: { title: '$event.title', count: 1 } }
      ])
    ]);

    res.status(200).json({
      success: true,
      data: { total, draft, published, cancelled, completed, registrationsCount, byDepartment, topEvents }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin Announcements Analytics
// @route   GET /api/analytics/admin/announcements
// @access  Private (Admin)
const getAdminAnnouncementsAnalytics = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
    }

    const [total, draft, published, archived, collegeCount, departmentCount] = await Promise.all([
      Announcement.countDocuments(),
      Announcement.countDocuments({ status: 'Draft' }),
      Announcement.countDocuments({ status: 'Published' }),
      Announcement.countDocuments({ status: 'Archived' }),
      Announcement.countDocuments({ audience: 'College' }),
      Announcement.countDocuments({ audience: 'Department' })
    ]);

    res.status(200).json({
      success: true,
      data: { total, draft, published, archived, collegeCount, departmentCount }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Faculty Department-Scoped Overview Analytics
// @route   GET /api/analytics/faculty/overview
// @access  Private (Faculty)
const getFacultyOverview = async (req, res, next) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Faculty authorization required'
      });
    }

    const facultyDeptId = req.user.departmentId?._id || req.user.departmentId;

    if (!facultyDeptId) {
      return res.status(400).json({
        success: false,
        message: 'Faculty must belong to a valid department for analytics'
      });
    }

    const [
      studentCount,
      leaveStats,
      issueStats,
      complaintStats,
      docStats,
      eventCount,
      pendingActionCount
    ] = await Promise.all([
      User.countDocuments({ role: 'student', departmentId: facultyDeptId }),
      LeaveRequest.aggregate([
        { $match: { departmentId: facultyDeptId } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      CampusIssue.aggregate([
        { $match: { $or: [{ departmentId: facultyDeptId }, { assignedTo: req.user._id }] } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Complaint.aggregate([
        { $match: { $or: [{ departmentId: facultyDeptId }, { assignedTo: req.user._id }] } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      DocumentRequest.aggregate([
        { $match: { departmentId: facultyDeptId } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Event.countDocuments({ departmentId: facultyDeptId }),
      LeaveRequest.countDocuments({ departmentId: facultyDeptId, status: 'Pending' })
    ]);

    const formatStats = (aggResults) => {
      const map = {};
      aggResults.forEach(item => { map[item._id] = item.count; });
      return map;
    };

    res.status(200).json({
      success: true,
      data: {
        departmentId: facultyDeptId,
        studentCount,
        leaves: formatStats(leaveStats),
        issues: formatStats(issueStats),
        complaints: formatStats(complaintStats),
        documents: formatStats(docStats),
        eventCount,
        pendingActionCount
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Student Personal Overview Analytics
// @route   GET /api/analytics/student/overview
// @access  Private (Student)
const getStudentOverview = async (req, res, next) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Student authorization required'
      });
    }

    const studentId = req.user._id;

    const [
      leavesCount,
      pendingLeavesCount,
      complaintsCount,
      issuesCount,
      openIssuesCount,
      documentsCount,
      eventRegistrationsCount,
      unreadNotificationsCount
    ] = await Promise.all([
      LeaveRequest.countDocuments({ studentId }),
      LeaveRequest.countDocuments({ studentId, status: 'Pending' }),
      Complaint.countDocuments({ studentId }),
      CampusIssue.countDocuments({ studentId }),
      CampusIssue.countDocuments({ studentId, status: { $nin: ['Resolved', 'Closed'] } }),
      DocumentRequest.countDocuments({ studentId }),
      EventRegistration.countDocuments({ studentId, status: 'Registered' }),
      Notification.countDocuments({ recipientId: studentId, isRead: false })
    ]);

    res.status(200).json({
      success: true,
      data: {
        leavesCount,
        pendingLeavesCount,
        complaintsCount,
        issuesCount,
        openIssuesCount,
        documentsCount,
        eventRegistrationsCount,
        unreadNotificationsCount
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdminOverview,
  getAdminUsersAnalytics,
  getAdminLeavesAnalytics,
  getAdminIssuesAnalytics,
  getAdminComplaintsAnalytics,
  getAdminDocumentsAnalytics,
  getAdminEventsAnalytics,
  getAdminAnnouncementsAnalytics,
  getFacultyOverview,
  getStudentOverview
};
