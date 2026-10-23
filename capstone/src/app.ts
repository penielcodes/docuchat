import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './lib/config';
import { logger } from './lib/logger';
import { errorHandler } from './middleware/error-handler';
import { sanitizeInput } from './middleware/sanitize';
import { requestLogger } from './middleware/requestLogger';
import { metricsMiddleware } from './middleware/metricsMiddleware';
import { authenticate } from './middleware/authenticate';
import { authLimiter, apiLimiter } from './middleware/rateLimiter';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { metricsRegistry } from './lib/metrics';

import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import documentRoutes from './routes/document.routes';
import webhookRoutes from './routes/webhook.routes';
import healthRoutes from './routes/health.routes';

import './queues/document.worker';
import './events/document.events';
import './events/admin.events';
import './events/cache.events';
import './events/security.events';

const app = express();

// === Security headers (first — applies to every response) ===
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      scriptSrc: ["'none'"],
      styleSrc: ["'none'"],
      imgSrc: ["'none'"],
      connectSrc: ["'self'"],
    },
  },
}));

// Relaxed CSP just for Swagger UI, which needs inline scripts/styles
app.use('/api-docs', helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
    },
  },
}));

// === CORS ===
const allowedOrigins = [config.FRONTEND_URL || 'http://localhost:3001'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // server-to-server / curl / mobile apps
    if (allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

// === Webhook raw-body capture — MUST be before express.json() ===
app.use('/webhooks', express.raw({
  type: 'application/json',
  verify: (req: any, res, buf) => { req.rawBody = buf; },
}));

app.use(express.json());
app.use(sanitizeInput); // after JSON parsing, before anything reads req.body
app.use(requestLogger);
app.use(metricsMiddleware);

// === Health & metrics (no auth, no rate limit — infra needs these open) ===
app.use(healthRoutes);
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', metricsRegistry.contentType);
  res.send(await metricsRegistry.metrics());
});

// === App health check from Day 1 (kept for compatibility) ===
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), environment: config.NODE_ENV });
});

// === Swagger docs ===
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

// === Routes (rate limiters applied per-group) ===
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1', apiLimiter); // general limiter for everything under /api/v1
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/documents', documentRoutes);
app.use('/webhooks', webhookRoutes);

// === Throwaway test route from Week 1 (kept — your tests depend on it) ===
app.get('/api/protected-test', authenticate, (req, res) => {
  res.json({ message: 'You are authenticated', user: req.user });
});

// === 404 handler ===
app.use((req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Route ${req.path} not found` } });
});

// === Global error handler (MUST be last) ===
app.use(errorHandler);

export { app };