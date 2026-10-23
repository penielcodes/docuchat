import { Router } from 'express';
import { verifyWebhookSignature } from '../middleware/verifyWebhook';
import { prisma } from '../lib/prisma';

const router = Router();

router.post(
  '/example',
  verifyWebhookSignature(process.env.WEBHOOK_SECRET || 'placeholder-secret', 'X-Webhook-Signature'),
  async (req, res) => {
    const event = JSON.parse((req as any).rawBody.toString());

    // Idempotency: if we've already fully processed this exact event ID,
    // acknowledge without doing the work again.
    const existing = await prisma.webhookEvent.findUnique({ where: { id: event.id } });
    if (existing?.processedAt) {
      return res.status(200).json({ received: true, duplicate: true });
    }

    await prisma.webhookEvent.upsert({
      where: { id: event.id },
      update: {},
      create: { id: event.id, provider: 'example', eventType: event.type, payload: JSON.stringify(event) },
    });

    // Acknowledge FAST — providers expect a quick response and will
    // assume failure (and retry) if you take too long.
    res.status(202).json({ received: true });

    try {
      console.log(`Processing webhook event: ${event.type}`);
      await prisma.webhookEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } });
    } catch (error) {
      console.error(`Webhook ${event.id} processing failed:`, error);
      // Don't set processedAt — the provider's retry will try again.
    }
  }
);

export default router;