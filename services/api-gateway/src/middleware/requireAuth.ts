import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface TokenPayload {
  userId: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      userId: string;
      userEmail: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as TokenPayload;
    req.userId = payload.userId;
    req.userEmail = payload.email;
    // Forward user info to downstream services via headers
    req.headers['x-user-id'] = payload.userId;
    req.headers['x-user-email'] = payload.email;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired access token' });
  }
}
