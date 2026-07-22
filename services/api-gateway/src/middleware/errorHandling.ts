import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { logger } from '../logger';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: 'Not found' });
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next: NextFunction) => {
  logger.error('request_error', { message: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
};
