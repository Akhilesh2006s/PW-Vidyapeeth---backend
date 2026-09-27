import { Parent, Student } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { escapeRegex } from '../utils/helpers.js';

async function ownedStudents(counsellorId, studentIds) {
  if (!studentIds?.length) return [];
  const students = await Student.find({ _id: { $in: studentIds }, counsellor: counsellorId, status: 'active' });
  if (students.length !== studentIds.length) throw new AppError('One or more students were not found', 400);
  return students;
}

async function relinkStudents(parentId, studentIds) {
  await Student.updateMany({ parents: parentId }, { $pull: { parents: parentId } });
  if (studentIds.length) {
    await Student.updateMany({ _id: { $in: studentIds } }, { $addToSet: { parents: parentId } });
  }
}

function assertOwner(req, parent) {
  if (req.user.role !== 'admin' && String(parent.createdBy) !== String(req.counsellor._id)) {
    throw new AppError('Parent not found', 404);
  }
}

export async function listParents(req) {
  const filter = {};
  if (req.user.role !== 'admin') filter.createdBy = req.counsellor._id;
  if (req.query.language) filter.preferredLanguage = req.query.language;
  if (req.query.q) filter.fullName = new RegExp(escapeRegex(req.query.q), 'i');
  return Parent.find(filter).populate('students', 'fullName grade preferredLanguage').sort({ createdAt: -1 }).limit(200);
}

export async function getParent(req, id) {
  const parent = await Parent.findById(id).populate('students', 'fullName grade preferredLanguage targetProgram');
  if (!parent) throw new AppError('Parent not found', 404);
  assertOwner(req, parent);
  return parent;
}

export async function createParent(req, body) {
  const counsellorId = req.user.role === 'admin' ? body.counsellorId : req.counsellor._id;
  if (!counsellorId) throw new AppError('counsellorId is required', 400);
  const studentIds = body.studentIds || [];
  await ownedStudents(counsellorId, studentIds);
  const parent = await Parent.create({
    fullName: body.fullName,
    email: body.email || '',
    phone: body.phone || '',
    relation: body.relation || 'guardian',
    preferredLanguage: body.preferredLanguage || 'mixed',
    notes: body.notes || '',
    createdBy: counsellorId,
    students: studentIds,
  });
  await relinkStudents(parent._id, studentIds);
  return getParent(req, parent._id);
}

export async function updateParent(req, id, body) {
  const parent = await getParent(req, id);
  if (body.studentIds) {
    await ownedStudents(parent.createdBy, body.studentIds);
    parent.students = body.studentIds;
    await relinkStudents(parent._id, body.studentIds);
  }
  const fields = ['fullName', 'email', 'phone', 'relation', 'preferredLanguage', 'notes'];
  for (const field of fields) {
    if (body[field] !== undefined) parent[field] = body[field];
  }
  await parent.save();
  return getParent(req, parent._id);
}
