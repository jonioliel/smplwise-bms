import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-card';
import { describeError, patch } from '../api/client';
import { getSettings } from '../api/media';
import { invalidateSettings } from '../api/prefs';
import { isApi } from '../api/session';
import { AUTOMATIONS_VIEWS, PAGE_SIZE_MAX, PAGE_SIZE_MIN, SCHEDULES_VIEWS, pageSizeKey, screenDisplayOf, type PagedList, type SchedulesView } from '../api/screen-display';
import { pl } from '../i18n/polish';

const VIEW_NAME: Record<SchedulesView, () => string> = { rows: () => pl('rows'), cards: () => 'כרטיסים', table: () => 'טבלה', week: () => 'שבוע' };

/**
 * POLISH-295 `<sw-list-display-settings list="schedules|automations">` (owner approval 2026-10-25: long lists use pages, with a
 * setting for how many items a page holds; the schedules list opens in rows by default): the card of הגדרות › תזמונים / אוטומציות
 * that edits `ui.page_size.<list>` (desktop), `ui.page_size.<list>_phone` and the list's default view (`ui.schedules_view` /
 * `ui.automations_view`, POLISH2-295). Saved at once
 * (PATCH /settings: system.configure, audited); read-only for anyone else.
 */
@customElement('sw-list-display-settings')
export class SwListDisplaySettings extends LitElement {
  @property() list: PagedList = 'schedules';
  @state() private wide = 0;
  @state() private phone = 0;
  @state() private view: SchedulesView = 'rows';
  @state() private canEdit = false;
  @state() private busy = false;
  @state() private note = '';
  @state() private error = '';
  private noteTimer = 0;

  static styles = css`
    :host {
      display: block;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sw-s-3);
      flex-wrap: wrap;
      padding-block: var(--sw-s-2);
    }
    .row + .row {
      border-block-start: 1px solid var(--sw-border);
    }
    .seg {
      display: inline-flex;
      gap: 2px;
      padding: 3px;
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-md);
    }
    .seg button {
      all: unset;
      box-sizing: border-box;
      min-block-size: 32px;
      padding: 0 12px;
      display: inline-flex;
      align-items: center;
      border-radius: var(--sw-r-sm);
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-medium);
      cursor: pointer;
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-surface);
      color: var(--sw-accent-text);
      box-shadow: var(--sw-shadow-1);
    }
    .seg button:disabled {
      cursor: default;
      opacity: 0.7;
    }
    input[type='number'] {
      inline-size: 5.5em;
      min-block-size: var(--sw-ctl-h-md);
      padding-inline: var(--sw-s-2);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-variant-numeric: tabular-nums;
    }
    .seg button:focus-visible,
    input:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    .foot {
      display: flex;
      gap: var(--sw-s-3);
      align-items: center;
      min-block-size: 20px;
      font-size: var(--sw-fs-sm);
    }
    .ok {
      color: var(--sw-success-text);
    }
    .err {
      color: var(--sw-danger-text);
    }
    .muted {
      color: var(--sw-text-3);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    const d = screenDisplayOf(null);
    this.wide = d.pageSize[this.list].wide;
    this.phone = d.pageSize[this.list].phone;
    if (!isApi()) return;
    void getSettings()
      .then((r) => {
        this.canEdit = r.can_edit;
        const s = screenDisplayOf(r.settings as unknown as Record<string, unknown>);
        this.wide = s.pageSize[this.list].wide;
        this.phone = s.pageSize[this.list].phone;
        this.view = this.list === 'automations' ? s.automationsView : s.schedulesView;
      })
      .catch(() => undefined);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearTimeout(this.noteTimer);
  }

  private async save(body: Record<string, unknown>, undo: () => void) {
    this.busy = true;
    this.error = '';
    try {
      await patch('settings', body);
      invalidateSettings();
      this.note = pl('saved');
      window.clearTimeout(this.noteTimer);
      this.noteTimer = window.setTimeout(() => (this.note = ''), 2500);
    } catch (err) {
      undo();
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private setSize(phone: boolean, raw: string) {
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n)) return;
    const v = Math.min(PAGE_SIZE_MAX, Math.max(PAGE_SIZE_MIN, n));
    const before = phone ? this.phone : this.wide;
    if (v === before) {
      this.requestUpdate();
      return;
    }
    if (phone) this.phone = v;
    else this.wide = v;
    void this.save({ [pageSizeKey(this.list, phone)]: v }, () => (phone ? (this.phone = before) : (this.wide = before)));
  }

  private setView(v: SchedulesView) {
    if (v === this.view) return;
    const before = this.view;
    this.view = v;
    void this.save({ [this.list === 'automations' ? 'ui.automations_view' : 'ui.schedules_view']: v }, () => (this.view = before));
  }

  render() {
    const ro = !this.canEdit || !isApi() || this.busy;
    const size = (phone: boolean) => html`<input type="number" inputmode="numeric" min=${PAGE_SIZE_MIN} max=${PAGE_SIZE_MAX} step="1" .value=${String(phone ? this.phone : this.wide)} ?disabled=${ro}
      aria-label=${phone ? pl('perPagePhone') : pl('perPageWide')} data-page-size=${phone ? 'phone' : 'wide'} @change=${(e: Event) => this.setSize(phone, (e.target as HTMLInputElement).value)} />`;
    return html`<sw-card heading=${pl('listsHeading')} data-list-display=${this.list}>
      <div class="row"><span>${pl('defaultView')}</span><span class="seg" role="group" aria-label=${pl('defaultView')}>${((this.list === 'automations' ? AUTOMATIONS_VIEWS : SCHEDULES_VIEWS) as readonly SchedulesView[]).map((v) => html`<button type="button" data-default-view=${v} aria-pressed=${String(this.view === v)} ?disabled=${ro} @click=${() => this.setView(v)}>${VIEW_NAME[v]()}</button>`)}</span></div>
      <div class="row"><span>${pl('perPageWide')}</span>${size(false)}</div>
      <div class="row"><span>${pl('perPagePhone')}</span>${size(true)}</div>
      <div class="foot">
        ${this.note ? html`<span class="ok" role="status">${this.note}</span>` : nothing}
        ${this.error ? html`<span class="err" role="alert">${this.error}</span>` : nothing}
        ${!this.canEdit && isApi() ? html`<span class="muted">${pl('readOnly')}</span>` : nothing}
      </div>
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-list-display-settings': SwListDisplaySettings;
  }
}
