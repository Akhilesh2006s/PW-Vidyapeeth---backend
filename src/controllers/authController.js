import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { changePasswordSchema, createStaffAccountSchema, loginSchema, registerSchema } from '../validators/schemas.js';
import * as authService from '../services/authService.js';
import { requireAdmin } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export const register = [validate(registerSchema), asyncHandler(async (req, res) => {
  if (!env.allowPublicRegistration) throw new AppError('Accounts are created by the administrator', 403);
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
  const data = await authService.listStaffAccounts();
  res.json({ data });
})];

export const createStaffAccount = [
  requireAdmin,
  validate(createStaffAccountSchema),
  asyncHandler(async (req, res) => {
    const data = await authService.createStaffAccount(req.validated.body);
    res.status(201).json({ data });
  }),
];

export const changePassword = [
  validate(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const data = await authService.changePassword(req.user.id, req.validated.body);
    res.json({ data });
  }),
];
