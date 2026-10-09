const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to Database
connectDB();

const path = require('path');

// Static Uploads Folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const authRoutes = require('./routes/authRoutes');
const testRbacRoutes = require('./routes/testRbacRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const issueRoutes = require('./routes/issueRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const documentRoutes = require('./routes/documentRoutes');
const eventRoutes = require('./routes/eventRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const userRoutes = require('./routes/userRoutes');
const activityLogRoutes = require('./routes/activityLogRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const academicResourceRoutes = require('./routes/academicResourceRoutes');

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/test/rbac', testRbacRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/academic-resources', academicResourceRoutes);

const Department = require('./models/Department');
const User = require('./models/User');
const LeaveRequest = require('./models/LeaveRequest');
const CampusIssue = require('./models/CampusIssue');
const Complaint = require('./models/Complaint');
const DocumentRequest = require('./models/DocumentRequest');
const Event = require('./models/Event');
const Announcement = require('./models/Announcement');

// Health-check API endpoint
app.get('/api/health', async (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  let departmentCount = 0;
  let userCount = 0;
  let pendingLeavesCount = 0;
  let openIssuesCount = 0;
  let activeComplaintsCount = 0;
  let pendingDocumentsCount = 0;
  let upcomingEventsCount = 0;
  let publishedAnnouncementsCount = 0;

  if (dbState === 1) {
    try {
      departmentCount = await Department.countDocuments();
      userCount = await User.countDocuments();
      pendingLeavesCount = await LeaveRequest.countDocuments({ status: 'Pending' });
      openIssuesCount = await CampusIssue.countDocuments({ status: { $ne: 'Closed' } });
      activeComplaintsCount = await Complaint.countDocuments({ status: { $ne: 'Closed' } });
      pendingDocumentsCount = await DocumentRequest.countDocuments({ status: { $in: ['Pending', 'Under Review'] } });
      upcomingEventsCount = await Event.countDocuments({ status: 'Published' });
      publishedAnnouncementsCount = await Announcement.countDocuments({ status: 'Published' });
    } catch (e) {
      // Ignore count errors if DB warming up
    }
  }

  res.status(200).json({
    success: true,
    message: 'CampusHub API Server is running',
    data: {
      server: 'online',
      database: dbStatusMap[dbState] || 'unknown',
      environment: process.env.NODE_ENV || 'development',
      departmentsCount: departmentCount,
      usersCount: userCount,
      pendingLeavesCount,
      openIssuesCount,
      activeComplaintsCount,
      pendingDocumentsCount,
      upcomingEventsCount,
      publishedAnnouncementsCount,
      timestamp: new Date().toISOString()
    }
  });
});

// Phase 2 Database Diagnostic Verification Endpoint
app.get('/api/test/db', async (req, res) => {
  try {
    const departments = await Department.find();
    const users = await User.find().populate('departmentId', 'name code');

    res.status(200).json({
      success: true,
      message: 'Phase 2 Database foundation verified successfully',
      data: {
        totalDepartments: departments.length,
        totalUsers: users.length,
        departments: departments,
        users: users
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to query database',
      error: error.message
    });
  }
});

// 404 Route Handler for undefined endpoints
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route not found - ${req.originalUrl}`
  });
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(`[Error Handler]: ${err.stack}`);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`🚀 CampusHub Server running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log(`=================================`);
});
