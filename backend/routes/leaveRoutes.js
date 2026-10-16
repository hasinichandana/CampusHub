const express = require('express');
const router = express.Router();
const {
  createLeaveRequest,
  getLeaves,
  getLeaveById,
  updateLeaveStatus,
  cancelLeaveRequest,
  downloadLeaveDocument
} = require('../controllers/leaveController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');
const validateUploadedFile = require('../middleware/validateUploadedFile');

router.post('/', protect, authorize('student', 'admin'), upload.single('supportingDocument'), validateUploadedFile, createLeaveRequest);
router.get('/', protect, getLeaves);
router.get('/:id', protect, getLeaveById);
router.get('/:id/download', protect, downloadLeaveDocument);
router.patch('/:id/status', protect, authorize('faculty', 'admin'), updateLeaveStatus);
router.patch('/:id/cancel', protect, cancelLeaveRequest);

module.exports = router;
