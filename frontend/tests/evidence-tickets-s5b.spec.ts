import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKINS, installTicketsMock, url } from './tickets-mocks';

// CR-038 slice 5b evidence: the message channel's screens from the REAL build against the mock layer (fake data only - no real number,
// address, account or person): Settings › the module › "ערוץ הודעות" (the master switch, the accounts read-only, the queue's health) and
// "תבניות הודעה" (D26: the starter, the editor with the server's validation and the live preview), the ticket page's "הודעות" block (D14
// lines, "שלח עכשיו" D29, "שלח שוב", "שלח עדכון") with the link panel's "שלח קישור שוב", the assign dialog's channel / account /
// send-hours lines with "שלח עכשיו", and the unmatched-reply chip with claim-before-reveal (9.6). Desktop 1440 and phone 390, light and
// dark; the channel tab in all five skins. Also asserts what the screens send to the server.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-tickets-s5b.spec.ts --project=desktop --project=mobile --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/tickets-s5b');
const S = 'sw-app system-tickets';
const D = 'sw-app tickets-detail ticket-detail';
const L = 'sw-app tickets-list';
const TID = '0000000000000a03';
const ACCOUNT = 'entry:01JDEMOACCOUNT';
const ACCOUNT_LABEL = 'שירות ····0191';
const VENDOR = 'שערים בע"מ - משה';

type Call = { method: string; path: string; body: unknown };
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const at = (h: number) => new Date(Date.parse('2026-10-13T10:42:00Z') - h * 3_600_000).toISOString().replace(/\.\d+Z$/, 'Z');
const isPhone = (p: Page) => (p.viewportSize()?.width ?? 1440) < 768;

function messages(state: 'held' | 'queued') {
  const base = { not_before: null, attempts: 1, code: null, account: ACCOUNT_LABEL, fallback_of: null, resend_of: null, current: true };
  return [
    { ...base, id: 'ob-3', purpose: 'reminder', channel: 'whatsapp', state, held_reason: state === 'held' ? 'send_hours' : null, not_before: '2026-10-14T04:00:00Z',
      created_at: at(0.5), sent_at: null, attempts: 0, can: { send_now: state === 'held', resend: false } },
    { ...base, id: 'ob-2', purpose: 'update', channel: 'whatsapp', state: 'unknown', held_reason: null, created_at: at(1), sent_at: null, code: 'timeout',
      can: { send_now: false, resend: true } },
    { ...base, id: 'ob-1', purpose: 'assign', channel: 'whatsapp', state: 'sent', held_reason: null, created_at: at(2), sent_at: at(2), can: { send_now: false, resend: false } },
  ];
}

function ticket(o: { held?: boolean; stale?: boolean } = {}) {
  const me = { kind: 'user', name: 'רונית לוי', me: true };
  const sys = { kind: 'system', name: '', me: false };
  const ev = (id: string, h: number, kind: string, extra: Record<string, unknown> = {}) => ({ id, at: at(h), kind, actor: sys, from: null, to: null, body: null, data: {},
    via: 'whatsapp', external: false, ...extra });
  return {
    id: TID, number: 1044, title: 'שער החניון לא נסגר', status: 'assigned', origin: 'manual',
    department: { id: 'dept-maintenance', key: 'maintenance', name: 'אחזקה', icon: null, color: null }, category: { id: 'cat-elec', name: 'חשמל' },
    priority: { id: 'dept-maintenance-urgent', key: 'urgent', name: 'דחופה', rank: 0, severity: 'critical' },
    place_text: 'חניון תת-קרקעי', device_name: '', created_by: { id: 'u-ronit', name: 'רונית לוי' }, created_at: at(28), last_activity_at: at(0.5),
    assignee: { kind: 'contact', id: 'c-gates', name: VENDOR, since: at(2), acknowledged_at: null },
    last_assignee_name: null, eta_at: null, waiting_on: 'assignee', waiting_reason: null, reopen_count: 0, external_stale: o.stale ?? true, closed_at: null,
    revision: 5, view: 'full', description: 'השער נשאר פתוח אחרי כל כניסה. נדרש מאבטח ליד השער.', attachments: [], close_note: null, closed_by_name: null,
    duplicate_of: null, reopen_until: null,
    events: [
      ev('e1', 28, 'created', { actor: me, to: 'new', data: { origin: 'manual' }, via: 'ui' }),
      ev('e2', 2, 'assigned', { actor: me, from: 'new', to: 'assigned', data: { assignee: VENDOR, assignee_kind: 'contact', contact_kind: 'vendor', channel: 'whatsapp' }, via: 'ui' }),
      ev('e3', 2, 'link_sent', { data: { purpose: 'assign', state: 'sent', account: ACCOUNT_LABEL } }),
      ev('e4', 1.5, 'inbound', { actor: { kind: 'inbound', name: VENDOR, me: false }, body: 'מגיע מחר בבוקר עם מנוע חלופי', data: { unverified: true }, external: true }),
      ev('e5', 1, 'message_unknown', { data: { purpose: 'update' } }),
    ],
    can: {
      edit_fields: ['title', 'description', 'category_id', 'priority_id', 'department_id'], assign: true, assign_external: true, note: true, note_external: true,
      attach: true, attach_external: true, eta: true, return: false, manage: true,
    },
    transitions: ['acknowledged', 'in_progress', 'closed', 'cancelled'].map((to) => ({ to, note_required: to === 'cancelled' || to === 'closed' })),
    assignments: [{ id: 'asg-1', kind: 'contact', name: VENDOR, channel: 'whatsapp', assigned_at: at(2), assigned_by_name: 'רונית לוי', acknowledged_at: null, ended_at: null,
      end_reason: null, return_kind: null, return_reason: null }],
    link: { state: 'live', current: true, generation: 1, created_at: at(2), expires_at: at(-24 * 14), cap_at: at(-24 * 90), grace_until: null, revoked_at: null,
      revoked_reason: null, sent_via: 'whatsapp', sent_at: at(2), first_opened_at: null, last_opened_at: null, open_count: 0, devices: 0, update_count: 0,
      require_code: false, code_locked: false, can: { copy: true, new: true, revoke: true, resend: true } },
    messages: messages(o.held === false ? 'queued' : 'held'),
  };
}

const CONTACTS = [
  { kind: 'contact', id: 'c-gates', contact_kind: 'vendor', name: VENDOR, company: 'שערים בע"מ', vendor_name: 'שערים בע"מ', phone: '····0177', has_phone: true,
    has_email: true, preferred_channel: 'whatsapp', require_code: false, share_history: null, lang: 'he' },
  { kind: 'contact', id: 'c-elec', contact_kind: 'person', name: 'דוד החשמלאי', company: '', vendor_name: null, phone: '····0145', has_phone: true, has_email: false,
    preferred_channel: 'whatsapp', require_code: false, share_history: null, lang: 'he' },
];

function preview(contactId: string) {
  const vendor = contactId === 'c-gates';
  return {
    channel: 'whatsapp', lang: 'he',
    text: `שלום ${vendor ? 'משה' : 'דוד'},\nבקשת שירות 1044 (אחזקה): שער החניון לא נסגר\nחניון תת-קרקעי\nלעדכון הטיפול: [קישור]\nלאישור מהיר השב 1 = התקבל, 2 = בטיפול`,
    require_code: false, require_code_locked: false, code_to_contact_phone: false, share_history: { available: false, default: false },
    link: { sliding_days: 14, cap_days: 90, grace_hours: 24, expires_at: at(-24 * 14), cap_at: at(-24 * 90) }, refusals: [],
    send_hours: { window: { from: '07:00', to: '21:00' }, open_now: false, next_opening: '2026-10-14T04:00:00Z', send_now_default: true },
    account: { key: ACCOUNT, label: ACCOUNT_LABEL, state: vendor ? 'connected' : 'disconnected', sendable: vendor },
    fallback: vendor ? 'email' : 'manual',
  };
}

function channelView(enabled: boolean, revision: number) {
  return {
    revision, whatsapp: { enabled, use_buttons: false, reply_window_h: 72 }, email_fallback: true,
    uses: [
      { key: 'tickets.messages', label: 'הודעות', value: ACCOUNT, resolved: ACCOUNT, inherits: null, inherits_label: null, required: true, queued: 1,
        departments: [{ id: 'dept-maintenance', name: 'אחזקה', value: null, resolved: ACCOUNT }, { id: 'dept-cleaning', name: 'ניקיון', value: null, resolved: ACCOUNT }] },
      { key: 'tickets.codes', label: 'קודי אימות', value: null, resolved: ACCOUNT, inherits: 'tickets.messages', inherits_label: 'הודעות', required: false, queued: 0 },
    ],
    accounts: [{ key: ACCOUNT, label: ACCOUNT_LABEL, last4: '0191', state: 'connected', kind: 'discovered', uses: ['tickets.messages'], sends_24h: 7, per_day: 150,
      last_send_at: at(0.2), last_ok_at: at(0.2), shared_outside: false, ticket: true }],
    warnings: [{ code: 'shared_module', severity: 'amber', module: 'אינטרקום', account_key: ACCOUNT }],
    ws_connected: true, email: { configured: true }, inbound: { wanted: enabled }, test_send: { enabled: false },
    health: { worker: { running: true, inbound_wanted: enabled }, outbox: { depth: { 'held:send_hours': 1, queued: 1 }, oldest_open_s: 3600, last_24h: { [ACCOUNT]: { sent: 7 } } },
      inbound: { last_24h: { status: 3, note: 1 }, queue: 0, queue_overflow: 0 } },
    accounts_href: '#/system/messaging-accounts',
  };
}

const STARTERS = {
  assign: { he: 'שלום {name},\n{module_name} {number} ({department}): {title}\n{place}\nלעדכון הטיפול: {link}\nלאישור מהיר השב 1 = התקבל, 2 = בטיפול',
    en: 'Hello {name},\nNew {module_name} #{number} ({department}): {title}\n{place}\nUpdate the handling: {link}\nQuick reply: 1 = received, 2 = in progress' },
  reminder: { he: 'תזכורת: {module_name} {number} ({department}): {title}\nלעדכון הטיפול: {link}' },
  code: { he: 'קוד האימות: {code}\nהקוד בתוקף 10 דקות. אין למסור אותו לאחרים.' },
};

/** The slice-5b routes over slice 1's mock layer (registered after it, so they answer first; anything else falls back to it). */
async function installS5bMock(page: Page, calls: Call[]): Promise<void> {
  let channel = channelView(false, 3);
  let held = true;
  const items: { id: string; department_id: string | null; purpose: string; lang: string; body: string; active: boolean; revision: number; updated_at: string }[] = [];
  await page.route('**/api/v1/tickets/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    const body: unknown = method === 'GET' || method === 'DELETE' ? null : (() => { try { return req.postDataJSON(); } catch { return null; } })();
    const log = () => calls.push({ method, path: p, body });
    if (p === 'tickets/channel') {
      if (method === 'PUT') {
        log();
        const b = body as { whatsapp?: { enabled?: boolean } };
        channel = channelView(b.whatsapp?.enabled ?? channel.whatsapp.enabled, channel.revision + 1);
      }
      return json(route, channel);
    }
    if (p === 'tickets/admin/message-templates' && method === 'GET') {
      return json(route, {
        purposes: ['assign', 'reminder', 'code', 'closed', 'reassigned', 'reopened', 'update'], langs: ['he', 'en', 'ar', 'ru'],
        placeholders: ['name', 'number', 'department', 'title', 'place', 'device', 'priority', 'organization', 'link', 'code', 'manager', 'eta', 'module_name', 'module_name_plural'],
        rules: { link_required: ['assign', 'reminder', 'reopened', 'update'], code_only: ['code'], code_forbidden: ['device', 'link', 'place', 'title'], max_rendered: 1000 },
        items, starters: STARTERS, samples: {}, departments: [{ id: 'dept-maintenance', name: 'אחזקה' }, { id: 'dept-cleaning', name: 'ניקיון' }],
      });
    }
    if (p === 'tickets/admin/message-templates/preview') {
      const b = body as { purpose: string; body: string };
      const problems = ['assign', 'reminder', 'reopened', 'update'].includes(b.purpose) && !b.body.includes('{link}') ? [{ code: 'link_required', field: 'body' }] : [];
      const text = b.body.replace(/\{link\}/g, '[קישור]').replace(/\{number\}/g, '1042').replace(/\{module_name\}/g, 'בקשת שירות').replace(/\{name\}/g, 'דני')
        .replace(/\{department\}/g, 'אחזקה').replace(/\{title\}/g, 'מזגן לא מקרר').replace(/\{place\}/g, 'קומה 1 · חדר 102');
      return json(route, { text, problems, length: text.length, max: 1000 });
    }
    if (p === 'tickets/admin/message-templates' && method === 'POST') {
      log();
      const b = body as { department_id: string | null; purpose: string; lang: string; body: string };
      const row = { id: `mt-${items.length + 1}`, ...b, active: true, revision: 1, updated_at: at(0) };
      items.push(row);
      return json(route, row, 201);
    }
    if (p === 'tickets/inbound') {
      return json(route, { items: [{ id: 'in-1', received_at: at(0.3), sender: VENDOR, claimed: false, claimed_by_me: false, claimed_by_name: null, text: null,
        tickets: [{ id: TID, number: 1044, title: 'שער החניון לא נסגר', status: 'assigned' }, { id: '0000000000000a01', number: 1042, title: 'מזגן לא מקרר - חדר 102', status: 'waiting_part' }] }] });
    }
    if (p === 'tickets/inbound/in-1/claim') {
      log();
      return json(route, { id: 'in-1', received_at: at(0.3), sender: VENDOR, claimed: true, claimed_by_me: true, claimed_by_name: 'רונית לוי', text: 'הגעתי לשער, מחליף את המנוע עכשיו',
        tickets: [{ id: TID, number: 1044, title: 'שער החניון לא נסגר', status: 'assigned' }, { id: '0000000000000a01', number: 1042, title: 'מזגן לא מקרר - חדר 102', status: 'waiting_part' }] });
    }
    if (p === 'tickets/assignees') return json(route, { users: [{ kind: 'user', id: 'u-avi', name: 'אבי כהן', member_role: 'member' }], contacts: CONTACTS, external: true, public_ready: true });
    const m = new RegExp(`^tickets/${TID}(?:/(.+))?$`).exec(p);
    if (m) {
      const sub = m[1] ?? '';
      if (sub === 'assign/preview') return json(route, preview((body as { contact_id: string }).contact_id));
      if (sub && method !== 'GET') log();
      if (/^outbox\/ob-3\/send-now$/.test(sub)) held = false;
      return json(route, ticket({ held, stale: sub !== 'send-update' }));
    }
    return route.fallback();
  });
}

async function go(page: Page, hash: string, scheme: 'light' | 'dark' = 'light', skin = 'classic'): Promise<Call[]> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await installTicketsMock(page, { persona: 'admin' });
  const calls: Call[] = [];
  await installS5bMock(page, calls);
  await page.goto('about:blank');
  await page.goto(url(hash, skin, scheme));
  return calls;
}

async function shot(page: Page, name: string, scheme: 'light' | 'dark' = 'light', skin = 'classic', full = true): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}-${scheme}-${skin}.png`), fullPage: full });
}

const last = (calls: Call[], method: string, re: RegExp) => [...calls].reverse().find((c) => c.method === method && re.test(c.path));

test.describe('tickets message channel evidence (slice 5b)', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
  test.beforeEach(async ({ page }, info) => {
    test.setTimeout(240_000);
    test.skip(info.project.name === 'tablet', 'desktop 1440 and phone 390');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('the channel tab: the master switch (off by default), the accounts read-only, the queue - five skins', async ({ page }) => {
    const C = `${S} tickets-channel-settings`;
    const runs: [string, 'light' | 'dark'][] = isPhone(page) ? [['classic', 'light'], ['classic', 'dark']] : [...SKINS.map((s) => [s, 'light'] as [string, 'light']), ['classic', 'dark']];
    for (const [skin, scheme] of runs) {
      await go(page, '/system/tickets?tab=channel', scheme, skin);
      await page.waitForSelector(`${C} [data-channel-settings]`);
      await shot(page, 'channel', scheme, skin);
    }
    const calls = await go(page, '/system/tickets?tab=channel');
    await page.waitForSelector(`${C} [data-channel-settings]`);
    if (!isPhone(page)) {
      const tabs = page.locator(`${S} [data-tickets-settings-tabs]`);
      await expect(tabs.getByText('ערוץ הודעות', { exact: true })).toBeVisible();
      await expect(tabs.getByText('תבניות הודעה', { exact: true })).toBeVisible();
    }
    await expect(page.locator(`${C} [data-use="tickets.messages"]`)).toContainText(ACCOUNT_LABEL);
    await expect(page.locator(`${C} [data-use="tickets.codes"]`)).toContainText('כמו הודעות');
    await expect(page.locator(`${C} [data-account="${ACCOUNT}"] [data-state="connected"]`)).toBeVisible();
    await expect(page.locator(`${C} [data-warning="shared_module"]`)).toBeVisible();
    await expect(page.locator(`${C} [data-health="listen"]`)).toContainText('כבויה');
    await page.locator(`${C} [data-channel-enabled] button`).click();
    await expect.poll(() => last(calls, 'PUT', /^tickets\/channel$/)?.body).toEqual({ revision: 3, whatsapp: { enabled: true } });
    await expect(page.locator(`${C} [data-health="listen"]`)).toContainText('פעילה');
    await page.locator(`${C} [data-channel-window]`).fill('400');
    await expect(page.locator(`${C} [data-channel-window-save]`)).toHaveAttribute('disabled', '');
  });

  test('message templates: the starter, the editor with the server validation and the live preview, a save', async ({ page }) => {
    const T = `${S} tickets-message-templates`;
    for (const scheme of ['light', 'dark'] as const) {
      await go(page, '/system/tickets?tab=messages', scheme);
      await page.waitForSelector(`${T} [data-message-templates]`);
      await expect(page.locator(`${T} [data-template-text]`)).toContainText('{link}');
      await expect(page.locator(`${T} [data-template-preview]`)).toContainText('[קישור]');
      await shot(page, 'templates', scheme);
    }
    const calls = await go(page, '/system/tickets?tab=messages');
    await page.waitForSelector(`${T} [data-message-templates]`);
    await expect(page.locator(`${T} [data-card="template-editor"]`)).toHaveAttribute('data-template-state', 'starter');
    await page.locator(`${T} [data-template-edit]`).click();
    const area = page.locator(`${T} [data-template-body]`);
    await area.fill('שלום {name}, {module_name} {number}');
    await expect(page.locator(`${T} [data-problem="link_required"]`)).toBeVisible();
    await expect(page.locator(`${T} [data-template-save]`)).toHaveAttribute('disabled', '');
    await area.fill('שלום {name}, {module_name} {number}: {link}');
    await expect(page.locator(`${T} [data-template-problems]`)).toHaveCount(0);
    await expect(page.locator(`${T} [data-template-preview]`)).toContainText('בקשת שירות 1042: [קישור]');
    await shot(page, 'template-edit', 'light', 'classic', false);
    await page.locator(`${T} [data-template-save]`).click();
    await expect.poll(() => last(calls, 'POST', /^tickets\/admin\/message-templates$/)?.body).toEqual({ department_id: null, purpose: 'assign', lang: 'he',
      body: 'שלום {name}, {module_name} {number}: {link}' });
    await expect(page.locator(`${T} [data-card="template-editor"]`)).toHaveAttribute('data-template-state', 'custom');
    // English is its own text (D26): the starter in English, not the Hebrew one
    await page.locator(`${T} [data-template-lang="en"]`).click();
    await expect(page.locator(`${T} [data-template-text]`)).toContainText('Hello {name}');
  });

  test('the ticket page: delivery lines (D14), send now (D29), send again, send update, send the link again', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await go(page, `/tickets/${TID}?tab=conv`, scheme); // TKUI1: the delivery lines live in the Conversation tab
      await page.waitForSelector(`${D} [data-sect="messages"]`);
      await shot(page, 'ticket-messages', scheme);
    }
    const calls = await go(page, `/tickets/${TID}?tab=conv`);
    const M = `${D} [data-sect="messages"]`;
    await page.waitForSelector(M);
    await expect(page.locator(`${M} [data-message="ob-1"] [data-message-line]`)).toContainText('נשלח בוואטסאפ - מסירה לא ידועה');
    await expect(page.locator(`${M} [data-message="ob-2"] [data-message-line]`)).toContainText('ייתכן שנשלח');
    await expect(page.locator(`${M} [data-message="ob-3"] [data-message-line]`)).toContainText('ממתין לשעות השליחה');
    for (const word of ['נמסר', 'נקרא']) await expect(page.locator(M)).not.toContainText(word); // never "delivered" / "read" (D14)
    await expect(page.locator(`${D} [data-timeline]`)).toContainText('תשובה בוואטסאפ (שולח לא מאומת)');
    await page.locator(`${M} [data-message="ob-3"] [data-send-now]`).click();
    await expect.poll(() => last(calls, 'POST', /outbox\/ob-3\/send-now$/)?.path).toBe(`tickets/${TID}/outbox/ob-3/send-now`);
    await expect(page.locator(`${M} [data-message="ob-3"] [data-send-now]`)).toHaveCount(0);
    await page.locator(`${M} [data-message="ob-2"] [data-resend]`).click();
    await expect.poll(() => last(calls, 'POST', /outbox\/ob-2\/resend$/)?.path).toBe(`tickets/${TID}/outbox/ob-2/resend`);
    await page.locator(`${M} [data-send-update]`).click();
    await expect.poll(() => last(calls, 'POST', /send-update$/)?.path).toBe(`tickets/${TID}/send-update`);
    await expect(page.locator(`${M} [data-stale]`)).toHaveCount(0);
    await page.locator(`${D} [role="tab"][data-tab="overview"]`).click(); // the link panel sits under the handler card
    await page.locator(`${D} [data-link-panel] [data-link-resend]`).click();
    await expect.poll(() => last(calls, 'POST', /link\/resend$/)?.path).toBe(`tickets/${TID}/link/resend`);
  });

  test('the assign dialog to an outside contact: channel, account, send hours and "send now"; a disconnected account warns', async ({ page }) => {
    const calls = await go(page, `/tickets/${TID}`);
    await page.waitForSelector(`${D} [data-ticket-page]`);
    await page.locator(`${D} [data-assign]`).first().click();
    await page.locator(`${D} [data-assign-kind="person"]`).click(); // vendors and contacts are one group of the dialog (owner 2026-10-14)
    await page.locator(`${D} [data-contact="c-gates"] input`).check();
    const P = `${D} [data-assign-preview]`;
    await expect(page.locator(`${P} [data-assign-channel="whatsapp"]`)).toContainText(ACCOUNT_LABEL);
    await expect(page.locator(`${P} [data-assign-hours]`)).toContainText('מחוץ לשעות השליחה');
    await expect(page.locator(`${P} [data-assign-send-now]`)).toBeChecked(); // a critical priority preselects it (D29)
    await expect(page.locator(`${P} [data-assign-down]`)).toHaveCount(0);
    await shot(page, 'assign-outside', 'light', 'classic', false);
    await page.locator(`${D} [data-contact="c-elec"] input`).check();
    await expect(page.locator(`${P} [data-assign-down]`)).toContainText('יהיה צריך להעתיק את הקישור');
    await page.locator(`${P} [data-assign-send-now]`).uncheck();
    await shot(page, 'assign-outside-down', 'light', 'classic', false);
    await page.locator(`${D} [data-dialog-ok]`).click();
    await expect.poll(() => last(calls, 'POST', new RegExp(`^tickets/${TID}/assign$`))?.body).toMatchObject({ assignee: { kind: 'contact', id: 'c-elec' } });
    expect(last(calls, 'POST', new RegExp(`^tickets/${TID}/assign$`))?.body).not.toHaveProperty('send_now');
  });

  test('unmatched replies: one chip in the list, claim before reveal', async ({ page }) => {
    const calls = await go(page, '/tickets/mine');
    const chip = page.locator(`${L} tickets-inbound-chip [data-inbound-chip]`);
    await expect(chip).toHaveAttribute('aria-label', 'תשובות לא משויכות (1)');
    await expect(chip).toContainText('1');
    await chip.click();
    const dlg = page.locator(`${L} tickets-inbound-chip [data-dialog="inbound"]`);
    await expect(dlg.locator('[data-inbound="in-1"]')).toContainText(VENDOR);
    await expect(dlg.locator('[data-inbound-text]')).toHaveCount(0); // the text only after the claim
    await shot(page, 'inbound', 'light', 'classic', false);
    await dlg.locator('[data-inbound-claim]').click();
    await expect.poll(() => last(calls, 'POST', /^tickets\/inbound\/in-1\/claim$/)?.path).toBe('tickets/inbound/in-1/claim');
    await expect(dlg.locator('[data-inbound-text]')).toContainText('מחליף את המנוע');
    await expect(dlg.locator('[data-inbound-attach]')).toContainText('1044');
    await shot(page, 'inbound-claimed', 'light', 'classic', false);
  });
});
