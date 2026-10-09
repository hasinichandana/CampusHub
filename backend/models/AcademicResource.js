const mongoose = require('mongoose');

const academicResourceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Resource title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters']
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: ['NOTES', 'STUDY_MATERIAL', 'QUESTION_BANK', 'PREVIOUS_PAPER'],
        message: '{VALUE} is not a valid academic resource category'
      }
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department ID is required']
    },
    semester: {
      type: Number,
      required: [true, 'Semester is required'],
      min: [1, 'Semester must be at least 1'],
      max: [10, 'Semester cannot exceed 10']
    },
    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
      trim: true
    },
    unit: {
      type: String,
      trim: true,
      default: ''
    },
    fileName: {
      type: String,
      required: [true, 'File name is required']
    },
    filePath: {
      type: String,
      required: [true, 'File path is required']
    },
    fileType: {
      type: String,
      default: ''
    },
    fileSize: {
      type: Number,
      default: 0
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Uploaded by user ID is required']
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'ARCHIVED'],
      default: 'ACTIVE'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('AcademicResource', academicResourceSchema);
