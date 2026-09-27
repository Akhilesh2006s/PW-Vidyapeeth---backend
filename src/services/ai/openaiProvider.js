import fs from 'fs';
import path from 'path';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { ANALYSIS_SYSTEM_PROMPT, SPEAKER_SYSTEM_PROMPT, mapDetectedLanguage, normalizeAnalysis, speakerTurns } from './normalize.js';

async function readError(response) {
  const body = await response.text();
  console.error(`AI provider ${response.status}:`, body.slice(0, 400));
  throw new AppError(`AI provider returned ${response.status}`, 502);
}

export class OpenAiProvider {
  id = 'openai';

  async transcribe({ filePath, filename, mimeType, language = 'mixed' }) {
    const buffer = await fs.promises.readFile(filePath);
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: mimeType || 'audio/webm' }), filename || path.basename(filePath));
    form.append('model', env.ai.transcribeModel);
    form.append('response_format', 'verbose_json');
    if (language === 'te') form.append('language', 'te');
    if (language === 'en') form.append('language', 'en');

    const response = await fetch(`${env.ai.baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.ai.apiKey}` },
      body: form,
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok) await readError(response);
    const payload = await response.json();
    const detected = mapDetectedLanguage(payload.language, language);
    const storedLanguage = language === 'mixed' ? 'mixed' : detected;
    const segments = Array.isArray(payload.segments)
      ? payload.segments.map((segment) => ({
          speaker: 'unknown',
          startMs: Math.round((segment.start || 0) * 1000),
          endMs: Math.round((segment.end || 0) * 1000),
          text: String(segment.text || '').trim(),
          language: storedLanguage,
        }))
      : [];

    return {
      text: String(payload.text || '').trim(),
      language: storedLanguage,
      detectedLanguage: detected,
      segments: segments.filter((segment) => segment.text),
      provider: this.id,
      model: env.ai.transcribeModel,
      isPlaceholder: false,
      placeholderMessage: '',
    };
  }

  async identifySpeakers({ transcript, context = {} }) {
    const text = String(transcript || '').trim();
    if (!text) return [];
    try {
      const response = await fetch(`${env.ai.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.ai.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(120000),
        body: JSON.stringify({
          model: env.ai.analysisModel,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SPEAKER_SYSTEM_PROMPT },
            { role: 'user', content: JSON.stringify({ transcript: text, context }) },
          ],
        }),
      });
      if (!response.ok) return [];
      const payload = await response.json();
      const content = payload.choices?.[0]?.message?.content || '{}';
      return speakerTurns(JSON.parse(content).speakers);
    } catch (error) {
      console.error('Speaker identification failed:', error.message);
      return [];
    }
  }

  async analyze({ transcript, language = 'mixed', context = {} }) {
    const text = String(transcript || '').trim();
    if (!text) {
      return {
        ...normalizeAnalysis(
          {
            summary: 'The transcription provider returned no speech. Check the recording and try again.',
            language,
          },
          language,
        ),
        provider: this.id,
        model: env.ai.analysisModel,
        isPlaceholder: false,
      };
    }

    const response = await fetch(`${env.ai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.ai.apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(120000),
      body: JSON.stringify({
        model: env.ai.analysisModel,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
          {
            role: 'user',
            content: JSON.stringify({
              languageHint: language,
              transcript: text,
              context,
            }),
          },
        ],
      }),
    });
    if (!response.ok) await readError(response);
    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content || '{}';
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new AppError('AI provider returned analysis that was not valid JSON', 502);
    }
    return {
      ...normalizeAnalysis(parsed, language),
      provider: this.id,
      model: env.ai.analysisModel,
      isPlaceholder: false,
    };
  }
}
