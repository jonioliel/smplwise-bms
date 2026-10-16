import type { Page, Route } from '@playwright/test';
import { installTicketsMock } from './tickets-mocks';

// TKUI3 (2.6.0): the mock layer of the Costs tab specs - one request handed to an outside vendor over slice 1's mock layer, with the
// quote / payment-demand routes of the detail backend contract v1.3 (§3-§7) and the vendor message of §6.1. Scenarios:
//   quote   - in progress, the vendor's quote v2 waits for the manager (v1 was replaced); three lines
//   demand  - done, the approved quote (labour + parts) is the baseline, the payment demand has an exceptional travel line
//   staff   - a staff contact without an account (`quote_capable: false`): no money surface at all
//   empty   - a vendor, no quote asked, nothing submitted
// Every decision answers a `message_draft`; NOTHING is sent unless the spec presses "שלח לספק" (the calls list proves it).
// Fake data only: no real person, number, address or account.

export const CID = '0000000000000a03'; // a row of slice 1's list (the drawer opens over the list), its detail replaced here
export const VENDOR = 'קירור הצפון';
export type Call = { method: string; path: string; body: Record<string, unknown> | null };
export type Scenario = 'quote' | 'demand' | 'staff' | 'empty';

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const NOW = Date.parse('2026-10-16T10:00:00Z');
const at = (h: number) => new Date(NOW - h * 3_600_000).toISOString().replace(/\.\d+Z$/, 'Z');
const me = { kind: 'user', name: 'רונית לוי', me: true };

type Line = { index: number; kind: string; description: string; total_minor: number; approved?: boolean; [k: string]: unknown };
type Quote = Record<string, unknown> & { id: string; state: string; revision: number; lines: Line[]; version: number };

function vat(sub: number) {
  const v = Math.round((sub * 1800) / 10_000);
  return { vat: v, total: sub + v };
}

function quoteOf(id: string, version: number, state: string, lines: Line[], extra: Record<string, unknown> = {}): Quote {
  const sub = lines.reduce((n, l) => n + l.total_minor, 0);
  const t = vat(sub);
  return {
    id, version, state, source: 'vendor', created_at: at(5), assignment_id: 'asg-v', currency: 'ILS', vat_mode: 'excluded', vat_rate_bp: 1800, lines,
    labor_minor: 0, parts_minor: 0, travel_minor: 0, other_minor: 0, subtotal_minor: sub, vat_minor: t.vat, total_minor: t.total, net_minor: sub,
    work_from: at(-24), work_to: at(-28), note: version > 1 ? 'המדחס במלאי, אפשר מחר בבוקר.' : null, vendor_ref: null, approved: null, vendor: VENDOR, revision: 1,
    created_by_name: '', decision: null, can: { decide: state === 'submitted', reject: state === 'submitted' || state === 'fix_requested' }, ...extra,
  };
}

function approve(q: Quote, idx: number[], by = 'רונית לוי'): void {
  const sub = q.lines.filter((l) => idx.includes(l.index)).reduce((n, l) => n + l.total_minor, 0);
  const t = vat(sub);
  q.lines = q.lines.map((l) => ({ ...l, approved: idx.includes(l.index) }));
  q.state = idx.length === q.lines.length ? 'approved' : 'partially_approved';
  q.approved = { line_indexes: idx, subtotal_minor: sub, vat_minor: t.vat, total_minor: t.total };
  q.decision = { by, at: at(0), reason: null };
  q.can = { decide: false, reject: false };
}

export interface CostsMock { calls: Call[] }

export async function installCostsTabMock(page: Page, scenario: Scenario = 'quote'): Promise<CostsMock> {
  await installTicketsMock(page, { persona: 'admin' });
  const st: CostsMock = { calls: [] };
  const staff = scenario === 'staff';
  const status = scenario === 'demand' ? 'done' : 'in_progress';
  const contact = staff ? 'יוסי טכנאי' : VENDOR;
  const asg = { id: 'asg-v', name: contact, assigned_at: at(48), ended_at: null, cost_claim: staff ? 'off' : 'required', quote_mode: scenario === 'empty' ? 'optional' : 'required', quote_capable: !staff };
  let kinds: string[] | null = null;
  const quotes: Quote[] = [];
  if (scenario === 'quote') {
    quotes.push(quoteOf('q-1', 1, 'superseded', [{ index: 0, kind: 'labor', description: 'אבחון ותיקון', hours: '4', rate_minor: 20_000, total_minor: 80_000 }], { created_at: at(30), can: { decide: false, reject: false } }));
    quotes.push(quoteOf('q-2', 2, 'submitted', [
      { index: 0, kind: 'labor', description: 'החלפת מדחס', hours: '3', rate_minor: 20_000, total_minor: 60_000 },
      { index: 1, kind: 'parts', description: 'מדחס רוטורי', quantity: '1', unit_minor: 95_000, total_minor: 95_000 },
      { index: 2, kind: 'parts', description: 'גז קירור', quantity: '2', unit_minor: 8_500, total_minor: 17_000 },
    ]));
  }
  if (scenario === 'demand') {
    const q = quoteOf('q-9', 1, 'submitted', [
      { index: 0, kind: 'labor', description: 'החלפת משאבת ניקוז', hours: '4', rate_minor: 30_000, total_minor: 120_000 },
      { index: 1, kind: 'parts', description: 'משאבה', quantity: '1', unit_minor: 60_000, total_minor: 60_000 },
    ], { created_at: at(40) });
    approve(q, [0, 1], 'דנה פרץ');
    quotes.push(q);
  }
  const claimRev = (id: string, seq: number, lines: Line[], extra: Record<string, unknown> = {}) => {
    const sub = lines.reduce((n, l) => n + l.total_minor, 0);
    const t = vat(sub);
    return { id, seq, source: 'vendor', kind: 'submission', based_on: null, no_charge: false, lines, labor_minor: 120_000, parts_minor: 60_000, travel_minor: lines.some((l) => l.kind === 'travel') ? 8_000 : 0, other_minor: 0,
      subtotal_minor: sub, vat_mode: 'excluded', vat_rate_bp: 1800, vat_minor: t.vat, net_minor: sub, total_minor: t.total, currency: 'ILS', vendor_ref: 'INV-2041', notes: null,
      created_at: at(2), created_by_kind: 'contact', created_by_name: '', documents: [], exceptional: [], ...extra };
  };
  const demandLines: Line[] = [
    { index: 0, kind: 'labor', description: 'החלפת משאבת ניקוז', hours: '4', rate_minor: 30_000, total_minor: 120_000 },
    { index: 1, kind: 'parts', description: 'משאבה', quantity: '1', unit_minor: 60_000, total_minor: 60_000 },
    { index: 2, kind: 'travel', description: 'נסיעה נוספת', amount_minor: 8_000, total_minor: 8_000 },
  ];
  const claims: Record<string, unknown>[] = scenario === 'demand' ? [{
    id: 'clm-1', assignment_id: 'asg-v', status: 'submitted', required: true, claim_until: at(-24 * 10), window_open: true, missing: false, revision: 2, currency: 'ILS', no_charge: false,
    current_revision_id: 'rev-1', approved_revision_id: null, approved_total_minor: null, approved_at: null, approved_by: null, paid_at: null, payment_ref: null, payment_date: null,
    total_minor: vat(188_000).total, high_amount: false, vendor: VENDOR, contact_name: 'שמעון', labor_rate_minor: 30_000, rate_currency: 'ILS', vat_exempt: false, reopen_used: false,
    revisions: [claimRev('rev-1', 1, demandLines, { exceptional: [{ index: 2, kind: 'travel', description: 'נסיעה נוספת', total_minor: 8_000, reason: 'not_in_quote', review: 'pending' }] })],
    decisions: [], baseline: { quote_id: 'q-9', version: 1, total_minor: vat(180_000).total, currency: 'ILS' }, delta_minor: vat(188_000).total - vat(180_000).total,
    kind_deltas: { labor: 0, parts: 0, travel: 8_000, other: 0 }, needs_review: true,
  }] : [];

  const flow = () => {
    if (scenario === 'demand') {
      const c = claims[0];
      return { stage: c.status === 'submitted' ? 'demand_submitted' : c.status === 'approved' ? 'demand_approved' : 'demand_rejected', sub_state: null, assignment_id: 'asg-v', quote_mode: 'required' };
    }
    if (staff) return { stage: 'quote_optional', sub_state: null, assignment_id: 'asg-v', quote_mode: 'optional' };
    const live = quotes.filter((q) => q.state !== 'superseded');
    const last = live.at(-1);
    if (quotes.some((q) => q.state === 'approved' || q.state === 'partially_approved')) return { stage: 'work', sub_state: null, assignment_id: 'asg-v', quote_mode: asg.quote_mode };
    if (last?.state === 'submitted') return { stage: 'quote_submitted', sub_state: null, assignment_id: 'asg-v', quote_mode: asg.quote_mode };
    if (last?.state === 'fix_requested') return { stage: 'quote_fix_requested', sub_state: null, assignment_id: 'asg-v', quote_mode: asg.quote_mode };
    if (last?.state === 'rejected') return { stage: 'quote_rejected', sub_state: null, assignment_id: 'asg-v', quote_mode: asg.quote_mode };
    return { stage: asg.quote_mode === 'required' ? 'quote_requested' : 'none', sub_state: null, assignment_id: 'asg-v', quote_mode: asg.quote_mode };
  };
  const base = () => {
    const b = quotes.find((q) => q.state === 'approved' || q.state === 'partially_approved');
    return b ? { quote_id: b.id, version: b.version, state: b.state, total_minor: (b.approved as { total_minor: number }).total_minor, currency: 'ILS',
      line_kinds: [...new Set(b.lines.filter((l) => l.approved).map((l) => l.kind))] } : null;
  };
  const block = () => ({ flow: flow(), allowed_line_kinds: kinds ? { kinds, level: 'request' } : { kinds: ['labor', 'parts'], level: 'department' }, quote_mode: asg.quote_mode, quotes, baseline: base() });
  const costStatus = () => (claims.length ? String(claims[0].status) : 'not_required');
  const costs = () => ({
    ticket_id: CID, number: 1044, cost: { status: costStatus(), can_view: true, total_minor: null, currency: null, can_decide: true, can_set_requirement: true }, claims,
    settings: { currencies: ['ILS'], vat_rate_bp: 1800, review_flag_above_minor: 1_000_000, max_claim_total_minor: 100_000_000, require_invoice: false },
    external_assignments: [asg], ...block(),
  });
  const draft = (subject: string, id: string, decision: string) => ({
    text: subject === 'quote' ? `שלום ${contact}, ההצעה שלכם עבור "דליפת מים" ${decision === 'partially_approved' ? 'אושרה חלקית: עבודה, חלקים' : decision === 'approved' ? 'אושרה' : 'הוחזרה'}.`
      : `שלום ${contact}, דרישת התשלום שלכם עבור "דליפת מים" אושרה${decision === 'approved_without_exceptional' ? ' ללא הסעיפים החריגים: נסיעה' : ''}.`,
    lang: 'he', notify_default: true, send: { route: `POST /tickets/${CID}/vendor-message`, source: { kind: subject, id } },
  });
  const detail = () => ({
    id: CID, number: 1044, title: 'דליפת מים ממזגן בחדר הישיבות', status, origin: 'manual',
    department: { id: 'dept-maintenance', key: 'maintenance', name: 'אחזקה', icon: null, color: null }, category: { id: 'cat-hvac', name: 'מיזוג' },
    priority: { id: 'dept-maintenance-high', key: 'high', name: 'גבוהה', rank: 1, severity: 'alert' },
    place_text: 'קומה 2 · חדר ישיבות גדול', device_name: '', created_by: { id: 'u-ronit', name: 'רונית לוי' }, created_at: at(50), last_activity_at: at(1),
    assignee: { kind: 'contact', id: 'c-v', name: contact, since: at(48), acknowledged_at: at(47) },
    last_assignee_name: null, eta_at: null, waiting_on: status === 'done' ? 'manager' : 'assignee', waiting_reason: status === 'done' ? 'done' : null, reopen_count: 0, external_stale: false,
    closed_at: null, revision: 5, view: 'full', description: 'מים על השטיח ליד החלון.', close_note: null, closed_by_name: null, duplicate_of: null, reopen_until: null,
    attachments: [], events: [{ id: 'e1', at: at(50), kind: 'created', actor: me, from: null, to: 'new', body: null, data: {}, via: 'ui', external: false }],
    can: { edit_fields: ['title'], assign: true, assign_external: true, note: true, note_external: true, attach: true, attach_external: true, eta: true, return: false, manage: true, delete: true, vendor_message: true },
    transitions: [{ to: 'closed', note_required: false }],
    assignments: [{ id: 'asg-v', kind: 'contact', name: contact, channel: 'whatsapp', assigned_at: at(48), assigned_by_name: 'רונית לוי', acknowledged_at: at(47), ended_at: null,
      end_reason: null, return_kind: null, return_reason: null, cost_claim: asg.cost_claim }],
    cost: { status: costStatus(), can_view: true, total_minor: null, currency: null, can_decide: true, can_set_requirement: true },
    messages: [],
  });

  await page.route(`**/api/v1/tickets/${CID}**`, async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    const body = method === 'GET' ? null : (() => { try { return req.postDataJSON() as Record<string, unknown>; } catch { return null; } })();
    if (method !== 'GET') st.calls.push({ method, path: p, body });
    const sub = p.slice(`tickets/${CID}`.length).replace(/^\//, '');
    if (sub === '' && method === 'GET') return json(route, detail());
    if (sub === 'costs' && method === 'GET') return json(route, costs());
    if (sub === 'quotes' && method === 'GET') return json(route, block());
    const qd = /^quotes\/([\w-]+)\/(approve|request-fix|reject)$/.exec(sub);
    if (qd && method === 'POST') {
      const q = quotes.find((x) => x.id === qd[1]);
      if (!q) return json(route, { code: 'quote_not_found', user_message: 'ההצעה לא נמצאה.', retryable: false, correlation_id: 'm', details: {} }, 404);
      if (Number(body?.revision) !== q.revision) return json(route, { code: 'quote_stale', user_message: 'ההצעה השתנתה בינתיים.', retryable: false, correlation_id: 'm', details: {} }, 409);
      if (qd[2] === 'approve') approve(q, (body?.line_indexes as number[] | undefined) ?? q.lines.map((l) => l.index));
      else {
        q.state = qd[2] === 'reject' ? 'rejected' : 'fix_requested';
        q.decision = { by: 'רונית לוי', at: at(0), reason: String(body?.reason ?? '') };
        q.can = { decide: false, reject: qd[2] !== 'reject' };
      }
      q.revision += 1;
      return json(route, { ...block(), message_draft: draft('quote', q.id, q.state) });
    }
    if (sub === 'allowed-line-kinds' && method === 'PUT') {
      kinds = (body?.kinds as string[] | null) ?? null;
      return json(route, block());
    }
    if (sub === 'quotes/requirement' && method === 'POST') {
      asg.quote_mode = String(body?.mode ?? 'optional');
      return json(route, block());
    }
    const cd = /^costs\/([\w-]+)\/(approve|reject|adjust)$/.exec(sub);
    if (cd && method === 'POST' && claims[0]) {
      const c = claims[0];
      const exclude = body?.exceptional === 'exclude';
      if (cd[2] === 'reject') c.status = 'rejected';
      else {
        c.status = 'approved';
        c.approved_total_minor = exclude ? vat(180_000).total : vat(188_000).total;
        c.approved_by = 'רונית לוי';
        c.approved_at = at(0);
      }
      c.revision = Number(c.revision) + 1;
      c.needs_review = false;
      return json(route, { ...costs(), message_draft: draft('claim', String(c.id), cd[2] === 'reject' ? 'rejected' : exclude ? 'approved_without_exceptional' : 'approved') });
    }
    if (sub === 'vendor-message' && method === 'POST') return json(route, { item: { id: 'ev:900' }, notified: { queued: true, channel: 'whatsapp' } }, 201);
    return route.fallback();
  });
  return st;
}
