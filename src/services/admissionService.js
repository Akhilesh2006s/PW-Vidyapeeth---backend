import { Admission } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { escapeRegex } from '../utils/helpers.js';

export async function listAdmissions(req) {
  const filter = {};
  if (req.user.role !== 'admin') filter.counsellor = req.counsellor._id;
  if (req.query.stage) filter.stage = req.query.stage;
  if (req.query.status) filter.status = req.query.status;
  const admissions = await Admission.find(filter)
    .populate('student', 'fullName grade preferredLanguage targetProgram')
    .sort({ updatedAt: -1 })
    .limit(200);
  if (!req.query.q) return admissions;
  const pattern = new RegExp(escapeRegex(req.query.q), 'i');
  return admissions.filter(
    (item) =>
      pattern.test(item.program) ||
      pattern.test(item.studentName || '') ||
      pattern.test(item.parentName || '') ||
      pattern.test(item.student?.fullName || ''),
  );
}

export async function getAdmission(req, id) {
  const admission = await Admission.findById(id).populate('student', 'fullName grade preferredLanguage targetProgram phone');
  if (!admission) throw new AppError('Admission not found', 404);
  if (req.user.role !== 'admin' && String(admission.counsellor) !== String(req.counsellor._id)) {
    throw new AppError('Admission not found', 404);
  }
  return admission;
}

export async function createAdmission(req, body) {
  if (!req.counsellor) throw new AppError('A counsellor profile is required to store an admission', 403);
  return Admission.create({
    counsellor: req.counsellor._id,
    studentName: String(body.studentName || '').trim(),
    parentName: String(body.parentName || '').trim(),
    program: body.program,
    intake: body.intake || '',
    stage: body.stage || 'enquiry',
    status: body.status || 'open',
    notes: body.notes || '',
  });
}

export async function updateAdmission(req, id, body) {
  const admission = await getAdmission(req, id);
  for (const field of ['studentName', 'parentName', 'program', 'intake', 'stage', 'status', 'notes']) {
    if (body[field] !== undefined) admission[field] = body[field];
  }
  if (['enrolled', 'withdrawn'].includes(admission.stage)) admission.status = 'closed';
  if (body.status === 'open' && !['enrolled', 'withdrawn'].includes(admission.stage)) admission.status = 'open';
  await admission.save();
  return getAdmission(req, admission._id);
}
