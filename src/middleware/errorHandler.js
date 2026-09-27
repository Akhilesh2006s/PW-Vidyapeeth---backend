import { ZodError } from 'zod';
import multer from 'multer';
import { env } from '../config/env.js';

export function notFound(_req, res) {
  res.status(404).json({ message: 'Not found' });
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      field: issue.path.filter((part) => part !== 'body' && part !== 'query' && part !== 'params').join('.'),
      message: issue.message,
    }));
    const message = details.map((issue) => (issue.field ? `${issue.field}: ${issue.message}` : issue.message)).join(' ');
    res.status(400).json({ message: message || 'Validation failed', details });
    return;
  }
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Recording exceeds the 25 MB limit' : err.message;
    res.status(400).json({ message });
    return;
  }
  if (err.code === 11000) {
    res.status(409).json({ message: 'A record with that value already exists' });
    return;
  }
  if (err.code === 8000) {
    res.status(503).json({
      message: 'MongoDB Atlas is at its collection limit, so PW Vidyapeeth could not create its collections. Free up collections on the cluster or upgrade the plan, then try again.',
    });
    return;
  }
  if (err.name === 'CastError') {
    res.status(400).json({ message: 'Invalid id' });
    return;
  }
  const status = err.statusCode || 500;
  const message =
    status >= 500 && env.nodeEnv === 'production' ? 'Internal server error' : err.message || 'Internal server error';
  if (status >= 500) console.error(err);
  res.status(status).json({ message });
}
