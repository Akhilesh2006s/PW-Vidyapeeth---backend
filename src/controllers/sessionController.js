import fs from 'fs';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { audioUpload, removeStoredFile } from '../middleware/upload.js';
import { createSessionSchema, idSchema, listSchema, textTranscriptSchema, updateSessionSchema } from '../validators/schemas.js';
import * as sessionService from '../services/sessionService.js';

export const listSessions = [validate(listSchema), asyncHandler(async (req, res) => {
  req.query = { ...req.query, ...req.validated.query };
  const data = await sessionService.listSessions(req);
  res.json({ data });
})];

export const createSession = [validate(createSessionSchema), asyncHandler(async (req, res) => {
  const data = await sessionService.createSession(req, req.validated.body);
  res.status(201).json({ data });
})];

export const getSession = [validate(idSchema), asyncHandler(async (req, res) => {
  const data = await sessionService.getSessionBundle(req, req.validated.params.id);
  res.json({ data });
})];

export const updateSession = [validate(updateSessionSchema), asyncHandler(async (req, res) => {
  const data = await sessionService.updateSession(req, req.validated.params.id, req.validated.body);
  res.json({ data });
})];

export const uploadAudio = [
  validate(idSchema),
  audioUpload.single('audio'),
  asyncHandler(async (req, res) => {
    try {
      const durationSeconds = Number(req.body?.durationSeconds || 0);
      const data = await sessionService.saveAudio(req, req.validated.params.id, req.file, durationSeconds);
      res.status(201).json({ data });
    } catch (error) {
      if (req.file?.path) await removeStoredFile(req.file.path);
      throw error;
    }
  }),
];

export const removeAudio = [validate(idSchema), asyncHandler(async (req, res) => {
  const data = await sessionService.deleteAudio(req, req.validated.params.id);
  res.json({ data });
})];

export const submitText = [validate(textTranscriptSchema), asyncHandler(async (req, res) => {
  const data = await sessionService.saveTranscriptText(req, req.validated.params.id, req.validated.body.text);
  res.status(202).json({ data });
})];

export const processSession = [validate(idSchema), asyncHandler(async (req, res) => {
  const data = await sessionService.beginProcessing(req, req.validated.params.id);
  res.status(202).json({ data });
})];

export const getTranscript = [validate(idSchema), asyncHandler(async (req, res) => {
  const data = await sessionService.getTranscript(req, req.validated.params.id);
  res.json({ data });
})];

export const getAnalysis = [validate(idSchema), asyncHandler(async (req, res) => {
  const data = await sessionService.getAnalysis(req, req.validated.params.id);
  res.json({ data });
})];

export const streamAudio = [validate(idSchema), asyncHandler(async (req, res) => {
  const audio = await sessionService.streamAudio(req, req.validated.params.id);
  res.setHeader('Content-Type', audio.mimeType || 'application/octet-stream');
  res.setHeader('Content-Length', String(audio.sizeBytes || 0));
  fs.createReadStream(audio.storagePath).pipe(res);
})];
