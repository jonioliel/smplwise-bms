import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-dialog';
import './ticket-cost-card';
import './quote-form'; // TKUI3B: a quote entered on the vendor's behalf
import { automationsStyles } from '../styles/automations-glass';
import { applyAutomationsGlass } from '../api/automations-demo';
import { SkinController } from '../design/skin';
import { session } from '../api/session';
import { bubbleChrome } from '../styles/bubble-chrome';
import { bidi } from '../i18n/bidi';
import { ApiError, describeError } from '../api/client';
import type { TicketDetail } from '../api/tickets';
import { LINE_KINDS, ticketCostsApi, type CostMode, type ExternalAssignment, type LineKind, type TicketCostsFull } from '../api/tickets-costs';
import { ticketQuotesApi, type MessageDraft, type Quote, type QuoteAction, type QuotesAnswer } from '../api/tickets-quotes';
import { conversationApi } from '../api/tickets-conversation';
import { bpToPercent, formatMoney, requirementEditable } from './cost-model';
import { ct, type CostTextKey } from './cost-text';
import { cIcon } from './cost-icons';
import { shortDateTime } from './model';
import { ticketsLang } from './text';
import { onTicketNames } from './naming';
import { canWriteVendor, vendorOf, type ConvTicket } from './conversation-tab';
import {
  askQuoteTarget, currentQuote, enteredByViewer, flowIsStaff, lineMark, MODES, moneyClaims, moneyQuotes, olderQuotes, onBehalfTarget, partialValid, quoteActions,
  quoteShownTotal, quoteTone, requirementTargets, selectionTotals, sendDialogOf, sendPlanOf, sendTitleKey, stageView, toggleKind, VENDOR_TEXT_MAX,
  type OnBehalfTarget, type SendDialog,
} from './quote-model';
import { qt, type QuoteTextKey } from './quote-text';
import { ticketDetailStyles, ticketFormStyles } from './styles';
import { costCardStyles, costDialogStyles } from './cost-styles';
import { costsTabStyles } from './costs-tab-styles';

type QDialog = { kind: 'approve' | 'partial' | 'fix' | 'reject'; quoteId: string } | null;

/** The ticket the tab reads: the detail plus the abilities of the detail backend (contract 8) the vendor composer also reads. */
export type CostsTicket = TicketDetail & { can: TicketDetail['can'] & { vendor_message?: boolean } };

/**
 * TKUI3 (release 2.6.0) `<ticket-costs-tab .ticket>`: the request's Costs tab (IA §4.1 / §6.3, mock-up v5 `cost()`), the ONE scroll
 * container of the tab in `<ticket-detail>`. Order: the stage chip and the read-only stepper (quote → work → demand → paid) · the vendor's
 * quote card (lines, totals, work window, the decision; approve / partial approval / ask for a correction / reject) · the approved cost
 * baseline · the payment demand (`<ticket-cost-card embedded>`: lines, VAT, the difference from the quote, the exceptional lines,
 * documents, approve with / without the exceptional lines, mark paid) · fold: the items the vendor may charge (a decider) · fold: what
 * the vendor must send (a manager: quote / payment demand required, optional or none).
 * After EVERY decision whose answer carries a `message_draft` the dialog "לשלוח הודעה לספק?" opens with the server's editable text. Its
 * default is not sending: "לא עכשיו", ✕, Esc and the backdrop write nothing; only "שלח לספק" posts the vendor message (TKUI2's
 * conversationApi().vendorMessage with the draft's `source`). Approvals never send anything by themselves.
 * Staff (an employee without an account, `quote_capable: false`) have no money surface: no quote, demand, requirement or action is
 * rendered for such an assignment. Amounts only with tickets.costs.view (the server omits them otherwise).
 * Event (bubble, composed): `cost-changed` {costs} after a write (the detail re-reads the request: its chip, the timeline).
 */
@customElement('ticket-costs-tab')
export class TicketCostsTab extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) ticket: CostsTicket | null = null;
  @state() private data: TicketCostsFull | null = null;
  @state() private failed = '';
  @state() private busy = false;
  @state() private flash: { text: string; tone: 'ok' | 'bad' } | null = null;
  @state() private dialog: QDialog = null;
  @state() private reason = '';
  @state() private internalNote = '';
  @state() private tried = false;
  @state() private err = '';
  @state() private picking: { quoteId: string; selected: Set<number> } | null = null;
  @state() private moreFor = '';
  @state() private send: SendDialog | null = null;
  @state() private sendErr = '';
  @state() private sending = false;
  /** TKUI3B: the on-behalf quote dialog is open */
  @state() private entering = false;
  private loadedKey = '';
  private flashTimer = 0;
  private offNames: (() => void) | null = null;

  static styles = [bubbleChrome, ...automationsStyles, ticketDetailStyles, ticketFormStyles, costCardStyles, costDialogStyles, costsTabStyles];

  connectedCallback(): void {
    super.connectedCallback();
    applyAutomationsGlass(this);
    this.offNames = onTicketNames(() => this.requestUpdate());
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearTimeout(this.flashTimer);
    this.offNames?.();
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (!changed.has('ticket')) return;
    const t = this.ticket;
    const key = t?.cost ? `${t.id}|${t.revision}|${t.cost.status}` : '';
    if (key && key !== this.loadedKey) {
      if (!this.loadedKey.startsWith(`${t?.id}|`)) this.resetFor();
      this.loadedKey = key;
      void this.load();
    } else if (!key) {
      this.loadedKey = '';
      this.data = null;
    }
  }

  /** A different request: nothing of the previous one survives (selection, dialogs, the send dialog). */
  private resetFor(): void {
    this.data = null;
    this.dialog = null;
    this.picking = null;
    this.moreFor = '';
    this.send = null;
    this.entering = false;
    this.failed = '';
  }

  private async load(): Promise<void> {
    const id = this.ticket?.id;
    if (!id) return;
    this.failed = '';
    try {
      const d = await ticketCostsApi().get(id);
      if (id === this.ticket?.id) this.data = d;
    } catch (e) {
      if (id === this.ticket?.id) this.failed = describeError(e);
    }
  }

  private say(text: string, tone: 'ok' | 'bad' = 'ok'): void {
    this.flash = { text, tone };
    window.clearTimeout(this.flashTimer);
    this.flashTimer = window.setTimeout(() => (this.flash = null), tone === 'bad' ? 7000 : 3500);
  }

  private money(minor: number | null | undefined, currency: string | null | undefined): string {
    return formatMoney(minor, currency, ticketsLang());
  }

  private changed(): void {
    this.dispatchEvent(new CustomEvent('cost-changed', { detail: { costs: this.data }, bubbles: true, composed: true }));
  }

  /** The vendor the send dialog writes to (the active outside contact only) and whether this viewer may write to it. */
  private vendorTarget(): { canWrite: boolean; vendor: string | null } {
    const t = this.ticket;
    if (!t) return { canWrite: false, vendor: null };
    const v = vendorOf(t);
    return { canWrite: canWriteVendor(t as unknown as ConvTicket), vendor: v?.active ? v.name : null };
  }

  /** After a decision: open "לשלוח הודעה לספק?" with the server's draft, or just say it was saved (no draft / nobody to write to). */
  private afterDecision(draft: MessageDraft | undefined, decision: string): void {
    const d = sendDialogOf(draft, decision, this.vendorTarget());
    this.sendErr = '';
    if (d) this.send = d;
    else this.say(qt('decided'));
  }

  // ---------------------------------------------------------------- writes

  /** A quote write: busy, the answer, then the whole costs answer again (the claims' baseline follows a quote decision). */
  private async quoteWrite(fn: () => Promise<QuotesAnswer>): Promise<QuotesAnswer | null> {
    if (this.busy) return null;
    this.busy = true;
    this.err = '';
    try {
      const answer = await fn();
      await this.load();
      this.changed();
      return answer;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.code === 'quote_stale') {
        this.err = qt('stale');
        await this.load();
      } else if (e instanceof ApiError && e.status === 409 && e.code === 'self_approval') {
        this.err = qt('selfApproval'); // TKUI3B: the person who entered a quote for the vendor cannot approve it
      } else {
        this.err = describeError(e);
      }
      return null;
    } finally {
      this.busy = false;
    }
  }

  private async decide(q: Quote, action: QuoteAction, extra: { line_indexes?: number[]; reason?: string; internal_note?: string } = {}): Promise<void> {
    const tid = this.ticket?.id ?? '';
    const note = this.internalNote.trim();
    if (note) extra = { ...extra, internal_note: note }; // TKFIX260: stored apart, never shown to the vendor
    const answer = await this.quoteWrite(() => ticketQuotesApi().decide(tid, q.id, action, { revision: q.revision ?? 1, ...extra }));
    if (!answer) return;
    this.dialog = null;
    this.picking = null;
    const fresh = answer.quotes.find((x) => x.id === q.id);
    this.afterDecision(answer.message_draft, fresh?.state ?? (action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'fix_requested'));
  }

  private async submitDialog(q: Quote): Promise<void> {
    const d = this.dialog;
    if (!d) return;
    this.tried = true;
    if (d.kind === 'approve') return this.decide(q, 'approve');
    if (d.kind === 'partial') {
      const sel = this.picking?.selected;
      if (!sel || !partialValid(q, sel)) return;
      return this.decide(q, 'approve', { line_indexes: (q.lines ?? []).filter((l) => sel.has(l.index)).map((l) => l.index) });
    }
    if (!this.reason.trim()) return;
    return this.decide(q, d.kind === 'fix' ? 'request-fix' : 'reject', { reason: this.reason.trim() });
  }

  private openDialog(kind: Exclude<QDialog, null>['kind'], q: Quote): void {
    this.reason = '';
    this.internalNote = '';
    this.tried = false;
    this.err = '';
    this.moreFor = '';
    this.dialog = { kind, quoteId: q.id };
  }

  private async setKinds(kinds: LineKind[] | null): Promise<void> {
    const tid = this.ticket?.id ?? '';
    const ok = await this.quoteWrite(() => ticketQuotesApi().setKinds(tid, kinds));
    if (ok) this.say(qt('decided'));
    else if (this.err) this.say(this.err, 'bad');
  }

  private async setQuoteMode(a: ExternalAssignment, mode: CostMode): Promise<void> {
    const tid = this.ticket?.id ?? '';
    const ok = await this.quoteWrite(() => ticketQuotesApi().setMode(tid, a.id, mode));
    if (ok) this.say(qt('decided'));
    else if (this.err) this.say(this.err, 'bad');
  }

  private async setClaimMode(a: ExternalAssignment, mode: CostMode): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      this.data = await ticketCostsApi().setRequirement(this.ticket?.id ?? '', a.id, mode);
      await this.load();
      this.changed();
      this.say(qt('decided'));
    } catch (e) {
      this.say(describeError(e), 'bad');
    } finally {
      this.busy = false;
    }
  }

  /** The ONLY path that writes to the vendor from this tab: the explicit "שלח לספק" of the dialog. */
  private async sendToVendor(): Promise<void> {
    const plan = sendPlanOf(this.send);
    const t = this.ticket;
    if (!plan || !t || this.sending) return;
    this.sending = true;
    this.sendErr = '';
    try {
      await conversationApi().vendorMessage(t.id, plan.text, { notify: plan.notify, source: plan.source });
      const name = this.send?.vendor ?? '';
      this.send = null;
      this.say(qt('sent', { name }));
      this.changed();
    } catch (e) {
      this.sendErr = `${qt('sendFailed')} · ${describeError(e)}`;
    } finally {
      this.sending = false;
    }
  }

  /** TKUI3B: the server accepted a quote entered for the vendor: re-read the costs, tell the manager plainly who must approve it. */
  private onEntered = (e: Event) => {
    e.stopPropagation();
    this.entering = false;
    void this.load().then(() => {
      this.changed();
      this.say(qt('obSaved'));
    });
  };

  private onFormClose = (e: Event) => {
    e.stopPropagation();
    this.entering = false;
  };

  /** The entry point of a quote on the vendor's behalf (the empty quote stage and the card's menu open the same dialog). */
  private entryButton(target: OnBehalfTarget | null, quiet = true): TemplateResult | typeof nothing {
    if (!target) return nothing;
    return html`<button type="button" class=${`btn sm${quiet ? ' quiet' : ''}`} data-ob-entry ?disabled=${this.busy} @click=${() => { this.err = ''; this.entering = true; }}>${cIcon('plus')}${qt('obEntry')}</button>`;
  }

  private onBehalfDialog(d: TicketCostsFull, target: OnBehalfTarget | null): TemplateResult | typeof nothing {
    if (!this.entering || !target || !this.ticket) return nothing;
    return html`<ticket-quote-form .ticketId=${this.ticket.id} .costs=${d} .target=${target} @quote-entered=${this.onEntered} @quote-form-close=${this.onFormClose}></ticket-quote-form>`;
  }

  private notNow = (e?: Event) => {
    e?.stopPropagation(); // the drawer around must not close with it
    if (!this.send) return;
    this.send = null;
    this.say(qt('notSent'));
  };

  private onDialogClose = (e: Event) => {
    e.stopPropagation();
    this.dialog = null;
  };

  // ---------------------------------------------------------------- render: the header

  private header(d: TicketCostsFull, hasQuote: boolean): TemplateResult {
    const v = stageView(d.flow, hasQuote);
    return html`<div class="cthead" data-cost-stage=${d.flow?.stage ?? 'none'}>
      <span class=${`chip ${v.tone}`} data-stage-chip>${qt(v.key)}${d.flow?.sub_state === 'waiting_part' ? html` · ${qt('waitingPart')}` : nothing}</span>
      ${d.flow && d.flow.stage !== 'none' ? html`<ol class="steps" aria-label=${qt('stepper')} data-stepper>${v.steps.map((s) => html`<li class=${`st ${s.state}`}
        data-step=${s.id} data-step-state=${s.state || 'todo'} aria-current=${s.state === 'cur' ? 'step' : 'false'}><i aria-hidden="true"></i>${qt(`step_${s.id}` as QuoteTextKey)}</li>`)}</ol>` : nothing}
    </div>`;
  }

  // ---------------------------------------------------------------- render: the quote

  private kindName(k: LineKind): string {
    return ct(`k_${k}` as CostTextKey);
  }

  private quoteLines(q: Quote, picking: Set<number> | null): TemplateResult {
    const cur = q.currency ?? 'ILS';
    return html`<ul class="qlines" data-quote-lines>${(q.lines ?? []).map((l) => {
      const mark = lineMark(l);
      const label = [this.kindName(l.kind), l.description].filter(Boolean).join(' · ');
      return html`<li class=${`ql ${mark === 'not' ? 'off' : ''}`} data-quote-line=${l.index} data-line-kind=${l.kind} data-line-mark=${mark || 'none'}>
        ${picking ? html`<label class="pick"><input type="checkbox" data-pick-line=${l.index} .checked=${picking.has(l.index)} @change=${(e: Event) => this.togglePick(l.index, (e.target as HTMLInputElement).checked)} /><span>${bidi(label)}</span></label>`
          : html`<span class="qd">${mark ? html`<span class=${`mk ${mark}`} aria-label=${mark === 'approved' ? qt('lineApproved') : qt('lineNotApproved')}>${cIcon(mark === 'approved' ? 'check' : 'x')}</span>` : nothing}${bidi(label)}</span>`}
        <span class="num">${this.money(l.total_minor, cur)}</span>
      </li>`;
    })}</ul>`;
  }

  private togglePick(index: number, on: boolean): void {
    if (!this.picking) return;
    const next = new Set(this.picking.selected);
    if (on) next.add(index);
    else next.delete(index);
    this.picking = { ...this.picking, selected: next };
  }

  private quoteTotals(q: Quote): TemplateResult | typeof nothing {
    if (q.total_minor === undefined) return nothing;
    const cur = q.currency ?? 'ILS';
    const vat = q.vat_mode === 'none' ? ct('vatNone') : ct('vatAt', { rate: bpToPercent(q.vat_rate_bp ?? 0) });
    if (this.picking?.quoteId === q.id) {
      const s = selectionTotals(q, this.picking.selected);
      return html`<dl class="kv qtot" data-pick-totals><dt>${ct('net')}</dt><dd>${this.money(s.subtotal, cur)}</dd><dt>${vat}</dt><dd>${this.money(s.vat, cur)}</dd>
        <dt class="tot">${qt('selectedTotal')}</dt><dd class="tot" data-pick-total>${this.money(s.total, cur)}</dd></dl>`;
    }
    const approved = q.approved && q.state === 'partially_approved';
    return html`<dl class="kv qtot" data-quote-totals>
      <dt>${ct('net')}</dt><dd>${this.money(approved ? q.approved?.subtotal_minor : q.subtotal_minor, cur)}</dd>
      <dt>${vat}</dt><dd>${this.money(approved ? q.approved?.vat_minor : q.vat_minor, cur)}</dd>
      <dt class="tot">${ct('total')}</dt><dd class="tot" data-quote-total>${this.money(quoteShownTotal(q), cur)}</dd>
      ${approved ? html`<dt class="muted">${qt('quoteFullTotal')}</dt><dd class="muted" data-quote-full-total>${this.money(q.total_minor, cur)}</dd>` : nothing}
    </dl>`;
  }

  private quoteActionsRow(q: Quote, d: TicketCostsFull, target: OnBehalfTarget | null): TemplateResult | typeof nothing {
    const a = quoteActions(q, d.external_assignments);
    // TKUI3B: a quote the viewer entered on the vendor's behalf cannot be approved by the same person (server rule `self_approval`)
    const own = enteredByViewer(q, session.me?.user.display_name);
    if (own) {
      a.approve = false;
      a.partial = false;
    }
    if (this.picking?.quoteId === q.id) {
      const ok = partialValid(q, this.picking.selected);
      return html`<div class="acts" data-pick-actions><span class="hint">${qt('pickLines')}</span>
        <button type="button" class="btn sm primary" data-pick-approve ?disabled=${this.busy || !ok} @click=${() => this.openDialog('partial', q)}>${cIcon('check')}${qt('approveSelected')}</button>
        <button type="button" class="btn sm quiet" data-pick-cancel @click=${() => (this.picking = null)}>${qt('cancel')}</button></div>`;
    }
    const ownWaiting = own && q.state === 'submitted';
    if (!a.approve && !a.partial && !a.fix && !a.reject && !target && !ownWaiting) return nothing;
    const open = this.moreFor === q.id;
    return html`<div class="acts" data-quote-actions>
      ${ownWaiting ? html`<span class="hint" data-quote-own>${cIcon('lock')}${qt('obOwn')}</span>` : nothing}
      ${a.approve ? html`<button type="button" class="btn sm primary" data-quote-approve ?disabled=${this.busy} @click=${() => this.openDialog('approve', q)}>${cIcon('check')}${qt('approveQuote')}</button>` : nothing}
      ${a.partial ? html`<button type="button" class="btn sm" data-quote-partial ?disabled=${this.busy}
        @click=${() => { this.moreFor = ''; this.picking = { quoteId: q.id, selected: new Set((q.lines ?? []).map((l) => l.index)) }; }}>${cIcon('list')}${qt('partialQuote')}</button>` : nothing}
      ${a.fix ? html`<button type="button" class="btn sm quiet" data-quote-fix ?disabled=${this.busy} @click=${() => this.openDialog('fix', q)}>${cIcon('refresh')}${qt('fixQuote')}</button>` : nothing}
      ${a.reject || target ? html`<span class="more"><button type="button" class="btn sm quiet icon" aria-label=${qt('more')} aria-expanded=${String(open)} data-quote-more
          @click=${() => (this.moreFor = open ? '' : q.id)}>…</button>
        ${open && target ? html`<button type="button" class="btn sm quiet" data-quote-on-behalf ?disabled=${this.busy} @click=${() => { this.moreFor = ''; this.err = ''; this.entering = true; }}>${cIcon('plus')}${qt('obNewVersion')}</button>` : nothing}
        ${open && a.reject ? html`<button type="button" class="btn sm quiet dz" data-quote-reject ?disabled=${this.busy} @click=${() => this.openDialog('reject', q)}>${cIcon('x')}${qt('rejectQuote')}</button>` : nothing}</span>` : nothing}
    </div>`;
  }

  private quoteCard(q: Quote, d: TicketCostsFull, target: OnBehalfTarget | null): TemplateResult {
    const decided = q.decision?.at ? qt('decidedBy', { state: qt(`qs_${q.state}` as QuoteTextKey), who: q.decision.by || '', when: shortDateTime(q.decision.at) }) : '';
    const picking = this.picking?.quoteId === q.id ? this.picking.selected : null;
    const ok = q.state === 'approved' || q.state === 'partially_approved';
    return html`<section class=${`cstage ${ok ? 'ok' : ''}`} data-quote=${q.id} data-quote-state=${q.state} aria-labelledby=${`qh-${q.id}`}>
      <div class="csh"><span class="ic">${cIcon('file')}</span><b id=${`qh-${q.id}`}>${qt('quoteTitle')}</b><span class="muted">${qt('quoteSub')}</span>
        ${q.version > 1 ? html`<span class="muted">· ${qt('quoteVersion', { n: q.version })}</span>` : nothing}
        <span class="sp"></span><span class=${`chip ${quoteTone(q.state)}`} data-quote-chip>${decided && ok ? decided : qt(`qs_${q.state}` as QuoteTextKey)}</span></div>
      <div class="meta"><span>${qt('quoteSubmitted', { when: shortDateTime(q.created_at) })}</span>
        ${q.source === 'manager' ? html`<span data-quote-by-manager>${bidi(q.created_by_name ? qt('quoteOnBehalf', { who: q.created_by_name }) : qt('obEntry'))}</span>` : nothing}
        ${q.vendor ? html`<span>${bidi(q.vendor)}</span>` : nothing}</div>
      ${q.lines ? html`${this.quoteLines(q, picking)}${this.quoteTotals(q)}` : html`<p class="muted" data-amounts-hidden>${qt('amountsHidden')}</p>`}
      ${q.work_from || q.work_to ? html`<div class="line" data-work-window><span>${qt('workWindow')}</span><span class="num">${[q.work_from, q.work_to].filter(Boolean).map((x) => shortDateTime(x as string)).join(' – ')}</span></div>` : nothing}
      ${q.vendor_ref ? html`<div class="line"><span>${qt('vendorRef')}</span><span class="num">${bidi(q.vendor_ref)}</span></div>` : nothing}
      ${q.note ? html`<p class="qnote" data-quote-note><b>${qt('quoteNote')}:</b> ${bidi(q.note)}</p>` : nothing}
      ${!ok && q.decision?.reason && (q.state === 'fix_requested' || q.state === 'rejected') ? html`<p class="why" data-quote-reason>${bidi(q.decision.reason)}</p>` : nothing}
      ${!ok && decided ? html`<div class="meta"><span>${decided}</span></div>` : nothing}
      ${this.quoteActionsRow(q, d, target)}
    </section>`;
  }

  private olderFold(list: Quote[]): TemplateResult | typeof nothing {
    if (!list.length) return nothing;
    return html`<details class="hist" data-quote-older><summary>${cIcon('refresh')}${qt('older', { n: list.length })}</summary><ol>
      ${list.map((q) => html`<li data-older-quote=${q.version}><span><b>${qt('quoteVersion', { n: q.version })}</b> · ${qt(`qs_${q.state}` as QuoteTextKey)} · ${shortDateTime(q.created_at)}</span>
        ${q.total_minor !== undefined ? html`<span class="num">${this.money(q.total_minor, q.currency)}</span>` : nothing}
        ${q.decision?.reason ? html`<span class="why">${bidi(q.decision.reason)}</span>` : nothing}</li>`)}
    </ol></details>`;
  }

  /** No quote yet but one is asked for (required) or possible (optional): the vendor sends it from the link page. */
  private quotePending(d: TicketCostsFull, target: OnBehalfTarget | null): TemplateResult | typeof nothing {
    const stage = d.flow?.stage;
    if (stage !== 'quote_requested' && stage !== 'quote_optional') return nothing;
    return html`<section class="cstage" data-quote="none" data-quote-state="none">
      <div class="csh"><span class="ic">${cIcon('file')}</span><b>${qt('quoteTitle')}</b><span class="muted">${qt('quoteSub')}</span><span class="sp"></span>
        ${stage === 'quote_requested' ? html`<span class="chip warn">${qt('quoteRequired')}</span>` : html`<span class="muted">${qt('quoteNone')}</span>`}</div>
      ${target ? html`<div class="acts" data-quote-empty-actions>${this.entryButton(target, false)}</div>` : nothing}
    </section>`;
  }

  private baselineRow(d: TicketCostsFull): TemplateResult | typeof nothing {
    const b = d.baseline;
    if (!b) return nothing;
    const kinds = (b.line_kinds ?? []).map((k) => this.kindName(k)).join(' · ');
    return html`<div class="baseline" data-baseline=${b.quote_id}><span class="ic">${cIcon('check')}</span><span><b>${qt('baseline')}</b>
      <span class="muted">${qt('baselineLine', { n: b.version, total: this.money(b.total_minor, b.currency) })}${kinds ? ` · ${kinds}` : ''}</span></span></div>`;
  }

  // ---------------------------------------------------------------- render: the folds

  private kindsFold(d: TicketCostsFull): TemplateResult | typeof nothing {
    const a = d.allowed_line_kinds;
    if (!a || !this.ticket?.cost?.can_decide) return nothing;
    return html`<details class="fold" data-kinds-fold><summary>${qt('kindsFold')} <span class="muted">(${a.kinds.map((k) => this.kindName(k)).join(' · ')})</span></summary>
      <div class="foldbody">
        <span class="muted" data-kinds-level=${a.level}>${qt(`kindsLevel_${a.level}` as QuoteTextKey)}</span>
        <div class="chipsrow" role="group" aria-label=${qt('kindsFold')}>${LINE_KINDS.map((k) => {
          const on = a.kinds.includes(k);
          const fixed = k === 'labor';
          return html`<button type="button" class=${`rc ${on ? 'on' : ''}`} aria-pressed=${String(on)} data-kind-toggle=${k} ?disabled=${this.busy || fixed}
            title=${fixed ? qt('kindsFixed') : ''} @click=${() => void this.setKinds(toggleKind(a.kinds, k))}>${cIcon(on ? 'check' : 'plus')}${this.kindName(k)}</button>`;
        })}</div>
        ${a.level === 'request' ? html`<div><button type="button" class="btn sm quiet" data-kinds-reset ?disabled=${this.busy} @click=${() => void this.setKinds(null)}>${cIcon('undo')}${qt('kindsReset')}</button></div>` : nothing}
      </div>
    </details>`;
  }

  private seg(label: string, current: CostMode, attr: string, disabled: boolean, onPick: (m: CostMode) => void): TemplateResult {
    return html`<span class="seg sm" role="radiogroup" aria-label=${label}>${MODES.map((m) => html`<button type="button" role="radio" aria-checked=${String(current === m)}
      data-mode=${`${attr}:${m}`} ?disabled=${disabled || this.busy} @click=${() => (current === m ? undefined : onPick(m))}>${qt(`m_${m}` as QuoteTextKey)}</button>`)}</span>`;
  }

  private requirementFold(d: TicketCostsFull): TemplateResult | typeof nothing {
    const rows = requirementTargets(d.external_assignments, this.ticket?.cost);
    if (!rows.length) return nothing;
    const cost = this.ticket?.cost;
    return html`<details class="fold" data-requirement-fold><summary>${qt('requirementFold')}</summary><div class="foldbody">
      ${repeat(rows, (a) => a.id, (a) => html`<div class="reqrow" data-requirement=${a.id}><span class="lbl">${bidi(a.name)}</span>
        <span class="reqpair"><span class="muted">${qt('quoteMode')}</span>${this.seg(`${qt('quoteMode')} · ${a.name}`, a.quote_mode ?? 'optional', `quote:${a.id}`, false, (m) => void this.setQuoteMode(a, m))}</span>
        <span class="reqpair"><span class="muted">${qt('claimMode')}</span>${this.seg(`${qt('claimMode')} · ${a.name}`, a.cost_claim ?? 'optional', `claim:${a.id}`, !requirementEditable(a.id, d.claims, cost), (m) => void this.setClaimMode(a, m))}</span>
      </div>`)}
    </div></details>`;
  }

  // ---------------------------------------------------------------- render: dialogs

  /** TKFIX260 (public-surface review F1): the reason of a correction request / rejection is shown to the vendor (its page and the
   * draft) - the field says so; the internal note beside it is stored apart and never sent. */
  private reasonField(label: string): TemplateResult {
    const bad = this.tried && !this.reason.trim();
    return html`<label class="fld"><span>${label} <b class="req">*</b> <span class="muted" data-quote-reason-public>· ${qt('vendorSees')}</span></span>
      <textarea class="inp" maxlength="500" data-quote-reason-input aria-invalid=${String(bad)} .value=${this.reason} @input=${(e: Event) => { this.reason = (e.target as HTMLTextAreaElement).value; this.err = ''; }}></textarea>
      ${bad ? html`<span class="err">${qt('required')}</span>` : nothing}</label>${this.internalNoteField()}`;
  }

  private internalNoteField(): TemplateResult {
    return html`<label class="fld"><span>${qt('internalNote')}</span>
      <textarea class="inp" maxlength="500" data-quote-internal-note .value=${this.internalNote} @input=${(e: Event) => (this.internalNote = (e.target as HTMLTextAreaElement).value)}></textarea></label>`;
  }

  private quoteDialog(d: TicketCostsFull): TemplateResult | typeof nothing {
    const dlg = this.dialog;
    if (!dlg) return nothing;
    const q = d.quotes?.find((x) => x.id === dlg.quoteId);
    if (!q) return nothing;
    const titles = { approve: 'approveTitle', partial: 'partialTitle', fix: 'fixTitle', reject: 'rejectTitle' } as const;
    const oks = { approve: 'approveQuote', partial: 'approveSelected', fix: 'fixQuote', reject: 'rejectQuote' } as const;
    const total = dlg.kind === 'partial' && this.picking ? selectionTotals(q, this.picking.selected).total : quoteShownTotal(q);
    const head = html`<div class="ch"><span class="who">${bidi(q.vendor ?? '')}</span><span class="sp"></span>${total !== null ? html`<span class="amt" data-dialog-total>${this.money(total, q.currency)}</span>` : nothing}</div>`;
    const body = dlg.kind === 'fix' ? this.reasonField(qt('fixReason')) : dlg.kind === 'reject' ? this.reasonField(qt('rejectReason'))
      : html`<p class="muted">${qt('approveNote')}</p>${this.internalNoteField()}`;
    return html`<sw-dialog open heading=${qt(titles[dlg.kind])} data-dialog=${`quote-${dlg.kind}`} @close=${this.onDialogClose}>
      <div class="form">${head}${body}${this.err ? html`<div class="err" role="alert" data-quote-error>${this.err}</div>` : nothing}</div>
      <div slot="footer" class="sheetfoot">
        <button type="button" class=${`btn ${dlg.kind === 'reject' ? 'danger' : 'primary'}`} data-dialog-ok ?disabled=${this.busy} @click=${() => void this.submitDialog(q)}>${qt(oks[dlg.kind])}</button>
        <button type="button" class="btn" data-dialog-cancel @click=${() => (this.dialog = null)}>${qt('back')}</button>
      </div>
    </sw-dialog>`;
  }

  /** "לשלוח הודעה לספק?" - the server's draft, editable; NOTHING is sent unless "שלח לספק" is pressed. */
  private sendDialog(): TemplateResult | typeof nothing {
    const s = this.send;
    if (!s) return nothing;
    const plan = sendPlanOf(s);
    return html`<sw-dialog open wide heading=${qt(sendTitleKey(s))} data-dialog="send-vendor" data-send-subject=${s.subject} data-send-decision=${s.decision} @close=${this.notNow}>
      <div class="form">
        <p data-send-ask>${qt('sendAsk')}</p>
        <span class="chip tag" data-send-to>${cIcon('lock')}${bidi(qt('sendTo', { name: s.vendor }))}</span>
        <label class="fld"><span>${qt('sendText')}</span>
          <textarea class="inp draft" rows="5" maxlength=${VENDOR_TEXT_MAX} dir="auto" data-send-text .value=${s.text}
            @input=${(e: Event) => { if (this.send) this.send = { ...this.send, text: (e.target as HTMLTextAreaElement).value }; this.sendErr = ''; }}></textarea></label>
        <label class="chk"><input type="checkbox" data-send-notify .checked=${s.notify} @change=${(e: Event) => { if (this.send) this.send = { ...this.send, notify: (e.target as HTMLInputElement).checked }; }} />${qt('sendNotify')}</label>
        ${this.sendErr ? html`<div class="err" role="alert" data-send-error>${this.sendErr}</div>` : nothing}
      </div>
      <div slot="footer" class="sheetfoot">
        <button type="button" class="btn primary" data-send-ok ?disabled=${this.sending || !plan} @click=${() => void this.sendToVendor()}>${cIcon('check')}${qt('sendToVendor')}</button>
        <button type="button" class="btn" data-send-cancel @click=${this.notNow}>${qt('notNow')}</button>
      </div>
    </sw-dialog>`;
  }

  // ---------------------------------------------------------------- page

  private onCardChanged = (e: Event) => {
    const costs = (e as CustomEvent<{ costs?: TicketCostsFull }>).detail?.costs;
    if (costs) this.data = { ...this.data, ...costs } as TicketCostsFull;
    // the event goes on bubbling to <ticket-detail>, which re-reads the request
  };

  private onCardDraft = (e: Event) => {
    e.stopPropagation();
    const d = (e as CustomEvent<{ draft?: MessageDraft; decision: string }>).detail;
    this.afterDecision(d?.draft, d?.decision ?? 'approved');
  };

  private onCardReload = (e: Event) => {
    e.stopPropagation();
    void this.load();
  };

  render() {
    const t = this.ticket;
    if (!t?.cost) return html`<p class="slot-note" data-costs-empty>${qt('emptyCosts')}</p>`;
    const d = this.data;
    const banner = this.flash ? html`<div class=${`banner ${this.flash.tone === 'bad' ? 'bad' : 'info'}`} role="status" data-costs-flash=${this.flash.tone}>${cIcon(this.flash.tone === 'bad' ? 'warning' : 'check')}<div>${this.flash.text}</div></div>` : nothing;
    if (this.failed && !d) {
      return html`<div class="ct" data-costs-tab data-costs-state="error"><div class="banner bad" role="alert">${cIcon('warning')}<div>${qt('loadFailed')}</div>
        <button type="button" class="btn sm" data-costs-retry @click=${() => void this.load()}>${cIcon('refresh')}${qt('retry')}</button></div></div>`;
    }
    if (!d) return html`<div class="ct" data-costs-tab data-costs-state="loading" aria-busy="true"><span class="skl" style="block-size:32px"></span><span class="skl" style="block-size:140px"></span></div>`;
    const staff = flowIsStaff(d.flow, d.external_assignments);
    const quotes = moneyQuotes(d.quotes ?? [], d.external_assignments);
    const claims = moneyClaims(d.claims, d.external_assignments);
    const shown = staff ? undefined : currentQuote(quotes, d.flow?.assignment_id);
    const empty = staff || ((!d.flow || d.flow.stage === 'none') && !quotes.length && !claims.length);
    if (empty) {
      const ask = staff ? null : askQuoteTarget(d.external_assignments, t.cost, d.flow);
      const a = ask ? d.external_assignments?.find((x) => x.id === ask) : undefined;
      const emptyTarget = staff ? null : onBehalfTarget(t, d);
      return html`<div class="ct" data-costs-tab data-costs-state=${staff ? 'staff' : 'empty'}>${banner}
        <p class="slot-note" data-costs-empty>${staff ? qt('noMoneyStaff') : qt('emptyCosts')}</p>
        ${a || emptyTarget ? html`<div class="acts">${a ? html`<button type="button" class="btn sm quiet" data-ask-quote ?disabled=${this.busy} @click=${() => void this.setQuoteMode(a, 'required')}>${cIcon('file')}${qt('askQuote')}</button>` : nothing}${this.entryButton(emptyTarget)}</div>` : nothing}
        ${staff ? nothing : this.requirementFold(d)}
        ${this.onBehalfDialog(d, emptyTarget)}
      </div>`;
    }
    const stage = d.flow?.stage ?? 'none';
    const target = onBehalfTarget(t, { ...d, quotes });
    // the payment demand: its card once a demand exists, or (a decider) from the work on - to enter one on the vendor's behalf; before
    // that, only a dim placeholder under an approved quote ("תוגש אחרי העבודה, מול ההצעה המאושרת")
    const openMoney = (d.external_assignments ?? []).some((a) => !a.ended_at && a.quote_capable !== false);
    const showCard = claims.length > 0 || (!!t.cost.can_decide && openMoney && (stage === 'work' || stage === 'quote_approved' || stage === 'demand_awaiting'));
    const demandLater = !showCard && !!d.baseline && (stage === 'quote_approved' || stage === 'work');
    return html`<div class="ct" data-costs-tab data-costs-state="ready">
      ${banner}
      ${this.header(d, !!shown)}
      ${shown ? html`${this.quoteCard(shown, d, target)}${this.olderFold(olderQuotes(quotes, shown))}` : this.quotePending(d, target)}
      ${this.baselineRow(d)}
      ${demandLater ? html`<section class="cstage dim" data-demand-later><div class="csh"><span class="ic">${cIcon('coins')}</span><b>${qt('demandTitle')}</b><span class="muted">${qt('demandLater')}</span></div></section>` : nothing}
      ${showCard ? html`<ticket-cost-card embedded .ticket=${t} .costs=${{ ...d, claims }}
        @cost-changed=${this.onCardChanged} @cost-draft=${this.onCardDraft} @cost-reload=${this.onCardReload}></ticket-cost-card>` : nothing}
      ${this.kindsFold(d)}
      ${this.requirementFold(d)}
      ${this.quoteDialog(d)}
      ${this.onBehalfDialog(d, target)}
      ${this.sendDialog()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ticket-costs-tab': TicketCostsTab;
  }
}
