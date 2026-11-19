/** CR-023: the bills table (desktop / tablet) and list (phone), shared by the bills screen, the account page and the customer card. */
import { html, type TemplateResult } from 'lit';
import type { BillSummary } from '../api/electricity-billing';
import '../components/sw-table';
import type { TableColumn } from '../components/sw-table';
import { billCellChip, billChip } from './elec-ui';
import { f2, fmtDate, fmtRange } from './elec-format';
import { href, go, route } from './elec-routes';
import { tr } from '../i18n/msg/electricity';

const open = (b: BillSummary) => go(route.bill(b.id));
const noClick = (e: Event) => e.stopPropagation();

/** CR-CMP2-TABLES-CONSUMPTION-2450 (owner N10): the bills table is the shared sw-table - the number is the row's link (its tab stop:
 * `no-focus-rows`; a click anywhere on the row opens the bill too), figures as LTR isolates at the reading end, the state a chip in the
 * shared tones, the issue date steps out below 1024 px. Row hooks `data-bill-row` + `data-bill-state`. */
function columns(compact: boolean): TableColumn<BillSummary>[] {
  return [
    {
      key: 'number',
      label: tr('מספר'),
      render: (b) => html`<a class="t1" href=${href.bill(b.id)} @click=${noClick}>${b.number ? html`<span class="num">${b.number}</span>` : html`<span class="mut">${tr('טיוטה')}</span>`}</a>`,
    },
    ...(compact
      ? []
      : ([
          { key: 'customer', label: tr('לקוח'), render: (b) => b.customer.name },
          { key: 'account', label: tr('חשבון'), render: (b) => b.account_name },
        ] satisfies TableColumn<BillSummary>[])),
    { key: 'period', label: tr('תקופה'), render: (b) => html`<span class="num">${fmtRange(b.period.from, b.period.to)}</span>` },
    { key: 'kwh', label: tr('קוט״ש'), kind: 'num', render: (b) => f2(b.kwh) },
    { key: 'total', label: tr('סה״כ לתשלום'), kind: 'num', render: (b) => `${f2(b.total)} ₪` },
    { key: 'state', label: tr('מצב'), kind: 'status', render: (b) => billCellChip(b.state) },
    { key: 'issued', label: tr('הונפק'), hideBelow: 'tablet', render: (b) => html`<span class="num">${b.issue_date ? fmtDate(b.issue_date) : '-'}</span>` },
  ];
}

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
  return html`<sw-table class="t card flush" data-elec-bills no-focus-rows .columns=${columns(!!o.compact) as unknown as TableColumn[]} .rows=${list as unknown as Record<string, unknown>[]}
    .rowAttrs=${(r: Record<string, unknown>) => ({ 'data-bill-row': String(r.id), 'data-bill-state': String(r.state) })}
    @row-select=${(e: CustomEvent<{ row: Record<string, unknown> }>) => open(e.detail.row as unknown as BillSummary)}></sw-table>`;
}
