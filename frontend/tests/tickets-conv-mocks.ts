import type { Page, Route } from '@playwright/test';
import { installTicketsMock } from './tickets-mocks';

// TKUI2 (2.6.0): the mock layer of the Conversation / History specs - one request handed to an outside vendor with a long conversation
// (internal notes, messages both ways, a WhatsApp reply, notes from the handler page, the outbox delivery rows, status rows, link and
// cost events, two photos) over slice 1's mock layer, and the writes of the detail backend contract v1.3 §6.1 (`vendor-message`,
// `notes/{id}/forward`) plus the team note (`POST /notes`, external false). Fake data only: no real person, number, address or account.

export const VID = '0000000000000a03';
export const VENDOR = 'משה לוי (שערים בע"מ)';
export type Call = { method: string; path: string; body: unknown };

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const NOW = Date.parse('2026-10-13T10:42:00Z');
export const at = (h: number) => new Date(NOW - h * 3_600_000).toISOString().replace(/\.\d+Z$/, 'Z');
/** a 2x2 PNG (a photo of the request) */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

type Ev = Record<string, unknown>;
const me = { kind: 'user', name: 'רונית לוי', me: true };
const dana = { kind: 'user', name: 'דנה פרץ', me: false };
const sys = { kind: 'system', name: '', me: false };
const vend = { kind: 'contact', name: VENDOR, me: false };

function baseEvents(): Ev[] {
  let n = 0;
  const ev = (h: number, kind: string, extra: Ev = {}): Ev => ({ id: `c${String(++n).padStart(2, '0')}`, at: at(h), kind, actor: sys, from: null, to: null, body: null, data: {}, via: 'ui', external: false, ...extra });
  const list: Ev[] = [
    ev(50, 'created', { actor: me, to: 'new', data: { origin: 'manual' } }),
    ev(49.8, 'note', { actor: dana, body: 'מים על השטיח ליד החלון, נראה מהיחידה הפנימית. הנחתי דלי. החדר תפוס מחר מ-10:00.' }),
    ev(49.5, 'assigned', { actor: me, from: 'new', to: 'assigned', data: { assignee: VENDOR, assignee_kind: 'contact', contact_kind: 'vendor', channel: 'whatsapp' } }),
    ev(49.4, 'link_sent', { via: 'whatsapp', data: { purpose: 'assign', state: 'sent' } }),
    ev(49, 'link_opened', { actor: vend, via: 'link' }),
    ev(48.6, 'note', { actor: vend, via: 'link', external: true, body: 'ראיתי, אגיע היום בין 14:00 ל-16:00. כנראה צריך להחליף משאבת ניקוז.' }),
    ev(48.5, 'status', { actor: vend, from: 'assigned', to: 'acknowledged', via: 'link', external: true }),
    ev(47, 'note', { actor: me, body: 'לוודא שחדר הישיבות פנוי אחרי 14:00; המשאבה מגיעה מהמחסן של הספק.' }),
  ];
  // a long day: alternating updates so the feed has more than 20 items ("הודעות קודמות")
  for (let i = 0; i < 16; i += 1) {
    list.push(ev(30 - i, 'note', i % 2 ? { actor: vend, via: 'link', external: true, body: `עדכון ביניים ${i + 1}: הבדיקה נמשכת.` } : { actor: me, external: true, body: `תודה, ממתינים לעדכון (${i + 1}).` }));
  }
  list.push(
    ev(6, 'status', { actor: vend, from: 'acknowledged', to: 'in_progress', via: 'link', external: true }),
    ev(5, 'note', { actor: me, external: true, body: 'הכניסה דרך הלובי, לשאול את השומר.' }),
    ev(4.5, 'link_opened', { actor: vend, via: 'link' }),
    ev(4, 'photo', { actor: vend, via: 'link', external: true }),
    ev(3, 'inbound', { actor: { kind: 'inbound', name: VENDOR, me: false }, body: 'בדרך, 20 דקות.', data: { unverified: true }, external: true, via: 'whatsapp' }),
    ev(2, 'cost_submitted', { actor: vend, via: 'link', external: true }),
    ev(1.5, 'note', { actor: dana, body: 'דרישת התשלום גבוהה ב-30 ש״ח מההצעה - לבדוק לפני אישור.' }),
    ev(1, 'link_copied', { actor: me }),
    ev(0.8, 'message_unknown', { data: { purpose: 'update' } }),
  );
  return list;
}

function outbox() {
  const base = { not_before: null, attempts: 1, code: null, account: 'שירות ····0191', fallback_of: null, resend_of: null, current: true };
  return [
    { ...base, id: 'ob-2', purpose: 'update', channel: 'whatsapp', state: 'unknown', held_reason: null, created_at: at(0.8), sent_at: null, can: { send_now: false, resend: true } },
    { ...base, id: 'ob-1', purpose: 'assign', channel: 'whatsapp', state: 'sent', held_reason: null, created_at: at(49.4), sent_at: at(49.4), can: { send_now: false, resend: false } },
  ];
}

export interface ConvMock {
  calls: Call[];
}

/**
 * The vendor request (`VID`) over slice 1's layer as the persona `admin` (tickets.external: may write to the vendor). `vendorMessage:
 * false` = the new routes answer 404 (TKFIX260: the screen shows the error - there is no fallback to the external note).
 */
export async function installConvMock(page: Page, o: { vendorMessage?: boolean; closed?: boolean } = {}): Promise<ConvMock> {
  await installTicketsMock(page, { persona: 'admin' });
  const st: ConvMock = { calls: [] };
  const events = baseEvents();
  let seq = 100;
  const detail = () => ({
    id: VID, number: 1044, title: 'דליפת מים ממזגן בחדר הישיבות', status: o.closed ? 'closed' : 'in_progress', origin: 'manual',
    department: { id: 'dept-maintenance', key: 'maintenance', name: 'אחזקה', icon: null, color: null }, category: { id: 'cat-hvac', name: 'מיזוג' },
    priority: { id: 'dept-maintenance-high', key: 'high', name: 'גבוהה', rank: 1, severity: 'alert' },
    place_text: 'קומה 2 · חדר ישיבות גדול', device_name: '', created_by: { id: 'u-ronit', name: 'רונית לוי' }, created_at: at(50), last_activity_at: at(0.8),
    assignee: o.closed ? null : { kind: 'contact', id: 'c-gates', name: VENDOR, since: at(49.5), acknowledged_at: at(48.5) },
    last_assignee_name: null, eta_at: at(-20), waiting_on: 'assignee', waiting_reason: null, reopen_count: 0, external_stale: false, closed_at: o.closed ? at(0.5) : null,
    revision: 7, view: 'full', description: 'מים על השטיח ליד החלון מתחת ליחידה הפנימית.', close_note: null, closed_by_name: null, duplicate_of: null, reopen_until: null,
    attachments: [
      { id: 'att-1', at: at(49.8), width: 2, height: 2, bytes: 75, external: false, mine: false, can_delete: true, url: `tickets/${VID}/attachments/att-1/file` },
      { id: 'att-2', at: at(4), width: 2, height: 2, bytes: 75, external: true, mine: false, can_delete: false, url: `tickets/${VID}/attachments/att-2/file` },
    ],
    events: [...events].sort((a, b) => String(a.at).localeCompare(String(b.at))),
    can: {
      edit_fields: ['title', 'description', 'category_id', 'priority_id', 'department_id'], assign: true, assign_external: true, note: !o.closed, note_external: true,
      attach: !o.closed, attach_external: true, eta: true, return: false, manage: true, delete: true, ...(o.vendorMessage === false ? {} : { vendor_message: !o.closed }),
    },
    transitions: o.closed ? [{ to: 'new', note_required: false }] : ['waiting_part', 'done', 'closed', 'cancelled'].map((to) => ({ to, note_required: to === 'cancelled' || to === 'closed' })),
    assignments: [{ id: 'asg-1', kind: 'contact', name: VENDOR, channel: 'whatsapp', assigned_at: at(49.5), assigned_by_name: 'רונית לוי', acknowledged_at: at(48.5),
      ended_at: o.closed ? at(0.5) : null, end_reason: o.closed ? 'closed' : null, return_kind: null, return_reason: null }],
    link: { state: o.closed ? 'view_only' : 'live', current: true, generation: 1, created_at: at(49.4), expires_at: at(-24 * 11), cap_at: at(-24 * 90), grace_until: null, revoked_at: null,
      revoked_reason: null, sent_via: 'whatsapp', sent_at: at(49.4), first_opened_at: at(49), last_opened_at: at(4.5), open_count: 4, devices: 2, update_count: 9,
      require_code: false, code_locked: false, can: { copy: true, new: true, revoke: true, resend: !o.closed } },
    messages: outbox(),
  });
  const push = (e: Ev) => events.push({ id: `c${++seq}`, at: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), from: null, to: null, data: {}, via: 'ui', ...e });
  await page.route(`**/api/v1/tickets/${VID}**`, async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    const body = method === 'GET' || method === 'DELETE' ? null : (() => { try { return req.postDataJSON() as Record<string, unknown>; } catch { return null; } })();
    if (/\/attachments\/[\w-]+\/file$/.test(p)) return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    if (method !== 'GET') st.calls.push({ method, path: p, body });
    const sub = p.slice(`tickets/${VID}`.length).replace(/^\//, '');
    if (sub === 'notes' && method === 'POST') {
      push({ kind: 'note', actor: me, body: String(body?.text ?? ''), external: !!body?.external });
      return json(route, detail(), 201);
    }
    if (sub === 'vendor-message' && method === 'POST') {
      if (o.vendorMessage === false) return json(route, { detail: 'Not Found' }, 404);
      push({ kind: 'note', actor: me, body: String(body?.text ?? ''), external: true });
      return json(route, { item: { id: `ev:${seq}` }, notified: { queued: true, channel: 'whatsapp' } }, 201);
    }
    const fwd = /^notes\/([\w-]+)\/forward$/.exec(sub);
    if (fwd && method === 'POST') {
      if (o.vendorMessage === false) return json(route, { detail: 'Not Found' }, 404);
      push({ kind: 'note', actor: me, body: String(body?.text ?? ''), external: true, data: { from_note_id: fwd[1] } });
      return json(route, { item: { id: `ev:${seq}` }, notified: { queued: true, channel: 'whatsapp' } }, 201);
    }
    if (sub === '' && method === 'GET') return json(route, detail());
    return route.fallback();
  });
  return st;
}
