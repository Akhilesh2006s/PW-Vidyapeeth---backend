import { Admission, AiAnalysis, CounsellingSession, FollowUp, Parent, Student } from '../models/index.js';
import { aiConfigured } from '../config/env.js';

function countMap(rows) {
  return Object.fromEntries(rows.map((row) => [row._id || 'unknown', row.count]));
}

export async function overview(req) {
  const counsellorId = req.user.role === 'admin' ? null : req.counsellor._id;
  const studentFilter = counsellorId ? { counsellor: counsellorId, status: 'active' } : { status: 'active' };
  const owned = counsellorId ? { counsellor: counsellorId } : {};
  const parentFilter = counsellorId ? { createdBy: counsellorId } : {};
  const followFilter = counsellorId ? { assignedTo: counsellorId } : {};

  const [students, parents, admissions, sessions, openFollowUps, byStatus, byLanguage, byStage, recentSessions, followUpsDue, analyses] =
    await Promise.all([
      Student.countDocuments(studentFilter),
      Parent.countDocuments(parentFilter),
      Admission.countDocuments(owned),
      CounsellingSession.countDocuments(owned),
      FollowUp.countDocuments({ ...followFilter, status: 'open' }),
      CounsellingSession.aggregate([{ $match: owned }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      CounsellingSession.aggregate([{ $match: owned }, { $group: { _id: '$language', count: { $sum: 1 } } }]),
      Admission.aggregate([{ $match: owned }, { $group: { _id: '$stage', count: { $sum: 1 } } }]),
      CounsellingSession.find(owned)
        .populate('student', 'fullName preferredLanguage')
        .sort({ createdAt: -1 })
        .limit(6),
      FollowUp.find({ ...followFilter, status: 'open' })
        .populate('student', 'fullName')
        .sort({ createdAt: -1 })
        .limit(6),
      AiAnalysis.aggregate([
        {
          $lookup: {
            from: 'counselling_sessions',
            localField: 'session',
            foreignField: '_id',
            as: 'sessionDoc',
          },
        },
        { $unwind: '$sessionDoc' },
        ...(counsellorId ? [{ $match: { 'sessionDoc.counsellor': counsellorId } }] : []),
        { $group: { _id: '$isPlaceholder', count: { $sum: 1 } } },
      ]),
    ]);

  const placeholderAnalyses = analyses.find((row) => row._id === true)?.count || 0;
  const realAnalyses = analyses.find((row) => row._id === false)?.count || 0;
  const completedSessions = countMap(byStatus).completed || 0;

  return {
    counts: {
      students,
      parents,
      admissions,
      sessions,
      openFollowUps,
      completedSessions,
    },
    sessionsByStatus: countMap(byStatus),
    sessionsByLanguage: countMap(byLanguage),
    admissionsByStage: countMap(byStage),
    recentSessions,
    followUpsDue,
    ai: {
      configured: aiConfigured(),
      placeholderAnalyses,
      realAnalyses,
    },
  };
}
