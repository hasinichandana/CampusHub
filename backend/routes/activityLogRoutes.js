const express = require('express');
const router = express.Router();
const { getActivityLogs, getActivityLogById } = require('../controllers/activityLogController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.get('/', protect, authorize('admin'), getActivityLogs);
router.get('/:id', protect, authorize('admin'), getActivityLogById);

module.exports = router;
