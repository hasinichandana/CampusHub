const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const validateUploadedFile = require('../middleware/validateUploadedFile');
const {
  createLeaveRequest,
  canAccessLeaveDocument,
  getSafeLeaveDocumentPath
} = require('../controllers/leaveController');

const createUpload = async (fileName, contents, t) => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'campushub-leave-test-'));
  t.after(() => fs.promises.rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, fileName);
  await fs.promises.writeFile(filePath, contents);
  return { originalname: fileName, path: filePath };
};

const runUploadValidator = async (file) => {
  let responseStatus;
  let responseBody;
  let nextCalled = false;
  const response = {
    status(status) {
      responseStatus = status;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    }
  };
  let middlewareError;

  await validateUploadedFile(
    { file },
    response,
    (error) => {
      if (error) middlewareError = error;
      else nextCalled = true;
    }
  );

  if (middlewareError) throw middlewareError;
  return { responseStatus, responseBody, nextCalled };
};

test('accepts a PDF whose content matches its extension', async (t) => {
  const file = await createUpload('certificate.pdf', Buffer.from('%PDF-1.7'), t);
  const result = await runUploadValidator(file);

  assert.equal(result.nextCalled, true);
  assert.equal(result.responseStatus, undefined);
  assert.equal(fs.existsSync(file.path), true);
});

test('rejects and removes a file whose content does not match its extension', async (t) => {
  const file = await createUpload('certificate.pdf', Buffer.from('not a PDF'), t);
  const result = await runUploadValidator(file);

  assert.equal(result.nextCalled, false);
  assert.equal(result.responseStatus, 400);
  assert.match(result.responseBody.message, /does not match/i);
  assert.equal(fs.existsSync(file.path), false);
});

test('rejects and removes unsupported file extensions', async (t) => {
  const file = await createUpload('certificate.exe', Buffer.from('MZ'), t);
  const result = await runUploadValidator(file);

  assert.equal(result.responseStatus, 400);
  assert.match(result.responseBody.message, /Unsupported supporting document type/);
  assert.equal(fs.existsSync(file.path), false);
});

test('removes an uploaded file when the leave request is incomplete', async (t) => {
  const file = await createUpload('certificate.pdf', Buffer.from('%PDF-1.7'), t);
  let responseStatus;
  let responseBody;
  let middlewareError;
  const response = {
    status(status) {
      responseStatus = status;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    }
  };

  await createLeaveRequest(
    { body: {}, file },
    response,
    error => { middlewareError = error; }
  );

  assert.equal(middlewareError, undefined);
  assert.equal(responseStatus, 400);
  assert.match(responseBody.message, /fromDate/);
  assert.equal(fs.existsSync(file.path), false);
});

test('restricts leave attachment paths to the leave upload directory', () => {
  const safePath = getSafeLeaveDocumentPath('uploads/leaves/certificate.pdf');
  assert.equal(
    safePath,
    path.resolve(__dirname, '../uploads/leaves/certificate.pdf')
  );
  assert.equal(getSafeLeaveDocumentPath('uploads/leaves/../../.env'), null);
  assert.equal(getSafeLeaveDocumentPath('uploads/documents/certificate.pdf'), null);
});

test('allows only the leave owner, same-department faculty, and admins to download', () => {
  const leave = { studentId: 'student-1', departmentId: 'dept-1' };

  assert.equal(canAccessLeaveDocument(leave, { _id: 'student-1', role: 'student' }), true);
  assert.equal(canAccessLeaveDocument(leave, { _id: 'student-2', role: 'student' }), false);
  assert.equal(canAccessLeaveDocument(leave, { departmentId: 'dept-1', role: 'faculty' }), true);
  assert.equal(canAccessLeaveDocument(leave, { departmentId: 'dept-2', role: 'faculty' }), false);
  assert.equal(canAccessLeaveDocument(leave, { role: 'admin' }), true);
  assert.equal(canAccessLeaveDocument(leave, { role: 'unknown' }), false);
});
