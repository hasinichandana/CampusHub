const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema(
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
    fromDate: {
      type: Date,
      required: [true, 'Leave start date (fromDate) is required']
    },
    toDate: {
      type: Date,
      required: [true, 'Leave end date (toDate) is required']
    },
    leaveType: {
      type: String,
      enum: {
        values: ['Sick Leave', 'Casual Leave', 'Academic Leave', 'Duty Leave', 'Medical Leave', 'Casual', 'Medical', 'Other'],
        message: '{VALUE} is not a valid leave type'
      },
      required: [true, 'Leave type is required']
    },
    reason: {
      type: String,
      required: [true, 'Reason for leave is required'],
      trim: true,
      maxlength: [500, 'Reason cannot exceed 500 characters']
    },
    supportingDocument: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'],
      default: 'Pending'
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: {
      type: Date
    },
    reviewerRemarks: {
      type: String,
      trim: true,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

// Validation helper: Ensure fromDate <= toDate
leaveRequestSchema.pre('validate', function (next) {
  if (this.fromDate && this.toDate && new Date(this.fromDate) > new Date(this.toDate)) {
    this.invalidate('fromDate', 'Start date (fromDate) cannot be after end date (toDate)');
  }
  next();
});

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
