import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CostClaim, ExternalAssignment, TicketCostBlock } from '../src/api/tickets-costs';
import type { MessageDraft, Quote } from '../src/api/tickets-quotes';
import {
  askQuoteTarget, currentQuote, flowIsStaff, isMoneyAssignment, moneyClaims, moneyQuotes, olderQuotes, partialValid, quoteActions, requirementTargets, selectionTotals,
  sendDialogOf, sendPlanOf, sendTitleKey, stageView, toggleKind, VENDOR_TEXT_MAX, waitsForApprover,
} from '../src/tickets/quote-model';
import { vatOf } from '../src/tickets/cost-model';
import { QUOTE_TEXT_EN_KEYS, QUOTE_TEXT_KEYS, quoteTemplate } from '../src/tickets/quote-text';
import { demoCostBlock, mockCosts, mockQuotes } from '../src/api/tickets-costs-mock';

// TKUI3 (release 2.6.0): the Costs tab's pure rules - staff have no money surface, approvals never send a message by themselves (the
// "לשלוח הודעה לספק?" dialog defaults to not sending), partial approval, the stage stepper, the allowed kinds, and the retired cost term.
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-quotes.spec.ts

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

const vendor: ExternalAssignment = { id: 'a-v', name: 'קירור הצפון', assigned_at: '2026-10-16T08:00:00Z', ended_at: null, cost_claim: 'required', quote_mode: 'optional', quote_capable: true };
const staff: ExternalAssignment = { id: 'a-s', name: 'יוסי טכנאי', assigned_at: '2026-10-16T08:00:00Z', ended_at: null, cost_claim: 'off', quote_mode: 'optional', quote_capable: false };
const manager: TicketCostBlock = { status: 'not_required', can_view: true, can_decide: true, can_set_requirement: true };

function quote(over: Partial<Quote> = {}): Quote {
  return {
    id: 'q1', version: 1, state: 'submitted', source: 'vendor', created_at: '2026-10-16T09:00:00Z', assignment_id: 'a-v', currency: 'ILS', vat_mode: 'excluded', vat_rate_bp: 1800,
    lines: [
      { index: 0, kind: 'labor', description: 'עבודה', hours: '2', rate_minor: 20_000, total_minor: 40_000 },
      { index: 1, kind: 'parts', description: 'מדחס', quantity: '1', unit_minor: 95_000, total_minor: 95_000 },
      { index: 2, kind: 'parts', description: 'גז', quantity: '2', unit_minor: 8_500, total_minor: 17_000 },
    ],
    total_minor: 179_360, revision: 1, can: { decide: true, reject: true }, ...over,
  };
}

// ---------------------------------------------------------------- negative first: staff, sending

test('staff (an employee without an account) get NO money surface: no action, no requirement, no quote request, rows filtered', () => {
  expect(isMoneyAssignment(staff)).toBe(false);
  expect(isMoneyAssignment(vendor)).toBe(true);
  expect(isMoneyAssignment({ quote_capable: undefined }), 'an older server without the flag keeps the vendor behaviour').toBe(true);
  expect(isMoneyAssignment(null)).toBe(false);
  const flow = { stage: 'quote_optional' as const, sub_state: null, assignment_id: 'a-s', quote_mode: 'optional' as const };
  expect(flowIsStaff(flow, [staff])).toBe(true);
  expect(flowIsStaff({ ...flow, assignment_id: 'a-v' }, [vendor, staff])).toBe(false);
  // even if a server sent a decidable quote for a staff assignment, the tab offers nothing
  expect(quoteActions(quote({ assignment_id: 'a-s' }), [staff])).toEqual({ approve: false, partial: false, fix: false, reject: false });
  expect(requirementTargets([vendor, staff], manager).map((a) => a.id)).toEqual(['a-v']);
  expect(askQuoteTarget([staff], manager, flow)).toBeNull();
  const claims = [{ id: 'c1', assignment_id: 'a-s' }, { id: 'c2', assignment_id: 'a-v' }] as CostClaim[];
  expect(moneyClaims(claims, [vendor, staff]).map((c) => c.id)).toEqual(['c2']);
  expect(moneyQuotes([quote({ id: 'qs', assignment_id: 'a-s' }), quote()], [vendor, staff]).map((q) => q.id)).toEqual(['q1']);
});

test('approvals never send: the dialog needs a draft, someone to write to and the right to write; its plan is null when empty', () => {
  const draft: MessageDraft = { text: 'שלום, ההצעה אושרה.', lang: 'he', notify_default: true, send: { route: 'POST /tickets/t1/vendor-message', source: { kind: 'quote', id: 'q1' } } };
  expect(sendDialogOf(undefined, 'approved', { canWrite: true, vendor: 'קירור' })).toBeNull();
  expect(sendDialogOf(draft, 'approved', { canWrite: false, vendor: 'קירור' }), 'no tickets.external: no dialog, nothing sent').toBeNull();
  expect(sendDialogOf(draft, 'approved', { canWrite: true, vendor: null }), 'no active outside contact').toBeNull();
  const d = sendDialogOf(draft, 'approved', { canWrite: true, vendor: 'קירור' });
  expect(d).toMatchObject({ subject: 'quote', text: draft.text, notify: true, source: { kind: 'quote', id: 'q1' } });
  expect(sendPlanOf(null)).toBeNull();
  expect(sendPlanOf({ ...d!, text: '   ' }), 'an emptied draft sends nothing').toBeNull();
  expect(sendPlanOf({ ...d!, text: 'א'.repeat(VENDOR_TEXT_MAX + 1) })).toBeNull();
  expect(sendPlanOf({ ...d!, source: { kind: 'quote', id: '' } })).toBeNull();
  expect(sendPlanOf({ ...d!, text: '  נוסח ערוך  ', notify: false })).toEqual({ text: 'נוסח ערוך', notify: false, source: { kind: 'quote', id: 'q1' } });
  expect(sendTitleKey({ subject: 'quote', decision: 'partially_approved' })).toBe('sendTitle_quote_partially_approved');
  expect(sendTitleKey({ subject: 'claim', decision: 'approved_without_exceptional' })).toBe('sendTitle_claim_approved');
});

test('static guard: the Costs tab writes to the vendor in exactly one place (the explicit send), and the claim card never does', () => {
  const tab = readFileSync(path.join(SRC, 'tickets/costs-tab.ts'), 'utf8');
  expect(tab.match(/vendorMessage\(/g)?.length).toBe(1);
  const send = tab.slice(tab.indexOf('private async sendToVendor'), tab.indexOf('private notNow'));
  expect(send).toContain('vendorMessage(');
  expect(tab).not.toMatch(/forwardNote\(|sendUpdate\(/);
  const card = readFileSync(path.join(SRC, 'tickets/ticket-cost-card.ts'), 'utf8');
  expect(card).not.toMatch(/vendorMessage|conversationApi|forwardNote/);
});

// ---------------------------------------------------------------- the model

test('the stage chip and the read-only stepper follow flow.stage; without a quote mode the stepper starts at the work', () => {
  const v = stageView({ stage: 'quote_submitted', quote_mode: 'required' });
  expect(v.key).toBe('st_quote_submitted');
  expect(v.tone).toBe('warn');
  expect(v.steps.map((s) => `${s.id}:${s.state}`)).toEqual(['quote:cur', 'work:', 'demand:', 'paid:']);
  expect(stageView({ stage: 'demand_submitted', quote_mode: 'optional' }).steps.map((s) => s.state)).toEqual(['done', 'done', 'cur', '']);
  expect(stageView({ stage: 'paid', quote_mode: 'optional' }).steps.every((s) => s.state === 'done')).toBe(true);
  const off = stageView({ stage: 'work', quote_mode: 'off' });
  expect(off.steps.map((s) => `${s.id}:${s.state}`)).toEqual(['work:cur', 'demand:', 'paid:']);
  expect(stageView({ stage: 'work', quote_mode: 'off' }, true).steps.length, 'a quote that exists keeps its step').toBe(4);
  expect(stageView(undefined).steps.every((s) => s.state === '')).toBe(true);
  expect(waitsForApprover('quote_submitted') && waitsForApprover('demand_submitted') && !waitsForApprover('work')).toBe(true);
});

test('the quote that counts: approved, else the newest live one; older versions newest first', () => {
  const v1 = quote({ id: 'v1', version: 1, state: 'superseded' });
  const v2 = quote({ id: 'v2', version: 2, state: 'submitted' });
  expect(currentQuote([v1, v2], 'a-v')?.id).toBe('v2');
  const ok = quote({ id: 'v3', version: 3, state: 'partially_approved' });
  expect(currentQuote([v1, ok, v2], 'a-v')?.id).toBe('v3');
  expect(currentQuote([v1], 'a-v')?.id, 'only dead versions: the newest is still shown').toBe('v1');
  expect(currentQuote([v1, v2], 'other')).toBeUndefined();
  expect(olderQuotes([v1, v2, ok], ok).map((q) => q.id)).toEqual(['v2', 'v1']);
});

test('decisions offered: approve / partial (more than one line) / correction on a submitted quote; reject also after a correction', () => {
  expect(quoteActions(quote(), [vendor])).toEqual({ approve: true, partial: true, fix: true, reject: true });
  expect(quoteActions(quote({ lines: quote().lines!.slice(0, 1) }), [vendor]).partial).toBe(false);
  expect(quoteActions(quote({ state: 'fix_requested', can: { decide: false, reject: true } }), [vendor])).toEqual({ approve: false, partial: false, fix: false, reject: true });
  expect(quoteActions(quote({ can: { decide: false, reject: false } }), [vendor]).approve, 'the server decides (no tickets.costs)').toBe(false);
  expect(quoteActions(quote({ revision: undefined }), [vendor]).approve, 'no full view: no actions').toBe(false);
  expect(quoteActions(undefined, [vendor]).approve).toBe(false);
});

test('a partial approval keeps at least one line and leaves one out; its totals are display-only and use the quote VAT', () => {
  const q = quote();
  expect(partialValid(q, new Set([0, 1, 2])), 'all lines = a full approval').toBe(false);
  expect(partialValid(q, new Set())).toBe(false);
  expect(partialValid(q, new Set([0, 1]))).toBe(true);
  const t = selectionTotals(q, new Set([0, 1]));
  expect(t.subtotal).toBe(135_000);
  expect(t).toEqual({ subtotal: 135_000, ...(({ vat, total }) => ({ vat, total }))(vatOf(135_000, 'excluded', 1800)) });
});

test('allowed kinds: labour never leaves, the order is canonical', () => {
  expect(toggleKind(['labor', 'parts'], 'travel')).toEqual(['labor', 'parts', 'travel']);
  expect(toggleKind(['labor', 'parts', 'travel'], 'parts')).toEqual(['labor', 'travel']);
  expect(toggleKind(['labor', 'parts'], 'labor')).toEqual(['labor', 'parts']);
  expect(toggleKind(['parts'], 'other')).toEqual(['labor', 'parts', 'other']);
});

test('a manager may ask for a quote on an open vendor assignment whose quote is not required yet', () => {
  const flow = { stage: 'none' as const, sub_state: null, assignment_id: 'a-v', quote_mode: 'optional' as const };
  expect(askQuoteTarget([vendor], manager, flow)).toBe('a-v');
  expect(askQuoteTarget([{ ...vendor, quote_mode: 'required' }], manager, flow)).toBeNull();
  expect(askQuoteTarget([vendor], { ...manager, can_set_requirement: false }, flow)).toBeNull();
  expect(askQuoteTarget([{ ...vendor, ended_at: '2026-10-16T10:00:00Z' }], manager, flow)).toBeNull();
});

// ---------------------------------------------------------------- the demo store follows the contract (decisions answer a draft, send nothing)

test('demo: a partial approval answers partially_approved with a draft; the baseline is the approved part; staff ticket has no quote', async () => {
  demoCostBlock('demo-1043', 1043, 'waiting_part');
  const before = await mockCosts.get('demo-1043');
  expect(before.flow?.stage).toBe('quote_submitted');
  const q = before.quotes!.find((x) => x.state === 'submitted')!;
  const answer = await mockQuotes.decide('demo-1043', q.id, 'approve', { revision: q.revision!, line_indexes: [0, 1] });
  const fresh = answer.quotes.find((x) => x.id === q.id)!;
  expect(fresh.state).toBe('partially_approved');
  expect(fresh.approved?.line_indexes).toEqual([0, 1]);
  expect(answer.message_draft?.send.source).toEqual({ kind: 'quote', id: q.id });
  expect(answer.message_draft?.text).not.toMatch(/₪|\d{3,}/);
  expect(answer.baseline?.total_minor).toBe(fresh.approved?.total_minor);
  await expect(mockQuotes.decide('demo-1043', q.id, 'approve', { revision: q.revision! })).rejects.toMatchObject({ status: 409 });
  demoCostBlock('demo-1047', 1047, 'in_progress');
  const st = await mockCosts.get('demo-1047');
  expect(st.external_assignments?.[0].quote_capable).toBe(false);
  expect(st.quotes ?? []).toEqual([]);
});

test('demo: a demand with an exceptional line is approved without it as an adjustment, and the answer carries a draft', async () => {
  demoCostBlock('demo-1046', 1046, 'done');
  const d = await mockCosts.get('demo-1046');
  const c = d.claims[0];
  expect(c.needs_review).toBe(true);
  expect(c.revisions?.at(-1)?.exceptional?.map((e) => e.kind)).toEqual(['travel']);
  expect(c.delta_minor).toBeGreaterThan(0);
  const a = await mockCosts.decide('demo-1046', c.id, 'approve', { revision: c.revision!, revision_id: c.current_revision_id!, exceptional: 'exclude' });
  const after = a.claims[0];
  expect(after.status).toBe('approved');
  expect(after.revisions?.at(-1)?.kind).toBe('adjustment');
  expect(after.revisions?.at(-1)?.lines.some((l) => l.kind === 'travel')).toBe(false);
  expect(a.message_draft?.send.source.kind).toBe('claim');
});

// ---------------------------------------------------------------- texts

test('the Costs tab catalogue is complete; the retired cost term is in no file of the module (the vendor page excepted, TKUI5 owns it)', () => {
  expect(QUOTE_TEXT_EN_KEYS.every((k) => QUOTE_TEXT_KEYS.includes(k))).toBe(true);
  const missing = QUOTE_TEXT_KEYS.filter((k) => !QUOTE_TEXT_EN_KEYS.includes(k));
  expect(missing, missing.join(', ')).toEqual([]);
  for (const k of QUOTE_TEXT_KEYS) expect(quoteTemplate(k, 'he').trim(), k).not.toBe('');
  const files = [...readdirSync(path.join(SRC, 'tickets')).map((f) => `tickets/${f}`), ...readdirSync(path.join(SRC, 'api')).filter((f) => f.startsWith('tickets')).map((f) => `api/${f}`), 'api/notifications.ts'];
  const bad: string[] = [];
  for (const f of files.filter((x) => x.endsWith('.ts'))) {
    readFileSync(path.join(SRC, f), 'utf8').split('\n').forEach((line, i) => {
      if (/דרישת עלות|דרישת העלות|דרישות עלות/.test(line)) bad.push(`${f}:${i + 1}`);
    });
  }
  expect(bad, bad.join('\n')).toEqual([]);
});

// ---------------------------------------------------------------- TKFIX260 (release 2.6.0 review fixes)

test('TKFIX260: a decision reason says it is shown to the vendor; the internal note is a separate field that goes as internal_note', () => {
  const tab = readFileSync(path.join(SRC, 'tickets/costs-tab.ts'), 'utf8');
  expect(tab).toContain("qt('vendorSees')");
  expect(tab).toContain('data-quote-internal-note');
  expect(tab).toMatch(/internal_note: note/);
  const card = readFileSync(path.join(SRC, 'tickets/ticket-cost-card.ts'), 'utf8');
  expect(card).toContain("ct('vendorSees')");
  expect(card).toContain('data-cost-internal-note');
  expect(card).toMatch(/body\.internal_note = this\.internalNote\.trim\(\)/);
  expect(quoteTemplate('vendorSees', 'he')).toBe('יוצג למטפל החיצוני');
});

test('TKFIX260: the settings card has no "tell the vendor on approval" toggle any more (approvals never send)', () => {
  const settings = readFileSync(path.join(SRC, 'tickets/settings-costs.ts'), 'utf8');
  expect(settings).not.toContain('notify_vendor_approved');
  expect(readFileSync(path.join(SRC, 'api/tickets-costs.ts'), 'utf8')).not.toContain('notify_vendor_approved');
});

test('TKFIX260: the conversation API has no silent fallback to the old external-note route', () => {
  const conv = readFileSync(path.join(SRC, 'api/tickets-conversation.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  expect(conv).not.toContain('routeMissing');
  expect(conv).not.toMatch(/note\(id, text, true\)/);
});

test('TKFIX260: the setup-hint dismissal is reset on a session change (one user\'s choice, not the page\'s)', () => {
  const store = readFileSync(path.join(SRC, 'api/setup-hint.ts'), 'utf8');
  expect(store).toMatch(/export function resetDismissalFor\(userId: string \| null\): boolean/);
  const app = readFileSync(path.join(SRC, 'shell/sw-app.ts'), 'utf8');
  expect(app).toMatch(/resetDismissalFor\(s\.mode === 'api' \? s\.me\?\.user\.id \?\? null : null\)/);
});
