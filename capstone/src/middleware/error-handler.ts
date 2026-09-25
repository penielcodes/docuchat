import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors';

// This MUST have exactly 4 parameters — that's how Express recognizes
// error-handling middleware. A 3-param function here is silently ignored
// on errors.
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Case 1: we threw this on purpose (ConflictError, UnauthorizedError, etc.)
  // These are "operational" — expected situations, not bugs.
  if (err instanceof AppError) {
    console.warn(`[${err.code}] ${err.message}`);

    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && { details: err.details }),
      },
    });
  }

  // Case 2: something we did NOT anticipate — a real bug.
  // Log the full error internally, but never leak details to the client.
  console.error('Unhandled error:', err);

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}