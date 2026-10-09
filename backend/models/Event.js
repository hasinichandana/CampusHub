const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters']
    },
    description: {
      type: String,
      required: [true, 'Event description is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters']
    },
    eventType: {
      type: String,
      enum: {
        values: ['Academic', 'Cultural', 'Sports', 'Workshop', 'Seminar', 'Placement', 'Departmental', 'Other'],
        message: '{VALUE} is not a valid event type'
      },
      required: [true, 'Event type is required']
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department'
    },
    venue: {
      type: String,
      required: [true, 'Venue is required'],
      trim: true
    },
    eventDate: {
      type: Date,
      required: [true, 'Event date is required']
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required'],
      trim: true
    },
    endTime: {
      type: String,
      required: [true, 'End time is required'],
      trim: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'CreatedBy user ID is required']
    },
    status: {
      type: String,
      enum: ['Draft', 'Published', 'Cancelled', 'Completed'],
      default: 'Draft'
    },
    maxParticipants: {
      type: Number,
      default: 0 // 0 means unlimited
    },
    registrationDeadline: {
      type: Date,
      required: [true, 'Registration deadline is required']
    },
    image: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Event', eventSchema);
