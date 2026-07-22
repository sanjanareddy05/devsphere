import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRouter from './routes/auth';
import { pool } from './db';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'auth-service', ts: new Date().toISOString() });
});

// Routes
app.use('/auth', authRouter);

// Start
async function start() {
  try {
    // Verify DB connection
    await pool.query('SELECT 1');
    console.log('[auth-service] PostgreSQL connected ✓');

    app.listen(PORT, () => {
      console.log(`[auth-service] Running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('[auth-service] Failed to connect to database:', err);
    process.exit(1);
  }
}

start();
