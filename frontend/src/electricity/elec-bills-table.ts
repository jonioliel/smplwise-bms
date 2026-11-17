/** CR-023: the bills table (desktop / tablet) and list (phone), shared by the bills screen, the account page and the customer card. */
import { html, nothing, type TemplateResult } from 'lit';
import type { BillSummary } from '../api/electricity-billing';
import { billChip } from './elec-ui';
import { f2, fmtDate, fmtRange } from './elec-format';
import { href, go, route } from './elec-routes';
import { tr } from '../i18n/msg/electricity';

const open = (b: BillSummary) => go(route.bill(b.id));
const noClick = (e: Event) => e.stopPropagation();

export function billsTable(list: BillSummary[], o: { phone: boolean; compact?: boolean }): TemplateResult {
  if (o.phone) {
    return html`<div class="list" data-elec-bills>
      ${list.map(
        (b) => html`<a class="li" href=${href.bill(b.id)} data-bill-row=${b.id} data-bill-state=${b.state}>
          <div class="grow"><div class="t1">${b.number ? html`<span class="num">${b.number}</span>` : tr('טיוטה')} · ${b.account_name}</div><div class="t2">${fmtRange(b.period.from, b.period.to)} · <span class="num">${f2(b.kwh)}</span> ${tr('קוט״ש')}</div></div>
          <div style="text-align:end"><b class="num">${f2(b.total)} ₪</b><div style="margin-block-start:4px">${billChip(b.state)}</div></div>
        </a>`,
      )}
    </div>`;
  }
  return html`<div class="card flush scrollx" data-elec-bills>
    <table class="t">
      <thead><tr><th>${tr('מספר')}</th>${o.compact ? nothing : html`<th>${tr('לקוח')}</th><th>${tr('חשבון')}</th>`}<th>${tr('תקופה')}</th><th class="num">${tr('קוט״ש')}</th><th class="num">${tr('סה״כ לתשלום')}</th><th>${tr('מצב')}</th><th class="hide-tablet">${tr('הונפק')}</th></tr></thead>
      <tbody>
        ${list.map(
          (b) => html`<tr class="go" data-bill-row=${b.id} data-bill-state=${b.state} @click=${() => open(b)}>
            <td class="b"><a class="rowlink" href=${href.bill(b.id)} @click=${noClick}>${b.number ? html`<span class="num">${b.number}</span>` : html`<span class="mut">${tr('טיוטה')}</span>`}</a></td>
            ${o.compact ? nothing : html`<td>${b.customer.name}</td><td>${b.account_name}</td>`}
            <td><span class="num">${fmtRange(b.period.from, b.period.to)}</span></td>
            <td class="num">${f2(b.kwh)}</td>
            <td class="num">${f2(b.total)} ₪</td>
            <td>${billChip(b.state)}</td>
            <td class="num hide-tablet" style="text-align:start">${b.issue_date ? fmtDate(b.issue_date) : '-'}</td>
          </tr>`,
        )}
      </tbody>
    </table>
  </div>`;
}
