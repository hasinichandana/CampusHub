const mongoose = require('mongoose');

const eventRegistrationSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event ID is required']
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student ID is required']
    },
    registeredAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['Registered', 'Cancelled'],
      default: 'Registered'
    },
    cancelledAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Compound Unique Index: Prevent duplicate registration for the same student and event
eventRegistrationSchema.index({ eventId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('EventRegistration', eventRegistrationSchema);
