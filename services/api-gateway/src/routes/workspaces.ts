import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth';

export function workspaceRouter(pool: Pool) {
  const router = Router();

  // All workspace routes require auth
  router.use(requireAuth);

  const createWorkspaceSchema = z.object({
    name: z.string().min(2).max(80),
  });

  const createChannelSchema = z.object({
    name: z.string().min(1).max(80).regex(/^[a-z0-9-_]+$/, 'Channel name must be lowercase letters, numbers, hyphens, or underscores'),
    description: z.string().max(200).optional(),
    is_private: z.boolean().optional().default(false),
  });

  const inviteSchema = z.object({
    email: z.string().email(),
    role: z.enum(['admin', 'member']).optional().default('member'),
  });

  // POST /workspaces — create a new workspace
  router.post('/', async (req: Request, res: Response): Promise<void> => {
    const parsed = createWorkspaceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create workspace + owner membership in a single transaction
      const { rows: [workspace] } = await client.query(
        `INSERT INTO workspaces (name, owner_id) VALUES ($1, $2)
         RETURNING id, name, owner_id, created_at`,
        [parsed.data.name, req.userId]
      );

      const workspaceWithRole = { ...workspace, role: 'admin' as const };

      await client.query(
        `INSERT INTO memberships (user_id, workspace_id, role) VALUES ($1, $2, 'admin')`,
        [req.userId, workspace.id]
      );

      // Create a default #general channel
      const { rows: [generalChannel] } = await client.query(
        `INSERT INTO channels (workspace_id, name, description) VALUES ($1, $2, $3)
         RETURNING id, name, description, is_private, created_at`,
        [workspace.id, 'general', 'General discussion']
      );

      await client.query('COMMIT');

      res.status(201).json({ workspace: workspaceWithRole, channels: [generalChannel] });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[workspace:create]', err);
      res.status(500).json({ error: 'Failed to create workspace' });
    } finally {
      client.release();
    }
  });

  // GET /workspaces — list workspaces I'm a member of
  router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows } = await pool.query(
        `SELECT w.id, w.name, w.owner_id, w.created_at, m.role
         FROM workspaces w
         JOIN memberships m ON m.workspace_id = w.id
         WHERE m.user_id = $1
         ORDER BY w.created_at ASC`,
        [req.userId]
      );
      res.json({ workspaces: rows });
    } catch (err) {
      console.error('[workspace:list]', err);
      res.status(500).json({ error: 'Failed to fetch workspaces' });
    }
  });

  // GET /workspaces/:id — workspace detail with member count
  router.get('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows: [membership] } = await pool.query(
        `SELECT m.role FROM memberships m WHERE m.user_id = $1 AND m.workspace_id = $2`,
        [req.userId, req.params.id]
      );
      if (!membership) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const { rows: [workspace] } = await pool.query(
        `SELECT w.*, COUNT(m.id)::int as member_count
         FROM workspaces w
         JOIN memberships m ON m.workspace_id = w.id
         WHERE w.id = $1
         GROUP BY w.id`,
        [req.params.id]
      );
      res.json({ workspace: { ...workspace, role: membership.role } });
    } catch (err) {
      console.error('[workspace:get]', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /workspaces/:id/invite — invite a user (admin only)
  router.post('/:id/invite', async (req: Request, res: Response): Promise<void> => {
    const parsed = inviteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    try {
      // Check requester is admin
      const { rows: [requesterMembership] } = await pool.query(
        `SELECT role FROM memberships WHERE user_id = $1 AND workspace_id = $2`,
        [req.userId, req.params.id]
      );
      if (!requesterMembership || requesterMembership.role !== 'admin') {
        res.status(403).json({ error: 'Only workspace admins can invite members' });
        return;
      }

      // Look up invitee by email
      const { rows: [invitee] } = await pool.query(
        `SELECT id, email, name FROM users WHERE email = $1`,
        [parsed.data.email]
      );
      if (!invitee) {
        res.status(404).json({ error: 'User not found with that email' });
        return;
      }

      // Add membership (upsert to handle re-invites gracefully)
      await pool.query(
        `INSERT INTO memberships (user_id, workspace_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, workspace_id) DO UPDATE SET role = EXCLUDED.role`,
        [invitee.id, req.params.id, parsed.data.role]
      );

      res.status(200).json({ message: 'Member added', user: { id: invitee.id, email: invitee.email, name: invitee.name } });
    } catch (err) {
      console.error('[workspace:invite]', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /workspaces/:id/members — list members
  router.get('/:id/members', async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows: [membership] } = await pool.query(
        `SELECT role FROM memberships WHERE user_id = $1 AND workspace_id = $2`,
        [req.userId, req.params.id]
      );
      if (!membership) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const { rows } = await pool.query(
        `SELECT u.id, u.name, u.email, u.avatar_url, m.role, m.joined_at
         FROM memberships m
         JOIN users u ON u.id = m.user_id
         WHERE m.workspace_id = $1
         ORDER BY m.joined_at ASC`,
        [req.params.id]
      );
      res.json({ members: rows });
    } catch (err) {
      console.error('[workspace:members]', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /workspaces/:id/channels — create a channel
  router.post('/:id/channels', async (req: Request, res: Response): Promise<void> => {
    const parsed = createChannelSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    try {
      const { rows: [membership] } = await pool.query(
        `SELECT role FROM memberships WHERE user_id = $1 AND workspace_id = $2`,
        [req.userId, req.params.id]
      );
      if (!membership) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
      if (membership.role !== 'admin' && parsed.data.is_private) {
        res.status(403).json({ error: 'Only admins can create private channels' });
        return;
      }

      const { rows: [channel] } = await pool.query(
        `INSERT INTO channels (workspace_id, name, description, is_private)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, description, is_private, created_at`,
        [req.params.id, parsed.data.name, parsed.data.description ?? null, parsed.data.is_private]
      );
      res.status(201).json({ channel });
    } catch (err: unknown) {
      const pg = err as { code?: string };
      if (pg.code === '23505') {
        res.status(409).json({ error: 'A channel with this name already exists' });
        return;
      }
      console.error('[channel:create]', err);
      res.status(500).json({ error: 'Failed to create channel' });
    }
  });

  // GET /workspaces/:id/channels — list channels
  router.get('/:id/channels', async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows: [membership] } = await pool.query(
        `SELECT role FROM memberships WHERE user_id = $1 AND workspace_id = $2`,
        [req.userId, req.params.id]
      );
      if (!membership) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const { rows } = await pool.query(
        `SELECT id, name, description, is_private, created_at
         FROM channels WHERE workspace_id = $1
         ORDER BY created_at ASC`,
        [req.params.id]
      );
      res.json({ channels: rows });
    } catch (err) {
      console.error('[channel:list]', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
