const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    action: {
      type: String,
      required: true,
      enum: [
        'CREATE',
        'UPDATE',
        'DELETE',
        'LOGIN',
        'LOGOUT',
        'APPROVE',
        'REJECT',
        'ASSIGN',
        'RESOLVE',
        'CLOSE',
        'REGISTER',
        'CANCEL',
        'PUBLISH',
        'ARCHIVE',
        'DOWNLOAD'
      ],
      index: true
    },
    module: {
      type: String,
      required: true,
      enum: [
        'AUTH',
        'USER',
        'LEAVE',
        'ISSUE',
        'COMPLAINT',
        'DOCUMENT',
        'EVENT',
        'ANNOUNCEMENT',
        'NOTIFICATION',
        'SYSTEM',
        'ACADEMIC_RESOURCE'
      ],
      index: true
    },
    entityType: {
      type: String,
      trim: true
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed
    },
    ipAddress: {
      type: String,
      default: ''
    },
    userAgent: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);
