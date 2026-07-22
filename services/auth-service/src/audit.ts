import crypto from 'crypto';
import { pool } from './db';

export type AuditEvent = {
  action: string;
  userId?: string;
  workspaceId?: string;
  target?: string;
  metadata?: Record<string, unknown>;
};

export async function logAuditEvent(event: AuditEvent) {
  const payload = {
    timestamp: new Date().toISOString(),
    eventId: crypto.randomUUID(),
    service: 'auth-service',
    ...event,
  };

  try {
    await pool.query(
      'INSERT INTO audit_logs (event_id, action, user_id, workspace_id, target, metadata) VALUES ($1, $2, $3, $4, $5, $6)',
      [payload.eventId, payload.action, payload.userId ?? null, payload.workspaceId ?? null, payload.target ?? null, JSON.stringify(payload.metadata ?? {})]
    );
  } catch (err) {
    console.warn('[audit] failed to persist event', err);
  }

  console.log(JSON.stringify(payload));
}
