import { Parent, Student } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { escapeRegex } from '../utils/helpers.js';

async function ownedParents(counsellorId, parentIds) {
  if (!parentIds?.length) return [];
  const parents = await Parent.find({ _id: { $in: parentIds }, createdBy: counsellorId });
  if (parents.length !== parentIds.length) throw new AppError('One or more parents were not found', 400);
  return parents;
}

async function relinkParents(studentId, parentIds) {
  await Parent.updateMany({ students: studentId }, { $pull: { students: studentId } });
  if (parentIds.length) {
    await Parent.updateMany({ _id: { $in: parentIds } }, { $addToSet: { students: studentId } });
  }
}

export async function listStudents(req) {
  const filter = { status: 'active' };
  if (req.user.role !== 'admin') filter.counsellor = req.counsellor._id;
  if (req.query.status === 'archived') filter.status = 'archived';
  if (req.query.status === 'all') delete filter.status;
  if (req.query.language) filter.preferredLanguage = req.query.language;
  if (req.query.q) filter.fullName = new RegExp(escapeRegex(req.query.q), 'i');
  return Student.find(filter)
    .populate('parents', 'fullName relation phone preferredLanguage email')
    .sort({ createdAt: -1 })
    .limit(200);
}

export async function getStudent(req, id) {
  const student = await Student.findById(id).populate('parents', 'fullName relation phone preferredLanguage email notes');
  if (!student) throw new AppError('Student not found', 404);
  if (req.user.role !== 'admin' && String(student.counsellor) !== String(req.counsellor._id)) {
    throw new AppError('Student not found', 404);
  }
  return student;
}

export async function createStudent(req, body) {
  const counsellorId = req.user.role === 'admin' ? body.counsellorId : req.counsellor._id;
  if (!counsellorId) throw new AppError('counsellorId is required', 400);
  let parentIds = [...(body.parentIds || [])];
  if (body.newParent?.fullName) {
    const parent = await Parent.create({
      fullName: body.newParent.fullName,
      relation: body.newParent.relation || 'guardian',
      phone: body.newParent.phone || '',
      email: body.newParent.email || '',
      preferredLanguage: body.newParent.preferredLanguage || body.preferredLanguage || 'mixed',
      createdBy: counsellorId,
    });
    parentIds.push(parent._id);
  }
  await ownedParents(counsellorId, parentIds);
  const student = await Student.create({
    fullName: body.fullName,
    email: body.email || '',
    phone: body.phone || '',
    grade: body.grade || '',
    targetProgram: body.targetProgram || '',
    preferredLanguage: body.preferredLanguage || 'mixed',
    notes: body.notes || '',
    counsellor: counsellorId,
    parents: parentIds,
  });
  await relinkParents(student._id, parentIds);
  return getStudent(req, student._id);
}

export async function updateStudent(req, id, body) {
  const student = await getStudent(req, id);
  const counsellorId = student.counsellor;
  if (body.parentIds || body.newParent?.fullName) {
    let parentIds = body.parentIds ? [...body.parentIds] : student.parents.map((parent) => parent._id || parent);
    if (body.newParent?.fullName) {
      const parent = await Parent.create({
        fullName: body.newParent.fullName,
        relation: body.newParent.relation || 'guardian',
        phone: body.newParent.phone || '',
        email: body.newParent.email || '',
        preferredLanguage: body.newParent.preferredLanguage || 'mixed',
        createdBy: counsellorId,
      });
      parentIds.push(parent._id);
    }
    await ownedParents(counsellorId, parentIds);
    student.parents = parentIds;
    await relinkParents(student._id, parentIds);
  }
  const fields = ['fullName', 'email', 'phone', 'grade', 'targetProgram', 'preferredLanguage', 'notes', 'status'];
  for (const field of fields) {
    if (body[field] !== undefined) student[field] = body[field];
  }
  await student.save();
  return getStudent(req, student._id);
}
