export function validate(schema) {
  return (req, _res, next) => {
    const parsed = schema.safeParse({
      body: req.body ?? {},
      params: req.params ?? {},
      query: req.query ?? {},
    });
    if (!parsed.success) {
      next(parsed.error);
      return;
    }
    req.validated = parsed.data;
    next();
  };
}
