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

  static styles = css`
    :host {
      display: block;
    }
    .bar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-block-end: 10px;
    }
    .bar input[type='search'] {
      min-inline-size: 180px;
    }
    .bar .grow {
      flex: 1;
    }
    .counts {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
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
    th {
      color: var(--sw-text-3);
      font-weight: 600;
      font-size: var(--sw-fs-xs);
    }
    tr[data-status='linked'] td.area {
      color: var(--sw-text);
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    select {
      max-inline-size: 220px;
      font: inherit;
      padding: 3px 6px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
    }
    .sug {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .foot {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      margin-block-start: 10px;
    }
    .ok {
      color: var(--sw-success, var(--sw-accent));
      font-size: var(--sw-fs-sm);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    @media (max-width: 767px) {
      th:nth-child(3),
      td:nth-child(3) {
        display: none;
      }
    }
  `;

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
        <span>מקושרים ${ltrNum(t.counts.linked)}</span><span>הצעות ${ltrNum(t.counts.suggested)}</span><span>ללא הצעה ${ltrNum(t.counts.none)}</span>
        ${t.counts.dangling ? html`<span class="err">קישור לאזור שנמחק ${ltrNum(t.counts.dangling)}</span>` : nothing}
      </div>
      <div class="bar">
        <sw-field><select data-area-links-filter .value=${this.filter} @change=${(e: Event) => (this.filter = (e.target as HTMLSelectElement).value as Filter)}>
          <option value="all">הכול</option><option value="suggested">עם הצעה</option><option value="linked">מקושרים</option><option value="none">ללא הצעה</option>
        </select></sw-field>
        <sw-field><input type="search" placeholder="חיפוש חדר או אזור" data-area-links-search .value=${this.query} @input=${(e: Event) => (this.query = (e.target as HTMLInputElement).value)} /></sw-field>
        <span class="grow"></span>
        <sw-button size="sm" data-area-links-select-all ?disabled=${!suggested.length || this.busy} @click=${() => (this.selected = new Set(suggested.map((r) => r.zone_id)))}>בחר הצעות (${ltrNum(suggested.length)})</sw-button>
        <sw-button size="sm" variant="primary" icon="check" data-area-links-accept ?disabled=${!picked || this.busy} @click=${() => this.acceptSelected()}>אשר הצעות${picked ? ` (${ltrNum(picked)})` : ''}</sw-button>
        <sw-button size="sm" data-area-links-accept-all ?disabled=${!suggested.length || this.busy} @click=${() => this.acceptAll()}>אשר את כל ההצעות</sw-button>
      </div>
      ${rows.length
        ? html`<table data-area-links-table>
            <thead><tr><th><span class="muted">בחירה</span></th><th>חדר</th><th>קומה</th><th>אזור</th><th></th></tr></thead>
            <tbody>
              ${rows.map((r) => html`<tr data-area-link-row=${r.zone_id} data-status=${r.status}>
                <td>${r.status === 'suggested' ? html`<input type="checkbox" aria-label=${`אשר הצעה ל${r.zone_name}`} .checked=${this.selected.has(r.zone_id)} ?disabled=${this.busy} @change=${(e: Event) => this.toggle(r.zone_id, (e.target as HTMLInputElement).checked)} />` : nothing}</td>
                <td>${bidi(r.zone_name || 'חדר ללא שם')}<div class="muted">${r.kind}</div></td>
                <td>${bidi(r.floor_name)}<div class="muted">${bidi(r.building_name)}</div></td>
                <td class="area">
                  <select data-area-link-select ?disabled=${this.busy} @change=${(e: Event) => void this.apply([{ zone_id: r.zone_id, area_id: (e.target as HTMLSelectElement).value || null }], 'עודכן')}>
                    <option value="" ?selected=${!r.area_id}>${r.status === 'suggested' ? 'ללא קישור (יש הצעה)' : 'ללא קישור'}</option>
                    ${t.areas.map((a) => html`<option value=${a.area_id} ?selected=${r.area_id === a.area_id}>${bidi(a.name)}${a.floor_name ? ` · ${bidi(a.floor_name)}` : ''}</option>`)}
                  </select>
                  ${r.status === 'suggested' && r.suggestion ? html`<div class="sug muted" data-area-link-suggestion>הצעה: ${bidi(r.suggestion.area_name)} · ${score(r.suggestion.score)}</div>` : nothing}
                  ${r.dangling ? html`<div class="err">האזור שהיה מקושר כבר לא קיים</div>` : nothing}
                </td>
                <td>${r.area_id ? html`<sw-button size="sm" variant="ghost" data-area-link-clear ?disabled=${this.busy} @click=${() => void this.apply([{ zone_id: r.zone_id, area_id: null }], 'נותקו')}>נתק</sw-button>` : nothing}</td>
              </tr>`)}
            </tbody>
          </table>`
        : html`<sw-state-panel compact state="empty" heading=${t.rows.length ? 'אין חדרים שמתאימים לסינון' : 'אין חדרים בתוכניות'} hint=${t.rows.length ? '' : 'חדרים נוצרים בעורך התוכנית (זיהוי מהתוכנית או ציור ידני).'} data-area-links-empty></sw-state-panel>`}
      <div class="foot">
        ${this.note ? html`<span class="ok" role="status" data-area-links-note>${this.note}</span>` : nothing}
        ${this.error ? html`<span class="err" data-area-links-error>${this.error}</span>` : nothing}
      </div>
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'plan-area-links-admin': PlanAreaLinksAdmin;
  }
}
