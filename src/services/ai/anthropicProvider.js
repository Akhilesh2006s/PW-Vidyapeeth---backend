import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { ANALYSIS_SYSTEM_PROMPT, SPEAKER_SYSTEM_PROMPT, normalizeAnalysis, speakerTurns } from './normalize.js';

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fenced ? fenced[1] : text;
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new AppError('Claude returned analysis that was not valid JSON', 502);
  }
  try {
    return JSON.parse(source.slice(start, end + 1));
  } catch {
    throw new AppError('Claude returned analysis that was not valid JSON', 502);
  }
}

export class AnthropicProvider {
  id = 'anthropic';

  async transcribe() {
    throw new AppError(
      'Set DEEPGRAM_API_KEY to transcribe a recording. You can also paste the conversation as text.',
      400,
    );
  }

  async identifySpeakers({ transcript, context = {} }) {
    const text = String(transcript || '').trim();
    if (!text) return [];
    try {
      const response = await fetch(`${env.ai.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': env.ai.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        signal: AbortSignal.timeout(120000),
        body: JSON.stringify({
          model: env.ai.analysisModel,
          max_tokens: 8000,
          thinking: { type: 'disabled' },
          system: SPEAKER_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: JSON.stringify({ transcript: text, context }) }],
        }),
      });
      if (!response.ok) return [];
      const payload = await response.json();
      const content = Array.isArray(payload.content)
        ? payload.content.filter((block) => block.type === 'text' && block.text).map((block) => block.text).join('\n')
        : '';
      return speakerTurns(extractJson(content).speakers);
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
            summary: 'No conversation text was provided.',
            language,
          },
          language,
        ),
        provider: this.id,
        model: env.ai.analysisModel,
        isPlaceholder: false,
      };
    }

    const response = await fetch(`${env.ai.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': env.ai.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      signal: AbortSignal.timeout(120000),
      body: JSON.stringify({
        model: env.ai.analysisModel,
        max_tokens: 8000,
        thinking: { type: 'disabled' },
        system: `${ANALYSIS_SYSTEM_PROMPT}\nReturn only the JSON object. Do not wrap it in markdown.`,
        messages: [
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

    if (!response.ok) {
      const body = await response.text();
      console.error(`Claude ${response.status}:`, body.slice(0, 400));
      throw new AppError(`Claude returned ${response.status}`, 502);
    }

    const payload = await response.json();
    const content = Array.isArray(payload.content)
      ? payload.content
          .filter((block) => block.type === 'text' && block.text)
          .map((block) => block.text)
          .join('\n')
      : '';
    const parsed = extractJson(content);
    return {
      ...normalizeAnalysis(parsed, language),
      provider: this.id,
      model: env.ai.analysisModel,
      isPlaceholder: false,
    };
  }
}
