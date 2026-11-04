import type { Page, Route } from '@playwright/test';
import { NOW_ISO, type StationsMock } from './wiskey-stations-mocks';

// WISKEY-DOOR-TECH-2390: the mocked backend of the door technical writes, layered over the stations screen's mock
// (tests/wiskey-stations-mocks.ts; routes registered later win, everything else falls through to it). Invented answers only: no station,
// no intercom. It answers like routers/access_control_door_tech.py and the technical reads: the view (who may write, the relays, the
// commands this version offers, the recent writes), the hold-open drafts, the programs and the code presence - statefully, so a write
// shows in the next read - and the five writes with an outcome per kind. It RECORDS every request so a spec can assert exactly what was
// read and sent, and how many times. A code value never leaves the request body it came in.

export type DtKind = 'hold_save' | 'hold_delete' | 'code_write' | 'program_save' | 'program_action';
export type DtResult = 'ok' | 'refused' | 'unknown' | 'not_sent' | 'partial' | 'slow';

const WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const weekly = (hours: [string, string] | null) => Object.fromEntries(WEEK.map((d) => [d, hours && d !== 'Saturday' ? [{ start: hours[0], end: hours[1] }] : []]));

export interface DtMock {
  /** Stations whose doors this caller may write (the server's per-station decision). */
  allowed: Set<string>;
  /** Per kind: how the server answers. Default `ok`. */
  result: Partial<Record<DtKind, DtResult>>;
  /** WisKey's code for a `refused` / `unknown` / `not_sent` answer, per kind. */
  code: Partial<Record<DtKind, string>>;
  unlisted: Set<DtKind>;
  drafts: Record<string, { door: number; revision: number; policy: Record<string, unknown> } | null>;
  programs: Record<string, { door: number; revision: number; enabled: boolean; removing: boolean; policy: Record<string, unknown>; execution: Record<string, unknown> }[]>;
  codes: Record<string, Record<number, boolean>>;
  history: Record<string, unknown>[];
  // recorded
  reads: string[];
  posts: { path: string; body: Record<string, unknown> }[];
}

export const newDtMock = (over: Partial<DtMock> = {}): DtMock => ({
  allowed: new Set(['gate', 'lobby', 'lab', 'store', 'mgmt']),
  result: {},
  code: {},
  unlisted: new Set(),
  drafts: {
    'lobby/1': { door: 1, revision: 2, policy: { timezone: 'Asia/Jerusalem', name: 'שעות לובי', weekly: weekly(['07:00', '19:00']), holidays: [{ name: 'חג', start: '2026-12-24', end: '2026-12-25', periods: [] }] } },
  },
  programs: {
    lobby: [{ door: 2, revision: 4, enabled: true, removing: false, policy: { timezone: 'Asia/Jerusalem', name: 'מחסום בוקר', weekly: weekly(['06:30', '09:00']), holidays: [] }, execution: { owned: false, attempted: null, status: 'idle' } }],
  },
  codes: { lobby: { 1: true, 2: false, 3: false, 4: false } },
  history: [],
  reads: [],
  posts: [],
  ...over,
});

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const fail = (route: Route, status: number, code: string, details: Record<string, unknown>) =>
  json(route, { code, user_message: `(בדיקה) ${code}`, retryable: false, correlation_id: 'test', details }, status);
const head = () => ({ state: 'ready', configured: true, last_error: null, fetched_at: NOW_ISO, fresh: true, sync: null });
const KINDS: DtKind[] = ['hold_save', 'hold_delete', 'code_write', 'program_save', 'program_action'];

export async function installDtMock(page: Page, base: StationsMock, m: DtMock): Promise<DtMock> {
  await page.route('**/api/v1/access-control/stations/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\/access-control\/stations\//, '');
    const method = req.method();
    const [rawId, ...rest] = p.split('/');
    const id = decodeURIComponent(rawId);
    const s = base.stations.find((x) => x.id === id);
    const tail = rest.join('/');
    if (!s) return route.fallback();
    if (method === 'GET' && tail === 'door-tech') {
      m.reads.push(`door-tech:${id}`);
      const allowed = m.allowed.has(id);
      return json(route, {
        station_id: id,
        allowed,
        reason: allowed ? 'system.configure' : 'no_binding',
        online: s.online,
        feed: 'ready',
        locks: s.locks.map((l) => ({ door: l.physical_index, name: l.name })),
        commands: Object.fromEntries(KINDS.map((k) => [k, m.unlisted.has(k) ? { available: false, reason: 'not_listed' } : { available: true, reason: null }])),
        confirm_phrase: 'קוד {slot}',
        limits: { code_window_s: 900, code_max: 6 },
        history: allowed ? m.history : [],
      });
    }
    const hold = /^doors\/(\d)\/hold$/.exec(tail);
    if (method === 'GET' && hold) {
      m.reads.push(`hold:${id}/${hold[1]}`);
      const d = m.drafts[`${id}/${hold[1]}`] ?? null;
      return json(route, { ...head(), hold: { draft: d, active: false, blocker: 'schedule_writes_unverified', timezone: 'Asia/Jerusalem' } });
    }
    if (method === 'GET' && tail === 'programs') {
      m.reads.push(`programs:${id}`);
      return json(route, { ...head(), programs: { programs: (m.programs[id] ?? []).map((x) => ({ ...x, error: null, checked_at: NOW_ISO })), saved: [], timezone: 'Asia/Jerusalem', native_supported: false } });
    }
    if (method === 'GET' && tail === 'codes') {
      m.reads.push(`codes:${id}`);
      const c = m.codes[id] ?? { 1: false, 2: false };
      return json(route, { ...head(), codes: { public_pin_state: Object.values(c).some(Boolean) ? 'configured' : 'absent', slots: Object.entries(c).map(([n, v]) => ({ slot: Number(n), configured: v })), capabilities: { advertised: true, min: 4, max: 8 }, checked_at: NOW_ISO } });
    }
    if (method !== 'POST') return route.fallback();
    const body = (req.postDataJSON() ?? {}) as Record<string, unknown>;
    let kind: DtKind | null = null;
    let door = 0;
    let slot = 0;
    let m2: RegExpExecArray | null;
    if ((m2 = /^doors\/(\d)\/hold$/.exec(tail))) [kind, door] = ['hold_save', Number(m2[1])];
    else if ((m2 = /^doors\/(\d)\/hold\/delete$/.exec(tail))) [kind, door] = ['hold_delete', Number(m2[1])];
    else if ((m2 = /^doors\/(\d)\/program$/.exec(tail))) [kind, door] = ['program_save', Number(m2[1])];
    else if ((m2 = /^doors\/(\d)\/program\/(pause|remove)$/.exec(tail))) [kind, door] = ['program_action', Number(m2[1])];
    else if ((m2 = /^codes\/(\d+)$/.exec(tail))) [kind, slot] = ['code_write', Number(m2[1])];
    if (!kind) return route.fallback();
    m.posts.push({ path: `${id}/${tail}`, body });
    const result = m.result[kind] ?? 'ok';
    const record = (status: string, code: string | null) =>
      m.history.unshift({ kind, at: NOW_ISO, status, code, door: door || (body.door as number) || null, slot: slot || null, code_action: kind === 'code_write' ? body.action : null,
                          program_action: kind === 'program_action' ? tail.split('/').pop() : null, enabled: kind === 'program_save' ? body.enabled : null });
    if (result === 'slow') await new Promise((r) => setTimeout(r, 1500));
    if (result === 'refused') {
      const code = m.code[kind] ?? 'revision_conflict';
      record('refused', code);
      return fail(route, 409, 'door_tech_refused', { outcome: 'refused', wiskey_code: code, state: 'error' });
    }
    if (result === 'unknown') {
      const code = m.code[kind] ?? 'timeout';
      record('unknown', code);
      return fail(route, 504, 'door_tech_outcome_unknown', { outcome: 'unknown', wiskey_code: code, state: 'error' });
    }
    if (result === 'not_sent') {
      const code = m.code[kind] ?? 'door_tech_cooldown';
      record('not_sent', code);
      return fail(route, 429, code, { outcome: 'not_sent', retry_after_s: 2 });
    }
    // ok / partial / slow: apply like WisKey would
    let data: Record<string, unknown> = {};
    if (kind === 'hold_save') {
      const old = m.drafts[`${id}/${door}`];
      const policy = body.policy as Record<string, unknown>;
      m.drafts[`${id}/${door}`] = { door, revision: (old?.revision ?? 0) + 1, policy };
      data = { draft: m.drafts[`${id}/${door}`], active: false, blocker: 'schedule_writes_unverified', timezone: 'Asia/Jerusalem' };
    } else if (kind === 'hold_delete') {
      m.drafts[`${id}/${door}`] = null;
      data = { deleted: true };
    } else if (kind === 'program_save') {
      const list = (m.programs[id] ??= []);
      const old = list.find((x) => x.door === door);
      const item = { door, revision: (old?.revision ?? 0) + 1, enabled: body.enabled === true, removing: false, policy: body.policy as Record<string, unknown>, execution: { owned: false, attempted: null, status: 'idle' } };
      m.programs[id] = [...list.filter((x) => x.door !== door), item];
      if (result !== 'partial') m.drafts[`${id}/${door}`] = null;
      data = result === 'partial' ? { partial: 'program_saved_draft_cleanup_unknown', programs: null } : { partial: null, programs: m.programs[id] };
    } else if (kind === 'program_action') {
      const action = tail.split('/').pop();
      const list = m.programs[id] ?? [];
      m.programs[id] = action === 'remove' ? list.filter((x) => x.door !== door) : list.map((x) => (x.door === door ? { ...x, enabled: false, revision: x.revision + 1 } : x));
      data = { partial: null, programs: m.programs[id] };
    } else {
      const set = body.action === 'set';
      (m.codes[id] ??= {})[slot] = set;
      data = { slot, configured: set, acknowledged: true, physical_verified: false, checked_at: NOW_ISO };
    }
    const partial = result === 'partial' ? 'program_saved_draft_cleanup_unknown' : null;
    record(partial ? 'partial' : 'acknowledged', partial);
    return json(route, { station_id: id, kind, status: partial ? 'partial' : 'acknowledged', partial, command_id: `cmd-${m.posts.length}`, at: NOW_ISO, data });
  });
  return m;
}
