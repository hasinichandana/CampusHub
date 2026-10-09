const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload subdirectories exist
const dirs = ['leaves', 'issues', 'complaints', 'documents', 'generated'];
dirs.forEach(dir => {
  const dirPath = path.join(__dirname, `../uploads/${dir}`);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'image') {
      cb(null, path.join(__dirname, '../uploads/issues'));
    } else if (file.fieldname === 'attachment') {
      cb(null, path.join(__dirname, '../uploads/complaints'));
    } else if (file.fieldname === 'generatedDocument') {
      cb(null, path.join(__dirname, '../uploads/generated'));
    } else if (file.fieldname === 'supportingDocument') {
      // Check path endpoint to differentiate leave vs document request if needed
      if (req.originalUrl && req.originalUrl.includes('/documents')) {
        cb(null, path.join(__dirname, '../uploads/documents'));
      } else {
        cb(null, path.join(__dirname, '../uploads/leaves'));
      }
    } else {
      cb(null, path.join(__dirname, '../uploads/documents'));
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

// File Filter
const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type '${ext}'. Allowed types: PDF, DOC, DOCX, PNG, JPG, JPEG`), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB
  },
  fileFilter
});

module.exports = upload;
