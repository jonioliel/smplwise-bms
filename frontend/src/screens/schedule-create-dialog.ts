import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-icon';
import type { IconName } from '../components/sw-icon';
import '../components/sw-dialog';
import { ApiError } from '../api/client';
import { createSchedule, getScheduleCatalog, getScheduleStatus, type CatalogEntity, type ConditionPreset, type ScheduleStatus } from '../api/schedules';
import { navigate } from '../router';
import { metaFromCatalog, type EntityMeta } from './schedule-edit-logic';
import { PRESET_CHOICES, QUICK_DAYS, QUICK_TIMES, TEMPLATES, quickActions, quickDraft, quickReady, quickSentence, type QuickAction, type QuickDays, type QuickTime, type ScheduleTemplate } from './schedule-templates';
import { tablistKeydown } from '../components/a11y-keys';

/**
 * CR-014 S4: "תזמון חדש" (mockup 09 / 26). Two ways in: a template (then the editor opens with a draft; the devices are chosen
 * there) and the three-tap quick create (where, what and when, which days - then the schedule is created at once, or opened in
 * the editor). The holiday presets ("רק בשבת ובחג", "לא בשבת ובחג") lay over either, when the sensor is configured.
 *
 * `<schedule-create-dialog .open @close @created={id}>` - S3's "תזמון חדש" button renders it.
 * The editor route it opens: `#/devices/schedules/new/edit?template=<id>&preset=<id>` or `?draft=1` (a quick draft handed over
 * through sessionStorage).
 */

export const NEW_DRAFT_KEY = 'sw.schedules.newdraft';

const TPL_ICON: Record<ScheduleTemplate['icon'], IconName> = { calendar: 'calendar', clock: 'clock', light: 'light', coverOpen: 'coverOpen', activity: 'activity', plus: 'plus', history: 'history' };

export class ScheduleCreateDialog extends LitElement {
  @property({ type: Boolean, reflect: true }) open = false;
  @state() private tab: 'tpl' | 'quick' = 'tpl';
  @state() private tpl: string | null = null;
  @state() private preset: ConditionPreset | null = null;
  @state() private status: ScheduleStatus | null = null;
  @state() private entities: CatalogEntity[] = [];
  @state() private loading = false;
  @state() private loadError = '';
  @state() private area = '';
  @state() private picked: string[] = [];
  @state() private action: QuickAction | null = null;
  @state() private time: QuickTime | null = null;
  @state() private days: QuickDays | null = null;
  @state() private busy = false;
  @state() private error = '';
  @state() private note = '';
  private wasOpen = false;

  static styles = css`
    :host {
      display: contents;
    }
    /* AUDIT30-I3 (#11, owner Q9 option a): the dialog is the product's one <sw-dialog> (its scrim, its centred box, its spring, its focus
       trap, Escape and the return of focus), wide. Opaque in every skin: the glass skins' translucent --sw-surface and their blur stop
       at this box (the audit measured the old box as rgba(255,255,255,.64) under a 40 px blur in the glass look). */
    sw-dialog {
      --sw-surface: var(--sw-surface-solid);
      --sw-glass-blur: none;
    }
    .tabs {
      display: flex;
      margin: 0;
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-md);
      padding: 3px;
    }
    .tabs button {
      flex: 1;
      border: 0;
      background: none;
      font: inherit;
      font-size: var(--sw-fs-base);
      font-weight: var(--sw-fw-semibold);
      min-block-size: 36px;
      padding: 0 10px;
      border-radius: var(--sw-r-sm);
      color: var(--sw-text-2);
      cursor: pointer;
      transition: transform var(--sw-t-press) var(--sw-ease), background var(--sw-t-hover) var(--sw-ease-color), color var(--sw-t-hover) var(--sw-ease-color);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    .tabs button:active {
      transform: scale(var(--sw-press-scale));
    }
    .tabs button[aria-selected='true'] {
      background: var(--sw-seg-key, var(--sw-surface));
      color: var(--sw-seg-key-ink, var(--sw-accent-text));
      box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1));
      font-weight: var(--sw-fw-bold);
    }
    /* the tabs, the body and the footer live in sw-dialog's slots; its body scrolls, its footer stays (the actions are always on screen) */
    .cbody {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding-block-start: 4px;
    }
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
      gap: 10px;
    }
    .tpl {
      text-align: start;
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      border-radius: var(--sw-r-lg);
      padding: 12px 14px;
      font: inherit;
      color: var(--sw-text);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 6px;
      transition: transform var(--sw-t-press) var(--sw-ease), border-color var(--sw-t-hover) var(--sw-ease-color), background var(--sw-t-hover) var(--sw-ease-color), box-shadow var(--sw-t-hover) var(--sw-ease-color);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    @media (hover: hover) and (pointer: fine) {
      .tpl:not(:disabled):hover {
        border-color: var(--sw-border-strong);
        box-shadow: var(--sw-shadow-1);
      }
      .chip:not(:disabled):hover {
        background: var(--sw-hover-wash);
      }
    }
    .tpl:not(:disabled):active,
    .chip:not(:disabled):active {
      transform: scale(var(--sw-press-scale));
    }
    .tpl[aria-pressed='true'] {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft);
      box-shadow: inset 0 0 0 1px var(--sw-accent);
    }
    .tpl:disabled {
      cursor: not-allowed;
      background: var(--sw-surface-2);
    }
    .tpl:disabled .top,
    .tpl:disabled > span:not(.why) {
      opacity: 0.6;
    }
    .tpl .top {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .tile {
      display: grid;
      place-items: center;
      inline-size: 32px;
      block-size: 32px;
      border-radius: var(--sw-r-md);
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      flex: none;
    }
    .tpl b {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading, var(--sw-text));
    }
    .tpl span {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      line-height: 1.45;
    }
    .tpl .why {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--sw-warning-text);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
    }
    .sec {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .sec > label,
    .sec > .lbl {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      min-block-size: 36px;
      padding: 0 14px;
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      border-radius: var(--sw-r-pill);
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      cursor: pointer;
      transition: transform var(--sw-t-press) var(--sw-ease), background var(--sw-t-hover) var(--sw-ease-color), color var(--sw-t-hover) var(--sw-ease-color), border-color var(--sw-t-hover) var(--sw-ease-color);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    /* AUDIT30-I2 (#4, owner Q3 option a): the chosen chip is the Blue Wash pair (was solid accent) */
    .chip[aria-pressed='true'] {
      background: var(--sw-accent-soft);
      border-color: transparent;
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
    }
    .chip:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .tabs button:focus-visible,
    .tpl:focus-visible,
    .chip:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset, 2px);
    }
    .banner {
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 10px 14px;
      border-radius: var(--sw-r-md);
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-base);
      font-weight: var(--sw-fw-medium);
    }
    .banner sw-icon {
      flex: none;
    }
    .banner.ok {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .banner.err {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .hint {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .loading {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .loading i {
      display: block;
      block-size: 36px;
      border-radius: var(--sw-r-md);
      background: var(--sw-skeleton, var(--sw-surface-3));
    }
    .loading i:nth-child(2) {
      inline-size: 70%;
    }
    .foot {
      flex: 1;
      display: flex;
      justify-content: flex-start;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .foot .full {
      flex: 1 1 100%;
    }
    .foot .sp {
      flex: 1;
    }
    }
    @media (pointer: coarse) {
      .chip,
      .tabs button {
        min-block-size: 44px;
      }
    }
    @media (max-width: 640px) {
      .tpls {
        grid-template-columns: 1fr;
      }
      .foot sw-button {
        flex: 1;
      }
      .foot .sp {
        display: none;
      }
    }
  `;

  willUpdate(changed: Map<string, unknown>) {
    if (changed.has('open') && this.open && !this.wasOpen) void this.reset();
    if (changed.has('open')) this.wasOpen = this.open;
  }

  updated(changed: Map<string, unknown>) {
    // keyboard focus moves into the dialog (the selected tab) when it opens; sw-dialog returns it to the opener when it closes
    if (changed.has('open') && this.open) requestAnimationFrame(() => this.renderRoot.querySelector<HTMLElement>('.tabs [aria-selected="true"]')?.focus({ preventScroll: true }));
  }

  /** The two tabs follow the arrow keys (RTL: the right arrow goes to the previous tab), Home and End. */
  private onTabKey(e: KeyboardEvent) {
    const order: ('tpl' | 'quick')[] = ['tpl', 'quick'];
    const i = order.indexOf(this.tab);
    let next = i;
    if (e.key === 'ArrowLeft') next = Math.min(order.length - 1, i + 1);
    else if (e.key === 'ArrowRight') next = Math.max(0, i - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = order.length - 1;
    else return;
    e.preventDefault();
    this.tab = order[next];
    void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLElement>(`[data-create-tab="${order[next]}"]`)?.focus());
  }

  private async reset() {
    this.tab = 'tpl';
    this.tpl = null;
    this.preset = null;
    this.area = '';
    this.picked = [];
    this.action = null;
    this.time = null;
    this.days = null;
    this.error = '';
    this.note = '';
    this.loadError = '';
    this.loading = true;
    try {
      this.status = await getScheduleStatus();
    } catch {
      this.status = null;
    }
    try {
      this.entities = (await getScheduleCatalog()).entities;
    } catch (e) {
      this.entities = [];
      this.loadError = e instanceof Error ? e.message : '';
    }
    this.loading = false;
  }

  private get sensor(): string | null {
    return this.status?.settings.shabbat_sensor?.entity_id ?? null;
  }

  private get meta() {
    return metaFromCatalog(this.entities);
  }

  private close() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  // ------------------------------------------------------------------------------------------ template path

  private useTemplate() {
    if (!this.tpl) return;
    const params: Record<string, string> = { template: this.tpl };
    if (this.preset && this.sensor) params.preset = this.preset;
    this.close();
    navigate('/devices/schedules/new/edit', params);
  }

  // ------------------------------------------------------------------------------------------ quick path

  /** Plain devices only: sensitive classes have their own confirmations in the editor. */
  private get quickEntities(): CatalogEntity[] {
    return this.entities.filter((e) => e.selectable && !e.sensitive && quickActions(this.meta.get(e.entity_id)).length > 0);
  }

  private get areas(): string[] {
    return [...new Set(this.quickEntities.map((e) => e.area_name ?? 'ללא אזור'))];
  }

  private get chosen(): EntityMeta[] {
    const m = this.meta;
    return this.picked.map((id) => m.get(id)).filter((e): e is EntityMeta => !!e);
  }

  private togglePicked(id: string) {
    this.picked = this.picked.includes(id) ? this.picked.filter((x) => x !== id) : [...this.picked, id];
    const first = this.chosen[0];
    const valid = quickActions(first);
    if (!first || !valid.some((a) => a.id === this.action?.id)) this.action = null;
  }

  private choice() {
    return { entities: this.chosen, action: this.action, time: this.time, days: this.days };
  }

  private async quickCreate() {
    const draft = quickDraft(this.choice(), this.status?.settings.default_repeat ?? 'repeat', new Date(), this.preset, this.sensor);
    if (!draft) return;
    this.busy = true;
    this.error = '';
    try {
      const r = await createSchedule(draft, { enabled: true });
      if ('schedule' in r) this.dispatchEvent(new CustomEvent('created', { detail: { id: r.schedule.id }, bubbles: true, composed: true }));
      else {
        this.note = r.message;
        this.dispatchEvent(new CustomEvent('created', { detail: { id: '' }, bubbles: true, composed: true }));
      }
      if ('schedule' in r) this.close();
    } catch (e) {
      this.error = e instanceof ApiError ? e.message : 'היצירה נכשלה. אפשר לנסות שוב.';
    }
    this.busy = false;
  }

  private quickEdit() {
    const draft = quickDraft(this.choice(), this.status?.settings.default_repeat ?? 'repeat', new Date(), this.preset, this.sensor);
    if (!draft) return;
    try {
      sessionStorage.setItem(NEW_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* storage unavailable: the editor opens blank */
    }
    this.close();
    navigate('/devices/schedules/new/edit', { draft: '1' });
  }

  // ------------------------------------------------------------------------------------------ render

  private renderPresets() {
    if (!this.sensor) {
      return this.status?.can.configure ? html`<div class="hint" data-preset-hint>בחרו חיישן שבת וחג בהגדרות ‹ תזמונים כדי לקבל תנאים מוכנים.</div>` : nothing;
    }
    return html`<div class="sec"><span class="lbl" id="preset-lbl">תנאי</span><div class="chips" role="group" aria-labelledby="preset-lbl">
      ${PRESET_CHOICES.map((p) => html`<button type="button" class="chip" data-create-preset=${p.id ?? 'none'} aria-pressed=${this.preset === p.id} @click=${() => (this.preset = p.id)}>${p.label}</button>`)}
    </div></div>`;
  }

  private renderTemplates() {
    return html`<div class="tpls" role="group" aria-label="תבניות">
        ${TEMPLATES.map((t) => {
          const blocked = !!t.needsSensor && !this.sensor;
          return html`<button type="button" class="tpl" data-template=${t.id} aria-pressed=${this.tpl === t.id} ?disabled=${blocked} title=${blocked ? 'דורש חיישן שבת וחג בהגדרות' : ''} @click=${() => (this.tpl = t.id)}>
            <span class="top"><span class="tile"><sw-icon name=${TPL_ICON[t.icon]} size="16"></sw-icon></span><b>${t.name}</b></span>
            <span>${t.description}</span>
            ${blocked ? html`<span class="why" data-template-blocked><sw-icon name="lock" size="12"></sw-icon>דורש חיישן שבת וחג בהגדרות</span>` : nothing}
          </button>`;
        })}
      </div>
      ${this.renderPresets()}`;
  }

  private renderTemplatesFooter() {
    return html`<div class="foot" slot="footer">
      <sw-button variant="primary" data-create-continue ?disabled=${!this.tpl} @click=${() => this.useTemplate()}>המשך לעורך</sw-button>
      <span class="sp"></span>
      <sw-button variant="ghost" @click=${() => this.close()}>ביטול</sw-button>
    </div>`;
  }

  private renderQuick() {
    const areaEntities = this.quickEntities.filter((e) => (e.area_name ?? 'ללא אזור') === this.area);
    const first = this.chosen[0];
    const actions = quickActions(first);
    return html`<div class="sec"><span class="lbl" id="q-where">1 · איפה?</span>
        <div class="chips" role="group" aria-labelledby="q-where">${this.areas.map((a) => html`<button type="button" class="chip" data-quick-area=${a} aria-pressed=${this.area === a} @click=${() => (this.area = a)}>${a}</button>`)}</div>
        ${this.area
          ? html`<div class="chips" role="group" aria-label=${`התקנים · ${this.area}`}>${areaEntities.map((e) => {
              const on = this.picked.includes(e.entity_id);
              const other = first && first.domain !== e.domain;
              return html`<button type="button" class="chip" data-quick-entity=${e.entity_id} aria-pressed=${on} ?disabled=${!on && !!other} @click=${() => this.togglePicked(e.entity_id)}>${e.name}</button>`;
            })}</div>`
          : nothing}
      </div>
      <div class="sec"><span class="lbl" id="q-what">2 · מה ומתי?</span>
        <div class="chips" role="group" aria-labelledby="q-what">${actions.length ? actions.map((a) => html`<button type="button" class="chip" data-quick-action=${a.id} aria-pressed=${this.action?.id === a.id} @click=${() => (this.action = a)}>${a.label}</button>`) : html`<span class="hint">בחרו התקן קודם</span>`}</div>
        <div class="chips" role="group" aria-label="מתי">${QUICK_TIMES.map((t) => html`<button type="button" class="chip" data-quick-time=${t.id} aria-pressed=${this.time?.id === t.id} @click=${() => (this.time = t)}><sw-icon name=${t.sun ? 'history' : 'clock'} size="13"></sw-icon>${t.label}</button>`)}</div>
      </div>
      <div class="sec"><span class="lbl" id="q-days">3 · באילו ימים?</span>
        <div class="chips" role="group" aria-labelledby="q-days">${QUICK_DAYS.map((d) => html`<button type="button" class="chip" data-quick-days=${d.id} aria-pressed=${this.days?.id === d.id} @click=${() => (this.days = d)}>${d.label}</button>`)}</div>
      </div>
      ${this.renderPresets()}`;
  }

  /** The quick path's sentence, its errors and its actions stay under the scrolling body: always in view. */
  private renderQuickFooter() {
    const q = this.choice();
    const ready = quickReady(q);
    return html`<div class="foot" slot="footer">
      <div class="banner full ${ready ? 'ok' : ''}" data-quick-sentence aria-live="polite"><sw-icon name=${ready ? 'check' : 'info'} size="16"></sw-icon><span>${quickSentence(q)}</span></div>
      ${this.error ? html`<div class="banner err full" role="alert" data-create-error><sw-icon name="warning" size="16"></sw-icon>${this.error}</div>` : nothing}
      ${this.note ? html`<div class="banner full" data-create-note>${this.note}</div>` : nothing}
      <sw-button variant="primary" icon="plus" data-quick-go ?disabled=${!ready || this.busy} @click=${() => this.quickCreate()}>${this.busy ? 'יוצר…' : 'יצירת התזמון'}</sw-button>
      <sw-button data-quick-edit ?disabled=${!ready || this.busy} @click=${() => this.quickEdit()}>פתיחה בעורך</sw-button>
      <span class="sp"></span>
      <sw-button variant="ghost" ?disabled=${this.busy} @click=${() => this.close()}>ביטול</sw-button>
    </div>`;
  }

  render() {
    if (!this.open) return nothing;
    const tab = (id: 'tpl' | 'quick', label: string) => html`<button type="button" role="tab" id=${`tab-${id}`} aria-controls="create-panel" aria-selected=${this.tab === id} tabindex=${this.tab === id ? 0 : -1} data-create-tab=${id} @click=${() => (this.tab = id)} @keydown=${(e: KeyboardEvent) => this.onTabKey(e)}>${label}</button>`;
    // AUDIT30-I3: the shared dialog; its own close (the X, Escape, the scrim) is turned into this element's one `close` event
    return html`<sw-dialog wide .open=${this.open} heading="תזמון חדש" ?locked=${this.busy} data-create-dialog @close=${(e: Event) => {
      e.stopPropagation();
      this.close();
    }}>
        <div class="tabs" role="tablist" aria-label="דרך היצירה" @keydown=${tablistKeydown}>
          ${tab('tpl', 'מתבנית')}${tab('quick', 'יצירה מהירה (3 הקשות)')}
        </div>
        <div class="cbody" id="create-panel" role="tabpanel" aria-labelledby=${`tab-${this.tab}`} aria-busy=${this.loading ? 'true' : 'false'}>
          ${this.loadError && this.tab === 'quick' ? html`<div class="banner err" role="alert"><sw-icon name="warning" size="16"></sw-icon>${this.loadError}</div>` : nothing}
          ${this.loading && this.tab === 'quick'
            ? html`<div class="loading" role="status" aria-label="טוען…"><i></i><i></i><i></i></div>`
            : this.tab === 'tpl' ? this.renderTemplates() : this.renderQuick()}
        </div>
        ${this.tab === 'tpl' ? this.renderTemplatesFooter() : this.renderQuickFooter()}
      </sw-dialog>`;
  }
}

// Registered once and only if the tag is free (S3's list spec stands its own double in first; the product never does).
if (!customElements.get('schedule-create-dialog')) customElements.define('schedule-create-dialog', ScheduleCreateDialog);

declare global {
  interface HTMLElementTagNameMap {
    'schedule-create-dialog': ScheduleCreateDialog;
  }
}
