import type { Page, Route } from '@playwright/test';
import type { DuplicateGroup, StationUser, StepOutcome } from '../src/api/station-people';

// WISKEY-PEOPLE-COMPLETE-2390: a STATEFUL mocked backend for the "people on stations only" view, the duplicate warning and the editor's
// PIN check - the reply shapes of routers/access_control_station_people.py (held to the real endpoints by
// smplwise_vms/backend/tests/test_wiskey_station_people_2390.py). Installed AFTER the S7 people mock (tests/wiskey-people-mock.ts) and the
// writes mock: its routes win, anything else falls back. Synthetic names and numbers only; nothing reaches a station.

export interface StationPeopleMock {
  stations: { id: string; name: string; online: boolean; ignored: number; credentials: boolean; numbers: boolean }[];
  users: Record<string, StationUser[]>;
  /** A station whose read answers like an offline station (people: null). */
  offline: Set<string>;
  /** The next adopt / delete / ignore at this station answers this outcome instead of `ok`. */
  failAt: Record<string, { outcome: StepOutcome; code: string; message: string }>;
  /** The people the duplicate check finds for a station user number (by name), and the person with the same number. */
  matches: Record<string, { id: string; display_name: string; employee_no: string; reasons: string[] }[]>;
  duplicates: DuplicateGroup[];
  pinTaken: Set<string>;
  sent: { path: string; body: Record<string, unknown> }[];
  reads: string[];
}

const at = (d: string) => `2026-${d}T08:00:00Z`;
const u = (employee_no: string, display_name: string, extra: Partial<StationUser> = {}): StationUser => ({
  employee_no, display_name, first_seen_at: at('10-28'), last_seen_at: at('11-03'), ignored: false, ignored_at: null, ignored_in_wiskey: false, adoptable: true,
  import_error: null, pin: false, cards: 0, biometric: null, ...extra,
});

export function newStationPeople(): StationPeopleMock {
  return {
    stations: [
      { id: 'gate', name: 'שער ראשי', online: true, ignored: 0, credentials: true, numbers: true },
      { id: 'lobby', name: 'לובי', online: true, ignored: 0, credentials: true, numbers: true },
      { id: 'park', name: 'חניון', online: false, ignored: 0, credentials: true, numbers: true },
      { id: 'lab', name: 'מעבדה', online: true, ignored: 0, credentials: true, numbers: false },
    ],
    users: {
      gate: [u('2001', 'משה ישראלי', { pin: true, cards: 1, first_seen_at: at('10-20') }), u('2002', 'אורח פנים', { adoptable: false, import_error: 'unsupported_credentials', biometric: true }),
        u('2003', '', { cards: 1 }), u('1002', 'יוסי לוי', { pin: true })],
      lobby: [u('2001', 'משה ישראלי', { cards: 1 }), u('2004', 'דנה כהן', { pin: true }), u('2005', 'שומר לילה', { ignored: true, ignored_at: at('11-01') })],
      park: [],
    },
    offline: new Set(['park']),
    failAt: {},
    matches: {
      '1002': [{ id: 'p2', display_name: 'יוסי לוי', employee_no: '1002', reasons: ['employee_no', 'display_name'] }],
      '2004': [{ id: 'p1', display_name: 'דנה כהן', employee_no: '1001', reasons: ['display_name'] }],
    },
    duplicates: [
      { code: 'duplicate_display_name', field_id: '', label: '', people: [{ id: 'p1', display_name: 'דנה כהן' }, { id: 'p5', display_name: 'נועה בר' }], more: 0 },
      { code: 'duplicate_phone', field_id: '', label: '', people: [{ id: 'p2', display_name: 'יוסי לוי' }, { id: 'p7', display_name: 'רונית גל' }], more: 1 },
    ],
    pinTaken: new Set(['4321']),
    sent: [],
    reads: [],
  };
}

const err = (code: string, user_message: string, details: Record<string, unknown> = {}) => ({ code, user_message, retryable: false, correlation_id: '', details });

export async function installStationPeople(page: Page, m: StationPeopleMock): Promise<void> {
  await page.route('**/api/v1/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const body = () => (req.postDataJSON() ?? {}) as Record<string, unknown>;

    if (p === 'access-control/station-people/stations' && method === 'GET') {
      const stations = m.stations.map((s) => ({ ...s, ignored: (m.users[s.id] ?? []).filter((x) => x.ignored).length }));
      return json({ state: 'ready', stations });
    }
    const one = /^access-control\/station-people\/stations\/([^/]+)$/.exec(p);
    if (one && method === 'GET') {
      const id = decodeURIComponent(one[1]);
      m.reads.push(`${id}${url.searchParams.get('refresh') ? ':refresh' : ''}`);
      const s = m.stations.find((x) => x.id === id);
      if (!s) return json(err('intercom_station_not_found', 'העמדה לא נמצאה.'), 404);
      if (m.offline.has(id)) return json({ state: 'error', last_error: 'station_offline', cached: false, station: { id, name: s.name }, read_at: null, people: null });
      return json({ state: 'ready', last_error: null, cached: false, station: { id, name: s.name }, read_at: at('11-03'), people: m.users[id] ?? [] });
    }
    if (p === 'access-control/people-duplicates' && method === 'GET') return json({ state: 'ready', restricted: false, groups: m.duplicates, complete: true });
    if (p === 'intercom/people/pin-check' && method === 'POST') {
      const b = body();
      m.sent.push({ path: p, body: { user_id: b.user_id } }); // the value is not kept by the mock either
      return json({ state: 'ready', last_error: null, available: !m.pinTaken.has(String(b.pin)) });
    }
    if (p === 'intercom/station-people/check' && method === 'POST') {
      const b = body();
      const matches = m.matches[String(b.employee_no)] ?? [];
      const same = matches.find((x) => x.reasons.includes('employee_no'));
      return json({ state: 'ready', last_error: null, checked: true, matches, total: matches.length, same_number: same ? { id: same.id, display_name: same.display_name } : null, restricted: false });
    }
    const write = /^intercom\/station-people\/(adopt|ignore|delete)$/.exec(p);
    if (write && method === 'POST') {
      const kind = write[1];
      const b = body();
      m.sent.push({ path: p, body: b });
      const no = String(b.employee_no);
      if (b.confirmed !== true) return json(err('confirmation_required', 'הפעולה דורשת אישור מפורש.', { outcome: 'not_sent' }), 409);
      if (kind === 'delete' && String(b.typed ?? '').trim() !== no) return json(err('station_people_typed_mismatch', 'המספר שהוקלד אינו מספר המשתמש בעמדה.', { outcome: 'not_sent' }), 409);
      const results = (b.station_ids as string[]).map((sid) => {
        const fail = m.failAt[sid];
        if (fail) {
          delete m.failAt[sid];
          return { station_id: sid, outcome: fail.outcome, code: fail.code, message: fail.message, ...(kind === 'ignore' ? { stored: true } : {}) };
        }
        const list = m.users[sid] ?? [];
        if (kind === 'adopt' || kind === 'delete') m.users[sid] = list.filter((x) => x.employee_no !== no);
        else m.users[sid] = list.map((x) => (x.employee_no === no ? { ...x, ignored: !!b.ignored, ignored_at: b.ignored ? at('11-03') : null } : x));
        return { station_id: sid, outcome: 'ok' as const, code: null, message: null, ...(kind === 'ignore' ? { stored: true } : {}) };
      });
      const summary = { ok: 0, refused: 0, unknown: 0, not_sent: 0 } as Record<StepOutcome, number>;
      for (const r of results) summary[r.outcome] += 1;
      const linked = m.matches[no]?.find((x) => x.reasons.includes('employee_no'));
      const person = kind === 'adopt' && summary.ok ? { id: linked?.id ?? 'p1', display_name: linked?.display_name ?? 'דנה כהן' } : null;
      return json({ results, summary, ...(kind === 'adopt' ? { person, effect: 'sync', pending: false } : {}), ...(kind === 'delete' ? { effect: 'unknown_effect', pending: true } : {}) });
    }
    return route.fallback();
  });
}
