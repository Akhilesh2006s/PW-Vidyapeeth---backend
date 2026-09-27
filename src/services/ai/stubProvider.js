import { normalizeAnalysis } from './normalize.js';

const PLACEHOLDER_MESSAGE = [
  'AI_API_KEY ఇంకా సెట్ కాలేదు. ఆడియో సేవ్ అయింది. కీ జోడించిన తర్వాత ఈ సెషన్‌ను మళ్లీ ప్రాసెస్ చేయండి. తెలుగు మరియు ఇంగ్లీష్ సంభాషణలు రెండూ సపోర్ట్ అవుతాయి.',
  'AI_API_KEY is not configured. The recording is stored. Reprocess this session after adding a key. Telugu and English conversations are both supported.',
].join('\n\n');

export class StubAiProvider {
  id = 'stub';

  async transcribe({ language = 'mixed' }) {
    return {
      text: '',
      language: language === 'en' || language === 'te' ? language : 'mixed',
      detectedLanguage: '',
      segments: [],
      provider: this.id,
      model: '',
      isPlaceholder: true,
      placeholderMessage: PLACEHOLDER_MESSAGE,
    };
  }

  async identifySpeakers() {
    return [];
  }

  async analyze({ language = 'mixed' }) {
    return {
      ...normalizeAnalysis(
        {
          summary: PLACEHOLDER_MESSAGE,
          language,
        },
        language,
      ),
      provider: this.id,
      model: '',
      isPlaceholder: true,
    };
  }
}
