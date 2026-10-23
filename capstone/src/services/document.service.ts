import { prisma } from '../lib/prisma';
import { NotFoundError } from '../lib/errors';
import { appEvents } from '../lib/events';
import { DOC_EVENTS } from '../events/document.events';
import { queueDocumentForProcessing } from '../queues/document.queue';

interface ListDocumentsOptions {
  page: number;
  limit: number;
  status?: string;
  search?: string;
  sortBy?: 'createdAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export async function listDocuments(userId: string, options: ListDocumentsOptions) {
  const { page, limit, status, search, sortBy = 'createdAt', sortOrder = 'desc' } = options;

  // Build the where clause dynamically — undefined fields are ignored by Prisma
  const where: any = { userId, deletedAt: null };
  if (status) where.status = status;
  if (search) where.title = { contains: search };

  // Run the list query and the count query at the same time instead of
  // sequentially — cuts total wait time roughly in half.
  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
      select: { id: true, title: true, filename: true, status: true, chunkCount: true, createdAt: true, updatedAt: true },
    }),
    prisma.document.count({ where }),
  ]);

  return { data: documents, meta: { page, limit, total } };
}

export async function getDocument(documentId: string, userId: string) {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });

  // 404, never 403, for both "doesn't exist" AND "exists but isn't yours" —
  // telling an attacker which is true leaks information.
  if (!doc || doc.deletedAt || doc.userId !== userId) {
    throw new NotFoundError('Document not found');
  }

  return doc;
}

export async function createDocument(data: { title: string; content: string; userId: string }) {
  const doc = await prisma.document.create({
    data: {
      userId: data.userId,
      title: data.title,
      filename: data.title.toLowerCase().replace(/\s+/g, '-'),
      content: data.content,
      fileSizeBytes: Buffer.byteLength(data.content),
      status: 'pending',
    },
  });

  const jobId = await queueDocumentForProcessing(doc.id, data.userId);

  appEvents.emit(DOC_EVENTS.CREATED, {
    userId: data.userId,
    documentId: doc.id,
    title: doc.title,
    fileSizeBytes: doc.fileSizeBytes,
  });

  return doc;
}

export async function deleteDocument(documentId: string, userId: string) {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc || doc.deletedAt) throw new NotFoundError('Document not found');
  if (doc.userId !== userId) throw new NotFoundError('Document not found');

  // Soft delete: set deletedAt instead of actually removing the row.
  // listDocuments/getDocument both filter on deletedAt: null, so to
  // the user it's gone — but it's recoverable, and chunks aren't lost.
  const deleted = await prisma.document.update({
    where: { id: documentId },
    data: { deletedAt: new Date(), deletedBy: userId },
  });

  appEvents.emit(DOC_EVENTS.DELETED, { deletedBy: userId, documentId: doc.id, title: doc.title });

  return deleted;
}