const ActivityLog = require('../models/ActivityLog');

/**
 * Safely log an activity in the database without throwing errors
 */
const logActivity = async ({
  req,
  userId,
  action,
  module,
  entityType,
  entityId,
  description,
  metadata
}) => {
  try {
    const user = userId || (req && req.user ? req.user._id : null);
    if (!user || !action || !module || !description) {
      return null;
    }

    // Sanitize metadata to remove any password or token fields
    let safeMetadata;
    if (metadata) {
      try {
        safeMetadata = JSON.parse(JSON.stringify(metadata));
        if (typeof safeMetadata === 'object') {
          delete safeMetadata.password;
          delete safeMetadata.token;
          delete safeMetadata.secret;
        }
      } catch (e) {
        safeMetadata = undefined;
      }
    }

    const ipAddress = req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '') : '';
    const userAgent = req ? (req.headers['user-agent'] || '') : '';

    const log = await ActivityLog.create({
      userId: user,
      action,
      module,
      entityType,
      entityId,
      description,
      metadata: safeMetadata,
      ipAddress,
      userAgent
    });

    return log;
  } catch (err) {
    console.error('[Activity Logger Error]: Failed to log activity:', err.message);
    return null;
  }
};

module.exports = {
  logActivity
};
