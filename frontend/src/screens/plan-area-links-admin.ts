/**
 * K88 (owner 2026-10-04 Q1 = ג): הגדרות › מפה › "קישור חדרים לאזורים" - one row per plan room with its linked area, or
 * the best name match as a suggestion; tick rows and "אשר הצעות" applies them in one call; a select per row sets any
 * area by hand; "נתק" clears. Local links only - the platform's registry is never written.
 */
import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-field';
import '../components/sw-badge';
import '../components/sw-state-panel';
import { describeError } from '../api/client';
import { applyAreaLinks, getAreaLinks, type AreaLinkRow, type AreaLinksTable } from '../api/plan-links';
import { bidi, ltrNum } from '../i18n/bidi';
import { zoneKindLabel, type ZoneKind } from '../api/zones';
import '../components/sw-icon';
import { settingsStyles } from '../styles/settings';

type Filter = 'all' | 'suggested' | 'linked' | 'none';

@customElement('plan-area-links-admin')
export class PlanAreaLinksAdmin extends LitElement {
  @state() private table: AreaLinksTable | null = null;
  @state() private error = '';
  @state() private busy = false;
  @state() private note = '';
  @state() private filter: Filter = 'all';
  @state() private query = '';
  @state() private selected = new Set<string>();

  /* SETUPPLAN-POLISH-2331: the link table in the settings vocabulary (styles/settings.ts) - status counts as tinted pills, a toolbar
     whose primary action sits last at the end, a quiet table header, real 36 px row selects, the .msg result pill, and on a phone each
     room a stacked block (the select full width) instead of a four-column table wider than the screen. Tokens only. */
  static styles = [settingsStyles, css`
    :host {
      display: block;
    }
    .counts {
      display: flex;
      gap: var(--sw-s-2);
      flex-wrap: wrap;
      margin-block-end: var(--sw-s-3);
    }
    .count {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 26px;
      padding: 1px 10px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
    }
    .count b {
      font-variant-numeric: tabular-nums;
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
    }
    .count.ok {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .count.sug {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .count.err {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .count.ok b,
    .count.sug b,
    .count.err b {
      color: inherit;
    }
    .bar {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
      align-items: center;
      margin-block-end: var(--sw-s-3);
    }
    .bar sw-field {
      flex: 0 1 auto;
    }
    .bar .search {
      flex: 1 1 200px;
      min-inline-size: 0;
    }
    .bar input[type='search'] {
      inline-size: 100%;
      min-inline-size: 160px;
    }
    .bar .grow {
      flex: 1;
    }
    .bar .acts {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
      align-items: center;
    }
    .tablewrap {
      border-radius: var(--sw-r-md);
      background: var(--sw-well, var(--sw-surface-2));
      overflow: hidden;
    }
    table {
      inline-size: 100%;
      border-collapse: collapse;
      font-size: var(--sw-fs-sm);
    }
    th,
    td {
      text-align: start;
      padding: 8px 12px;
      border-block-end: 1px solid var(--sw-border);
      vertical-align: middle;
    }
    tbody tr:last-child td {
      border-block-end: 0;
    }
    th {
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-xs);
    }
    td.pick {
      inline-size: 44px;
    }
    td.pick input {
      inline-size: 18px;
      block-size: 18px;
      margin: 0;
      accent-color: var(--sw-accent);
      cursor: pointer;
    }
    td.room {
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading, var(--sw-text));
    }
    td.act {
      text-align: end;
      inline-size: 1%;
      white-space: nowrap;
    }
    tr[data-status='suggested'] td {
      background: color-mix(in srgb, var(--sw-accent-soft) 45%, transparent);
    }
    @media (hover: hover) and (pointer: fine) {
      tbody tr:hover td {
        background: var(--sw-hover-wash);
      }
    }
    .muted {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-regular);
    }
    select[data-area-link-select] {
      inline-size: 100%;
      max-inline-size: 260px;
      min-block-size: 36px;
      font: inherit;
      padding: 4px 8px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
    }
    select[data-area-link-select]:focus-visible,
    td.pick input:focus-visible {
      outline: var(--sw-focus-w, 2px) solid var(--sw-focus);
      outline-offset: 1px;
    }
    .sugline {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-block-start: 4px;
      color: var(--sw-accent-text);
    }
    .gone {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-block-start: 4px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger-text);
    }
    /* the floor moves under the room name on a phone (its column folds away; the data stays) */
    .phone {
      display: none;
    }
    @media (max-width: 767px) {
      .phone {
        display: inline;
      }
      .bar .grow {
        display: none;
      }
      .bar .acts {
        flex: 1 1 100%;
      }
      thead {
        display: none;
      }
      tbody tr {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        grid-template-areas: 'pick room act' 'pick area area';
        gap: 6px var(--sw-s-2);
        align-items: center;
        padding: 10px 12px;
        border-block-end: 1px solid var(--sw-border);
      }
      tbody tr:last-child {
        border-block-end: 0;
      }
      tbody tr[data-status='suggested'] {
        background: color-mix(in srgb, var(--sw-accent-soft) 45%, transparent);
      }
      tbody td {
        padding: 0;
        border: 0;
        background: transparent;
      }
      td.pick {
        grid-area: pick;
        inline-size: auto;
        align-self: start;
        padding-block-start: 2px;
      }
      td.room {
        grid-area: room;
      }
      td.floor {
        display: none;
      }
      td.area {
        grid-area: area;
      }
      td.act {
        grid-area: act;
        inline-size: auto;
      }
      select[data-area-link-select] {
        max-inline-size: none;
        min-block-size: 44px;
      }
    }
  `];

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    this.error = '';
    try {
      this.table = await getAreaLinks();
      this.selected = new Set([...this.selected].filter((id) => this.table!.rows.some((r) => r.zone_id === id && r.status === 'suggested')));
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private rows(): AreaLinkRow[] {
    const t = this.table;
    if (!t) return [];
    const q = this.query.trim().toLowerCase();
    return t.rows.filter((r) => (this.filter === 'all' || r.status === this.filter) && (!q || r.zone_name.toLowerCase().includes(q) || (r.area_name ?? '').toLowerCase().includes(q) || (r.suggestion?.area_name ?? '').toLowerCase().includes(q) || r.floor_name.toLowerCase().includes(q)));
  }

  private toggle(id: string, on: boolean) {
    const next = new Set(this.selected);
    if (on) next.add(id);
    else next.delete(id);
    this.selected = next;
  }

  private async apply(links: { zone_id: string; area_id: string | null }[], done: string) {
    if (!links.length) return;
    this.busy = true;
    this.error = '';
    this.note = '';
    try {
      const r = await applyAreaLinks(links);
      this.table = r;
      this.selected = new Set();
      this.note = r.changed ? `${done}: ${ltrNum(r.changed)}` : 'אין שינוי';
      setTimeout(() => (this.note = ''), 3000);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private acceptSelected() {
    const rows = this.table?.rows.filter((r) => this.selected.has(r.zone_id) && r.suggestion) ?? [];
    void this.apply(rows.map((r) => ({ zone_id: r.zone_id, area_id: r.suggestion!.area_id })), 'חדרים קושרו');
  }

  private acceptAll() {
    const rows = this.rows().filter((r) => r.status === 'suggested' && r.suggestion);
    void this.apply(rows.map((r) => ({ zone_id: r.zone_id, area_id: r.suggestion!.area_id })), 'חדרים קושרו');
  }

  render() {
    const t = this.table;
    if (this.error && !t) return html`<sw-card heading="קישור חדרים לאזורים"><sw-state-panel compact state="error" hint=${this.error} data-area-links-error></sw-state-panel></sw-card>`;
    if (!t) return html`<sw-card heading="קישור חדרים לאזורים"><sw-state-panel compact state="loading"></sw-state-panel></sw-card>`;
    const rows = this.rows();
    const suggested = rows.filter((r) => r.status === 'suggested');
    const picked = suggested.filter((r) => this.selected.has(r.zone_id)).length;
    const score = (s: number) => (s >= 1 ? 'שם זהה' : s >= 0.8 ? 'שם מכיל' : 'מילים משותפות');
    return html`<sw-card heading="קישור חדרים לאזורים" subheading="חדר בתוכנית מצביע על אזור בעץ ההתקנים: 'הצג על המפה' מהעץ ומדף האזור, ולחיצה על החדר במפה פותחת את האזור. ההצעות לפי שם; הקישור נשמר כאן בלבד" data-area-links>
      <div class="counts" data-area-links-counts>
        <span class="count ok">מקושרים <b>${ltrNum(t.counts.linked)}</b></span><span class="count sug">הצעות <b>${ltrNum(t.counts.suggested)}</b></span><span class="count">ללא הצעה <b>${ltrNum(t.counts.none)}</b></span>
        ${t.counts.dangling ? html`<span class="count err">קישור לאזור שנמחק <b>${ltrNum(t.counts.dangling)}</b></span>` : nothing}
      </div>
      <div class="bar" role="toolbar" aria-label="סינון ואישור הצעות">
        <sw-field><select data-area-links-filter aria-label="הצג" .value=${this.filter} @change=${(e: Event) => (this.filter = (e.target as HTMLSelectElement).value as Filter)}>
          <option value="all">הכול</option><option value="suggested">עם הצעה</option><option value="linked">מקושרים</option><option value="none">ללא הצעה</option>
        </select></sw-field>
        <sw-field class="search"><input type="search" placeholder="חיפוש חדר או אזור" aria-label="חיפוש חדר או אזור" data-area-links-search .value=${this.query} @input=${(e: Event) => (this.query = (e.target as HTMLInputElement).value)} /></sw-field>
        <span class="grow"></span>
        <span class="acts">
          <sw-button size="sm" data-area-links-select-all ?disabled=${!suggested.length || this.busy} @click=${() => (this.selected = new Set(suggested.map((r) => r.zone_id)))}>בחר הצעות (${ltrNum(suggested.length)})</sw-button>
          <sw-button size="sm" data-area-links-accept-all ?disabled=${!suggested.length || this.busy} @click=${() => this.acceptAll()}>אשר את כל ההצעות</sw-button>
          <sw-button size="sm" variant="primary" icon="check" data-area-links-accept ?disabled=${!picked || this.busy} @click=${() => this.acceptSelected()}>אשר הצעות${picked ? ` (${ltrNum(picked)})` : ''}</sw-button>
        </span>
      </div>
      ${rows.length
        ? html`<div class="tablewrap"><table data-area-links-table>
            <thead><tr><th scope="col"><span class="sr">בחירה</span></th><th scope="col">חדר</th><th scope="col">קומה</th><th scope="col">אזור</th><th scope="col"><span class="sr">פעולה</span></th></tr></thead>
            <tbody>
              ${rows.map((r) => html`<tr data-area-link-row=${r.zone_id} data-status=${r.status}>
                <td class="pick">${r.status === 'suggested' ? html`<input type="checkbox" aria-label=${`אשר הצעה ל${r.zone_name}`} .checked=${this.selected.has(r.zone_id)} ?disabled=${this.busy} @change=${(e: Event) => this.toggle(r.zone_id, (e.target as HTMLInputElement).checked)} />` : nothing}</td>
                <td class="room">${bidi(r.zone_name || 'חדר ללא שם')}<div class="muted">${zoneKindLabel(r.kind as ZoneKind)}<span class="phone"> · ${bidi(r.floor_name)}</span></div></td>
                <td class="floor">${bidi(r.floor_name)}<div class="muted">${bidi(r.building_name)}</div></td>
                <td class="area">
                  <select data-area-link-select aria-label=${`האזור של ${r.zone_name || 'החדר'}`} ?disabled=${this.busy} @change=${(e: Event) => void this.apply([{ zone_id: r.zone_id, area_id: (e.target as HTMLSelectElement).value || null }], 'עודכן')}>
                    <option value="" ?selected=${!r.area_id}>${r.status === 'suggested' ? 'ללא קישור (יש הצעה)' : 'ללא קישור'}</option>
                    ${t.areas.map((a) => html`<option value=${a.area_id} ?selected=${r.area_id === a.area_id}>${bidi(a.name)}${a.floor_name ? ` · ${bidi(a.floor_name)}` : ''}</option>`)}
                  </select>
                  ${r.status === 'suggested' && r.suggestion ? html`<div class="sugline muted" data-area-link-suggestion><sw-icon name="link" size=${12}></sw-icon>הצעה: ${bidi(r.suggestion.area_name)} · ${score(r.suggestion.score)}</div>` : nothing}
                  ${r.dangling ? html`<div class="gone"><sw-icon name="warning" size=${12}></sw-icon>האזור שהיה מקושר כבר לא קיים</div>` : nothing}
                </td>
                <td class="act">${r.area_id ? html`<sw-button size="sm" variant="ghost" data-area-link-clear ?disabled=${this.busy} @click=${() => void this.apply([{ zone_id: r.zone_id, area_id: null }], 'נותקו')}>נתק</sw-button>` : nothing}</td>
              </tr>`)}
            </tbody>
          </table></div>`
        : t.rows.length
          ? html`<sw-state-panel icon="filter" compact state="empty" heading="אין חדרים שמתאימים לסינון" actionLabel="נקה סינון" @action=${() => { this.filter = 'all'; this.query = ''; }} data-area-links-empty></sw-state-panel>`
          : html`<sw-state-panel icon="link" compact state="empty" heading="אין חדרים בתוכניות" hint="חדרים נוצרים בעורך התוכנית (זיהוי מהתוכנית או ציור ידני)." data-area-links-empty></sw-state-panel>`}
      ${this.note || this.error
        ? html`<div class="foot">
            ${this.note ? html`<span class="msg ok" role="status" data-area-links-note><sw-icon name="check" size=${13}></sw-icon>${this.note}</span>` : nothing}
            ${this.error ? html`<span class="msg err" role="alert" data-area-links-error><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>` : nothing}
          </div>`
        : nothing}
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'plan-area-links-admin': PlanAreaLinksAdmin;
  }
}
