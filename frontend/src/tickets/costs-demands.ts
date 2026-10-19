import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { InstalmentDemandRow } from '../api/tickets-costs';
import { ticketsRfqApi } from '../api/tickets-rfq';
import { describeError } from '../api/client';
import { formatMoney } from './cost-model';
import { cIcon } from './cost-icons';
import { costsTabStyles } from './costs-tab-styles';
import { ticketsLang } from './text';
import { demandLines, demandsText, payPlan, type DemandLine } from './costs-demands-model';

/**
 * HARDEN271 + COSTINST (2.9.1) `<ticket-costs-demands .items>`: the work order's payment schedule in instalments (each row: the
 * instalment, its kind, amount, due day, where it stands - paid / late / due soon / not due - and the demand status). A lazy chunk: the
 * Costs tab imports it only when the server sent a non-empty list - dates and status for the ticket's full view, amounts and
 * `can_pay` only with tickets.costs.view. "Mark paid" appears only on rows the server flagged `can_pay` (the dashboard payments card's rule: the request is
 * visible to the caller and he holds tickets.costs + view there); it records the payment through the request-for-quotation route (an
 * instalment with no demand yet gets its demand made first) and never executes a payment. After it, the tab reloads (`cost-reload`).
 */
@customElement('ticket-costs-demands')
export class TicketCostsDemands extends LitElement {
  @property({ attribute: false }) items: readonly InstalmentDemandRow[] = [];
  @state() private confirming = '';
  @state() private busy = '';
  @state() private err = '';

  static styles = [costsTabStyles, css`
    .rows { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; font-size: var(--sw-fs-sm); }
    .row { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; padding: 8px; border-block-end: 1px solid var(--dv-border); color: var(--dv-text); }
    .row .what { flex: 1 1 140px; min-inline-size: 0; }
    .row .amt { font-variant-numeric: tabular-nums; white-space: nowrap; unicode-bidi: isolate; }
    .row .due { white-space: nowrap; color: var(--dv-text-2); unicode-bidi: isolate; }
    .chip { display: inline-block; padding: 1px 8px; border-radius: 999px; border: 1px solid var(--dv-border); font-size: var(--sw-fs-sm); color: var(--dv-text-2); }
    .chip[data-timing='late'] { color: var(--dv-danger); border-color: var(--dv-danger); }
    .chip[data-timing='soon'] { color: var(--dv-warning); border-color: var(--dv-warning); }
    .chip[data-timing='paid'] { color: var(--dv-success); border-color: var(--dv-success); }
    .st[data-status='cancelled'] { color: var(--dv-text-3); text-decoration: line-through; }
    .st[data-status='open'] { color: var(--dv-accent); }
    .st[data-status='none'] { color: var(--dv-text-3); }
    .act { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .act .btn { min-block-size: 44px; }
    .err { color: var(--dv-danger); padding: 6px 8px; }
  `];

  private async pay(l: DemandLine): Promise<void> {
    const api = ticketsRfqApi();
    if (!api.instalmentDemand) return;
    this.busy = l.id;
    this.err = '';
    try {
      for (const step of payPlan(l)) await api.instalmentDemand(l.rfqId, l.awardId, l.index, step);
      this.confirming = '';
      this.dispatchEvent(new CustomEvent('cost-reload', { bubbles: true, composed: true }));
    } catch (e) {
      this.err = `${demandsText(ticketsLang(), 'failed')} ${describeError(e)}`.trim();
    } finally {
      this.busy = '';
    }
  }

  private action(l: DemandLine, lang: 'he' | 'en') {
    if (!l.canPay) return nothing;
    if (this.confirming !== l.id) {
      return html`<button type="button" class="btn sm" data-demand-pay=${l.id} @click=${() => { this.confirming = l.id; this.err = ''; }}>${demandsText(lang, 'markPaid')}</button>`;
    }
    return html`<span class="act" data-demand-confirm=${l.id}>${demandsText(lang, 'confirm')}
      <button type="button" class="btn sm primary" ?disabled=${this.busy === l.id} data-demand-yes=${l.id} @click=${() => void this.pay(l)}>${demandsText(lang, 'yes')}</button>
      <button type="button" class="btn sm" ?disabled=${this.busy === l.id} @click=${() => (this.confirming = '')}>${demandsText(lang, 'no')}</button></span>`;
  }

  render() {
    const lang = ticketsLang();
    const lines = demandLines(this.items, lang);
    if (!lines.length) return nothing;
    return html`<section class="cstage" data-costs-demands>
      <div class="csh"><span class="ic">${cIcon('coins')}</span><b>${demandsText(lang, 'title')}</b></div>
      <ul class="rows">${lines.map((l) => html`<li class="row" data-costs-demand=${l.id} data-timing=${l.timing}>
        <span class="what">${l.label}${l.kind ? html` · <span class="muted">${l.kind}</span>` : nothing}</span>
        <span class="chip" data-timing=${l.timing}>${l.timingText}</span>
        <span class="st" data-status=${l.status}>${l.statusText}</span>
        <span class="amt">${l.amount_minor === null ? html`<span class="muted" data-demand-no-amount>-</span>` : formatMoney(l.amount_minor, l.currency, lang)}</span>
        <span class="due"><span class="muted">${demandsText(lang, 'due')}</span> ${l.due}</span>
        ${this.action(l, lang)}
      </li>`)}</ul>
      ${this.err ? html`<div class="err" role="alert" data-demand-error>${this.err}</div>` : nothing}
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ticket-costs-demands': TicketCostsDemands;
  }
}
