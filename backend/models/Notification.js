const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      required: true,
      enum: ['LEAVE', 'ISSUE', 'COMPLAINT', 'DOCUMENT', 'EVENT', 'ANNOUNCEMENT', 'SYSTEM']
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    relatedEntityType: {
      type: String,
      enum: ['LeaveRequest', 'CampusIssue', 'Complaint', 'DocumentRequest', 'Event', 'Announcement']
    },
    relatedEntityId: {
      type: mongoose.Schema.Types.ObjectId
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true
    },
    readAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Notification', NotificationSchema);
