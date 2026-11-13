import type { Page, Route } from '@playwright/test';
import { mockHome, type HomeMock } from './home-simple-mocks';

// HOME-V3-P2-2431: the mock layer of the family and building screens, on top of home-simple-mocks (registered after it, so these routes
// win). Invented household and building data in the wire shapes of routers/home_family.py and the calendar / notice-board routes; every
// write is recorded in `calls` and answered as accepted. Nothing is sent anywhere.

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const at = (minsFromNow: number) => new Date(Date.now() + minsFromNow * 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');

export interface P2Opts {
  features?: Record<string, unknown>;
  modules?: string[] | null;
  kiosk?: boolean;
  worst?: boolean;
  empty?: boolean;
  policy?: Record<string, unknown>;
}

export const FEATURES = {
  presence: { on: true, can: true }, calendar: { on: true, view: true, book: true }, notices: { on: true, can: true }, transit: { on: true },
  tickets: { on: true, create: true, view: true }, schedules: { on: true, view: true, manage: true }, scenes: { capture: true }, weather: true, notif: { phones: 1 },
};

export async function mockP2(page: Page, o: P2Opts = {}): Promise<HomeMock> {
  const policy = { ...(o.kiosk ? { kiosk: true, home_only: true, may_switch: false, kiosk_area_id: 'living' } : {}), ...(o.modules !== undefined ? { modules: o.modules } : {}), ...o.policy };
  const mock = await mockHome(page, { policy, layout: { welcomed: true }, perms: ['devices.read', 'devices.control', 'video.live', 'map.read', 'scene.manage', 'presence.report', 'calendar.view', 'calendar.book'] });
  const rec = (r: Route) => { const u = new URL(r.request().url()); mock.calls.push({ method: r.request().method(), path: u.pathname.replace(/^.*api\/v1\//, ''), body: r.request().postDataJSON?.() ?? null }); };
  const features = { ...FEATURES, ...(o.features ?? {}) };
  const long = 'שם ארוך מאוד של אדם שמשתמש בשם מלא עם שם משפחה כפול ועוד כינוי';
  const people = o.empty ? [] : [
    { user_id: 'dev-noa', name: 'נועה', me: true, home: true, at: at(-150) },
    { user_id: 'dev-yon', name: o.worst ? long : 'יונתן', me: false, home: true, at: at(-67) },
    { user_id: 'dev-maya', name: 'מאיה', me: false, home: true, at: at(-357) },
    { user_id: 'dev-yuval', name: 'יובל', me: false, home: false, at: at(-202) },
    ...(o.worst ? Array.from({ length: 9 }, (_, i) => ({ user_id: `dev-x${i}`, name: `אורח ${i + 1}`, me: false, home: i % 2 === 0, at: at(-30 * i) })) : []),
  ];
  let hidden = false;
  await page.route('**/api/v1/home/family', (r) => json(r, { features, modules: o.modules ?? null, kiosk: !!o.kiosk }));
  await page.route('**/api/v1/home/presence', (r) => json(r, { enabled: true, me_hidden: hidden, people, home_count: people.filter((p) => p.home && !(p.me && hidden)).length }));
  await page.route('**/api/v1/home/presence/me', (r) => { rec(r); hidden = (r.request().postDataJSON() as { hidden: boolean }).hidden; return json(r, { hidden }); });
  // calendar
  const cals = [
    { id: 'cal-fam', name: 'משפחה', type: 'event', my_role: 'book' }, { id: 'cal-kids', name: 'ילדים', type: 'team', my_role: 'book' },
    { id: 'room-club', name: 'מועדון דיירים', type: 'room', my_role: 'book' }, { id: 'room-roof', name: 'פינת מנגל בגג', type: 'room', my_role: 'book' },
  ];
  const ev = (id: string, cal: string, title: string, from: number, len: number, who = 'נועה') => ({
    occurrence_id: id, event_id: id, calendar_id: cal, room_calendar_ids: [], start: at(from), end: at(from + len), state: 'confirmed', kind: 'event', title, organizer: { id: 'x', name: who }, revision: 'r1', all_day: false,
  });
  const events = o.empty ? [] : [ev('e1', 'cal-fam', 'ארוחת ערב אצל חברים', 30, 150), ev('e2', 'cal-kids', 'חוג שחייה', 90, 60, 'מאיה'), ev('e3', 'cal-fam', o.worst ? 'אירוע עם שם ארוך מאוד שלא נגמר אף פעם ומתפרס על כמה שורות בכרטיס' : 'הסעה לבית הספר', 24 * 60, 30),
    ...(o.worst ? Array.from({ length: 12 }, (_, i) => ev(`w${i}`, 'cal-fam', `אירוע ${i + 1}`, 60 + i * 10, 30)) : [])];
  await page.route('**/api/v1/calendar/calendars', (r) => json(r, { calendars: cals }));
  await page.route('**/api/v1/calendar/occurrences?**', (r) => json(r, { occurrences: events }));
  await page.route('**/api/v1/calendar/rooms/day?**', (r) => json(r, { rooms: o.empty ? [] : [
    { calendar_id: 'room-club', name: 'מועדון דיירים', capacity: 20, open: [{ from: '08:00', to: '22:00' }], entries: [] },
    { calendar_id: 'room-roof', name: 'פינת מנגל בגג', capacity: 12, open: [{ from: '08:00', to: '22:00' }], entries: [{ ...ev('b0', 'room-roof', 'תפוס', -30, 120), title: null }] },
  ] }));
  await page.route('**/api/v1/me/calendar?**', (r) => json(r, { occurrences: o.empty ? [] : [{ ...ev('b1', 'room-club', 'הזמנה', 3 * 24 * 60, 180) }], pending: o.empty ? [] : [{ event_id: 'b2', title: 'הזמנה', start: at(9 * 24 * 60), end: at(9 * 24 * 60 + 180), calendar_id: 'room-roof' }] }));
  await page.route('**/api/v1/calendar/events', (r) => { rec(r); return json(r, { event: { id: 'new1' }, state: (r.request().postDataJSON() as { kind: string }).kind === 'booking' ? 'pending' : 'confirmed' }, 201); });
  await page.route('**/api/v1/calendar/events/*/cancel', (r) => { rec(r); return json(r, {}); });
  await page.route('**/api/v1/calendar/events/*/withdraw', (r) => { rec(r); return json(r, {}); });
  // notices and buses
  const body = 'ביום חמישי בין 09:00 ל-13:00 תהיה הפסקת מים בכל הבניין בגלל החלפת משאבה. מומלץ למלא מים מראש. המעליות יפעלו כרגיל.';
  const notices = o.empty ? [] : [
    { id: 'n1', title: 'הפסקת מים ביום חמישי', body: o.worst ? Array.from({ length: 40 }, () => body).join('\n') : body, severity: 'important', pinned: true, read: false, starts_at: at(-200), ends_at: null, published_at: at(-200), when_text: null },
    { id: 'n2', title: 'ניקיון חניון ביום ראשון', body: 'ביום ראשון בין 08:00 ל-11:00 ינוקה החניון.', severity: 'info', pinned: false, read: false, starts_at: at(-1500), ends_at: null, published_at: at(-1500), when_text: null },
    { id: 'n3', title: 'מסיבת חנוכה בלובי', body: 'כולם מוזמנים.', severity: 'info', pinned: false, read: true, starts_at: at(-3000), ends_at: null, published_at: at(-3000), when_text: null },
  ];
  await page.route('**/api/v1/notices', (r) => json(r, { notices }));
  await page.route('**/api/v1/notices/*/read', (r) => { rec(r); return json(r, { read: true }); });
  await page.route('**/api/v1/home/buses', (r) => json(r, { state: 'fresh', updated_hm: '19:40', items: [{ line: '18', dest: 'לתחנה המרכזית', hm: '19:46', mins: 4 }, { line: '72', dest: 'לקניון', hm: '19:53', mins: 11 }] }));
  // weather
  await page.route('**/api/v1/home/weather', (r) => json(r, { weather: o.empty ? null : {
    now: { t: 22, condition: 'sun', text: 'בהיר', feels: 23, wind: 12, wind_unit: 'km/h', humidity: 40, rain: 0 },
    hours: ['20:00', '21:00', '22:00', '23:00', '00:00', '01:00'].map((h, i) => ({ at: h, t: 21 - i, condition: i < 3 ? 'night' : 'cloud' })),
    days: Array.from({ length: 5 }, (_, i) => ({ date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date(Date.now() + i * 86_400_000)) /* HOME-V3-FOLLOWUP-A-2431: the installation's date, not UTC's (00:00-02:00 lost a day) */, t: 24 - i, lo: 15 - i, condition: i === 2 ? 'rain' : 'sun' })),
  } }));
  // tickets
  const tk = (id: string, title: string, step: number, status: string, place: string) => ({ id, number: id, title, excerpt: '', status, step, category: { id: 'c1', name: 'אינסטלציה' }, place_text: place, created_at: at(-100), last_activity_at: at(-50), eta_at: null, waiting_on: null, closed_at: null, department: 'אחזקה' });
  await page.route('**/api/v1/home/tickets?**', (r) => json(r, { items: o.empty ? [] : [tk('t1', 'נזילה מהברז במטבח', 1, 'in_progress', 'מטבח'), tk('t2', 'נורה שרופה בחדר המדרגות', 0, 'new', 'קומה 3'), tk('t3', 'מזגן לא מקרר', 2, 'closed', 'סלון')],
    categories: [{ department_id: 'd1', category_id: 'c1', name: 'אינסטלציה' }, { department_id: 'd1', category_id: 'c2', name: 'חשמל' }, { department_id: 'd1', category_id: 'c3', name: 'מיזוג' }], can_create: true, can_view: true }));
  await page.route('**/api/v1/home/tickets', (r) => { rec(r); return json(r, { id: 't9' }, 201); });
  await page.route('**/api/v1/home/tickets/*/notes', (r) => { rec(r); return json(r, { ticket: {} }, 201); });
  // schedules
  const sch = (id: string, name: string, scene: string, time: string, enabled: boolean, days: string[] | null) => ({ id, name, enabled, scene, days: days ? { kind: 'days', days } : { kind: 'daily', days: null }, slots: [{ start: { kind: 'fixed', time } }], next_run: null, can: {} });
  await page.route('**/api/v1/home/schedules', (r) => {
    if (r.request().method() === 'POST') { rec(r); return json(r, { op_id: 'x' }, 201); }
    return json(r, { items: o.empty ? [] : [sch('s1', 'בוקר טוב', 'scene.morning', '06:45', true, ['sun', 'mon', 'tue', 'wed', 'thu']), sch('s2', 'לילה טוב', 'scene.night', '23:30', true, null), sch('s3', 'ערב', 'scene.evening', '19:00', false, ['fri'])], can_create: true });
  });
  await page.route('**/api/v1/home/schedules/*/*', (r) => { rec(r); return json(r, { op_id: 'x' }); });
  // notifications
  let notify = { phones: 2, dnd: { enabled: false, start: '22:00', end: '07:00' }, dnd_pass: ['doors', 'safety', 'security'], categories: [
    { id: 'doors', name: 'דלתות ואינטרקום', critical: false, on: true, partly: false }, { id: 'security', name: 'אזעקה וכניסות', critical: false, on: true, partly: false },
    { id: 'tickets', name: 'עדכון בפנייה שלי', critical: false, on: true, partly: false }, { id: 'building', name: 'הודעות חדשות בלוח', critical: false, on: true, partly: false },
    { id: 'alerts', name: 'התראות מהבית', critical: false, on: false, partly: false }, { id: 'safety', name: 'בטיחות', critical: true, on: true, partly: false },
  ] };
  await page.route('**/api/v1/home/notify', (r) => {
    if (r.request().method() === 'PUT') {
      rec(r);
      const b = r.request().postDataJSON() as { muted?: string[]; dnd?: Record<string, unknown> };
      if (b.muted) notify = { ...notify, categories: notify.categories.map((c) => ({ ...c, on: !b.muted!.includes(c.id) })) };
      if (b.dnd) notify = { ...notify, dnd: { ...notify.dnd, ...b.dnd } };
    }
    return json(r, notify);
  });
  // a new scene
  await page.route('**/api/v1/automations/scene/capture', (r) => { rec(r); return json(r, { members: [{ entity_id: 'light.l_main', state: 'on', attributes: {} }], skipped: [] }); });
  await page.route('**/api/v1/automations/scene', (r) => { rec(r); return json(r, { item: { id: 'new' }, op_id: 'x' }, 201); });
  return mock;
}
