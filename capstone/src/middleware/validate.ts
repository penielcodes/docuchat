import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// This function takes a Zod schema and returns an Express middleware function.
// Wrapping it like this lets us reuse the same validation logic for every
// route — you just pass in a different schema each time.
export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    // safeParse (instead of parse) won't throw on failure — it returns
    // an object with either { success: true, data } or { success: false, error }.
    // We bundle body/query/params together so one schema can validate all three at once.
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      // Zod's error paths look like ["body", "email"] — we drop the first
      // element ("body") so the client just sees field: "email", not "body.email".
      const errors = result.error.errors.map((err) => ({
        field: err.path.slice(1).join('.'),
        message: err.message,
      }));

      // 400 = the request itself is malformed. We return early — the
      // route handler below never runs if validation fails.
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: errors,
        },
      });
    }

    // Important: we overwrite req.body/query/params with the VALIDATED data,
    // not the original. This matters because Zod's .transform() (like
    // lowercasing an email) and .default() only exist on result.data —
    // if we skipped this, those transforms would be silently lost.
    req.body = result.data.body ?? req.body;
    req.query = result.data.query ?? req.query;
    req.params = result.data.params ?? req.params;

    // Validation passed — hand control to the next middleware/route handler.
    next();
  };
}