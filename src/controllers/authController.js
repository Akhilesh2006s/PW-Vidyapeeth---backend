import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, registerSchema } from '../validators/schemas.js';
import * as authService from '../services/authService.js';
import { User } from '../models/index.js';
import { requireAdmin } from '../middleware/auth.js';

export const register = [validate(registerSchema), asyncHandler(async (req, res) => {
  const data = await authService.registerAccount(req.validated.body);
  res.status(201).json({ data });
})];

export const login = [validate(loginSchema), asyncHandler(async (req, res) => {
  const data = await authService.loginAccount(req.validated.body);
  res.json({ data });
})];

export const me = asyncHandler(async (req, res) => {
  const data = await authService.currentAccount(req.user.id);
  res.json({ data });
});

export const listUsers = [requireAdmin, asyncHandler(async (_req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json({ data: users });
})];
