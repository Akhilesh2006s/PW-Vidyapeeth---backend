import bcrypt from 'bcryptjs';
import { Counsellor, User } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { signToken } from '../middleware/auth.js';

function publicUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone || '',
    preferredLanguage: user.preferredLanguage,
    mustChangePassword: Boolean(user.mustChangePassword),
    createdAt: user.createdAt,
  };
}

async function createCounsellorUser(input, mustChangePassword) {
  const email = input.email.toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) throw new AppError('An account with this email already exists', 409);
  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await User.create({
    name: input.name,
    email,
    passwordHash,
    role: 'counsellor',
    phone: input.phone || '',
    preferredLanguage: input.preferredLanguage || 'en',
    mustChangePassword,
  });
  try {
    const counsellor = await Counsellor.create({
      user: user._id,
      employeeCode: `PW-${String(user._id).slice(-6).toUpperCase()}`,
      jobTitle: input.jobTitle || 'Counsellor',
      languages: ['en', 'te'],
      specializations: ['admissions'],
    });
    return { user, counsellor };
  } catch (error) {
    await User.deleteOne({ _id: user._id });
    throw error;
  }
}

export async function registerAccount(input) {
  const { user, counsellor } = await createCounsellorUser(input, false);
  return { token: signToken(user), user: publicUser(user), counsellor };
}

export async function createStaffAccount(input) {
  const { user, counsellor } = await createCounsellorUser(input, true);
  return {
    ...publicUser(user),
    employeeCode: counsellor.employeeCode,
    jobTitle: counsellor.jobTitle,
    active: counsellor.active,
  };
}

export async function loginAccount({ email, password }) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user) throw new AppError('Invalid email or password', 401);
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) throw new AppError('Invalid email or password', 401);
  const counsellor = user.role === 'counsellor' ? await Counsellor.findOne({ user: user._id }) : null;
  return { token: signToken(user), user: publicUser(user), counsellor };
}

export async function currentAccount(userId) {
  const user = await User.findById(userId);
  if (!user) throw new AppError('Account not found', 401);
  const counsellor = user.role === 'counsellor' ? await Counsellor.findOne({ user: user._id }) : null;
  return { user: publicUser(user), counsellor };
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw new AppError('Account not found', 404);
  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) throw new AppError('Current password is incorrect', 400);
  const reused = await bcrypt.compare(newPassword, user.passwordHash);
  if (reused) throw new AppError('Choose a password different from your current password', 400);
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.mustChangePassword = false;
  await user.save();
  return publicUser(user);
}

export async function listStaffAccounts() {
  const users = await User.find().sort({ createdAt: -1 });
  const counsellors = await Counsellor.find({ user: { $in: users.map((user) => user._id) } });
  const byUser = new Map(counsellors.map((item) => [String(item.user), item]));
  return users.map((user) => {
    const counsellor = byUser.get(String(user._id));
    return {
      ...publicUser(user),
      employeeCode: counsellor?.employeeCode || '',
      jobTitle: user.role === 'admin' ? 'Super Admin' : counsellor?.jobTitle || 'Counsellor',
      active: counsellor?.active ?? true,
    };
  });
}
