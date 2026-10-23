import { Request, Response, NextFunction } from 'express';
import { getUserPermissions } from '../services/rbac.service';
import { ForbiddenError } from '../lib/errors';

// Unlike authorize() (which checks a single role string), this checks
// fine-grained permissions loaded from the database. Pass one or more
// permission names — the user must have ALL of them to proceed.
export function requirePermission(...requiredPermissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new ForbiddenError('Not authenticated');
      }

      const userPermissions = await getUserPermissions(req.user.id);

      const missing = requiredPermissions.filter((p) => !userPermissions.has(p));

      if (missing.length > 0) {
        throw new ForbiddenError('You do not have the required permission.');
      }

      next();
    } catch (error) {
      next(error); // hands off to your Day 5 global error handler
    }
  };
}

export function authorize(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}