/**
 * SmplWise fleet receiver (CR-FLEET215) - a small Cloudflare Worker that receives the daily signed health report of each ENROLLED Arx
 * installation and shows SmplWise a fleet overview (green / amber / red / silent, old version, readiness).
 *
 * Routes
 *   POST   /v1/report                    an installation's report (no bearer secret: the Ed25519 signature of an enrolled key IS the auth)
 *   GET    /v1/health                    liveness, no data
 *   GET    /v1/admin/installations       the fleet overview                     (Authorization: Bearer ADMIN_TOKEN)
 *   POST   /v1/admin/installations       enroll `{code, label}` (or `replace_key`) (Authorization: Bearer ADMIN_TOKEN)
 *   GET    /v1/admin/installations/:id   one installation: enrollment + the last report
 *   DELETE /v1/admin/installations/:id   forget an installation (its history expires on its own)
 *
 * The report check, in this order (each failure is a closed error code, never an echo of the input):
 *   size <= MAX_BODY -> JSON -> installation id format -> enrolled? (401 unknown_installation) -> key id enrolled and not retired
 *   (401 unknown_key / key_retired) -> Ed25519 over CONTEXT + the raw body (401 bad_signature) -> the closed schema (422 schema_invalid)
 *   -> time window (422 stale / from_future) -> sequence strictly greater than the last accepted (409 replayed) -> stored (202).
 *
 * Storage (Workers KV, binding FLEET_KV):  inst:<id> enrollment  |  last:<id> the last accepted report  |  hist:<id>:<YYYY-MM-DD> one per day
 * (expires after HISTORY_TTL_S). The customer label lives here only - the installation never sends a name.
 */
import { CONTEXT, parseEnrollment, timingSafeEqual, verifyReport } from './crypto';
import { SchemaError, validateReport } from './schema';

export interface KV {
  get(key: string, type?: 'json' | 'text' | { type: string }): Promise<any>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options: { prefix: string; cursor?: string; limit?: number }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
}

export interface Env {
  FLEET_KV: KV;
  ADMIN_TOKEN?: string;
  LATEST_ADDON_VERSION?: string;
}

export const MAX_BODY = 16 * 1024;
export const MAX_AGE_S = 36 * 3600;
export const MAX_FUTURE_S = 10 * 60;
export const SILENT_AFTER_S = 36 * 3600;
export const HISTORY_TTL_S = 400 * 24 * 3600;
const KID_RE = /^[0-9a-f]{16}$/;
const ID_RE = /^[0-9a-f]{32}$/;
const SIG_RE = /^[A-Za-z0-9+/]{86}==$/;
const LABEL_MAX = 80;

export interface EnrolledKey {
  kid: string;
  public_key: string;
  added_at: string;
  retired_at: string | null;
}
export interface Installation {
  installation_id: string;
  label: string;
  enrolled_at: string;
  keys: EnrolledKey[];
}
interface Last {
  seq: number;
  received_at: string;
  report: Record<string, any>;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}
const err = (status: number, code: string) => json(status, { error: code });
const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

async function readBody(req: Request): Promise<string | null> {
  const declared = Number(req.headers.get('content-length') || '0');
  if (declared > MAX_BODY) return null;
  const buf = new Uint8Array(await req.arrayBuffer());
  if (buf.length > MAX_BODY) return null;
  return new TextDecoder('utf-8', { fatal: false }).decode(buf);
}

export async function handleReport(req: Request, env: Env): Promise<Response> {
  const body = await readBody(req);
  if (body === null) return err(413, 'too_large');
  const kid = req.headers.get('x-arx-fleet-kid') || '';
  const sig = req.headers.get('x-arx-fleet-sig') || '';
  if (!KID_RE.test(kid) || !SIG_RE.test(sig)) return err(400, 'bad_headers');
  let report: any;
  try {
    report = JSON.parse(body);
  } catch {
    return err(400, 'not_json');
  }
  const id = report && typeof report === 'object' ? report.installation_id : undefined;
  if (typeof id !== 'string' || !ID_RE.test(id)) return err(400, 'bad_installation_id');
  const inst = (await env.FLEET_KV.get(`inst:${id}`, 'json')) as Installation | null;
  if (!inst) return err(401, 'unknown_installation');
  const key = inst.keys.find((k) => k.kid === kid);
  if (!key) return err(401, 'unknown_key');
  if (key.retired_at) return err(401, 'key_retired');
  if (!(await verifyReport(key.public_key, body, sig))) return err(401, 'bad_signature');
  try {
    validateReport(report);
  } catch (e) {
    if (e instanceof SchemaError) return json(422, { error: 'schema_invalid', path: e.path, why: e.why });
    throw e;
  }
  const at = Date.parse(report.generated_at);
  const now = Date.now();
  if (!Number.isFinite(at) || now - at > MAX_AGE_S * 1000) return err(422, 'stale');
  if (at - now > MAX_FUTURE_S * 1000) return err(422, 'from_future');
  const last = (await env.FLEET_KV.get(`last:${id}`, 'json')) as Last | null;
  if (last && report.seq <= last.seq) return err(409, 'replayed');
  const record: Last = { seq: report.seq, received_at: nowIso(), report };
  await env.FLEET_KV.put(`last:${id}`, JSON.stringify(record));
  await env.FLEET_KV.put(`hist:${id}:${String(report.generated_at).slice(0, 10)}`, JSON.stringify(record), { expirationTtl: HISTORY_TTL_S });
  return json(202, { ok: true, seq: report.seq });
}

function versionTuple(v: string): number[] {
  return v.split(/[.+-]/).map((p) => (/^\d+$/.test(p) ? Number(p) : 0));
}
export function olderThan(a: string, b: string): boolean {
  const x = versionTuple(a);
  const y = versionTuple(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d < 0;
  }
  return false;
}

export function summarize(inst: Installation, last: Last | null, latest: string | undefined, now = Date.now()) {
  if (!last) return { installation_id: inst.installation_id, label: inst.label, status: 'never', last_seen_at: null };
  const r = last.report;
  const ageS = Math.max(0, Math.round((now - Date.parse(last.received_at)) / 1000));
  const outdated = Boolean(latest && olderThan(r.versions.addon, latest));
  const components = Object.values(r.components as Record<string, string>);
  let status: 'green' | 'amber' | 'red' | 'silent' = 'green';
  if (ageS > SILENT_AFTER_S) status = 'silent';
  else if (r.overall === 'error' || components.includes('error')) status = 'red';
  else if (r.overall === 'warn' || components.includes('warn') || outdated || !r.readiness.ready) status = 'amber';
  return {
    installation_id: inst.installation_id, label: inst.label, status, last_seen_at: last.received_at, age_h: Math.floor(ageS / 3600),
    addon: r.versions.addon, outdated, overall: r.overall, readiness: r.readiness.score, ready: r.readiness.ready, demo_mode: r.demo_mode,
    cameras: r.counts.cameras, alerts_critical: r.alerts_open.critical, backup_age_h: r.backup.last_age_h,
  };
}

function authorized(req: Request, env: Env): Response | null {
  if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 32) return err(503, 'admin_unconfigured');
  const h = req.headers.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token || !timingSafeEqual(token, env.ADMIN_TOKEN)) return err(401, 'unauthorized');
  return null;
}

async function listInstallations(env: Env): Promise<Installation[]> {
  const out: Installation[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.FLEET_KV.list({ prefix: 'inst:', cursor });
    for (const k of page.keys) {
      const inst = (await env.FLEET_KV.get(k.name, 'json')) as Installation | null;
      if (inst) out.push(inst);
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return out;
}

async function enroll(req: Request, env: Env): Promise<Response> {
  const text = await readBody(req);
  if (text === null) return err(413, 'too_large');
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    return err(400, 'not_json');
  }
  const allowed = new Set(['code', 'label', 'replace_key']);
  if (!body || typeof body !== 'object' || Object.keys(body).some((k) => !allowed.has(k))) return err(422, 'bad_request');
  const label = typeof body.label === 'string' ? body.label.trim() : '';
  if (!label || label.length > LABEL_MAX) return err(422, 'bad_label');
  const e = typeof body.code === 'string' ? await parseEnrollment(body.code) : null;
  if (!e) return err(422, 'bad_enrollment_code');
  const key = `inst:${e.installation_id}`;
  const existing = (await env.FLEET_KV.get(key, 'json')) as Installation | null;
  const now = nowIso();
  if (existing) {
    const same = existing.keys.find((k) => k.kid === e.kid && !k.retired_at);
    if (same) {
      existing.label = label;
      await env.FLEET_KV.put(key, JSON.stringify(existing));
      return json(200, { installation_id: e.installation_id, kid: e.kid, label, replaced: false });
    }
    // a different key for an enrolled id: only on an explicit replace (the installation rotated its key, or was reinstalled)
    if (body.replace_key !== true) return err(409, 'already_enrolled_other_key');
    for (const k of existing.keys) if (!k.retired_at) k.retired_at = now;
    existing.keys.push({ kid: e.kid, public_key: e.public_key, added_at: now, retired_at: null });
    existing.label = label;
    await env.FLEET_KV.put(key, JSON.stringify(existing));
    return json(200, { installation_id: e.installation_id, kid: e.kid, label, replaced: true });
  }
  const inst: Installation = { installation_id: e.installation_id, label, enrolled_at: now, keys: [{ kid: e.kid, public_key: e.public_key, added_at: now, retired_at: null }] };
  await env.FLEET_KV.put(key, JSON.stringify(inst));
  return json(201, { installation_id: e.installation_id, kid: e.kid, label, replaced: false });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    try {
      if (path === '/v1/health' && req.method === 'GET') return json(200, { ok: true, context: CONTEXT.trim() });
      if (path === '/v1/report') return req.method === 'POST' ? await handleReport(req, env) : err(405, 'method_not_allowed');
      if (path.startsWith('/v1/admin/')) {
        const denied = authorized(req, env);
        if (denied) return denied;
        if (path === '/v1/admin/installations') {
          if (req.method === 'POST') return await enroll(req, env);
          if (req.method !== 'GET') return err(405, 'method_not_allowed');
          const items = [];
          for (const inst of await listInstallations(env)) {
            items.push(summarize(inst, (await env.FLEET_KV.get(`last:${inst.installation_id}`, 'json')) as Last | null, env.LATEST_ADDON_VERSION));
          }
          const totals: Record<string, number> = { installations: items.length };
          for (const it of items) totals[it.status] = (totals[it.status] ?? 0) + 1;
          return json(200, { items, totals, latest_addon_version: env.LATEST_ADDON_VERSION ?? null });
        }
        const m = /^\/v1\/admin\/installations\/([0-9a-f]{32})$/.exec(path);
        if (m) {
          const inst = (await env.FLEET_KV.get(`inst:${m[1]}`, 'json')) as Installation | null;
          if (!inst) return err(404, 'not_found');
          if (req.method === 'DELETE') {
            await env.FLEET_KV.delete(`inst:${m[1]}`);
            await env.FLEET_KV.delete(`last:${m[1]}`);
            return json(200, { deleted: true });
          }
          if (req.method !== 'GET') return err(405, 'method_not_allowed');
          return json(200, { installation: inst, last: await env.FLEET_KV.get(`last:${m[1]}`, 'json') });
        }
      }
      return err(404, 'not_found');
    } catch {
      return err(500, 'internal');
    }
  },
};
