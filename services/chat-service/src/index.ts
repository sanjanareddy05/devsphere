import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { connectMongo } from './db';
import { registerSocketHandlers } from './socketHandlers';
import messagesRouter from './routes/messages';

const app = express();
const server = http.createServer(app);
const PORT = parseInt(process.env.PORT || '3002', 10);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'chat-service', ts: new Date().toISOString() });
});

app.use(messagesRouter);

async function start() {
  await connectMongo();
  registerSocketHandlers(io);

  server.listen(PORT, () => {
    console.log(`[chat-service] Running on http://localhost:${PORT}`);
    console.log(`[chat-service] WebSocket ready`);
  });
}

start().catch((err) => {
  console.error('[chat-service] Failed to start:', err);
  process.exit(1);
});
