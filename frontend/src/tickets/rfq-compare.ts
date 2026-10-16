import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-dialog';
import './rfq-message-dialog';
import { automationsStyles } from '../styles/automations-glass';
import { mediaPageStyles } from '../styles/media-page';
import { applyAutomationsGlass } from '../api/automations-demo';
import { bubbleChrome } from '../styles/bubble-chrome';
import { SkinController } from '../design/skin';
import { bidi } from '../i18n/bidi';
import { ApiError } from '../api/client';
import type { LineKind } from '../api/tickets-costs';
import { ticketsRfqApi, type RfqAwardAnswer, type RfqCompareQuote, type RfqComparison, type RfqDetail, type RfqMessageDraft, type RfqMeta, type RfqVendor } from '../api/tickets-rfq';
import { formatMoney } from './cost-model';
import { ct, type CostTextKey } from './cost-text';
import { tIcon } from './icons';
import { rIcon } from './rfq-icons';
import { rt } from './rfq-text';
import { rfqStyles } from './rfq-styles';
import {
  KIND_ORDER, arrangeQuotes, awardPreview, currencyGroups, dateTime, initials, kindsOf, notSelected, rfqHref, scopeValid, secondApprovalHint, selectionTotals, splitPlan,
  windowText, type AwardScope, type CompareFilter, type CompareSort, type Selection,
} from './rfq-model';
import { rfqError } from './rfq-new';
import { awardQuestionWarning, questionBadge } from './rfq-questions';
import { tt, ticketsLang } from './text';

interface DraftOut { vendorId: string; name: string; text: string; send: boolean; notify: boolean; source?: { kind: 'award'; id: string } }

/**
 * TKRFQ2 `<tickets-rfq-compare .rfqId .meta>`: the comparison of the quotes of one request (mock-up v5 "השוואת הצעות"): one column per
 * quote, rows per line kind, before VAT / VAT / total with VAT, the work dates against the wanted window, validity, submitted (late,
 * version), the lines, the vendor's notes, clarifications; "הזולה" / "המוקדם" from the server, ranked ONLY inside the comparison's
 * currency - a quote in another currency gets its own group, shown and never ranked, and totals are NEVER added across currencies.
 * Award: select one quote (or several - a split), choose the scope (all / one kind only / chosen lines), confirm in a dialog that says
 * the selected quote becomes the approved cost baseline automatically and when a second approval may apply (department threshold, OFF
 * by default; the server skips it when no approver above the requester exists). After the award the dialog "לשלוח הודעה לספק?" offers
 * the server's editable draft; vendors who were not selected get an optional draft too, unchecked - nothing is ever sent by itself.
 */
@customElement('tickets-rfq-compare')
export class TicketsRfqCompare extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property() rfqId = '';
  @property({ attribute: false }) meta: RfqMeta | null = null;
  @state() private c: RfqComparison | null = null;
  @state() private d: RfqDetail | null = null;
  @state() private phase: 'loading' | 'ready' | 'error' | 'forbidden' = 'loading';
  @state() private failed = '';
  @state() private filter: CompareFilter = 'all';
  @state() private sort: CompareSort = 'price';
  @state() private sel = new Map<string, AwardScope>();
  @state() private expanded = new Set<string>();
  @state() private confirm = false;
  @state() private drafts: DraftOut[] | null = null;
  @state() private message: RfqVendor | null = null;
  @state() private busy = false;
  @state() private error = '';
  private seq = 0;

  static styles = [bubbleChrome, ...automationsStyles, mediaPageStyles, rfqStyles];

  connectedCallback(): void {
    super.connectedCallback();
    applyAutomationsGlass(this);
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('rfqId') && this.rfqId) {
      this.c = null;
      this.d = null;
      this.sel = new Map();
      this.phase = 'loading';
      void this.load();
    }
  }

  private async load(): Promise<void> {
    const mine = ++this.seq;
    try {
      const [d, c] = await Promise.all([ticketsRfqApi().get(this.rfqId), ticketsRfqApi().comparison(this.rfqId)]);
      if (mine !== this.seq) return;
      this.d = d;
      this.c = c;
      // a quote that left (withdrawn, superseded) leaves the selection
      this.sel = new Map([...this.sel].filter(([id]) => c.quotes.some((q) => q.quote_id === id && q.can.award)));
      this.phase = 'ready';
    } catch (e) {
      if (mine !== this.seq) return;
      if (e instanceof ApiError && e.status === 403) this.phase = 'forbidden';
      else {
        this.failed = rfqError(e);
        this.phase = 'error';
      }
    }
  }

  private notice(detail: { ok?: string; error?: string }): void {
    this.dispatchEvent(new CustomEvent('notice', { detail, bubbles: true, composed: true }));
  }

  private money(minor: number | null | undefined, currency: string): string {
    return formatMoney(minor ?? null, currency, ticketsLang() === 'en' ? 'en' : 'he');
  }

  private name(q: RfqCompareQuote): string {
    return q.vendor.company || q.vendor.name;
  }

  private canPick(q: RfqCompareQuote): boolean {
    return !!this.d?.can.award && q.can.award && q.state === 'submitted';
  }

  private toggle(q: RfqCompareQuote, on: boolean): void {
    const next = new Map(this.sel);
    if (on) next.set(q.quote_id, { mode: 'all' });
    else next.delete(q.quote_id);
    this.sel = next;
  }

  private setScope(q: RfqCompareQuote, s: AwardScope): void {
    this.sel = new Map(this.sel).set(q.quote_id, s);
  }

  private selections(): Selection[] {
    const qs = this.c?.quotes ?? [];
    return [...this.sel].map(([id, scope]) => ({ quote: qs.find((q) => q.quote_id === id) as RfqCompareQuote, scope })).filter((s) => !!s.quote);
  }

  private scopeLabel(q: RfqCompareQuote, s: AwardScope): string {
    if (s.mode === 'all') return rt('sc_all');
    if (s.mode === 'kinds') return s.kinds.map((k) => rt('onlyKind', { kind: ct(`k_${k}` as CostTextKey) })).join(', ');
    return `${rt('sc_lines')} (${s.indexes.length}/${q.lines.length})`;
  }

  // ---------------------------------------------------------------- award

  private async award(): Promise<void> {
    const d = this.d;
    const sel = this.selections();
    if (!d || !sel.length || !sel.every((s) => scopeValid(s.quote, s.scope))) return;
    this.busy = true;
    this.error = '';
    const answers: RfqAwardAnswer[] = [];
    try {
      for (const body of splitPlan(sel)) {
        const a = await ticketsRfqApi().award(d.id, body);
        answers.push(a);
        this.d = a.rfq;
        if (a.award.state === 'pending_second') break; // the RFQ waits: nothing more until the second approver decides
      }
      this.confirm = false;
      const pending = answers.some((a) => a.award.state === 'pending_second');
      this.notice({ ok: pending ? rt('awardPendingDone') : rt('awardDone') });
      if (!pending) this.drafts = this.draftsOf(answers, sel);
      this.sel = new Map();
      await this.load();
    } catch (e) {
      this.error = rfqError(e);
      if (answers.length) await this.load();
    } finally {
      this.busy = false;
    }
  }

  /** The winners' drafts from the server (checked, editable) and an optional "not selected" draft per other vendor (unchecked). */
  private draftsOf(answers: RfqAwardAnswer[], sel: Selection[]): DraftOut[] {
    const out: DraftOut[] = [];
    for (const a of answers) {
      const draft = a.message_draft as RfqMessageDraft | null;
      const q = sel.find((s) => s.quote.quote_id === a.award.quote_id)?.quote;
      if (!draft || !q) continue;
      out.push({ vendorId: a.award.vendor_id, name: this.name(q), text: draft.text, send: true, notify: draft.notify_default, source: draft.send.source });
    }
    const title = this.d?.title ?? '';
    for (const q of notSelected(this.c?.quotes ?? [], sel)) {
      out.push({ vendorId: q.vendor_id, name: this.name(q), text: rt('notAwardedDraft', { name: q.vendor.name, title }), send: false, notify: true });
    }
    return out;
  }

  private async sendDrafts(): Promise<void> {
    const d = this.d;
    const list = (this.drafts ?? []).filter((x) => x.send && x.text.trim());
    if (!d) return;
    if (!list.length) {
      this.drafts = null;
      this.notice({ ok: rt('msgNone') });
      return;
    }
    this.busy = true;
    this.error = '';
    let n = 0;
    try {
      for (const x of list) {
        await ticketsRfqApi().writeMessage(d.id, x.vendorId, x.text.trim(), x.notify, x.source);
        n += 1;
      }
      this.drafts = null;
      this.notice({ ok: rt('msgSent', { n }) });
    } catch (e) {
      this.error = rfqError(e);
      this.drafts = (this.drafts ?? []).filter((x) => !list.slice(0, n).includes(x));
    } finally {
      this.busy = false;
    }
  }

  // ---------------------------------------------------------------- the table

  private head(q: RfqCompareQuote): TemplateResult {
    const picked = this.sel.has(q.quote_id);
    const name = this.name(q);
    return html`<th scope="col" class=${picked ? 'sel' : ''} data-cmp-col=${q.quote_id}><div>
      <span class="vname"><span class="av" aria-hidden="true">${initials(name)}</span><span><b>${bidi(name)}</b><small>${bidi(q.vendor.company ? q.vendor.name : '')}</small></span></span>
      <span class="mut">${rt('rowSubmitted')} ${dateTime(q.submitted_at)}${q.version > 1 ? ` · ${rt('versionN', { n: q.version })}` : ''}</span>
      <span>${q.late ? html`<span class="chip warn">${rt('late')}</span>` : nothing}
        ${q.award ? html`<span class=${`chip ${q.award.state === 'approved' ? 'ok' : 'warn'}`} data-cmp-award=${q.award.state}>${q.award.state === 'approved' ? rt('v_awarded') : rt('pendingSecond')}</span>` : nothing}
        ${q.state === 'not_awarded' ? html`<span class="chip">${rt('v_not_awarded')}</span>` : nothing}
        ${this.qBadge(q)}${q.note?.trim() ? html`<span class="chip info" title=${rt('qNoteTitle')} data-cmp-note-chip>${rt('qVendorNote')}</span>` : nothing}</span>
      ${this.canPick(q) ? html`<label class="pickrow"><input type="checkbox" data-cmp-pick=${q.quote_id} .checked=${picked} ?disabled=${this.busy}
        @change=${(e: Event) => this.toggle(q, (e.target as HTMLInputElement).checked)} />${picked ? rt('picked') : rt('pick')}<span class="vh"> ${name}</span></label>` : nothing}
    </div></th>`;
  }

  /** RFQQUESTIONS: the vendor column's "question waiting" badge (the clarifications row below opens his thread, where a manager answers). */
  private qBadge(q: RfqCompareQuote): TemplateResult | typeof nothing {
    const b = questionBadge(q.questions);
    if (!b) return nothing;
    const label = b.n === 1 ? rt('qBadgeOne') : rt('qBadge', { n: b.n });
    return html`<span class=${`qbadge${b.fresh ? '' : ' seen'}`} role="status" aria-label=${rt('qBadgeAria', { n: b.n })} data-cmp-q-badge=${q.vendor_id}>${rIcon('chat')}${label}${b.fresh ? ` · ${rt('qBadgeNew')}` : ''}</span>`;
  }

  private scopeCell(q: RfqCompareQuote): TemplateResult {
    const s = this.sel.get(q.quote_id);
    if (!s) return html`<td><span class="mut">—</span></td>`;
    const kinds = kindsOf(q);
    const isKind = (k: LineKind) => s.mode === 'kinds' && s.kinds.length === 1 && s.kinds[0] === k;
    return html`<td class="sel" data-cmp-scope=${q.quote_id}><div class="scope">
      <span class="seg sm" role="radiogroup" aria-label=${`${rt('rowScope')}: ${this.name(q)}`}>
        <button type="button" role="radio" aria-checked=${String(s.mode === 'all')} data-scope="all" @click=${() => this.setScope(q, { mode: 'all' })}>${rt('sc_all')}</button>
        ${kinds.length > 1 ? kinds.map((k) => html`<button type="button" role="radio" aria-checked=${String(isKind(k))} data-scope=${k}
          @click=${() => this.setScope(q, { mode: 'kinds', kinds: [k] })}>${rt('onlyKind', { kind: ct(`k_${k}` as CostTextKey) })}</button>`) : nothing}
        ${q.lines.length > 1 ? html`<button type="button" role="radio" aria-checked=${String(s.mode === 'lines')} data-scope="lines"
          @click=${() => this.setScope(q, { mode: 'lines', indexes: q.lines.map((l) => l.index) })}>${rt('sc_lines')}</button>` : nothing}
      </span>
      ${s.mode === 'lines' ? html`<ul class="lines">${q.lines.map((l) => html`<li><label><input type="checkbox" .checked=${s.indexes.includes(l.index)}
          @change=${(e: Event) => { const on = (e.target as HTMLInputElement).checked; this.setScope(q, { mode: 'lines', indexes: on ? [...s.indexes, l.index] : s.indexes.filter((i) => i !== l.index) }); }} />
          ${ct(`k_${l.kind}` as CostTextKey)}${l.description ? ` · ${bidi(l.description)}` : ''}</label><span class="num">${this.money(l.total_minor, q.currency)}</span></li>`)}</ul>` : nothing}
      <span class="num"><b>${this.money(awardPreview(q, s).total, q.currency)}</b></span>
    </div></td>`;
  }

  private table(quotes: RfqCompareQuote[], ranked: boolean): TemplateResult {
    const kinds = KIND_ORDER.filter((k) => quotes.some((q) => q.by_kind[k] > 0));
    const anyValid = quotes.some((q) => q.valid_until);
    const anyRef = quotes.some((q) => q.vendor_ref);
    const anyPicked = quotes.some((q) => this.sel.has(q.quote_id));
    const cls = (q: RfqCompareQuote, extra = '') => `${this.sel.has(q.quote_id) ? 'sel ' : ''}${extra}`.trim();
    const row = (label: string, cell: (q: RfqCompareQuote) => TemplateResult, attr: string) => html`<tr data-cmp-row=${attr}><th scope="row">${label}</th>${quotes.map(cell)}</tr>`;
    return html`<div class="cmpwrap"><table class="ctbl" data-cmp-table>
      <thead><tr><th scope="row">${rt('rowVendor')}</th>${quotes.map((q) => this.head(q))}</tr></thead>
      <tbody>
        ${kinds.map((k) => row(ct(`k_${k}` as CostTextKey), (q) => html`<td class=${cls(q)}><span class="num">${q.by_kind[k] ? this.money(q.by_kind[k], q.currency) : '—'}</span></td>`, `kind-${k}`))}
        ${row(rt('rowSubtotal'), (q) => html`<td class=${cls(q)}><span class="num">${this.money(q.net_minor, q.currency)}</span></td>`, 'net')}
        ${row(rt('rowVat'), (q) => html`<td class=${cls(q)}><span class="num">${q.vat_mode === 'none' ? ct('vatNone') : this.money(q.vat_minor, q.currency)}</span></td>`, 'vat')}
        ${row(rt('rowTotal'), (q) => html`<td class=${cls(q, ranked && q.lowest ? 'best' : '')} data-cmp-total=${q.quote_id}><span class="num big">${this.money(q.total_minor, q.currency)}</span>
          ${ranked && q.lowest ? html`<span class="tag2" data-cmp-lowest>${tIcon('check')}${rt('cmpLowest')}</span>` : nothing}</td>`, 'total')}
        ${row(rt('rowWindow'), (q) => html`<td class=${cls(q, q.earliest ? 'early' : '')}><span class="num">${windowText(q.work_from, q.work_to) || '—'}</span>
          ${q.earliest ? html`<span class="tag2 e" data-cmp-earliest>${rIcon('bolt')}${rt('cmpEarliest')}</span>` : nothing}
          ${q.in_window === true ? html`<div class="mut">${rt('inWindow')}</div>` : q.in_window === false ? html`<div class="mut">${rt('outWindow')}</div>` : nothing}</td>`, 'window')}
        ${anyValid ? row(rt('rowValid'), (q) => html`<td class=${cls(q)}><span class="num">${dateTime(q.valid_until) || '—'}</span></td>`, 'valid') : nothing}
        ${row(rt('rowLines'), (q) => {
          const open = this.expanded.has(q.quote_id);
          return html`<td class=${cls(q)}><button type="button" class="btn sm quiet" aria-expanded=${String(open)} data-cmp-lines=${q.quote_id}
            @click=${() => { const n = new Set(this.expanded); if (open) n.delete(q.quote_id); else n.add(q.quote_id); this.expanded = n; }}>${rt('linesN', { n: q.lines.length })} · ${open ? rt('linesHide') : rt('linesShow')}</button>
            ${open ? html`<ul class="lines">${q.lines.map((l) => html`<li><span>${ct(`k_${l.kind}` as CostTextKey)}${l.description ? ` · ${bidi(l.description)}` : ''}</span><span class="num">${this.money(l.total_minor, q.currency)}</span></li>`)}</ul>` : nothing}</td>`;
        }, 'lines')}
        ${row(rt('rowNote'), (q) => html`<td class=${cls(q)}>${q.note ? bidi(q.note) : html`<span class="mut">—</span>`}</td>`, 'note')}
        ${anyRef ? row(rt('rowRef'), (q) => html`<td class=${cls(q)}><span class="ltr">${q.vendor_ref ?? '—'}</span></td>`, 'ref') : nothing}
        ${row(rt('rowMessages'), (q) => {
          const v = this.d?.vendors.find((x) => x.id === q.vendor_id);
          return html`<td class=${cls(q)}>${v?.can.message ? html`<button type="button" class="btn sm quiet" data-cmp-ask=${q.vendor_id} @click=${() => (this.message = v)}>${rIcon('chat')}${q.questions?.pending ? `${rt('qAnswer')} (${q.questions.pending})` : q.messages ? `${rt('messages')} (${q.messages})` : rt('ask')}</button>`
            : q.messages ? html`<span>${rt('messages')} (${q.messages})</span>` : html`<span class="mut">—</span>`}</td>`;
        }, 'messages')}
        ${anyPicked ? row(rt('rowScope'), (q) => this.scopeCell(q), 'scope') : nothing}
      </tbody></table></div>`;
  }

  private bar(): TemplateResult | typeof nothing {
    if (!this.d?.can.award) return nothing;
    const sel = this.selections();
    const totals = selectionTotals(sel);
    const valid = sel.length > 0 && sel.every((s) => scopeValid(s.quote, s.scope));
    return html`<div class="bar2" data-cmp-bar>
      <button type="button" class="btn primary" data-cmp-approve ?disabled=${!valid || this.busy} @click=${() => { this.error = ''; this.confirm = true; }}>
        ${tIcon('check')}${sel.length > 1 ? rt('approveSplit', { n: sel.length }) : rt('approveOne')}</button>
      <div class="sum" data-cmp-sum>${sel.length ? html`${sel.map((s) => html`<span>${bidi(this.name(s.quote))} · ${this.scopeLabel(s.quote, s.scope)} · <b class="num">${this.money(awardPreview(s.quote, s.scope).total, s.quote.currency)}</b></span>`)}
          ${totals.length > 1 ? html`<span data-cmp-currency-note>${rt('selCurrencyNote')}</span>` : nothing}` : html`<span>${rt('selNone')}</span>`}</div>
    </div>`;
  }

  private confirmDialog(): TemplateResult | typeof nothing {
    if (!this.confirm || !this.d || !this.c) return nothing;
    const sel = this.selections();
    const threshold = this.d.second_approval.threshold_minor;
    const hint = secondApprovalHint(threshold, sel, this.c.currency);
    const qWarn = awardQuestionWarning(this.d, sel.map((s) => s.quote.vendor_id)); // RFQQUESTIONS (owner 2026-10-17)
    return html`<sw-dialog open ?locked=${this.busy} wide heading=${rt('awardTitle')} data-cmp-confirm @close=${() => !this.busy && (this.confirm = false)}>
      <div class="stack">
        <ul class="thr">${sel.map((s) => html`<li data-cmp-confirm-item=${s.quote.quote_id}><b>${bidi(this.name(s.quote))}</b> · ${this.scopeLabel(s.quote, s.scope)}
          <small class="num">${this.money(awardPreview(s.quote, s.scope).total, s.quote.currency)}</small></li>`)}</ul>
        ${qWarn ? html`<div class="banner warn" role="alert" data-cmp-q-warn=${qWarn.total}>${rIcon('chat')}<div><b>${rt('qAwardWarn', { n: qWarn.total })}</b>
          ${qWarn.vendors.map((n) => html`<small>${rt('qAwardWarnVendor', { name: n })}</small>`)}</div></div>` : nothing}
        <p class="note">${rt('awardBody')}</p>
        ${sel.length > 1 ? html`<p class="note">${rt('awardSplitNote')}</p>` : nothing}
        <p class="note">${rt('awardOthers')}</p>
        <p class="note" data-cmp-second=${hint ? 'maybe' : 'off'}>${hint && threshold !== null ? rt('awardSecondMaybe', { amount: this.money(threshold, this.c.currency) }) : rt('awardSecondOff')}</p>
        ${this.error ? html`<div class="err" role="alert" data-cmp-error>${this.error}</div>` : nothing}
      </div>
      <button slot="footer" type="button" class="btn quiet" ?disabled=${this.busy} @click=${() => (this.confirm = false)}>${rt('back')}</button>
      <button slot="footer" type="button" class="btn primary" data-cmp-confirm-ok ?disabled=${this.busy} @click=${() => void this.award()}>${tIcon('check')}${rt('confirm')}</button>
    </sw-dialog>`;
  }

  private draftsDialog(): TemplateResult | typeof nothing {
    const list = this.drafts;
    if (!list) return nothing;
    const winners = list.filter((x) => x.source);
    const others = list.filter((x) => !x.source);
    const set = (x: DraftOut, patch: Partial<DraftOut>) => (this.drafts = (this.drafts ?? []).map((y) => (y === x ? { ...y, ...patch } : y)));
    const block = (x: DraftOut) => html`<div class="draft" data-cmp-draft=${x.vendorId} data-draft-kind=${x.source ? 'winner' : 'other'}>
      <label class="chk"><input type="checkbox" data-draft-send .checked=${x.send} @change=${(e: Event) => set(x, { send: (e.target as HTMLInputElement).checked })} />${rt('msgSendThis', { name: x.name })}</label>
      <label class="fld"><span class="vh">${rt('writeVendor')}</span><textarea class="inp" maxlength="2000" data-draft-text .value=${x.text} ?disabled=${!x.send}
        @input=${(e: Event) => set(x, { text: (e.target as HTMLTextAreaElement).value })}></textarea></label>
      <label class="chk"><input type="checkbox" .checked=${x.notify} ?disabled=${!x.send} @change=${(e: Event) => set(x, { notify: (e.target as HTMLInputElement).checked })} />${rt('msgNotify')}</label>
    </div>`;
    return html`<sw-dialog open ?locked=${this.busy} wide heading=${rt('msgTitle')} subheading=${rt('msgBody')} data-cmp-drafts @close=${() => !this.busy && (this.drafts = null)}>
      <div class="stack">
        ${winners.length ? html`<h3 class="group-h">${rt('msgWinner')}</h3>${winners.map(block)}` : nothing}
        ${others.length ? html`<h3 class="group-h">${rt('msgOthers')}</h3><p class="note">${rt('msgOthersNote')}</p>${others.map(block)}` : nothing}
        <p class="note">${rt('writeNote')}</p>
        ${this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing}
      </div>
      <button slot="footer" type="button" class="btn quiet" data-draft-skip ?disabled=${this.busy} @click=${() => { this.drafts = null; this.notice({ ok: rt('msgNone') }); }}>${rt('msgSkip')}</button>
      <button slot="footer" type="button" class="btn primary" data-draft-send-all ?disabled=${this.busy || !list.some((x) => x.send && x.text.trim())} @click=${() => void this.sendDrafts()}>${tIcon('send')}${rt('msgSend')}</button>
    </sw-dialog>`;
  }

  render() {
    if (this.phase === 'loading') return html`<div class="page" data-rfq-compare data-phase="loading" aria-busy="true"><span class="skl" style="block-size:64px"></span><span class="skl" style="block-size:360px"></span></div>`;
    if (this.phase === 'forbidden') return html`<div class="page" data-rfq-compare data-phase="forbidden"><div class="statebox glass" role="status"><span class="ring">${tIcon('lock')}</span><b>${rt('cmpNoAmounts')}</b><a class="btn sm" href=${rfqHref({ id: this.rfqId })}>${rt('back')}</a></div></div>`;
    if (this.phase === 'error' || !this.c || !this.d) {
      return html`<div class="page" data-rfq-compare data-phase="error"><div class="statebox glass" role="status"><span class="ring">${tIcon('warning')}</span><b>${rt('loadFailed')}</b>
        <span class="vh">${this.failed}</span><button type="button" class="btn sm" @click=${() => { this.phase = 'loading'; void this.load(); }}>${tIcon('refresh')}${rt('retry')}</button></div></div>`;
    }
    const c = this.c;
    const d = this.d;
    const arranged = arrangeQuotes(c.quotes, this.filter, this.sort);
    const groups = currencyGroups(arranged, c.currency);
    const low = c.quotes.find((q) => q.quote_id === c.lowest_quote_id);
    const early = c.quotes.find((q) => q.quote_id === c.earliest_quote_id);
    const invited = d.vendors.filter((v) => v.state !== 'removed').length;
    return html`<div class="page" data-rfq-compare data-phase="ready">
      <header class="dh">
        <div class="dh-row"><div class="titles">
          <div class="crumbs"><a href="#/tickets">${tt('area')}</a> › <a href=${rfqHref({})}>${rt('navTitle')}</a> › <a href=${rfqHref({ id: d.id })} data-cmp-back>${d.ref}</a></div>
          <h1>${rt('cmpTitle')}</h1>
          <div class="subline"><span>${bidi(d.title)}</span><span>${rt('cmpSub', { ref: d.ref, n: c.quotes.length, m: invited })}</span></div>
        </div><span class="grow"></span></div>
        ${c.quotes.length ? html`<div class="dh-det">
          <span class="seg sm" role="radiogroup" aria-label=${rt('cmpFilter')} data-cmp-filter>
            <button type="button" role="radio" aria-checked=${String(this.filter === 'all')} data-f="all" @click=${() => (this.filter = 'all')}>${rt('cmpAll')}<small>${c.filters.all}</small></button>
            <button type="button" role="radio" aria-checked=${String(this.filter === 'in_window')} data-f="in_window" ?disabled=${!c.filters.in_window} @click=${() => (this.filter = 'in_window')}>${rt('cmpInWindow')}<small>${c.filters.in_window}</small></button>
          </span>
          <span class="seg sm" role="radiogroup" aria-label=${rt('cmpSort')} data-cmp-sort>
            <button type="button" role="radio" aria-checked=${String(this.sort === 'price')} @click=${() => (this.sort = 'price')}>${rIcon('coin')}${rt('cmpByPrice')}</button>
            <button type="button" role="radio" aria-checked=${String(this.sort === 'date')} @click=${() => (this.sort = 'date')}>${rIcon('cal')}${rt('cmpByDate')}</button>
          </span>
          <span class="grow"></span>
          ${low ? html`<span class="chip ok" data-cmp-low-chip>${rt('cmpLowestChip', { name: this.name(low), amount: this.money(low.total_minor, low.currency) })}</span>` : nothing}
          ${early ? html`<span class="chip info">${rt('cmpEarliestChip', { name: this.name(early), date: windowText(early.work_from, null) })}</span>` : nothing}
        </div>` : nothing}
      </header>
      ${!c.quotes.length ? html`<div class="statebox glass" role="status" data-cmp-empty><span class="ring">${rIcon('columns')}</span><b>${rt('cmpEmpty')}</b><a class="btn sm" href=${rfqHref({ id: d.id })}>${rt('back')}</a></div>`
        : groups.map((g) => html`<section class="stack" data-cmp-group=${g.currency} aria-label=${rt('cmpCurrencyGroup', { currency: g.currency })}>
          ${groups.length > 1 ? html`<h2 class="group-h">${rt('cmpCurrencyGroup', { currency: g.currency })}${g.ranked ? nothing : html` · <span class="mut">${rt('cmpOtherCurrency', { currency: g.currency })}</span>`}</h2>` : nothing}
          ${this.table(g.quotes, g.ranked)}
        </section>`)}
      ${c.quotes.length ? this.bar() : nothing}
    </div>
    ${this.confirmDialog()}${this.draftsDialog()}
    ${this.message ? html`<tickets-rfq-message-dialog open .rfq=${d} .vendor=${this.message} @close=${() => { this.message = null; void this.load(); }}
      @saved=${(e: CustomEvent<{ notified: boolean }>) => { this.message = null; this.notice({ ok: e.detail.notified ? rt('writeDoneNotified') : rt('writeDone') }); void this.load(); }}></tickets-rfq-message-dialog>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-rfq-compare': TicketsRfqCompare;
  }
}
