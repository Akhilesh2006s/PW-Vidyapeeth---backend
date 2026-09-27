import bcrypt from 'bcryptjs';
import { env, assertRuntimeConfig } from '../config/env.js';
import { connectDb, disconnectDb } from '../config/db.js';
import { Admission, Counsellor, CoveragePoint, FollowUp, Parent, Student, User } from '../models/index.js';

assertRuntimeConfig();
await connectDb();

const existing = await User.findOne({ email: env.seed.counsellorEmail.toLowerCase() });
if (existing) {
  console.log(`Seed skipped. ${env.seed.counsellorEmail} already exists.`);
  await disconnectDb();
  process.exit(0);
}

try {

const counsellorPassword = await bcrypt.hash(env.seed.counsellorPassword, 10);
const adminPassword = await bcrypt.hash(env.seed.adminPassword, 10);

const admin = await User.create({
  name: 'PW Vidyapeeth Admin',
  email: env.seed.adminEmail.toLowerCase(),
  passwordHash: adminPassword,
  role: 'admin',
  preferredLanguage: 'en',
});

const counsellorUser = await User.create({
  name: 'Asha Reddy',
  email: env.seed.counsellorEmail.toLowerCase(),
  passwordHash: counsellorPassword,
  role: 'counsellor',
  phone: '9000000000',
  preferredLanguage: 'te',
});

const counsellor = await Counsellor.create({
  user: counsellorUser._id,
  employeeCode: 'MC-DEMO1',
  languages: ['en', 'te'],
  specializations: ['admissions', 'engineering', 'medicine'],
});

const lakshmi = await Parent.create({
  fullName: 'Lakshmi Rao',
  relation: 'mother',
  phone: '9000000001',
  preferredLanguage: 'te',
  notes: 'Prefers Telugu counselling conversations.',
  createdBy: counsellor._id,
});

const suresh = await Parent.create({
  fullName: 'Suresh Mehta',
  relation: 'father',
  phone: '9000000002',
  preferredLanguage: 'en',
  createdBy: counsellor._id,
});

const ananya = await Student.create({
  fullName: 'Ananya Rao',
  grade: 'Class 12',
  targetProgram: 'B.Tech Computer Science',
  preferredLanguage: 'te',
  phone: '9000000011',
  counsellor: counsellor._id,
  parents: [lakshmi._id],
  notes: 'Family is comparing engineering colleges. Speak Telugu in sessions.',
});

const rohan = await Student.create({
  fullName: 'Rohan Mehta',
  grade: 'Class 12',
  targetProgram: 'MBBS',
  preferredLanguage: 'en',
  phone: '9000000012',
  counsellor: counsellor._id,
  parents: [suresh._id],
});

lakshmi.students = [ananya._id];
suresh.students = [rohan._id];
await lakshmi.save();
await suresh.save();

await Admission.create({
  student: ananya._id,
  studentName: ananya.fullName,
  parentName: lakshmi.fullName,
  counsellor: counsellor._id,
  program: 'B.Tech Computer Science',
  intake: '2026',
  stage: 'counselling',
  notes: 'Waiting on scholarship questions from the parent.',
});

await Admission.create({
  student: rohan._id,
  studentName: rohan.fullName,
  parentName: suresh.fullName,
  counsellor: counsellor._id,
  program: 'MBBS',
  intake: '2026',
  stage: 'enquiry',
});

await FollowUp.create({
  student: ananya._id,
  studentName: ananya.fullName,
  assignedTo: counsellor._id,
  action: 'Share the Telugu fee-structure note before the next counselling call.',
  priority: 'high',
  source: 'manual',
  suggestedOwner: 'counsellor',
  status: 'open',
});

const coverageTexts = [
  'Explain the full fee and what is included',
  'Explain scholarships, discounts, and who qualifies',
  'Explain hostel options, cost, and safety',
  'Compare the course or branch the family is choosing',
  'Explain placements, packages, and support',
  'Explain instalments and the payment plan',
  'Explain eligibility, entrance exam, and admission steps',
  'List the documents and the next step to confirm admission',
];
await CoveragePoint.insertMany(coverageTexts.map((text, index) => ({ text, order: index + 1, active: true })));

console.log('Seed complete.');
console.log(`Counsellor: ${env.seed.counsellorEmail} / ${env.seed.counsellorPassword}`);
console.log(`Admin: ${env.seed.adminEmail} / ${env.seed.adminPassword}`);
console.log(`Admin id: ${admin._id}`);
} catch (error) {
  if (error.code === 8000) {
    console.error('Atlas is at its 500-collection limit. PW Vidyapeeth needs new collections, including coverage points. Free space on this cluster, then run npm run seed again.');
  } else {
    console.error(error);
  }
  await disconnectDb();
  process.exit(1);
}

await disconnectDb();
