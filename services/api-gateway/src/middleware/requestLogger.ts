import type { NextFunction, Request, Response } from 'express';
import { logger } from '../logger';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  logger.info('request_received', { method: req.method, path: req.originalUrl });
  next();
}
