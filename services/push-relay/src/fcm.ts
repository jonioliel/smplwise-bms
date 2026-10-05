/**
 * FCM HTTP v1 with an OAuth2 access token minted from the Firebase service account (RS256 JWT → token endpoint), cached
 * for 50 minutes. A DATA message only (no `notification` block): the app's messaging service fetches the real text from
 * the originating Arx server and shows it; the generic fields are there for the fallback.
 */
import { pemToDer, signJwt } from './crypto';

export interface FcmConfig { projectId: string; clientEmail: string; privateKey: string }
export interface PushMessage { notificationId: string; category: string; priority: 'high' | 'normal'; server: string; collapse?: string }
export interface SendResult { status: number; reason?: string; retryAfter?: number }

let cached: { token: string; at: number; email: string } | null = null;

export function parseServiceAccount(json: string): FcmConfig {
  const sa = JSON.parse(json) as { project_id: string; client_email: string; private_key: string };
  if (!sa.project_id || !sa.client_email || !sa.private_key) throw new Error('service account: project_id, client_email, private_key required');
  return { projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key };
}

async function accessToken(cfg: FcmConfig, fetcher: typeof fetch): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.email === cfg.clientEmail && now - cached.at < 50 * 60) return cached.token;
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(cfg.privateKey), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const assertion = await signJwt(
    { alg: 'RS256', typ: 'JWT' },
    { iss: cfg.clientEmail, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 },
    key,
    'RS256',
  );
  const res = await fetcher('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
  });
  if (!res.ok) throw new Error(`fcm token: http ${res.status}`);
  const data = (await res.json()) as { access_token: string };
  cached = { token: data.access_token, at: now, email: cfg.clientEmail };
  return data.access_token;
}

/** The generic FCM message for one push (data only). */
export function fcmMessage(token: string, m: PushMessage): Record<string, unknown> {
  return {
    message: {
      token,
      data: { notification_id: m.notificationId, category: m.category, server: m.server, title: 'SmplWise Arx', body: 'התראה חדשה' },
      android: { priority: m.priority === 'high' ? 'HIGH' : 'NORMAL', ttl: '3600s', ...(m.collapse ? { collapse_key: m.collapse.slice(0, 64) } : {}) },
    },
  };
}

export async function sendFcm(cfg: FcmConfig, token: string, m: PushMessage, fetcher: typeof fetch = fetch): Promise<SendResult> {
  const bearer = await accessToken(cfg, fetcher);
  const res = await fetcher(`https://fcm.googleapis.com/v1/projects/${cfg.projectId}/messages:send`, {
    method: 'POST',
    headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' },
    body: JSON.stringify(fcmMessage(token, m)),
  });
  if (res.ok) return { status: 200 };
  let reason = '';
  try {
    const err = (await res.json()) as { error?: { status?: string; details?: { errorCode?: string }[] } };
    reason = err.error?.details?.find((d) => d.errorCode)?.errorCode ?? err.error?.status ?? '';
  } catch {
    reason = '';
  }
  // UNREGISTERED (404) → the token is gone for good; INVALID_ARGUMENT on the token likewise
  if (res.status === 404 || reason === 'UNREGISTERED') return { status: 410, reason };
  if (res.status === 429 || res.status >= 500) return { status: res.status, reason, retryAfter: Number(res.headers.get('retry-after') ?? '') || undefined };
  return { status: res.status, reason };
}
