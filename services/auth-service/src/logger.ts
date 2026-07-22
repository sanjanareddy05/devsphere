import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function write(level: LogLevel, message: string, context: Record<string, unknown> = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    service: 'auth-service',
    message,
    ...context,
  };
  console.log(JSON.stringify(payload));
}

export const logger = {
  info: (m: string, c?: Record<string, unknown>) => write('info', m, c),
  warn: (m: string, c?: Record<string, unknown>) => write('warn', m, c),
  error: (m: string, c?: Record<string, unknown>) => write('error', m, c),
  debug: (m: string, c?: Record<string, unknown>) => write('debug', m, c),
};

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const correlationId = (req.headers['x-correlation-id'] as string | undefined) || crypto.randomUUID();
  (req as any).correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  const start = Date.now();
  logger.info('request_started', { method: req.method, path: req.originalUrl, correlationId });
  res.on('finish', () => {
    logger.info('request_completed', { method: req.method, path: req.originalUrl, status: res.statusCode, durationMs: Date.now() - start, correlationId });
  });
  next();
}
