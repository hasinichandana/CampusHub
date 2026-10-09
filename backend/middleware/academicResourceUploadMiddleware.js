const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Category to subdirectory mapping
const categoryDirMap = {
  NOTES: 'notes',
  STUDY_MATERIAL: 'study-materials',
  QUESTION_BANK: 'question-banks',
  PREVIOUS_PAPER: 'previous-papers'
};

// Ensure base upload directory and category subdirectories exist
const baseDir = path.join(__dirname, '../uploads/academic-resources');
if (!fs.existsSync(baseDir)) {
  fs.mkdirSync(baseDir, { recursive: true });
}

Object.values(categoryDirMap).forEach(subDir => {
  const dirPath = path.join(baseDir, subDir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const category = req.body.category ? req.body.category.toUpperCase() : 'NOTES';
    const subFolder = categoryDirMap[category] || 'notes';
    const targetPath = path.join(__dirname, `../uploads/academic-resources/${subFolder}`);
    cb(null, targetPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `resource-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.png', '.jpg', '.jpeg'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type '${ext}'. Allowed file types: PDF, DOC, DOCX, PPT, PPTX, PNG, JPG, JPEG`), false);
  }
};

const academicResourceUpload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25 MB
  },
  fileFilter
});

module.exports = academicResourceUpload;
