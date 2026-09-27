import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { Counsellor } from '../models/index.js';

export function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new AppError('Sign in required', 401);
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = { id: payload.sub, role: payload.role };
  } catch {
    throw new AppError('Session expired. Sign in again.', 401);
  }
  next();
});

export const attachCounsellor = asyncHandler(async (req, _res, next) => {
  if (req.user.role === 'counsellor') {
    const counsellor = await Counsellor.findOne({ user: req.user.id });
    if (!counsellor) throw new AppError('Counsellor profile not found', 403);
    req.counsellor = counsellor;
  }
  next();
});

export function requireAdmin(req, _res, next) {
  if (req.user.role !== 'admin') {
    next(new AppError('Admin access required', 403));
    return;
  }
  next();
}
