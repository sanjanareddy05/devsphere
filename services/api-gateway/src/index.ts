import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Pool } from 'pg';
import { createClient } from 'redis';
import { rateLimit } from 'express-rate-limit';
import { workspaceRouter } from './routes/workspaces';
import { requestLoggerMiddleware } from './logger';
import { requestLogger } from './middleware/requestLogger';
import { notFoundHandler, errorHandler } from './middleware/errorHandling';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// PostgreSQL
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Redis (for rate limiting; gracefully degrades if not connected)
let redisClient: ReturnType<typeof createClient> | null = null;
(async () => {
  try {
    redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
    redisClient.on('error', (err) => console.warn('[redis] connection error:', err.message));
    await redisClient.connect();
    console.log('[api-gateway] Redis connected ✓');
  } catch {
    console.warn('[api-gateway] Redis unavailable — rate limiting will use memory store');
  }
})();

// Security middleware
app.use(helmet());
app.use(requestLoggerMiddleware);
app.use(requestLogger);
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10kb' }));

// Rate limiting: 100 req/min per IP
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
}));

// Health
app.get('/health', async (_req, res) => {
  const checks: Record<string, string> = { api: 'ok' };
  try {
    await pool.query('SELECT 1');
    checks.postgres = 'ok';
  } catch {
    checks.postgres = 'error';
  }
  try {
    await redisClient?.ping();
    checks.redis = 'ok';
  } catch {
    checks.redis = 'unavailable';
  }
  res.json({ status: 'ok', service: 'api-gateway', checks, ts: new Date().toISOString() });
});

// Routes
app.use('/workspaces', workspaceRouter(pool));

// 404
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

async function start() {
  await pool.query('SELECT 1');
  console.log('[api-gateway] PostgreSQL connected ✓');
  app.listen(PORT, () => {
    console.log(`[api-gateway] Running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('[api-gateway] Failed to start:', err);
  process.exit(1);
});
