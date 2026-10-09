const express = require('express');
const router = express.Router();
const {
  createAnnouncement,
  getAnnouncements,
  getAnnouncementById,
  updateAnnouncement,
  deleteAnnouncement,
  updateAnnouncementStatus
} = require('../controllers/announcementController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.post('/', protect, authorize('faculty', 'admin'), createAnnouncement);
router.get('/', protect, getAnnouncements);
router.get('/:id', protect, getAnnouncementById);
router.put('/:id', protect, authorize('faculty', 'admin'), updateAnnouncement);
router.delete('/:id', protect, authorize('faculty', 'admin'), deleteAnnouncement);
router.patch('/:id/status', protect, authorize('faculty', 'admin'), updateAnnouncementStatus);

module.exports = router;
