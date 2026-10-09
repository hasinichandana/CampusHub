const express = require('express');
const router = express.Router();
const {
  createComplaint,
  getComplaints,
  getComplaintById,
  assignComplaint,
  updateComplaintStatus
} = require('../controllers/complaintController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.post('/', protect, authorize('student', 'admin'), upload.single('attachment'), createComplaint);
router.get('/', protect, getComplaints);
router.get('/:id', protect, getComplaintById);
router.patch('/:id/assign', protect, authorize('admin'), assignComplaint);
router.patch('/:id/status', protect, authorize('faculty', 'admin'), updateComplaintStatus);

module.exports = router;
