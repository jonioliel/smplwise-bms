import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-dialog';
import '../components/sw-state-panel';
import { get, post, describeError } from '../api/client';
import { parseRoute } from '../router';
import { bidi, ltrNum } from '../i18n/bidi';
import {
  CONFIRM, NO_FILTERS, STATUS_TEXT, actionIds, applyFilters, chunks, confirmQuestion, countsLine, filtersActive, isPending, pendingIds, rangeIds, readOnly, resultLine, statusOf,
  type Filters, type ProtectAction, type ProtectedCategory, type ProtectedSummary, type ProtectedSwitchRow, type StatusFilter,
} from './protected-switches-logic';

const PAGE = 100;

interface ListReply {
  switches: ProtectedSwitchRow[];
  summary: ProtectedSummary;
  categories: ProtectedCategory[];
}

/**
 * הגדרות › חשמל והתקנים › מתגים מוגנים (CR-019; replaces "פעולה קבוצתית"): the ONE place where switch protection is reviewed and
 * changed - the operator screens say nothing about it. A protected switch is left out of GROUP actions only; it is still controlled
 * one by one, by schedules and by automations. Every switch is listed (system.configure; the server checks it again on every call):
 * a review strip while automatic protections wait for the administrator, search / status / category / floor / area filters, sort by
 * name or place, a checkbox per row (Shift+click selects a range), then "אשר" / "הגן" / "הסר הגנה" on the selection - one
 * confirmation each (removing protection names the consequence, focus on Cancel), one call per 500 ids, a per-result line.
 * Alarm-managed, door-layer and multimedia-managed rows are read-only. A table on a wide screen, cards with a sticky action bar
 * under 600 px; 100 rows at a time ("הצג עוד"). Wording keeps to "תשתית המערכת" - no product names.
 */
@customElement('devices-protected-switches')
export class DevicesProtectedSwitches extends LitElement {
  @state() private rows: ProtectedSwitchRow[] | null = null;
  @state() private summary: ProtectedSummary | null = null;
  @state() private categories: ProtectedCategory[] = [];
  @state() private error = '';
  @state() private f: Filters = { ...NO_FILTERS };
  @state() private selected = new Set<string>();
  @state() private shown = PAGE;
  @state() private confirm: { action: ProtectAction; ids: string[] } | null = null;
  @state() private busy = false;
  @state() private result = '';
  private last: string | null = null;

  static styles = css`
    :host {
      display: block;
    }
    .strip {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      align-items: center;
      padding: 8px 12px;
      margin-block-end: 10px;
      border-radius: 10px;
      background: var(--sw-warning-soft);
      font-size: var(--sw-fs-sm);
    }
    .strip .grow {
      flex: 1;
      min-inline-size: 200px;
    }
    .bar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-block-end: 8px;
    }
    input[type='search'],
    select {
      font: inherit;
      font-size: var(--sw-fs-sm);
      min-block-size: 36px;
      padding: 0 10px;
      border: 1px solid var(--sw-border);
      border-radius: 8px;
      background: var(--sw-surface);
      color: var(--sw-text);
    }
    input[type='search'] {
      flex: 1;
      min-inline-size: 180px;
    }
    .note,
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    table {
      inline-size: 100%;
      border-collapse: collapse;
      font-size: var(--sw-fs-sm);
    }
    th,
    td {
      text-align: start;
      padding: 6px 8px;
      border-block-end: 1px solid var(--sw-border);
      vertical-align: middle;
    }
    th button {
      font: inherit;
      font-weight: var(--sw-fw-semibold);
      background: none;
      border: 0;
      padding: 0;
      cursor: pointer;
      color: var(--sw-text);
    }
    .yes {
      color: var(--sw-success, #16a34a);
      font-weight: var(--sw-fw-semibold);
    }
    .wait {
      color: var(--sw-warning, #d97706);
      font-weight: var(--sw-fw-semibold);
    }
    .no {
      color: var(--sw-text-3);
    }
    input[type='checkbox'] {
      inline-size: 18px;
      block-size: 18px;
    }
    .cards {
      display: none;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      padding-block: 8px;
    }
    .warn {
      padding: 8px 10px;
      margin-block: 8px;
      border-radius: 8px;
      background: var(--sw-warning-soft);
      font-size: var(--sw-fs-sm);
    }
    @media (max-width: 599px) {
      table {
        display: none;
      }
      .cards {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .card {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 2px 10px;
        align-items: center;
        padding: 8px 10px;
        border: 1px solid var(--sw-border);
        border-radius: 10px;
        min-block-size: 44px;
      }
      .card .sub {
        grid-column: 2;
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-3);
      }
      .actions.bulk {
        position: sticky;
        inset-block-end: 0;
        background: var(--sw-surface);
        border-block-start: 1px solid var(--sw-border);
        z-index: 1;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    void this.load().then(() => {
      const section = parseRoute().params.get('section');
      if (section === 'protected-switches' || section === 'bulk-safe') requestAnimationFrame(() => this.scrollIntoView({ block: 'start' }));
    });
  }

  private async load() {
    try {
      const r = await get<ListReply>('devices/bulk-protected');
      this.rows = r.switches;
      this.summary = r.summary;
      this.categories = r.categories ?? [];
      this.error = '';
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private setFilter(patch: Partial<Filters>) {
    this.f = { ...this.f, ...patch };
    this.shown = PAGE;
  }

  /** `on` is the box's state AFTER the native toggle (the click is not cancelled: cancelling a checkbox click makes the browser
   * restore the old `checked` after Lit re-rendered, so a selected row showed an empty box). */
  private toggle(id: string, on: boolean, shift: boolean, list: ProtectedSwitchRow[]) {
    const next = new Set(this.selected);
    const ids = shift && this.last ? rangeIds(list, this.last, id) : [id];
    for (const x of ids) (on ? next.add(x) : next.delete(x));
    this.last = id;
    this.selected = next;
  }

  private ask(action: ProtectAction, ids: string[]) {
    if (!ids.length) return;
    this.confirm = { action, ids };
  }

  private async apply() {
    const c = this.confirm;
    if (!c) return;
    this.busy = true;
    try {
      let changed = 0;
      let refused = 0;
      for (const part of chunks(c.ids)) {
        const r = await post<{ changed: number; refused: number }>('devices/bulk-protected', { entity_ids: part, action: c.action });
        changed += r.changed;
        refused += r.refused;
      }
      this.result = resultLine(c.action, changed, refused);
      this.selected = new Set();
      this.confirm = null;
      await this.load();
    } catch (err) {
      this.result = describeError(err);
      this.confirm = null;
      await this.load();
    } finally {
      this.busy = false;
    }
  }

  render() {
    const rows = this.rows;
    const head = 'מתגים מוגנים';
    if (this.error) return html`<sw-card heading=${head}><sw-state-panel compact state="error" heading="לא ניתן לטעון את המתגים" hint=${this.error}></sw-state-panel></sw-card>`;
    if (!rows) return html`<sw-card heading=${head}><sw-state-panel compact state="loading"></sw-state-panel></sw-card>`;
    const f = this.f;
    const list = applyFilters(rows, f);
    const page = list.slice(0, this.shown);
    const floors = [...new Map(rows.filter((r) => r.floor_id).map((r) => [r.floor_id!, r.floor_name ?? r.floor_id!])).entries()];
    const areas = [...new Map(rows.filter((r) => r.area_id && (!f.floor || r.floor_id === f.floor)).map((r) => [r.area_id!, r.area_name ?? r.area_id!])).entries()];
    const selectable = list.filter((r) => !readOnly(r));
    const waiting = this.summary?.auto_unreviewed ?? pendingIds(rows).length;
    const place = (r: ProtectedSwitchRow) => [r.floor_name, r.area_name].filter(Boolean).join(' › ') || 'ללא שיוך';
    const status = (r: ProtectedSwitchRow) => {
      const s = statusOf(r);
      return html`<span class=${s === 'protected' ? 'yes' : s === 'pending' ? 'wait' : 'no'} data-status=${s}>${STATUS_TEXT[s]}</span>`;
    };
    const source = (r: ProtectedSwitchRow) =>
      r.source === 'auto' ? html`<span title=${r.rule ?? ''}>אוטומטי${r.category_label ? ` · ${r.category_label}` : ''}</span>` : r.source === 'manual' ? 'ידני' : html`<span class="muted">—</span>`;
    const reviewed = (r: ProtectedSwitchRow) => (r.reviewed ? html`<span class="yes" aria-label="נבדק">✓</span>` : isPending(r) ? html`<span class="wait">ממתין</span>` : html`<span class="muted">—</span>`);
    const when = (r: ProtectedSwitchRow) => {
      const at = r.reviewed_at ?? r.marked_at;
      const who = r.reviewed_at ? r.reviewed_by : r.marked_by;
      return at ? [who, new Date(at).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })].filter(Boolean).join(' · ') : '';
    };
    const box = (r: ProtectedSwitchRow) =>
      html`<input type="checkbox" data-protected-row=${r.entity_id} aria-label=${`בחר ${r.name}`} .checked=${this.selected.has(r.entity_id)} ?disabled=${readOnly(r)} @click=${(e: MouseEvent) => this.toggle(r.entity_id, (e.currentTarget as HTMLInputElement).checked, e.shiftKey, list)} />`;
    const sel = (a: ProtectAction) => actionIds(a, rows, this.selected).length;
    return html`<sw-card heading=${head} subheading="מתגים מוגנים לא נכללים ב'כבה הכל' ובפעולות קבוצתיות. אפשר עדיין להפעיל אותם לבד, בתזמון ובאוטומציה." data-protected-switches>
      ${waiting
        ? html`<div class="strip" role="status" data-protected-strip>
            <span class="grow">${ltrNum(waiting)} מתגים סומנו כמוגנים אוטומטית וממתינים לאישורך</span>
            <sw-button size="sm" data-protected-show @click=${() => this.setFilter({ status: 'pending' })}>הצג</sw-button>
            <sw-button size="sm" variant="primary" data-protected-approve-all ?disabled=${this.busy} @click=${() => this.ask('approve', pendingIds(rows))}>אשר את כולם</sw-button>
          </div>`
        : nothing}
      <div class="bar">
        <input type="search" data-protected-search placeholder="חיפוש לפי שם, אזור או מזהה…" aria-label="חיפוש מתגים" .value=${f.q} @input=${(e: Event) => this.setFilter({ q: (e.target as HTMLInputElement).value })} />
        <select data-protected-status aria-label="סטטוס" @change=${(e: Event) => this.setFilter({ status: (e.target as HTMLSelectElement).value as StatusFilter })}>
          <option value="" ?selected=${!f.status}>הכל</option>
          <option value="protected" ?selected=${f.status === 'protected'}>מוגנים</option>
          <option value="pending" ?selected=${f.status === 'pending'}>ממתינים לבדיקה</option>
          <option value="unprotected" ?selected=${f.status === 'unprotected'}>לא מוגנים</option>
        </select>
        <select data-protected-category aria-label="קטגוריה" @change=${(e: Event) => this.setFilter({ category: (e.target as HTMLSelectElement).value })}><option value="">כל הקטגוריות</option>${this.categories.map((c) => html`<option value=${c.id} ?selected=${f.category === c.id}>${c.label}</option>`)}</select>
        <select data-protected-floor aria-label="קומה" @change=${(e: Event) => this.setFilter({ floor: (e.target as HTMLSelectElement).value, area: '' })}><option value="">כל הקומות</option>${floors.map(([id, n]) => html`<option value=${id} ?selected=${f.floor === id}>${n}</option>`)}</select>
        <select data-protected-area aria-label="אזור" @change=${(e: Event) => this.setFilter({ area: (e.target as HTMLSelectElement).value })}><option value="">כל האזורים</option>${areas.map(([id, n]) => html`<option value=${id} ?selected=${f.area === id}>${n}</option>`)}</select>
        ${filtersActive(f) ? html`<sw-button size="sm" variant="ghost" data-protected-reset @click=${() => { this.f = { ...NO_FILTERS, sort: f.sort }; this.shown = PAGE; }}>נקה סינון</sw-button>` : nothing}
      </div>
      <div class="note" data-protected-counts>${countsLine(list.length, rows, this.summary)}</div>
      ${list.length
        ? html`<table>
              <thead><tr>
                <th><span class="muted">בחירה</span></th>
                <th aria-sort=${f.sort === 'name' ? 'ascending' : 'none'}><button type="button" data-protected-sort="name" @click=${() => this.setFilter({ sort: 'name' })}>שם</button></th>
                <th aria-sort=${f.sort === 'area' ? 'ascending' : 'none'}><button type="button" data-protected-sort="area" @click=${() => this.setFilter({ sort: 'area' })}>קומה › אזור</button></th>
                <th>מוגן</th><th>מקור</th><th>נבדק</th><th>שונה על ידי</th>
              </tr></thead>
              <tbody>${page.map((r) => html`<tr data-entity=${r.entity_id}><td>${box(r)}</td><td>${bidi(r.name)}<div class="muted">${r.entity_id}</div></td><td>${place(r)}</td><td>${status(r)}</td><td>${source(r)}</td><td>${reviewed(r)}</td><td class="muted">${when(r)}</td></tr>`)}</tbody>
            </table>
            <div class="cards">${page.map((r) => html`<label class="card" data-entity=${r.entity_id}>${box(r)}<span>${bidi(r.name)} · ${status(r)}</span><span class="sub">${place(r)}${r.source ? html` · ${source(r)}` : nothing}</span></label>`)}</div>`
        : html`<sw-state-panel compact state="empty" heading=${rows.length ? 'אין מתגים שמתאימים לסינון' : 'אין מתגים'} data-protected-empty></sw-state-panel>`}
      ${list.length > this.shown ? html`<sw-button size="sm" data-protected-more @click=${() => (this.shown += PAGE)}>הצג עוד (${ltrNum(list.length - this.shown)})</sw-button>` : nothing}
      <div class="actions bulk">
        <span data-protected-selected>נבחרו ${ltrNum(this.selected.size)} מתוך ${ltrNum(rows.length)}</span>
        <sw-button size="sm" data-protected-all ?disabled=${!selectable.length} @click=${() => (this.selected = new Set([...this.selected, ...selectable.map((r) => r.entity_id)]))}>בחר הכול (${ltrNum(selectable.length)})</sw-button>
        <sw-button size="sm" variant="ghost" data-protected-clear ?disabled=${!this.selected.size} @click=${() => (this.selected = new Set())}>נקה בחירה</sw-button>
        <sw-button size="sm" variant="primary" data-protected-do-approve ?disabled=${!sel('approve')} @click=${() => this.ask('approve', actionIds('approve', rows, this.selected))}>אשר</sw-button>
        <sw-button size="sm" data-protected-do-protect ?disabled=${!sel('protect')} @click=${() => this.ask('protect', actionIds('protect', rows, this.selected))}>הגן</sw-button>
        <sw-button size="sm" data-protected-do-unprotect ?disabled=${!sel('unprotect')} @click=${() => this.ask('unprotect', actionIds('unprotect', rows, this.selected))}>הסר הגנה</sw-button>
      </div>
      ${this.result ? html`<div class="note" role="status" data-protected-result>${this.result}</div>` : nothing}
      ${this.confirm === null ? nothing : this.renderConfirm(this.confirm)}
    </sw-card>`;
  }

  private renderConfirm(c: { action: ProtectAction; ids: string[] }) {
    const meta = CONFIRM[c.action];
    return html`<sw-dialog open ?locked=${this.busy} data-protected-dialog=${c.action} heading=${meta.heading} @close=${() => (this.confirm = null)}>
      <div data-protected-question>${confirmQuestion(c.action, c.ids.length)}</div>
      ${c.action === 'unprotect' ? html`<div class="warn">מתג יכול להיות דוד, משאבה או שער - ודאו שבטוח לכבות ולהדליק אותו יחד עם שאר המתגים.</div>` : nothing}
      <div class="actions">
        <sw-button data-protected-cancel autofocus @click=${() => (this.confirm = null)}>ביטול</sw-button>
        <sw-button variant=${meta.danger ? 'danger' : 'primary'} data-protected-confirm ?disabled=${this.busy} @click=${() => void this.apply()}>${meta.button} (${ltrNum(c.ids.length)})</sw-button>
      </div>
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'devices-protected-switches': DevicesProtectedSwitches;
  }
}
