const express = require('express');
const router = express.Router();
const {
  createDocumentRequest,
  getDocumentRequests,
  getDocumentRequestById,
  updateDocumentStatus,
  uploadCompletedDocument,
  downloadDocumentFile
} = require('../controllers/documentController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.post('/', protect, authorize('student', 'admin'), upload.single('supportingDocument'), createDocumentRequest);
router.get('/', protect, getDocumentRequests);
router.get('/:id', protect, getDocumentRequestById);
router.get('/:id/download', protect, downloadDocumentFile);
router.patch('/:id/status', protect, authorize('faculty', 'admin'), updateDocumentStatus);
router.patch('/:id/complete', protect, authorize('faculty', 'admin'), upload.single('generatedDocument'), uploadCompletedDocument);

module.exports = router;
