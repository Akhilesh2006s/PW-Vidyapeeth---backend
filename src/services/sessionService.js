import fs from 'fs';
import { Admission, AiAnalysis, AudioFile, CounsellingSession, FollowUp, Parent, Student, Transcript } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { removeStoredFile } from '../middleware/upload.js';
import { enqueueSessionProcessing } from '../jobs/processSession.js';

const audioPublicFields = 'originalName mimeType sizeBytes durationSeconds createdAt';

async function loadSession(req, id) {
  const session = await CounsellingSession.findById(id);
  if (!session) throw new AppError('Session not found', 404);
  if (req.user.role !== 'admin' && String(session.counsellor) !== String(req.counsellor._id)) {
    throw new AppError('Session not found', 404);
  }
  return session;
}

export async function listSessions(req) {
  const filter = {};
  if (req.user.role !== 'admin') filter.counsellor = req.counsellor._id;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.language) filter.language = req.query.language;
  return CounsellingSession.find(filter)
    .populate('student', 'fullName grade preferredLanguage targetProgram')
    .populate('parents', 'fullName relation preferredLanguage')
    .sort({ createdAt: -1 })
    .limit(200);
}

export async function getSessionBundle(req, id) {
  const session = await CounsellingSession.findById(id)
    .populate('student')
    .populate('parents')
    .populate('admission');
  if (!session) throw new AppError('Session not found', 404);
  if (req.user.role !== 'admin' && String(session.counsellor) !== String(req.counsellor._id)) {
    throw new AppError('Session not found', 404);
  }
  const [audio, transcript, analysis, followUps] = await Promise.all([
    AudioFile.findOne({ session: session._id }).select(audioPublicFields),
    Transcript.findOne({ session: session._id }),
    AiAnalysis.findOne({ session: session._id }),
    FollowUp.find({ session: session._id }).sort({ createdAt: -1 }),
  ]);
  return { session, audio, transcript, analysis, followUps };
}

export async function createSession(req, body) {
  if (!req.counsellor) throw new AppError('A counsellor profile is required to start a session', 403);
  const studentName = String(body.studentName || '').trim();
  const parentName = String(body.parentName || '').trim();
  return CounsellingSession.create({
    counsellor: req.counsellor._id,
    studentName,
    parentName,
    language: body.language || 'mixed',
    title: body.title || `Counselling · ${studentName}`,
    notes: body.notes || '',
    status: 'in_progress',
    startedAt: new Date(),
  });
}

export async function updateSession(req, id, body) {
  const session = await loadSession(req, id);
  if (body.notes !== undefined) session.notes = body.notes;
  if (body.title !== undefined) session.title = body.title;
  if (body.language !== undefined && session.status === 'in_progress') session.language = body.language;
  await session.save();
  return session;
}

export async function saveAudio(req, id, file, durationSeconds) {
  const session = await loadSession(req, id);
  if (session.status === 'processing') throw new AppError('This session is already processing', 409);
  if (!file) throw new AppError('Recording file is missing', 400);
  const existing = await AudioFile.findOne({ session: session._id });
  if (existing) {
    await removeStoredFile(existing.storagePath);
    await existing.deleteOne();
    await Transcript.deleteOne({ session: session._id });
    await AiAnalysis.deleteOne({ session: session._id });
  }
  const audio = await AudioFile.create({
    session: session._id,
    uploadedBy: req.user.id,
    originalName: file.originalname || 'recording.webm',
    mimeType: file.mimetype || 'audio/webm',
    sizeBytes: file.size,
    storagePath: file.path,
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : 0,
  });
  session.inputSource = 'audio';
  session.status = 'audio_uploaded';
  session.durationSeconds = audio.durationSeconds;
  session.processingError = '';
  session.endedAt = new Date();
  await session.save();
  return AudioFile.findById(audio._id).select(audioPublicFields);
}

export async function deleteAudio(req, id) {
  const session = await loadSession(req, id);
  if (session.status === 'processing') throw new AppError('This session is already processing', 409);
  const audio = await AudioFile.findOne({ session: session._id });
  if (audio) {
    await removeStoredFile(audio.storagePath);
    await audio.deleteOne();
  }
  await Transcript.deleteOne({ session: session._id });
  await AiAnalysis.deleteOne({ session: session._id });
  await FollowUp.deleteMany({ session: session._id, source: 'ai', status: 'open' });
  session.inputSource = 'audio';
  session.status = 'in_progress';
  session.durationSeconds = 0;
  session.processingError = '';
  session.endedAt = null;
  await session.save();
  return session;
}

export async function streamAudio(req, id) {
  const session = await loadSession(req, id);
  const audio = await AudioFile.findOne({ session: session._id });
  if (!audio || !fs.existsSync(audio.storagePath)) throw new AppError('Recording not found', 404);
  return audio;
}

export async function saveTranscriptText(req, id, text) {
  const session = await loadSession(req, id);
  if (session.status === 'processing') throw new AppError('This session is already processing', 409);
  const trimmed = String(text || '').trim();
  if (trimmed.length < 10) throw new AppError('Paste a longer conversation', 400);
  await Transcript.findOneAndUpdate(
    { session: session._id },
    {
      session: session._id,
      source: 'text',
      language: session.language,
      text: trimmed,
      segments: [],
      provider: 'manual',
      model: '',
      isPlaceholder: false,
      placeholderMessage: '',
    },
    { upsert: true, setDefaultsOnInsert: true },
  );
  session.inputSource = 'text';
  session.status = 'processing';
  session.processingError = '';
  session.processingStartedAt = new Date();
  await session.save();
  enqueueSessionProcessing(session._id);
  return { id: String(session._id), status: session.status };
}

export async function beginProcessing(req, id) {
  const session = await loadSession(req, id);
  if (session.status === 'processing') throw new AppError('This session is already processing', 409);
  const pasted = session.inputSource === 'text' ? await Transcript.findOne({ session: session._id, source: 'text' }) : null;
  const audio = pasted ? null : await AudioFile.findOne({ session: session._id });
  if (!pasted && !audio) throw new AppError('Paste a conversation or upload a recording before analysis', 400);
  session.status = 'processing';
  session.processingError = '';
  session.processingStartedAt = new Date();
  await session.save();
  enqueueSessionProcessing(session._id);
  return { id: String(session._id), status: session.status };
}

export async function getTranscript(req, id) {
  await loadSession(req, id);
  return Transcript.findOne({ session: id });
}

export async function getAnalysis(req, id) {
  await loadSession(req, id);
  return AiAnalysis.findOne({ session: id });
}
