const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Announcement title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters']
    },
    content: {
      type: String,
      required: [true, 'Announcement content is required'],
      trim: true,
      maxlength: [3000, 'Content cannot exceed 3000 characters']
    },
    type: {
      type: String,
      enum: {
        values: ['General', 'Academic', 'Exam', 'Event', 'Emergency', 'Urgent', 'Other'],
        message: '{VALUE} is not a valid announcement type'
      },
      default: 'General'
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department'
    },
    audience: {
      type: String,
      enum: {
        values: ['College', 'Department'],
        message: '{VALUE} is not a valid audience type'
      },
      default: 'College'
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'CreatedBy user ID is required']
    },
    status: {
      type: String,
      enum: ['Draft', 'Published', 'Archived'],
      default: 'Draft'
    },
    publishAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Pre-validate helper: Ensure publishAt <= expiresAt
announcementSchema.pre('validate', function (next) {
  if (this.publishAt && this.expiresAt && new Date(this.publishAt) > new Date(this.expiresAt)) {
    this.invalidate('publishAt', 'Publish date (publishAt) cannot be after expiration date (expiresAt)');
  }
  next();
});

module.exports = mongoose.model('Announcement', announcementSchema);
