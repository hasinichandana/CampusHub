const express = require('express');
const router = express.Router();
const {
  createLeaveRequest,
  getLeaves,
  getLeaveById,
  updateLeaveStatus,
  cancelLeaveRequest
} = require('../controllers/leaveController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.post('/', protect, authorize('student', 'admin'), upload.single('supportingDocument'), createLeaveRequest);
router.get('/', protect, getLeaves);
router.get('/:id', protect, getLeaveById);
router.patch('/:id/status', protect, authorize('faculty', 'admin'), updateLeaveStatus);
router.patch('/:id/cancel', protect, cancelLeaveRequest);

module.exports = router;
