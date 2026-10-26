import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-card';
import { describeError, patch } from '../api/client';
import { getSettings } from '../api/media';
import { invalidateSettings } from '../api/prefs';
import { isApi } from '../api/session';
import { AUTOMATIONS_VIEWS, PAGE_SIZE_MAX, SCHEDULES_VIEWS, pageSizeKey, pageSizeMin, screenDisplayOf, type PagedList, type SchedulesView } from '../api/screen-display';
import { pl } from '../i18n/polish';
import { settingsSegStyles } from '../styles/settings';

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
  @property() list: 'schedules' | 'automations' = 'schedules';
  /** The page sizes this card edits: the list's rows and, for the automations, its cards too (POLISH2-295). */
  @state() private sizes: Partial<Record<PagedList, { wide: number; phone: number }>> = {};
  @state() private view: SchedulesView = 'rows';
  @state() private canEdit = false;
  @state() private busy = false;
  @state() private note = '';
  @state() private error = '';
  private noteTimer = 0;

  static styles = [settingsSegStyles, css`
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
    /* POLISH2-295: the segmented control is the settings pages' own (settingsSegStyles: the accent with the inverse label when chosen,
       AA in both schemes); its own look (the chosen segment darker than the track in the dark scheme, 1.2:1) is gone. A read-only
       viewer sees the same contrast: no dimming. */
    .seg button:disabled {
      cursor: default;
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
  `];

  connectedCallback() {
    super.connectedCallback();
    this.sizes = this.pick(screenDisplayOf(null).pageSize);
    if (!isApi()) return;
    void getSettings()
      .then((r) => {
        this.canEdit = r.can_edit;
        const s = screenDisplayOf(r.settings as unknown as Record<string, unknown>);
        this.sizes = this.pick(s.pageSize);
        this.view = this.list === 'automations' ? s.automationsView : s.schedulesView;
      })
      .catch(() => undefined);
  }

  private lists(): PagedList[] {
    return this.list === 'automations' ? ['automations', 'automations_cards'] : ['schedules'];
  }

  private pick(all: Record<PagedList, { wide: number; phone: number }>) {
    return Object.fromEntries(this.lists().map((l) => [l, { ...all[l] }])) as Partial<Record<PagedList, { wide: number; phone: number }>>;
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

  private setSize(list: PagedList, phone: boolean, raw: string) {
    const n = Math.round(Number(raw));
    const cur = this.sizes[list];
    if (!Number.isFinite(n) || !cur) return;
    const v = Math.min(PAGE_SIZE_MAX, Math.max(pageSizeMin(list), n));
    const before = { ...cur };
    if (v === (phone ? cur.phone : cur.wide)) {
      this.requestUpdate();
      return;
    }
    this.sizes = { ...this.sizes, [list]: phone ? { ...cur, phone: v } : { ...cur, wide: v } };
    void this.save({ [pageSizeKey(list, phone)]: v }, () => (this.sizes = { ...this.sizes, [list]: before }));
  }
  private setView(v: SchedulesView) {
    if (v === this.view) return;
    const before = this.view;
    this.view = v;
    void this.save({ [this.list === 'automations' ? 'ui.automations_view' : 'ui.schedules_view']: v }, () => (this.view = before));
  }

  render() {
    const ro = !this.canEdit || !isApi() || this.busy;
    const size = (list: PagedList, phone: boolean, label: string): TemplateResult => {
      const v = this.sizes[list];
      const tag = `${list === 'automations_cards' ? 'cards-' : ''}${phone ? 'phone' : 'wide'}`;
      return html`<div class="row"><span>${label}</span><input type="number" inputmode="numeric" min=${pageSizeMin(list)} max=${PAGE_SIZE_MAX} step="1" .value=${String(v ? (phone ? v.phone : v.wide) : '')} ?disabled=${ro}
        aria-label=${label} data-page-size=${tag} @change=${(e: Event) => this.setSize(list, phone, (e.target as HTMLInputElement).value)} /></div>`;
    };
    return html`<sw-card heading=${pl('listsHeading')} data-list-display=${this.list}>
      <div class="row"><span>${pl('defaultView')}</span><span class="seg" role="group" aria-label=${pl('defaultView')}>${((this.list === 'automations' ? AUTOMATIONS_VIEWS : SCHEDULES_VIEWS) as readonly SchedulesView[]).map((v) => html`<button type="button" data-default-view=${v} aria-pressed=${String(this.view === v)} ?disabled=${ro} @click=${() => this.setView(v)}>${VIEW_NAME[v]()}</button>`)}</span></div>
      ${size(this.list, false, pl('perPageWide'))}
      ${size(this.list, true, pl('perPagePhone'))}
      ${this.list === 'automations' ? html`${size('automations_cards', false, pl('cardsPerPageWide'))}${size('automations_cards', true, pl('cardsPerPagePhone'))}` : nothing}
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
