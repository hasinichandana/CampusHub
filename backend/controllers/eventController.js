const Event = require('../models/Event');
const EventRegistration = require('../models/EventRegistration');
const User = require('../models/User');
const { createNotification, notifyManyUsers } = require('../utils/notificationHelper');
const { logActivity } = require('../utils/activityLogger');

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
      maxParticipants: maxParticipants || 0,
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

    const searchTerm = q || search;
    if (searchTerm) {
      query.$or = [
        { title: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } }
      ];
    }

    if (dateFrom || dateTo) {
      query.eventDate = {};
      if (dateFrom) query.eventDate.$gte = new Date(dateFrom);
      if (dateTo) query.eventDate.$lte = new Date(dateTo);
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const total = await Event.countDocuments(query);
    const events = await Event.find(query)
      .populate('createdBy', 'name email role')
      .populate('departmentId', 'name code')
      .sort({ eventDate: 1 })
      .skip(skip)
      .limit(limitNum);

    res.status(200).json({
      success: true,
      count: events.length,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1
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

    const updatedEvent = await Event.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    })
      .populate('createdBy', 'name email role')
      .populate('departmentId', 'name code');

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

    await Event.findByIdAndDelete(req.params.id);
    await EventRegistration.deleteMany({ eventId: req.params.id });

    res.status(200).json({
      success: true,
      message: 'Event deleted successfully'
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
