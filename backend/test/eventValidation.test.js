const assert = require('node:assert/strict');
const test = require('node:test');
const { validateEventSchedule } = require('../utils/eventValidation');

test('accepts a valid event schedule and deadline', () => {
  assert.equal(validateEventSchedule({
    eventDate: '2026-11-20T09:00:00.000Z',
    registrationDeadline: '2026-11-19T09:00:00.000Z',
    startTime: '09:00',
    endTime: '10:30'
  }), null);
});

test('rejects invalid dates and a deadline after the event', () => {
  const schedule = {
    eventDate: '2026-11-20T09:00:00.000Z',
    registrationDeadline: '2026-11-21T09:00:00.000Z',
    startTime: '09:00',
    endTime: '10:30'
  };
  assert.match(validateEventSchedule(schedule), /deadline cannot be after the event/);
  assert.match(validateEventSchedule({ ...schedule, eventDate: 'invalid' }), /must be valid/);
});

test('rejects malformed or non-increasing event times', () => {
  const schedule = {
    eventDate: '2026-11-20T09:00:00.000Z',
    registrationDeadline: '2026-11-19T09:00:00.000Z',
    startTime: '10:00',
    endTime: '10:00'
  };
  assert.match(validateEventSchedule(schedule), /HH:MM format/);
  assert.match(validateEventSchedule({ ...schedule, startTime: '9:00' }), /HH:MM format/);
});
