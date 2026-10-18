import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { InstalmentDemandRow } from '../api/tickets-costs';
import { formatMoney } from './cost-model';
import { cIcon } from './cost-icons';
import { costsTabStyles } from './costs-tab-styles';
import { ticketsLang } from './text';
import { demandLines, demandsText } from './costs-demands-model';

/**
 * HARDEN271 (owner 2026-10-17, RFQPAY2 follow-up) `<ticket-costs-demands .items>`: the work order's instalment payment demands, READ-ONLY
 * (each row: the instalment, its kind, status, amount and due day). A lazy chunk: the Costs tab imports it only when the server sent a
 * non-empty list - which it does only for a caller who may see the tab's amounts (tickets.costs.view). Marking paid / cancelling stays on
 * the request for quotation's own screen.
 */
@customElement('ticket-costs-demands')
export class TicketCostsDemands extends LitElement {
  @property({ attribute: false }) items: readonly InstalmentDemandRow[] = [];

  static styles = [costsTabStyles, css`
    table { inline-size: 100%; border-collapse: collapse; font-size: var(--sw-fs-sm); }
    td { text-align: start; padding: 6px 8px; border-block-end: 1px solid var(--dv-border); color: var(--dv-text); }
    td.amt { font-variant-numeric: tabular-nums; white-space: nowrap; }
    td[data-status='cancelled'] { color: var(--dv-text-3); text-decoration: line-through; }
    td[data-status='open'] { color: var(--dv-accent); }
  `];

  render() {
    const lang = ticketsLang();
    const lines = demandLines(this.items, lang);
    if (!lines.length) return nothing;
    return html`<section class="cstage" data-costs-demands>
      <div class="csh"><span class="ic">${cIcon('coins')}</span><b>${demandsText(lang, 'title')}</b></div>
      <table>
        <tbody>${lines.map((l) => html`<tr data-costs-demand=${l.id}>
          <td>${l.label}${l.kind ? html` · <span class="muted">${l.kind}</span>` : nothing}</td>
          <td data-status=${l.status}>${l.statusText}</td>
          <td class="amt">${formatMoney(l.amount_minor, l.currency, lang)}</td>
          <td><span class="muted">${demandsText(lang, 'due')}</span> ${l.due}</td>
        </tr>`)}</tbody>
      </table>
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ticket-costs-demands': TicketCostsDemands;
  }
}
