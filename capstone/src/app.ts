import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './lib/config';
import { logger } from './lib/logger';
import { errorHandler } from './middleware/error-handler';

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
// app.use('/api/v1/documents', documentRoutes);
// app.use('/api/v1/chat', chatRoutes);
// === ERROR HANDLER (must be last middleware) ===
app.use(errorHandler);
export { app };