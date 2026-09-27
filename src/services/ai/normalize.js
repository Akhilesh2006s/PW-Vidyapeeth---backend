const PRIORITIES = new Set(['low', 'medium', 'high']);
const LANGUAGES = new Set(['en', 'te', 'mixed']);
const OWNERS = new Set(['counsellor', 'student', 'parent']);
const SPEAKERS = new Set(['counsellor', 'parent', 'student', 'unknown']);

function stringList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean);
}

function priority(value, fallback = 'medium') {
  return PRIORITIES.has(value) ? value : fallback;
}

export function normalizeAnalysis(input, fallbackLanguage = 'mixed') {
  const src = input && typeof input === 'object' ? input : {};
  const language = LANGUAGES.has(src.language) ? src.language : fallbackLanguage;
  const studentIntent = src.studentIntent && typeof src.studentIntent === 'object' ? src.studentIntent : {};

  const parentConcerns = Array.isArray(src.parentConcerns)
    ? src.parentConcerns
        .map((item) => {
          if (typeof item === 'string') return { concern: item.trim(), severity: 'medium' };
          if (!item || typeof item !== 'object') return null;
          const concern = String(item.concern || item.text || '').trim();
          if (!concern) return null;
          return { concern, severity: priority(item.severity) };
        })
        .filter(Boolean)
    : [];

  const objections = Array.isArray(src.objections)
    ? src.objections
        .map((item) => {
          if (typeof item === 'string') return { objection: item.trim(), status: 'open' };
          if (!item || typeof item !== 'object') return null;
          const objection = String(item.objection || item.text || '').trim();
          if (!objection) return null;
          return { objection, status: item.status === 'addressed' ? 'addressed' : 'open' };
        })
        .filter(Boolean)
    : [];

  const sentimentIndicators = Array.isArray(src.sentimentIndicators)
    ? src.sentimentIndicators
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const aspect = String(item.aspect || '').trim();
          const indicator = String(item.indicator || item.note || '').trim();
          if (!aspect || !indicator) return null;
          return { aspect, indicator, intensity: priority(item.intensity) };
        })
        .filter(Boolean)
    : [];

  const followUpActions = Array.isArray(src.followUpActions)
    ? src.followUpActions
        .map((item) => {
          if (typeof item === 'string') {
            return { action: item.trim(), priority: 'medium', suggestedOwner: 'counsellor' };
          }
          if (!item || typeof item !== 'object') return null;
          const action = String(item.action || '').trim();
          if (!action) return null;
          return {
            action,
            priority: priority(item.priority),
            suggestedOwner: OWNERS.has(item.suggestedOwner) ? item.suggestedOwner : 'counsellor',
          };
        })
        .filter(Boolean)
    : [];

  return {
    summary: String(src.summary || '').trim(),
    language,
    topics: stringList(src.topics),
    parentConcerns,
    studentIntent: {
      summary: String(studentIntent.summary || '').trim(),
      signals: stringList(studentIntent.signals),
    },
    objections,
    sentimentIndicators,
    unansweredQuestions: stringList(src.unansweredQuestions),
    counsellorStrengths: stringList(src.counsellorStrengths),
    counsellorImprovements: stringList(src.counsellorImprovements),
    missedOpportunities: stringList(src.missedOpportunities),
    recommendations: stringList(src.recommendations),
    followUpActions,
    requiredPoints: stringList(src.requiredPoints),
    coveredPoints: pairList(src.coveredPoints, 'evidence'),
    missedPoints: pairList(src.missedPoints, 'lossReason'),
    businessLoss: String(src.businessLoss || '').trim(),
    speakers: speakerTurns(src.speakers),
  };
}

export function speakerTurns(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const text = String(item.text || '')
        .replace(/^\s*(counsellor|parent|student|కౌన్సెలర్|తల్లిదండ్రులు|విద్యార్థి)\s*:\s*/i, '')
        .trim();
      if (!text) return null;
      const raw = String(item.speaker || '').toLowerCase();
      return { speaker: SPEAKERS.has(raw) ? raw : 'unknown', text };
    })
    .filter(Boolean);
}

function pairList(value, extraKey) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const point = String(item.point || '').trim();
      const extra = String(item[extraKey] || '').trim();
      if (!point) return null;
      return { point, [extraKey]: extra };
    })
    .filter(Boolean);
}

export function mapDetectedLanguage(code, hint = 'mixed') {
  const raw = String(code || '').toLowerCase();
  if (raw === 'te' || raw.startsWith('telugu')) return 'te';
  if (raw === 'en' || raw.startsWith('english')) return 'en';
  if (hint === 'en' || hint === 'te') return hint;
  return 'mixed';
}

export const ANALYSIS_SYSTEM_PROMPT = `You are an admissions counselling analyst for PW Vidyapeeth.
The transcript may be Telugu, English, or a mix, including code-switching.
The counsellor does not label who is speaking. Identify the counsellor, parent, and student from the words, and from context.studentName and context.parentName.
If an earlier step already split the transcript into turns marked counsellor, parent, or student, those marks were identified from the conversation. Use them when you attribute concerns, intent, and strengths.
Do not assume the counsellor or the family spoke only English.
Quote important phrases in the original language when it helps the counsellor.
The user message includes requiredPoints. These are the points an admin said must be covered in the conversation.
Judge each required point only from the transcript. A point is covered only if the conversation actually addresses it.
Return one JSON object with exactly these keys:
summary (string),
language ("en" | "te" | "mixed"),
topics (string[]),
parentConcerns (array of { concern, severity: "low"|"medium"|"high" }),
studentIntent ({ summary, signals: string[] }),
objections (array of { objection, status: "open"|"addressed" }),
sentimentIndicators (array of { aspect, indicator, intensity: "low"|"medium"|"high" }),
unansweredQuestions (string[]),
counsellorStrengths (string[]),
counsellorImprovements (string[]),
missedOpportunities (string[]),
recommendations (string[]),
followUpActions (array of { action, priority: "low"|"medium"|"high", suggestedOwner: "counsellor"|"student"|"parent" }),
requiredPoints (string[], copy the admin list),
coveredPoints (array of { point, evidence } for required points that were actually discussed),
missedPoints (array of { point, lossReason } for required points that were not discussed),
businessLoss (string).
businessLoss must say how many points the admin set, how many were covered, how many were missed, and why PW Vidyapeeth will face a loss when points are missed. Example: "The admin set 8 points to be covered. 5 were covered and 3 were missed. PW Vidyapeeth will face a loss because the family left without the fee, scholarship, and hostel answers and may choose another institute."
Each lossReason must explain the business loss for that missed point. Do not invent facts that are not supported by the transcript or by a missed required point.`;

export const SPEAKER_SYSTEM_PROMPT = `You identify who is speaking in a PW Vidyapeeth counselling conversation.
The transcript may be Telugu, English, or a mix. The counsellor did not type speaker labels.
Return only a JSON object: {"speakers":[{"speaker":"counsellor"|"parent"|"student"|"unknown","text":"..."}]}
Split the transcript into speaking turns in order. Keep each turn's original words. Do not summarise and do not add prefixes such as "Counsellor:", "Parent:", or "Student:".
If those prefixes are already in the text, drop the prefix and keep the words.
counsellor is the institute staff explaining the program, fees, hostel, placements, or the next step.
parent is the adult asking about cost, safety, scholarship, or documents. context.parentName is that person when the name is used.
student is the young person talking about their own course, rank, or studies. context.studentName is that person when the name is used.
Use unknown only when the turn could belong to more than one person.`;
