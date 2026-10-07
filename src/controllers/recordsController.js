import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { idSchema, listSchema, createStudentSchema, updateStudentSchema, createParentSchema, updateParentSchema, createAdmissionSchema, updateAdmissionSchema } from '../validators/schemas.js';
import * as studentService from '../services/studentService.js';
import * as parentService from '../services/parentService.js';
import * as admissionService from '../services/admissionService.js';
import { Counsellor } from '../models/index.js';

export const listCounsellors = asyncHandler(async (req, res) => {
  const filter = req.user.role === 'admin' ? {} : { _id: req.counsellor._id };
  const counsellors = await Counsellor.find(filter).populate('user', 'name email phone preferredLanguage role');
  res.json({ data: counsellors });
});

export const listStudents = [validate(listSchema), asyncHandler(async (req, res) => {
  req.query = { ...req.query, ...req.validated.query };
  const data = await studentService.listStudents(req);
  res.json({ data });
})];

export const getStudent = [validate(idSchema), asyncHandler(async (req, res) => {
  const data = await studentService.getStudent(req, req.validated.params.id);
  res.json({ data });
})];

export const createStudent = [validate(createStudentSchema), asyncHandler(async (req, res) => {
  const data = await studentService.createStudent(req, req.validated.body);
  res.status(201).json({ data });
})];

export const updateStudent = [validate(updateStudentSchema), asyncHandler(async (req, res) => {
  const data = await studentService.updateStudent(req, req.validated.params.id, req.validated.body);
  res.json({ data });
})];

export const listParents = [validate(listSchema), asyncHandler(async (req, res) => {
  req.query = { ...req.query, ...req.validated.query };
  const data = await parentService.listParents(req);
  res.json({ data });
})];

export const getParent = [validate(idSchema), asyncHandler(async (req, res) => {
  const data = await parentService.getParent(req, req.validated.params.id);
  res.json({ data });
})];

export const getParentAnalysis = [validate(idSchema), asyncHandler(async (req, res) => {
  const data = await parentService.getParentAnalysis(req, req.validated.params.id);
  res.json({ data });
})];

export const createParent = [validate(createParentSchema), asyncHandler(async (req, res) => {
  const data = await parentService.createParent(req, req.validated.body);
  res.status(201).json({ data });
})];

export const updateParent = [validate(updateParentSchema), asyncHandler(async (req, res) => {
  const data = await parentService.updateParent(req, req.validated.params.id, req.validated.body);
  res.json({ data });
})];

export const listAdmissions = [validate(listSchema), asyncHandler(async (req, res) => {
  req.query = { ...req.query, ...req.validated.query };
  const data = await admissionService.listAdmissions(req);
  res.json({ data });
})];

export const getAdmission = [validate(idSchema), asyncHandler(async (req, res) => {
  const data = await admissionService.getAdmission(req, req.validated.params.id);
  res.json({ data });
})];

export const createAdmission = [validate(createAdmissionSchema), asyncHandler(async (req, res) => {
  const data = await admissionService.createAdmission(req, req.validated.body);
  res.status(201).json({ data });
})];

export const updateAdmission = [validate(updateAdmissionSchema), asyncHandler(async (req, res) => {
  const data = await admissionService.updateAdmission(req, req.validated.params.id, req.validated.body);
  res.json({ data });
})];
