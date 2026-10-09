// Department Access Control Middleware

const checkDepartmentAccess = (getDeptIdFromReq = (req) => req.params.departmentId || req.body.departmentId) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required before department authorization'
      });
    }

    // Admin has system-wide access across all departments
    if (req.user.role === 'admin') {
      return next();
    }

    const targetDeptId = getDeptIdFromReq(req);

    if (!targetDeptId) {
      return res.status(400).json({
        success: false,
        message: 'Target department ID is missing from request context'
      });
    }

    // Ensure user has a department assigned
    const userDeptId = req.user.departmentId?._id || req.user.departmentId;

    if (!userDeptId) {
      return res.status(403).json({
        success: false,
        message: 'User does not belong to any department'
      });
    }

    if (userDeptId.toString() !== targetDeptId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Access restricted to your assigned department'
      });
    }

    next();
  };
};

module.exports = { checkDepartmentAccess };
