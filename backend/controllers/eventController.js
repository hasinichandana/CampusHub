const Event = require('../models/Event');
const EventRegistration = require('../models/EventRegistration');
const User = require('../models/User');
const { createNotification, notifyManyUsers } = require('../utils/notificationHelper');
const { logActivity } = require('../utils/activityLogger');
const { addTextSearch, parsePagination } = require('../utils/queryFilters');
const { validateEventSchedule } = require('../utils/eventValidation');

const VALID_EVENT_TRANSITIONS = {
  Draft: ['Published', 'Cancelled'],
  Published: ['Completed', 'Cancelled'],
  Cancelled: [],
  Completed: []
};

// @desc    Create a new event (Faculty, Admin)
// @route   POST /api/events
// @access  Private (Faculty, Admin)
const createEvent = async (req, res, next) => {
  try {
    if (req.user.role === 'student') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Students cannot create events'
      });
    }

    const {
      title,
      description,
      eventType,
      departmentId,
      venue,
      eventDate,
      startTime,
      endTime,
      status,
      maxParticipants,
      registrationDeadline
    } = req.body;

    if (!title || !description || !eventType || !venue || !eventDate || !startTime || !endTime || !registrationDeadline) {
      return res.status(400).json({
        success: false,
        message: 'Please provide title, description, eventType, venue, eventDate, startTime, endTime, and registrationDeadline'
      });
    }

    const scheduleError = validateEventSchedule({
      eventDate,
      registrationDeadline,
      startTime,
      endTime
    });
    if (scheduleError) {
      return res.status(400).json({ success: false, message: scheduleError });
    }

    const participantLimit = maxParticipants === undefined || maxParticipants === ''
      ? 0
      : Number(maxParticipants);
    if (!Number.isSafeInteger(participantLimit) || participantLimit < 0) {
      return res.status(400).json({
        success: false,
        message: 'maxParticipants must be a non-negative whole number'
      });
    }

    let assignedDeptId = departmentId;

    // Faculty rule: Must create department-scoped event
    if (req.user.role === 'faculty') {
      const userDeptId = req.user.departmentId?._id || req.user.departmentId;
      if (!userDeptId) {
        return res.status(403).json({
          success: false,
          message: 'Faculty must belong to a department to create department events'
        });
      }
      assignedDeptId = userDeptId;
    }

    let imagePath = '';
    if (req.file) {
      imagePath = `uploads/events/${req.file.filename}`;
    }

    const event = await Event.create({
      title,
      description,
      eventType,
      departmentId: assignedDeptId || undefined,
      venue,
      eventDate,
      startTime,
      endTime,
      createdBy: req.user._id,
      status: status || 'Draft',
      maxParticipants: participantLimit,
      registrationDeadline,
      image: imagePath
    });

    const populatedEvent = await Event.findById(event._id)
      .populate('createdBy', 'name email role')
      .populate('departmentId', 'name code');

    // Audit Activity Log
    await logActivity({
      req,
      action: 'CREATE',
      module: 'EVENT',
      entityType: 'Event',
      entityId: event._id,
      description: `Created event: "${title}"`
    });

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: populatedEvent
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get list of events (Filtered by role)
// @route   GET /api/events
// @access  Private
const getEvents = async (req, res, next) => {
  try {
    let query = {};
    const { status, eventType, departmentId, q, search, dateFrom, dateTo, page, limit } = req.query;

    if (req.user.role === 'student') {
      // Students can ONLY view Published events
      query.status = 'Published';
    } else if (req.user.role === 'faculty') {
      // Faculty can view Published events OR events created by themselves
      if (status) {
        query.status = status;
        if (status !== 'Published') {
          query.createdBy = req.user._id;
        }
      } else {
        query.$or = [
          { status: 'Published' },
          { createdBy: req.user._id }
        ];
      }
    } else if (req.user.role === 'admin') {
      if (status) query.status = status;
      if (departmentId) query.departmentId = departmentId;
    }

    if (eventType) query.eventType = eventType;

    const searchError = addTextSearch(query, q || search, ['title', 'description']);
    if (searchError) {
      return res.status(400).json({ success: false, message: searchError });
    }

    if (dateFrom || dateTo) {
      query.eventDate = {};
      if (dateFrom) query.eventDate.$gte = new Date(dateFrom);
      if (dateTo) query.eventDate.$lte = new Date(dateTo);
    }

    const pagination = parsePagination(page, limit);
    if (!pagination) {
      return res.status(400).json({ success: false, message: 'page must be positive and limit must be between 1 and 100' });
    }

    const total = await Event.countDocuments(query);
    const events = await Event.find(query)
      .populate('createdBy', 'name email role')
      .populate('departmentId', 'name code')
      .sort({ eventDate: 1 })
      .skip(pagination.skip)
      .limit(pagination.limit);

    res.status(200).json({
      success: true,
      count: events.length,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit) || 1
      },
      data: events
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single event by ID
// @route   GET /api/events/:id
// @access  Private
const getEventById = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('createdBy', 'name email role')
      .populate('departmentId', 'name code');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Role checks
    if (req.user.role === 'student' && event.status !== 'Published') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Students can only view published events'
      });
    }

    if (
      req.user.role === 'faculty' &&
      event.status !== 'Published' &&
      event.createdBy._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Faculty can only view unpublished events they created'
      });
    }

    res.status(200).json({
      success: true,
      data: event
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update event (Faculty owner, Admin)
// @route   PUT /api/events/:id
// @access  Private (Faculty, Admin)
const updateEvent = async (req, res, next) => {
  try {
    if (req.user.role === 'student') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Students cannot edit events'
      });
    }

    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Ownership check for Faculty
    if (req.user.role === 'faculty' && event.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only edit events created by yourself'
      });
    }

    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({
        success: false,
        message: 'Event updates must be a JSON object'
      });
    }

    const allowedFields = [
      'title',
      'description',
      'eventType',
      'venue',
      'eventDate',
      'startTime',
      'endTime',
      'maxParticipants',
      'registrationDeadline'
    ];
    if (req.user.role === 'admin') allowedFields.push('departmentId');

    const unsupportedFields = Object.keys(req.body).filter(field => !allowedFields.includes(field));
    if (unsupportedFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Unsupported event fields: ${unsupportedFields.join(', ')}`
      });
    }

    if (Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Provide at least one event field to update'
      });
    }

    const scheduleFields = ['eventDate', 'registrationDeadline', 'startTime', 'endTime'];
    if (scheduleFields.some(field => req.body[field] !== undefined)) {
      const scheduleError = validateEventSchedule({
        eventDate: req.body.eventDate || event.eventDate,
        registrationDeadline: req.body.registrationDeadline || event.registrationDeadline,
        startTime: req.body.startTime || event.startTime,
        endTime: req.body.endTime || event.endTime
      });
      if (scheduleError) {
        return res.status(400).json({ success: false, message: scheduleError });
      }
    }

    if (req.body.maxParticipants !== undefined) {
      const participantLimit = Number(req.body.maxParticipants);
      if (!Number.isSafeInteger(participantLimit) || participantLimit < 0) {
        return res.status(400).json({
          success: false,
          message: 'maxParticipants must be a non-negative whole number'
        });
      }
      if (participantLimit > 0) {
        const activeRegistrations = await EventRegistration.countDocuments({
          eventId: event._id,
          status: 'Registered'
        });
        if (participantLimit < activeRegistrations) {
          return res.status(400).json({
            success: false,
            message: 'maxParticipants cannot be lower than the current active registration count'
          });
        }
      }
    }

    const updatedEvent = await Event.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    })
      .populate('createdBy', 'name email role')
      .populate('departmentId', 'name code');

    await logActivity({
      req,
      action: 'UPDATE',
      module: 'EVENT',
      entityType: 'Event',
      entityId: event._id,
      description: `Updated event: "${updatedEvent.title}"`
    });

    res.status(200).json({
      success: true,
      message: 'Event updated successfully',
      data: updatedEvent
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete event (Faculty owner, Admin)
// @route   DELETE /api/events/:id
// @access  Private (Faculty, Admin)
const deleteEvent = async (req, res, next) => {
  try {
    if (req.user.role === 'student') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Students cannot delete events'
      });
    }

    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Ownership check for Faculty
    if (req.user.role === 'faculty' && event.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only delete events created by yourself'
      });
    }

    if (event.status === 'Completed') {
      return res.status(409).json({
        success: false,
        message: 'Completed events cannot be cancelled'
      });
    }

    if (event.status !== 'Cancelled') {
      event.status = 'Cancelled';
      await event.save();

      const activeRegistrations = await EventRegistration.find({
        eventId: event._id,
        status: 'Registered'
      }).select('studentId');
      await notifyManyUsers(activeRegistrations.map(registration => registration.studentId), {
        type: 'EVENT',
        title: 'Event Cancelled',
        message: `The event "${event.title}" has been cancelled.`,
        relatedEntityType: 'Event',
        relatedEntityId: event._id
      });

      await logActivity({
        req,
        action: 'CANCEL',
        module: 'EVENT',
        entityType: 'Event',
        entityId: event._id,
        description: `Cancelled event: "${event.title}"`
      });
    }

    res.status(200).json({
      success: true,
      message: 'Event cancelled successfully; registration history has been retained'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update event status (Faculty owner, Admin)
// @route   PATCH /api/events/:id/status
// @access  Private (Faculty, Admin)
const updateEventStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (req.user.role === 'student') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Students cannot update event status'
      });
    }

    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Faculty Ownership Check
    if (req.user.role === 'faculty' && event.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only update status for events created by yourself'
      });
    }

    // Status Transition Validation
    const allowedTransitions = VALID_EVENT_TRANSITIONS[event.status] || [];
    if (!allowedTransitions.includes(status) && event.status !== status) {
      return res.status(400).json({
        success: false,
        message: `Invalid event status transition from '${event.status}' to '${status}'. Allowed transitions: [${allowedTransitions.join(', ')}]`
      });
    }

    event.status = status;
    await event.save();

    // Notification: If event status changed to Cancelled, notify all registered students!
    if (status === 'Cancelled') {
      const activeRegistrations = await EventRegistration.find({ eventId: event._id, status: 'Registered' });
      const studentIds = activeRegistrations.map(r => r.studentId);
      await notifyManyUsers(studentIds, {
        type: 'EVENT',
        title: 'Event Cancelled',
        message: `The event "${event.title}" scheduled for ${new Date(event.eventDate).toLocaleDateString()} has been cancelled.`,
        relatedEntityType: 'Event',
        relatedEntityId: event._id
      });
    }

    // Audit Activity Log
    await logActivity({
      req,
      action: status === 'Cancelled' ? 'CANCEL' : 'UPDATE',
      module: 'EVENT',
      entityType: 'Event',
      entityId: event._id,
      description: `Updated event status to ${status}`
    });

    res.status(200).json({
      success: true,
      message: `Event status updated to '${status}' successfully`,
      data: event
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Register for an event (Student)
// @route   POST /api/events/:id/register
// @access  Private (Student)
const registerForEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    if (event.status !== 'Published') {
      return res.status(400).json({
        success: false,
        message: `Cannot register for event with status '${event.status}'. Event must be Published.`
      });
    }

    // Deadline check
    if (new Date() > new Date(event.registrationDeadline)) {
      return res.status(400).json({
        success: false,
        message: 'Registration deadline has passed for this event'
      });
    }

    // Capacity Check
    if (event.maxParticipants > 0) {
      const activeCount = await EventRegistration.countDocuments({
        eventId: event._id,
        status: 'Registered'
      });
      if (activeCount >= event.maxParticipants) {
        return res.status(400).json({
          success: false,
          message: 'Event registration capacity has been reached'
        });
      }
    }

    // Check duplicate registration
    const existingRegistration = await EventRegistration.findOne({
      eventId: event._id,
      studentId: req.user._id
    });

    if (existingRegistration) {
      if (existingRegistration.status === 'Registered') {
        return res.status(409).json({
          success: false,
          message: 'You are already registered for this event'
        });
      } else {
        // Re-activate cancelled registration
        existingRegistration.status = 'Registered';
        existingRegistration.registeredAt = new Date();
        existingRegistration.cancelledAt = undefined;
        await existingRegistration.save();

        // Notification: Registration confirmation
        await createNotification({
          recipientId: req.user._id,
          type: 'EVENT',
          title: 'Event Registration Confirmed',
          message: `Your registration for event "${event.title}" has been reactivated.`,
          relatedEntityType: 'Event',
          relatedEntityId: event._id
        });

        return res.status(200).json({
          success: true,
          message: 'Event registration re-activated successfully',
          data: existingRegistration
        });
      }
    }

    const registration = await EventRegistration.create({
      eventId: event._id,
      studentId: req.user._id,
      status: 'Registered'
    });

    // Notification: Registration confirmation
    await createNotification({
      recipientId: req.user._id,
      type: 'EVENT',
      title: 'Event Registration Confirmed',
      message: `You have successfully registered for event "${event.title}".`,
      relatedEntityType: 'Event',
      relatedEntityId: event._id
    });

    // Audit Activity Log
    await logActivity({
      req,
      action: 'REGISTER',
      module: 'EVENT',
      entityType: 'Event',
      entityId: event._id,
      description: `Registered for event "${event.title}"`
    });

    res.status(201).json({
      success: true,
      message: 'Registered for event successfully',
      data: registration
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'You are already registered for this event'
      });
    }
    next(error);
  }
};

// @desc    Cancel event registration (Student)
// @route   PATCH /api/events/:id/register/cancel
// @access  Private (Student)
const cancelRegistration = async (req, res, next) => {
  try {
    const registration = await EventRegistration.findOne({
      eventId: req.params.id,
      studentId: req.user._id
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Event registration not found'
      });
    }

    if (registration.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Registration is already cancelled'
      });
    }

    registration.status = 'Cancelled';
    registration.cancelledAt = new Date();
    await registration.save();

    res.status(200).json({
      success: true,
      message: 'Event registration cancelled successfully',
      data: registration
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current student's registered events
// @route   GET /api/events/registrations/me
// @access  Private (Student)
const getMyRegistrations = async (req, res, next) => {
  try {
    const registrations = await EventRegistration.find({
      studentId: req.user._id,
      status: 'Registered'
    })
      .populate({
        path: 'eventId',
        populate: [
          { path: 'createdBy', select: 'name email' },
          { path: 'departmentId', select: 'name code' }
        ]
      })
      .sort({ registeredAt: -1 });

    res.status(200).json({
      success: true,
      count: registrations.length,
      data: registrations
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get registrations for an event (Faculty owner, Admin)
// @route   GET /api/events/:id/registrations
// @access  Private (Faculty, Admin)
const getEventRegistrations = async (req, res, next) => {
  try {
    if (req.user.role === 'student') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Students cannot access event registration roster'
      });
    }

    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Faculty Ownership Check
    if (req.user.role === 'faculty' && event.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Faculty can only view registrations for events they created'
      });
    }

    const registrations = await EventRegistration.find({ eventId: req.params.id })
      .populate('studentId', 'name email phone')
      .sort({ registeredAt: -1 });

    res.status(200).json({
      success: true,
      count: registrations.length,
      data: registrations
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  updateEventStatus,
  registerForEvent,
  cancelRegistration,
  getMyRegistrations,
  getEventRegistrations
};
