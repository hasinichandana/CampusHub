const crypto = require('crypto');
const AuthChallenge = require('../models/AuthChallenge');
const { sendMail } = require('./mailService');

const CHALLENGE_LIFETIME_MS = 10 * 60 * 1000;
const CHALLENGE_LIMIT_PER_HOUR = 5;
const purposes = {
  emailVerification: 'EMAIL_VERIFICATION',
  passwordReset: 'PASSWORD_RESET',
  twoFactorLogin: 'TWO_FACTOR_LOGIN',
  twoFactorSetup: 'TWO_FACTOR_SETUP'
};

const hashCode = (code) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const error = new Error('JWT_SECRET must be configured to protect authentication challenges.');
    error.statusCode = 503;
    throw error;
  }
  return crypto.createHmac('sha256', secret).update(code).digest('hex');
};

const createAndSendChallenge = async (user, purpose) => {
  const recentChallenges = await AuthChallenge.countDocuments({
    userId: user._id,
    purpose,
    createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
  });

  if (recentChallenges >= CHALLENGE_LIMIT_PER_HOUR) {
    const error = new Error('Too many code requests. Please try again later.');
    error.statusCode = 429;
    throw error;
  }

  const code = crypto.randomInt(100000, 1000000).toString();
  const challenge = await AuthChallenge.create({
    userId: user._id,
    purpose,
    codeHash: hashCode(code),
    expiresAt: new Date(Date.now() + CHALLENGE_LIFETIME_MS)
  });

  const subjectByPurpose = {
    EMAIL_VERIFICATION: 'Verify your CampusHub email',
    PASSWORD_RESET: 'Reset your CampusHub password',
    TWO_FACTOR_LOGIN: 'Your CampusHub sign-in code',
    TWO_FACTOR_SETUP: 'Confirm two-step sign-in for CampusHub'
  };
  const actionByPurpose = {
    EMAIL_VERIFICATION: 'verify your email address',
    PASSWORD_RESET: 'reset your password',
    TWO_FACTOR_LOGIN: 'finish signing in',
    TWO_FACTOR_SETUP: 'enable two-step sign-in'
  };
  const subject = subjectByPurpose[purpose];
  const action = actionByPurpose[purpose];

  try {
    await sendMail({
      to: user.email,
      subject,
      text: `Your CampusHub code to ${action} is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
      html: `<p>Your CampusHub code to ${action} is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:6px">${code}</p><p>This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>`
    });
  } catch (error) {
    await AuthChallenge.findByIdAndDelete(challenge._id);
    throw error;
  }

  return challenge;
};

const consumeChallenge = async ({ challengeId, userId, purpose, code }) => {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return false;

  const query = {
    userId,
    purpose,
    consumedAt: null,
    expiresAt: { $gt: new Date() },
    attempts: { $lt: 5 }
  };
  if (challengeId) query._id = challengeId;

  const challenge = await AuthChallenge.findOne(query).select('+codeHash');
  if (!challenge) return false;

  const suppliedHash = hashCode(code);
  const supplied = Buffer.from(suppliedHash, 'hex');
  const expected = Buffer.from(challenge.codeHash, 'hex');
  const isValid = supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);

  if (!isValid) {
    await AuthChallenge.updateOne(
      { _id: challenge._id, consumedAt: null, attempts: { $lt: 5 } },
      { $inc: { attempts: 1 } }
    );
    return false;
  }

  const consumed = await AuthChallenge.findOneAndUpdate(
    { _id: challenge._id, consumedAt: null, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } },
    { $set: { consumedAt: new Date() } },
    { new: true }
  );
  return Boolean(consumed);
};

module.exports = { createAndSendChallenge, consumeChallenge, purposes };
