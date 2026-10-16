const fs = require('fs');
const path = require('path');

const signatures = {
  '.pdf': [Buffer.from('%PDF-')],
  '.doc': [Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])],
  '.docx': [Buffer.from([0x50, 0x4B, 0x03, 0x04])],
  '.png': [Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])],
  '.jpg': [Buffer.from([0xFF, 0xD8, 0xFF])],
  '.jpeg': [Buffer.from([0xFF, 0xD8, 0xFF])]
};

const validateUploadedFile = async (req, res, next) => {
  try {
    if (!req.file) return next();

    const extension = path.extname(req.file.originalname).toLowerCase();
    const allowedSignatures = signatures[extension];
    if (!allowedSignatures) {
      await fs.promises.unlink(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Unsupported supporting document type. Upload a PDF, DOC, DOCX, PNG, JPG, or JPEG file.'
      });
    }

    const descriptor = await fs.promises.open(req.file.path, 'r');
    const maxSignatureLength = Math.max(...allowedSignatures.map(signature => signature.length));
    const header = Buffer.alloc(maxSignatureLength);
    let bytesRead;
    try {
      ({ bytesRead } = await descriptor.read(header, 0, header.length, 0));
    } finally {
      await descriptor.close();
    }

    const matchesSignature = allowedSignatures.some(signature =>
      bytesRead >= signature.length && header.subarray(0, signature.length).equals(signature)
    );
    if (!matchesSignature) {
      await fs.promises.unlink(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'The uploaded file content does not match its file extension.'
      });
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = validateUploadedFile;
