const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const LeaveRequest = require('../models/LeaveRequest');
const CampusIssue = require('../models/CampusIssue');
const Complaint = require('../models/Complaint');
const DocumentRequest = require('../models/DocumentRequest');
const Event = require('../models/Event');
const AcademicResource = require('../models/AcademicResource');

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/campushub');

  const leaves = await LeaveRequest.find({ supportingDocument: { $ne: '' } }).select('supportingDocument studentId');
  console.log('--- LEAVES WITH FILES ---');
  console.log(JSON.stringify(leaves, null, 2));

  const issues = await CampusIssue.find({ image: { $ne: '' } }).select('title image studentId');
  console.log('--- ISSUES WITH IMAGES ---');
  console.log(JSON.stringify(issues, null, 2));

  const complaints = await Complaint.find({ attachment: { $ne: '' } }).select('attachment studentId');
  console.log('--- COMPLAINTS WITH ATTACHMENTS ---');
  console.log(JSON.stringify(complaints, null, 2));

  const docs = await DocumentRequest.find({ $or: [{ supportingDocument: { $ne: '' } }, { generatedDocument: { $ne: '' } }] }).select('supportingDocument generatedDocument studentId');
  console.log('--- DOCS WITH FILES ---');
  console.log(JSON.stringify(docs, null, 2));

  const events = await Event.find({ image: { $ne: '' } }).select('title image');
  console.log('--- EVENTS WITH IMAGES ---');
  console.log(JSON.stringify(events, null, 2));

  const resources = await AcademicResource.find().select('title fileName filePath status');
  console.log('--- ACADEMIC RESOURCES ---');
  console.log(JSON.stringify(resources, null, 2));

  await mongoose.disconnect();
}

run().catch(console.error);
