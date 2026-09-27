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
    createdAt: user.createdAt,
  };
}

export async function registerAccount(input) {
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
  });
  const counsellor = await Counsellor.create({
    user: user._id,
    employeeCode: `MC-${String(user._id).slice(-6).toUpperCase()}`,
    languages: ['en', 'te'],
    specializations: ['admissions'],
  });
  return { token: signToken(user), user: publicUser(user), counsellor };
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
