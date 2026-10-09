// Ownership Authorization Middleware

const checkOwnership = (Model, idParam = 'id', ownerField = 'userId') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required before ownership verification'
        });
      }

      // Admin bypasses ownership checks
      if (req.user.role === 'admin') {
        return next();
      }

      const resourceId = req.params[idParam];
      if (!resourceId) {
        return res.status(400).json({
          success: false,
          message: `Missing URL parameter '${idParam}' for ownership verification`
        });
      }

      const resource = await Model.findById(resourceId);
      if (!resource) {
        return res.status(404).json({
          success: false,
          message: 'Resource not found'
        });
      }

      // Support field lookup or fallback to studentId / createdBy / userId
      const resourceOwnerId =
        resource[ownerField] ||
        resource.userId ||
        resource.studentId ||
        resource.createdBy;

      if (!resourceOwnerId) {
        return res.status(403).json({
          success: false,
          message: 'Unable to determine resource owner'
        });
      }

      if (resourceOwnerId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You do not own this resource'
        });
      }

      // Attach resource to request for downstream handlers
      req.resource = resource;
      next();
    } catch (error) {
      console.error('Ownership Middleware Error:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Server error during ownership verification'
      });
    }
  };
};

module.exports = { checkOwnership };
