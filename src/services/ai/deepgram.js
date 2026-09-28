import fs from 'fs/promises';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { mapDetectedLanguage } from './normalize.js';

function listenQuery(language) {
  const params = new URLSearchParams({
    model: env.deepgram.model,
    language: language === 'en' ? 'en' : 'te',
    smart_format: 'true',
    punctuate: 'true',
    diarize: 'true',
    utterances: 'true',
  });
  for (const term of ['scholarship', 'hostel', 'instalment', 'fee', 'WhatsApp']) {
    params.append('keyterm', term);
  }
  return params;
}

export async function transcribeWithDeepgram({ filePath, mimeType, language = 'mixed' }) {
  if (!env.deepgram.apiKey) {
    throw new AppError('DEEPGRAM_API_KEY is not set. Paste the conversation, or add the key and reprocess.', 400);
  }
  const audio = await fs.readFile(filePath);
  const response = await fetch(`https://api.deepgram.com/v1/listen?${listenQuery(language)}`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${env.deepgram.apiKey}`,
      'Content-Type': mimeType || 'audio/webm',
    },
    body: audio,
    signal: AbortSignal.timeout(180000),
  });
  if (!response.ok) {
    const body = await response.text();
    console.error(`Deepgram ${response.status}:`, body.slice(0, 400));
    throw new AppError(`Deepgram returned ${response.status}`, 502);
  }
  const payload = await response.json();
  const channel = payload.results?.channels?.[0];
  const alternative = channel?.alternatives?.[0];
  const detected = channel?.detected_language || '';
  const spokenLanguage = mapDetectedLanguage(detected, language);
  const utterances = Array.isArray(payload.results?.utterances) ? payload.results.utterances : [];
  const segments = utterances
    .map((item) => ({
      speaker: Number.isInteger(item.speaker) ? `speaker ${item.speaker}` : 'unknown',
      startMs: Math.round(Number(item.start || 0) * 1000),
      endMs: Math.round(Number(item.end || 0) * 1000),
      text: String(item.transcript || '').trim(),
      language: spokenLanguage,
    }))
    .filter((item) => item.text);
  const text = String(alternative?.transcript || segments.map((item) => item.text).join('\n')).trim();
  if (!text) throw new AppError('Deepgram did not hear any speech in the recording', 422);
  return {
    text,
    language: spokenLanguage,
    detectedLanguage: String(detected || ''),
    segments,
    provider: 'deepgram',
    model: env.deepgram.model,
    isPlaceholder: false,
    placeholderMessage: '',
  };
}
