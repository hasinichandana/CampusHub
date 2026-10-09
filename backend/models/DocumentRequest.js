const mongoose = require('mongoose');

const documentRequestSchema = new mongoose.Schema(
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
    documentType: {
      type: String,
      enum: {
        values: [
          'Bonafide Certificate',
          'Study Certificate',
          'Course Completion Certificate',
          'Transfer Certificate',
          'Fee Receipt Copy',
          'Character Certificate',
          'Transcript Request',
          'Other'
        ],
        message: '{VALUE} is not a valid document type'
      },
      required: [true, 'Document type is required']
    },
    purpose: {
      type: String,
      required: [true, 'Purpose is required'],
      trim: true,
      maxlength: [500, 'Purpose cannot exceed 500 characters']
    },
    supportingDocument: {
      type: String,
      default: ''
    },
    generatedDocument: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['Pending', 'Under Review', 'Approved', 'Rejected', 'Completed'],
      default: 'Pending'
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    remarks: {
      type: String,
      trim: true,
      default: ''
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: {
      type: Date
    },
    completedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('DocumentRequest', documentRequestSchema);
