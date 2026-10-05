/**
 * APNs (Apple Push Notification service) over HTTP/2 with a provider token (ES256 JWT from the .p8 auth key).
 * The token is cached for 50 minutes (Apple accepts up to an hour and asks for no more than one per 20 minutes).
 * The payload is GENERIC: a fixed title / body, `mutable-content: 1` so the app's Notification Service Extension fetches
 * the real text from the originating Arx server, the message id and category in the custom data, the server id as the
 * thread. Nothing else travels through Apple.
 */
import { pemToDer, signJwt } from './crypto';

export interface ApnsConfig { p8: string; keyId: string; teamId: string; bundleId: string; sandbox: boolean }
export interface PushMessage { notificationId: string; category: string; priority: 'high' | 'normal'; server: string; collapse?: string }
export interface SendResult { status: number; reason?: string; retryAfter?: number }

let cached: { token: string; at: number; keyId: string } | null = null;

async function providerToken(cfg: ApnsConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.keyId === cfg.keyId && now - cached.at < 50 * 60) return cached.token;
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(cfg.p8), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const token = await signJwt({ alg: 'ES256', kid: cfg.keyId }, { iss: cfg.teamId, iat: now }, key, 'ES256');
  cached = { token, at: now, keyId: cfg.keyId };
  return token;
}

export function apnsHost(sandbox: boolean): string {
  return sandbox ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com';
}

/** The generic APNs payload for one message. */
export function apnsPayload(m: PushMessage): Record<string, unknown> {
  return {
    aps: {
      alert: { title: 'SmplWise Arx', body: 'התראה חדשה' },
      sound: 'default',
      'mutable-content': 1,
      'thread-id': m.server,
      ...(m.priority === 'high' ? { 'interruption-level': 'time-sensitive' } : {}),
    },
    notification_id: m.notificationId,
    category: m.category,
    server: m.server,
  };
}

export function resetApnsTokenCache(): void {
  cached = null;
}

export async function sendApns(cfg: ApnsConfig, deviceToken: string, m: PushMessage, fetcher: typeof fetch = fetch, retried = false): Promise<SendResult> {
  const headers: Record<string, string> = {
    authorization: `bearer ${await providerToken(cfg)}`,
    'apns-topic': cfg.bundleId,
    'apns-push-type': 'alert',
    'apns-priority': m.priority === 'high' ? '10' : '5',
    'apns-expiration': String(Math.floor(Date.now() / 1000) + 3600),
    'content-type': 'application/json',
  };
  if (m.collapse) headers['apns-collapse-id'] = m.collapse.slice(0, 64);
  const res = await fetcher(`${apnsHost(cfg.sandbox)}/3/device/${deviceToken}`, { method: 'POST', headers, body: JSON.stringify(apnsPayload(m)) });
  if (res.ok) return { status: 200 };
  let reason = '';
  try {
    reason = ((await res.json()) as { reason?: string }).reason ?? '';
  } catch {
    reason = '';
  }
  // an expired / rejected provider token (clock skew, key rotated): mint a fresh one and try once more
  if (!retried && res.status === 403 && (reason === 'ExpiredProviderToken' || reason === 'InvalidProviderToken')) {
    cached = null;
    return sendApns(cfg, deviceToken, m, fetcher, true);
  }
  // Apple: 410 Unregistered / 400 BadDeviceToken → the token is gone for good
  if (res.status === 410 || reason === 'BadDeviceToken' || reason === 'Unregistered' || reason === 'DeviceTokenNotForTopic') return { status: 410, reason };
  if (res.status === 429 || res.status >= 500) return { status: res.status, reason, retryAfter: Number(res.headers.get('retry-after') ?? '') || undefined };
  return { status: res.status, reason };
}
