import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-icon';
import type { IconName } from '../components/sw-icon';
import { ApiError } from '../api/client';
import { createSchedule, getScheduleCatalog, getScheduleStatus, type CatalogEntity, type ConditionPreset, type ScheduleStatus } from '../api/schedules';
import { navigate } from '../router';
import { metaFromCatalog, type EntityMeta } from './schedule-edit-logic';
import { PRESET_CHOICES, QUICK_DAYS, QUICK_TIMES, TEMPLATES, quickActions, quickDraft, quickReady, quickSentence, type QuickAction, type QuickDays, type QuickTime, type ScheduleTemplate } from './schedule-templates';

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

@customElement('schedule-create-dialog')
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
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: var(--sw-z-modal);
      background: var(--sw-overlay);
      display: grid;
      place-items: center;
      padding: 16px;
    }
    .box {
      inline-size: min(760px, 100%);
      max-block-size: calc(100dvh - 32px);
      overflow: auto;
      background: var(--sw-surface);
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-3);
      padding: 18px 20px 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    h3 {
      margin: 0;
      font-size: var(--sw-fs-xl);
      font-weight: var(--sw-fw-semibold);
    }
    .tabs {
      display: flex;
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-md);
      padding: 3px;
    }
    .tabs button {
      flex: 1;
      border: 0;
      background: none;
      font: inherit;
      font-size: var(--sw-fs-sm);
      padding: 7px 10px;
      border-radius: var(--sw-r-sm);
      color: var(--sw-text-2);
      cursor: pointer;
    }
    .tabs button[aria-selected='true'] {
      background: var(--sw-surface);
      color: var(--sw-accent-text);
      box-shadow: var(--sw-shadow-1);
      font-weight: var(--sw-fw-semibold);
    }
    .tpls {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
      gap: 10px;
    }
    .tpl {
      text-align: start;
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      border-radius: var(--sw-r-md);
      padding: 12px;
      font: inherit;
      color: var(--sw-text);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .tpl:hover {
      border-color: var(--sw-border-strong);
      box-shadow: var(--sw-shadow-1);
    }
    .tpl[aria-pressed='true'] {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft);
    }
    .tpl:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .tpl .top {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .tile {
      display: grid;
      place-items: center;
      inline-size: 30px;
      block-size: 30px;
      border-radius: 8px;
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      flex: none;
    }
    .tpl b {
      font-size: var(--sw-fs-md);
    }
    .tpl span {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .sec {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .sec > label,
    .sec > .lbl {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
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
      min-block-size: 32px;
      padding: 4px 12px;
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      border-radius: var(--sw-r-sm);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
    }
    .chip[aria-pressed='true'] {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: #fff;
    }
    .chip:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .banner {
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 10px 12px;
      border-radius: var(--sw-r-md);
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-sm);
    }
    .banner.ok {
      background: var(--sw-success-soft);
      color: #166534;
    }
    .banner.err {
      background: var(--sw-danger-soft);
      color: #991b1b;
    }
    .hint {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    footer {
      display: flex;
      justify-content: flex-start;
      gap: 8px;
      flex-wrap: wrap;
    }
    @media (max-width: 640px) {
      .backdrop {
        place-items: end center;
        padding: 0;
      }
      .box {
        border-radius: var(--sw-r-lg) var(--sw-r-lg) 0 0;
        inline-size: 100%;
        max-block-size: 92dvh;
      }
      footer sw-button {
        flex: 1;
      }
    }
  `;

  willUpdate(changed: Map<string, unknown>) {
    if (changed.has('open') && this.open && !this.wasOpen) void this.reset();
    if (changed.has('open')) this.wasOpen = this.open;
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

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.open && !this.busy) this.close();
  };

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this.onKey);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.onKey);
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
      return this.status?.can.configure ? html`<div class="hint" data-preset-hint>בחרו חיישן שבת וחג בהגדרות › תזמונים כדי לקבל תנאים מוכנים.</div>` : nothing;
    }
    return html`<div class="sec"><span class="lbl">תנאי</span><div class="chips" role="group" aria-label="תנאי שבת וחג">
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
          </button>`;
        })}
      </div>
      ${this.renderPresets()}
      <footer>
        <sw-button variant="primary" data-create-continue ?disabled=${!this.tpl} @click=${() => this.useTemplate()}>המשך לעורך</sw-button>
        <sw-button @click=${() => this.close()}>ביטול</sw-button>
      </footer>`;
  }

  private renderQuick() {
    const areaEntities = this.quickEntities.filter((e) => (e.area_name ?? 'ללא אזור') === this.area);
    const first = this.chosen[0];
    const actions = quickActions(first);
    const q = this.choice();
    const ready = quickReady(q);
    return html`<div class="sec"><label>1 · איפה?</label>
        <div class="chips">${this.areas.map((a) => html`<button type="button" class="chip" data-quick-area=${a} aria-pressed=${this.area === a} @click=${() => (this.area = a)}>${a}</button>`)}</div>
        ${this.area
          ? html`<div class="chips">${areaEntities.map((e) => {
              const on = this.picked.includes(e.entity_id);
              const other = first && first.domain !== e.domain;
              return html`<button type="button" class="chip" data-quick-entity=${e.entity_id} aria-pressed=${on} ?disabled=${!on && !!other} @click=${() => this.togglePicked(e.entity_id)}>${e.name}</button>`;
            })}</div>`
          : nothing}
      </div>
      <div class="sec"><label>2 · מה ומתי?</label>
        <div class="chips">${actions.length ? actions.map((a) => html`<button type="button" class="chip" data-quick-action=${a.id} aria-pressed=${this.action?.id === a.id} @click=${() => (this.action = a)}>${a.label}</button>`) : html`<span class="hint">בחרו התקן קודם</span>`}</div>
        <div class="chips">${QUICK_TIMES.map((t) => html`<button type="button" class="chip" data-quick-time=${t.id} aria-pressed=${this.time?.id === t.id} @click=${() => (this.time = t)}><sw-icon name=${t.sun ? 'history' : 'clock'} size="13"></sw-icon>${t.label}</button>`)}</div>
      </div>
      <div class="sec"><label>3 · באילו ימים?</label>
        <div class="chips">${QUICK_DAYS.map((d) => html`<button type="button" class="chip" data-quick-days=${d.id} aria-pressed=${this.days?.id === d.id} @click=${() => (this.days = d)}>${d.label}</button>`)}</div>
      </div>
      ${this.renderPresets()}
      <div class="banner ${ready ? 'ok' : ''}" data-quick-sentence><sw-icon name=${ready ? 'check' : 'info'} size="16"></sw-icon><span>${quickSentence(q)}</span></div>
      ${this.error ? html`<div class="banner err" role="alert" data-create-error>${this.error}</div>` : nothing}
      ${this.note ? html`<div class="banner" data-create-note>${this.note}</div>` : nothing}
      <footer>
        <sw-button variant="primary" icon="plus" data-quick-go ?disabled=${!ready || this.busy} @click=${() => this.quickCreate()}>${this.busy ? 'יוצר…' : 'יצירת התזמון'}</sw-button>
        <sw-button data-quick-edit ?disabled=${!ready || this.busy} @click=${() => this.quickEdit()}>פתיחה בעורך</sw-button>
        <sw-button ?disabled=${this.busy} @click=${() => this.close()}>ביטול</sw-button>
      </footer>`;
  }

  render() {
    if (!this.open) return nothing;
    return html`<div class="backdrop" @click=${(e: Event) => e.target === e.currentTarget && !this.busy && this.close()}>
      <div class="box" role="dialog" aria-modal="true" aria-label="תזמון חדש" data-create-dialog>
        <header><h3>תזמון חדש</h3><sw-button variant="ghost" size="sm" iconOnly icon="close" label="סגור" @click=${() => this.close()}></sw-button></header>
        <div class="tabs" role="tablist">
          <button type="button" role="tab" aria-selected=${this.tab === 'tpl'} data-create-tab="tpl" @click=${() => (this.tab = 'tpl')}>מתבנית</button>
          <button type="button" role="tab" aria-selected=${this.tab === 'quick'} data-create-tab="quick" @click=${() => (this.tab = 'quick')}>יצירה מהירה (3 הקשות)</button>
        </div>
        ${this.loading ? html`<div class="hint">טוען…</div>` : nothing}
        ${this.loadError && this.tab === 'quick' ? html`<div class="banner err" role="alert">${this.loadError}</div>` : nothing}
        ${this.tab === 'tpl' ? this.renderTemplates() : this.renderQuick()}
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'schedule-create-dialog': ScheduleCreateDialog;
  }
}
