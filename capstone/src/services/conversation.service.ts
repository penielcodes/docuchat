import { prisma } from '../lib/prisma';
import { NotFoundError } from '../lib/errors';

export async function listConversations(userId: string, options: { page: number; limit: number }) {
  const { page, limit } = options;

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { content: true, role: true, createdAt: true } },
        _count: { select: { messages: true } },
      },
    }),
    prisma.conversation.count({ where: { userId } }),
  ]);

  return {
    data: conversations.map((c) => ({
      id: c.id,
      title: c.title,
      messageCount: c._count.messages,
      lastMessage: c.messages[0] || null,
      updatedAt: c.updatedAt,
    })),
    meta: { page, limit, total },
  };
}

export async function createConversation(userId: string, title?: string) {
  return prisma.conversation.create({ data: { userId, title } });
}

export async function sendMessage(data: { conversationId: string; userId: string; content: string; documentId?: string }) {
  // $transaction: either every step below succeeds, or NONE of them do.
  // If usage logging fails, you don't want a message that exists with
  // no record of the tokens it cost — this guarantees that never happens.
  return prisma.$transaction(async (tx) => {
    const conversation = await tx.conversation.findUnique({
      where: { id: data.conversationId, userId: data.userId },
    });
    if (!conversation) throw new NotFoundError('Conversation not found');

    const userMessage = await tx.message.create({
      data: { conversationId: data.conversationId, documentId: data.documentId, role: 'user', content: data.content },
    });

    await tx.conversation.update({ where: { id: data.conversationId }, data: { updatedAt: new Date() } });

    // Week 4 replaces this with a real RAG pipeline call
    const assistantMessage = await tx.message.create({
      data: {
        conversationId: data.conversationId,
        documentId: data.documentId,
        role: 'assistant',
        content: 'AI response placeholder (Week 4)',
      },
    });

    await tx.usageLog.create({
      data: { userId: data.userId, action: 'chat', tokens: 0, costUsd: 0 },
    });

    return { userMessage, assistantMessage };
  });
}