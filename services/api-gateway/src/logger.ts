import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

type LogContext = Record<string, unknown>;

function serialize(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function write(level: LogLevel, message: string, context: LogContext = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    service: 'api-gateway',
    message,
    ...context,
  };
  console.log(serialize(payload));
}

export const logger = {
  info: (message: string, context?: LogContext) => write('info', message, context),
  warn: (message: string, context?: LogContext) => write('warn', message, context),
  error: (message: string, context?: LogContext) => write('error', message, context),
  debug: (message: string, context?: LogContext) => write('debug', message, context),
};

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction) {
  const correlationId = (req.headers['x-correlation-id'] as string | undefined) || crypto.randomUUID();
  const requestWithCorrelation = req as Request & { correlationId?: string };
  requestWithCorrelation.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);

  const startedAt = Date.now();
  logger.info('request_started', {
    method: req.method,
    path: req.originalUrl,
    correlationId,
  });

  res.on('finish', () => {
    logger.info('request_completed', {
      method: req.method,
      path: req.originalUrl,
      correlationId,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });

  next();
}
