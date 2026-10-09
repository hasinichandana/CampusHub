const express = require('express');
const router = express.Router();
const {
  createResource,
  getResources,
  getResourceById,
  downloadResource,
  updateResource,
  deleteResource,
  updateResourceStatus
} = require('../controllers/academicResourceController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const academicResourceUpload = require('../middleware/academicResourceUploadMiddleware');

router.get('/', protect, getResources);
router.post('/', protect, authorize('faculty', 'admin'), academicResourceUpload.single('file'), createResource);
router.get('/:id', protect, getResourceById);
router.get('/:id/download', protect, downloadResource);
router.put('/:id', protect, authorize('faculty', 'admin'), academicResourceUpload.single('file'), updateResource);
router.delete('/:id', protect, authorize('faculty', 'admin'), deleteResource);
router.patch('/:id/status', protect, authorize('admin'), updateResourceStatus);

module.exports = router;
