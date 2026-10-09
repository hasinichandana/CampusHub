const express = require('express');
const router = express.Router();
const {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  updateEventStatus,
  registerForEvent,
  cancelRegistration,
  getMyRegistrations,
  getEventRegistrations
} = require('../controllers/eventController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.post('/', protect, authorize('faculty', 'admin'), upload.single('image'), createEvent);
router.get('/', protect, getEvents);
router.get('/registrations/me', protect, authorize('student'), getMyRegistrations);
router.get('/:id', protect, getEventById);
router.put('/:id', protect, authorize('faculty', 'admin'), updateEvent);
router.delete('/:id', protect, authorize('faculty', 'admin'), deleteEvent);
router.patch('/:id/status', protect, authorize('faculty', 'admin'), updateEventStatus);
router.post('/:id/register', protect, authorize('student', 'admin'), registerForEvent);
router.patch('/:id/register/cancel', protect, authorize('student'), cancelRegistration);
router.get('/:id/registrations', protect, authorize('faculty', 'admin'), getEventRegistrations);

module.exports = router;
