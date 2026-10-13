import type { Page, Route } from '@playwright/test';
import { installTicketsMock, type TicketsMock, type TicketsMockOptions } from './tickets-mocks';

// CR-038 slice 6: the mock layer of the board specs - slice 1's mock (tests/tickets-mocks.ts) plus GET /tickets/board, the board's part of
// PUT /tickets/settings and the personal tree choice of /me/prefs. Fake data only (no real person, phone, address or device). The rows mirror
// mock-up v2's board: four waiting for the manager, one stuck, four in handling, three closed, on two floors of one building.

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const NOW = Date.parse('2026-10-13T10:42:00Z');
const ago = (h: number) => new Date(NOW - h * 3_600_000).toISOString().replace(/\.\d+Z$/, 'Z');

export interface BoardMockOptions extends TicketsMockOptions {
  board?: { board_floors?: 'chips' | 'tree' | 'chips_tree'; grouping?: 'always' | 'no_status_filter' | 'never'; closed_strip?: 'week' | 'all' | 'hidden' };
  treeHidden?: boolean;
  emptyBoard?: boolean;
}
export interface BoardMock extends TicketsMock { prefs: Record<string, unknown> }

const DEPT = { id: 'dept-maintenance', key: 'maintenance', name: 'אחזקה', icon: null, color: null };
const DEPT2 = { id: 'dept-cleaning', key: 'cleaning', name: 'ניקיון', icon: null, color: null };
const DEPT3 = { id: 'dept-hr', key: 'hr', name: 'משאבי אנוש', icon: null, color: null };
const P = {
  urgent: { id: 'p-u', key: 'urgent', name: 'דחופה', rank: 0, severity: 'critical' },
  high: { id: 'p-h', key: 'high', name: 'גבוהה', rank: 1, severity: 'alert' },
  normal: { id: 'p-n', key: 'normal', name: 'רגילה', rank: 2, severity: 'alert' },
  low: { id: 'p-l', key: 'low', name: 'נמוכה', rank: 3, severity: 'info' },
};
type K = keyof typeof P;
interface Spec {
  id: string; n: number; title: string; desc: string; status: string; dept: typeof DEPT; prio: K; hours: number; who: string | null; group: string;
  place: string[]; placeText: string; device?: string; waiting?: string; stuck?: { kind: string; since: number }; auto?: number; closedH?: number;
}
const S: Spec[] = [
  { id: '0000000000000b01', n: 1043, title: 'נזילה מהתקרה בשירותי קומה 2', desc: 'מים מטפטפים מהתקרה מעל הכיור השמאלי. הונח דלי.', status: 'new', dept: DEPT, prio: 'urgent', hours: 72, who: null, group: 'waiting', place: ['building:b', 'floor:f2'], placeText: 'קומה 2 · שירותים', waiting: 'unassigned', stuck: { kind: 'unassigned', since: 25 } },
  { id: '0000000000000b02', n: 1044, title: 'שער החניון לא נסגר', desc: 'השער נשאר פתוח אחרי כל כניסה. נדרש מאבטח ליד השער.', status: 'returned', dept: DEPT, prio: 'urgent', hours: 5, who: null, group: 'waiting', place: ['building:b', 'floor:f-1'], placeText: 'חניון · שער', waiting: 'not_mine' },
  { id: '0000000000000b03', n: 1045, title: 'ריח חריף במטבחון קומה 3', desc: 'כנראה מהמקרר.', status: 'new', dept: DEPT2, prio: 'high', hours: 0.7, who: null, group: 'waiting', place: ['building:b', 'floor:f3'], placeText: 'קומה 3 · מטבחון', waiting: 'unassigned' },
  { id: '0000000000000b04', n: 1046, title: 'החלפת מסנן מזגן - חדר ישיבות', desc: 'טיפול תקופתי.', status: 'done', dept: DEPT, prio: 'low', hours: 20, who: 'קליימה-טק מיזוג אוויר', group: 'waiting', place: ['building:b', 'floor:f1', 'zone:meet'], placeText: 'קומה 1 · חדר ישיבות', waiting: 'done', auto: -40 },
  { id: '0000000000000b05', n: 1040, title: 'אישור עבודה בגובה - צוות אחזקה', desc: 'ציוד ואישורים · K-1040', status: 'acknowledged', dept: DEPT3, prio: 'high', hours: 72, who: 'נועה שחר', group: 'stuck', place: ['building:b', 'floor:f0'], placeText: 'קרקע · קבלה', stuck: { kind: 'stuck', since: 64 } },
  { id: '0000000000000b06', n: 1042, title: 'מזגן לא מקרר - חדר 102', desc: 'מזגן חדר 102 פועל אך הטמפרטורה בחדר לא יורדת מתחת ל-27 מעלות מאז הבוקר.', status: 'waiting_part', dept: DEPT, prio: 'high', hours: 5, who: 'קליימה-טק מיזוג אוויר', group: 'handling', place: ['building:b', 'floor:f1', 'zone:102'], placeText: 'קומה 1 · חדר 102', device: 'מזגן חדר 102' },
  { id: '0000000000000b07', n: 1047, title: 'גנרטור: בדיקת הנעה חודשית לא בוצעה', desc: 'נפתח אוטומטית: בדיקת ההנעה המתוזמנת לא רצה ב-1 באוקטובר.', status: 'in_progress', dept: DEPT, prio: 'normal', hours: 3, who: 'יוסי מזרחי', group: 'handling', place: ['building:b', 'floor:f-1'], placeText: 'חניון · חדר גנרטור' },
  { id: '0000000000000b08', n: 1048, title: 'קליטת עובד חדש - תג כניסה וחניה', desc: 'מתחיל ביום ראשון.', status: 'in_progress', dept: DEPT3, prio: 'normal', hours: 6, who: 'נועה שחר', group: 'handling', place: ['building:b', 'floor:f0'], placeText: 'קרקע · קבלה' },
  { id: '0000000000000b09', n: 1049, title: 'נורה מהבהבת בלובי', desc: 'גוף תאורה שני משמאל לדלפק הקבלה מהבהב.', status: 'acknowledged', dept: DEPT, prio: 'normal', hours: 4, who: 'יוסי מזרחי', group: 'handling', place: ['building:b', 'floor:f0', 'zone:lobby'], placeText: 'קרקע · לובי' },
  { id: '0000000000000b10', n: 1038, title: 'ניקוי חלונות חזית', desc: 'ניקוי רבעוני.', status: 'closed', dept: DEPT2, prio: 'low', hours: 30, who: null, group: 'closed', place: ['building:b', 'floor:f0'], placeText: 'קרקע', closedH: 30 },
  { id: '0000000000000b11', n: 1035, title: 'החלפת סוללות בגלאי עשן', desc: 'קומה 2.', status: 'closed', dept: DEPT, prio: 'normal', hours: 50, who: null, group: 'closed', place: ['building:b', 'floor:f2'], placeText: 'קומה 2', closedH: 50 },
  { id: '0000000000000b12', n: 1031, title: 'תיקון ידית דלת', desc: '', status: 'closed', dept: DEPT, prio: 'low', hours: 200, who: null, group: 'closed', place: ['building:b', 'floor:f1'], placeText: 'קומה 1', closedH: 200 },
];
const TREE = [
  { key: 'building:b', kind: 'building', name: 'בניין ראשי', parent: null },
  { key: 'floor:f-1', kind: 'floor', name: 'חניון', parent: 'building:b', order: -1 },
  { key: 'floor:f0', kind: 'floor', name: 'קרקע', parent: 'building:b', order: 0 },
  { key: 'zone:lobby', kind: 'zone', name: 'לובי', parent: 'floor:f0' },
  { key: 'floor:f1', kind: 'floor', name: 'קומה 1', parent: 'building:b', order: 1 },
  { key: 'zone:102', kind: 'zone', name: 'חדר 102', parent: 'floor:f1' },
  { key: 'zone:meet', kind: 'zone', name: 'חדר ישיבות', parent: 'floor:f1' },
  { key: 'floor:f2', kind: 'floor', name: 'קומה 2', parent: 'building:b', order: 2 },
  { key: 'floor:f3', kind: 'floor', name: 'קומה 3', parent: 'building:b', order: 3 },
];

const WHO = ['קליימה-טק מיזוג אוויר', 'יוסי מזרחי', 'נועה שחר'];
const who = (name: string) => `a-${WHO.indexOf(name) + 1}`;

function item(s: Spec) {
  return {
    id: s.id, number: s.n, title: s.title, excerpt: s.desc, status: s.status, origin: 'manual', department: s.dept, category: null, priority: P[s.prio],
    place_text: s.placeText, device_name: s.device ?? '', created_by: { id: 'u-ronit', name: 'רונית לוי' }, created_at: ago(s.hours + 2), last_activity_at: ago(s.hours),
    assignee: s.who ? { kind: s.who.includes('טק') ? 'contact' : 'user', id: who(s.who), name: s.who, since: ago(s.hours + 1), acknowledged_at: null } : null,
    last_assignee_name: null, eta_at: null, waiting_on: s.group === 'waiting' ? 'manager' : s.group === 'closed' ? 'none' : 'assignee', waiting_reason: s.waiting ?? null,
    reopen_count: 0, external_stale: false, closed_at: s.closedH !== undefined ? ago(s.closedH) : null, revision: 2, view: 'full',
    group: s.group, stuck: s.stuck ? { kind: s.stuck.kind, level: 2, reminders: 2, since: ago(s.stuck.since) } : null,
    sla: s.group === 'closed' ? null : { kind: 'stuck', at: ago(-5), over: false }, place_keys: s.place, assignee_key: s.who ? `${s.who.includes('טק') ? 'contact' : 'user'}:${who(s.who)}` : 'none',
    auto_close_at: s.auto !== undefined ? ago(s.auto) : null, manager: true,
  };
}

export async function installBoardMock(page: Page, o: BoardMockOptions = {}): Promise<BoardMock> {
  const base = await installTicketsMock(page, o);
  const st: BoardMock = { ...base, calls: base.calls, prefs: { 'tickets.board.tree_hidden': o.treeHidden ? 'hidden' : null } };
  let ui = { board_floors: 'tree', grouping: 'no_status_filter', closed_strip: 'all', ...(o.board ?? {}) };
  let urgent = true;
  let revision = 1;
  const persona = o.persona ?? 'manager';
  const rows = o.emptyBoard ? [] : S;
  await page.route('**/api/v1/me/prefs', async (route) => {
    const req = route.request();
    if (req.method() === 'PUT') {
      const b = req.postDataJSON() as Record<string, unknown>;
      Object.assign(st.prefs, b);
      st.calls.push({ method: 'PUT', path: 'me/prefs', body: b });
    }
    return json(route, { prefs: { 'nav.order': [], ...st.prefs }, stored: [], updated_at: null });
  });
  await page.route('**/api/v1/tickets/module', async (route) => {
    const he = o.name ?? { one: 'בקשת שירות', many: 'בקשות שירות', gender: 'f' }; // owner 14.10: the default noun
    const names = { he, en: { one: 'Ticket', many: 'Tickets', gender: '' }, ar: { one: 'بلاغ', many: 'بلاغات', gender: 'm' }, ru: { one: 'Заявка', many: 'Заявки', gender: 'f' } };
    return json(route, { enabled: o.enabled ?? true, public_ready: false, name: names, name_revision: o.name ? 1 : 0,
      ui: { detail: o.ui?.detail ?? 'drawer_fullscreen', new_ticket: o.ui?.new_ticket ?? 'sheet', ...ui } });
  });
  await page.route('**/api/v1/tickets/settings', async (route) => {
    const req = route.request();
    if (req.method() === 'PUT') {
      const b = req.postDataJSON() as { ui?: object; urgent_is_critical?: boolean };
      st.calls.push({ method: 'PUT', path: 'tickets/settings', body: b });
      ui = { ...ui, ...(b.ui ?? {}) };
      if (typeof b.urgent_is_critical === 'boolean') urgent = b.urgent_is_critical;
      revision += 1;
    }
    return json(route, { revision, ui: { detail: o.ui?.detail ?? 'drawer_fullscreen', new_ticket: o.ui?.new_ticket ?? 'sheet', ...ui }, urgent_is_critical: urgent,
      links: { sliding_days: 14, cap_days: 90, grace_hours: 24 }, send_hours: { from: '07:00', to: '21:00' } }); // slice 2's keys
  });
  await page.route('**/api/v1/tickets/board**', async (route) => {
    const url = new URL(route.request().url());
    st.calls.push({ method: 'GET', path: `tickets/board${url.search}`, body: null });
    if (persona !== 'manager' && persona !== 'admin') return json(route, { code: 'forbidden', user_message: 'אין הרשאה', retryable: false, correlation_id: 'mock', details: {} }, 403);
    const state = url.searchParams.get('state') ?? 'all';
    const dept = url.searchParams.get('department_id');
    const place = url.searchParams.get('place');
    const q = (url.searchParams.get('q') ?? '').trim();
    const all = rows.map(item).filter((x) => !q || x.title.includes(q)).filter((x) => !place || x.place_keys.includes(place));
    const inDept = all.filter((x) => !dept || x.department.id === dept);
    const open = inDept.filter((x) => x.group !== 'closed');
    const closed = inDept.filter((x) => x.group === 'closed');
    const week = closed.filter((x) => NOW - Date.parse(x.closed_at as string) < 7 * 24 * 3_600_000);
    const items = state === 'waiting' ? open.filter((x) => x.group === 'waiting') : state === 'stuck' ? open.filter((x) => x.stuck) : state === 'unassigned' ? open.filter((x) => ['new', 'returned'].includes(x.status))
      : state === 'closed' ? (ui.closed_strip === 'week' ? week : closed) : open;
    const openAll = rows.map(item).filter((x) => x.group !== 'closed' && (!q || x.title.includes(q)));
    const tree = TREE.map((n) => ({ order: 0, ...n, count: openAll.filter((x) => x.place_keys.includes(n.key)).length })).filter((n) => n.count > 0);
    const handling = new Map<string, { key: string; kind: string; name: string; count: number; oldest_at: string; last_activity_at: string; eta_at: null; ids: string[] }>();
    for (const x of items.filter((y) => y.group === 'handling')) {
      const h = handling.get(x.assignee_key) ?? { key: x.assignee_key, kind: x.assignee?.kind ?? 'none', name: x.assignee?.name ?? '', count: 0, oldest_at: x.created_at, last_activity_at: x.last_activity_at, eta_at: null, ids: [] };
      h.count += 1;
      h.ids.push(x.id);
      handling.set(x.assignee_key, h);
    }
    const byDept = (d: typeof DEPT) => all.filter((x) => x.group !== 'closed' && x.department.id === d.id).length;
    return json(route, {
      items, closed: state === 'closed' ? [] : ui.closed_strip === 'week' ? week : closed, handling: [...handling.values()],
      counts: { all: open.length, waiting: open.filter((x) => x.group === 'waiting').length, stuck: open.filter((x) => x.stuck).length, unassigned: open.filter((x) => ['new', 'returned'].includes(x.status)).length, closed_week: week.length, closed_all: closed.length },
      departments: [DEPT, DEPT2, DEPT3].map((d) => ({ id: d.id, name: d.name, count: byDept(d), mine: d.id === DEPT.id })), tree, truncated: false, all_departments: true, now: ago(0), ui,
    });
  });
  return st;
}
