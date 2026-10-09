const express = require('express');
const router = express.Router();
const {
  createIssue,
  getIssues,
  getIssueById,
  assignIssue,
  updateIssueStatus
} = require('../controllers/issueController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.post('/', protect, authorize('student', 'admin'), upload.single('image'), createIssue);
router.get('/', protect, getIssues);
router.get('/:id', protect, getIssueById);
router.patch('/:id/assign', protect, authorize('admin'), assignIssue);
router.patch('/:id/status', protect, authorize('faculty', 'admin'), updateIssueStatus);

module.exports = router;
