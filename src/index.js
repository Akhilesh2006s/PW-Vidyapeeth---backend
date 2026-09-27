import mongoose from 'mongoose';
import { createApp } from './app.js';
import { env, assertRuntimeConfig } from './config/env.js';
import { connectDb } from './config/db.js';

assertRuntimeConfig();

await connectDb();
console.log('Connected to MongoDB');

const app = createApp();
const server = app.listen(env.port, () => {
  const ai = env.ai.apiKey
    ? `AI provider ${env.ai.provider} (${env.ai.analysisModel})`
    : 'No AI key is set; analysis stays in placeholder mode';
  console.log(`PW Vidyapeeth API listening on http://localhost:${env.port}`);
  console.log(ai);
});

async function shutdown() {
  server.close();
  await mongoose.disconnect();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
