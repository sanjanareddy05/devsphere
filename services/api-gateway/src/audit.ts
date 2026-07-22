import crypto from 'crypto';

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
    service: 'api-gateway',
    ...event,
  };

  // Try to forward to auth-service audit endpoint if configured
  const authUrl = process.env.AUTH_SERVICE_URL || process.env.AUTH_URL || 'http://localhost:3001';
  try {
    if (typeof fetch !== 'undefined') {
      await fetch(`${authUrl}/audit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(event),
      } as any);
    }
  } catch (err) {
    // best-effort
    console.warn('[audit] forward failed', err);
  }

  console.log(JSON.stringify(payload));
}
