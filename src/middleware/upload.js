import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    fs.mkdirSync(env.uploadDir, { recursive: true });
    cb(null, env.uploadDir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.webm';
    const safeExt = ['.webm', '.wav', '.mp3', '.mpeg', '.mp4', '.m4a', '.ogg', '.oga'].includes(ext) ? ext : '.webm';
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${safeExt}`);
  },
});

function fileFilter(_req, file, cb) {
  const type = file.mimetype || '';
  if (type.startsWith('audio/') || type === 'video/webm' || type === 'application/octet-stream') {
    cb(null, true);
    return;
  }
  cb(new AppError('Upload an audio recording', 400));
}

export const audioUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 },
});

export function assertInsideUpload(filePath) {
  const root = path.resolve(env.uploadDir);
  const resolved = path.resolve(filePath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new AppError('Invalid storage path', 400);
  }
  return resolved;
}

export async function removeStoredFile(filePath) {
  if (!filePath) return;
  try {
    const resolved = assertInsideUpload(filePath);
    await fs.promises.unlink(resolved);
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Failed to remove audio file:', error.message);
  }
}
