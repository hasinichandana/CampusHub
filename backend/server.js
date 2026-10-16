const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const dns = require('node:dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const { protect } = require('./middleware/authMiddleware');
const { authorize } = require('./middleware/roleMiddleware');

mongoose.set('bufferCommands', false);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static Uploads Configuration:
// 1. Non-confidential public assets (campus issue maintenance photos & event posters)
app.use('/uploads/issues', express.static(path.join(__dirname, 'uploads/issues')));
app.use('/uploads/issues', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Issue image '${req.path.replace(/^\//, '')}' not found on server`
  });
});

app.use('/uploads/events', express.static(path.join(__dirname, 'uploads/events')));
app.use('/uploads/events', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Event poster '${req.path.replace(/^\//, '')}' not found on server`
  });
});

// 2. Explicitly block direct static access to confidential student/academic upload folders
const protectedUploadFolders = ['leaves', 'documents', 'generated', 'complaints', 'academic-resources'];
protectedUploadFolders.forEach((folder) => {
  app.use(`/uploads/${folder}`, (req, res) => {
    res.status(403).json({
      success: false,
      message: `Direct access to /uploads/${folder} is forbidden. Use the authenticated API download endpoint.`
    });
  });
});

// 3. Fallback 404 handler for any other /uploads path
app.use('/uploads', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Upload file not found - ${req.originalUrl}`
  });
});

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

  if (dbState !== 1 || !mongoose.connection.db) {
    return res.status(503).json({
      success: false,
      message: 'Database is not connected',
      data: {
        server: 'online',
        database: dbStatusMap[dbState] || 'unknown',
        timestamp: new Date().toISOString()
      }
    });
  }

  try {
    const [
      departmentCount,
      userCount,
      pendingLeavesCount,
      openIssuesCount,
      activeComplaintsCount,
      pendingDocumentsCount,
      upcomingEventsCount,
      publishedAnnouncementsCount
    ] = await Promise.all([
      Department.countDocuments(),
      User.countDocuments(),
      LeaveRequest.countDocuments({ status: 'Pending' }),
      CampusIssue.countDocuments({ status: { $ne: 'Closed' } }),
      Complaint.countDocuments({ status: { $ne: 'Closed' } }),
      DocumentRequest.countDocuments({ status: { $in: ['Pending', 'Under Review'] } }),
      Event.countDocuments({ status: 'Published' }),
      Announcement.countDocuments({ status: 'Published' })
    ]);

    return res.status(200).json({
      success: true,
      message: 'CampusHub API Server is running',
      data: {
        server: 'online',
        database: dbStatusMap[dbState],
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
  } catch (error) {
    return res.status(503).json({
      success: false,
      message: 'Database health check failed',
      data: {
        server: 'online',
        database: 'error',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Phase 2 Database Diagnostic Verification Endpoint
app.get('/api/test/db', protect, authorize('admin'), async (req, res) => {
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
  const statusCode = err.statusCode
    || (err.code === 'LIMIT_FILE_SIZE' ? 413 : err.name === 'MulterError' ? 400 : 500);
  res.status(statusCode).json({
    success: false,
    message: statusCode < 500 ? err.message : 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  const connection = await connectDB();
  if (connection.readyState !== 1 || !connection.db) {
    throw new Error('Refusing to start HTTP server before MongoDB is ready');
  }

  const server = app.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`🚀 CampusHub Server running on port ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
    console.log(`=================================`);
  });

  return server;
};

if (require.main === module) {
  startServer().catch((error) => {
    console.error(`CampusHub startup failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { app, startServer };
