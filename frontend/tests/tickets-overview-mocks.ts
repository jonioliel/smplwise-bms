import type { Page, Route } from '@playwright/test';
import { installBoardMock, type BoardMock } from './tickets-board-mocks';

// OVERVIEWFIT-297: the mock layer of the manager overview (`#/tickets/overview`) for the layout guards - the board's mock layer plus the
// overview's extra reads (vendors, handled counts, requests for quotation, the summary route and the payments board), invented data only.
// `worst: true` is the worst case a manager can meet: 25 departments with long names, 8x the board's requests (long titles), 30 handler
// rows, 15 approvals of each kind, 20 requests for quotation and 15 instalments of each kind. The board's answer is inflated in the page
// (a fetch wrapper) because the board mock builds it from its own fixture.

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const NOW = Date.parse('2026-10-05T09:00:00Z');
const at = (h: number) => new Date(NOW + h * 3_600_000).toISOString().replace(/\.\d+Z$/, 'Z');
const day = (d: number) => new Date(NOW + d * 86_400_000).toISOString().slice(0, 10);
const LONG = 'החלפת יחידת מיזוג מרכזית בקומת הכניסה כולל פירוק הצנרת הישנה ובדיקת לחץ';
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

function summary(dept: string | null, worst: boolean) {
  const first = new Date(NOW - 13 * 86_400_000);
  const days = range(14).map((i) => ({ date: new Date(first.getTime() + i * 86_400_000).toISOString().slice(0, 10), opened: worst ? 40 + i : (i * 3) % 7, closed: worst ? 35 + i : (i * 2) % 6 }));
  const names = worst ? range(30).map((i) => [`user:w-${i}`, i % 4 ? 'user' : 'contact', `${i % 4 ? 'עובד' : 'ספק'} ${i + 1} ${LONG.slice(0, 30)}`] as const)
    : ([['user:a-2', 'user', 'יוסי מזרחי'], ['user:a-3', 'user', 'רונית לוי'], ['contact:a-1', 'contact', 'קליימה-טק מיזוג אוויר']] as const);
  const rows = names.map(([key, kind, name], i) => ({ key, kind, name, done: 11 - (i % 9), closed: 9 - (i % 7), returned: i % 2, median_seconds: 100800 + i * 3600 }));
  const sum = (k: 'done' | 'closed' | 'returned') => rows.reduce((s, r) => s + r[k], 0);
  const appr = (n: number, kind: string) => ({ count: n, items: range(n).map((i) => ({ id: `${kind}${i}`, ticket: { id: `t${String(i).padStart(15, '0')}`, number: 1000 + i, title: worst ? LONG : 'מזגן לא מקרר - חדר 102' },
    rfq: { id: `r${i}`, number: i, ref: `RFQ-${i}`, title: worst ? LONG : 'צביעת חדר המדרגות' }, department_id: 'dept-maintenance', vendor: worst ? `ספק ${LONG.slice(0, 40)}` : 'קליימה-טק', since: at(-24 - i), amount_minor: 99999999 + i, currency: 'ILS' })) });
  const rfqItems = range(worst ? 20 : 3).map((i) => ({ id: `r${i}`, number: i, ref: `RFQ-${i}`, title: worst ? LONG : `בקשה ${i + 1}`, department: { id: 'dept-maintenance', name: 'אחזקה' },
    state: 'collecting', stage: i % 2 ? 'decide' : 'questions', due_at: at(20 - i * 5), work_from: null, invited: 4, quoted: 3, declined: 0, questions: i % 2 }));
  const deptRows = worst ? range(25).map((i) => ({ id: `dept-w${i}`, name: `מחלקת ${LONG.slice(0, 24)} ${i + 1}`, open: 200 + i, stuck: 30 + i, overdue: 12 + i, waiting: 9, done_7d: 150, busy_handlers: 7 }))
    : [{ id: 'dept-maintenance', name: 'אחזקה', open: 24, stuck: 7, overdue: 4, waiting: 3, done_7d: 19, busy_handlers: 2 }, { id: 'dept-cleaning', name: 'ניקיון', open: 9, stuck: 2, overdue: 1, waiting: 1, done_7d: 11, busy_handlers: 0 }];
  return {
    period: '7d', days: 7, since: at(-168), now: at(0), department_id: dept,
    throughput: { rows, total: { done: sum('done'), closed: sum('closed'), returned: sum('returned'), median_seconds: 129600 } },
    daily: { days, net: days.reduce((s, d) => s + d.opened - d.closed, 0), since: first.toISOString() },
    approvals: { quotes: appr(worst ? 15 : 2, 'q'), claims: appr(worst ? 15 : 1, 'c'), second: appr(worst ? 15 : 1, 'w') },
    rfqs: { count: rfqItems.length, decide: Math.ceil(rfqItems.length / 2), questions: Math.floor(rfqItems.length / 2), items: rfqItems },
    departments: dept ? null : deptRows, all_departments: true, truncated: false, generated_at: at(0),
  };
}

function payments(dept: string | null, worst: boolean) {
  const inst = (i: number, days: number) => ({ id: `aw${i}:${i}`, kind: 'instalment', award_id: `aw${i}`, index: i, instalment_kind: i % 2 ? 'progress' : 'advance', rfq: { id: `r${i}`, number: i, ref: `RFQ-${i}`, title: worst ? LONG : 'צביעת חדר המדרגות' },
    department_id: 'dept-maintenance', vendor: worst ? `ספק ${LONG.slice(0, 40)}` : 'צבעי הגליל', due_date: day(days), days, demand: 'none', moved: false, amount_minor: 188000 + i, currency: 'ILS' });
  const n = worst ? 15 : 2;
  return {
    schedule_on: true, today: day(0), department_id: dept,
    overdue: { count: n, items: range(n).map((i) => inst(i, -1 - i)) },
    upcoming: { count: n, tomorrow: 1, items: range(n).map((i) => inst(100 + i, 1 + i)) },
    claims: { count: 0, items: [] },
    generated_at: at(0),
  };
}

export async function installOverviewMock(page: Page, o: { worst?: boolean } = {}): Promise<BoardMock> {
  const worst = !!o.worst;
  const mock = await installBoardMock(page, { extraPerms: ['tickets.costs.view', 'tickets.costs'] });
  await page.route('**/api/v1/tickets/contacts**', (route) => json(route, { contacts: [{ id: 'a-1', kind: 'vendor', name: 'קליימה-טק מיזוג אוויר', company: 'קליימה-טק' }] }));
  await page.route('**/api/v1/tickets/handler-load**', (route) => json(route, { days: 7, default_days: 7, since: at(-168), now: at(0), handled: { 'user:a-2': 3 }, truncated: false }));
  await page.route((u) => u.pathname.endsWith('/api/v1/tickets/rfqs'), (route) => json(route, { items: [], next_cursor: null }));
  await page.route('**/api/v1/tickets/costs/claims**', (route) => json(route, { rows: [] }));
  await page.route('**/api/v1/tickets/dashboard**', (route) => {
    const u = new URL(route.request().url());
    const dept = u.searchParams.get('department_id');
    return json(route, u.pathname.endsWith('/dashboard/payments') ? payments(dept, worst) : summary(dept, worst));
  });
  if (worst) {
    await page.addInitScript((long) => {
      // init scripts stay for the page's life (a guard re-opens the screen per skin): wrap fetch once
      const w = window as unknown as { __swOverviewWorst?: boolean };
      if (w.__swOverviewWorst) return;
      w.__swOverviewWorst = true;
      const orig = window.fetch.bind(window);
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const res = await orig(input, init);
        const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (!/\/api\/v1\/tickets\/board(\?|$)/.test(href) || !res.ok) return res;
        const b = (await res.clone().json()) as { items: Record<string, unknown>[]; departments: { id: string; name: string; count: number; mine: boolean }[] };
        const items: Record<string, unknown>[] = [];
        for (let k = 0; k < 8; k++) for (const x of b.items) items.push({ ...x, id: `${String(x.id)}${k ? `-${k}` : ''}`, title: k ? `${long} ${k}` : x.title });
        b.items = items;
        for (let i = 0; i < 22; i++) b.departments.push({ id: `dept-w${i}`, name: `מחלקת ${long.slice(0, 24)} ${i + 1}`, count: 200 + i, mine: false });
        return new Response(JSON.stringify(b), { status: res.status, headers: { 'content-type': 'application/json' } });
      };
    }, LONG);
  }
  return mock;
}
