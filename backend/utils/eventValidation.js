const validateEventSchedule = ({ eventDate, registrationDeadline, startTime, endTime }) => {
  const eventTimestamp = new Date(eventDate).getTime();
  const deadlineTimestamp = new Date(registrationDeadline).getTime();

  if (
    Number.isNaN(eventTimestamp) ||
    Number.isNaN(deadlineTimestamp) ||
    deadlineTimestamp > eventTimestamp
  ) {
    return 'Event date and registration deadline must be valid, and the deadline cannot be after the event';
  }

  const validTime = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  if (!validTime(startTime) || !validTime(endTime) || endTime <= startTime) {
    return 'Event times must use 24-hour HH:MM format and end after start';
  }

  return null;
};

module.exports = { validateEventSchedule };
