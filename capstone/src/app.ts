import authRoutes from './routes/auth.routes';
import './events/auth.events'; // registers the listeners
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './lib/config';
import { logger } from './lib/logger';
import { errorHandler } from './middleware/error-handler';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';

const app = express();

// === MIDDLEWARE ===
app.use(helmet()); // Security headers
app.use(cors()); // Cross-origin requests
app.use(express.json()); // Parse JSON request bodies

// === REQUEST LOGGING ===
app.use((req, res, next) => {
logger.info({
method: req.method,
url: req.url,
ip: req.ip,
});
next();
});

// === HEALTH CHECK ===
app.get('/health', (req, res) => {
res.json({
status: 'ok',
timestamp: new Date().toISOString(),
environment: config.NODE_ENV,
});
});
// === ROUTES (mounted here as you build them) ===
// app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (req, res) => {
  res.json(swaggerSpec);
});
// app.use('/api/v1/documents', documentRoutes);
// app.use('/api/v1/chat', chatRoutes);
import { authenticate } from './middleware/authenticate';

// Throwaway route used only to verify the authenticate middleware works.
// Not a real DocuChat endpoint — safe to delete once you build real
// protected routes (documents, conversations) in later weeks.
app.get('/api/protected-test', authenticate, (req, res) => {
  res.json({ message: 'You are authenticated', user: req.user });
});
// === ERROR HANDLER (must be last middleware) ===
// Catches any request that didn't match a route above this point
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.path} not found` },
  });
});
app.use(errorHandler);
export { app };