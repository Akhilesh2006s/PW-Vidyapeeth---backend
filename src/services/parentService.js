import { AiAnalysis, CounsellingSession, Parent, Student } from '../models/index.js';
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
  const counsellorId = String(req.counsellor?._id || '');
  const allowed = String(parent.createdBy) === counsellorId
    || (parent.counsellors || []).some((id) => String(id) === counsellorId);
  if (req.user.role !== 'admin' && !allowed) {
    throw new AppError('Parent not found', 404);
  }
}

export async function listParents(req) {
  const filter = {};
  if (req.user.role !== 'admin') {
    filter.$or = [{ createdBy: req.counsellor._id }, { counsellors: req.counsellor._id }];
  }
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
  const identity = [];
  if (body.phone) identity.push({ phone: body.phone });
  if (body.email) identity.push({ email: body.email.toLowerCase() });
  const existing = identity.length ? await Parent.findOne({ $or: identity }) : null;
  if (existing) {
    existing.counsellors = [...new Set([...(existing.counsellors || []).map(String), String(counsellorId)])];
    existing.students = [...new Set([...(existing.students || []).map(String), ...studentIds.map(String)])];
    await existing.save();
    await relinkStudents(existing._id, existing.students);
    return getParent(req, existing._id);
  }
  const parent = await Parent.create({
    fullName: body.fullName,
    email: body.email || '',
    phone: body.phone || '',
    relation: body.relation || 'guardian',
    preferredLanguage: body.preferredLanguage || 'mixed',
    notes: body.notes || '',
    createdBy: counsellorId,
    counsellors: [counsellorId],
    students: studentIds,
  });
  await relinkStudents(parent._id, studentIds);
  return getParent(req, parent._id);
}

const positiveTerms = ['satisfied', 'happy', 'confident', 'positive', 'reassured', 'interested', 'comfortable', 'trust'];
const negativeTerms = ['unsatisfied', 'unhappy', 'confused', 'negative', 'concerned', 'frustrated', 'doubt', 'worried'];

export function calculateSessionSatisfaction(analysis) {
  if (!analysis || analysis.isPlaceholder) return { score: null, reasons: ['Analysis is not available for this session'] };
  let score = 60;
  const reasons = [];
  for (const item of analysis.sentimentIndicators || []) {
    const text = `${item.aspect} ${item.indicator}`.toLowerCase();
    const weight = item.intensity === 'high' ? 10 : item.intensity === 'medium' ? 7 : 4;
    if (negativeTerms.some((term) => text.includes(term))) {
      score -= weight;
      reasons.push(`Concern: ${item.indicator}`);
    } else if (positiveTerms.some((term) => text.includes(term))) {
      score += weight;
      reasons.push(`Positive signal: ${item.indicator}`);
    }
  }
  const openObjections = (analysis.objections || []).filter((item) => item.status === 'open').length;
  const addressedObjections = (analysis.objections || []).filter((item) => item.status === 'addressed').length;
  score += addressedObjections * 4 - openObjections * 6;
  if (addressedObjections) reasons.push(`${addressedObjections} objection(s) addressed`);
  if (openObjections) reasons.push(`${openObjections} objection(s) still open`);
  const covered = (analysis.coveredPoints || []).length;
  const missed = (analysis.missedPoints || []).length;
  if (covered + missed) {
    score += Math.round((covered / (covered + missed) - 0.5) * 20);
    reasons.push(`${covered} required point(s) covered, ${missed} missed`);
  }
  return { score: Math.max(0, Math.min(100, score)), reasons: reasons.slice(0, 4) };
}

export async function getParentAnalysis(req, id) {
  const parent = await Parent.findById(id);
  if (!parent) throw new AppError('Parent not found', 404);
  assertOwner(req, parent);
  const sessions = await CounsellingSession.find({
    $or: [{ parents: parent._id }, { parentName: new RegExp(`^${escapeRegex(parent.fullName)}$`, 'i') }],
  })
    .populate({ path: 'counsellor', select: 'employeeCode user', populate: { path: 'user', select: 'name email' } })
    .populate('student', 'fullName targetProgram')
    .sort({ startedAt: -1 });
  const analyses = await AiAnalysis.find({ session: { $in: sessions.map((session) => session._id) } });
  const bySession = new Map(analyses.map((analysis) => [String(analysis.session), analysis]));
  const timeline = sessions.map((session) => {
    const analysis = bySession.get(String(session._id));
    const satisfaction = calculateSessionSatisfaction(analysis);
    return {
      sessionId: String(session._id),
      title: session.title,
      startedAt: session.startedAt,
      studentName: session.student?.fullName || session.studentName,
      counsellorId: String(session.counsellor?._id || ''),
      counsellorName: session.counsellor?.user?.name || session.counsellor?.employeeCode || 'Unknown',
      satisfactionScore: satisfaction.score,
      reasons: satisfaction.reasons,
      summary: analysis?.summary || '',
    };
  });
  const grouped = new Map();
  for (const item of timeline) {
    const current = grouped.get(item.counsellorId) || { counsellorId: item.counsellorId, counsellorName: item.counsellorName, scores: [], sessions: 0, reasons: [] };
    current.sessions += 1;
    if (item.satisfactionScore != null) current.scores.push(item.satisfactionScore);
    current.reasons.push(...item.reasons);
    grouped.set(item.counsellorId, current);
  }
  const counsellorComparison = [...grouped.values()].map((item) => ({
    counsellorId: item.counsellorId,
    counsellorName: item.counsellorName,
    sessions: item.sessions,
    satisfactionScore: item.scores.length ? Math.round(item.scores.reduce((a, b) => a + b, 0) / item.scores.length) : null,
    reasons: [...new Set(item.reasons)].slice(0, 4),
  })).sort((a, b) => (b.satisfactionScore ?? -1) - (a.satisfactionScore ?? -1));
  const scored = timeline.filter((item) => item.satisfactionScore != null);
  const best = counsellorComparison[0] || null;
  const lowest = counsellorComparison.at(-1) || null;
  const differenceReason = counsellorComparison.length > 1
    ? `${best.counsellorName} scored higher mainly because ${best.reasons[0]?.toLowerCase() || 'the conversation produced stronger satisfaction signals'}. ${lowest.counsellorName} scored lower mainly because ${lowest.reasons[0]?.toLowerCase() || 'fewer positive signals were available'}.`
    : 'More than one counsellor interaction is needed for a comparison.';
  return {
    parent,
    summary: {
      totalSessions: timeline.length,
      counsellorsSeen: counsellorComparison.length,
      satisfactionScore: scored.length ? Math.round(scored.reduce((sum, item) => sum + item.satisfactionScore, 0) / scored.length) : null,
      bestCounsellor: best,
      differenceReason,
    },
    counsellorComparison,
    timeline,
  };
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
