import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-dialog';
import '../components/sw-button';
import { settingsStyles } from '../styles/settings';
import { ticketSettingsCss } from './settings-styles';
import { describeError, ApiError } from '../api/client';
import { ticketsApi, type Meta } from '../api/tickets';
import { intakeApi, type IntakeDraft, type IntakeDraftRow, type IntakeEditKey, type IntakeSummary, type RejectReason } from '../api/tickets-intake';
import { itx, type IntakeKey } from '../i18n/intake';
import { allEvidence, fieldValue, flagKeys, PAGE_SIZE, pager, segments, urgencyTone } from './intake-model';

const REASONS: RejectReason[] = ['not_a_request', 'duplicate', 'spam', 'abusive', 'out_of_scope', 'test'];
const PRIORITIES = ['urgent', 'high', 'normal', 'low'] as const;

/**
 * CR-INTAKE99 / TENANTINTAKE098-295 (owner answers 143-156): "פניות לאישור" - the free-text requests that arrived from known numbers by
 * WhatsApp, waiting for a person. The chip on the requests screen shows only while the caller may handle them AND at least one waits
 * (clean operator screens); it opens one dialog with a short page of the queue (urgent first) and, per draft, the message (plain text,
 * the phrases that produced the suggestions marked), the editable suggestions and the three decisions: approve (opens ONE ordinary
 * request through the module's creation path, flagged for review), attach to an existing request, or reject with a reason. Nothing is
 * assigned or sent before a person approves. The page is five rows - no scrolling. Events: `ticket-changed` after an approval or attach.
 */
@customElement('tickets-intake-chip')
export class TicketsIntakeChip extends LitElement {
  @state() private summary: IntakeSummary | null = null;
  @state() private open = false;
  @state() private rows: IntakeDraftRow[] = [];
  @state() private total = 0;
  @state() private offset = 0;
  @state() private draft: IntakeDraft | null = null;
  @state() private meta: Meta | null = null;
  @state() private busy = false;
  @state() private error = '';
  @state() private ok = '';
  @state() private mergeNumber = '';
  @state() private rejectOpen = false;
  @state() private block = false;
  private timer = 0;

  static styles = [settingsStyles, ticketSettingsCss, css`
    :host { display: contents; }
    .chip { display: inline-flex; align-items: center; gap: var(--sw-s-1); }
    .list { display: flex; flex-direction: column; gap: var(--sw-s-2); min-inline-size: min(34rem, 80vw); }
    .item { display: flex; align-items: center; gap: var(--sw-s-2); padding: var(--sw-s-2) var(--sw-s-3); border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm); background: var(--sw-surface); color: inherit; font: inherit; text-align: start; cursor: pointer; }
    .item:hover { background: var(--sw-surface-2); }
    .item .line { flex: 1; min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tag { font-size: var(--sw-fs-xs); padding: 1px 8px; border-radius: var(--sw-r-pill); border: 1px solid var(--sw-border); white-space: nowrap; }
    .tag[data-tone='danger'] { color: var(--sw-danger-text); border-color: var(--sw-danger-text); }
    .tag[data-tone='warning'] { color: var(--sw-warning-text); border-color: var(--sw-warning-text); }
    .pager { display: flex; align-items: center; justify-content: space-between; gap: var(--sw-s-2); font-size: var(--sw-fs-sm); color: var(--sw-text-3); }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--sw-s-2) var(--sw-s-3); }
    @media (max-width: 560px) { .grid { grid-template-columns: minmax(0, 1fr); } }
    .msg { white-space: pre-wrap; overflow-wrap: anywhere; padding: var(--sw-s-2) var(--sw-s-3); border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm); background: var(--sw-surface-2); }
    .msg mark { background: var(--sw-accent-soft); color: inherit; border-block-end: 2px solid var(--sw-accent-text); }
    label.f { display: flex; flex-direction: column; gap: 2px; font-size: var(--sw-fs-sm); min-inline-size: 0; }
    label.f small { color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
    label.f input, label.f select { inline-size: 100%; min-inline-size: 0; box-sizing: border-box; padding: 6px 8px; border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm); background: var(--sw-surface); color: inherit; font: inherit; }
    .flags { display: flex; flex-wrap: wrap; gap: var(--sw-s-1); }
    .bar { display: flex; flex-wrap: wrap; gap: var(--sw-s-2); align-items: center; }
    .err { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); }
    .okm { color: var(--sw-success-text); font-size: var(--sw-fs-sm); }
    .meta { display: flex; flex-wrap: wrap; gap: var(--sw-s-3); font-size: var(--sw-fs-sm); color: var(--sw-text-3); }
  `];

  connectedCallback(): void {
    super.connectedCallback();
    void this.refreshSummary();
    this.timer = window.setInterval(() => void this.refreshSummary(), 60_000);
  }

  disconnectedCallback(): void {
    window.clearInterval(this.timer);
    super.disconnectedCallback();
  }

  private async refreshSummary(): Promise<void> {
    try {
      this.summary = await intakeApi.summary();
    } catch {
      this.summary = null; // module off / not allowed: the chip is simply absent
    }
  }

  private async loadPage(offset = this.offset): Promise<void> {
    try {
      const r = await intakeApi.drafts(offset, PAGE_SIZE);
      this.rows = r.drafts;
      this.total = r.total;
      this.offset = offset;
      if (!r.drafts.length && offset > 0) await this.loadPage(Math.max(0, offset - PAGE_SIZE));
    } catch (e) {
      this.error = describeError(e);
    }
  }

  private async show(): Promise<void> {
    this.open = true;
    this.error = '';
    this.ok = '';
    this.draft = null;
    if (!this.meta) {
      try { this.meta = await ticketsApi().meta(); } catch { /* the pickers stay empty; the server still validates */ }
    }
    await this.loadPage(0);
  }

  private async openDraft(id: string): Promise<void> {
    this.error = '';
    this.ok = '';
    this.mergeNumber = '';
    this.rejectOpen = false;
    this.block = false;
    try {
      this.draft = await intakeApi.draft(id);
    } catch (e) {
      this.error = describeError(e);
    }
  }

  private async run(action: () => Promise<string>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      this.ok = await action();
      this.draft = null;
      this.rejectOpen = false;
      await Promise.all([this.loadPage(), this.refreshSummary()]);
      this.dispatchEvent(new CustomEvent('ticket-changed', { bubbles: true, composed: true }));
    } catch (e) {
      this.error = e instanceof ApiError && e.status === 409 ? itx('changed') : describeError(e);
      if (e instanceof ApiError && e.status === 409) {
        this.draft = null;
        await this.loadPage();
      }
    } finally {
      this.busy = false;
    }
  }

  private async saveEdit(key: IntakeEditKey, value: string): Promise<void> {
    const d = this.draft;
    if (!d || this.busy || fieldValue(d, key) === value) return;
    this.busy = true;
    this.error = '';
    try {
      const values: Partial<Record<IntakeEditKey, string | null>> = { [key]: value || null };
      if (key === 'department_id') values.category_id = null; // a category belongs to one department
      this.draft = await intakeApi.edit(d, values);
    } catch (e) {
      this.error = describeError(e);
      await this.openDraft(d.id);
    } finally {
      this.busy = false;
    }
  }

  private deptOptions() {
    return this.meta?.departments ?? [];
  }

  private urgencyLabel(u: string): string {
    return itx((PRIORITIES as readonly string[]).includes(u) ? (u as IntakeKey) : 'normal');
  }

  private rowTag(r: IntakeDraftRow) {
    return html`<span class="tag" data-tone=${urgencyTone(r.urgency)}>${this.urgencyLabel(r.urgency)}</span>`;
  }

  private listView() {
    const p = pager(this.total, this.offset, this.rows.length);
    return html`<div class="list" data-intake-list>
      ${this.rows.length ? this.rows.map((r) => html`<button type="button" class="item" data-intake-row=${r.id} @click=${() => void this.openDraft(r.id)}>
        ${this.rowTag(r)}<span class="line" dir="auto">${r.first_line}</span>
        <span class="tag" dir="auto">${r.requester?.name ?? itx('unknownRequester')}</span>
        ${r.message_count > 1 ? html`<span class="tag">${r.message_count} ${itx('more')}</span>` : nothing}</button>`)
        : html`<div class="meta" data-intake-empty>${itx('empty')}</div>`}
      ${this.total > PAGE_SIZE ? html`<div class="pager"><sw-button size="sm" ?disabled=${p.prev === null} data-intake-prev @click=${() => p.prev !== null && void this.loadPage(p.prev)}>${itx('prev')}</sw-button>
        <span>${p.from}-${p.to} ${itx('of')} ${p.total}</span>
        <sw-button size="sm" ?disabled=${p.next === null} data-intake-next @click=${() => p.next !== null && void this.loadPage(p.next)}>${itx('next')}</sw-button></div>` : nothing}
    </div>`;
  }

  private text(d: IntakeDraft) {
    // text nodes only: the evidence marks are <mark> runs of the SAME plain text, never HTML and never a link
    return html`<div class="msg" dir="auto" data-intake-text>${segments(d.text, allEvidence(d)).map((s) => (s.hit ? html`<mark>${s.text}</mark>` : s.text))}</div>`;
  }

  private detailView(d: IntakeDraft) {
    const dept = fieldValue(d, 'department_id');
    const cats = this.deptOptions().find((x) => x.id === dept)?.categories ?? [];
    const flags = flagKeys(d.flags);
    return html`<div data-intake-detail style="display:flex;flex-direction:column;gap:var(--sw-s-3)">
      <div class="meta"><span dir="auto">${d.requester ? `${d.requester.name}${d.requester.org ? ' · ' + d.requester.org : ''}` : itx('unknownRequester')}</span>
        <bdi dir="ltr">${d.requester?.phone_masked ?? ''}</bdi>${d.message_count > 1 ? html`<span>${d.message_count} ${itx('more')}</span>` : nothing}
        ${d.duplicates.ticket_numbers.length || d.duplicates.drafts.length ? html`<span data-intake-dup>${itx('duplicates')}: ${d.duplicates.ticket_numbers.map((n) => `#${n}`).join(' ')}</span>` : nothing}</div>
      ${flags.length ? html`<div class="flags">${flags.map((k) => html`<span class="tag" data-tone=${k === 'safety' ? 'danger' : 'warning'}>${itx(k)}</span>`)}</div>` : nothing}
      ${this.text(d)}
      <div class="grid">
        <label class="f">${itx('department')}<select data-intake-field="department_id" .value=${dept} @change=${(e: Event) => void this.saveEdit('department_id', (e.target as HTMLSelectElement).value)}>
          <option value="">${itx('pickDept')}</option>${this.deptOptions().map((x) => html`<option value=${x.id} ?selected=${x.id === dept}>${x.name}</option>`)}</select></label>
        <label class="f">${itx('category')}<small>${itx(`conf_${d.suggestion.category.confidence}` as IntakeKey)}</small>
          <select data-intake-field="category_id" @change=${(e: Event) => void this.saveEdit('category_id', (e.target as HTMLSelectElement).value)}>
          <option value="">${itx('none')}</option>${cats.map((c) => html`<option value=${c.id} ?selected=${c.id === fieldValue(d, 'category_id')}>${c.name}</option>`)}</select></label>
        <label class="f">${itx('urgency')}<small>${itx(`conf_${d.suggestion.urgency.confidence}` as IntakeKey)}</small>
          <select data-intake-field="priority_key" @change=${(e: Event) => void this.saveEdit('priority_key', (e.target as HTMLSelectElement).value)}>
          ${PRIORITIES.map((k) => html`<option value=${k} ?selected=${k === fieldValue(d, 'priority_key')}>${this.urgencyLabel(k)}</option>`)}</select></label>
        <label class="f">${itx('place')}<small>${itx(`conf_${d.suggestion.place.confidence}` as IntakeKey)}</small>
          <input data-intake-field="place_other" maxlength="200" dir="auto" .value=${fieldValue(d, 'place_other')} @change=${(e: Event) => void this.saveEdit('place_other', (e.target as HTMLInputElement).value)} /></label>
        <label class="f" style="grid-column: 1 / -1">${itx('titleField')}<input data-intake-field="title" maxlength="120" dir="auto" .value=${fieldValue(d, 'title')}
          @change=${(e: Event) => void this.saveEdit('title', (e.target as HTMLInputElement).value)} /></label>
      </div>
      ${this.rejectOpen ? html`<div class="bar" data-intake-reject-bar>
        ${REASONS.map((r) => html`<sw-button size="sm" ?disabled=${this.busy} data-intake-reason=${r}
          @click=${() => void this.run(async () => { await intakeApi.reject(d, r, this.block); return itx('rejected'); })}>${itx(`reason_${r}` as IntakeKey)}</sw-button>`)}
        <label class="bar"><input type="checkbox" data-intake-block .checked=${this.block} @change=${(e: Event) => (this.block = (e.target as HTMLInputElement).checked)} />${itx('block')}</label></div>` : nothing}
      <div class="bar">
        <sw-button variant="primary" ?disabled=${this.busy || !dept} data-intake-approve
          @click=${() => void this.run(async () => { const r = await intakeApi.approve(d); return `${itx('approved')} #${r.number}`; })}>${itx('approve')}</sw-button>
        <input data-intake-merge-number inputmode="numeric" maxlength="7" size="7" placeholder=${itx('mergeNumber')} .value=${this.mergeNumber}
          @input=${(e: Event) => (this.mergeNumber = (e.target as HTMLInputElement).value.replace(/\D/g, ''))} />
        <sw-button ?disabled=${this.busy || !this.mergeNumber} data-intake-merge @click=${() => void this.merge(d)}>${itx('merge')}</sw-button>
        <sw-button ?disabled=${this.busy} data-intake-reject @click=${() => (this.rejectOpen = !this.rejectOpen)}>${itx('reject')}</sw-button>
        <sw-button size="sm" data-intake-back @click=${() => { this.draft = null; }}>${itx('back')}</sw-button>
      </div>
    </div>`;
  }

  private async merge(d: IntakeDraft): Promise<void> {
    const number = Number(this.mergeNumber);
    await this.run(async () => {
      await intakeApi.merge(d, number); // the server resolves the number among the requests the caller may see
      return itx('merged');
    });
  }

  render() {
    const s = this.summary;
    if (!s || !s.can || (!s.open && !this.open)) return nothing;
    return html`<sw-button size="sm" data-intake-chip @click=${() => void this.show()}>${itx('chip')} <strong>${s.open}</strong></sw-button>
      <sw-dialog ?open=${this.open} wide heading=${itx('title')} @close=${() => { this.open = false; this.draft = null; void this.refreshSummary(); }}>
        ${this.error ? html`<div class="err" role="alert" data-intake-error>${this.error}</div>` : nothing}
        ${this.ok ? html`<div class="okm" role="status" data-intake-ok>${this.ok}</div>` : nothing}
        ${this.draft ? this.detailView(this.draft) : this.listView()}
      </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-intake-chip': TicketsIntakeChip;
  }
}
