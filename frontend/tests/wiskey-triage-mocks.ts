import type { Page, Route } from '@playwright/test';
import { installAccessMock, NOW, url, WIRE, type AccessMock, type MockOptions } from './access-control-mocks';

// WISKEY-CONFLICTS-2400: the conflicts and fleet alerts screen against a MOCKED backend (synthetic data - no WisKey, no station, no Home
// Assistant). The shell, the session and the status reads are tests/access-control-mocks.ts; this file adds the screen's own endpoints
// (routers/access_control_triage.py): the page facts, WisKey's review (never its token), the resolution and the alert actions, each
// answering what the server would, plus a removal row on the conflicts list. Every request is recorded (`calls`).

export interface TriageCall {
  method: string;
  path: string;
  body: Record<string, unknown> | null;
}

export interface TriageOptions extends MockOptions {
  /** The resolution: ok (acknowledged), stale (WisKey review_stale), failed (WisKey device_unavailable), unknown (no clear answer) */
  resolve?: 'ok' | 'stale' | 'failed' | 'unknown';
  /** The alert action: ok, conflict (WisKey revision_conflict) */
  alert?: 'ok' | 'conflict';
  /** WisKey allows the device direction in the review (default false: the device has no supported credential set) */
  deviceAllowed?: boolean;
  /** The notification feed setting as stored */
  notify?: boolean;
  /** Hold the review's answer until `release()` (a screenshot of the reading state) */
  holdReview?: boolean;
}

export interface TriageMock {
  access: AccessMock;
  calls: TriageCall[];
  notify: boolean;
  releaseReview: () => void;
}

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const error = (route: Route, status: number, code: string, user_message: string, details: Record<string, unknown>) =>
  json(route, { code, user_message, retryable: false, correlation_id: 'mock', details }, status);

/** The removal (a deletion WisKey holds for review) next to the person and the revocation of the shared fixture. */
export const REMOVAL = { kind: 'removal', station_id: 'entry-b', sync_state: 'error', last_error: 'device_unavailable', person: { id: 'u8', display_name: 'דנה לוי', employee_no: '1008' } };

const side = (over: Record<string, unknown> = {}) => ({
  present: true,
  display_name: 'אלי פרץ',
  user_type: 'normal',
  validity: { timed: true, from: '2026-01-01T00:00:00', until: '2027-01-01T00:00:00', time_type: 'local' },
  door_rights: [1, 2],
  pin_configured: true,
  card_count: 1,
  schedule_configured: false,
  privileged: false,
  other_credentials: false,
  ...over,
});

export function reviewOf(stationId: string, personId: string, kind: 'person' | 'removal', o: TriageOptions) {
  const removal = kind === 'removal';
  return {
    review_id: `rv_${removal ? 'removal' : 'person'}000000000001`,
    expires_at: new Date(NOW.getTime() + 600_000).toISOString().replace(/\.\d{3}Z$/, 'Z'),
    kind,
    station_id: stationId,
    person_id: personId,
    impact: {
      user_id: personId,
      station_id: stationId,
      revision: removal ? null : 3,
      reviewed_at: NOW.toISOString().replace(/\.\d{3}Z$/, '+00:00'),
      absent: false,
      deletion_pending: removal,
      active: !removal,
      central: removal ? null : side(),
      device: removal ? side({ display_name: 'דנה לוי', door_rights: [1], card_count: 2 }) : side({ display_name: 'אלי פרץ (עמדה)', door_rights: [1], pin_configured: false, card_count: 2 }),
      differences: removal ? [] : ['display_name', 'door_rights', 'pin', 'cards'],
      plan: removal ? { person: 'delete', pin: 'remove', cards_add: 0, cards_remove: 2, cards_update: 0 } : { person: 'update', pin: 'set', cards_add: 0, cards_remove: 1, cards_update: 0 },
      unverified_fields: [],
      affected_stations: removal ? ['entry-b'] : ['entry-a', 'entry-c'],
      actions: removal
        ? { central: { allowed: false, reason: 'user_not_found' }, device: { allowed: false, reason: 'user_not_found' }, delete: { allowed: true, reason: null } }
        : {
            central: { allowed: true, reason: null },
            device: { allowed: !!o.deviceAllowed, reason: o.deviceAllowed ? null : 'device_user_missing' },
            delete: { allowed: false, reason: 'deletion_not_pending' },
          },
      names_hidden: false,
    },
  };
}

export async function installTriageMock(page: Page, o: TriageOptions = {}): Promise<TriageMock> {
  const access = await installAccessMock(page, o);
  let release: () => void = () => undefined;
  const gate = new Promise<void>((r) => (release = r));
  const st: TriageMock = { access, calls: [], notify: !!o.notify, releaseReview: () => release() };
  const persona = o.persona ?? 'admin';
  const manage = persona === 'admin';
  // registered after the access mock, so these answer first; anything else falls back to it
  await page.route('**/api/v1/access-control/**', async (route: Route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace(/^.*\/api\/v1\/access-control\//, '');
    const method = req.method();
    const body = method === 'GET' ? null : (req.postDataJSON() as Record<string, unknown>);
    const own = path === 'triage' || path.startsWith('triage/') || /^stations\/[^/]+\/(conflicts|alerts)\//.test(path) || path === 'status/conflicts';
    if (!own) return route.fallback();
    st.calls.push({ method, path, body });
    if (path === 'status/conflicts' && method === 'GET') {
      if (persona !== 'admin' && persona !== 'siteAdmin') return route.fallback();
      const b = JSON.parse(JSON.stringify(WIRE.status_conflicts));
      b.conflicts = [...b.conflicts, REMOVAL];
      return json(route, { ...b, sync: WIRE.sync });
    }
    if (path === 'triage' && method === 'GET') {
      return json(route, {
        may_resolve: manage,
        may_act_alerts: manage,
        feed: 'ready',
        notify: { enabled: st.notify, can_edit: manage, last: { at: null, state: st.notify ? 'ready' : 'off', emitted: 0, resolved: 0 } },
        review_ttl_s: 600,
        durations: [15, 60, 240, 1440, 10080],
        reasons: ['planned_maintenance', 'network_work', 'investigating'],
        recent: { conflicts: {}, alerts: { 'entry-a:clock_drift': { status: 'completed', at: '2026-09-27T09:00:00+00:00', code: null, direction: null, action: 'snooze' } } },
      });
    }
    if (path === 'triage/settings' && method === 'PUT') {
      if (!manage) return error(route, 403, 'forbidden', 'אין הרשאה.', { permission: 'system.configure' });
      st.notify = !!body?.notify;
      return json(route, { notify: { enabled: st.notify, can_edit: true, last: { at: null, state: 'off', emitted: 0, resolved: 0 } } });
    }
    const rv = /^stations\/([^/]+)\/conflicts\/([^/]+)\/review$/.exec(path);
    if (rv && method === 'POST') {
      if (!manage) return error(route, 403, 'forbidden', 'פתרון התנגשויות דורש הרשאת ניהול עמדות בכל המערכת.', { permission: 'access.stations.manage', outcome: 'not_sent' });
      if (o.holdReview) await gate;
      return json(route, reviewOf(decodeURIComponent(rv[1]), decodeURIComponent(rv[2]), body?.kind === 'removal' ? 'removal' : 'person', o));
    }
    const rs = /^triage\/reviews\/([^/]+)\/resolve$/.exec(path);
    if (rs && method === 'POST') {
      const mode = o.resolve ?? 'ok';
      if (body?.confirmed !== true) return error(route, 409, 'confirmation_required', 'פתרון התנגשות דורש אישור מפורש.', { outcome: 'not_sent' });
      if (mode === 'stale')
        return error(route, 409, 'triage_stale', 'החלת הרשומה המנוהלת על העמדה לא בוצע: הרשומה בעמדה או ב־WisKey השתנתה מאז הבדיקה (review_stale). בדקו שוב לפני שמחליטים.', {
          outcome: 'refused',
          wiskey_code: 'review_stale',
        });
      if (mode === 'failed') return error(route, 502, 'triage_failed', 'החלת הרשומה המנוהלת על העמדה נדחה על ידי WisKey (device_unavailable). לפי WisKey דבר לא השתנה.', { outcome: 'refused', wiskey_code: 'device_unavailable' });
      if (mode === 'unknown') return error(route, 504, 'triage_outcome_unknown', 'נשלח, אך לא התקבלה תשובה ברורה (timeout). ייתכן שבוצע - בדקו את הרשימה לפני שמנסים שוב.', { outcome: 'unknown', wiskey_code: 'timeout' });
      const del = body?.direction === 'delete';
      return json(route, {
        review_id: decodeURIComponent(rs[1]),
        station_id: del ? 'entry-b' : 'entry-c',
        person_id: del ? 'u8' : 'u7',
        direction: body?.direction,
        status: 'acknowledged',
        command_id: 'cmd-1',
        at: '2026-09-27T10:30:00+00:00',
        data: del ? { accepted: true } : { revision: 4, station_states: { 'entry-c': 'pending' } },
        affected_stations: del ? ['entry-b'] : ['entry-a', 'entry-c'],
      });
    }
    const al = /^stations\/([^/]+)\/alerts\/([^/]+)\/(snooze|restore)$/.exec(path);
    if (al && method === 'POST') {
      if (!manage) return error(route, 403, 'forbidden', 'אין הרשאה.', { permission: 'access.stations.manage', outcome: 'not_sent' });
      if (o.alert === 'conflict')
        return error(route, 409, 'triage_stale', 'השתקת ההתראה לא בוצע: הרשומה השתנתה מאז הבדיקה (revision_conflict). בדקו שוב לפני שמחליטים.', { outcome: 'refused', wiskey_code: 'revision_conflict' });
      return json(route, { station_id: al[1], kind: al[2], action: al[3], status: 'completed', command_id: 'cmd-2', at: '2026-09-27T10:30:00+00:00', data: { revision: 5 } });
    }
    return error(route, 404, 'not_found', 'לא נמצא', {});
  });
  return st;
}

/** A minimal pairing status for the "מצב WisKey" card (the section under test is the conflicts one). */
export const PAIRED = {
  generated_at: '2026-09-27T10:30:00+00:00',
  verdict: 'paired',
  paired: true,
  talk_ready: true,
  probe: null,
  lines: [],
  owner_steps: [],
  features: [],
  repair: { available: false, reason: null, announce: false, addon_url: 'http://arx-addon.test:8099' },
};

export async function openTriage(page: Page, hash = '/wiskey/conflicts', o: { skin?: string; scheme?: 'light' | 'dark'; look?: string } = {}) {
  await page.clock.setFixedTime(NOW);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('about:blank');
  const base = url(hash, o.skin ?? 'classic', o.scheme ?? 'light');
  await page.goto(o.look ? base.replace('/?', `/?look=${o.look}&`) : base);
  await page.waitForSelector('sw-app');
}

export const SCREEN = 'sw-app wiskey-triage';
export const PANEL = `${SCREEN} wk-triage-panel`;
