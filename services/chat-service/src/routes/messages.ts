import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { getMessages } from '../db';

const router = Router();

// Auth middleware (inline for chat service)
function requireAuth(req: Request, res: Response, next: () => void): void {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as { userId: string };
    (req as Request & { userId: string }).userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * GET /channels/:channelId/messages
 * Cursor-based pagination — returns messages older than `cursor` (a message _id).
 * Better than offset: stays consistent when new messages arrive.
 */
router.get('/channels/:channelId/messages', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { channelId } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);
  const cursor = req.query.cursor as string | undefined;

  try {
    const filter: Record<string, unknown> = { channelId };

    if (cursor) {
      try {
        filter._id = { $lt: new ObjectId(cursor) };
      } catch {
        res.status(400).json({ error: 'Invalid cursor' });
        return;
      }
    }

    const messages = await getMessages()
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    // Return in chronological order (oldest first)
    messages.reverse();

    const nextCursor = messages.length === limit ? messages[0]._id?.toString() : null;

    res.json({ messages, nextCursor, hasMore: messages.length === limit });
  } catch (err) {
    console.error('[messages:history]', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

export default router;
