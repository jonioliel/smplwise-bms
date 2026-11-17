import { html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-dialog';
import '../components/sw-state-panel';
import { get, describeError } from '../api/client';
import { bidi, ltrNum } from '../i18n/bidi';
import {
  CONFIRM, NO_FILTERS, STATUS_TEXT, actionIds, apiAction, applyFilters, chunks, confirmQuestion, countsLine, filtersActive, rangeIds, readOnly, resultLine, statusOf, suggestedIds,
  type Filters, type ProtectAction, type ProtectedCategory, type ProtectedSummary, type ProtectedSwitchRow, type StatusFilter,
} from './protected-switches-logic';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { dayTimeText } from '../api/day-format';
import { DevicesOverrideListAdmin, OVERRIDE_PAGE as PAGE, overrideListStyles, overrideTableStyles } from './devices-override-admin';
import { tr } from '../i18n/msg/devices';

interface ListReply {
  switches: ProtectedSwitchRow[];
  summary: ProtectedSummary;
  categories: ProtectedCategory[];
}

/**
 * הגדרות › חשמל והתקנים › מתגים מוגנים (CR-019; replaces "פעולה קבוצתית"): the ONE place where switch protection is reviewed and
 * changed - the operator screens say nothing about it. A protected switch is left out of GROUP actions only; it is still controlled
 * one by one, by schedules and by automations. Every switch is listed (system.configure; the server checks it again on every call):
 * a strip while the classifier suggests protections (a suggestion is NOT enforced: the switch stays in group actions until the administrator approves it), search / status / category / floor / area filters, sort by
 * name or place, a checkbox per row (Shift+click selects a range), then "הגן" / "הסר הגנה" / "דחה הצעה" on the selection - one
 * confirmation each (removing protection names the consequence, focus on Cancel), one call per 500 ids, a per-result line.
 * Alarm-managed, door-layer and multimedia-managed rows are read-only. A table on a wide screen, cards with a sticky action bar
 * under 600 px; 100 rows at a time ("הצג עוד"). Wording keeps to "תשתית המערכת" - no product names.
 */
@customElement('devices-protected-switches')
export class DevicesProtectedSwitches extends DevicesOverrideListAdmin<ProtectedSwitchRow, Filters> {
  /** 0.1.157: the bubble skin's chrome keys on the host's data-skin (styles/bubble-chrome.ts). */
  readonly bubbleSkin = new SkinController(this);
  @state() private summary: ProtectedSummary | null = null;
  @state() private categories: ProtectedCategory[] = [];
  @state() protected f: Filters = { ...NO_FILTERS };
  @state() private confirm: { action: ProtectAction; ids: string[] } | null = null;
  protected readonly heading = tr('מתגים מוגנים');
  protected readonly sections = ['protected-switches', 'bulk-safe'];
  protected range = rangeIds;
  protected chunk = (ids: readonly string[]) => chunks(ids);

  static styles = [overrideListStyles, overrideTableStyles, css`
    .strip {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      align-items: center;
      padding: 12px 14px;
      margin-block-end: 12px;
      border-radius: var(--sw-r-md);
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text, var(--sw-text));
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
    }
    .strip .grow {
      flex: 1;
      min-inline-size: 200px;
    }
    th button {
      font: inherit;
      font-weight: var(--sw-fw-bold);
      background: none;
      border: 0;
      padding: 0;
      cursor: pointer;
      color: inherit;
    }
    .yes,
    .wait,
    .no {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      min-block-size: 26px;
      padding: 0 10px;
      border-radius: 999px;
      font-weight: var(--sw-fw-bold);
      font-size: var(--sw-fs-sm);
      white-space: nowrap;
    }
    .yes {
      background: var(--sw-success-soft);
      color: var(--sw-success-text, var(--sw-success));
    }
    .wait {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text, var(--sw-warning));
    }
    .no {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .warn {
      padding: 8px 10px;
      margin-block: 8px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-warning-soft);
      font-size: var(--sw-fs-sm);
    }
  `, bubbleChrome];

  protected async fetchRows() {
    const r = await get<ListReply>('devices/bulk-protected');
    this.summary = r.summary;
    this.categories = r.categories ?? [];
    return r.switches;
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
      const { changed, refused } = await this.postChunks('devices/bulk-protected', c.ids, { action: apiAction(c.action) });
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
    const head = this.heading;
    if (this.error) return this.errorCard(tr('לא ניתן לטעון את המתגים'));
    if (!rows) return this.loadingCard();
    const f = this.f;
    const list = applyFilters(rows, f);
    const page = list.slice(0, this.shown);
    const floors = this.floorOptions(rows);
    const areas = this.areaOptions(rows);
    const selectable = list.filter((r) => !readOnly(r));
    const waiting = suggestedIds(rows).length;
    const place = (r: ProtectedSwitchRow) => this.place(r);
    const status = (r: ProtectedSwitchRow) => {
      const s = statusOf(r);
      return html`<span class=${s === 'protected' ? 'yes' : s === 'suggested' ? 'wait' : 'no'} data-status=${s}>${STATUS_TEXT[s]}</span>`;
    };
    const source = (r: ProtectedSwitchRow) =>
      r.source === 'auto' ? html`<span title=${r.rule ?? ''}>${tr('הצעה אוטומטית')}${r.category_label ? ` · ${r.category_label}` : ''}</span>` : r.source === 'manual' ? tr('ידני') : html`<span class="muted">—</span>`;
    const reviewed = (r: ProtectedSwitchRow) => (r.protected && r.reviewed ? html`<span class="yes" aria-label=${tr('אושר')}>✓</span>` : html`<span class="muted">—</span>`);
    const when = (r: ProtectedSwitchRow) => {
      const at = r.reviewed_at ?? r.marked_at;
      const who = r.reviewed_at ? r.reviewed_by : r.marked_by;
      return at ? [who, dayTimeText(new Date(at))].filter(Boolean).join(' · ') : '';
    };
    const box = (r: ProtectedSwitchRow) =>
      html`<input type="checkbox" data-protected-row=${r.entity_id} aria-label=${tr('בחר {name}', { name: r.name })} .checked=${this.selected.has(r.entity_id)} ?disabled=${readOnly(r)} @click=${(e: MouseEvent) => this.toggle(r.entity_id, (e.currentTarget as HTMLInputElement).checked, e.shiftKey, list)} />`;
    const sel = (a: ProtectAction) => actionIds(a, rows, this.selected).length;
    return html`<sw-card heading=${head} subheading=${tr("מתגים מוגנים לא נכללים ב'כבה הכל' ובפעולות קבוצתיות. אפשר עדיין להפעיל אותם לבד, בתזמון ובאוטומציה.")} data-protected-switches>
      ${waiting
        ? html`<div class="strip" role="status" data-protected-strip>
            <span class="grow">${tr("{n} מתגים מוצעים להגנה לפי השם או הסוג שלהם. הם נכללים ב'כבה הכל' עד שתאשרו", { n: ltrNum(waiting) })}</span>
            <sw-button size="sm" data-protected-show @click=${() => this.setFilter({ status: 'suggested' })}>${tr('הצג')}</sw-button>
            <sw-button size="sm" variant="primary" data-protected-approve-all ?disabled=${this.busy} @click=${() => this.ask('approve', suggestedIds(rows))}>${tr('הגן על כולם')}</sw-button>
          </div>`
        : nothing}
      <div class="bar">
        <input type="search" data-protected-search placeholder=${tr('חיפוש לפי שם, אזור או מזהה…')} aria-label=${tr('חיפוש מתגים')} .value=${f.q} @input=${(e: Event) => this.setFilter({ q: (e.target as HTMLInputElement).value })} />
        <select data-protected-status aria-label=${tr('סטטוס')} @change=${(e: Event) => this.setFilter({ status: (e.target as HTMLSelectElement).value as StatusFilter })}>
          <option value="" ?selected=${!f.status}>${tr('הכל')}</option>
          <option value="protected" ?selected=${f.status === 'protected'}>${tr('מוגנים')}</option>
          <option value="suggested" ?selected=${f.status === 'suggested'}>${tr('מוצעים להגנה')}</option>
          <option value="unprotected" ?selected=${f.status === 'unprotected'}>${tr('לא מוגנים')}</option>
        </select>
        <select data-protected-category aria-label=${tr('קטגוריה')} @change=${(e: Event) => this.setFilter({ category: (e.target as HTMLSelectElement).value })}><option value="">${tr('כל הקטגוריות')}</option>${this.categories.map((c) => html`<option value=${c.id} ?selected=${f.category === c.id}>${c.label}</option>`)}</select>
        <select data-protected-floor aria-label=${tr('קומה')} @change=${(e: Event) => this.setFilter({ floor: (e.target as HTMLSelectElement).value, area: '' })}><option value="">${tr('כל הקומות')}</option>${floors.map(([id, n]) => html`<option value=${id} ?selected=${f.floor === id}>${n}</option>`)}</select>
        <select data-protected-area aria-label=${tr('אזור')} @change=${(e: Event) => this.setFilter({ area: (e.target as HTMLSelectElement).value })}><option value="">${tr('כל האזורים')}</option>${areas.map(([id, n]) => html`<option value=${id} ?selected=${f.area === id}>${n}</option>`)}</select>
        ${filtersActive(f) ? html`<sw-button size="sm" variant="ghost" data-protected-reset @click=${() => { this.f = { ...NO_FILTERS, sort: f.sort }; this.shown = PAGE; }}>${tr('נקה סינון')}</sw-button>` : nothing}
      </div>
      <div class="note" data-protected-counts>${countsLine(list.length, rows, this.summary)}</div>
      ${list.length
        ? html`<table>
              <thead><tr>
                <th><span class="muted">${tr('בחירה')}</span></th>
                <th aria-sort=${f.sort === 'name' ? 'ascending' : 'none'}><button type="button" data-protected-sort="name" @click=${() => this.setFilter({ sort: 'name' })}>${tr('שם')}</button></th>
                <th aria-sort=${f.sort === 'area' ? 'ascending' : 'none'}><button type="button" data-protected-sort="area" @click=${() => this.setFilter({ sort: 'area' })}>${tr('קומה ‹ אזור')}</button></th>
                <th>${tr('מוגן')}</th><th>${tr('מקור')}</th><th>${tr('אושר')}</th><th>${tr('שונה על ידי')}</th>
              </tr></thead>
              <tbody>${page.map((r) => html`<tr data-entity=${r.entity_id}><td>${box(r)}</td><td>${bidi(r.name)}<div class="muted">${r.entity_id}</div></td><td>${place(r)}</td><td>${status(r)}</td><td>${source(r)}</td><td>${reviewed(r)}</td><td class="muted">${when(r)}</td></tr>`)}</tbody>
            </table>
            <div class="cards">${page.map((r) => html`<label class="card" data-entity=${r.entity_id}>${box(r)}<span>${bidi(r.name)} · ${status(r)}</span><span class="sub">${place(r)}${r.source ? html` · ${source(r)}` : nothing}</span></label>`)}</div>`
        : html`<sw-state-panel icon=${rows.length ? 'filter' : 'power'} compact state="empty" heading=${rows.length ? tr('אין מתגים שמתאימים לסינון') : tr('אין מתגים')} data-protected-empty></sw-state-panel>`}
      ${list.length > this.shown ? html`<sw-button size="sm" data-protected-more @click=${() => (this.shown += PAGE)}>${tr('הצג עוד')} (${ltrNum(list.length - this.shown)})</sw-button>` : nothing}
      <div class="actions bulk">
        <span data-protected-selected>${tr('נבחרו {n} מתוך {total}', { n: ltrNum(this.selected.size), total: ltrNum(rows.length) })}</span>
        <sw-button size="sm" data-protected-all ?disabled=${!selectable.length} @click=${() => (this.selected = new Set([...this.selected, ...selectable.map((r) => r.entity_id)]))}>${tr('בחר הכול')} (${ltrNum(selectable.length)})</sw-button>
        <sw-button size="sm" variant="ghost" data-protected-clear ?disabled=${!this.selected.size} @click=${() => (this.selected = new Set())}>${tr('נקה בחירה')}</sw-button>
        <sw-button size="sm" variant="primary" data-protected-do-protect ?disabled=${!sel('protect')} @click=${() => this.ask('protect', actionIds('protect', rows, this.selected))}>${tr('הגן')}</sw-button>
        <sw-button size="sm" data-protected-do-dismiss ?disabled=${!sel('dismiss')} @click=${() => this.ask('dismiss', actionIds('dismiss', rows, this.selected))}>${tr('דחה הצעה')}</sw-button>
        <sw-button size="sm" data-protected-do-unprotect ?disabled=${!sel('unprotect')} @click=${() => this.ask('unprotect', actionIds('unprotect', rows, this.selected))}>${tr('הסר הגנה')}</sw-button>
      </div>
      ${this.result ? html`<div class="note" role="status" data-protected-result>${this.result}</div>` : nothing}
      ${this.confirm === null ? nothing : this.renderConfirm(this.confirm)}
    </sw-card>`;
  }

  private renderConfirm(c: { action: ProtectAction; ids: string[] }) {
    const meta = CONFIRM[c.action];
    return html`<sw-dialog open ?locked=${this.busy} data-protected-dialog=${c.action} heading=${meta.heading} @close=${() => (this.confirm = null)}>
      <div data-protected-question>${confirmQuestion(c.action, c.ids.length)}</div>
      ${c.action === 'unprotect' ? html`<div class="warn">${tr('מתג יכול להיות דוד, משאבה או שער - ודאו שבטוח לכבות ולהדליק אותו יחד עם שאר המתגים.')}</div>` : nothing}
      <div class="actions">
        <sw-button data-protected-cancel autofocus @click=${() => (this.confirm = null)}>${tr('ביטול')}</sw-button>
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
