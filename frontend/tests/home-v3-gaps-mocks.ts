import type { Page, Route } from '@playwright/test';
import type { HomeMock } from './home-simple-mocks';
import { FEATURES } from './home-v3-p2-mocks';
import { mockP3, P3_PERMS, type P3Opts } from './home-v3p3-mocks';

// HOME-V3-GAPS-2436: the mock layer of the gap specs - phase 3's (water, systems, the overview with every category) plus what the gaps
// read: the family feature map and the tickets (phase 2's wire shapes), the person's alarm code state, the diary's events and the alarm
// changes (GET /home/alarm-log). Every stamp is relative to `now` (default: the real clock), never to an hour of the day, so a run at
// any time draws the same rows. Every write is recorded in `calls`; nothing is sent anywhere.

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

export interface GapOpts extends P3Opts {
  now?: number;
  tickets?: boolean;
  alarmLog?: 'demo' | 'empty';
}

export const GAP_PERMS = [...P3_PERMS, 'alarm.arm', 'alarm.disarm', 'events.read', 'access.read', 'video.playback'];

export async function mockGaps(page: Page, o: GapOpts = {}): Promise<HomeMock> {
  const now = o.now ?? Date.now();
  const at = (minsAgo: number) => new Date(now - minsAgo * 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const mock = await mockP3(page, { perms: GAP_PERMS, ...o });
  const rec = (r: Route) => { const u = new URL(r.request().url()); mock.calls.push({ method: r.request().method(), path: u.pathname.replace(/^.*api\/v1\//, ''), body: r.request().postDataJSON?.() ?? null }); };
  const features = { ...FEATURES, tickets: { on: o.tickets !== false, create: o.tickets !== false, view: o.tickets !== false } };
  await page.route('**/api/v1/home/family', (r) => json(r, { features, modules: null, kiosk: false }));
  await page.route('**/api/v1/home/tickets?**', (r) => (o.tickets === false ? json(r, { code: 'feature_disabled' }, 404) : json(r, { items: [],
    categories: [{ department_id: 'd1', category_id: 'c2', name: 'חשמל' }, { department_id: 'd1', category_id: 'c1', name: 'אינסטלציה' }, { department_id: 'd1', category_id: 'c3', name: 'תחזוקה כללית' }], can_create: true, can_view: true })));
  await page.route('**/api/v1/home/tickets', (r) => { rec(r); return json(r, { id: 't9' }, 201); });
  await page.route('**/api/v1/home/notify', (r) => json(r, { phones: 1, dnd: { enabled: true, start: '22:00', end: '07:00' }, dnd_pass: ['doors', 'safety', 'security'], categories: [
    { id: 'doors', name: 'דלתות ואינטרקום', critical: false, on: true, partly: false }, { id: 'security', name: 'אזעקה וכניסות', critical: false, on: true, partly: false },
    { id: 'tickets', name: 'עדכון בפנייה שלי', critical: false, on: true, partly: false }, { id: 'building', name: 'הודעות חדשות בלוח', critical: false, on: true, partly: false },
    { id: 'alerts', name: 'התראות מהבית', critical: false, on: false, partly: false }, { id: 'safety', name: 'בטיחות', critical: true, on: true, partly: false },
  ] }));
  await page.route('**/api/v1/alarm/me', (r) => json(r, { arm_policy: 'no_code', disarm_policy: 'code_required', pin_set: true, pin_set_at: null, code_mode: 'personal_pin' }));
  await page.route('**/api/v1/alarm/me/pin', (r) => { rec(r); return json(r, { pin_set: true, pin_set_at: '' }); });
  const ev = (id: string, type: string, minsAgo: number, cam: string | null) => ({ id, source: 'alertstream', raw_type: '', type, camera_id: cam, camera_name: cam ? 'כניסה לבית' : null, channel: 1, occurred_at: at(minsAgo), ended_at: null, received_at: '', state: 'none', count: 1, severity: 'info', confidence: 'measured', details: {}, acked_at: null, acked_by_username: null });
  await page.route('**/api/v1/events?**', (r) => json(r, { events: [ev('v1', 'person', 20, 'cam1'), ev('v2', 'door', 95, null)], filters: {} }));
  await page.route('**/api/v1/intercom/calls?**', (r) => json(r, { calls: [], next_cursor: null }));
  await page.route('**/api/v1/home/alarm-log', (r) => { rec(r); return json(r, { days: 7, items: o.alarmLog === 'empty' ? [] : [
    { at: at(35), panel: 'alarm_control_panel.house', action: 'arm_home', by: 'נועה', me: true },
    { at: at(60 * 26), panel: 'alarm_control_panel.house', action: 'disarm', by: 'יונתן', me: false },
    { at: at(60 * 30), panel: 'alarm_control_panel.house', action: 'arm_away', by: null, me: false },
  ] }); });
  return mock;
}
