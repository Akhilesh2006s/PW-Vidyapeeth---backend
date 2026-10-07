import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { createFollowUpSchema, idSchema, listSchema, updateFollowUpSchema } from '../validators/schemas.js';
import * as followUpService from '../services/followUpService.js';
import * as analyticsService from '../services/analyticsService.js';

export const listFollowUps = [validate(listSchema), asyncHandler(async (req, res) => {
  req.query = { ...req.query, ...req.validated.query };
  const data = await followUpService.listFollowUps(req);
  res.json({ data });
})];

export const createFollowUp = [validate(createFollowUpSchema), asyncHandler(async (req, res) => {
  const data = await followUpService.createFollowUp(req, req.validated.body);
  res.status(201).json({ data });
})];

export const updateFollowUp = [validate(updateFollowUpSchema), asyncHandler(async (req, res) => {
  const data = await followUpService.updateFollowUp(req, req.validated.params.id, req.validated.body);
  res.json({ data });
})];

export const getFollowUp = [validate(idSchema), asyncHandler(async (req, res) => {
  const rows = await followUpService.listFollowUps(req);
  const data = rows.find((row) => String(row.id || row._id) === req.validated.params.id);
  if (!data) {
    res.status(404).json({ message: 'Follow-up not found' });
    return;
  }
  res.json({ data });
})];

export const analyticsOverview = asyncHandler(async (req, res) => {
  const data = await analyticsService.overview(req);
  res.json({ data });
});

export const counsellorPerformance = asyncHandler(async (req, res) => {
  const data = await analyticsService.counsellorPerformance(req);
  res.json({ data });
});
