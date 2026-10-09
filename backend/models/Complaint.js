const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student ID is required']
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department ID is required']
    },
    category: {
      type: String,
      enum: {
        values: [
          'Academic',
          'Hostel',
          'Canteen',
          'Infrastructure',
          'Harassment',
          'Fee/Financial',
          'Disciplinary',
          'Administrative',
          'Other'
        ],
        message: '{VALUE} is not a valid complaint category'
      },
      required: [true, 'Category is required']
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      maxlength: [150, 'Subject cannot exceed 150 characters']
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [1500, 'Description cannot exceed 1500 characters']
    },
    attachment: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['Submitted', 'Assigned', 'In Progress', 'Resolved', 'Closed'],
      default: 'Submitted'
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    response: {
      type: String,
      trim: true,
      default: ''
    },
    assignedAt: {
      type: Date
    },
    resolvedAt: {
      type: Date
    },
    closedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Complaint', complaintSchema);
