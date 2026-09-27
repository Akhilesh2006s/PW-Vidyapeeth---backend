import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGODB_URL || '';

function resolveAiConfig() {
  const requested = (process.env.AI_PROVIDER || 'auto').toLowerCase();
  const anthropicKey = process.env.ANTHROPIC_API_KEY || '';
  const genericKey = process.env.AI_API_KEY || '';
  let provider = requested;
  let apiKey = genericKey;
  if (requested === 'auto') {
    if (anthropicKey) {
      provider = 'anthropic';
      apiKey = anthropicKey;
    } else {
      provider = genericKey ? 'openai' : 'stub';
    }
  } else if (requested === 'anthropic') {
    apiKey = anthropicKey || genericKey;
  }
  const analysisModel =
    process.env.AI_ANALYSIS_MODEL || (provider === 'anthropic' ? 'claude-sonnet-5' : 'gpt-4o-mini');
  const baseUrl =
    provider === 'anthropic'
      ? (process.env.ANTHROPIC_API_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '')
      : (process.env.AI_API_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  return {
    provider,
    apiKey,
    baseUrl,
    transcribeModel: process.env.AI_TRANSCRIBE_MODEL || 'whisper-1',
    analysisModel,
  };
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  mongoUri,
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  uploadDir: path.resolve(__dirname, '../../', process.env.UPLOAD_DIR || 'uploads'),
  ai: resolveAiConfig(),
  seed: {
    counsellorEmail: process.env.SEED_COUNSELLOR_EMAIL || 'counsellor@physicswallah.local',
    counsellorPassword: process.env.SEED_COUNSELLOR_PASSWORD || 'PhysicsWallah#2026',
    adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@physicswallah.local',
    adminPassword: process.env.SEED_ADMIN_PASSWORD || 'PhysicsWallah#2026',
  },
};

export function assertRuntimeConfig() {
  const missing = [];
  if (!env.mongoUri) missing.push('MONGODB_URI (or MONGO_URI / MONGODB_URL)');
  if (!env.jwtSecret || env.jwtSecret.length < 16) missing.push('JWT_SECRET (16+ characters)');
  if (missing.length) {
    throw new Error(
      `Missing environment variables: ${missing.join(', ')}. Copy .env.example to .env and fill them in.`,
    );
  }
}

export function aiConfigured() {
  return Boolean(env.ai.apiKey) && env.ai.provider !== 'stub';
}
