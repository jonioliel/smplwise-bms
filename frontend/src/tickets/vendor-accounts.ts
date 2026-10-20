import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-button';
import '../components/sw-dialog';
import '../components/sw-table';
import '../components/sw-state-panel';
import type { TableColumn } from '../components/sw-table';
import { settingsStyles } from '../styles/settings';
import { bubbleChrome } from '../styles/bubble-chrome';
import { SkinController } from '../design/skin';
import { ApiError, describeError } from '../api/client';
import { can, isApi } from '../api/session';
import { CURRENCIES, ticketCostsApi, type AccountClaim, type AccountClaims } from '../api/tickets-costs';
import { formatMoney, todayIso } from './cost-model';
import { ct, type CostTextKey } from './cost-text';
import { onTicketNames } from './naming';
import { ticketSettingsCss } from './settings-styles';
import { tt, ticketsLang } from './text';
import {
  BUCKETS, NO_FILTERS, accountQuery, accountSummary, bucketOf, bulkItems, bulkOutcome, keepSelection, payable, periodValid, selectionByCurrency,
  type AccountFilters, type Bucket, type CurrencyBlock, type VendorLine,
} from './vendor-account-model';

const BUCKET_TEXT: Record<Bucket, CostTextKey> = { due: 'vaDue', paid: 'vaPaid', open: 'vaOpen' };
type Phase = 'loading' | 'ready' | 'error' | 'forbidden';

/**
 * TK258 "חשבון ספקים" (#/tickets/accounts): how much is owed to each vendor for a period, what was paid and what still awaits
 * approval - per vendor and per currency (amounts are never added across currencies), the claims one per row (each links to its
 * item), the bulk "mark as paid" (tickets.costs) and the CSV of the current filter (the server's export, formula-guarded). Reads
 * GET tickets/costs/claims (tickets.costs.view). The module's restyle (mock-up v4) is pending, so this ONE component holds all the
 * screen's markup and uses only the shared components (sw-page, sw-table, sw-dialog, sw-state-panel, sw-button), the shared
 * settings classes (.in, .msg, .actions) and layout-only rules on --sw-* tokens: a new look replaces this file, nothing else.
 */
@customElement('tickets-vendor-accounts')
export class TicketsVendorAccounts extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @state() private filters: AccountFilters = { ...NO_FILTERS };
  @state() private data: AccountClaims | null = null;
  @state() private phase: Phase = 'loading';
  @state() private loadError = '';
  @state() private selected = new Set<string>();
  @state() private dialog = false;
  @state() private payRef = '';
  @state() private payDate = todayIso();
  @state() private busy = false;
  @state() private ok = '';
  @state() private error = '';
  @state() private failures: string[] = [];
  private seq = 0;
  private offNames: (() => void) | null = null;

  static styles = [settingsStyles, ticketSettingsCss, css`
    :host {
      display: block;
    }
    .filters {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      gap: var(--sw-s-2) var(--sw-s-3);
      margin-block-end: var(--sw-s-3);
      min-inline-size: 0;
    }
    .filters label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1 1 140px;
      min-inline-size: 0;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .filters .in {
      inline-size: 100%;
    }
    .bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sw-s-2) var(--sw-s-3);
      margin-block: var(--sw-s-3);
    }
    .bar .grow {
      flex: 1;
    }
    .selall {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-block-size: 36px;
      font-size: var(--sw-fs-sm);
    }
    .blocks {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      min-inline-size: 0;
    }
    h3 {
      margin: 0 0 var(--sw-s-2);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-2);
    }
    .num {
      font-variant-numeric: tabular-nums;
    }
    .strong {
      font-weight: var(--sw-fw-semibold);
    }
    input[type='checkbox'] {
      inline-size: 18px;
      block-size: 18px;
      margin: 0;
    }
    .sum {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: var(--sw-fs-sm);
    }
    .dlg {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .fails {
      margin: 4px 0 0;
      padding-inline-start: 18px;
    }
  `, bubbleChrome];

  connectedCallback(): void {
    super.connectedCallback();
    this.offNames = onTicketNames(() => this.requestUpdate());
    void this.load();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.offNames?.();
  }

  private get canMark(): boolean {
    return !!this.data?.can_mark_paid && (!isApi() || can('tickets.costs'));
  }

  private async load(): Promise<void> {
    if (isApi() && !can('tickets.costs.view')) {
      this.phase = 'forbidden';
      return;
    }
    if (!periodValid(this.filters)) return;
    const mine = ++this.seq;
    this.phase = this.data ? this.phase : 'loading';
    try {
      const d = await ticketCostsApi().accountClaims(accountQuery(this.filters));
      if (mine !== this.seq) return;
      this.data = d;
      this.selected = keepSelection(d.rows, this.selected);
      this.phase = 'ready';
    } catch (e) {
      if (mine !== this.seq) return;
      if (e instanceof ApiError && e.status === 403) {
        this.phase = 'forbidden';
        return;
      }
      this.loadError = describeError(e);
      this.phase = 'error';
    }
  }

  private setFilter(key: keyof AccountFilters, value: string): void {
    this.filters = { ...this.filters, [key]: value } as AccountFilters;
    this.ok = '';
    this.error = '';
    this.failures = [];
    void this.load();
  }

  private async exportCsv(): Promise<void> {
    this.error = '';
    try {
      await ticketCostsApi().exportCsv({ group_by: 'vendor', ...accountQuery(this.filters) }, 'claim');
    } catch (e) {
      this.error = describeError(e);
    }
  }

  private toggle(id: string, on: boolean): void {
    const next = new Set(this.selected);
    if (on) next.add(id);
    else next.delete(id);
    this.selected = next;
  }

  private toggleAll(on: boolean): void {
    this.selected = on ? new Set((this.data?.rows ?? []).filter(payable).map((r) => r.claim_id)) : new Set();
  }

  private openDialog(): void {
    this.payRef = '';
    this.payDate = todayIso();
    this.dialog = true;
  }

  private async confirmPaid(): Promise<void> {
    const rows = this.data?.rows ?? [];
    const items = bulkItems(rows, this.selected);
    if (!items.length || !this.payRef.trim() || !this.payDate) return;
    this.busy = true;
    try {
      const answer = await ticketCostsApi().markPaidBulk(items, this.payRef.trim(), this.payDate);
      const out = bulkOutcome(answer);
      this.dialog = false;
      this.selected = new Set();
      this.ok = ct('vaDone', { n: out.done });
      this.failures = out.failed.map((f) => `${f.number ? `#${f.number}` : f.claim_id} · ${ct(`r_${f.result}` as CostTextKey)}`);
      this.error = out.failed.length ? ct('vaSkipped', { n: out.failed.length }) : '';
      await this.load();
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private money(minor: number, currency: string): string {
    return formatMoney(minor, currency, ticketsLang() === 'en' ? 'en' : 'he');
  }

  private day(iso: string | null): string {
    if (!iso) return '';
    try {
      return new Intl.DateTimeFormat(ticketsLang() === 'en' ? 'en-GB' : 'he-IL', { dateStyle: 'short' }).format(new Date(iso));
    } catch {
      return iso.slice(0, 10);
    }
  }

  // ---------------------------------------------------------------- parts

  private filterBar(): TemplateResult {
    const f = this.filters;
    const d = this.data;
    const bad = !periodValid(f);
    const vendors = d?.vendors ?? [];
    const depts = d?.departments ?? [];
    return html`<div class="filters" role="group" aria-label=${ct('vaFilters')} data-va-filters>
      <label>${ct('from')}<input class="in" type="date" data-va-from .value=${f.from} max=${f.to || ''} @change=${(e: Event) => this.setFilter('from', (e.target as HTMLInputElement).value)} /></label>
      <label>${ct('to')}<input class="in" type="date" data-va-to .value=${f.to} min=${f.from || ''} aria-invalid=${bad ? 'true' : 'false'} @change=${(e: Event) => this.setFilter('to', (e.target as HTMLInputElement).value)} /></label>
      <label>${ct('vaVendor')}<select class="in" data-va-vendor @change=${(e: Event) => this.setFilter('vendor', (e.target as HTMLSelectElement).value)}>
        <option value="" ?selected=${!f.vendor}>${ct('vaAllVendors')}</option>
        ${vendors.map((v) => html`<option value=${v.key} ?selected=${f.vendor === v.key}>${v.label || ct('noLabel')}</option>`)}
      </select></label>
      <label>${ct('vaDepartment')}<select class="in" data-va-department @change=${(e: Event) => this.setFilter('department', (e.target as HTMLSelectElement).value)}>
        <option value="" ?selected=${!f.department}>${ct('vaAllDepartments')}</option>
        ${depts.map((x) => html`<option value=${x.id} ?selected=${f.department === x.id}>${x.name || ct('noLabel')}</option>`)}
      </select></label>
      <label>${ct('currency')}<select class="in" data-va-currency @change=${(e: Event) => this.setFilter('currency', (e.target as HTMLSelectElement).value)}>
        <option value="" ?selected=${!f.currency}>${ct('allCurrencies')}</option>
        ${CURRENCIES.map((c) => html`<option value=${c} ?selected=${f.currency === c}>${c}</option>`)}
      </select></label>
      <label>${ct('vaColStatus')}<select class="in" data-va-status @change=${(e: Event) => this.setFilter('bucket', (e.target as HTMLSelectElement).value)}>
        <option value="" ?selected=${!f.bucket}>${ct('vaAllStatuses')}</option>
        ${BUCKETS.map((b) => html`<option value=${b} ?selected=${f.bucket === b}>${ct(BUCKET_TEXT[b])}</option>`)}
      </select></label>
    </div>`;
  }

  private summary(blocks: CurrencyBlock[]): TemplateResult {
    type Line = VendorLine & { id: string; total?: boolean };
    const cols: TableColumn<Line>[] = [
      { key: 'label', label: ct('vaVendor'), render: (r) => html`<span class=${r.total ? 'strong' : ''}>${r.total ? ct('vaTotal') : r.label || ct('noLabel')}</span>` },
      { key: 'due', label: ct('vaDue'), render: (r) => html`<span class="num ${r.total ? 'strong' : ''}" data-va-due>${this.money(r.due, r.currency)}</span>` },
      { key: 'paid', label: ct('vaPaid'), render: (r) => html`<span class="num">${this.money(r.paid, r.currency)}</span>` },
      { key: 'open', label: ct('vaOpen'), render: (r) => html`<span class="num">${this.money(r.open, r.currency)}</span>` },
      { key: 'claims', label: ct('vaClaims'), render: (r) => html`<span class="num">${r.claims}</span>` },
    ];
    return html`<div class="blocks" data-va-summary>
      ${blocks.map((b) => {
        const rows: Line[] = [
          ...b.vendors.map((v) => ({ ...v, id: `v:${v.key}` })),
          { ...b.total, key: '', label: '', currency: b.currency, id: `total:${b.currency}`, total: true },
        ];
        return html`<section data-va-currency-block=${b.currency}>
          <h3>${b.currency}</h3>
          <sw-table dense .columns=${cols as unknown as TableColumn[]} .rows=${rows as unknown as Record<string, unknown>[]}
            @row-select=${(e: CustomEvent<{ id: string }>) => e.detail.id.startsWith('v:') && this.setFilter('vendor', e.detail.id.slice(2))}></sw-table>
        </section>`;
      })}
    </div>`;
  }

  private claims(rows: AccountClaim[]): TemplateResult {
    const mark = this.canMark;
    const cols: TableColumn<AccountClaim>[] = [
      ...(mark ? [{
        key: 'sel', label: '', width: '44px',
        render: (r: AccountClaim) => payable(r)
          ? html`<input type="checkbox" aria-label=${ct('vaSelect')} data-va-select=${r.claim_id} .checked=${this.selected.has(r.claim_id)}
              @click=${(e: Event) => e.stopPropagation()} @change=${(e: Event) => this.toggle(r.claim_id, (e.target as HTMLInputElement).checked)} />`
          : nothing,
      }] : []),
      { key: 'number', label: ct('vaColTicket'), render: (r) => r.ticket_id ? html`<a href=${`#/tickets/${r.ticket_id}`} data-va-link=${r.ticket_id} @click=${(e: Event) => e.stopPropagation()}>#${r.number ?? ''}</a>` : html`${r.number ? `#${r.number}` : ''}` },
      { key: 'title', label: ct('vaColTitle'), render: (r) => r.title },
      { key: 'vendor', label: ct('vaVendor'), render: (r) => r.vendor || ct('noLabel') },
      { key: 'department', label: ct('vaDepartment'), render: (r) => r.department },
      { key: 'status', label: ct('vaColStatus'), render: (r) => html`<span data-va-bucket=${bucketOf(r.status)}>${ct(BUCKET_TEXT[bucketOf(r.status)])}</span>` },
      { key: 'date', label: ct('vaColDate'), render: (r) => this.day(r.status === 'paid' ? r.paid_at ?? r.period_at : r.period_at) },
      { key: 'amount', label: ct('vaColAmount'), render: (r) => html`<span class="num" data-va-amount>${this.money(r.amount_minor, r.currency)}</span>` },
    ];
    return html`<sw-table dense .rowKey=${"claim_id"} data-va-claims .columns=${cols as unknown as TableColumn[]} .rows=${rows as unknown as Record<string, unknown>[]}
      @row-select=${(e: CustomEvent<{ row: AccountClaim }>) => e.detail.row.ticket_id && (window.location.hash = `#/tickets/${e.detail.row.ticket_id}`)}></sw-table>`;
  }

  private actions(rows: AccountClaim[]): TemplateResult {
    const payables = rows.filter(payable);
    const all = payables.length > 0 && payables.every((r) => this.selected.has(r.claim_id));
    return html`<div class="bar" data-va-actions>
      ${this.canMark && payables.length ? html`<label class="selall"><input type="checkbox" data-va-select-all .checked=${all} @change=${(e: Event) => this.toggleAll((e.target as HTMLInputElement).checked)} />${ct('vaSelectAll')}</label>` : nothing}
      <span class="grow"></span>
      ${this.canMark ? html`<sw-button variant="primary" icon="check" data-va-mark ?disabled=${!this.selected.size} @click=${() => this.openDialog()}>${ct('vaMarkPaidN', { n: this.selected.size })}</sw-button>` : nothing}
      <sw-button icon="download" data-va-csv ?disabled=${!rows.length} @click=${() => void this.exportCsv()}>${ct('vaCsv')}</sw-button>
    </div>`;
  }

  private bulkDialog(): TemplateResult {
    const sums = selectionByCurrency(this.data?.rows ?? [], this.selected);
    return html`<sw-dialog ?open=${this.dialog} ?locked=${this.busy} heading=${ct('markPaidTitle')} data-va-dialog @close=${() => (this.dialog = false)}>
      <ul class="sum" data-va-dialog-sum>
        ${sums.map((s) => html`<li data-va-sum=${s.currency}>${ct('vaBulkSum', { n: s.count, amount: this.money(s.minor, s.currency) })}</li>`)}
      </ul>
      <label class="dlg">${ct('paymentRef')}<input class="in" data-va-ref maxlength="60" required .value=${this.payRef} @input=${(e: Event) => (this.payRef = (e.target as HTMLInputElement).value)} /></label>
      <label class="dlg">${ct('paymentDate')}<input class="in" type="date" data-va-date required max=${todayIso()} .value=${this.payDate} @input=${(e: Event) => (this.payDate = (e.target as HTMLInputElement).value)} /></label>
      <sw-button slot="footer" @click=${() => (this.dialog = false)} ?disabled=${this.busy}>${ct('back')}</sw-button>
      <sw-button slot="footer" variant="primary" data-va-confirm ?disabled=${this.busy || !this.payRef.trim() || !this.payDate || !sums.length} @click=${() => void this.confirmPaid()}>${ct('confirm')}</sw-button>
    </sw-dialog>`;
  }

  private body(): TemplateResult {
    if (this.phase === 'forbidden') return html`<sw-state-panel state="forbidden" quiet heading=${ct('forbidden')} data-va-state="forbidden"></sw-state-panel>`;
    if (this.phase === 'loading') return html`<sw-state-panel state="loading" data-va-state="loading"></sw-state-panel>`;
    if (this.phase === 'error') {
      return html`<sw-state-panel state="error" heading=${ct('vaLoadFailed')} hint=${this.loadError} actionLabel=${ct('retry')} data-va-state="error"
        @action=${() => { this.phase = 'loading'; void this.load(); }}></sw-state-panel>`;
    }
    const rows = this.data?.rows ?? [];
    if (!rows.length) return html`<sw-state-panel icon="wrench" state="empty" quiet heading=${ct('emptyReport')} data-va-state="empty"></sw-state-panel>`;
    return html`<div data-va-state="ready">
      ${this.data?.truncated ? html`<div class="msg warn" role="status" data-va-truncated>${ct('vaTruncated')}</div>` : nothing}
      ${this.summary(accountSummary(rows))}
      ${this.actions(rows)}
      ${this.claims(rows)}
    </div>`;
  }

  render() {
    return html`<sw-page crumbs=${tt('area')} heading=${ct('vaTitle')} data-vendor-accounts data-phase=${this.phase}>
      ${this.phase === 'forbidden' ? nothing : this.filterBar()}
      ${this.error ? html`<div class="msg err" role="alert" data-va-error>${this.error}${this.failures.length ? html`<ul class="fails">${this.failures.map((f) => html`<li>${f}</li>`)}</ul>` : nothing}</div>` : nothing}
      ${this.ok ? html`<div class="msg ok" role="status" data-va-ok>${this.ok}</div>` : nothing}
      ${this.body()}
      ${this.bulkDialog()}
    </sw-page>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-vendor-accounts': TicketsVendorAccounts;
  }
}
