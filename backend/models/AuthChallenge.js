const mongoose = require('mongoose');

const authChallengeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    purpose: {
      type: String,
      enum: ['EMAIL_VERIFICATION', 'PASSWORD_RESET', 'TWO_FACTOR_LOGIN', 'TWO_FACTOR_SETUP'],
      required: true,
      index: true
    },
    codeHash: {
      type: String,
      required: true,
      select: false
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }
    },
    attempts: {
      type: Number,
      default: 0
    },
    consumedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('AuthChallenge', authChallengeSchema);
