import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-dialog';
import { automationsStyles } from '../styles/automations-glass';
import { applyAutomationsGlass } from '../api/automations-demo';
import { bubbleChrome } from '../styles/bubble-chrome';
import { SkinController } from '../design/skin';
import { bidi } from '../i18n/bidi';
import { ApiError } from '../api/client';
import type { LineKind } from '../api/tickets-costs';
import { ticketsRfqApi, type RfqAward, type RfqDetail, type RfqOrderPreview } from '../api/tickets-rfq';
import { formatMoney } from './cost-model';
import { ct, type CostTextKey } from './cost-text';
import { tIcon } from './icons';
import { rIcon } from './rfq-icons';
import { hasRfqText, rt, type RfqTextKey } from './rfq-text';
import { rfqStyles } from './rfq-styles';
import { clientRequestId, dateTime, initials, notSelectedCount, orderAwards, orderBody, orderForm, orderFormValid, scopeText, windowText } from './rfq-model';
import { rfqError } from './rfq-new';
import { ticketsLang } from './text';

type Form = { from: string; to: string; docs: string };

/** A refusal of the order routes in words: the order's own wording first (an order is not an invitation), else the screens' map. */
function orderError(e: unknown): string {
  if (e instanceof ApiError && e.code === 'vendor_not_allowed') return rt('err_order_vendor_not_allowed');
  return rfqError(e);
}

function refusalText(code: string): string {
  const key = code === 'vendor_not_allowed' ? 'err_order_vendor_not_allowed' : `err_${code}`;
  return hasRfqText(key) ? rt(key) : code;
}

/**
 * TKRFQ4 `<tickets-rfq-order .rfq>` (RFQ stage C4, contract section 18; mock-up v5 "הזמנת עבודה"): the step after an award is
 * final. One card per selected vendor (a split gives one item per vendor, linked to each other): the agreed scope, the approved cost
 * baseline (with tickets.costs.view), the execution and finish dates (defaults: the quote's work window), the agreed documents (text -
 * files are not supported yet) and "open the vendor's item" - which SENDS NOTHING. Once the item exists the card links to it and
 * offers "preview and send": the dialog shows the exact text the vendor will get (the link as a placeholder), its channel and every
 * refusal; only the button in that dialog sends (owner rule: an approval never sends a message by itself). Vendors that were not
 * selected get nothing, and the card says so. Actions follow the server's `can` flags. Events: `changed` (detail: RfqDetail), `notice`
 * ({ok} | {error}, bubbles to the screen's toast).
 */
@customElement('tickets-rfq-order')
export class TicketsRfqOrder extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) rfq: RfqDetail | null = null;
  @state() private forms: Record<string, Form> = {};
  /** one request key per form: a retry after a lost answer replays the first create (no second item) */
  private keys: Record<string, string> = {};
  @state() private busy = '';
  @state() private errors: Record<string, string> = {};
  @state() private pv: { award: RfqAward; data: RfqOrderPreview | null; error: string } | null = null;
  @state() private sending = false;

  static styles = [bubbleChrome, ...automationsStyles, rfqStyles, css`
    .rcard > p.note { margin: 0; }
    .ocards { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: var(--sw-s-4); }
    .ocard { display: flex; flex-direction: column; gap: 12px; padding: 14px 16px; border-radius: var(--sw-r-xl); border: 1px solid var(--dv-border);
      background: var(--dv-surface-2); min-inline-size: 0; }
    .ocard[data-ostate='sent'] { border-color: color-mix(in srgb, var(--dv-success) 40%, transparent); }
    .ohead { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; }
    .ohead b { font-size: var(--sw-fs-md); }
    .ohead .chip { margin-inline-start: auto; }
    .orow { display: flex; align-items: flex-start; gap: 10px; font-size: var(--sw-fs-sm); }
    .orow > .ic { flex: none; font-size: var(--sw-fs-xl); color: var(--dv-text-2); margin-block-start: 1px; }
    .orow b { display: block; font-size: var(--sw-fs-base); }
    .orow small { display: block; color: var(--dv-text-2); }
    .oacts { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
    .oacts .note { flex: 1 1 180px; }
    .refusals { margin: 0; padding-inline-start: 18px; color: var(--au-warn-text, var(--dv-warning)); font-size: var(--sw-fs-sm); }
  `];

  connectedCallback(): void {
    super.connectedCallback();
    applyAutomationsGlass(this);
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('rfq') && this.rfq) {
      const next = { ...this.forms };
      for (const a of orderAwards(this.rfq)) if (!next[a.id] && a.can?.order) next[a.id] = orderForm(a);
      this.forms = next;
    }
  }

  private notice(detail: { ok?: string; error?: string }): void {
    this.dispatchEvent(new CustomEvent('notice', { detail, bubbles: true, composed: true }));
  }

  private changed(d: RfqDetail): void {
    this.rfq = d;
    this.dispatchEvent(new CustomEvent('changed', { detail: d }));
  }

  private vendorName(id: string): string {
    const v = this.rfq?.vendors.find((x) => x.id === id);
    return v ? v.contact.company || v.contact.name : '';
  }

  private money(minor: number | null | undefined, currency: string | null | undefined): string {
    return formatMoney(minor ?? null, currency ?? 'ILS', ticketsLang() === 'en' ? 'en' : 'he');
  }

  private setForm(id: string, patch: Partial<Form>): void {
    this.forms = { ...this.forms, [id]: { ...(this.forms[id] ?? { from: '', to: '', docs: '' }), ...patch } };
  }

  private async create(a: RfqAward): Promise<void> {
    const d = this.rfq;
    const f = this.forms[a.id];
    if (!d || !f || !orderFormValid(f) || this.busy) return;
    this.keys[a.id] ??= clientRequestId();
    this.busy = a.id;
    this.errors = { ...this.errors, [a.id]: '' };
    try {
      const ans = await ticketsRfqApi().createOrder(d.id, a.id, orderBody(f, this.keys[a.id]));
      delete this.keys[a.id];
      this.changed(ans.rfq);
      this.notice({ ok: rt('ordCreatedDone', { number: ans.ticket?.number ?? ans.award?.ticket?.number ?? '' }) });
    } catch (e) {
      this.errors = { ...this.errors, [a.id]: orderError(e) };
      if (e instanceof ApiError && (e.code === 'order_exists' || e.code === 'rfq_stale' || e.code === 'rfq_invalid_transition')) await this.reload();
    } finally {
      this.busy = '';
    }
  }

  private async reload(): Promise<void> {
    if (!this.rfq) return;
    try {
      this.changed(await ticketsRfqApi().get(this.rfq.id));
    } catch {
      /* the board shows its own error on the next load */
    }
  }

  private async openPreview(a: RfqAward): Promise<void> {
    const d = this.rfq;
    if (!d) return;
    this.pv = { award: a, data: null, error: '' };
    try {
      const data = await ticketsRfqApi().orderPreview(d.id, a.id);
      if (this.pv?.award.id === a.id) this.pv = { award: a, data, error: '' };
    } catch (e) {
      if (this.pv?.award.id === a.id) this.pv = { award: a, data: null, error: orderError(e) };
    }
  }

  private async send(): Promise<void> {
    const d = this.rfq;
    const p = this.pv;
    if (!d || !p?.data || p.data.refusals.length || this.sending) return;
    this.sending = true;
    try {
      const ans = await ticketsRfqApi().sendOrder(d.id, p.award.id);
      this.pv = null;
      this.changed(ans.rfq);
      this.notice({ ok: rt('ordSentDone') });
    } catch (e) {
      this.pv = { ...p, error: orderError(e) };
    } finally {
      this.sending = false;
    }
  }

  // ---------------------------------------------------------------- parts

  private scope(a: RfqAward): string {
    const s = scopeText(a.scope, (k: LineKind) => ct(`k_${k}` as CostTextKey));
    return s ? rt(s.key as RfqTextKey, s.vars) : '';
  }

  private ticketLink(a: RfqAward): TemplateResult | typeof nothing {
    const t = a.order?.ticket ?? a.ticket;
    if (!t) return nothing;
    const label = rt('ordTicket', { number: t.number });
    return t.id ? html`<a class="btn sm" href=${`#/tickets/${t.id}`} data-rfq-order-ticket-link=${t.id}>${tIcon('ticket')}${label}</a>`
      : html`<span class="chip">${tIcon('ticket')}${label}</span>`;
  }

  private card(a: RfqAward): TemplateResult {
    const d = this.rfq as RfqDetail;
    const name = this.vendorName(a.vendor_id);
    const o = a.order ?? null;
    const st = o ? (o.sent ? 'sent' : 'created') : a.can?.order ? 'form' : 'waiting';
    const f = this.forms[a.id] ?? { from: '', to: '', docs: '' };
    const err = this.errors[a.id];
    const busy = this.busy === a.id;
    const chip = st === 'sent' ? html`<span class="chip ok" data-ochip>${tIcon('check')}${rt('ordSentAt', { when: dateTime(o?.sent?.at) })}</span>`
      : st === 'created' ? html`<span class="chip warn" data-ochip>${rt('ordNotSent')}</span>`
      : html`<span class="chip" data-ochip>${rt('ordWaitingCreate')}</span>`;
    return html`<article class="ocard" data-rfq-order-card=${a.vendor_id} data-award=${a.id} data-ostate=${st} aria-label=${`${rt('ordSection')}: ${name}`}>
      <div class="ohead"><span class="av" aria-hidden="true">${initials(name)}</span><b>${bidi(name)}</b>${chip}</div>
      <div class="orow" data-oscope>${tIcon('layers')}<span><b>${this.scope(a)}</b>${d.can.see_amounts && a.total_minor !== null
        ? html`<small data-obaseline>${rt('ordBaseline')}: <span class="num">${this.money(a.total_minor, a.currency)}</span> · ${rt('ordBaselineSub')}</small>`
        : html`<small>${rt('ordBaselineSub')}</small>`}</span></div>
      ${o ? html`
        <div class="orow" data-odates>${rIcon('cal')}<span><small>${rt('ordDates')}</small><b class="num">${windowText(o.work_from, o.work_to) || '—'}</b></span></div>
        <div class="oacts">${this.ticketLink(a)}
          ${a.can?.send_order ? html`<button type="button" class="btn primary" data-rfq-order-preview=${a.id} @click=${() => void this.openPreview(a)}>${tIcon('send')}${rt('ordPreviewSend')}</button>` : nothing}
        </div>`
      : st === 'form' ? html`
        <div class="frm">
          <label class="fld">${rt('ordFrom')}<input class="inp" type="date" data-order-from .value=${f.from} aria-invalid=${String(!orderFormValid(f) && !!f.from)}
            @change=${(e: Event) => this.setForm(a.id, { from: (e.target as HTMLInputElement).value })} /></label>
          <label class="fld">${rt('ordTo')}<input class="inp" type="date" data-order-to .value=${f.to} min=${f.from || ''}
            @change=${(e: Event) => this.setForm(a.id, { to: (e.target as HTMLInputElement).value })} /></label>
          <label class="fld wide">${rt('ordDocs')}<textarea class="inp" maxlength="1000" data-order-docs .value=${f.docs}
            @input=${(e: Event) => this.setForm(a.id, { docs: (e.target as HTMLTextAreaElement).value })}></textarea>
            <span class="note">${rt('ordDocsHint')}</span></label>
        </div>
        <div class="oacts">
          <button type="button" class="btn primary" data-rfq-order-create=${a.id} ?disabled=${busy || !orderFormValid(f)} @click=${() => void this.create(a)}>${tIcon('ticket')}${rt('ordCreate')}</button>
          <span class="note">${rt('ordCreateNote')}</span>
        </div>`
      : nothing}
      ${err ? html`<div class="err" role="alert" data-order-error>${err}</div>` : nothing}
    </article>`;
  }

  private dialog(): TemplateResult | typeof nothing {
    const p = this.pv;
    if (!p) return nothing;
    const close = () => !this.sending && (this.pv = null);
    const name = this.vendorName(p.award.vendor_id);
    const data = p.data;
    const blocked = !data || data.refusals.length > 0;
    return html`<sw-dialog open wide ?locked=${this.sending} heading=${`${rt('ordPreviewTitle')} · ${name}`} data-rfq-order-dialog @close=${close}>
      <div class="stack">
        ${data ? html`
          <pre class="pv" dir=${data.lang === 'en' || data.lang === 'ru' ? 'ltr' : 'rtl'} data-rfq-order-preview-text>${data.text}</pre>
          <div class="note" data-order-channel>${rt('ordVia', { channel: hasRfqText(`ch_${data.channel}`) ? rt(`ch_${data.channel}` as RfqTextKey) : data.channel })}</div>
          ${data.refusals.length ? html`<ul class="refusals" data-order-refusals>${data.refusals.map((c) => html`<li data-refusal=${c}>${c === 'order_channel_unavailable' ? rt('ordNoChannel') : refusalText(c)}</li>`)}</ul>`
            : html`<div class="note">${rt('ordPreviewNote')}</div>`}`
        : p.error ? nothing : html`<span class="skl" style="block-size:96px" aria-label=${rt('ordLoadPreview')}></span>`}
        ${p.error ? html`<div class="err" role="alert" data-dlg-error>${p.error}</div>` : nothing}
      </div>
      <button slot="footer" type="button" class="btn quiet" ?disabled=${this.sending} @click=${close}>${rt('cancel')}</button>
      <button slot="footer" type="button" class="btn primary" data-rfq-order-send ?disabled=${this.sending || blocked} @click=${() => void this.send()}>${tIcon('send')}${rt('ordSendNow')}</button>
    </sw-dialog>`;
  }

  render() {
    const d = this.rfq;
    if (!d) return nothing;
    const list = orderAwards(d);
    if (!list.length) return nothing;
    const others = notSelectedCount(d);
    const allDone = list.every((a) => a.order);
    return html`<section class="rcard" aria-labelledby="h-order" data-rfq-order>
      <h2 id="h-order">${rIcon('file')}${rt('ordSection')}</h2>
      <p class="note">${allDone ? rt('ordAllDone') : rt('ordSub')}</p>
      ${list.length > 1 ? html`<p class="note" data-order-split>${rt('ordSplit', { n: list.length })}</p>` : nothing}
      ${others ? html`<p class="note" data-order-not-selected>${rt('ordNotSelected', { n: others })}</p>` : nothing}
      <div class="ocards">${list.map((a) => this.card(a))}</div>
    </section>${this.dialog()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-rfq-order': TicketsRfqOrder;
  }
}
