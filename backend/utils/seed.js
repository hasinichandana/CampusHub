const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, '../.env') });

const Department = require('../models/Department');
const User = require('../models/User');

const seedData = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/campushub';
    console.log(`Connecting to MongoDB at: ${mongoUri}...`);
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connection Successful for Seeding.');

    // Step 1: Clear existing data
    console.log('Clearing existing Departments and Users...');
    await Department.deleteMany({});
    await User.deleteMany({});

    // Step 2: Create Departments
    console.log('Seeding initial Departments...');
    const departments = await Department.insertMany([
      {
        name: 'Computer Science and Engineering',
        code: 'CSE',
        description: 'Department of Computer Science & Engineering',
        status: 'active'
      },
      {
        name: 'Electronics and Communication Engineering',
        code: 'ECE',
        description: 'Department of Electronics & Communication',
        status: 'active'
      },
      {
        name: 'Electrical and Electronics Engineering',
        code: 'EEE',
        description: 'Department of Electrical & Electronics',
        status: 'active'
      },
      {
        name: 'Mechanical Engineering',
        code: 'MECH',
        description: 'Department of Mechanical Engineering',
        status: 'active'
      },
      {
        name: 'Civil Engineering',
        code: 'CIVIL',
        description: 'Department of Civil Engineering',
        status: 'active'
      }
    ]);

    console.log(`Successfully created ${departments.length} departments.`);

    // Map department code to ObjectId for easy lookup
    const deptMap = {};
    departments.forEach((d) => {
      deptMap[d.code] = d._id;
    });

    // Step 3: Create Users
    console.log('Seeding initial Demo Users...');
    
    // Note: User.create triggers the pre('save') hook to hash passwords
    const usersData = [
      {
        name: 'System Admin',
        email: 'admin@campushub.edu',
        password: 'AdminPassword123',
        role: 'admin',
        phone: '9876543210',
        status: 'active'
      },
      {
        name: 'Dr. Alan Turing',
        email: 'faculty.cse@campushub.edu',
        password: 'FacultyPassword123',
        role: 'faculty',
        departmentId: deptMap['CSE'],
        phone: '9876543211',
        status: 'active'
      },
      {
        name: 'John Doe',
        email: 'student.cse@campushub.edu',
        password: 'StudentPassword123',
        role: 'student',
        departmentId: deptMap['CSE'],
        phone: '9876543212',
        status: 'active'
      },
      {
        name: 'Prof. Grace Hopper',
        email: 'faculty.ece@campushub.edu',
        password: 'FacultyPassword123',
        role: 'faculty',
        departmentId: deptMap['ECE'],
        phone: '9876543213',
        status: 'active'
      },
      {
        name: 'Jane Smith',
        email: 'student.ece@campushub.edu',
        password: 'StudentPassword123',
        role: 'student',
        departmentId: deptMap['ECE'],
        phone: '9876543214',
        status: 'active'
      }
    ];

    for (const u of usersData) {
      await User.create(u);
    }

    console.log(`Successfully created ${usersData.length} demo users.`);

    // Verify Password Match Functionality
    const testAdmin = await User.findOne({ email: 'admin@campushub.edu' }).select('+password');
    const isMatch = await testAdmin.matchPassword('AdminPassword123');
    console.log(`Password verification test for admin@campushub.edu: ${isMatch ? 'PASSED (Hashed & Matched)' : 'FAILED'}`);

    console.log('==============================================');
    console.log('🌱 SEEDING COMPLETED SUCCESSFULLY!');
    console.log('==============================================');
    console.log('Demo Accounts Created:');
    console.log('1. Admin:   email: admin@campushub.edu       | pass: AdminPassword123');
    console.log('2. Faculty: email: faculty.cse@campushub.edu | pass: FacultyPassword123');
    console.log('3. Student: email: student.cse@campushub.edu | pass: StudentPassword123');
    console.log('==============================================');

    process.exit(0);
  } catch (error) {
    console.error('Seeding Error:', error);
    process.exit(1);
  }
};

seedData();
