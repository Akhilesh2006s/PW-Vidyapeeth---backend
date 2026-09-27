import { CoveragePoint } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idSchema } from '../validators/schemas.js';
import { z } from 'zod';

const pointText = z.string().trim().min(3).max(300);

const createPointSchema = z.object({
  body: z.union([
    z.object({ texts: z.array(pointText).min(1).max(40) }),
    z.object({ text: pointText }),
  ]),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

export const listPoints = asyncHandler(async (_req, res) => {
  const data = await CoveragePoint.find({ active: true }).sort({ order: 1, createdAt: 1 });
  res.json({ data });
});

export const createPoint = [
  requireAdmin,
  validate(createPointSchema),
  asyncHandler(async (req, res) => {
    const texts = req.validated.body.texts ?? [req.validated.body.text];
    const count = await CoveragePoint.countDocuments({ active: true });
    const data = await CoveragePoint.insertMany(
      texts.map((text, index) => ({ text, order: count + index + 1, active: true })),
    );
    res.status(201).json({ data });
  }),
];

export const removePoint = [
  requireAdmin,
  validate(idSchema),
  asyncHandler(async (req, res) => {
    const point = await CoveragePoint.findByIdAndUpdate(req.validated.params.id, { active: false }, { new: true });
    if (!point) throw new AppError('Point not found', 404);
    res.json({ data: point });
  }),
];
