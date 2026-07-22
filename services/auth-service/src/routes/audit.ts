import { Router, Request, Response } from 'express';
import { logAuditEvent } from '../audit';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const { action, userId, workspaceId, target, metadata } = req.body as any;
  try {
    await logAuditEvent({ action, userId, workspaceId, target, metadata });
    res.status(202).json({ message: 'Audit recorded' });
  } catch (err) {
    console.warn('[audit:post] failed', err);
    res.status(500).json({ error: 'Failed to record audit' });
  }
});

export default router;
