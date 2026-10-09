const mongoose = require('mongoose');

const campusIssueSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student ID (reporter) is required']
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department ID is required']
    },
    title: {
      type: String,
      required: [true, 'Issue title is required'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters']
    },
    category: {
      type: String,
      enum: {
        values: [
          'Garbage/waste',
          'Potholes',
          'Streetlights',
          'Water',
          'Drainage',
          'Classroom',
          'Laboratory',
          'Electrical',
          'Internet/Wi-Fi',
          'Other'
        ],
        message: '{VALUE} is not a valid campus issue category'
      },
      required: [true, 'Category is required']
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true
    },
    image: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['Reported', 'Assigned', 'In Progress', 'Resolved', 'Closed'],
      default: 'Reported'
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    assignedAt: {
      type: Date
    },
    resolutionRemarks: {
      type: String,
      trim: true,
      default: ''
    },
    resolvedAt: {
      type: Date
    },
    closedAt: {
      type: Date
    },
    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('CampusIssue', campusIssueSchema);
