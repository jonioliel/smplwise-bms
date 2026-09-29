import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-dialog';
import '../components/sw-state-panel';
import { get, post, describeError } from '../api/client';
import { parseRoute } from '../router';
import { bidi, ltrNum } from '../i18n/bidi';

interface SwitchRow {
  entity_id: string;
  name: string;
  area_id: string | null;
  area_name: string | null;
  floor_id: string | null;
  floor_name: string | null;
  state: string | null;
  available: boolean;
  marked: boolean;
  included: boolean;
  reason: string;
  reason_label: string | null;
  alarm_managed: boolean;
  marked_by: string | null;
  marked_at: string | null;
}

const PAGE = 100;

/**
 * הגדרות › חשמל והתקנים › פעולה קבוצתית (owner 2026-09-30): the ONE place where the bulk-safe mark is managed and
 * explained - the operator screens say nothing about it. Every switch (the mark exists for switches only, CR-007 §7.10):
 * search, floor / area / marked filters, sort by name or area, a checkbox per row (Shift+click selects a range), "בחר
 * הכול" for everything the search and filters match ("נבחרו 23 מתוך 67"), then "אשר לנבחרים" / "הסר אישור מהנבחרים" -
 * one confirmation with the warning, one call (POST /devices/bulk-safe), per-id results. A table on a wide screen,
 * cards with a sticky action bar under 600 px; 100 rows at a time ("הצג עוד").
 */
@customElement('devices-bulk-safe-admin')
export class DevicesBulkSafeAdmin extends LitElement {
  @state() private rows: SwitchRow[] | null = null;
  @state() private error = '';
  @state() private q = '';
  @state() private floor = '';
  @state() private area = '';
  @state() private marked: '' | 'yes' | 'no' = '';
  @state() private sort: 'name' | 'area' = 'name';
  @state() private selected = new Set<string>();
  @state() private shown = PAGE;
  @state() private confirm: boolean | null = null; // the value being applied, while the dialog is open
  @state() private busy = false;
  @state() private result = '';
  private last: string | null = null;

  static styles = css`
    :host {
      display: block;
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
      .actions {
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
      if (parseRoute().params.get('section') === 'bulk-safe') requestAnimationFrame(() => this.scrollIntoView({ block: 'start' }));
    });
  }

  private async load() {
    try {
      this.rows = (await get<{ switches: SwitchRow[] }>('devices/bulk-safe')).switches;
      this.error = '';
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private filtered(): SwitchRow[] {
    const q = this.q.trim().toLowerCase();
    const out = (this.rows ?? []).filter(
      (r) =>
        (!q || `${r.name} ${r.area_name ?? ''} ${r.floor_name ?? ''} ${r.entity_id}`.toLowerCase().includes(q)) &&
        (!this.floor || r.floor_id === this.floor) &&
        (!this.area || r.area_id === this.area) &&
        (!this.marked || (this.marked === 'yes') === r.marked),
    );
    const key = (r: SwitchRow) => (this.sort === 'area' ? `${r.floor_name ?? '￿'} ${r.area_name ?? '￿'} ${r.name}` : r.name);
    return out.sort((a, b) => key(a).localeCompare(key(b), 'he'));
  }

  private toggle(id: string, e: MouseEvent | KeyboardEvent, list: SwitchRow[]) {
    const next = new Set(this.selected);
    const on = !next.has(id);
    if (e.shiftKey && this.last) {
      // Shift+click: the range between the last row clicked and this one, in the list's current order
      const a = list.findIndex((r) => r.entity_id === this.last);
      const b = list.findIndex((r) => r.entity_id === id);
      if (a >= 0 && b >= 0) for (const r of list.slice(Math.min(a, b), Math.max(a, b) + 1)) if (!r.alarm_managed) (on ? next.add(r.entity_id) : next.delete(r.entity_id));
    } else if (on) next.add(id);
    else next.delete(id);
    this.last = id;
    this.selected = next;
  }

  private async apply() {
    const value = this.confirm;
    if (value === null) return;
    this.busy = true;
    try {
      const r = await post<{ changed: number; refused: number }>('devices/bulk-safe', { entity_ids: [...this.selected], bulk_safe: value });
      this.result = `${value ? 'אושרו' : 'הוסר האישור מ־'}${ltrNum(r.changed)} מתגים${r.refused ? ` · ${ltrNum(r.refused)} לא שונו (נשלטים ממסך האזעקה, בשכבת הדלתות או שאינם מתגים)` : ''}`;
      this.selected = new Set();
      this.confirm = null;
      await this.load();
    } catch (err) {
      this.result = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  render() {
    const rows = this.rows;
    if (this.error) return html`<sw-card heading="פעולה קבוצתית"><sw-state-panel compact state="error" heading="לא ניתן לטעון את המתגים" hint=${this.error}></sw-state-panel></sw-card>`;
    if (!rows) return html`<sw-card heading="פעולה קבוצתית"><sw-state-panel compact state="loading"></sw-state-panel></sw-card>`;
    const list = this.filtered();
    const page = list.slice(0, this.shown);
    const floors = [...new Map(rows.filter((r) => r.floor_id).map((r) => [r.floor_id!, r.floor_name ?? r.floor_id!])).entries()];
    const areas = [...new Map(rows.filter((r) => r.area_id && (!this.floor || r.floor_id === this.floor)).map((r) => [r.area_id!, r.area_name ?? r.area_id!])).entries()];
    const selectable = list.filter((r) => !r.alarm_managed);
    const place = (r: SwitchRow) => [r.floor_name, r.area_name].filter(Boolean).join(' › ') || 'ללא שיוך';
    const status = (r: SwitchRow) => (r.alarm_managed ? html`<span class="no" title="נשלט ממסך האזעקה">נשלט ממסך האזעקה</span>` : r.marked ? html`<span class="yes">כן</span>` : html`<span class="no">לא</span>`);
    const when = (r: SwitchRow) => (r.marked_at ? `${r.marked_by ?? ''} · ${new Date(r.marked_at).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}` : '');
    const box = (r: SwitchRow) => html`<input type="checkbox" data-bulk-safe-row=${r.entity_id} aria-label=${`בחר ${r.name}`} .checked=${this.selected.has(r.entity_id)} ?disabled=${r.alarm_managed} @click=${(e: MouseEvent) => { e.preventDefault(); this.toggle(r.entity_id, e, list); }} />`;
    return html`<sw-card heading="פעולה קבוצתית" subheading="אילו מתגים נכללים בכפתור הראשי ובפעולות המרוכזות (כבה הכל). הסימון קיים למתגים בלבד: תאורה, תריסים, מיזוג ומסכים נכללים לפי סוגם; מנעולים, אזעקה ושחרור דלתות לעולם לא." data-bulk-safe-admin>
      <div class="bar">
        <input type="search" data-bulk-safe-search placeholder="חיפוש לפי שם, אזור או מזהה…" aria-label="חיפוש מתגים" .value=${this.q} @input=${(e: Event) => { this.q = (e.target as HTMLInputElement).value; this.shown = PAGE; }} />
        <select data-bulk-safe-floor aria-label="קומה" @change=${(e: Event) => { this.floor = (e.target as HTMLSelectElement).value; this.area = ''; }}><option value="">כל הקומות</option>${floors.map(([id, n]) => html`<option value=${id} ?selected=${this.floor === id}>${n}</option>`)}</select>
        <select data-bulk-safe-area aria-label="אזור" @change=${(e: Event) => (this.area = (e.target as HTMLSelectElement).value)}><option value="">כל האזורים</option>${areas.map(([id, n]) => html`<option value=${id} ?selected=${this.area === id}>${n}</option>`)}</select>
        <select data-bulk-safe-marked aria-label="נכלל" @change=${(e: Event) => (this.marked = (e.target as HTMLSelectElement).value as '' | 'yes' | 'no')}><option value="">מאושרים ולא מאושרים</option><option value="yes" ?selected=${this.marked === 'yes'}>מאושרים בלבד</option><option value="no" ?selected=${this.marked === 'no'}>לא מאושרים בלבד</option></select>
      </div>
      <div class="note" data-bulk-safe-counts>${ltrNum(list.length)} מתוך ${ltrNum(rows.length)} מתגים · ${ltrNum(rows.filter((r) => r.marked).length)} מאושרים לפעולה קבוצתית</div>
      <table>
        <thead><tr>
          <th><span class="muted">בחירה</span></th>
          <th aria-sort=${this.sort === 'name' ? 'ascending' : 'none'}><button type="button" data-bulk-safe-sort="name" @click=${() => (this.sort = 'name')}>שם</button></th>
          <th aria-sort=${this.sort === 'area' ? 'ascending' : 'none'}><button type="button" data-bulk-safe-sort="area" @click=${() => (this.sort = 'area')}>קומה › אזור</button></th>
          <th>מצב</th><th>נכלל בפעולה קבוצתית</th><th>שונה על ידי</th>
        </tr></thead>
        <tbody>${page.map((r) => html`<tr data-entity=${r.entity_id}><td>${box(r)}</td><td>${bidi(r.name)}<div class="muted">${r.entity_id}</div></td><td>${place(r)}</td><td>${r.available ? (r.state === 'on' ? 'דולק' : r.state === 'off' ? 'כבוי' : r.state ?? '—') : 'לא זמין'}</td><td>${status(r)}</td><td class="muted">${when(r)}</td></tr>`)}</tbody>
      </table>
      <div class="cards">${page.map((r) => html`<label class="card" data-entity=${r.entity_id}>${box(r)}<span>${bidi(r.name)} · ${status(r)}</span><span class="sub">${place(r)}</span></label>`)}</div>
      ${list.length > this.shown ? html`<sw-button size="sm" data-bulk-safe-more @click=${() => (this.shown += PAGE)}>הצג עוד (${ltrNum(list.length - this.shown)})</sw-button>` : nothing}
      <div class="actions">
        <span data-bulk-safe-selected>נבחרו ${ltrNum(this.selected.size)} מתוך ${ltrNum(rows.length)}</span>
        <sw-button size="sm" data-bulk-safe-all ?disabled=${!selectable.length} @click=${() => (this.selected = new Set([...this.selected, ...selectable.map((r) => r.entity_id)]))}>בחר הכול (${ltrNum(selectable.length)})</sw-button>
        <sw-button size="sm" variant="ghost" data-bulk-safe-clear ?disabled=${!this.selected.size} @click=${() => (this.selected = new Set())}>נקה בחירה</sw-button>
        <sw-button size="sm" variant="primary" data-bulk-safe-approve ?disabled=${!this.selected.size} @click=${() => (this.confirm = true)}>אשר לנבחרים</sw-button>
        <sw-button size="sm" data-bulk-safe-remove ?disabled=${!this.selected.size} @click=${() => (this.confirm = false)}>הסר אישור מהנבחרים</sw-button>
      </div>
      ${this.result ? html`<div class="note" role="status" data-bulk-safe-result>${this.result}</div>` : nothing}
      ${this.confirm === null
        ? nothing
        : html`<sw-dialog open ?locked=${this.busy} data-bulk-safe-dialog heading=${this.confirm ? 'אישור לפעולה קבוצתית' : 'הסרת אישור'} @close=${() => (this.confirm = null)}>
            <div data-bulk-safe-question>${this.confirm ? `לאשר ${ltrNum(this.selected.size)} מתגים לפעולה קבוצתית?` : `להסיר את האישור מ־${ltrNum(this.selected.size)} מתגים?`}</div>
            ${this.confirm ? html`<div class="warn">מתג יכול להיות דוד, משאבה או שער - אשרו רק מה שבטוח להדליק ולכבות יחד.</div>` : nothing}
            <div class="actions">
              <sw-button data-bulk-safe-cancel autofocus @click=${() => (this.confirm = null)}>ביטול</sw-button>
              <sw-button variant=${this.confirm ? 'primary' : 'secondary'} data-bulk-safe-confirm ?disabled=${this.busy} @click=${() => void this.apply()}>${this.confirm ? 'אשר' : 'הסר אישור'} (${ltrNum(this.selected.size)})</sw-button>
            </div>
          </sw-dialog>`}
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'devices-bulk-safe-admin': DevicesBulkSafeAdmin;
  }
}
