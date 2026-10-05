/**
 * SmplWise push relay (CR-027 section 6; the contract is docs/api/mobile-presence-contract.md section 8).
 *
 * A small stateless Cloudflare Worker that stands between self-hosted SmplWise Arx servers and APNs / FCM, because only the
 * app publisher's keys may send to the app. It holds those keys as RUNTIME SECRETS ONLY (`wrangler secret put`; nothing in git)
 * and stores exactly one thing: `sha256(relay_token) -> {platform, push_token, bundle_id, created_at}` in Workers KV. It
 * never sees notification text: a push is `{relay_token, category, notification_id, priority, server}` and what reaches the
 * phone is a fixed generic title / body plus those ids.
 *
 * Routes:
 *   POST   /v1/register    (app)    {platform, push_token, app_version, bundle_id} -> {relay_token}; idempotent per push token
 *   DELETE /v1/register    (app)    {relay_token} -> 204
 *   POST   /v1/push        (server) Authorization: Bearer <server key>; {relay_token, category, notification_id, priority, server, collapse?}
 *   GET    /v1/health               {ok, apns, fcm}
 *
 * Abuse protection: bodies <= 2 KiB, strict shapes, per-address registration limit (60 / h), per-device push limits
 * (60 / min, 500 / day), per-server push limit (6000 / h), unknown-token counters per server (a server that keeps sending to
 * unknown tokens is slowed down), constant-time key comparison, no stack traces in answers, no logging of tokens.
 */
import { sendApns, type ApnsConfig } from './apns';
import { parseServiceAccount, sendFcm, type FcmConfig } from './fcm';
import { derivedRelayToken, newRelayToken, sha256Hex, timingSafeEqual } from './crypto';

const MAX_BODY = 2048;
const CATEGORIES = new Set(['safety', 'alerts', 'doors', 'device_faults', 'automations', 'system', 'security']);
const TOKEN_TTL_S = 180 * 24 * 3600; // a registration nobody pushed to or refreshed for 180 days expires
const LIMITS = { registerPerHour: 60, pushPerMinute: 60, pushPerDay: 500, serverPerHour: 6000, unknownPerHour: 200 } as const;
const REFRESH_AFTER_S = 24 * 3600; // a registration is rewritten (TTL refreshed) at most once a day: KV writes are the scarce free-plan resource
const DEFAULT_BUNDLES = ['com.smplwise.arx.app', 'com.smplwise.arx'];

interface Registration { platform: 'ios' | 'android'; push_token: string; bundle_id: string; created_at: string; last_push_at?: string }

type Json = Record<string, unknown>;

function json(body: Json, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
}

function error(status: number, code: string, extra: Json = {}): Response {
  return json({ code, ...extra }, status);
}

async function readJson(request: Request): Promise<Json | null> {
  const len = Number(request.headers.get('content-length') ?? '0');
  if (len > MAX_BODY) return null;
  const text = await request.text();
  if (text.length > MAX_BODY) return null;
  try {
    const v = JSON.parse(text) as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null;
  } catch {
    return null;
  }
}

/** A sliding counter in KV: `count:<kind>:<key>:<window start>`; coarse (KV is eventually consistent) but enough to bound abuse. */
async function overLimit(env: Env, kind: string, key: string, limit: number, windowS: number, ctx: ExecutionContext): Promise<boolean> {
  const slot = Math.floor(Date.now() / 1000 / windowS);
  const k = `count:${kind}:${key}:${slot}`;
  const n = Number((await env.RELAY_KV.get(k)) ?? '0');
  if (n >= limit) return true;
  ctx.waitUntil(env.RELAY_KV.put(k, String(n + 1), { expirationTtl: windowS * 2 }));
  return false;
}

function clientKey(request: Request): string {
  return request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

/** The server keys secret: `id1:secret1,id2:secret2`. Returns the server id of a matching bearer, else null. */
function serverOf(env: Env, request: Request): string | null {
  const auth = request.headers.get('authorization') ?? '';
  if (!auth.toLowerCase().startsWith('bearer ')) return null;
  const presented = auth.slice(7).trim();
  for (const entry of (env.SERVER_KEYS ?? '').split(',')) {
    const i = entry.indexOf(':');
    if (i <= 0) continue;
    const id = entry.slice(0, i).trim();
    const secret = entry.slice(i + 1).trim();
    if (secret.length >= 16 && timingSafeEqual(secret, presented)) return id;
  }
  return null;
}

function apnsConfig(env: Env): ApnsConfig | null {
  if (!env.APNS_KEY_P8 || !env.APNS_KEY_ID || !env.APNS_TEAM_ID || !env.APNS_BUNDLE_ID) return null;
  return { p8: env.APNS_KEY_P8, keyId: env.APNS_KEY_ID, teamId: env.APNS_TEAM_ID, bundleId: env.APNS_BUNDLE_ID, sandbox: (env.APNS_ENV ?? 'production') === 'sandbox' };
}

function fcmConfig(env: Env): FcmConfig | null {
  if (!env.FCM_SERVICE_ACCOUNT) return null;
  try {
    return parseServiceAccount(env.FCM_SERVICE_ACCOUNT);
  } catch {
    return null;
  }
}

const APNS_TOKEN = /^[0-9a-fA-F]{64,200}$/; // APNs device tokens are hex (32 bytes today; Apple says treat the length as variable)
const FCM_TOKEN = /^[A-Za-z0-9_\-:.]{100,400}$/;
const RELAY_TOKEN = /^rt_[A-Za-z0-9_\-]{43}$/;

async function handleRegister(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (await overLimit(env, 'reg', clientKey(request), LIMITS.registerPerHour, 3600, ctx)) return error(429, 'rate_limited');
  const body = await readJson(request);
  if (!body) return error(400, 'bad_request');
  const platform = body.platform;
  const pushToken = typeof body.push_token === 'string' ? body.push_token.trim() : '';
  const bundle = typeof body.bundle_id === 'string' ? body.bundle_id.trim() : '';
  const allowed = (env.ALLOWED_BUNDLE_IDS ?? DEFAULT_BUNDLES.join(',')).split(',').map((s) => s.trim()).filter(Boolean);
  if ((platform !== 'ios' && platform !== 'android') || !bundle || !allowed.includes(bundle)) return error(400, 'invalid_registration');
  if (platform === 'ios' ? !APNS_TOKEN.test(pushToken) : !FCM_TOKEN.test(pushToken)) return error(400, 'invalid_push_token');
  const reg: Registration = { platform, push_token: pushToken, bundle_id: bundle, created_at: new Date().toISOString() };
  // Contract: idempotent per push token (the same relay token comes back). The relay stores only the HASH of a relay token, so
  // a stable token must be derivable: HMAC(RELAY_TOKEN_SECRET, platform:push_token). Without that secret every call issues a
  // fresh token and retires the previous one (the app re-sends the new token to each Arx server).
  if (env.RELAY_TOKEN_SECRET && env.RELAY_TOKEN_SECRET.length >= 16) {
    const relayToken = await derivedRelayToken(env.RELAY_TOKEN_SECRET, `${platform}:${pushToken}`);
    const hash = await sha256Hex(relayToken);
    const existing = await env.RELAY_KV.get<Registration>(`reg:${hash}`, 'json');
    if (existing) {
      const age = (Date.now() - Date.parse(existing.last_push_at ?? existing.created_at)) / 1000;
      if (age > REFRESH_AFTER_S) ctx.waitUntil(env.RELAY_KV.put(`reg:${hash}`, JSON.stringify({ ...existing, bundle_id: bundle }), { expirationTtl: TOKEN_TTL_S }));
    } else {
      await env.RELAY_KV.put(`reg:${hash}`, JSON.stringify(reg), { expirationTtl: TOKEN_TTL_S });
    }
    return json({ relay_token: relayToken });
  }
  const byToken = `tok:${await sha256Hex(`${platform}:${pushToken}`)}`;
  const previous = await env.RELAY_KV.get(byToken);
  const relayToken = newRelayToken();
  const hash = await sha256Hex(relayToken);
  await env.RELAY_KV.put(`reg:${hash}`, JSON.stringify(reg), { expirationTtl: TOKEN_TTL_S });
  await env.RELAY_KV.put(byToken, hash, { expirationTtl: TOKEN_TTL_S });
  if (previous && previous !== hash) ctx.waitUntil(env.RELAY_KV.delete(`reg:${previous}`));
  return json({ relay_token: relayToken });
}

async function handleUnregister(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  const relayToken = body && typeof body.relay_token === 'string' ? body.relay_token : '';
  if (!RELAY_TOKEN.test(relayToken)) return error(400, 'bad_request');
  const hash = await sha256Hex(relayToken);
  const reg = await env.RELAY_KV.get<Registration>(`reg:${hash}`, 'json');
  if (reg) {
    await env.RELAY_KV.delete(`reg:${hash}`);
    await env.RELAY_KV.delete(`tok:${await sha256Hex(`${reg.platform}:${reg.push_token}`)}`);
  }
  return new Response(null, { status: 204 });
}

async function handlePush(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const server = serverOf(env, request);
  if (!server) return error(401, 'unauthorized');
  if (await overLimit(env, 'srv', server, LIMITS.serverPerHour, 3600, ctx)) return error(429, 'rate_limited');
  const body = await readJson(request);
  if (!body) return error(400, 'bad_request');
  const relayToken = typeof body.relay_token === 'string' ? body.relay_token : '';
  const category = typeof body.category === 'string' ? body.category : '';
  const notificationId = typeof body.notification_id === 'string' ? body.notification_id.slice(0, 64) : '';
  const priority = body.priority === 'high' ? 'high' : 'normal';
  const collapse = typeof body.collapse === 'string' ? body.collapse.slice(0, 64) : undefined;
  if (!RELAY_TOKEN.test(relayToken) || !CATEGORIES.has(category) || !/^[A-Za-z0-9_\-]{4,64}$/.test(notificationId)) return error(400, 'bad_request');
  const hash = await sha256Hex(relayToken);
  const reg = await env.RELAY_KV.get<Registration>(`reg:${hash}`, 'json');
  if (!reg) {
    if (await overLimit(env, 'unk', server, LIMITS.unknownPerHour, 3600, ctx)) return error(429, 'rate_limited');
    return error(404, 'relay_token_unknown');
  }
  if ((await overLimit(env, 'dev-m', hash, LIMITS.pushPerMinute, 60, ctx)) || (await overLimit(env, 'dev-d', hash, LIMITS.pushPerDay, 86400, ctx))) return error(429, 'rate_limited');
  // the payload's `server` is the installation's own opaque id (contract 0.1: the app finds its origin by it); the key's id is the fallback
  const claimed = typeof body.server === 'string' && /^[A-Za-z0-9_\-]{1,64}$/.test(body.server) ? body.server : server.slice(0, 64);
  const message = { notificationId, category, priority, server: claimed, collapse } as const;
  let result: { status: number; reason?: string; retryAfter?: number };
  try {
    if (reg.platform === 'ios') {
      const cfg = apnsConfig(env);
      if (!cfg) return error(503, 'apns_unconfigured');
      result = await sendApns(cfg, reg.push_token, message);
    } else {
      const cfg = fcmConfig(env);
      if (!cfg) return error(503, 'fcm_unconfigured');
      result = await sendFcm(cfg, reg.push_token, message);
    }
  } catch {
    return error(502, 'upstream_error');
  }
  if (result.status === 200) {
    if (!reg.last_push_at || Date.now() - Date.parse(reg.last_push_at) > REFRESH_AFTER_S * 1000) {
      reg.last_push_at = new Date().toISOString();
      ctx.waitUntil(env.RELAY_KV.put(`reg:${hash}`, JSON.stringify(reg), { expirationTtl: TOKEN_TTL_S }));
    }
    return json({ ok: true });
  }
  if (result.status === 410) {
    ctx.waitUntil(env.RELAY_KV.delete(`reg:${hash}`));
    ctx.waitUntil(env.RELAY_KV.delete(`tok:${await sha256Hex(`${reg.platform}:${reg.push_token}`)}`));
    return error(410, 'push_token_gone');
  }
  if (result.status === 429 || result.status >= 500) return error(503, 'upstream_busy', result.retryAfter ? { retry_after_s: result.retryAfter } : {});
  return error(502, 'upstream_refused', { upstream_status: result.status });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/v1/health' && request.method === 'GET') return json({ ok: true, apns: !!apnsConfig(env), fcm: !!fcmConfig(env), stable_tokens: !!env.RELAY_TOKEN_SECRET && env.RELAY_TOKEN_SECRET.length >= 16, server_keys: (env.SERVER_KEYS ?? '').split(',').filter((e) => e.indexOf(':') > 0).length });
      if (url.pathname === '/v1/register' && request.method === 'POST') return await handleRegister(request, env, ctx);
      if (url.pathname === '/v1/register' && request.method === 'DELETE') return await handleUnregister(request, env);
      if (url.pathname === '/v1/push' && request.method === 'POST') return await handlePush(request, env, ctx);
      return error(404, 'not_found');
    } catch {
      return error(500, 'internal'); // never a stack trace, never a token
    }
  },
};
