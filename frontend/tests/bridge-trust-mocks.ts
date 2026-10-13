import type { Page, Route } from '@playwright/test';

// CR-040 (WXROT): a mocked backend for the REAL Settings page "בקרת כניסה" (#/system/access-control/trust) with the segment "מפתח הגשר"
// (system-access-trust) behind the real shell. Synthetic names; no Home Assistant, bridge, WisKey, station or door. The three trust routes
// answer the way routers/bridge_trust.py does (closed shapes, never a key, salt, proof, nonce or signature - checked against the real
// routes by backend/tests/test_bridge_trust_rotation.py): the view is computed from the mock's state; a rotation ends the way `next` says
// (rotated, not_rotated with a code, or unknown - which then holds the open request until a check resolves it); every write is recorded
// so a spec asserts exactly what was sent. Used by evidence-bridge-trust.spec.ts and layout-bridge-trust.spec.ts.

export const NOW = new Date('2026-10-13T09:30:00Z');
export const TRUST = '/system/access-control/trust';
const BASE = ['video.live', 'map.read', 'entity.state.read', 'access.read', 'devices.read', 'events.read'];
/** A system administrator: the access-control administration and the key. */
export const ADMIN = [...BASE, 'access.admin.read', 'system.configure', 'rbac.assign', 'access.trust.rotate'];
/** A person whose custom role holds only the key permission: the page shows that one segment. */
export const KEYHOLDER = ['map.read', 'access.trust.rotate'];
/** An access-control administrator without the key permission: no key segment. */
export const AC_ADMIN = [...BASE, 'access.admin.read'];

export type Outcome = 'rotated' | 'not_rotated' | 'unknown' | 'neither';

export interface Row {
  request_id: string;
  initiator: string;
  epoch_from: number;
  epoch_to: number;
  state: 'dispatching' | 'unknown' | 'rotated' | 'not_rotated' | 'superseded';
  code: string | null;
  requested_at: string;
  resolved_at: string | null;
  status_checks: number;
}

export interface TrustMock {
  perms: string[];
  channel: 'local' | 'remote';
  epoch: number;
  version: string | null;
  supported: boolean;
  paired: boolean;
  epochSeen: number | null;
  history: Row[];
  /** What the next rotation ends in. */
  next: Outcome;
  /** What the next status check finds (a rotation that did apply, or did not). */
  checkFinds: 'applied' | 'not_applied' | 'still_unknown';
  getStatus: number | null;
  getDelay: number;
  postDelay: number;
  gets: number;
  posts: { path: string; body: unknown }[];
}

const AT = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString().replace('.000Z', 'Z');
let seq = 0;
const rid = () => {
  seq += 1;
  return `${(0x7c0e5a52 + seq).toString(16).padStart(8, '0')}-6b8f-4f6e-9d1a-${String(seq).padStart(12, '0')}`;
};

export const sampleHistory = (): Row[] => [
  { request_id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d', initiator: 'יוני', epoch_from: 2, epoch_to: 3, state: 'rotated', code: 'rotated', requested_at: AT(60 * 24 * 3), resolved_at: AT(60 * 24 * 3), status_checks: 0 },
  { request_id: '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e', initiator: 'מנהלת האחזקה', epoch_from: 2, epoch_to: 3, state: 'not_rotated', code: 'refused:state/storage_unavailable', requested_at: AT(60 * 24 * 4), resolved_at: AT(60 * 24 * 4), status_checks: 0 },
  { request_id: '3c4d5e6f-7a8b-4c9d-8e1f-2a3b4c5d6e7f', initiator: 'יוני', epoch_from: 1, epoch_to: 2, state: 'rotated', code: 'status_applied', requested_at: AT(60 * 24 * 12), resolved_at: AT(60 * 24 * 12), status_checks: 1 },
];

export const newTrustMock = (over: Partial<TrustMock> = {}): TrustMock => ({
  perms: ADMIN,
  channel: 'local',
  epoch: 3,
  version: '0.8.1',
  supported: true,
  paired: true,
  epochSeen: 3,
  history: sampleHistory(),
  next: 'rotated',
  checkFinds: 'applied',
  getStatus: null,
  getDelay: 0,
  postDelay: 0,
  gets: 0,
  posts: [],
  ...over,
});

/** An open request, as the server shows it after a rotation it did not hear back from. */
export const openUnknown = (code = 'transport'): Row => ({ request_id: rid(), initiator: 'יוני', epoch_from: 3, epoch_to: 4, state: 'unknown', code, requested_at: AT(2), resolved_at: null, status_checks: 0 });

const MESSAGES = {
  rotated: (e: number) => `המפתח הוחלף. Arx והגשר עברו יחד לדור ${e}.`,
  not_rotated: () => 'המפתח לא הוחלף; המפתח הקודם נשאר בתוקף. דבר לא נשלח שוב.',
  unknown: () => 'לא ידוע אם המפתח הוחלף. הפעולות דרך הגשר מושהות עד שבדיקת המצב תברר זאת; הבקשה לא תישלח שוב.',
};

function open(m: TrustMock): Row | null {
  return m.history.find((r) => r.state === 'unknown' || r.state === 'dispatching') ?? null;
}

export function view(m: TrustMock) {
  const o = open(m);
  const blocked = !m.paired ? 'not_paired' : !m.supported ? 'unsupported' : o ? 'in_progress' : null;
  return {
    epoch: m.epoch,
    bridge: { paired: m.paired, version: m.version, required: '0.8.1', supported: m.supported, epoch_seen: m.epochSeen, seen_at: m.epochSeen === null ? null : AT(1) },
    open: o,
    history: [...m.history].sort((a, b) => b.requested_at.localeCompare(a.requested_at)).slice(0, 20),
    can_rotate: blocked === null,
    blocked,
  };
}

const ENVELOPE = (code: string, user_message: string, details: Record<string, unknown> = {}) => ({ code, user_message, retryable: false, correlation_id: 'mock', details });

const HEALTH = {
  status: 'ok', version: 'test', db: { ok: true, permission_revision: 1 }, data_dir_writable: true, nvr_configured: true, go2rtc_configured: true, mode: 'full',
  discovery: { cameras_last_ok: null, cameras_last_error: null, cameras_last_run: null, streams_last_ok: null, streams_last_error: null, last_reason: null, cameras: 0, interval_s: 600 },
  events: { ingest: { connected: true, last_heartbeat_at: null, last_event_at: null, last_error: null, reconnects: 0, events_stored: 0, started_at: null }, derive: { last_run: null, last_ok: null, last_error: null, derived: 0 }, stored: 0 },
  home_assistant: { configured: true, connected: true, last_snapshot_at: null, last_event_at: null, last_registry_at: null, last_error: null, reconnects: 0, sequence: 1, entities: 0, started_at: null, ha_version: '2026.9' },
  identity_source: 'ingress', renderer: 'fake',
};

export async function installTrustMock(page: Page, m: TrustMock): Promise<TrustMock> {
  await page.route('**/api/v1/**', async (route: Route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const holds = m.perms.includes('access.trust.rotate');
    if (p === 'me') {
      return json({
        channel: m.channel, remote: null, user: { id: 'u-joni', username: 'joni', display_name: 'יוני', source: 'ingress' }, active: true,
        bindings: [{ id: 'b1', role_id: 'r', role_name: 'תפקיד', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: m.perms, permissions_any: m.perms, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full',
      });
    }
    if (p === 'me/prefs') return json({ prefs: { 'nav.order': ['devices', 'security', 'explore', 'wiskey'] }, stored: [], updated_at: null });
    if (p === 'settings') return json({ settings: { 'ui.design': 'a', 'ui.start_route': 'devices', 'time.zone': 'Asia/Jerusalem' }, can_edit: m.perms.includes('system.configure') });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-10-13T00:00:00Z', version: 'test' });
    if (p === 'health') return json(HEALTH);
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    if (p === 'sites') return json({ sites: [], can_create_site: false });
    if (p === 'ha/bridge/trust' && req.method() === 'GET') {
      m.gets += 1;
      if (m.getDelay) await new Promise((r) => setTimeout(r, m.getDelay));
      if (m.channel === 'remote') return json(ENVELOPE('not_found', 'Not found'), 404);
      if (!holds) return json(ENVELOPE('forbidden', 'אין הרשאה'), 403);
      if (m.getStatus) return json(ENVELOPE('internal', 'הקריאה נכשלה (בדיקה)'), m.getStatus);
      return json(view(m));
    }
    if (p === 'ha/bridge/trust/rotations' && req.method() === 'POST') {
      const body = req.postDataJSON() as unknown;
      m.posts.push({ path: p, body });
      if (m.postDelay) await new Promise((r) => setTimeout(r, m.postDelay));
      if (!holds) return json(ENVELOPE('forbidden', 'אין הרשאה'), 403);
      if ((body as { confirmed?: unknown } | null)?.confirmed !== true) return json(ENVELOPE('confirmation_required', 'החלפת המפתח דורשת אישור מפורש.'), 409);
      if (open(m)) return json(ENVELOPE('rotation_in_progress', 'החלפת מפתח קודמת עדיין לא הסתיימה. יש לברר את מצבה לפני החלפה נוספת.'), 409);
      if (!m.supported) return json(ENVELOPE('rotation_unsupported', 'נדרש עדכון של רכיב החיבור לגרסה 0.8.1 לפחות, ודיווח ממנו שהוא תומך בהחלפת מפתח.'), 409);
      const r: Row = { request_id: rid(), initiator: 'יוני', epoch_from: m.epoch, epoch_to: m.epoch + 1, state: 'rotated', code: 'rotated', requested_at: NOW.toISOString().replace('.000Z', 'Z'), resolved_at: null, status_checks: 0 };
      if (m.next === 'rotated') {
        r.resolved_at = r.requested_at;
        m.epoch += 1;
        m.epochSeen = m.epoch;
      } else if (m.next === 'not_rotated') {
        r.state = 'not_rotated';
        r.code = 'refused:state/epoch_mismatch';
        r.resolved_at = r.requested_at;
      } else {
        r.state = 'unknown';
        r.code = m.next === 'neither' ? 'neither_key' : 'transport';
      }
      m.history.push(r);
      const state = r.state === 'rotated' ? 'rotated' : r.state === 'unknown' ? 'unknown' : 'not_rotated';
      return json({ request_id: r.request_id, state, code: r.code, epoch_from: r.epoch_from, epoch_to: r.epoch_to, message: MESSAGES[state](r.epoch_to), trust: view(m) });
    }
    const chk = /^ha\/bridge\/trust\/rotations\/([^/]+)\/check$/.exec(p);
    if (chk && req.method() === 'POST') {
      m.posts.push({ path: p, body: req.postDataJSON() ?? null });
      if (m.postDelay) await new Promise((r) => setTimeout(r, m.postDelay));
      const r = m.history.find((x) => x.request_id === decodeURIComponent(chk[1]));
      if (!r) return json(ENVELOPE('not_found', 'הבקשה לא נמצאה.'), 404);
      r.status_checks += 1;
      if (m.checkFinds === 'applied') {
        r.state = 'rotated';
        r.code = 'status_applied';
        r.resolved_at = NOW.toISOString().replace('.000Z', 'Z');
        m.epoch = r.epoch_to;
        m.epochSeen = m.epoch;
      } else if (m.checkFinds === 'not_applied') {
        r.state = 'not_rotated';
        r.code = 'fenced';
        r.resolved_at = NOW.toISOString().replace('.000Z', 'Z');
      } else {
        r.code = 'status_unreachable';
      }
      const state = r.state === 'rotated' ? 'rotated' : r.state === 'unknown' ? 'unknown' : 'not_rotated';
      return json({ request_id: r.request_id, state, code: r.code, epoch_from: r.epoch_from, epoch_to: r.epoch_to, message: MESSAGES[state](r.epoch_to), trust: view(m) });
    }
    return json(ENVELOPE('not_found', 'לא נמצא (בדיקה)'), 404);
  });
  return m;
}

/** Open the segment (the shell's own sign-in state is the mock's `/me`). */
export async function openTrust(page: Page, o: { skin?: string; scheme?: 'light' | 'dark'; hash?: string; lang?: string } = {}): Promise<void> {
  await page.clock.setFixedTime(NOW);
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=${o.skin ?? 'classic'}&scheme=${o.scheme ?? 'light'}#${o.hash ?? TRUST}`);
  await page.waitForSelector('sw-app');
}
