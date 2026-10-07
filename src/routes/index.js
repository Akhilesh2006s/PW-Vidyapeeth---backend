import { Router } from 'express';
import { changePassword, createStaffAccount, login, me, register, listUsers } from '../controllers/authController.js';
import {
  createAdmission,
  createParent,
  createStudent,
  getAdmission,
  getParent,
  getParentAnalysis,
  getStudent,
  listAdmissions,
  listCounsellors,
  listParents,
  listStudents,
  updateAdmission,
  updateParent,
  updateStudent,
} from '../controllers/recordsController.js';
import {
  createSession,
  getAnalysis,
  getSession,
  getTranscript,
  listSessions,
  processSession,
  removeAudio,
  streamAudio,
  submitText,
  updateSession,
  uploadAudio,
} from '../controllers/sessionController.js';
import {
  createPoint,
  listPoints,
  removePoint,
} from '../controllers/coverageController.js';
import {
  analyticsOverview,
  counsellorPerformance,
  createFollowUp,
  listFollowUps,
  updateFollowUp,
} from '../controllers/insightController.js';

export const publicAuthRouter = Router();
publicAuthRouter.post('/register', ...register);
publicAuthRouter.post('/login', ...login);

export const privateAuthRouter = Router();
privateAuthRouter.get('/me', me);
privateAuthRouter.patch('/password', ...changePassword);

export const userRouter = Router();
userRouter.get('/', ...listUsers);
userRouter.post('/', ...createStaffAccount);

export const counsellorRouter = Router();
counsellorRouter.get('/', listCounsellors);
counsellorRouter.get('/me', listCounsellors);

export const studentRouter = Router();
studentRouter.get('/', ...listStudents);
studentRouter.post('/', ...createStudent);
studentRouter.get('/:id', ...getStudent);
studentRouter.patch('/:id', ...updateStudent);

export const parentRouter = Router();
parentRouter.get('/', ...listParents);
parentRouter.post('/', ...createParent);
parentRouter.get('/:id', ...getParent);
parentRouter.get('/:id/analysis', ...getParentAnalysis);
parentRouter.patch('/:id', ...updateParent);

export const admissionRouter = Router();
admissionRouter.get('/', ...listAdmissions);
admissionRouter.post('/', ...createAdmission);
admissionRouter.get('/:id', ...getAdmission);
admissionRouter.patch('/:id', ...updateAdmission);

export const sessionRouter = Router();
sessionRouter.get('/', ...listSessions);
sessionRouter.post('/', ...createSession);
sessionRouter.get('/:id', ...getSession);
sessionRouter.patch('/:id', ...updateSession);
sessionRouter.post('/:id/audio', ...uploadAudio);
sessionRouter.post('/:id/text', ...submitText);
sessionRouter.delete('/:id/audio', ...removeAudio);
sessionRouter.get('/:id/audio', ...streamAudio);
sessionRouter.post('/:id/process', ...processSession);
sessionRouter.get('/:id/transcript', ...getTranscript);
sessionRouter.get('/:id/analysis', ...getAnalysis);

export const followUpRouter = Router();
followUpRouter.get('/', ...listFollowUps);
followUpRouter.post('/', ...createFollowUp);
followUpRouter.patch('/:id', ...updateFollowUp);

export const analyticsRouter = Router();
analyticsRouter.get('/overview', analyticsOverview);
analyticsRouter.get('/counsellors', counsellorPerformance);

export const coverageRouter = Router();
coverageRouter.get('/', listPoints);
coverageRouter.post('/', ...createPoint);
coverageRouter.delete('/:id', ...removePoint);
