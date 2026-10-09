const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { checkOwnership } = require('../middleware/ownershipMiddleware');
const { checkDepartmentAccess } = require('../middleware/departmentMiddleware');

// 1. Admin-Only Endpoint
router.get('/admin-only', protect, authorize('admin'), (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Access granted: Admin System-Wide Dashboard Area',
    user: { id: req.user._id, role: req.user.role }
  });
});

// 2. Faculty or Admin Endpoint
router.get('/faculty-or-admin', protect, authorize('faculty', 'admin'), (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Access granted: Faculty/Admin Area',
    user: { id: req.user._id, role: req.user.role }
  });
});

// 3. Department-Scoped Endpoint (Faculty access restricted to own department, Admin system-wide)
router.get(
  '/department/:departmentId',
  protect,
  authorize('faculty', 'admin'),
  checkDepartmentAccess(),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: `Access granted: Department ${req.params.departmentId} scope`,
      user: { id: req.user._id, role: req.user.role, departmentId: req.user.departmentId }
    });
  }
);

// 4. Ownership-Scoped Endpoint (Student can access own resource, Admin system-wide)
router.get(
  '/resource/:userId',
  protect,
  checkOwnership(User, 'userId', '_id'),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Access granted: User resource retrieved',
      resourceUser: req.resource.name,
      authenticatedUser: req.user.name
    });
  }
);

module.exports = router;
