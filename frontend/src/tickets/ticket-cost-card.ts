import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import '../components/sw-dialog';
import { automationsStyles } from '../styles/automations-glass';
import { applyAutomationsGlass } from '../api/automations-demo';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { bidi } from '../i18n/bidi';
import { ApiError, describeError } from '../api/client';
import type { TicketDetail } from '../api/tickets';
import {
  COST_MODES, LINE_KINDS, ticketCostsApi, type CostClaim, type CostDocument, type CostMode, type CostRevision, type DecisionAnswer, type DecisionBody, type DecisionKind,
  type LineKind, type TicketCosts, type TicketCostsFull,
} from '../api/tickets-costs';
import { claimDecisionOf, deltaTone, isMoneyAssignment, signed } from './quote-model';
import { qt, type QuoteTextKey } from './quote-text';
import {
  blankLine, bpToPercent, claimActions, costStatusTone, editLineOf, formatBytes, formatMoney, lineProblem, lineTotal, onBehalfTargets, previewTotals,
  requirementEditable, todayIso, vatModeFor, wireLine, type EditLine,
} from './cost-model';
import { ct, type CostTextKey } from './cost-text';
import { cIcon } from './cost-icons';
import { shortDateTime } from './model';
import { ticketsLang } from './text';
import { ticketDetailStyles, ticketFormStyles } from './styles';
import { costCardStyles, costDialogStyles } from './cost-styles';
import { onTicketNames } from './naming';

type Simple = 'approve' | 'reject' | 'markPaid' | 'unmarkPaid' | 'reopen';
type Dialog =
  | { kind: Simple; claimId: string }
  | { kind: 'adjust'; claimId: string }
  | { kind: 'onBehalf' }
  | { kind: 'viewer'; claimId: string; revisionId: string; docNo: number }
  | null;

interface DocDraft { kind: 'photo' | 'pdf'; files: { id: string; name: string; bytes: number }[] }
interface OnBehalfForm { assignment: string; currency: string; include: boolean; noCharge: boolean; vendorRef: string; notes: string; docs: DocDraft[] }

const ZOOMS = [1, 1.5, 2, 3];
const ACTION_OF: Record<Simple | 'adjust', DecisionKind> = { approve: 'approve', reject: 'reject', markPaid: 'mark-paid', unmarkPaid: 'unmark-paid', reopen: 'reopen-window', adjust: 'adjust' };

/**
 * CR-038 slice 9 `<ticket-cost-card .ticket>`: the "עלות" section of a ticket (section 11A.7). Everyone who sees the ticket sees the
 * status chip (`ticket.cost.status`); a holder of tickets.costs.view on its place reads the claims (GET tickets/<id>/costs): total and
 * currency, the per-kind breakdown, net / VAT / total, the vendor's reference, the amber "סכום גבוה" chip, the documents (a PDF is a
 * DOWNLOAD only - never shown inline; photographed pages open in a page viewer with "הורדה כ-PDF"), and the revision history with the
 * decisions and their reasons. With `cost.can_decide` (tickets.costs): approve, approve with an adjustment (lines; reason), reject
 * (reason), mark paid (reference + date) / remove the mark (reason), reopen the window once, enter a claim on the vendor's behalf (with
 * files); with `cost.can_set_requirement` the per-assignment requirement while nothing was submitted. Every write sends the claim's
 * `revision` (and `revision_id` where the server needs it); a 409 claim_stale reloads. No explanatory text (clean operator screens).
 * Event (bubble, composed): `cost-changed` {costs} after a write (the detail re-reads the ticket's cost chip).
 * TKUI3 (2.6.0) `embedded`: the payment-demand part of the request's Costs tab (tickets/costs-tab.ts) - the tab lends its answer
 * (`.costs`, so nothing is fetched twice; a reload is asked with `cost-reload`), the requirement rows move to the tab's fold, a staff
 * assignment (`quote_capable: false`) gets no entry on its behalf, the demand shows its baseline (the approved quote), the difference from
 * it and its exceptional lines, and an approval offers "with" / "without the exceptional lines". After an approval or a send-back the
 * server's editable draft goes up as `cost-draft` {draft, decision} - the tab asks "לשלוח הודעה לספק?"; nothing is sent from here.
 */
@customElement('ticket-cost-card')
export class TicketCostCard extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) ticket: TicketDetail | null = null;
  /** TKUI3: the Costs tab's own answer (embedded mode only) */
  @property({ attribute: false }) costs: TicketCostsFull | null = null;
  @property({ type: Boolean }) embedded = false;
  @state() private data: TicketCosts | null = null;
  @state() private failed = '';
  @state() private busy = false;
  @state() private dialog: Dialog = null;
  @state() private flash: { text: string; tone: 'ok' | 'bad' } | null = null;
  @state() private reason = '';
  @state() private payRef = '';
  @state() private payDate = todayIso();
  @state() private lines: EditLine[] = [];
  @state() private form: OnBehalfForm | null = null;
  @state() private uploading = 0;
  @state() private err = '';
  @state() private tried = false;
  @state() private page = 0;
  @state() private zoom = 0;
  @state() private turn = 0;
  private loadedKey = '';
  private flashTimer = 0;
  private offNames: (() => void) | null = null;

  static styles = [bubbleChrome, ...automationsStyles, ticketDetailStyles, ticketFormStyles, costCardStyles, costDialogStyles];

  connectedCallback() {
    super.connectedCallback();
    applyAutomationsGlass(this);
    this.offNames = onTicketNames(() => this.requestUpdate());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearTimeout(this.flashTimer);
    this.offNames?.();
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (this.embedded) {
      if (changed.has('costs')) this.data = this.costs;
      return;
    }
    if (!changed.has('ticket')) return;
    const t = this.ticket;
    const key = t?.cost?.can_view ? `${t.id}|${t.revision}|${t.cost.status}` : '';
    if (key && key !== this.loadedKey) {
      if (!this.loadedKey.startsWith(`${t?.id}|`)) this.data = null;
      this.loadedKey = key;
      void this.load();
    } else if (!key) {
      this.loadedKey = '';
      this.data = null;
    }
  }

  private async load(): Promise<void> {
    if (this.embedded) {
      this.dispatchEvent(new CustomEvent('cost-reload', { bubbles: true, composed: true }));
      return;
    }
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

  private claim(id: string): CostClaim | undefined {
    return this.data?.claims.find((c) => c.id === id);
  }

  private currentRev(c: CostClaim): CostRevision | undefined {
    return c.revisions?.find((r) => r.id === c.current_revision_id);
  }

  private uiLang(): 'he' | 'en' {
    return ticketsLang();
  }

  private money(minor: number | null | undefined, currency: string | null | undefined): string {
    return formatMoney(minor, currency, this.uiLang());
  }

  // ---------------------------------------------------------------- writes

  /** One write: the busy flag, the new answer, `cost-changed`; a 409 claim_stale reloads and says so; other refusals stay in the dialog. */
  private async write(fn: () => Promise<TicketCosts | DecisionAnswer>, decision?: 'approve' | 'adjust' | 'reject'): Promise<boolean> {
    if (this.busy) return false;
    this.busy = true;
    this.err = '';
    try {
      const answer: DecisionAnswer = await fn();
      const { message_draft: draft, ...costs } = answer;
      this.data = costs;
      this.dispatchEvent(new CustomEvent('cost-changed', { detail: { costs: this.data }, bubbles: true, composed: true }));
      // TKUI3: the decision's editable draft goes to the Costs tab, which ASKS before anything is sent (owner 15.10 evening)
      if (decision && this.embedded) this.dispatchEvent(new CustomEvent('cost-draft', { detail: { draft, decision: claimDecisionOf(decision) }, bubbles: true, composed: true }));
      else this.say(ct('saved'));
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.body.code === 'claim_stale') {
        this.err = ct('stale');
        await this.load();
      } else {
        this.err = describeError(e);
      }
      return false;
    } finally {
      this.busy = false;
    }
  }

  private open(d: Exclude<Dialog, null>): void {
    this.reason = '';
    this.payRef = '';
    this.payDate = todayIso();
    this.err = '';
    this.tried = false;
    this.page = 0;
    this.zoom = 0;
    this.turn = 0;
    if (d.kind === 'adjust') {
      const c = this.claim(d.claimId);
      const rev = c ? this.currentRev(c) : undefined;
      this.lines = rev?.lines.length ? rev.lines.map(editLineOf) : [blankLine('labor', c?.labor_rate_minor)];
    }
    if (d.kind === 'onBehalf') {
      const targets = this.onBehalfIds();
      const claim = this.data?.claims.find((c) => c.assignment_id === targets.at(-1));
      this.form = { assignment: targets.at(-1) ?? '', currency: claim?.currency ?? this.data?.settings?.currencies[0] ?? 'ILS', include: false, noCharge: false, vendorRef: '', notes: '', docs: [] };
      this.lines = [blankLine('labor', claim?.labor_rate_minor)];
    }
    this.dialog = d;
  }

  private close(): void {
    this.dialog = null;
    this.form = null;
  }

  private onDialogClose = (e: Event) => {
    e.stopPropagation(); // the drawer around must not close with it
    this.close();
  };

  private async submitSimple(kind: Simple, c: CostClaim, exceptional?: 'include' | 'exclude'): Promise<void> {
    this.tried = true;
    const body: DecisionBody = { revision: c.revision ?? 1 };
    if (kind === 'approve' || kind === 'reject') body.revision_id = c.current_revision_id ?? undefined;
    if (kind === 'approve' && exceptional) body.exceptional = exceptional; // TKDETAILBE 5.3: with / without the exceptional lines
    if (kind === 'reject' || kind === 'unmarkPaid') {
      if (!this.reason.trim()) return;
      body.reason = this.reason.trim();
    }
    if (kind === 'markPaid') {
      if (!this.payRef.trim() || !this.payDate) return;
      body.payment_ref = this.payRef.trim();
      body.payment_date = this.payDate;
    }
    const tid = this.ticket?.id ?? '';
    const decision = kind === 'approve' || kind === 'reject' ? kind : undefined;
    if (await this.write(() => ticketCostsApi().decide(tid, c.id, ACTION_OF[kind], body), decision)) this.close();
  }

  private async submitAdjust(c: CostClaim): Promise<void> {
    this.tried = true;
    if (!this.reason.trim() || !this.lines.length || this.lines.some((l) => lineProblem(l))) return;
    const tid = this.ticket?.id ?? '';
    const body: DecisionBody = { revision: c.revision ?? 1, revision_id: c.current_revision_id ?? undefined, reason: this.reason.trim(), lines: this.lines.map(wireLine) };
    if (await this.write(() => ticketCostsApi().decide(tid, c.id, 'adjust', body), 'adjust')) this.close();
  }

  private async submitOnBehalf(): Promise<void> {
    const f = this.form;
    if (!f) return;
    this.tried = true;
    if (!f.noCharge && (!this.lines.length || this.lines.some((l) => lineProblem(l)))) return;
    if (this.uploading) return;
    const tid = this.ticket?.id ?? '';
    const exempt = !!this.data?.claims.find((c) => c.assignment_id === f.assignment)?.vat_exempt;
    const ok = await this.write(() => ticketCostsApi().onBehalf(tid, {
      ...(f.assignment ? { assignment_id: f.assignment } : {}),
      lines: f.noCharge ? [] : this.lines.map(wireLine),
      currency: f.currency,
      ...(exempt || f.noCharge ? {} : { amounts_include_vat: f.include }),
      ...(f.vendorRef.trim() ? { vendor_ref: f.vendorRef.trim() } : {}),
      ...(f.notes.trim() ? { notes: f.notes.trim() } : {}),
      no_charge: f.noCharge,
      documents: f.docs.map((d) => ({ file_ids: d.files.map((x) => x.id) })),
    }));
    if (ok) this.close();
  }

  /** Files of the on-behalf entry: each PDF is a document of its own; the photos picked together are the pages of one document. */
  private async onFiles(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = '';
    const f = this.form;
    const tid = this.ticket?.id;
    if (!f || !tid || !files.length) return;
    const pdfs = files.filter((x) => x.type === 'application/pdf' || /\.pdf$/i.test(x.name));
    const photos = files.filter((x) => !pdfs.includes(x));
    const need = pdfs.length + (photos.length ? 1 : 0);
    if (f.docs.length + need > 3) {
      this.err = ct('tooManyDocs');
      return;
    }
    if (photos.length > 10) {
      this.err = ct('tooManyPages');
      return;
    }
    this.err = '';
    const up = async (file: File) => {
      this.uploading += 1;
      try {
        const r = await ticketCostsApi().uploadFile(tid, file);
        return { id: r.id, name: file.name, bytes: r.bytes };
      } finally {
        this.uploading -= 1;
      }
    };
    try {
      const docs: DocDraft[] = [];
      for (const p of pdfs) docs.push({ kind: 'pdf', files: [await up(p)] });
      if (photos.length) {
        const pages: DocDraft['files'] = [];
        for (const p of photos) pages.push(await up(p));
        docs.push({ kind: 'photo', files: pages });
      }
      if (this.form) this.form = { ...this.form, docs: [...this.form.docs, ...docs] };
    } catch (err) {
      this.err = describeError(err);
    }
  }

  private async setRequirement(assignmentId: string, mode: CostMode): Promise<void> {
    const tid = this.ticket?.id ?? '';
    const ok = await this.write(() => ticketCostsApi().setRequirement(tid, assignmentId, mode));
    if (!ok && this.err) {
      this.say(this.err, 'bad');
      this.err = '';
    }
  }

  private async download(fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (e) {
      this.say(describeError(e), 'bad');
    }
  }

  private onBehalfIds(): string[] {
    // TKUI3 / TKSTAFF1: never a payment demand on behalf of a staff assignment (an employee without an account has no money surface)
    const money = (this.data?.external_assignments ?? []).filter(isMoneyAssignment);
    return onBehalfTargets(this.data?.claims ?? [], money, this.ticket?.cost);
  }

  // ---------------------------------------------------------------- render: the claim

  private statusChip(status: string, attr = 'data-cost-status'): TemplateResult {
    const tone = costStatusTone(status as CostClaim['status']);
    return html`<span class=${`chip ${tone}`} ${attr === 'data-claim-chip' ? 'data-claim-chip' : ''} data-cost-status=${status}>${ct(`cs_${status}` as CostTextKey)}</span>`;
  }

  private breakdown(rev: CostRevision): TemplateResult {
    const kinds = LINE_KINDS.filter((k) => rev[`${k}_minor` as `${LineKind}_minor`] > 0);
    const vatLabel = rev.vat_mode === 'none' ? ct('vatNone') : ct('vatAt', { rate: bpToPercent(rev.vat_rate_bp) });
    return html`<dl class="kv" data-breakdown>
      ${kinds.map((k) => html`<dt>${ct(`k_${k}` as CostTextKey)}</dt><dd data-kind=${k}>${this.money(rev[`${k}_minor` as `${LineKind}_minor`], rev.currency)}</dd>`)}
      <dt>${ct('net')}</dt><dd data-net>${this.money(rev.net_minor, rev.currency)}</dd>
      <dt>${vatLabel}</dt><dd data-vat>${this.money(rev.vat_minor, rev.currency)}</dd>
      <dt class="tot">${ct('total')}</dt><dd class="tot" data-total>${this.money(rev.total_minor, rev.currency)}</dd>
      ${rev.vendor_ref ? html`<dt>${ct('vendorRef')}</dt><dd data-vendor-ref>${bidi(rev.vendor_ref)}</dd>` : nothing}
    </dl>`;
  }

  private documents(c: CostClaim, rev: CostRevision): TemplateResult | typeof nothing {
    if (!rev.documents.length) return nothing;
    const tid = this.ticket?.id ?? '';
    return html`<div class="docs" data-documents>${rev.documents.map((d) => this.docRow(tid, c, rev, d))}</div>`;
  }

  private docRow(tid: string, c: CostClaim, rev: CostRevision, d: CostDocument): TemplateResult {
    if (d.kind === 'pdf') {
      const f = d.pages[0];
      return html`<div class="doc" data-doc=${d.no} data-doc-kind="pdf">
        <span class="dl">${cIcon('file')}${ct('docN', { n: d.no })}<small>${ct('pdf')} · ${formatBytes(f?.bytes ?? 0)}</small></span><span class="sp"></span>
        <button type="button" class="btn sm" data-pdf-download ?disabled=${!f} @click=${() => f && void this.download(() => ticketCostsApi().downloadFile(tid, f.id))}>${cIcon('download')}${ct('download')}</button>
      </div>`;
    }
    const api = ticketCostsApi();
    return html`<div class="doc" data-doc=${d.no} data-doc-kind="photo">
      <span class="dl">${cIcon('pages')}${ct('docN', { n: d.no })}<small>${ct('pagesN', { n: d.pages.length })}</small></span>
      <span class="thumbs">${d.pages.slice(0, 3).map((p, i) => html`<button type="button" class="thumb" data-thumb=${i} aria-label=${ct('pageAlt', { n: i + 1 })}
        @click=${() => { this.open({ kind: 'viewer', claimId: c.id, revisionId: rev.id, docNo: d.no }); this.page = i; }}><img src=${api.pageUrl(tid, p.id)} alt="" loading="lazy" decoding="async" /></button>`)}</span>
      <span class="sp"></span>
      <button type="button" class="btn sm quiet" data-doc-open @click=${() => this.open({ kind: 'viewer', claimId: c.id, revisionId: rev.id, docNo: d.no })}>${ct('open')}</button>
      <button type="button" class="btn sm" data-doc-pdf @click=${() => void this.download(() => api.downloadDocument(tid, c.id, rev.id, d.no))}>${cIcon('download')}${ct('downloadPdf')}</button>
    </div>`;
  }

  private history(c: CostClaim): TemplateResult | typeof nothing {
    const revs = c.revisions ?? [];
    const decs = c.decisions ?? [];
    if (!revs.length && !decs.length) return nothing;
    type Row = { at: string; tpl: TemplateResult; dec: boolean };
    const rows: Row[] = [
      ...revs.map((r) => {
        const src = r.kind === 'adjustment' ? ct('src_adjustment') : r.kind === 'on_behalf' ? ct('src_on_behalf') : ct('src_vendor');
        const who = r.created_by_name ? ` · ${r.created_by_name}` : '';
        return { at: r.created_at, dec: false, tpl: html`<li data-hist-rev=${r.seq}><span><b>${ct('revN', { n: r.seq })}</b> · ${src}${bidi(who)} · ${shortDateTime(r.created_at)}</span>
          <span>${r.no_charge ? ct('noCharge') : this.money(r.total_minor, r.currency)}</span>${r.reason ? html`<span class="why">${r.reason}</span>` : nothing}</li>` };
      }),
      ...decs.map((d) => ({ at: d.at, dec: true, tpl: html`<li class="dec" data-hist-dec=${d.action}><span><b>${ct(`d_${d.action}` as CostTextKey)}</b>${d.by ? html` · ${bidi(d.by)}` : nothing} · ${shortDateTime(d.at)}</span>
        ${d.amount_minor !== null && (d.action === 'approve' || d.action === 'adjust') ? html`<span>${this.money(d.amount_minor, c.currency)}</span>` : nothing}
        ${d.payment_ref ? html`<span>${ct('paymentRef')}: ${bidi(d.payment_ref)}</span>` : nothing}
        ${d.reason && d.action !== 'requirement' ? html`<span class="why">${d.reason}</span>` : d.action === 'requirement' && d.reason ? html`<span>${ct(`m_${d.reason}` as CostTextKey)}</span>` : nothing}</li>` })),
    ].sort((a, b) => b.at.localeCompare(a.at));
    return html`<details class="hist" data-history><summary>${cIcon('refresh')}${ct('history')} (${rows.length})</summary><ol>${rows.map((r) => r.tpl)}</ol></details>`;
  }

  /** TKUI3: the demand against the approved quote - the baseline line, the difference, the exceptional lines with their review state. */
  private againstQuote(c: CostClaim, rev: CostRevision | undefined): TemplateResult | typeof nothing {
    const exc = rev?.exceptional ?? [];
    if (!c.baseline && !exc.length) return nothing;
    const cur = rev?.currency ?? c.currency;
    return html`<div class="vsq" data-against-quote>
      ${c.baseline ? html`<div class="vline" data-claim-baseline=${c.baseline.quote_id}><span>${qt('againstQuote', { n: c.baseline.version, total: this.money(c.baseline.total_minor, c.baseline.currency) })}</span></div>` : nothing}
      ${exc.length ? html`<ul class="exc" aria-label=${qt('exceptional')} data-exceptional>${exc.map((e) => html`<li data-exc=${e.index} data-exc-kind=${e.kind} data-exc-review=${e.review ?? 'none'}>
        <span class="el">${cIcon('warning')}${bidi([ct(`k_${e.kind}` as CostTextKey), e.description].filter(Boolean).join(' · '))}
          <span class=${`chip ${e.review === 'pending' ? 'warn' : e.review === 'excluded' ? '' : e.review === 'accepted' ? 'ok' : 'warn'}`}>${qt(e.review ? (`exc_${e.review}` as QuoteTextKey) : (`exc_${e.reason}` as QuoteTextKey))}</span></span>
        <span class="num">${this.money(e.total_minor, cur)}</span></li>`)}</ul>` : nothing}
      ${c.delta_minor !== null && c.delta_minor !== undefined ? html`<div class=${`vline delta ${deltaTone(c.delta_minor)}`} data-claim-delta=${c.delta_minor}><span>${qt('delta')}</span>
        <span class="num">${signed(c.delta_minor, (m) => this.money(m, cur))}</span></div>` : nothing}
    </div>`;
  }

  private claimBlock(c: CostClaim, many: boolean): TemplateResult {
    const rev = this.currentRev(c);
    const a = claimActions(c, this.ticket?.cost);
    const emb = this.embedded;
    const name = [c.vendor, c.contact_name].filter(Boolean).join(' · ');
    const late = (c.status === 'awaiting' || c.status === 'rejected') && !c.window_open;
    return html`<div class=${`claim${c.high_amount ? ' high' : ''}`} data-claim=${c.id} data-claim-status=${c.status}>
      <div class="ch">
        ${name ? html`<span class="who">${bidi(name)}</span>` : nothing}
        ${many ? this.statusChip(c.status) : nothing}
        ${c.high_amount ? html`<span class="chip warn" data-high-amount>${cIcon('warning')}${ct('highAmount')}</span>` : nothing}
        ${c.no_charge ? html`<span class="chip" data-no-charge>${ct('noCharge')}</span>` : nothing}
        <span class="sp"></span>
        ${c.total_minor !== null && c.total_minor !== undefined ? html`<span class="amt" data-claim-total>${this.money(c.total_minor, c.currency)}</span>` : nothing}
      </div>
      ${rev && !c.no_charge ? this.breakdown(rev) : nothing}
      ${this.againstQuote(c, rev)}
      <div class="meta">
        ${c.status === 'awaiting' || c.status === 'rejected' ? html`<span class=${late ? 'late' : ''} data-window>${late ? ct('windowClosed') : ct('until', { when: shortDateTime(c.claim_until) })}</span>` : nothing}
        ${c.approved_at ? html`<span data-approved>${ct('approvedBy', { when: shortDateTime(c.approved_at), who: c.approved_by ?? '' })}</span>` : nothing}
        ${c.status === 'paid' ? html`<span data-paid>${ct('paidOn', { date: c.payment_date ?? '', ref: c.payment_ref ?? '' })}</span>` : nothing}
      </div>
      ${rev ? this.documents(c, rev) : nothing}
      ${Object.values(a).some(Boolean) ? html`<div class="acts" data-claim-actions>
        ${a.approve ? html`<button type="button" class="btn sm primary" data-cost-approve ?disabled=${this.busy} @click=${() => this.open({ kind: 'approve', claimId: c.id })}>${cIcon('check')}${emb ? qt(c.needs_review ? 'approveWithExc' : 'approveDemand') : ct('approve')}</button>` : nothing}
        ${a.approve && emb && c.needs_review ? html`<button type="button" class="btn sm" data-cost-approve-noexc ?disabled=${this.busy} @click=${() => this.open({ kind: 'approve', claimId: c.id })}>${cIcon('check')}${qt('approveNoExc')}</button>` : nothing}
        ${a.adjust ? html`<button type="button" class="btn sm" data-cost-adjust ?disabled=${this.busy} @click=${() => this.open({ kind: 'adjust', claimId: c.id })}>${cIcon('edit')}${ct('adjust')}</button>` : nothing}
        ${a.reject ? html`<button type="button" class="btn sm quiet dz" data-cost-reject ?disabled=${this.busy} @click=${() => this.open({ kind: 'reject', claimId: c.id })}>${cIcon(emb ? 'refresh' : 'x')}${emb ? qt('fixDemand') : ct('reject')}</button>` : nothing}
        ${a.markPaid ? html`<button type="button" class="btn sm primary" data-cost-paid ?disabled=${this.busy} @click=${() => this.open({ kind: 'markPaid', claimId: c.id })}>${cIcon('paid')}${ct('markPaid')}</button>` : nothing}
        ${a.unmarkPaid ? html`<button type="button" class="btn sm quiet" data-cost-unpaid ?disabled=${this.busy} @click=${() => this.open({ kind: 'unmarkPaid', claimId: c.id })}>${cIcon('undo')}${ct('unmarkPaid')}</button>` : nothing}
        ${a.reopen ? html`<button type="button" class="btn sm" data-cost-reopen ?disabled=${this.busy} @click=${() => this.open({ kind: 'reopen', claimId: c.id })}>${cIcon('refresh')}${ct('reopen')}</button>` : nothing}
      </div>` : nothing}
      ${this.history(c)}
    </div>`;
  }

  /** "דרישת תשלום: חובה / רשות / בלי" of each external assignment that has no submitted claim yet (a manager of the ticket). */
  private requirementRows(): TemplateResult | typeof nothing {
    const d = this.data;
    const cost = this.ticket?.cost;
    if (this.embedded || !d || !cost?.can_set_requirement) return nothing; // TKUI3: the Costs tab has its own requirement fold
    const rows = (d.external_assignments ?? []).filter((a) => !a.ended_at && requirementEditable(a.id, d.claims, cost));
    if (!rows.length) return nothing;
    return html`${rows.map((a) => html`<div class="reqrow" data-requirement=${a.id}><span class="lbl">${ct('mode')} · ${bidi(a.name)}</span>
      <span class="seg sm" role="radiogroup" aria-label=${`${ct('mode')} · ${a.name}`}>${COST_MODES.map((m) => html`<button type="button" role="radio" aria-checked=${String((a.cost_claim ?? '') === m)}
        data-requirement-mode=${m} ?disabled=${this.busy} @click=${() => (a.cost_claim === m ? undefined : void this.setRequirement(a.id, m))}>${ct(`m_${m}` as CostTextKey)}</button>`)}</span></div>`)}`;
  }

  // ---------------------------------------------------------------- render: dialogs

  private reasonField(label = ct('reason')): TemplateResult {
    const bad = this.tried && !this.reason.trim();
    return html`<label class="fld"><span>${label} <b class="req">*</b></span>
      <textarea class="inp" maxlength="500" data-cost-reason aria-invalid=${String(bad)} .value=${this.reason} @input=${(e: Event) => { this.reason = (e.target as HTMLTextAreaElement).value; this.err = ''; }}></textarea>
      ${bad ? html`<span class="err">${ct('required')}</span>` : nothing}</label>`;
  }

  private foot(ok: TemplateResult): TemplateResult {
    return html`<div slot="footer" class="sheetfoot">${ok}<button type="button" class="btn" data-dialog-cancel @click=${() => this.close()}>${ct('back')}</button></div>`;
  }

  private errRow(): TemplateResult | typeof nothing {
    return this.err ? html`<div class="err" role="alert" data-cost-error>${this.err}</div>` : nothing;
  }

  private setLine(i: number, patch: Partial<EditLine>): void {
    this.lines = this.lines.map((l, j) => (j === i ? { ...l, ...patch } : l));
    this.err = '';
  }

  private lineEditor(currency: string, rateMinor: number | null | undefined): TemplateResult {
    const field = (i: number, l: EditLine, key: keyof EditLine, label: string, mode: 'decimal' | 'text', wide = false) => {
      const bad = this.tried && lineProblem(l) === key;
      return html`<label class=${`fld${wide ? ' wide' : ''}`}><span>${label}</span><input class="inp" inputmode=${mode} maxlength=${key === 'description' ? 120 : 12} data-line-field=${key}
        dir=${mode === 'decimal' ? 'ltr' : 'auto'} aria-invalid=${String(bad)} .value=${l[key]} @input=${(e: Event) => this.setLine(i, { [key]: (e.target as HTMLInputElement).value } as Partial<EditLine>)} /></label>`;
    };
    return html`<div class="lines" data-lines>
      ${this.lines.map((l, i) => {
        const total = lineTotal(l);
        const bad = this.tried && !!lineProblem(l);
        return html`<div class="line" data-line=${i} data-line-kind=${l.kind} aria-invalid=${String(bad)}>
          <label class="fld"><span>${ct('lineKind')}</span><select class="inp" data-line-kind-select @change=${(e: Event) => { const k = (e.target as HTMLSelectElement).value as LineKind; this.lines = this.lines.map((x, j) => (j === i ? { ...blankLine(k, rateMinor), description: x.description } : x)); }}>
            ${LINE_KINDS.map((k) => html`<option value=${k} ?selected=${k === l.kind}>${ct(`k_${k}` as CostTextKey)}</option>`)}</select></label>
          ${field(i, l, 'description', ct('description'), 'text', true)}
          ${l.kind === 'labor' ? html`${field(i, l, 'hours', ct('hours'), 'decimal')}${field(i, l, 'rate', ct('rate'), 'decimal')}`
            : l.kind === 'parts' ? html`${field(i, l, 'quantity', ct('quantity'), 'decimal')}${field(i, l, 'unit_price', ct('unitPrice'), 'decimal')}`
            : html`${field(i, l, 'amount', ct('amount'), 'decimal')}<span></span>`}
          <button type="button" class="btn sm quiet rmv" aria-label=${ct('removeLine')} data-line-remove ?disabled=${this.lines.length < 2} @click=${() => (this.lines = this.lines.filter((_, j) => j !== i))}>${cIcon('x')}</button>
          <span class="lt" data-line-total>${ct('lineTotal')}: ${total === null ? '—' : this.money(total, currency)}</span>
        </div>`;
      })}
      <div><button type="button" class="btn sm" data-line-add ?disabled=${this.lines.length >= 30} @click=${() => (this.lines = [...this.lines, blankLine('parts', rateMinor)])}>${cIcon('plus')}${ct('addLine')}</button></div>
    </div>`;
  }

  private preview(mode: CostRevision['vat_mode'], rateBp: number, currency: string): TemplateResult {
    const t = previewTotals(this.lines, mode, rateBp);
    const v = (n: number | undefined) => (t && n !== undefined ? this.money(n, currency) : '—');
    return html`<dl class="preview" data-preview>
      <dt>${ct('net')}</dt><dd data-preview-net>${v(t?.net)}</dd>
      <dt>${mode === 'none' ? ct('vatNone') : ct('vatAt', { rate: bpToPercent(rateBp) })}</dt><dd data-preview-vat>${v(t?.vat)}</dd>
      <dt class="tot">${ct('total')}</dt><dd class="tot" data-preview-total>${v(t?.total)}</dd>
    </dl>`;
  }

  private viewer(d: Extract<Dialog, { kind: 'viewer' }>): TemplateResult {
    const c = this.claim(d.claimId);
    const rev = c?.revisions?.find((r) => r.id === d.revisionId);
    const doc = rev?.documents.find((x) => x.no === d.docNo);
    const tid = this.ticket?.id ?? '';
    const pages = doc?.pages ?? [];
    const i = Math.min(this.page, Math.max(0, pages.length - 1));
    const p = pages[i];
    const api = ticketCostsApi();
    const transform = `rotate(${this.turn * 90}deg) scale(${ZOOMS[this.zoom]})`;
    return html`<sw-dialog open wide heading=${ct('docN', { n: d.docNo })} data-dialog="cost-viewer" @close=${this.onDialogClose}>
      <div class="viewer">
        <div class="vbar">
          <button type="button" class="btn sm quiet" aria-label=${ct('prev')} data-viewer-prev ?disabled=${i <= 0} @click=${() => (this.page = i - 1)}>${cIcon('prev')}</button>
          <span class="pg" data-viewer-page>${ct('pageOf', { n: i + 1, m: pages.length })}</span>
          <button type="button" class="btn sm quiet" aria-label=${ct('next')} data-viewer-next ?disabled=${i >= pages.length - 1} @click=${() => (this.page = i + 1)}>${cIcon('next')}</button>
          <span class="sp"></span>
          <button type="button" class="btn sm quiet" aria-label=${ct('zoomOut')} data-viewer-zoom-out ?disabled=${this.zoom === 0} @click=${() => (this.zoom -= 1)}>${cIcon('zoomOut')}</button>
          <button type="button" class="btn sm quiet" aria-label=${ct('zoomIn')} data-viewer-zoom-in ?disabled=${this.zoom === ZOOMS.length - 1} @click=${() => (this.zoom += 1)}>${cIcon('zoomIn')}</button>
          <button type="button" class="btn sm quiet" aria-label=${ct('rotate')} data-viewer-rotate @click=${() => (this.turn = (this.turn + 1) % 4)}>${cIcon('rotate')}</button>
        </div>
        <div class="stage" data-viewer-stage>${p ? html`<img src=${api.pageUrl(tid, p.id)} alt=${ct('pageAlt', { n: i + 1 })} data-viewer-img data-turn=${this.turn * 90} style=${styleMap({ transform })} />` : nothing}</div>
        ${pages.length > 1 ? html`<div class="thumbs" role="tablist">${pages.map((x, j) => html`<button type="button" class="thumb" role="tab" aria-selected=${String(j === i)} aria-current=${String(j === i)} aria-label=${ct('pageAlt', { n: j + 1 })} @click=${() => (this.page = j)}>
          <img src=${api.pageUrl(tid, x.id)} alt="" loading="lazy" decoding="async" /></button>`)}</div>` : nothing}
      </div>
      <div slot="footer" class="sheetfoot">
        <button type="button" class="btn primary" data-viewer-pdf ?disabled=${!c || !rev} @click=${() => c && rev && void this.download(() => api.downloadDocument(tid, c.id, rev.id, d.docNo))}>${cIcon('download')}${ct('downloadPdf')}</button>
        <button type="button" class="btn" data-dialog-cancel @click=${() => this.close()}>${ct('back')}</button>
      </div>
    </sw-dialog>`;
  }

  private onBehalfDialog(): TemplateResult | typeof nothing {
    const f = this.form;
    const d = this.data;
    if (!f || !d) return nothing;
    const set = (patch: Partial<OnBehalfForm>) => { this.form = { ...f, ...patch }; this.err = ''; };
    const targets = (d.external_assignments ?? []).filter((a) => this.onBehalfIds().includes(a.id));
    const claim = d.claims.find((c) => c.assignment_id === f.assignment);
    const exempt = !!claim?.vat_exempt;
    const currencies = d.settings?.currencies ?? ['ILS'];
    const rateBp = d.settings?.vat_rate_bp ?? 1800;
    return html`<sw-dialog open wide heading=${ct('onBehalfTitle')} data-dialog="cost-on-behalf" @close=${this.onDialogClose}>
      <div class="form">
        ${targets.length > 1 ? html`<label class="fld"><span>${ct('assignment')}</span><select class="inp" data-ob-assignment @change=${(e: Event) => set({ assignment: (e.target as HTMLSelectElement).value })}>
          ${targets.map((a) => html`<option value=${a.id} ?selected=${a.id === f.assignment}>${a.name}</option>`)}</select></label>` : nothing}
        <div class="two">
          ${currencies.length > 1 ? html`<label class="fld"><span>${ct('currency')}</span><select class="inp" data-ob-currency @change=${(e: Event) => set({ currency: (e.target as HTMLSelectElement).value })}>
            ${currencies.map((x) => html`<option value=${x} ?selected=${x === f.currency}>${x}</option>`)}</select></label>` : nothing}
          ${!exempt && !f.noCharge ? html`<div class="fld"><span>${ct('vatToggle')}</span><span class="seg sm" role="radiogroup" aria-label=${ct('vatToggle')}>
            <button type="button" role="radio" aria-checked=${String(!f.include)} data-ob-vat="excluded" @click=${() => set({ include: false })}>${ct('amountsExcl')}</button>
            <button type="button" role="radio" aria-checked=${String(f.include)} data-ob-vat="included" @click=${() => set({ include: true })}>${ct('amountsIncl')}</button></span></div>` : nothing}
        </div>
        <label class="chk"><input type="checkbox" data-ob-no-charge .checked=${f.noCharge} @change=${(e: Event) => set({ noCharge: (e.target as HTMLInputElement).checked })} />${ct('noCharge')}</label>
        ${f.noCharge ? nothing : html`${this.lineEditor(f.currency, claim?.labor_rate_minor)}${this.preview(vatModeFor(exempt, f.include, false), rateBp, f.currency)}`}
        <div class="two">
          <label class="fld"><span>${ct('invoiceNo')}</span><input class="inp" maxlength="40" dir="auto" data-ob-ref .value=${f.vendorRef} @input=${(e: Event) => set({ vendorRef: (e.target as HTMLInputElement).value })} /></label>
        </div>
        <label class="fld"><span>${ct('notes')}</span><textarea class="inp" maxlength="1000" data-ob-notes .value=${f.notes} @input=${(e: Event) => set({ notes: (e.target as HTMLTextAreaElement).value })}></textarea></label>
        <div class="files" data-ob-files>
          ${f.docs.map((doc, i) => html`<div class="frow" data-ob-doc=${i}>${cIcon(doc.kind === 'pdf' ? 'file' : 'pages')}<span>${ct('docN', { n: i + 1 })} · ${doc.kind === 'pdf' ? `${ct('pdf')} · ${formatBytes(doc.files[0]?.bytes ?? 0)}` : ct('pagesN', { n: doc.files.length })}</span>
            <button type="button" class="btn sm quiet" data-ob-doc-remove @click=${() => set({ docs: f.docs.filter((_, j) => j !== i) })}>${ct('removeFile')}</button></div>`)}
          ${f.docs.length < 3 ? html`<label class="btn sm pick-file" data-ob-attach>${cIcon(this.uploading ? 'refresh' : 'attach')}<span>${this.uploading ? ct('uploading') : ct('attach')}</span>
            <input type="file" accept="application/pdf,image/jpeg,image/png" multiple ?disabled=${this.uploading > 0} aria-label=${ct('attach')} data-ob-file @change=${this.onFiles} /></label>` : nothing}
        </div>
        ${this.errRow()}
      </div>
      ${this.foot(html`<button type="button" class="btn primary" data-dialog-ok ?disabled=${this.busy || this.uploading > 0} @click=${() => void this.submitOnBehalf()}>${cIcon('check')}${ct('save')}</button>`)}
    </sw-dialog>`;
  }

  private dialogs(): TemplateResult | typeof nothing {
    const d = this.dialog;
    if (!d) return nothing;
    if (d.kind === 'viewer') return this.viewer(d);
    if (d.kind === 'onBehalf') return this.onBehalfDialog();
    const c = this.claim(d.claimId);
    if (!c) return nothing;
    const rev = this.currentRev(c);
    const total = html`<div class="ch"><span class="who">${bidi([c.vendor, c.contact_name].filter(Boolean).join(' · '))}</span><span class="sp"></span><span class="amt">${this.money(c.total_minor, c.currency)}</span></div>`;
    if (d.kind === 'adjust') {
      const currency = rev?.currency ?? c.currency ?? 'ILS';
      return html`<sw-dialog open wide heading=${ct('adjustTitle')} data-dialog="cost-adjust" @close=${this.onDialogClose}>
        <div class="form">${total}${this.lineEditor(currency, c.labor_rate_minor)}${this.preview(rev?.vat_mode ?? 'excluded', rev?.vat_rate_bp ?? 0, currency)}${this.reasonField()}${this.errRow()}</div>
        ${this.foot(html`<button type="button" class="btn primary" data-dialog-ok ?disabled=${this.busy} @click=${() => void this.submitAdjust(c)}>${cIcon('check')}${ct('adjust')}</button>`)}
      </sw-dialog>`;
    }
    const titles: Record<Simple, CostTextKey> = { approve: 'approveTitle', reject: 'rejectTitle', markPaid: 'markPaidTitle', unmarkPaid: 'unmarkPaidTitle', reopen: 'reopenTitle' };
    const oks: Record<Simple, CostTextKey> = { approve: 'approve', reject: 'reject', markPaid: 'markPaid', unmarkPaid: 'unmarkPaid', reopen: 'reopen' };
    const badRef = this.tried && !this.payRef.trim();
    const body = d.kind === 'reject' || d.kind === 'unmarkPaid' ? this.reasonField()
      : d.kind === 'markPaid' ? html`<div class="two">
          <label class="fld"><span>${ct('paymentRef')} <b class="req">*</b></span><input class="inp" maxlength="60" dir="auto" data-pay-ref aria-invalid=${String(badRef)} .value=${this.payRef} @input=${(e: Event) => { this.payRef = (e.target as HTMLInputElement).value; this.err = ''; }} />${badRef ? html`<span class="err">${ct('required')}</span>` : nothing}</label>
          <label class="fld"><span>${ct('paymentDate')} <b class="req">*</b></span><input class="inp" type="date" max=${todayIso(new Date(Date.now() + 86_400_000))} data-pay-date .value=${this.payDate} @input=${(e: Event) => (this.payDate = (e.target as HTMLInputElement).value)} /></label>
        </div>`
      : d.kind === 'approve' && rev ? html`${this.breakdown(rev)}${this.againstQuote(c, rev)}` : nothing;
    // TKUI3: a demand with exceptional lines is approved WITH them or WITHOUT them (a manager adjustment, contract 5.3); the send-back
    // of a demand is "בקשת תיקון" in the tab's words (the vendor may submit a new version)
    const emb = this.embedded;
    const heading = emb && d.kind === 'reject' ? qt('fixDemandTitle') : ct(titles[d.kind]);
    const okLabel = emb && d.kind === 'reject' ? qt('fixDemand') : emb && d.kind === 'approve' && c.needs_review ? qt('approveWithExc') : ct(oks[d.kind]);
    return html`<sw-dialog open heading=${heading} data-dialog=${`cost-${d.kind}`} @close=${this.onDialogClose}>
      <div class="form">${total}${body}${this.errRow()}</div>
      ${this.foot(html`<button type="button" class=${`btn ${d.kind === 'reject' && !emb ? 'danger' : 'primary'}`} data-dialog-ok ?disabled=${this.busy}
          @click=${() => void this.submitSimple(d.kind, c, d.kind === 'approve' && c.needs_review ? 'include' : undefined)}>${okLabel}</button>
        ${d.kind === 'approve' && c.needs_review ? html`<button type="button" class="btn" data-dialog-ok-noexc ?disabled=${this.busy}
          @click=${() => void this.submitSimple('approve', c, 'exclude')}>${qt('approveNoExc')}</button>` : nothing}`)}
    </sw-dialog>`;
  }

  // ---------------------------------------------------------------- page

  render() {
    const t = this.ticket;
    const cost = t?.cost;
    if (!t || !cost) return nothing;
    const d = this.data;
    const hasDetail = cost.can_view && !!d && (d.claims.length > 0 || (d.external_assignments ?? []).length > 0);
    if (cost.status === 'not_required' && !hasDetail && !(cost.can_view && this.failed)) return nothing;
    const obTargets = this.onBehalfIds();
    if (this.embedded && !d?.claims.length && !(cost.can_decide && obTargets.length)) return nothing;
    // TKUI3 (embedded): the payment demand of the Costs tab - its own title, the stage chip lives in the tab's header
    const title = this.embedded ? html`${qt('demandTitle')}<span class="muted">${qt('demandSub')}</span>` : html`${ct('sCost')}${cost.status !== 'not_required' ? this.statusChip(cost.status) : nothing}`;
    return html`<section class="sect" data-sect="cost" data-cost-section=${cost.status} ?data-embedded=${this.embedded}>
      <h4><span class="tag">${cIcon('coins')}</span>${title}<span class="sp"></span>
        ${cost.can_decide && d && obTargets.length ? html`<button type="button" class="btn sm" data-cost-on-behalf ?disabled=${this.busy} @click=${() => this.open({ kind: 'onBehalf' })}>${cIcon('plus')}${ct('onBehalf')}</button>` : nothing}
      </h4>
      ${this.flash ? html`<div class=${`banner ${this.flash.tone === 'bad' ? 'bad' : 'info'}`} role="status" data-cost-flash=${this.flash.tone}>${cIcon(this.flash.tone === 'bad' ? 'warning' : 'check')}<div>${this.flash.text}</div></div>` : nothing}
      ${!cost.can_view ? nothing
        : this.failed ? html`<div class="state" role="status" data-cost-state="error">${cIcon('warning')}<span>${ct('loadFailed')}</span><button type="button" class="btn sm" data-cost-retry @click=${() => void this.load()}>${cIcon('refresh')}${ct('retry')}</button></div>`
        : !d ? html`<span class="skl" style="block-size:120px" data-cost-state="loading" aria-busy="true"></span>`
        : html`<div class="claims">${repeat(d.claims, (c) => c.id, (c) => this.claimBlock(c, d.claims.length > 1))}${this.requirementRows()}</div>`}
      ${this.dialogs()}
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ticket-cost-card': TicketCostCard;
  }
}
