import { env } from '../../config/env.js';
import { AnthropicProvider } from './anthropicProvider.js';
import { HttpAiProvider } from './httpProvider.js';
import { OpenAiProvider } from './openaiProvider.js';
import { StubAiProvider } from './stubProvider.js';

/**
 * Swap providers with AI_PROVIDER without changing the session pipeline.
 * auto: Claude when ANTHROPIC_API_KEY is set, otherwise OpenAI when AI_API_KEY is set.
 */
export function createAiProvider() {
  const name = env.ai.provider;
  const hasKey = Boolean(env.ai.apiKey);
  if (name === 'stub' || !hasKey) return new StubAiProvider();
  if (name === 'http') return new HttpAiProvider();
  if (name === 'anthropic') return new AnthropicProvider();
  if (name === 'openai' || name === 'auto') return new OpenAiProvider();
  throw new Error(`Unknown AI_PROVIDER "${name}". Use auto, anthropic, openai, http, or stub.`);
}
