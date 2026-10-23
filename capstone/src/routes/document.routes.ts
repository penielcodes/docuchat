import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requirePermission } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { conditionalGet } from '../middleware/etag';
import { uploadLimiter } from '../middleware/rateLimiter';
import { createDocumentSchema, listDocumentsSchema, documentParamsSchema } from '../validators/document.validator';
import * as documentService from '../services/document.service';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('documents:read'), validate(listDocumentsSchema), conditionalGet(), async (req, res, next) => {
  try {
    const result = await documentService.listDocuments(req.user!.id, req.query as any);
    res.json({ success: true, ...result });
  } catch (error) { next(error); }
});

router.post('/', uploadLimiter, requirePermission('documents:create'), validate(createDocumentSchema), async (req, res, next) => {
  try {
    const doc = await documentService.createDocument({ ...req.body, userId: req.user!.id });
    res.status(202).json({ success: true, data: doc });
  } catch (error) { next(error); }
});

router.get('/:id', requirePermission('documents:read'), validate(documentParamsSchema), conditionalGet(), async (req, res, next) => {
  try {
    const doc = await documentService.getDocument(req.params.id, req.user!.id);
    res.json({ success: true, data: doc });
  } catch (error) { next(error); }
});

router.delete('/:id', requirePermission('documents:delete'), validate(documentParamsSchema), async (req, res, next) => {
  try {
    await documentService.deleteDocument(req.params.id, req.user!.id);
    res.json({ success: true, data: { message: 'Document deleted' } });
  } catch (error) { next(error); }
});

export default router;