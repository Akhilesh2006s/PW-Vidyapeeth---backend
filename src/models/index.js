import mongoose from 'mongoose';

const languageEnum = ['en', 'te', 'mixed'];
const uiLanguageEnum = ['en', 'te'];
const priorityEnum = ['low', 'medium', 'high'];

mongoose.plugin((schema) => {
  schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform(_doc, ret) {
      if (ret._id != null) ret.id = String(ret._id);
      delete ret._id;
      delete ret.passwordHash;
      return ret;
    },
  });
});

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin', 'counsellor'], default: 'counsellor' },
    phone: { type: String, trim: true, default: '' },
    preferredLanguage: { type: String, enum: uiLanguageEnum, default: 'en' },
  },
  { timestamps: true, collection: 'users' },
);

const counsellorSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    employeeCode: { type: String, required: true, unique: true, trim: true },
    specializations: { type: [String], default: ['admissions'] },
    languages: { type: [{ type: String, enum: ['en', 'te'] }], default: ['en', 'te'] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'counsellors' },
);

const studentSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    grade: { type: String, trim: true, default: '' },
    targetProgram: { type: String, trim: true, default: '' },
    preferredLanguage: { type: String, enum: languageEnum, default: 'mixed' },
    counsellor: { type: mongoose.Schema.Types.ObjectId, ref: 'Counsellor', required: true, index: true },
    parents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Parent' }],
    notes: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['active', 'archived'], default: 'active', index: true },
  },
  { timestamps: true, collection: 'students' },
);

const parentSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    relation: { type: String, enum: ['mother', 'father', 'guardian', 'other'], default: 'guardian' },
    preferredLanguage: { type: String, enum: languageEnum, default: 'mixed' },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
    notes: { type: String, trim: true, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Counsellor', required: true, index: true },
  },
  { timestamps: true, collection: 'parents' },
);

const admissionSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },
    studentName: { type: String, required: true, trim: true },
    parentName: { type: String, required: true, trim: true },
    counsellor: { type: mongoose.Schema.Types.ObjectId, ref: 'Counsellor', required: true, index: true },
    program: { type: String, required: true, trim: true },
    intake: { type: String, trim: true, default: '' },
    stage: {
      type: String,
      enum: ['enquiry', 'application', 'counselling', 'offered', 'enrolled', 'withdrawn'],
      default: 'enquiry',
      index: true,
    },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    notes: { type: String, trim: true, default: '' },
    appliedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true, collection: 'admissions' },
);

const sessionSchema = new mongoose.Schema(
  {
    counsellor: { type: mongoose.Schema.Types.ObjectId, ref: 'Counsellor', required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },
    studentName: { type: String, required: true, trim: true },
    parentName: { type: String, required: true, trim: true },
    parents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Parent' }],
    admission: { type: mongoose.Schema.Types.ObjectId, ref: 'Admission', default: null },
    title: { type: String, trim: true, default: '' },
    language: { type: String, enum: languageEnum, default: 'mixed' },
    status: {
      type: String,
      enum: ['in_progress', 'audio_uploaded', 'processing', 'completed', 'failed'],
      default: 'in_progress',
      index: true,
    },
    startedAt: { type: Date, default: () => new Date() },
    endedAt: { type: Date, default: null },
    durationSeconds: { type: Number, default: 0 },
    processingError: { type: String, default: '' },
    processingStartedAt: { type: Date, default: null },
    notes: { type: String, trim: true, default: '' },
    inputSource: { type: String, enum: ['audio', 'text'], default: 'audio' },
  },
  { timestamps: true, collection: 'counselling_sessions' },
);

sessionSchema.index({ counsellor: 1, createdAt: -1 });

const audioSchema = new mongoose.Schema(
  {
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'CounsellingSession', required: true, unique: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    originalName: { type: String, default: 'recording.webm' },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    storagePath: { type: String, required: true },
    durationSeconds: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'audio_files' },
);

const segmentSchema = new mongoose.Schema(
  {
    speaker: { type: String, default: 'unknown' },
    startMs: { type: Number, default: 0 },
    endMs: { type: Number, default: 0 },
    text: { type: String, default: '' },
    language: { type: String, enum: languageEnum, default: 'mixed' },
  },
  { _id: false },
);

const transcriptSchema = new mongoose.Schema(
  {
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'CounsellingSession', required: true, unique: true },
    audioFile: { type: mongoose.Schema.Types.ObjectId, ref: 'AudioFile', default: null },
    source: { type: String, enum: ['audio', 'text'], default: 'audio' },
    language: { type: String, enum: languageEnum, default: 'mixed' },
    detectedLanguage: { type: String, default: '' },
    text: { type: String, default: '' },
    segments: { type: [segmentSchema], default: [] },
    provider: { type: String, default: 'stub' },
    model: { type: String, default: '' },
    isPlaceholder: { type: Boolean, default: false },
    placeholderMessage: { type: String, default: '' },
  },
  { timestamps: true, collection: 'transcripts' },
);

const concernSchema = new mongoose.Schema(
  {
    concern: { type: String, required: true },
    severity: { type: String, enum: priorityEnum, default: 'medium' },
  },
  { _id: false },
);

const objectionSchema = new mongoose.Schema(
  {
    objection: { type: String, required: true },
    status: { type: String, enum: ['open', 'addressed'], default: 'open' },
  },
  { _id: false },
);

const sentimentSchema = new mongoose.Schema(
  {
    aspect: { type: String, required: true },
    indicator: { type: String, required: true },
    intensity: { type: String, enum: priorityEnum, default: 'medium' },
  },
  { _id: false },
);

const followActionSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    priority: { type: String, enum: priorityEnum, default: 'medium' },
    suggestedOwner: { type: String, enum: ['counsellor', 'student', 'parent'], default: 'counsellor' },
  },
  { _id: false },
);

const analysisSchema = new mongoose.Schema(
  {
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'CounsellingSession', required: true, unique: true },
    transcript: { type: mongoose.Schema.Types.ObjectId, ref: 'Transcript', required: true },
    provider: { type: String, default: 'stub' },
    model: { type: String, default: '' },
    isPlaceholder: { type: Boolean, default: false },
    summary: { type: String, default: '' },
    language: { type: String, enum: languageEnum, default: 'mixed' },
    topics: { type: [String], default: [] },
    parentConcerns: { type: [concernSchema], default: [] },
    studentIntent: {
      summary: { type: String, default: '' },
      signals: { type: [String], default: [] },
    },
    objections: { type: [objectionSchema], default: [] },
    sentimentIndicators: { type: [sentimentSchema], default: [] },
    unansweredQuestions: { type: [String], default: [] },
    counsellorStrengths: { type: [String], default: [] },
    counsellorImprovements: { type: [String], default: [] },
    missedOpportunities: { type: [String], default: [] },
    recommendations: { type: [String], default: [] },
    followUpActions: { type: [followActionSchema], default: [] },
    requiredPoints: { type: [String], default: [] },
    coveredPoints: {
      type: [{ point: { type: String, required: true }, evidence: { type: String, default: '' } }],
      default: [],
    },
    missedPoints: {
      type: [{ point: { type: String, required: true }, lossReason: { type: String, default: '' } }],
      default: [],
    },
    businessLoss: { type: String, default: '' },
  },
  { timestamps: true, collection: 'ai_analyses' },
);

const followUpSchema = new mongoose.Schema(
  {
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'CounsellingSession', default: null, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },
    studentName: { type: String, trim: true, default: '' },
    analysis: { type: mongoose.Schema.Types.ObjectId, ref: 'AiAnalysis', default: null },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Counsellor', required: true, index: true },
    action: { type: String, required: true, trim: true },
    priority: { type: String, enum: priorityEnum, default: 'medium' },
    status: { type: String, enum: ['open', 'done', 'dismissed'], default: 'open', index: true },
    dueAt: { type: Date, default: null },
    source: { type: String, enum: ['ai', 'manual'], default: 'manual' },
    suggestedOwner: { type: String, enum: ['counsellor', 'student', 'parent'], default: 'counsellor' },
  },
  { timestamps: true, collection: 'follow_ups' },
);

export const User = mongoose.model('User', userSchema);
export const Counsellor = mongoose.model('Counsellor', counsellorSchema);
export const Student = mongoose.model('Student', studentSchema);
export const Parent = mongoose.model('Parent', parentSchema);
export const Admission = mongoose.model('Admission', admissionSchema);
export const CounsellingSession = mongoose.model('CounsellingSession', sessionSchema);
export const AudioFile = mongoose.model('AudioFile', audioSchema);
export const Transcript = mongoose.model('Transcript', transcriptSchema);
export const AiAnalysis = mongoose.model('AiAnalysis', analysisSchema);
export const FollowUp = mongoose.model('FollowUp', followUpSchema);

const coveragePointSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'coverage_points' },
);

export const CoveragePoint = mongoose.model('CoveragePoint', coveragePointSchema);
