import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { query, queryOne } from '../db';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  getRefreshExpiry,
} from '../tokens';
import { registerSchema, loginSchema } from '../schemas';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();
const SALT_ROUNDS = 10;

interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  avatar_url: string | null;
  created_at: string;
}

function setCookieAndRespond(
  res: Response,
  accessToken: string,
  refreshToken: string
) {
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path: '/auth/refresh',
  });
  return accessToken;
}

// POST /auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { email, password, name } = parsed.data;

  try {
    const existing = await queryOne<User>('SELECT id FROM users WHERE email = $1', [email]);
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const [user] = await query<User>(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, avatar_url, created_at',
      [email, password_hash, name]
    );

    // Issue tokens
    const accessToken = signAccessToken({ userId: user.id, email: user.email });
    const refreshToken = signRefreshToken({ userId: user.id, email: user.email });

    // Store hashed refresh token
    await query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, hashToken(refreshToken), getRefreshExpiry()]
    );

    setCookieAndRespond(res, accessToken, refreshToken);
    res.status(201).json({ user: { id: user.id, email: user.email, name: user.name }, accessToken });
  } catch (err) {
    console.error('[register]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { email, password } = parsed.data;

  try {
    const user = await queryOne<User>('SELECT * FROM users WHERE email = $1', [email]);
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const accessToken = signAccessToken({ userId: user.id, email: user.email });
    const refreshToken = signRefreshToken({ userId: user.id, email: user.email });

    await query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, hashToken(refreshToken), getRefreshExpiry()]
    );

    setCookieAndRespond(res, accessToken, refreshToken);
    res.status(200).json({
      user: { id: user.id, email: user.email, name: user.name, avatar_url: user.avatar_url },
      accessToken,
    });
  } catch (err) {
    console.error('[login]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/refresh
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const token = req.cookies?.refresh_token;
  if (!token) {
    res.status(401).json({ error: 'No refresh token' });
    return;
  }

  try {
    const payload = verifyRefreshToken(token);
    const stored = await queryOne<{ id: string; revoked: boolean }>(
      'SELECT id, revoked FROM refresh_tokens WHERE user_id = $1 AND token_hash = $2 AND expires_at > now()',
      [payload.userId, hashToken(token)]
    );

    if (!stored || stored.revoked) {
      res.status(401).json({ error: 'Refresh token invalid or expired' });
      return;
    }

    // Rotate: revoke old, issue new
    await query('UPDATE refresh_tokens SET revoked = true WHERE id = $1', [stored.id]);

    const newAccess = signAccessToken({ userId: payload.userId, email: payload.email });
    const newRefresh = signRefreshToken({ userId: payload.userId, email: payload.email });

    await query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [payload.userId, hashToken(newRefresh), getRefreshExpiry()]
    );

    setCookieAndRespond(res, newAccess, newRefresh);
    res.status(200).json({ accessToken: newAccess });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// POST /auth/logout
router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  const token = req.cookies?.refresh_token;
  if (token) {
    try {
      const payload = verifyRefreshToken(token);
      await query(
        'UPDATE refresh_tokens SET revoked = true WHERE user_id = $1 AND token_hash = $2',
        [payload.userId, hashToken(token)]
      );
    } catch {
      // Token already invalid — still clear cookie
    }
  }

  res.clearCookie('refresh_token', { path: '/auth/refresh' });
  res.status(200).json({ message: 'Logged out successfully' });
});

// GET /auth/me
router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await queryOne<User>(
      'SELECT id, email, name, avatar_url, created_at FROM users WHERE id = $1',
      [req.userId]
    );
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.status(200).json({ user });
  } catch (err) {
    console.error('[me]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
