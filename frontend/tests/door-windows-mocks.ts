import type { Page, Route } from '@playwright/test';
import { installAccessMock, type Persona } from './access-control-mocks';

// CR-039 / DOORWIN-295: the door-windows screen's mock, layered over tests/access-control-mocks.ts (a route registered later answers first).
// The wire follows routers/door_windows.py (GET /doors/windows/state, /doors/emergency/state, the two emergency steps). Every door, rule
// and time is INVENTED sample data. Nothing here reaches access control, a station or a door.

export const DWNOW = new Date('2026-11-02T07:10:00Z'); // Monday 09:10 in Jerusalem (UTC+2)
const TZ = 'Asia/Jerusalem';

export interface DoorwinOptions {
  persona?: Persona;
  enabled?: boolean;
  tier?: 'program' | 'prepared';
  /** SPLITSWITCH-297: the window settings' `go_live_permitted` (the program engine's own flag); default false */
  programsLive?: boolean;
  alarm?: boolean;
  /** what the person may do (the server's `can` fields) */
  can?: { manage: boolean; cancel: boolean; configure: boolean };
  emergency?: { enabled?: boolean; lock?: boolean; open?: boolean; openEnabled?: boolean; active?: 'lock' | 'drill' | null };
  /** the per-door results of a started incident */
  results?: ('acknowledged' | 'refused' | 'unknown')[];
  settings?: Record<string, string>;
}

const DOORS = [
  { key: 'st-lobby:1', station_id: 'st-lobby', relay: 1, label: 'לובי · כניסה ראשית', station_name: 'לובי', name: 'כניסה ראשית', zone: TZ },
  { key: 'st-yard:1', station_id: 'st-yard', relay: 1, label: 'חצר · שער הולכי רגל', station_name: 'חצר', name: 'שער הולכי רגל', zone: TZ },
  { key: 'st-dock:1', station_id: 'st-dock', relay: 1, label: 'מחסן · רציף 1', station_name: 'מחסן', name: 'רציף 1', zone: TZ },
  { key: 'st-dock:2', station_id: 'st-dock', relay: 2, label: 'מחסן · רציף 2', station_name: 'מחסן', name: 'רציף 2', zone: TZ },
];

const RULES = [
  { id: 'r-morning', name: 'פתיחת בוקר בלובי', kind: 'weekly', state: 'enabled', calendar_policy: 'skip_holidays', notes: '', revision: 2, updated_at: '2026-10-30T08:00:00Z',
    approved: true, manageable: true, doors: [{ station_id: 'st-lobby', relay: 1, key: 'st-lobby:1', label: DOORS[0].label, visible: true }],
    periods: [0, 1, 2, 3, 4].map((d) => ({ weekday: d, on_date: null, start: '08:00', end: '11:00' })) },
  { id: 'r-yard', name: 'חצר בשעות הפעילות', kind: 'weekly', state: 'enabled', calendar_policy: 'holidays_like_friday', notes: '', revision: 1, updated_at: '2026-10-29T08:00:00Z',
    approved: true, manageable: true, doors: [{ station_id: 'st-yard', relay: 1, key: 'st-yard:1', label: DOORS[1].label, visible: true }],
    periods: [{ weekday: 1, on_date: null, start: '07:00', end: '09:00' }, { weekday: 5, on_date: null, start: '08:00', end: '12:00' }] },
  { id: 'r-delivery', name: 'קבלת סחורה חד־פעמית', kind: 'once', state: 'draft', calendar_policy: 'skip_holidays', notes: '', revision: 1, updated_at: '2026-11-01T08:00:00Z',
    approved: false, manageable: true, doors: [{ station_id: 'st-dock', relay: 1, key: 'st-dock:1', label: DOORS[2].label, visible: true }, { station_id: 'st-dock', relay: 2, key: 'st-dock:2', label: DOORS[3].label, visible: true }],
    periods: [{ weekday: null, on_date: '2026-11-05', start: '13:00', end: '15:00' }] },
];

function occurrences(o: DoorwinOptions) {
  const tier = o.tier ?? 'program';
  const base = { zone: TZ, tier, retries: 0, unconfirmed_at: null, last_reason: null, resolution: null, resolved_at: null };
  const list: Record<string, unknown>[] = [
    { ...base, id: 'o1', door: 'st-lobby:1', label: DOORS[0].label, rule_id: 'r-morning', rule_name: RULES[0].name, start_at: '2026-11-02T06:00:00Z', end_at: '2026-11-02T09:00:00Z',
      state: tier === 'prepared' ? 'prepared' : 'active' },
    ...[3, 4, 5].map((d, i) => ({ ...base, id: `o1-${d}`, door: 'st-lobby:1', label: DOORS[0].label, rule_id: 'r-morning', rule_name: RULES[0].name,
      start_at: `2026-11-0${d}T06:00:00Z`, end_at: `2026-11-0${d}T09:00:00Z`, state: tier === 'prepared' ? 'prepared' : i < 3 ? 'armed' : 'armed' })),
    { ...base, id: 'o3', door: 'st-yard:1', label: DOORS[1].label, rule_id: 'r-yard', rule_name: RULES[1].name, start_at: '2026-11-06T06:00:00Z', end_at: '2026-11-06T10:00:00Z',
      state: tier === 'prepared' ? 'prepared' : 'armed' },
  ];
  if (o.alarm) {
    list.push({ ...base, id: 'o2', door: 'st-yard:1', label: DOORS[1].label, rule_id: 'r-yard', rule_name: RULES[1].name, start_at: '2026-11-02T05:00:00Z', end_at: '2026-11-02T07:00:00Z',
                state: 'relock_unconfirmed', retries: 2, unconfirmed_at: '2026-11-02T07:02:00Z', last_reason: 'engine_status' });
  }
  return list;
}

function incident(kind: 'lock_secure' | 'open', drill: boolean, results: string[], state = 'in_effect_partial') {
  const doors = DOORS.map((d, i) => ({ door: d.key, label: d.label, phase: 'apply', state: results[i] ?? 'acknowledged', attempts: results[i] === 'unknown' ? 3 : 1, code: null }));
  const ok = doors.filter((d) => d.state === 'acknowledged').length;
  return { id: drill ? 'inc-drill' : 'inc-1', kind, kind_label: kind === 'open' ? 'פתיחת כל הדלתות' : 'נעילת כל הדלתות', drill, state: ok === doors.length ? 'in_effect' : state,
           scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', requested_at: '2026-11-02T07:08:00Z', released_at: null, reason: '',
           counts: { total: doors.length, ok, failed: doors.filter((d) => d.state === 'refused').length, unknown: doors.filter((d) => d.state === 'unknown').length },
           first_sent_ms: 40, last_sent_ms: 180, superseded_by: null, can_release: true, doors };
}

export interface DoorwinMock {
  posts: { path: string; body: Record<string, unknown> }[];
}

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

export async function installDoorwinMock(page: Page, o: DoorwinOptions = {}): Promise<DoorwinMock> {
  await installAccessMock(page, { persona: o.persona ?? 'admin', settings: { 'doors.ui.tab': 'on', ...(o.settings ?? {}) } });
  const mock: DoorwinMock = { posts: [] };
  const em = { enabled: false, lock: true, open: true, openEnabled: false, active: null as 'lock' | 'drill' | null, ...(o.emergency ?? {}) };
  let active: ReturnType<typeof incident> | null = em.active === 'lock' ? incident('lock_secure', false, ['acknowledged', 'acknowledged', 'refused', 'unknown']) : null;
  let drillInc: ReturnType<typeof incident> | null = em.active === 'drill' ? incident('lock_secure', true, []) : null;
  let prepared: { kind: 'lock_secure' | 'open'; drill: boolean } | null = null;
  await page.route('**/api/v1/doors/**', async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const p = u.pathname.replace(/^.*\/api\/v1\//, '');
    const body = req.method() === 'GET' ? {} : (req.postDataJSON() as Record<string, unknown>) ?? {};
    if (req.method() !== 'GET') mock.posts.push({ path: p, body });
    if (p === 'doors/windows/state') {
      return json(route, {
        enabled: o.enabled ?? true, tier: o.tier ?? 'program', go_live_permitted: false,
        settings: { enabled: o.enabled === false ? 'off' : 'on', max_hours: '4', max_per_day_per_door: '3', quiet_from: '22:00', quiet_to: '06:00', relock_grace_s: '120',
                    relock_retries: '3', reraise_min: '15', exterior_allowed: 'false' },
        can: o.can ?? { manage: true, cancel: true, configure: true },
        doors: DOORS.map((d) => ({ ...d, manage: o.can?.manage ?? true, cancel: o.can?.cancel ?? true, exterior: d.key === 'st-dock:2' })),
        rules: o.can && !o.can.manage ? RULES.map((r) => ({ ...r, manageable: false })) : RULES, occurrences: occurrences(o), now: DWNOW.toISOString().replace('.000', ''),
      });
    }
    if (p === 'doors/windows/rules/preview') {
      return json(route, { tier: o.tier ?? 'program', doors: [{ door: 'st-lobby:1', label: DOORS[0].label, zone: TZ, errors: [],
        occurrences: [2, 3, 4, 5].map((d) => ({ start_at: `2026-11-0${d}T06:00:00Z`, end_at: `2026-11-0${d}T09:00:00Z`, token: `2026-11-0${d}/08:00/11:00` })) }] });
    }
    if (p === 'doors/windows/rules' || /^doors\/windows\/rules\/[^/]+(\/(enable|pause|retire))?$/.test(p) || /occurrences\/[^/]+\/(end-now|confirm-closed)$/.test(p)) {
      return json(route, { rule: RULES[0], occurrence: occurrences(o)[0] }, req.method() === 'POST' && p === 'doors/windows/rules' ? 201 : 200);
    }
    if (p === 'doors/windows/settings') {
      return json(route, { settings: { 'doors.windows.enabled': o.enabled === false ? 'off' : 'on', 'doors.windows.max_hours': '4', 'doors.windows.max_per_day_per_door': '3',
        'doors.windows.quiet_from': '22:00', 'doors.windows.quiet_to': '06:00', 'doors.windows.relock_grace_s': '120', 'doors.windows.relock_retries': '3',
        'doors.windows.reraise_min': '15', 'doors.windows.exterior_allowed': 'false' }, go_live_permitted: !!o.programsLive, program_engine_built: !!o.programsLive, changed: [] });
    }
    if (p === 'doors/emergency/settings') {
      return json(route, { settings: { 'doors.emergency.enabled': em.enabled ? 'on' : 'off', 'doors.emergency.open_enabled': 'off', 'doors.emergency.automations': 'off',
        'doors.emergency.hold_ms': '1500', 'doors.emergency.engine_switch': 'on', go_live_permitted: false, build_ready: false, open_available: false, attested: false,
        attestation: { version: 1, text: 'פתיחת חירום ונעילת חירום פועלות על חומרת דלתות שהתנהגותה אינה ידועה למערכת. (טקסט לדוגמה)' } } });
    }
    if (p === 'doors/emergency/state') {
      return json(route, { enabled: em.enabled, open_enabled: em.openEnabled, hold_ms: 1500, can: { lock: em.lock, open: em.open }, active, drill: drillInc,
        scopes: { lock_secure: em.lock ? [{ scope_type: 'installation', scope_id: '*', name: 'כל ההתקנה', doors: 4 }, { scope_type: 'site', scope_id: 'site-a', name: 'מתחם צפון', doors: 2 }] : [],
                  open: em.open ? [{ scope_type: 'installation', scope_id: '*', name: 'כל ההתקנה', doors: 4 }] : [] },
        recent: [] });
    }
    if (p === 'doors/emergency/prepare') {
      prepared = { kind: (body.kind as 'lock_secure' | 'open') ?? 'lock_secure', drill: !!body.drill };
      return json(route, { confirm_token: 'tok_SAMPLE_not_a_secret_0123456789', expires_at: new Date(Date.now() + 20_000).toISOString(), doors: body.scope_type === 'site' ? 2 : 4,
        kind: prepared.kind, action: body.action ?? 'start', drill: prepared.drill, scope_type: body.scope_type ?? 'installation', scope_id: body.scope_id ?? '*',
        scope_name: body.scope_type === 'site' ? 'מתחם צפון' : 'כל ההתקנה' });
    }
    if (p === 'doors/emergency/incidents') {
      const inc = incident(prepared?.kind ?? 'lock_secure', prepared?.drill ?? true, o.results ?? ['acknowledged', 'acknowledged', 'refused', 'unknown']);
      if (inc.drill) drillInc = inc;
      else active = inc;
      return json(route, { incident: inc }, 201);
    }
    if (/^doors\/emergency\/incidents\/[^/]+\/release$/.test(p)) {
      const released = { ...(active ?? drillInc)!, state: 'released' };
      if (active && p.includes(active.id)) active = null;
      else drillInc = null;
      return json(route, { incident: released });
    }
    if (/^doors\/emergency\/incidents\/[^/]+$/.test(p)) return json(route, { incident: active ?? drillInc });
    return json(route, { code: 'not_found', user_message: 'not found' }, 404);
  });
  return mock;
}
