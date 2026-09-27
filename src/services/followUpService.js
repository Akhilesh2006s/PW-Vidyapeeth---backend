import { CounsellingSession, FollowUp, Student } from '../models/index.js';
import { AppError } from '../utils/AppError.js';

async function assertStudent(req, studentId) {
  const student = await Student.findById(studentId);
  if (!student) throw new AppError('Student not found', 404);
  if (req.user.role !== 'admin' && String(student.counsellor) !== String(req.counsellor._id)) {
    throw new AppError('Student not found', 404);
  }
  return student;
}

export async function listFollowUps(req) {
  const filter = {};
  if (req.user.role !== 'admin') filter.assignedTo = req.counsellor._id;
  if (req.query.status) filter.status = req.query.status;
  return FollowUp.find(filter)
    .populate('student', 'fullName grade preferredLanguage')
    .populate('session', 'title language status')
    .sort({ status: 1, priority: -1, createdAt: -1 })
    .limit(200);
}

export async function createFollowUp(req, body) {
  let dueAt = null;
  if (body.dueAt) {
    dueAt = new Date(body.dueAt);
    if (Number.isNaN(dueAt.getTime())) throw new AppError('Invalid due date', 400);
  }
  if (body.sessionId) {
    const session = await CounsellingSession.findById(body.sessionId);
    if (!session) throw new AppError('Session not found', 404);
    if (req.user.role !== 'admin' && String(session.counsellor) !== String(req.counsellor._id)) {
      throw new AppError('Session not found', 404);
    }
    return FollowUp.create({
      student: session.student || null,
      studentName: session.studentName || '',
      session: session._id,
      assignedTo: session.counsellor,
      action: body.action,
      priority: body.priority || 'medium',
      dueAt,
      suggestedOwner: body.suggestedOwner || 'counsellor',
      source: 'manual',
      status: 'open',
    });
  }
  const student = await assertStudent(req, body.studentId);
  return FollowUp.create({
    student: student._id,
    studentName: student.fullName,
    session: null,
    assignedTo: student.counsellor,
    action: body.action,
    priority: body.priority || 'medium',
    dueAt,
    suggestedOwner: body.suggestedOwner || 'counsellor',
    source: 'manual',
    status: 'open',
  });
}

export async function updateFollowUp(req, id, body) {
  const followUp = await FollowUp.findById(id);
  if (!followUp) throw new AppError('Follow-up not found', 404);
  if (req.user.role !== 'admin' && String(followUp.assignedTo) !== String(req.counsellor._id)) {
    throw new AppError('Follow-up not found', 404);
  }
  if (body.action !== undefined) followUp.action = body.action;
  if (body.priority !== undefined) followUp.priority = body.priority;
  if (body.status !== undefined) followUp.status = body.status;
  if (body.dueAt !== undefined) {
    if (!body.dueAt) {
      followUp.dueAt = null;
    } else {
      const dueAt = new Date(body.dueAt);
      if (Number.isNaN(dueAt.getTime())) throw new AppError('Invalid due date', 400);
      followUp.dueAt = dueAt;
    }
  }
  await followUp.save();
  return FollowUp.findById(followUp._id).populate('student', 'fullName grade preferredLanguage');
}
