import fs from 'fs';
import { AppError } from '../utils/AppError.js';
import {
  AiAnalysis,
  AudioFile,
  CounsellingSession,
  CoveragePoint,
  FollowUp,
  Transcript,
} from '../models/index.js';
import { createAiProvider } from '../services/ai/index.js';

/**
 * In-process background step. Replace enqueueSessionProcessing with a queue
 * worker later; runSessionProcessing is the unit of work either way.
 */
const running = new Set();

export function enqueueSessionProcessing(sessionId) {
  const key = String(sessionId);
  if (running.has(key)) return;
  running.add(key);
  setImmediate(() => {
    runSessionProcessing(key)
      .catch((error) => {
        console.error('Session processing failed:', error.message);
      })
      .finally(() => running.delete(key));
  });
}

export async function runSessionProcessing(sessionId) {
  const session = await CounsellingSession.findById(sessionId);
  if (!session) return;
  try {
    const pasted = session.inputSource === 'text' ? await Transcript.findOne({ session: session._id, source: 'text' }) : null;
    const audio = pasted ? null : await AudioFile.findOne({ session: session._id });
    if (!pasted && !audio) throw new AppError('Paste a conversation or upload a recording before analysis', 400);
    if (audio && !fs.existsSync(audio.storagePath)) throw new AppError('Stored recording is missing', 400);

    const points = await CoveragePoint.find({ active: true }).sort({ order: 1, createdAt: 1 });
    const requiredPoints = points.map((point) => point.text);

    const provider = createAiProvider();
    let transcript = pasted;
    if (!transcript) {
      const transcriptResult = await provider.transcribe({
        filePath: audio.storagePath,
        filename: audio.originalName,
        mimeType: audio.mimeType,
        language: session.language,
      });
      transcript = await Transcript.findOneAndUpdate(
        { session: session._id },
        {
          session: session._id,
          audioFile: audio._id,
          source: 'audio',
          language: transcriptResult.language,
          detectedLanguage: transcriptResult.detectedLanguage || '',
          text: transcriptResult.text,
          segments: transcriptResult.segments,
          provider: transcriptResult.provider,
          model: transcriptResult.model || '',
          isPlaceholder: Boolean(transcriptResult.isPlaceholder),
          placeholderMessage: transcriptResult.placeholderMessage || '',
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }

    const speakerContext = {
      studentName: session.studentName,
      parentName: session.parentName,
    };
    const speakers = typeof provider.identifySpeakers === 'function'
      ? await provider.identifySpeakers({ transcript: transcript.text, context: speakerContext })
      : [];
    if (speakers.length) {
      transcript.segments = speakers.map((turn) => ({
        speaker: turn.speaker,
        startMs: 0,
        endMs: 0,
        text: turn.text,
        language: transcript.language || session.language || 'mixed',
      }));
      await transcript.save();
    }
    const labelled = speakers.length
      ? speakers.map((turn) => `${turn.speaker}: ${turn.text}`).join('\n\n')
      : transcript.text;

    const analysisResult = alignCoverage(
      await provider.analyze({
        transcript: labelled,
        language: session.language,
        context: {
          ...speakerContext,
          sessionLanguage: session.language,
          requiredPoints,
        },
      }),
      requiredPoints,
    );

    const analysis = await AiAnalysis.findOneAndUpdate(
      { session: session._id },
      {
        session: session._id,
        transcript: transcript._id,
        provider: analysisResult.provider,
        model: analysisResult.model || '',
        isPlaceholder: Boolean(analysisResult.isPlaceholder),
        summary: analysisResult.summary,
        language: analysisResult.language,
        topics: analysisResult.topics,
        parentConcerns: analysisResult.parentConcerns,
        studentIntent: analysisResult.studentIntent,
        objections: analysisResult.objections,
        sentimentIndicators: analysisResult.sentimentIndicators,
        unansweredQuestions: analysisResult.unansweredQuestions,
        counsellorStrengths: analysisResult.counsellorStrengths,
        counsellorImprovements: analysisResult.counsellorImprovements,
        missedOpportunities: analysisResult.missedOpportunities,
        recommendations: analysisResult.recommendations,
        followUpActions: analysisResult.followUpActions,
        requiredPoints: analysisResult.requiredPoints,
        coveredPoints: analysisResult.coveredPoints,
        missedPoints: analysisResult.missedPoints,
        businessLoss: analysisResult.businessLoss,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    await FollowUp.deleteMany({ session: session._id, source: 'ai', status: 'open' });
    if (analysis.followUpActions.length && !analysis.isPlaceholder) {
      await FollowUp.insertMany(
        analysis.followUpActions.map((item) => ({
          session: session._id,
          student: session.student || null,
          studentName: session.studentName || '',
          analysis: analysis._id,
          assignedTo: session.counsellor,
          action: item.action,
          priority: item.priority,
          status: 'open',
          source: 'ai',
          suggestedOwner: item.suggestedOwner,
        })),
      );
    }

    session.status = 'completed';
    session.processingError = '';
    session.endedAt = session.endedAt || new Date();
    await session.save();
  } catch (error) {
    console.error('Session processing failed:', error.message);
    session.status = 'failed';
    session.processingError = String(error.message || 'Processing failed').slice(0, 300);
    await session.save();
  }
}

function mentions(points, text) {
  const key = text.toLowerCase();
  return points.some((item) => {
    const point = item.point.toLowerCase();
    return point === key || point.includes(key) || key.includes(point);
  });
}

function alignCoverage(analysis, requiredPoints) {
  const coveredPoints = [...(analysis.coveredPoints || [])];
  const missedPoints = [...(analysis.missedPoints || [])];
  for (const point of requiredPoints) {
    if (mentions(coveredPoints, point) || mentions(missedPoints, point)) continue;
    missedPoints.push({
      point,
      lossReason: `This point was not covered. PW Vidyapeeth can lose this admission because the family did not hear: ${point}.`,
    });
  }
  const coveredCount = requiredPoints.filter((point) => mentions(coveredPoints, point)).length;
  const missedCount = requiredPoints.length - coveredCount;
  const businessLoss =
    analysis.businessLoss ||
    (requiredPoints.length
      ? `The admin set ${requiredPoints.length} points to be covered. ${coveredCount} were covered and ${missedCount} were missed.${
          missedCount
            ? ' PW Vidyapeeth will face a loss because the family left without those answers and may choose another institute.'
            : ' The required points were covered, so this conversation does not create that loss.'
        }`
      : '');
  return {
    ...analysis,
    requiredPoints,
    coveredPoints,
    missedPoints,
    businessLoss,
  };
}
