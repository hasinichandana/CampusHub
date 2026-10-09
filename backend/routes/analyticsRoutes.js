const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/analyticsController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.get('/admin/overview', protect, authorize('admin'), getAdminOverview);
router.get('/admin/users', protect, authorize('admin'), getAdminUsersAnalytics);
router.get('/admin/leaves', protect, authorize('admin'), getAdminLeavesAnalytics);
router.get('/admin/issues', protect, authorize('admin'), getAdminIssuesAnalytics);
router.get('/admin/complaints', protect, authorize('admin'), getAdminComplaintsAnalytics);
router.get('/admin/documents', protect, authorize('admin'), getAdminDocumentsAnalytics);
router.get('/admin/events', protect, authorize('admin'), getAdminEventsAnalytics);
router.get('/admin/announcements', protect, authorize('admin'), getAdminAnnouncementsAnalytics);

router.get('/faculty/overview', protect, authorize('faculty'), getFacultyOverview);
router.get('/student/overview', protect, authorize('student'), getStudentOverview);

module.exports = router;
