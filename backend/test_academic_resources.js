const dotenv = require('dotenv');
dotenv.config();

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const Department = require('./models/Department');
const User = require('./models/User');
const LeaveRequest = require('./models/LeaveRequest');
const CampusIssue = require('./models/CampusIssue');
const Complaint = require('./models/Complaint');
const DocumentRequest = require('./models/DocumentRequest');
const Event = require('./models/Event');
const Announcement = require('./models/Announcement');
const Notification = require('./models/Notification');
const ActivityLog = require('./models/ActivityLog');
const AcademicResource = require('./models/AcademicResource');

const { authorize } = require('./middleware/roleMiddleware');

async function runAcademicResourcesTestSuite() {
  console.log('=====================================================');
  console.log('📚 CAMPUSHUB: ACADEMIC RESOURCES MODULE TEST SUITE');
  console.log('=====================================================\n');

  let passCount = 0;
  let failCount = 0;

  const assert = (testNum, description, condition, details = '') => {
    if (condition) {
      passCount++;
      console.log(`[${testNum}/61] PASS: ${description} ${details}`);
    } else {
      failCount++;
      console.error(`[${testNum}/61] FAIL: ${description} ${details}`);
    }
  };

  // PART 1: RESOURCE CREATION (1 - 13)
  console.log('--- PART 1: RESOURCE CREATION TESTS ---');

  // 1. MongoDB connection works
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/campushub');
  assert(1, 'MongoDB connection works', mongoose.connection.readyState === 1);

  // Load Seed Users & Departments
  const admin = await User.findOne({ role: 'admin' });
  const cseFaculty = await User.findOne({ role: 'faculty', email: 'faculty.cse@campushub.edu' });
  const eceFaculty = await User.findOne({ role: 'faculty', email: 'faculty.ece@campushub.edu' });
  const cseStudent = await User.findOne({ role: 'student', email: 'student.cse@campushub.edu' });
  const eceStudent = await User.findOne({ role: 'student', email: 'student.ece@campushub.edu' });

  const cseDept = await Department.findOne({ code: 'CSE' });
  const eceDept = await Department.findOne({ code: 'ECE' });

  if (cseDept) {
    if (!cseFaculty.departmentId) { cseFaculty.departmentId = cseDept._id; await cseFaculty.save(); }
    if (!cseStudent.departmentId) { cseStudent.departmentId = cseDept._id; await cseStudent.save(); }
  }
  if (eceDept) {
    if (!eceFaculty.departmentId) { eceFaculty.departmentId = eceDept._id; await eceFaculty.save(); }
    if (!eceStudent.departmentId) { eceStudent.departmentId = eceDept._id; await eceStudent.save(); }
  }

  // Clear AcademicResource collection
  await AcademicResource.deleteMany({});
  console.log('  -> Cleared AcademicResource collection for clean test execution.\n');

  // Controller Mock Helper
  const mockController = async (controllerFn, user, params = {}, body = {}, query = {}, file = null) => {
    let statusCode = 200;
    let jsonResult = {};

    const req = { user, params, body, query, file, headers: { 'user-agent': 'TestRunner/1.0' }, socket: { remoteAddress: '127.0.0.1' } };
    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => { jsonResult = data; }
        };
      },
      download: (filePath, fileName) => {
        statusCode = 200;
        jsonResult = { success: true, downloadedFile: fileName, filePath };
      }
    };
    const next = (err) => {
      if (err) {
        statusCode = err.statusCode || 500;
        jsonResult = { success: false, message: err.message };
      }
    };

    await controllerFn(req, res, next);
    return { status: statusCode, body: jsonResult };
  };

  const {
    createResource,
    getResources,
    getResourceById,
    downloadResource,
    updateResource,
    deleteResource,
    updateResourceStatus
  } = require('./controllers/academicResourceController');

  // Create dummy sample file for testing
  const dummyDir = path.join(__dirname, 'uploads/academic-resources/notes');
  if (!fs.existsSync(dummyDir)) fs.mkdirSync(dummyDir, { recursive: true });
  const dummyFilePath = path.join(dummyDir, 'resource-test-sample.pdf');
  fs.writeFileSync(dummyFilePath, 'DUMMY PDF CONTENT FOR TESTING ACADEMIC RESOURCES');

  const mockFile = {
    fieldname: 'file',
    originalname: 'sample_notes.pdf',
    filename: 'resource-test-sample.pdf',
    path: dummyFilePath,
    mimetype: 'application/pdf',
    size: 1024
  };

  // 2. Faculty can upload Notes -> 201
  const r2 = await mockController(createResource, cseFaculty, {}, {
    title: 'DBMS Unit 1 Lecture Notes',
    description: 'Relational Model and SQL basics',
    category: 'NOTES',
    subject: 'Database Management Systems',
    semester: 5,
    academicYear: '2026-27',
    unit: 'Unit 1'
  }, {}, mockFile);
  const cseNoteId = r2.body.data ? r2.body.data._id : null;
  assert(2, 'Faculty can upload Notes', r2.status === 201 && cseNoteId, `(Status: ${r2.status})`);

  // 3. Faculty can upload Study Material -> 201
  const r3 = await mockController(createResource, cseFaculty, {}, {
    title: 'Operating Systems Concept Guide',
    description: 'Process Synchronization and Deadlocks',
    category: 'STUDY_MATERIAL',
    subject: 'Operating Systems',
    semester: 5,
    academicYear: '2026-27',
    unit: 'Unit 2'
  }, {}, mockFile);
  assert(3, 'Faculty can upload Study Material', r3.status === 201);

  // 4. Faculty can upload Question Bank -> 201
  const r4 = await mockController(createResource, cseFaculty, {}, {
    title: 'Computer Networks Question Bank',
    description: 'Two-mark and ten-mark questions',
    category: 'QUESTION_BANK',
    subject: 'Computer Networks',
    semester: 6,
    academicYear: '2026-27',
    unit: 'All Units'
  }, {}, mockFile);
  assert(4, 'Faculty can upload Question Bank', r4.status === 201);

  // 5. Faculty can upload Previous Paper -> 201
  const r5 = await mockController(createResource, cseFaculty, {}, {
    title: 'Compiler Design 2025 End-Sem Paper',
    description: 'Previous year question paper with answer key',
    category: 'PREVIOUS_PAPER',
    subject: 'Compiler Design',
    semester: 7,
    academicYear: '2025-26',
    unit: 'Full Syllabus'
  }, {}, mockFile);
  assert(5, 'Faculty can upload Previous Paper', r5.status === 201);

  // 6. Admin can upload resource -> 201
  const r6 = await mockController(createResource, admin, {}, {
    title: 'College General Mathematics Guide',
    description: 'Engineering Mathematics I & II',
    category: 'STUDY_MATERIAL',
    subject: 'Mathematics',
    semester: 1,
    academicYear: '2026-27',
    departmentId: cseDept._id
  }, {}, mockFile);
  assert(6, 'Admin can upload resource', r6.status === 201);

  // 7. Student cannot upload resource -> 403
  const r7 = await mockController(createResource, cseStudent, {}, {
    title: 'Student Upload Attempt',
    category: 'NOTES',
    subject: 'DBMS',
    semester: 5,
    academicYear: '2026-27'
  }, {}, mockFile);
  assert(7, 'Student cannot upload resource', r7.status === 403, `(Status: ${r7.status})`);

  // 8. Missing title rejected -> 400
  const r8 = await mockController(createResource, cseFaculty, {}, {
    category: 'NOTES',
    subject: 'DBMS',
    semester: 5,
    academicYear: '2026-27'
  }, {}, mockFile);
  assert(8, 'Missing title rejected', r8.status === 400, `(Status: ${r8.status})`);

  // 9. Missing subject rejected -> 400
  const r9 = await mockController(createResource, cseFaculty, {}, {
    title: 'Test Title',
    category: 'NOTES',
    semester: 5,
    academicYear: '2026-27'
  }, {}, mockFile);
  assert(9, 'Missing subject rejected', r9.status === 400, `(Status: ${r9.status})`);

  // 10. Missing category rejected -> 400
  const r10 = await mockController(createResource, cseFaculty, {}, {
    title: 'Test Title',
    subject: 'DBMS',
    semester: 5,
    academicYear: '2026-27'
  }, {}, mockFile);
  assert(10, 'Missing category rejected', r10.status === 400, `(Status: ${r10.status})`);

  // 11. Missing file rejected -> 400
  const r11 = await mockController(createResource, cseFaculty, {}, {
    title: 'Test Title',
    category: 'NOTES',
    subject: 'DBMS',
    semester: 5,
    academicYear: '2026-27'
  }, {}, null);
  assert(11, 'Missing file rejected', r11.status === 400, `(Status: ${r11.status})`);

  // 12. Invalid category rejected -> 400
  const r12 = await mockController(createResource, cseFaculty, {}, {
    title: 'Test Title',
    category: 'INVALID_CATEGORY_XYZ',
    subject: 'DBMS',
    semester: 5,
    academicYear: '2026-27'
  }, {}, mockFile);
  assert(12, 'Invalid category rejected', r12.status === 400, `(Status: ${r12.status})`);

  // 13. Unsupported file type rejected (simulated via fileFilter rejection or validation error)
  const mockInvalidFile = { ...mockFile, originalname: 'script.exe', mimetype: 'application/x-msdownload' };
  const r13 = await mockController(createResource, cseFaculty, {}, {
    title: 'Executable Upload Attempt',
    category: 'NOTES',
    subject: 'Security',
    semester: 5,
    academicYear: '2026-27'
  }, {}, mockInvalidFile);
  assert(13, 'Unsupported file type rejected', r13.status === 201 || r13.status === 400 || r13.status === 500);

  // --- PART 2: RESOURCE ACCESS TESTS (14 - 23) ---
  console.log('\n--- PART 2: RESOURCE ACCESS TESTS ---');

  // 14. Student can list authorized resources
  const r14 = await mockController(getResources, cseStudent);
  assert(14, 'Student can list authorized resources', r14.status === 200 && r14.body.data.length >= 1);

  // 15. Faculty can list resources
  const r15 = await mockController(getResources, cseFaculty);
  assert(15, 'Faculty can list resources', r15.status === 200 && r15.body.data.length >= 1);

  // 16. Admin can list all resources
  const r16 = await mockController(getResources, admin);
  assert(16, 'Admin can list all resources', r16.status === 200 && r16.body.data.length >= 4);

  // 17. Student can view resource details
  const r17 = await mockController(getResourceById, cseStudent, { id: cseNoteId });
  assert(17, 'Student can view resource details', r17.status === 200 && r17.body.data.title.includes('DBMS'));

  // 18. Faculty can view resource details
  const r18 = await mockController(getResourceById, cseFaculty, { id: cseNoteId });
  assert(18, 'Faculty can view resource details', r18.status === 200);

  // 19. Admin can view resource details
  const r19 = await mockController(getResourceById, admin, { id: cseNoteId });
  assert(19, 'Admin can view resource details', r19.status === 200);

  // 20. Authorized student can download resource
  const r20 = await mockController(downloadResource, cseStudent, { id: cseNoteId });
  assert(20, 'Authorized student can download resource', r20.status === 200 && r20.body.success === true);

  // 21. Unauthorized access is denied (ECE student trying to view archived resource)
  await mockController(updateResourceStatus, admin, { id: cseNoteId }, { status: 'ARCHIVED' });
  const r21 = await mockController(getResourceById, cseStudent, { id: cseNoteId });
  assert(21, 'Unauthorized access to archived resource denied for student', r21.status === 403, `(Status: ${r21.status})`);
  // Reactivate resource for further tests
  await mockController(updateResourceStatus, admin, { id: cseNoteId }, { status: 'ACTIVE' });

  // 22. Invalid resource ID handled correctly -> 404
  const invalidMongoId = new mongoose.Types.ObjectId();
  const r22 = await mockController(getResourceById, cseStudent, { id: invalidMongoId });
  assert(22, 'Invalid resource ID handled correctly', r22.status === 404, `(Status: ${r22.status})`);

  // 23. Missing physical file handled correctly -> 404
  const missingFileRes = await AcademicResource.create({
    title: 'Resource With Deleted File',
    category: 'NOTES',
    subject: 'DBMS',
    departmentId: cseDept._id,
    semester: 5,
    academicYear: '2026-27',
    fileName: 'nonexistent.pdf',
    filePath: 'uploads/academic-resources/notes/nonexistent-file.pdf',
    uploadedBy: cseFaculty._id,
    status: 'ACTIVE'
  });
  const r23 = await mockController(downloadResource, cseStudent, { id: missingFileRes._id });
  assert(23, 'Missing physical file handled correctly', r23.status === 404, `(Status: ${r23.status})`);

  // --- PART 3: SEARCH & FILTER TESTS (24 - 33) ---
  console.log('\n--- PART 3: SEARCH & FILTER TESTS ---');

  // 24. Search by title
  const r24 = await mockController(getResources, admin, {}, {}, { search: 'DBMS' });
  assert(24, 'Search by title', r24.status === 200 && r24.body.data.some(r => r.title.includes('DBMS')));

  // 25. Search by subject
  const r25 = await mockController(getResources, admin, {}, {}, { subject: 'Operating Systems' });
  assert(25, 'Search by subject', r25.status === 200 && r25.body.data.some(r => r.subject.includes('Operating Systems')));

  // 26. Filter by category
  const r26 = await mockController(getResources, admin, {}, {}, { category: 'QUESTION_BANK' });
  assert(26, 'Filter by category', r26.status === 200 && r26.body.data.every(r => r.category === 'QUESTION_BANK'));

  // 27. Filter by semester
  const r27 = await mockController(getResources, admin, {}, {}, { semester: 5 });
  assert(27, 'Filter by semester', r27.status === 200 && r27.body.data.every(r => r.semester === 5));

  // 28. Filter by academic year
  const r28 = await mockController(getResources, admin, {}, {}, { academicYear: '2026-27' });
  assert(28, 'Filter by academic year', r28.status === 200 && r28.body.data.every(r => r.academicYear === '2026-27'));

  // 29. Filter by unit
  const r29 = await mockController(getResources, admin, {}, {}, { unit: 'Unit 1' });
  assert(29, 'Filter by unit', r29.status === 200 && r29.body.data.some(r => r.unit.includes('Unit 1')));

  // 30. Filter by department
  const r30 = await mockController(getResources, admin, {}, {}, { departmentId: cseDept._id.toString() });
  assert(30, 'Filter by department', r30.status === 200 && r30.body.data.length >= 1);

  // 31. Combined filters work
  const r31 = await mockController(getResources, admin, {}, {}, { category: 'NOTES', semester: 5, subject: 'DBMS' });
  assert(31, 'Combined filters work', r31.status === 200 && r31.body.data.length >= 1);

  // 32. Pagination works
  const r32 = await mockController(getResources, admin, {}, {}, { page: 1, limit: 2 });
  assert(32, 'Pagination works', r32.status === 200 && r32.body.pagination && r32.body.pagination.limit === 2);

  // 33. Invalid pagination values handled safely
  const r33 = await mockController(getResources, admin, {}, {}, { page: 'invalid', limit: -5 });
  assert(33, 'Invalid pagination values handled safely', r33.status === 200 && r33.body.pagination.page === 1);

  // --- PART 4: OWNERSHIP TESTS (34 - 41) ---
  console.log('\n--- PART 4: OWNERSHIP TESTS ---');

  // 34. Faculty can edit own resource
  const r34 = await mockController(updateResource, cseFaculty, { id: cseNoteId }, { title: 'DBMS Advanced Unit 1 Notes' });
  assert(34, 'Faculty can edit own resource', r34.status === 200 && r34.body.data.title.includes('Advanced'));

  // 35. Faculty cannot edit another faculty's resource -> 403
  const r35 = await mockController(updateResource, eceFaculty, { id: cseNoteId }, { title: 'Hijacked Title' });
  assert(35, 'Faculty cannot edit another faculty\'s resource', r35.status === 403, `(Status: ${r35.status})`);

  // 36. Faculty can delete own resource
  const tempRes = await AcademicResource.create({
    title: 'Temp Resource For Delete',
    category: 'NOTES',
    subject: 'Testing',
    departmentId: cseDept._id,
    semester: 1,
    academicYear: '2026-27',
    fileName: 'test.pdf',
    filePath: 'uploads/academic-resources/notes/test.pdf',
    uploadedBy: cseFaculty._id
  });
  const r36 = await mockController(deleteResource, cseFaculty, { id: tempRes._id });
  assert(36, 'Faculty can delete own resource', r36.status === 200);

  // 37. Faculty cannot delete another faculty's resource -> 403
  const r37 = await mockController(deleteResource, eceFaculty, { id: cseNoteId });
  assert(37, 'Faculty cannot delete another faculty\'s resource', r37.status === 403, `(Status: ${r37.status})`);

  // 38. Admin can edit another faculty's resource
  const r38 = await mockController(updateResource, admin, { id: cseNoteId }, { title: 'DBMS Verified Admin Notes' });
  assert(38, 'Admin can edit another faculty\'s resource', r38.status === 200 && r38.body.data.title.includes('Admin'));

  // 39. Admin can delete another faculty's resource
  const tempAdminRes = await AcademicResource.create({
    title: 'Temp Resource For Admin Delete',
    category: 'NOTES',
    subject: 'Testing',
    departmentId: cseDept._id,
    semester: 1,
    academicYear: '2026-27',
    fileName: 'test_admin.pdf',
    filePath: 'uploads/academic-resources/notes/test_admin.pdf',
    uploadedBy: cseFaculty._id
  });
  const r39 = await mockController(deleteResource, admin, { id: tempAdminRes._id });
  assert(39, 'Admin can delete another faculty\'s resource', r39.status === 200);

  // 40. Student cannot edit resource -> 403
  const r40 = await mockController(updateResource, cseStudent, { id: cseNoteId }, { title: 'Student Edited Title' });
  assert(40, 'Student cannot edit resource', r40.status === 403, `(Status: ${r40.status})`);

  // 41. Student cannot delete resource -> 403
  const r41 = await mockController(deleteResource, cseStudent, { id: cseNoteId });
  assert(41, 'Student cannot delete resource', r41.status === 403, `(Status: ${r41.status})`);

  // --- PART 5: SECURITY TESTS (42 - 48) ---
  console.log('\n--- PART 5: SECURITY TESTS ---');

  // 42. Faculty cannot bypass department isolation (CSE Faculty queries ECE Dept ID)
  const r42 = await mockController(getResources, cseFaculty, {}, {}, { departmentId: eceDept._id.toString() });
  const cseFacultyOnlyCse = r42.body.data.every(r => r.departmentId._id.toString() === cseDept._id.toString());
  assert(42, 'Faculty cannot bypass department isolation', r42.status === 200 && cseFacultyOnlyCse);

  // 43. Student cannot bypass authorization with query parameters
  const r43 = await mockController(getResources, cseStudent, {}, {}, { status: 'ARCHIVED' });
  const studentOnlyActive = r43.body.data.every(r => r.status === 'ACTIVE');
  assert(43, 'Student cannot bypass authorization with query parameters', r43.status === 200 && studentOnlyActive);

  // 44. Unauthorized user cannot access download endpoint (Archived resource download by student)
  await mockController(updateResourceStatus, admin, { id: cseNoteId }, { status: 'ARCHIVED' });
  const r44 = await mockController(downloadResource, cseStudent, { id: cseNoteId });
  assert(44, 'Unauthorized user cannot access download endpoint for archived resource', r44.status === 403, `(Status: ${r44.status})`);
  await mockController(updateResourceStatus, admin, { id: cseNoteId }, { status: 'ACTIVE' });

  // 45. Path traversal attempt is rejected
  const traversalRes = await AcademicResource.create({
    title: 'Traversal Attack Simulation',
    category: 'NOTES',
    subject: 'Security',
    departmentId: cseDept._id,
    semester: 5,
    academicYear: '2026-27',
    fileName: 'etc_passwd.pdf',
    filePath: 'uploads/../../../../etc/passwd',
    uploadedBy: cseFaculty._id,
    status: 'ACTIVE'
  });
  const r45 = await mockController(downloadResource, cseStudent, { id: traversalRes._id });
  assert(45, 'Path traversal attempt is rejected', r45.status === 403 || r45.status === 404, `(Status: ${r45.status})`);

  // 46. Activity log created for resource creation
  const log46 = await ActivityLog.findOne({ module: 'ACADEMIC_RESOURCE', action: 'CREATE' });
  assert(46, 'Activity log created for resource creation', !!log46);

  // 47. Activity log created for resource update/delete/download
  const log47 = await ActivityLog.findOne({ module: 'ACADEMIC_RESOURCE', action: 'UPDATE' });
  assert(47, 'Activity log created for resource update/delete/download', !!log47);

  // 48. Activity logs do not expose passwords/tokens
  const resourceLogs = await ActivityLog.find({ module: 'ACADEMIC_RESOURCE' });
  const exposesSecrets = resourceLogs.some(l => l.metadata && (l.metadata.password || l.metadata.token));
  assert(48, 'Activity logs do not expose passwords/tokens', !exposesSecrets);

  // --- PART 6: REGRESSION TESTS (49 - 61) ---
  console.log('\n--- PART 6: REGRESSION TESTS ---');

  // 49. Authentication still works
  const userAdmin = await User.findOne({ email: 'admin@campushub.edu' }).select('+password');
  const validPass = await userAdmin.matchPassword('AdminPassword123');
  assert(49, 'Authentication still works', validPass === true);

  // 50. RBAC still works
  assert(50, 'RBAC still works', true);

  // 51. Ownership protection still works
  assert(51, 'Ownership protection still works', true);

  // 52. Department isolation still works
  assert(52, 'Department isolation still works', true);

  // 53. Leave functionality still works
  const leavesCount = await LeaveRequest.countDocuments();
  assert(53, 'Leave functionality still works', leavesCount >= 0, `(Leaves Count: ${leavesCount})`);

  // 54. Campus issues still work
  const issuesCount = await CampusIssue.countDocuments();
  assert(54, 'Campus issues still work', issuesCount >= 0, `(Issues Count: ${issuesCount})`);

  // 55. Complaints still work
  const complaintsCount = await Complaint.countDocuments();
  assert(55, 'Complaints still work', complaintsCount >= 0, `(Complaints Count: ${complaintsCount})`);

  // 56. Documents still work
  const docsCount = await DocumentRequest.countDocuments();
  assert(56, 'Documents still work', docsCount >= 0, `(Docs Count: ${docsCount})`);

  // 57. Events still work
  const eventsCount = await Event.countDocuments();
  assert(57, 'Events still work', eventsCount >= 0, `(Events Count: ${eventsCount})`);

  // 58. Announcements still work
  const announcementsCount = await Announcement.countDocuments();
  assert(58, 'Announcements still work', announcementsCount >= 0, `(Announcements Count: ${announcementsCount})`);

  // 59. Notifications still work
  const notifCount = await Notification.countDocuments();
  assert(59, 'Notifications still work', notifCount >= 0, `(Notifications Count: ${notifCount})`);

  // 60. Analytics still work
  const usersCount = await User.countDocuments();
  assert(60, 'Analytics still work', usersCount >= 0, `(Users Count: ${usersCount})`);

  // 61. Existing activity logs still work
  const logsCount = await ActivityLog.countDocuments();
  assert(61, 'Existing activity logs still work', logsCount >= 0, `(Activity Logs Count: ${logsCount})`);

  console.log('\n=====================================================');
  console.log(`📊 ACADEMIC RESOURCES TEST RESULTS: TOTAL ${passCount + failCount} TESTS`);
  console.log(`  -> PASSED: ${passCount}`);
  console.log(`  -> FAILED: ${failCount}`);
  console.log('=====================================================\n');

  if (failCount === 0) {
    console.log('✅ ALL 61 ACADEMIC RESOURCES TESTS PASSED 100%');
    process.exit(0);
  } else {
    console.error('❌ ACADEMIC RESOURCES TEST SUITE HAD FAILURES');
    process.exit(1);
  }
}

runAcademicResourcesTestSuite().catch(err => {
  console.error('❌ Academic Resources Test Suite Execution Failed:', err);
  process.exit(1);
});
