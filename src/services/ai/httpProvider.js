import fs from 'fs';
import path from 'path';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { mapDetectedLanguage, normalizeAnalysis } from './normalize.js';

async function readError(response) {
  const body = await response.text();
  console.error(`AI HTTP provider ${response.status}:`, body.slice(0, 400));
  throw new AppError(`AI provider returned ${response.status}`, 502);
}

/**
 * Generic adapter. Point AI_API_BASE_URL at a gateway that implements:
 * POST /transcribe  (multipart file + language) -> { text, language, segments }
 * POST /analyze     (JSON { transcript, language, context }) -> structured analysis
 */
export class HttpAiProvider {
  id = 'http';

  async transcribe({ filePath, filename, mimeType, language = 'mixed' }) {
    const buffer = await fs.promises.readFile(filePath);
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: mimeType || 'audio/webm' }), filename || path.basename(filePath));
    form.append('language', language);
    const response = await fetch(`${env.ai.baseUrl}/transcribe`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.ai.apiKey}` },
      body: form,
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok) await readError(response);
    const payload = await response.json();
    const detected = mapDetectedLanguage(payload.language || payload.detectedLanguage, language);
    return {
      text: String(payload.text || '').trim(),
      language: language === 'mixed' ? 'mixed' : detected,
      detectedLanguage: detected,
      segments: Array.isArray(payload.segments) ? payload.segments : [],
      provider: this.id,
      model: payload.model || '',
      isPlaceholder: false,
      placeholderMessage: '',
    };
  }

  async analyze({ transcript, language = 'mixed', context = {} }) {
    const response = await fetch(`${env.ai.baseUrl}/analyze`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.ai.apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(120000),
      body: JSON.stringify({ transcript, language, context }),
    });
    if (!response.ok) await readError(response);
    const payload = await response.json();
    const content = payload.analysis || payload;
    return {
      ...normalizeAnalysis(content, language),
      provider: this.id,
      model: payload.model || '',
      isPlaceholder: false,
    };
  }
}
