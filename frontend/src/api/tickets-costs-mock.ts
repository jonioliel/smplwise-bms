/**
 * CR-038 slice 9: the demo store of the cost-claim screens (no backend: the static preview and design review). Fake data only - no real
 * person, company, phone or invoice. It follows the server's rules where a screen shows them (the revision check, the statuses a decision
 * needs, the once-only window reopen, the close gate of a required claim) and computes figures with the same integer rules
 * (tickets/cost-model.ts). The slice-1 demo store (./tickets-mock.ts) asks `demoCostBlock` for a ticket's `cost` and `demoCloseGate`
 * before a close.
 */
import { ApiError } from './client';
import type {
  AssignPreview, ClaimStatus, CostClaim, CostDecision, CostMode, CostReport, CostRevision, CostsBackend, CostsSettings, DecisionBody, DecisionKind,
  DepartmentCosts, LineInput, OnBehalfBody, PendingFile, ReportGroupRow, ReportQuery, StoredLine, TicketCostBlock, TicketCosts, VatMode,
} from './tickets-costs';
import { decimalToMinor, halfUpDiv, hoursToQuarters, minorToDecimal, quantityToMilli, vatOf } from '../tickets/cost-model';

const sleep = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z');
let idn = 0;
const nid = (p: string) => `${p}${(++idn).toString(16).padStart(12, '0')}`;
const ME = 'יוני';

let settingsRevision = 0;
let costs: CostsSettings = {
  mode: 'optional', currencies: ['ILS'], vat_rate_bp: 1800, claim_window_days: 14, require_invoice: false,
  max_claim_total_minor: 100_000_000, review_flag_above_minor: 1_000_000, notify_vendor_approved: true, retention_days: 2555,
};
const depts: DepartmentCosts[] = [
  { id: 'dept-maintenance', key: 'maintenance', name: 'אחזקה', active: true, cost_claim: 'required', claim_window_days: null },
  { id: 'dept-cleaning', key: 'cleaning', name: 'ניקיון', active: true, cost_claim: null, claim_window_days: 7 },
];

interface DemoTicket {
  id: string;
  number: number;
  status: string;
  claims: CostClaim[];
  assignments: { id: string; name: string; assigned_at: string; ended_at: string | null; cost_claim: CostMode | null }[];
  dept: string;
  device: string;
  room: string;
}
const byNumber = new Map<number, DemoTicket>();
const byId = new Map<string, DemoTicket>();

/** A demo invoice page as an inline SVG (light paper, a few printed-looking rows) - never a real document. */
function pageSvg(n: number, vendor: string): string {
  const rows = Array.from({ length: 7 }, (_, i) => `<rect x="60" y="${250 + i * 46}" width="${300 + ((i * 53) % 180)}" height="12" rx="3" fill="#c8ccd4"/><rect x="560" y="${250 + i * 46}" width="90" height="12" rx="3" fill="#c8ccd4"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1000" viewBox="0 0 720 1000"><rect width="720" height="1000" fill="#fbfaf7"/><text x="660" y="110" font-family="sans-serif" font-size="34" text-anchor="end" fill="#2a2f3a">${vendor}</text><text x="660" y="160" font-family="sans-serif" font-size="22" text-anchor="end" fill="#6b7280">חשבונית מס · עמוד ${n}</text>${rows}<rect x="60" y="640" width="600" height="2" fill="#2a2f3a"/><text x="660" y="700" font-family="sans-serif" font-size="26" text-anchor="end" fill="#2a2f3a">סה״כ לתשלום</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
const pageUrls = new Map<string, string>();

function storedLine(l: LineInput): StoredLine {
  if (l.kind === 'labor') {
    const q = hoursToQuarters(l.hours) ?? 0;
    const r = decimalToMinor(l.rate) ?? 0;
    return { kind: 'labor', description: l.description ?? '', hours: l.hours, rate_minor: r, total_minor: Number(halfUpDiv(BigInt(q) * BigInt(r), 4n)) };
  }
  if (l.kind === 'parts') {
    const m = quantityToMilli(l.quantity) ?? 0;
    const u = decimalToMinor(l.unit_price) ?? 0;
    return { kind: 'parts', description: l.description, quantity: l.quantity, unit_minor: u, total_minor: Number(halfUpDiv(BigInt(m) * BigInt(u), 1000n)) };
  }
  const a = decimalToMinor(l.amount) ?? 0;
  return { kind: l.kind, description: l.description ?? '', amount_minor: a, total_minor: a };
}

function revisionOf(seq: number, lines: StoredLine[], mode: VatMode, at: number, extra: Partial<CostRevision> = {}): CostRevision {
  const k = { labor: 0, parts: 0, travel: 0, other: 0 };
  for (const l of lines) k[l.kind] += l.total_minor;
  const subtotal = k.labor + k.parts + k.travel + k.other;
  const v = vatOf(subtotal, mode, costs.vat_rate_bp);
  return {
    id: nid('rev'), seq, source: 'vendor', kind: 'submission', based_on: null, no_charge: false, lines, labor_minor: k.labor, parts_minor: k.parts,
    travel_minor: k.travel, other_minor: k.other, subtotal_minor: subtotal, vat_mode: mode, vat_rate_bp: costs.vat_rate_bp, vat_minor: v.vat, net_minor: v.net,
    total_minor: v.total, currency: 'ILS', vendor_ref: null, notes: null, created_at: iso(at), created_by_kind: 'contact', created_by_name: '', documents: [], ...extra,
  };
}

function photoDoc(no: number, pages: number, vendor: string): CostRevision['documents'][number] {
  return {
    no, kind: 'photo', pages: Array.from({ length: pages }, (_, i) => {
      const id = nid('pg');
      pageUrls.set(id, pageSvg(i + 1, vendor));
      return { id, kind: 'photo' as const, bytes: 380_000 + i * 21_000, name: '', width: 1536, height: 2048 };
    }),
  };
}

function claimOf(_t: DemoTicket, asgId: string, vendor: string, contact: string, status: ClaimStatus, required: boolean, until: number, revisions: CostRevision[], decisions: CostDecision[] = []): CostClaim {
  const current = revisions.at(-1);
  const approved = status === 'approved' || status === 'paid';
  return {
    id: nid('clm'), assignment_id: asgId, status, required, claim_until: iso(until), window_open: until > Date.now(), missing: false, revision: 1, currency: 'ILS',
    no_charge: false, current_revision_id: current?.id ?? null, approved_revision_id: approved ? current?.id ?? null : null,
    approved_total_minor: approved ? current?.total_minor ?? null : null, approved_at: approved ? current?.created_at ?? null : null, approved_by: approved ? ME : null,
    paid_at: null, payment_ref: null, payment_date: null, total_minor: current?.total_minor ?? null, high_amount: false, vendor, contact_name: contact,
    labor_rate_minor: 18_000, rate_currency: 'ILS', vat_exempt: false, reopen_used: false, revisions, decisions,
  };
}

function refresh(c: CostClaim): void {
  const cur = c.revisions?.find((r) => r.id === c.current_revision_id);
  c.total_minor = c.status === 'approved' || c.status === 'paid' ? c.approved_total_minor ?? null : cur?.total_minor ?? null;
  c.high_amount = c.total_minor !== null && c.total_minor !== undefined && c.total_minor > costs.review_flag_above_minor;
  c.window_open = !!c.claim_until && Date.parse(c.claim_until) > Date.now();
  c.reopen_used = (c.decisions ?? []).some((d) => d.action === 'reopen_window');
}

/** The seeded claims of three demo tickets (the slice-1 store numbers them 1043 ...; the costs follow the ticket's number). */
function seed(t: DemoTicket): void {
  const now = Date.now();
  if (t.number === 1046) {
    const vendor = 'קירור הצפון';
    t.assignments = [{ id: nid('asg'), name: vendor, assigned_at: iso(now - 4 * DAY), ended_at: null, cost_claim: 'required' }];
    const rev = revisionOf(1, [
      storedLine({ kind: 'labor', description: 'החלפת מסנן וניקוי מאייד', hours: '2.5', rate: '180' }),
      storedLine({ kind: 'parts', description: 'מסנן אוויר 60x60', quantity: '1', unit_price: '240' }),
      storedLine({ kind: 'travel', description: 'נסיעה', amount: '60' }),
    ], 'excluded', now - 26 * 3_600_000, { vendor_ref: 'INV-20417', documents: [photoDoc(1, 2, vendor), { no: 2, kind: 'pdf', pages: [{ id: nid('pdf'), kind: 'pdf', bytes: 182_000, name: 'invoice.pdf' }] }] });
    t.claims = [claimOf(t, t.assignments[0].id, vendor, 'שמעון', 'submitted', true, now + 12 * DAY, [rev])];
  } else if (t.number === 1048) {
    const vendor = 'חשמל אורן';
    t.assignments = [{ id: nid('asg'), name: vendor, assigned_at: iso(now - 9 * DAY), ended_at: iso(now - 6 * DAY), cost_claim: 'optional' }];
    const r1 = revisionOf(1, [storedLine({ kind: 'labor', description: 'החלפת גוף תאורה', hours: '3', rate: '200' }), storedLine({ kind: 'parts', description: 'גוף תאורה לד', quantity: '1', unit_price: '800' })], 'excluded', now - 6 * DAY, { vendor_ref: '7781', documents: [photoDoc(1, 1, vendor)] });
    const r2 = revisionOf(2, [storedLine({ kind: 'labor', description: 'החלפת גוף תאורה', hours: '2', rate: '200' }), storedLine({ kind: 'parts', description: 'גוף תאורה לד', quantity: '1', unit_price: '800' })], 'excluded', now - 5 * DAY,
      { source: 'manager', kind: 'adjustment', based_on: r1.id, reason: 'שעת עבודה אחת כבר שולמה בביקור הקודם', created_by_kind: 'user', created_by_name: ME, vendor_ref: '7781', documents: r1.documents });
    const c = claimOf(t, t.assignments[0].id, vendor, 'אורן', 'paid', false, now - 2 * DAY, [r1, r2], [
      { id: nid('dec'), action: 'adjust', revision_id: r2.id, reason: r2.reason ?? null, amount_minor: r2.total_minor, payment_ref: null, by: ME, at: r2.created_at },
      { id: nid('dec'), action: 'mark_paid', revision_id: r2.id, reason: null, amount_minor: r2.total_minor, payment_ref: 'העברה 55120', by: ME, at: iso(now - 3 * DAY) },
    ]);
    Object.assign(c, { paid_at: iso(now - 3 * DAY), payment_ref: 'העברה 55120', payment_date: iso(now - 3 * DAY).slice(0, 10), revision: 4 });
    t.claims = [c];
  } else if (t.number === 1043) {
    const vendor = 'מיזוג דרום';
    t.assignments = [{ id: nid('asg'), name: vendor, assigned_at: iso(now - 20 * DAY), ended_at: null, cost_claim: 'required' }];
    t.claims = [claimOf(t, t.assignments[0].id, vendor, 'רמי', 'awaiting', true, now - DAY, [])];
  }
  t.claims.forEach(refresh);
}

function ticketOf(id: string, number: number, status: string): DemoTicket {
  let t = byId.get(id);
  if (!t) {
    t = { id, number, status, claims: [], assignments: [], dept: number === 1047 ? 'dept-cleaning' : 'dept-maintenance', device: number === 1046 ? 'מזגן חדר ישיבות' : '', room: number === 1046 ? 'חדר ישיבות' : 'לובי' };
    seed(t);
    byId.set(id, t);
    byNumber.set(number, t);
  }
  t.status = status;
  return t;
}

function costStatus(t: DemoTicket): TicketCostBlock['status'] {
  if (!t.claims.length) return 'not_required';
  const rank: ClaimStatus[] = ['submitted', 'awaiting', 'rejected', 'approved', 'paid'];
  return [...t.claims].sort((a, b) => rank.indexOf(a.status) - rank.indexOf(b.status))[0].status;
}

function block(t: DemoTicket): TicketCostBlock {
  const top = t.claims.find((c) => c.status === costStatus(t));
  return { status: costStatus(t), can_view: true, total_minor: top?.total_minor ?? null, currency: top?.currency ?? null, can_decide: true, can_set_requirement: true };
}

/** The slice-1 demo store asks this for every ticket it shows (`TicketDetail.cost`). */
export function demoCostBlock(id: string, number: number, status: string): TicketCostBlock {
  return block(ticketOf(id, number, status));
}

/** The slice-1 demo store asks this before a close: a REQUIRED claim not approved / paid blocks it unless overridden (11A.3). */
export function demoCloseGate(id: string, overrideReason: string | undefined): void {
  const t = byId.get(id);
  if (!t) return;
  const pending = t.claims.filter((c) => c.required && c.status !== 'approved' && c.status !== 'paid');
  if (!pending.length) return;
  if (!overrideReason?.trim()) {
    throw new ApiError(409, { code: 'cost_claim_pending', user_message: 'יש דרישת עלות חובה שעדיין לא אושרה. אשרו אותה, או סגרו עם נימוק.', retryable: false, correlation_id: 'demo', details: { can_override: true } });
  }
  for (const c of pending) c.decisions?.push({ id: nid('dec'), action: 'override_close', revision_id: c.current_revision_id ?? null, reason: overrideReason.trim(), amount_minor: null, payment_ref: null, by: ME, at: iso(Date.now()) });
}

function answer(t: DemoTicket): TicketCosts {
  t.claims.forEach(refresh);
  return {
    ticket_id: t.id, number: t.number, cost: block(t), claims: clone(t.claims),
    settings: { currencies: [...costs.currencies], vat_rate_bp: costs.vat_rate_bp, review_flag_above_minor: costs.review_flag_above_minor, max_claim_total_minor: costs.max_claim_total_minor, require_invoice: costs.require_invoice },
    external_assignments: clone(t.assignments),
  };
}

function refuse(status: number, code: string, msg: string, details: Record<string, unknown> = {}): never {
  throw new ApiError(status, { code, user_message: msg, retryable: false, correlation_id: 'demo', details });
}

function find(id: string): DemoTicket {
  const t = byId.get(id);
  if (!t) refuse(404, 'ticket_not_found', 'לא נמצא');
  return t;
}

const pending = new Map<string, PendingFile & { url: string }>();

export const mockCosts: CostsBackend = {
  async get(id) {
    await sleep();
    return answer(find(id));
  },
  async decide(id, claimId, action: DecisionKind, body: DecisionBody) {
    await sleep(200);
    const t = find(id);
    const c = t.claims.find((x) => x.id === claimId);
    if (!c) return refuse(404, 'claim_not_found', 'דרישת העלות לא נמצאה.');
    if (body.revision !== c.revision || (body.revision_id && body.revision_id !== c.current_revision_id)) return refuse(409, 'claim_stale', 'דרישת העלות השתנתה בינתיים. טענו מחדש.');
    const now = iso(Date.now());
    const dec = (a: CostDecision['action'], extra: Partial<CostDecision> = {}) => c.decisions?.push({ id: nid('dec'), action: a, revision_id: c.current_revision_id ?? null, reason: null, amount_minor: null, payment_ref: null, by: ME, at: now, ...extra });
    const needs = (s: ClaimStatus, code: string) => { if (c.status !== s) refuse(409, code, 'הפעולה נדחתה.'); };
    if (action === 'approve' || action === 'adjust' || action === 'reject') needs('submitted', 'claim_not_submitted');
    if ((action === 'adjust' || action === 'reject' || action === 'unmark-paid') && !body.reason?.trim()) return refuse(422, 'validation', 'ערך לא תקין.', { fields: [{ field: 'reason', code: 'required' }] });
    if (action === 'approve') {
      c.status = 'approved';
      c.approved_revision_id = c.current_revision_id;
      c.approved_total_minor = c.revisions?.find((r) => r.id === c.current_revision_id)?.total_minor ?? 0;
      c.approved_at = now;
      c.approved_by = ME;
      dec('approve', { amount_minor: c.approved_total_minor });
    } else if (action === 'adjust') {
      const base = c.revisions?.find((r) => r.id === c.current_revision_id);
      if (!base || !body.lines?.length) return refuse(422, 'validation', 'ערך לא תקין.', { fields: [{ field: 'lines', code: 'required' }] });
      const rev = revisionOf((c.revisions?.length ?? 0) + 1, body.lines.map(storedLine), base.vat_mode, Date.now(), { source: 'manager', kind: 'adjustment', based_on: base.id, reason: body.reason ?? '', created_by_kind: 'user', created_by_name: ME, vendor_ref: base.vendor_ref, documents: base.documents });
      c.revisions?.push(rev);
      c.current_revision_id = rev.id;
      c.status = 'approved';
      c.approved_revision_id = rev.id;
      c.approved_total_minor = rev.total_minor;
      c.approved_at = now;
      c.approved_by = ME;
      dec('adjust', { reason: body.reason ?? null, amount_minor: rev.total_minor });
    } else if (action === 'reject') {
      c.status = 'rejected';
      c.claim_until = iso(Date.now() + costs.claim_window_days * DAY);
      dec('reject', { reason: body.reason ?? null });
    } else if (action === 'mark-paid') {
      needs('approved', 'claim_not_approved');
      if (!body.payment_ref?.trim() || !body.payment_date) return refuse(422, 'validation', 'ערך לא תקין.', { fields: [{ field: 'payment_ref', code: 'required' }] });
      c.status = 'paid';
      c.paid_at = now;
      c.payment_ref = body.payment_ref.trim();
      c.payment_date = body.payment_date;
      dec('mark_paid', { payment_ref: c.payment_ref, amount_minor: c.approved_total_minor ?? null });
    } else if (action === 'unmark-paid') {
      needs('paid', 'claim_not_paid');
      c.status = 'approved';
      c.paid_at = null;
      c.payment_ref = null;
      c.payment_date = null;
      dec('unmark_paid', { reason: body.reason ?? null });
    } else {
      if (c.status !== 'awaiting' && c.status !== 'rejected') return refuse(409, 'claim_not_open', 'דרישת העלות אינה פתוחה להגשה.');
      if (c.window_open) return refuse(409, 'window_still_open', 'חלון ההגשה עדיין פתוח.');
      if (c.reopen_used) return refuse(409, 'already_reopened', 'חלון ההגשה כבר נפתח מחדש פעם אחת.');
      c.claim_until = iso(Date.now() + costs.claim_window_days * DAY);
      dec('reopen_window');
    }
    c.revision = (c.revision ?? 1) + 1;
    return answer(t);
  },
  async setRequirement(id, assignmentId, mode) {
    await sleep();
    const t = find(id);
    const a = t.assignments.find((x) => x.id === assignmentId);
    if (!a) return refuse(404, 'assignment_not_found', 'השיוך לא נמצא.');
    const c = t.claims.find((x) => x.assignment_id === assignmentId);
    if (c && c.status !== 'awaiting') return refuse(409, 'claim_already_submitted', 'אי אפשר לשנות את הדרישה אחרי שהוגשה דרישת עלות.');
    a.cost_claim = mode;
    if (c) {
      c.required = mode === 'required';
      if (mode === 'off') c.claim_until = iso(Date.now());
      c.decisions?.push({ id: nid('dec'), action: 'requirement', revision_id: null, reason: mode, amount_minor: null, payment_ref: null, by: ME, at: iso(Date.now()) });
      c.revision = (c.revision ?? 1) + 1;
    }
    return answer(t);
  },
  async uploadFile(_id, file) {
    await sleep(250);
    const kind: 'photo' | 'pdf' = file.type === 'application/pdf' || /\.pdf$/i.test(file.name) ? 'pdf' : 'photo';
    const f = { id: nid('up'), kind, bytes: file.size, width: kind === 'photo' ? 1536 : null, height: kind === 'photo' ? 2048 : null, url: kind === 'photo' ? URL.createObjectURL(file) : '' };
    pending.set(f.id, f);
    const { url: _u, ...out } = f;
    return out;
  },
  async onBehalf(id, body: OnBehalfBody) {
    await sleep(250);
    const t = find(id);
    const asg = body.assignment_id ? t.assignments.find((a) => a.id === body.assignment_id) : t.assignments.at(-1);
    if (!asg) return refuse(409, 'no_external_assignment', 'אין שיוך לגורם חיצוני.');
    if (!body.no_charge && !body.lines.length) return refuse(422, 'validation', 'ערך לא תקין.', { fields: [{ field: 'lines', code: 'required' }] });
    let c = t.claims.find((x) => x.assignment_id === asg.id);
    if (c && (c.status === 'approved' || c.status === 'paid')) return refuse(409, 'claim_closed', 'דרישת העלות כבר אושרה.');
    if (!c) {
      c = claimOf(t, asg.id, asg.name, '', 'awaiting', asg.cost_claim === 'required', Date.now() + costs.claim_window_days * DAY, []);
      t.claims.push(c);
    }
    const mode: VatMode = body.no_charge || c.vat_exempt ? 'none' : body.amounts_include_vat ? 'included' : 'excluded';
    const docs = body.documents.map((d, i) => {
      const files = d.file_ids.map((fid) => pending.get(fid)).filter((x): x is PendingFile & { url: string } => !!x);
      for (const f of files) if (f.url) pageUrls.set(f.id, f.url);
      return { no: i + 1, kind: files[0]?.kind ?? 'photo', pages: files.map((f) => ({ id: f.id, kind: f.kind, bytes: f.bytes, name: '', width: f.width, height: f.height })) };
    });
    const rev = revisionOf((c.revisions?.length ?? 0) + 1, (body.no_charge ? [] : body.lines).map(storedLine), mode, Date.now(),
      { source: 'manager', kind: 'on_behalf', created_by_kind: 'user', created_by_name: ME, vendor_ref: body.vendor_ref ?? null, notes: body.notes ?? null, no_charge: !!body.no_charge, currency: body.currency ?? 'ILS', documents: docs });
    c.revisions?.push(rev);
    c.current_revision_id = rev.id;
    c.status = 'submitted';
    c.no_charge = !!body.no_charge;
    c.revision = (c.revision ?? 1) + 1;
    return answer(t);
  },
  pageUrl: (_id, fileId) => pageUrls.get(fileId) ?? pageSvg(1, ''),
  async downloadFile(_id, fileId) {
    await sleep(60);
    const { saveBlob } = await import('./tickets-costs');
    saveBlob(new Blob(['%PDF-1.4\n% demo\n%%EOF\n'], { type: 'application/pdf' }), `invoice-${fileId.slice(-4)}.pdf`);
  },
  async downloadDocument(_id, _claimId, _revisionId, docNo) {
    await sleep(60);
    const { saveBlob } = await import('./tickets-costs');
    saveBlob(new Blob(['%PDF-1.4\n% demo assembled pages\n%%EOF\n'], { type: 'application/pdf' }), `invoice-${docNo}.pdf`);
  },
  async report(q: ReportQuery): Promise<CostReport> {
    await sleep(160);
    const rows: (ReportGroupRow & { status: string; at: string })[] = [];
    for (const t of byId.values()) {
      for (const c of t.claims) {
        if (c.status === 'awaiting' || c.status === 'rejected') continue;
        const rev = c.revisions?.find((r) => r.id === (c.approved_revision_id ?? c.current_revision_id));
        if (!rev) continue;
        const approved = c.status === 'approved' || c.status === 'paid';
        const dept = depts.find((d) => d.id === t.dept)?.name ?? '';
        const label = q.group_by === 'vendor' ? c.vendor ?? '' : q.group_by === 'department' ? dept : q.group_by === 'device' ? t.device : q.group_by === 'room' ? t.room : rev.created_at.slice(0, 7);
        rows.push({ key: label, label, currency: rev.currency, approved_minor: approved ? rev.total_minor : 0, pending_minor: approved ? 0 : rev.total_minor, claims: 1, tickets: 1,
          labor_minor: rev.labor_minor, parts_minor: rev.parts_minor, travel_minor: rev.travel_minor, other_minor: rev.other_minor, status: c.status, at: rev.created_at });
      }
    }
    // two fixed rows in another currency: the screen shows a section per currency and never adds them up
    rows.push({ key: 'usd-1', label: q.group_by === 'vendor' ? 'Atlas Elevators' : q.group_by === 'month' ? new Date().toISOString().slice(0, 7) : 'מעליות', currency: 'USD', approved_minor: 120_000, pending_minor: 0, claims: 1, tickets: 1, labor_minor: 80_000, parts_minor: 40_000, travel_minor: 0, other_minor: 0, status: 'approved', at: iso(Date.now() - 3 * DAY) });
    const st = q.status?.length ? q.status : ['submitted', 'approved', 'paid'];
    const kept = rows.filter((r) => st.includes(r.status as 'submitted') && (!q.currency || r.currency === q.currency) && (!q.from || r.at.slice(0, 10) >= q.from) && (!q.to || r.at.slice(0, 10) <= q.to));
    const groups = new Map<string, ReportGroupRow>();
    for (const r of kept) {
      const k = `${r.key}|${r.currency}`;
      const g = groups.get(k) ?? { key: r.key, label: r.label, currency: r.currency, approved_minor: 0, pending_minor: 0, claims: 0, tickets: 0, labor_minor: 0, parts_minor: 0, travel_minor: 0, other_minor: 0 };
      for (const f of ['approved_minor', 'pending_minor', 'claims', 'tickets', 'labor_minor', 'parts_minor', 'travel_minor', 'other_minor'] as const) g[f] += r[f];
      groups.set(k, g);
    }
    const totals = new Map<string, CostReport['totals'][number]>();
    for (const g of groups.values()) {
      const t = totals.get(g.currency) ?? { currency: g.currency, approved_minor: 0, pending_minor: 0, claims: 0, tickets: 0 };
      t.approved_minor += g.approved_minor;
      t.pending_minor += g.pending_minor;
      t.claims += g.claims;
      t.tickets += g.tickets;
      totals.set(g.currency, t);
    }
    return { group_by: q.group_by, groups: [...groups.values()], totals: [...totals.values()], claims: kept.length };
  },
  async exportCsv(q, rows) {
    await sleep(80);
    const r = await mockCosts.report(q);
    const lines = [rows === 'claim' ? 'group,currency,approved,pending,claims' : 'group,currency,kind,amount', ...r.groups.map((g) => rows === 'claim'
      ? `"${g.label}",${g.currency},${minorToDecimal(g.approved_minor)},${minorToDecimal(g.pending_minor)},${g.claims}`
      : `"${g.label}",${g.currency},labor,${minorToDecimal(g.labor_minor)}`)];
    const { saveBlob } = await import('./tickets-costs');
    saveBlob(new Blob([`﻿${lines.join('\r\n')}\r\n`], { type: 'text/csv;charset=utf-8' }), `costs-${rows}.csv`);
  },
  async departments() {
    await sleep(60);
    return { departments: clone(depts), installation: { mode: costs.mode, claim_window_days: costs.claim_window_days } };
  },
  async saveDepartment(id, body) {
    await sleep(80);
    const d = depts.find((x) => x.id === id);
    if (!d) return refuse(404, 'department_not_found', 'המחלקה לא נמצאה.');
    d.cost_claim = body.cost_claim;
    d.claim_window_days = body.claim_window_days;
    return mockCosts.departments();
  },
  async settings() {
    await sleep(40);
    return { revision: settingsRevision, costs: clone(costs) };
  },
  async saveSettings(revision, patch) {
    await sleep(80);
    if (revision !== settingsRevision) return refuse(409, 'settings_stale', 'ההגדרות השתנו בינתיים. טענו מחדש.');
    costs = { ...costs, ...patch };
    settingsRevision += 1;
    return { revision: settingsRevision, costs: clone(costs) };
  },
  async assignPreview(): Promise<AssignPreview> {
    await sleep(60);
    return { cost_claim: { default: costs.mode, from: 'installation', choices: ['required', 'optional', 'off'] } };
  },
};
