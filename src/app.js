import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { aiConfigured, env } from './config/env.js';
import { attachCounsellor, authenticate } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import {
  admissionRouter,
  analyticsRouter,
  counsellorRouter,
  coverageRouter,
  followUpRouter,
  parentRouter,
  privateAuthRouter,
  publicAuthRouter,
  sessionRouter,
  studentRouter,
  userRouter,
} from './routes/index.js';

export function createApp() {
  const app = express();
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: env.clientOrigin.split(',').map((item) => item.trim()),
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    const db = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.json({
      data: {
        ok: db === 'connected',
        db,
        aiConfigured: aiConfigured(),
        service: 'pw-vidyapeeth-api',
      },
    });
  });

  app.use('/api/auth', publicAuthRouter);
  app.use('/api', authenticate, attachCounsellor);
  app.use('/api/auth', privateAuthRouter);
  app.use('/api/users', userRouter);
  app.use('/api/counsellors', counsellorRouter);
  app.use('/api/students', studentRouter);
  app.use('/api/parents', parentRouter);
  app.use('/api/admissions', admissionRouter);
  app.use('/api/sessions', sessionRouter);
  app.use('/api/coverage-points', coverageRouter);
  app.use('/api/follow-ups', followUpRouter);
  app.use('/api/analytics', analyticsRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
