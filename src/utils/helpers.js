export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function ownerFilter(req, field = 'counsellor') {
  if (req.user.role === 'admin') return {};
  return { [field]: req.counsellor._id };
}

export function counsellorIdFrom(req, requestedId) {
  if (req.user.role === 'admin') {
    if (!requestedId) {
      const error = new Error('counsellorId is required for admin requests');
      error.statusCode = 400;
      throw error;
    }
    return requestedId;
  }
  return req.counsellor._id;
}
