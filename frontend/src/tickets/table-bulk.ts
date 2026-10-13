import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-dialog';
import { automationsStyles } from '../styles/automations-glass';
import { applyAutomationsGlass } from '../api/automations-demo';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { bidi } from '../i18n/bidi';
import { describeError } from '../api/client';
import { newRequestId, ticketsApi, type Eligible, type Meta } from '../api/tickets';
import { tableApi, type BulkAction, type BulkAnswer, type TableRow } from '../api/tickets-table';
import { PRIORITY_KEYS } from './table-model';
import { tbt, type TableTextKey } from './table-text';
import { tbIcon } from './table-icons';
import { tIcon } from './icons';
import { ticketTableStyles } from './table-styles';
import { ticketDetailStyles, ticketFormStyles } from './styles';

/**
 * CR-038 slice 6b `<tickets-table-bulk .rows .meta>`: the bulk bar of the board table while rows are selected - "3 נבחרו", assign,
 * remind, change priority, close (13.6), "clear the selection". Each action opens a short dialog (the handler / the priority / the
 * reason / a confirmation) and posts ONE request to POST tickets/bulk with each ticket's revision as the table showed it; the server
 * checks and saves every ticket on its own and answers per ticket (never all-or-nothing). Events (bubble, composed): `bulk-done`
 * {answer}, `bulk-clear`. Assigning to an outside contact (and its message preview) arrives with the public page (slice 4).
 */
@customElement('tickets-table-bulk')
export class TicketsTableBulk extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) rows: TableRow[] = [];
  @property({ attribute: false }) meta: Meta | null = null;
  @state() private dialog: BulkAction | null = null;
  @state() private eligible: Eligible[] | null = null;
  @state() private pick = '';
  @state() private note = '';
  @state() private error = '';
  @state() private busy = false;

  static styles = [bubbleChrome, ...automationsStyles, ticketDetailStyles, ticketFormStyles, ticketTableStyles, css`
    sw-dialog {
      --sw-surface: var(--dv-surface-solid);
      --sw-glass-blur: none;
    }
    .bulk .btn {
      background: var(--dv-surface-solid);
    }
  `];

  connectedCallback() {
    super.connectedCallback();
    applyAutomationsGlass(this);
  }

  private emit<T>(name: string, detail: T): void {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  private open(action: BulkAction): void {
    this.dialog = action;
    this.error = '';
    this.pick = action === 'priority' ? 'urgent' : '';
    this.note = '';
    if (action === 'assign') void this.loadEligible();
  }

  /** Who may be assigned: the eligible members of every department of the selection (the server checks each ticket again). */
  private async loadEligible(): Promise<void> {
    this.eligible = null;
    const depts = [...new Set(this.rows.map((r) => r.department?.id).filter((d): d is string => !!d))];
    try {
      const lists = await Promise.all(depts.map((d) => ticketsApi().assignees(d).catch(() => ({ users: [] as Eligible[] }))));
      const byId = new Map<string, Eligible>();
      for (const l of lists) for (const u of l.users) if (!byId.has(u.id)) byId.set(u.id, u);
      this.eligible = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) {
      this.eligible = [];
      this.error = describeError(e);
    }
  }

  private async run(): Promise<void> {
    const action = this.dialog;
    if (!action) return;
    if (action === 'assign' && !this.pick) return;
    if (action === 'close' && !this.note.trim()) {
      this.error = tbt('required');
      return;
    }
    const params = action === 'assign' ? { assignee: { kind: 'user' as const, id: this.pick } } : action === 'priority' ? { priority_key: this.pick } : action === 'close' ? { note: this.note.trim() } : {};
    this.busy = true;
    try {
      const answer: BulkAnswer = await tableApi().bulk({ action, items: this.rows.map((r) => ({ id: r.id, revision: r.revision })), params, client_request_id: newRequestId() });
      this.dialog = null;
      this.emit('bulk-done', { answer });
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private dialogBody(action: BulkAction): TemplateResult {
    const n = this.rows.length;
    const err = this.error ? html`<div class="err" role="alert" data-bulk-error>${this.error}</div>` : nothing;
    if (action === 'assign') {
      return html`<div class="form">${this.eligible === null ? html`<span class="skl" style="block-size:44px"></span>` : this.eligible.length
        ? html`<div class="pick" role="radiogroup" aria-label=${tbt('fAssignee')}>${this.eligible.map((u) => html`<label data-bulk-eligible=${u.id}><input type="radio" name="basg" .checked=${this.pick === u.id} @change=${() => { this.pick = u.id; this.error = ''; }} />${bidi(u.name)}</label>`)}</div>`
        : html`<div class="muted" data-bulk-eligible-none>${tbt('noAssignees')}</div>`}${err}</div>`;
    }
    if (action === 'priority') {
      const name = (k: string) => this.meta?.departments[0]?.priorities.find((p) => p.key === k)?.name ?? tbt(`prio_${k}` as TableTextKey);
      return html`<div class="form"><div class="prio" role="radiogroup" aria-label=${tbt('bulkPriority')}>${PRIORITY_KEYS.map((k) => html`<button type="button" class="rc" role="radio" aria-checked=${String(this.pick === k)} data-bulk-priority=${k} @click=${() => (this.pick = k)}>${name(k)}</button>`)}</div>${err}</div>`;
    }
    if (action === 'close') {
      return html`<div class="form"><label class="fld"><span>${tbt('bulkCloseNote')} <b class="req">*</b></span>
        <textarea class="inp" maxlength="2000" data-bulk-note .value=${this.note} @input=${(e: Event) => { this.note = (e.target as HTMLTextAreaElement).value; this.error = ''; }}></textarea></label>${err}</div>`;
    }
    return html`<div class="form"><div class="muted" data-bulk-remind-text>${tbt('bulkRemindText', { n })}</div>${err}</div>`;
  }

  private dialogEl(): TemplateResult | typeof nothing {
    const a = this.dialog;
    if (!a) return nothing;
    const n = this.rows.length;
    const heading = a === 'assign' ? tbt('bulkAssignTitle', { n }) : a === 'priority' ? tbt('bulkPriorityTitle', { n }) : a === 'close' ? tbt('bulkCloseTitle', { n }) : tbt('bulkRemindTitle');
    const disabled = this.busy || (a === 'assign' && !this.pick);
    return html`<sw-dialog open heading=${heading} data-bulk-dialog=${a} @close=${() => { if (!this.busy) this.dialog = null; }}>
      ${this.dialogBody(a)}
      <div slot="footer" class="sheetfoot">
        <button type="button" class=${`btn ${a === 'close' ? 'danger' : 'primary'}`} data-bulk-go ?disabled=${disabled} @click=${() => void this.run()}>${tbt('bulkGo')}</button>
        <button type="button" class="btn" data-bulk-cancel @click=${() => (this.dialog = null)}>${tbt('cancel')}</button>
      </div>
    </sw-dialog>`;
  }

  render() {
    const n = this.rows.length;
    const actions: [BulkAction, TemplateResult, string][] = [
      ['assign', tIcon('user'), tbt('bulkAssign')], ['remind', tbIcon('bell'), tbt('bulkRemind')], ['priority', tbIcon('sort'), tbt('bulkPriority')], ['close', tIcon('lock'), tbt('bulkClose')],
    ];
    return html`<div class="bulk" role="toolbar" aria-label=${tbt('bulkActions')} data-bulk-bar>
      <span class="sel" data-bulk-count>${tIcon('check')}${tbt('selected', { n })}</span>
      ${actions.map(([a, icon, label]) => html`<button type="button" class="btn sm" data-bulk=${a} @click=${() => this.open(a)}>${icon}${label}</button>`)}
      <span class="grow"></span>
      <button type="button" class="btn sm quiet" data-bulk-clear @click=${() => this.emit('bulk-clear', {})}>${tIcon('x')}${tbt('clearSelection')}</button>
    </div>
    ${this.dialogEl()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-table-bulk': TicketsTableBulk;
  }
}
