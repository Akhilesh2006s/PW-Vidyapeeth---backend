import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const optionalEmail = z.union([z.string().trim().email(), z.literal('')]).optional();
const language = z.enum(['en', 'te', 'mixed']);
const priority = z.enum(['low', 'medium', 'high']);

export const registerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().email(),
    password: z.string().min(8).max(72),
    phone: z.string().trim().max(20).optional().default(''),
    preferredLanguage: z.enum(['en', 'te']).optional().default('en'),
  }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().email(),
    password: z.string().min(1),
  }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

const password = z.string().min(10).max(72);

export const createStaffAccountSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().email(),
    password,
    jobTitle: z.string().trim().min(2).max(80),
    phone: z.string().trim().max(20).optional().default(''),
    preferredLanguage: z.enum(['en', 'te']).optional().default('en'),
  }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1).max(72),
    newPassword: password,
  }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

const listQuery = z.object({
  q: z.string().trim().max(80).optional(),
  language: language.optional(),
  status: z.string().trim().optional(),
  stage: z.string().trim().optional(),
});

export const listSchema = z.object({
  body: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
  query: listQuery,
});

export const idSchema = z.object({
  body: z.object({}).passthrough(),
  params: z.object({ id: objectId }),
  query: z.object({}).passthrough(),
});

const newParent = z
  .object({
    fullName: z.string().trim().min(2).max(80),
    relation: z.enum(['mother', 'father', 'guardian', 'other']).optional(),
    phone: z.string().trim().max(20).optional().default(''),
    email: optionalEmail,
    preferredLanguage: language.optional(),
  })
  .optional();

export const createStudentSchema = z.object({
  body: z.object({
    fullName: z.string().trim().min(2).max(80),
    email: optionalEmail,
    phone: z.string().trim().max(20).optional().default(''),
    grade: z.string().trim().max(40).optional().default(''),
    targetProgram: z.string().trim().max(120).optional().default(''),
    preferredLanguage: language.optional(),
    notes: z.string().trim().max(2000).optional().default(''),
    parentIds: z.array(objectId).optional().default([]),
    newParent,
    counsellorId: objectId.optional(),
  }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

export const updateStudentSchema = createStudentSchema.partial({ body: true }).extend({
  params: z.object({ id: objectId }),
  body: createStudentSchema.shape.body.partial().extend({
    status: z.enum(['active', 'archived']).optional(),
  }),
});

export const createParentSchema = z.object({
  body: z.object({
    fullName: z.string().trim().min(2).max(80),
    email: optionalEmail,
    phone: z.string().trim().max(20).optional().default(''),
    relation: z.enum(['mother', 'father', 'guardian', 'other']).optional(),
    preferredLanguage: language.optional(),
    notes: z.string().trim().max(2000).optional().default(''),
    studentIds: z.array(objectId).optional().default([]),
    counsellorId: objectId.optional(),
  }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

export const updateParentSchema = z.object({
  params: z.object({ id: objectId }),
  query: z.object({}).passthrough(),
  body: createParentSchema.shape.body.partial(),
});

const admissionStage = z.enum(['enquiry', 'application', 'counselling', 'offered', 'enrolled', 'withdrawn']);

export const createAdmissionSchema = z.object({
  body: z.object({
    studentName: z.string().trim().min(2).max(80),
    parentName: z.string().trim().min(2).max(80),
    program: z.string().trim().min(2).max(120),
    intake: z.string().trim().max(40).optional().default(''),
    stage: admissionStage.optional(),
    status: z.enum(['open', 'closed']).optional(),
    notes: z.string().trim().max(2000).optional().default(''),
  }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

export const updateAdmissionSchema = z.object({
  params: z.object({ id: objectId }),
  query: z.object({}).passthrough(),
  body: z.object({
    studentName: z.string().trim().min(2).max(80).optional(),
    parentName: z.string().trim().min(2).max(80).optional(),
    program: z.string().trim().min(2).max(120).optional(),
    intake: z.string().trim().max(40).optional(),
    stage: admissionStage.optional(),
    status: z.enum(['open', 'closed']).optional(),
    notes: z.string().trim().max(2000).optional(),
  }),
});

export const createSessionSchema = z.object({
  body: z.object({
    studentName: z.string().trim().min(2).max(80),
    parentName: z.string().trim().min(2).max(80),
    language: language.optional(),
    title: z.string().trim().max(140).optional().default(''),
    notes: z.string().trim().max(2000).optional().default(''),
    studentId: objectId.optional(),
    parentId: objectId.optional(),
  }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

export const updateSessionSchema = z.object({
  params: z.object({ id: objectId }),
  query: z.object({}).passthrough(),
  body: z.object({
    notes: z.string().trim().max(2000).optional(),
    title: z.string().trim().max(140).optional(),
    language: language.optional(),
  }),
});

export const textTranscriptSchema = z.object({
  params: z.object({ id: objectId }),
  query: z.object({}).passthrough(),
  body: z.object({
    text: z.string().trim().min(10).max(100000),
  }),
});

export const createFollowUpSchema = z.object({
  body: z.object({
    studentId: objectId.optional(),
    sessionId: objectId.optional(),
    action: z.string().trim().min(2).max(500),
    priority: priority.optional(),
    dueAt: z.union([z.string().min(4), z.null()]).optional(),
    suggestedOwner: z.enum(['counsellor', 'student', 'parent']).optional(),
  }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

export const updateFollowUpSchema = z.object({
  params: z.object({ id: objectId }),
  query: z.object({}).passthrough(),
  body: z.object({
    status: z.enum(['open', 'done', 'dismissed']).optional(),
    action: z.string().trim().min(2).max(500).optional(),
    priority: priority.optional(),
    dueAt: z.union([z.string().min(4), z.null()]).optional(),
  }),
});
