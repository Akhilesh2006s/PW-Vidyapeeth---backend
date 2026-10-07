import { Admission, AiAnalysis, CounsellingSession, Counsellor, FollowUp, Parent, Student } from '../models/index.js';
import { aiConfigured } from '../config/env.js';
import { calculateSessionSatisfaction } from './parentService.js';

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

export async function counsellorPerformance(req) {
  const counsellorFilter = req.user.role === 'admin' ? {} : { _id: req.counsellor._id };
  const counsellors = await Counsellor.find(counsellorFilter).populate('user', 'name email');
  const ids = counsellors.map((item) => item._id);
  const [sessions, admissions, followUps] = await Promise.all([
    CounsellingSession.find({ counsellor: { $in: ids } }).sort({ startedAt: -1 }),
    Admission.find({ counsellor: { $in: ids } }),
    FollowUp.find({ assignedTo: { $in: ids } }),
  ]);
  const analyses = await AiAnalysis.find({ session: { $in: sessions.map((item) => item._id) } });
  const analysisBySession = new Map(analyses.map((item) => [String(item.session), item]));

  const rows = counsellors.map((counsellor) => {
    const id = String(counsellor._id);
    const ownSessions = sessions.filter((item) => String(item.counsellor) === id);
    const ownAdmissions = admissions.filter((item) => String(item.counsellor) === id);
    const ownFollowUps = followUps.filter((item) => String(item.assignedTo) === id);
    const ownAnalyses = ownSessions.map((item) => analysisBySession.get(String(item._id))).filter(Boolean);
    const satisfactionScores = ownAnalyses
      .map((analysis) => calculateSessionSatisfaction(analysis).score)
      .filter((score) => score != null);
    const coverage = ownAnalyses.reduce((sum, analysis) => sum + (analysis.coveredPoints || []).length, 0);
    const missed = ownAnalyses.reduce((sum, analysis) => sum + (analysis.missedPoints || []).length, 0);
    const coverageRate = coverage + missed ? Math.round((coverage / (coverage + missed)) * 100) : null;
    const satisfactionScore = satisfactionScores.length
      ? Math.round(satisfactionScores.reduce((sum, score) => sum + score, 0) / satisfactionScores.length)
      : null;
    const completedFollowUps = ownFollowUps.filter((item) => item.status === 'done').length;
    const followUpRate = ownFollowUps.length ? Math.round((completedFollowUps / ownFollowUps.length) * 100) : null;
    const enrolled = ownAdmissions.filter((item) => item.stage === 'enrolled').length;
    const conversionRate = ownAdmissions.length ? Math.round((enrolled / ownAdmissions.length) * 100) : null;
    const available = [satisfactionScore, coverageRate, followUpRate, conversionRate].filter((value) => value != null);
    const performanceScore = available.length ? Math.round(available.reduce((sum, value) => sum + value, 0) / available.length) : null;
    const strengths = [...new Set(ownAnalyses.flatMap((analysis) => analysis.counsellorStrengths || []))].slice(0, 3);
    const improvements = [...new Set(ownAnalyses.flatMap((analysis) => analysis.counsellorImprovements || []))].slice(0, 3);
    return {
      counsellorId: id,
      counsellorName: counsellor.user?.name || counsellor.employeeCode,
      employeeCode: counsellor.employeeCode,
      sessions: ownSessions.length,
      completedSessions: ownSessions.filter((item) => item.status === 'completed').length,
      satisfactionScore,
      coverageRate,
      followUpRate,
      conversionRate,
      enrollments: enrolled,
      performanceScore,
      strengths,
      improvements,
    };
  }).sort((a, b) => (b.performanceScore ?? -1) - (a.performanceScore ?? -1));

  const scoredRows = rows.filter((row) => row.performanceScore != null);
  return {
    scope: req.user.role === 'admin' ? 'team' : 'individual',
    summary: {
      counsellors: rows.length,
      totalSessions: sessions.length,
      completedSessions: sessions.filter((item) => item.status === 'completed').length,
      enrollments: admissions.filter((item) => item.stage === 'enrolled').length,
      teamPerformanceScore: scoredRows.length
        ? Math.round(scoredRows.reduce((sum, row) => sum + row.performanceScore, 0) / scoredRows.length)
        : null,
    },
    counsellors: rows,
  };
}
