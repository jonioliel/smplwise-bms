import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { subscribeClock } from '../api/clock-ticker';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-segmented';
import type { SegmentedChange } from '../components/sw-segmented';
import '../components/sw-button';
import '../components/sw-toggle';
import '../components/sw-icon';
import '../components/sw-state-panel';
import '../components/sw-table';
import type { TableColumn } from '../components/sw-table';
import './automation-drawer';
import './scenario-settings';
import '../components/sw-list-display-settings';
import { ApiError } from '../api/client';
import { invalidateSettings } from '../api/prefs';
import { isApi } from '../api/session';
import { applyAutomationsHidden } from '../shell/nav';
import { autoApi, autoNow, autoReady } from '../api/automations-demo';
import {
  AUTOMATION_SETTINGS_DEFAULT, AUTOMATION_SETTING_RANGES, COMPAT_LABEL, REVIEW_LABEL, automationErrorText, mapAutomationError,
  type AutomationSettings, type AutomationTemplate, type AutomationsStatus, type CompatScan, type ReviewRow, type TrashRow,
} from '../api/automations';
import { CODE_VIEW_ROLES, ROLE_ROWS, delegationLabel, moveTemplate, templateRows, toggleCodeRole, toggleHidden, whenText, type TplRef } from './automations-logic';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { settingsStyles } from '../styles/settings';
import { tr } from '../i18n/msg/system-a';
import { chipSelected, chipSelectedCheck } from '../styles/chip-selected';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** The templates seen are remembered in this browser (the server's gallery answer leaves out the hidden ones): `templateRows` in the logic module merges them. */
const TPL_KEY = 'sw.automations.templates.v1';
function knownTemplates(): TplRef[] {
  try { const v = JSON.parse(window.localStorage.getItem(TPL_KEY) ?? '[]') as unknown; return Array.isArray(v) ? (v as TplRef[]).filter((t) => t && typeof t.id === 'string') : []; } catch { return []; }
}
function rememberTemplates(list: TplRef[]): void {
  try { window.localStorage.setItem(TPL_KEY, JSON.stringify(list)); } catch { /* storage unavailable: hidden templates fall back to their ids */ }
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

type NumKey = 'trash_days' | 'versions_keep' | 'wall_double_ms' | 'wall_long_ms' | 'wall_debounce_ms' | 'wall_listen_s' | 'conflict_window_min';
type LimKey = keyof AutomationSettings['limits'];

/**
 * CR-017 הגדרות › אוטומציות (`#/system/automations`, `system.configure`, installation scope; the server checks it on every write): the ONE place where every
 * option of the feature lives (owner rule 2026-10-01); the operator screens carry none. Cards: מי רשאי (the role x view / run / create-edit / code matrix, read
 * only, with the link to the roles screen), האצלה (the bridge's delegation switch: READ ONLY - it is switched in Home Assistant, the card says where, when it
 * changed and how many delegated writes the review lists), תצוגת קוד (which roles see the "בונה · קוד" switch), סל מחזור והיסטוריה (retention days, versions
 * kept, the trash), מגבלות (writes, previews, run intervals, storm thresholds, storm auto-disable), פעולות רגישות (the rule in one line, the warning chip on or off
 * and its colour amber / red, the approved notify targets), גלריית תבניות (on/off, hide and order), הצגה (the phone filter folds or keeps its rows, "+ חדש שואל
 * מתי?"), מצב (the platform, the bridge, the last sync, the feature switch) and the review list. A settings screen keeps the exact technical names
 * (docs/design/UI_COPY_RULES.md). Changes are a draft with a save bar (audited server-side), like הגדרות › תזמונים. Without a backend the in-memory demo answers.
 */
@customElement('system-automations')
export class SystemAutomations extends LitElement {
  /** 0.1.157: the bubble skin's chrome keys on the host's data-skin (styles/bubble-chrome.ts). */
  readonly bubbleSkin = new SkinController(this);
  @state() private phase: 'loading' | 'ready' | 'forbidden' | 'error' = 'loading';
  @state() private status: AutomationsStatus | null = null;
  @state() private saved: AutomationSettings = clone(AUTOMATION_SETTINGS_DEFAULT);
  @state() private draft: AutomationSettings = clone(AUTOMATION_SETTINGS_DEFAULT);
  @state() private templates: TplRef[] = [];
  @state() private notify: Array<{ action: string; name: string }> = [];
  @state() private review: ReviewRow[] = [];
  @state() private compat: CompatScan | null = null;
  @state() private trash: TrashRow[] = [];
  @state() private error = '';
  @state() private note = '';
  @state() private busy = false;
  @state() private trashOpen = false;
  @state() private now: Date = new Date();
  /** KAV079-295: entity ids of the catalogue (the "who is in the building" picker). */
  @state() private candidates: string[] = [];
  private noteTimer = 0;

  static styles = [settingsStyles, css`
    .cols {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: var(--sw-s-3);
      align-items: start;
    }
    .col {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      min-inline-size: 0;
    }
    .row {
      flex-wrap: wrap;
    }
    .tag {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      min-block-size: 24px;
      padding: 0 10px;
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      white-space: nowrap;
    }
    .tag.ok {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .tag.warn {
      background: var(--sw-stale-soft);
      color: var(--sw-warning-text);
    }
    /* SCHED-POLISH-2331 -> SHARED-POLISH-2342 -> CR-CMP2-TABLES-REST-2470: the role matrix is the shared sw-table.set-matrix of
       styles/settings.ts; only its foot margin stays here */
    sw-table.mtx {
      margin-block-end: var(--sw-s-3);
    }
    .no {
      color: var(--sw-text-3);
    }
    .chipsrow {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .rc {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 36px;
      padding-inline: 12px 14px;
      border-radius: var(--sw-r-pill);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
    }
    /* AUDIT30-I2 (#4, owner Q3 option a): the chosen chip is the Blue Wash pair */
    .rc[aria-pressed='true'] {
      ${chipSelected}
    }
    /* DOMUS-DEFAULT-2439: the check mark of the selected chip (hidden by the other looks of ui.chip_selected) */
    .rc[aria-pressed='true']::before {
      ${chipSelectedCheck}
    }
    .rc:disabled {
      opacity: 0.6;
      cursor: default;
    }
    .rc:focus-visible,
    .ib:focus-visible,
    .stepper button:focus-visible,
    .link:focus-visible,
    .rev a:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset, 2px);
      border-radius: var(--sw-r-sm);
    }
    .stepper {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
    }
    .stepper button {
      display: grid;
      place-items: center;
      inline-size: 36px;
      block-size: 36px;
      border: 0;
      border-radius: var(--sw-r-sm);
      background: transparent;
      cursor: pointer;
      color: var(--sw-text);
      transition: transform var(--sw-t-press) var(--sw-ease), background var(--sw-t-hover) var(--sw-ease-color);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    .stepper button:active:not(:disabled),
    .ib:active:not(:disabled) {
      transform: scale(var(--sw-press-scale));
    }
    @media (hover: hover) and (pointer: fine) {
      .stepper button:hover:not(:disabled),
      .ib:hover:not(:disabled) {
        background: var(--sw-hover-wash);
      }
    }
    .stepper button:disabled {
      opacity: 0.35;
      cursor: default;
    }
    .stepper .v {
      min-inline-size: 70px;
      text-align: center;
      font-weight: var(--sw-fw-semibold);
      font-variant-numeric: tabular-nums;
    }
    .stepper .v small {
      color: var(--sw-text-3);
      font-weight: var(--sw-fw-regular);
      margin-inline-start: 4px;
    }
    .tpl {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-base);
      font-weight: var(--sw-fw-medium);
    }
    .tpl:last-child {
      border-block-end: 0;
    }
    .tpl.off .nm {
      opacity: 0.55;
    }
    .tpl .nm {
      flex: 1;
      min-inline-size: 0;
    }
    .ib {
      display: inline-grid;
      place-items: center;
      flex: none;
      inline-size: 34px;
      block-size: 34px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      cursor: pointer;
    }
    .ib:disabled {
      opacity: 0.35;
      cursor: default;
    }
    /* the presence picker: the settings' select look (it had a class and no rule, so it rendered as the browser's default) */
    select.sel {
      min-block-size: 36px;
      max-inline-size: 260px;
      padding: 0 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      direction: ltr;
    }
    select.sel:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    @media (pointer: coarse) {
      .ib,
      .stepper button {
        inline-size: 44px;
        block-size: 44px;
      }
      .rc,
      select.sel {
        min-block-size: 44px;
      }
    }
    .rev {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .rev:last-child {
      border-block-end: 0;
    }
    .rev.cmp {
      flex-wrap: wrap;
      row-gap: 4px;
    }
    .rev.cmp > .muted {
      flex: 1 1 100%;
    }
    .rev a {
      color: var(--sw-accent-text);
      text-decoration: none;
      font-weight: var(--sw-fw-semibold);
    }
    .rev a:hover {
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    .link {
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-sm);
      text-decoration: none;
    }
    .savebar {
      margin-block-start: var(--sw-s-3);
      max-inline-size: none;
    }
    /* SCHED-POLISH-2331 -> SHARED-POLISH-2342: a column narrower than a label plus a 240 px control stacks its rows (the label above
       the control) - the shared .set-col of styles/settings.ts (the side column at 1440 / 1180) */
    @media (max-width: 1023px) {
      .cols {
        grid-template-columns: 1fr;
      }
    }
    @media (max-width: 767px) {
      select.sel {
        max-inline-size: none;
        inline-size: 100%;
      }
    }
  `, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
    void this.load();
    // CLOCK-293: the relative times ("last sync", "changed") age while the page stays open
    this.offClock = subscribeClock(() => (this.now = autoNow()));
  }

  private offClock: (() => void) | null = null;

  disconnectedCallback() {
    super.disconnectedCallback();
    this.offClock?.();
    this.offClock = null;
    window.clearTimeout(this.noteTimer);
  }

  private get dirty(): boolean {
    return !same(this.draft, this.saved);
  }

  private async load() {
    this.error = '';
    await autoReady();
    this.now = autoNow();
    try {
      const api = autoApi();
      const status = await api.status();
      this.status = status;
      if (!status.can.configure) { this.phase = 'forbidden'; return; }
      const [settings, templates, review, trash, catalog, compat] = await Promise.all([
        api.settings(),
        api.templates().catch(() => ({ templates: [] as AutomationTemplate[] })),
        api.review().catch(() => [] as ReviewRow[]),
        api.trash().catch(() => [] as TrashRow[]),
        api.catalog().catch(() => null),
        api.compat().catch(() => null),
      ]);
      this.compat = compat;
      this.saved = settings;
      this.draft = clone(settings);
      const seen = templates.templates.map((t) => ({ id: t.id, name: t.name, suggest_schedule: t.suggest_schedule }));
      const known = knownTemplates();
      rememberTemplates([...new Map([...known, ...seen].map((t) => [t.id, t])).values()]);
      this.templates = templateRows(seen, known, settings.templates_hidden);
      this.review = review;
      this.trash = trash;
      this.notify = catalog?.notify_targets ?? [];
      this.candidates = (catalog?.entities ?? []).map((e) => e.entity_id);
      this.phase = 'ready';
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) this.phase = 'forbidden';
      else { this.error = mapAutomationError(err).message; this.phase = 'error'; }
    }
  }

  private say(text: string) {
    this.note = text;
    window.clearTimeout(this.noteTimer);
    this.noteTimer = window.setTimeout(() => (this.note = ''), 3500);
  }

  private set(patch: Partial<AutomationSettings>) {
    this.draft = { ...this.draft, ...patch };
    this.note = '';
  }
  private setLimit(k: LimKey, v: number) {
    this.set({ limits: { ...this.draft.limits, [k]: v } });
  }

  private async save() {
    if (this.busy || !this.dirty) return;
    this.busy = true;
    this.error = '';
    try {
      const to = await autoApi().saveSettings(this.draft, this.saved);
      this.saved = to;
      this.draft = clone(to);
      if (isApi()) invalidateSettings();
      applyAutomationsHidden({ 'automations.enabled': String(to.enabled) });
      this.say(tr('נשמר'));
    } catch (err) {
      this.error = automationErrorText(err);
    } finally {
      this.busy = false;
    }
  }

  // ------------------------------------------------------------------------------------------------ pieces

  private stepper(key: NumKey | LimKey, value: number, unit: string, min: number, max: number, set: (v: number) => void, label: string, step = 1): TemplateResult {
    return html`<div class="stepper" role="group" aria-label=${label}>
      <button type="button" aria-label=${tr('פחות')} data-step-minus=${key} ?disabled=${value <= min} @click=${() => set(Math.max(min, value - step))}><sw-icon name="minus" size=${16}></sw-icon></button>
      <span class="v" data-setting=${key}><bdi>${value}</bdi>${unit ? html`<small>${unit}</small>` : nothing}</span>
      <button type="button" aria-label=${tr('יותר')} data-step-plus=${key} ?disabled=${value >= max} @click=${() => set(Math.min(max, value + step))}><sw-icon name="plus" size=${16}></sw-icon></button>
    </div>`;
  }

  private tog(label: string, on: boolean, set: (v: boolean) => void, attr: string): TemplateResult {
    return html`<sw-toggle label=${label} labelHidden .checked=${on} data-toggle=${attr} @change=${(e: CustomEvent<{ checked: boolean }>) => set(e.detail.checked)}></sw-toggle>`;
  }

  private row(name: string, sub: string, ctl: TemplateResult | typeof nothing): TemplateResult {
    return html`<div class="row"><div class="lbl"><span>${name}</span>${sub ? html`<span class="muted">${sub}</span>` : nothing}</div><div>${ctl}</div></div>`;
  }

  private who(): TemplateResult {
    // the tick keeps its class as the specs' hook (`tr[data-role] .yes`); its look comes through the shared yes / no parts
    const tick = (on: boolean) => (on ? html`<sw-icon class="yes" part="yes" name="check" size=${16} role="img" aria-label=${tr('כן')}></sw-icon>` : html`<span class="no" part="no" aria-label=${tr('לא')}>—</span>`);
    const codeOn = (id: string, fixed: boolean | null) => (fixed !== null ? fixed : this.draft.code_view_roles.includes(id));
    type Role = (typeof ROLE_ROWS)[number];
    // CR-CMP2-TABLES-REST-2470 (owner N10): the role (its floors scope under it), then one centred column per right (72 px, narrower on a phone: min(72px, 16vw))
    const cols: TableColumn<Role>[] = [
      { key: 'label', label: tr('תפקיד'), render: (r) => html`<span class="t1">${r.label}</span>${r.scope ? html`<span class="t2">${r.scope}</span>` : nothing}` },
      { key: 'run', label: tr('הפעלה'), align: 'center', width: 'min(72px, 16vw)', render: (r) => tick(r.run) },
      { key: 'edit', label: tr('יצירה ועריכה'), align: 'center', width: 'min(72px, 16vw)', render: (r) => tick(r.edit) },
      { key: 'code', label: tr('קוד'), align: 'center', width: 'min(72px, 16vw)', render: (r) => tick(codeOn(r.id, r.codeFixed)) },
      ...(this.draft.device_test_enabled ? [{ key: 'test', label: tr('בדיקה על ההתקן'), align: 'center' as const, width: 'min(72px, 16vw)', cellAttrs: () => ({ 'data-col-device-test': true }), render: (r: Role) => tick(r.run && r.edit) }] : []),
    ];
    return html`<sw-card heading=${tr('מי רשאי')} data-card="who">
      <sw-table class="mtx set-matrix" bare static-rows keep-columns data-roles-matrix .columns=${cols as unknown as TableColumn[]} .rows=${ROLE_ROWS as unknown as Record<string, unknown>[]}
        .rowAttrs=${(r: Record<string, unknown>) => ({ 'data-role': String(r.id) })}></sw-table>
      ${this.row(tr('הרשאות ותפקידים'), tr('ההקצאה למשתמשים ולקומות במסך "משתמשים והרשאות".'), html`<a class="link" href="#/system/access" data-link-access>${tr('למסך המשתמשים')}</a>`)}
    </sw-card>`;
  }

  // ------------------------------------------------------------------------------------------------ KAV079-295 (mockup r079 state 8)

  private wallButtons(): TemplateResult {
    const d = this.draft;
    const R = AUTOMATION_SETTING_RANGES;
    const st = (k: 'wall_double_ms' | 'wall_long_ms' | 'wall_debounce_ms' | 'wall_listen_s', unit: string, label: string, step: number) => {
      const [lo, hi] = R[k];
      return this.stepper(k, d[k], unit, lo, hi, (v) => this.set({ [k]: v } as Partial<AutomationSettings>), label, step);
    };
    return html`<sw-card heading=${tr('כפתורי קיר ומתגים')} data-card="wall-buttons">
      ${this.row(tr('פתוח לעריכה בבונה'), tr('כפתורי קיר ומתגים בלבד בגרסה הראשונה'), this.tog(tr('פתוח לעריכה בבונה'), d.wall_buttons_editable, (v) => this.set({ wall_buttons_editable: v }), 'wall_buttons_editable'))}
      ${d.wall_buttons_editable ? html`
        ${this.row(tr('חלון לחיצה כפולה'), tr('הזמן המרבי בין שתי לחיצות'), st('wall_double_ms', tr('מ״ש'), tr('חלון לחיצה כפולה'), 50))}
        ${this.row(tr('לחיצה ארוכה מתחילה אחרי'), '', st('wall_long_ms', tr('מ״ש'), tr('לחיצה ארוכה'), 50))}
        ${this.row(tr('התעלמות מרעידות מגע'), '', st('wall_debounce_ms', tr('מ״ש'), tr('רעידות מגע'), 10))}
        ${this.row(tr('זמן האזנה בזיהוי לחיצה'), '', st('wall_listen_s', tr('שנ׳'), tr('זמן האזנה'), 5))}
        ${this.row(tr('טריגרים ייעודיים (מתג נדלק וכד׳)'), tr('לא בגרסה הראשונה'), html`<span class="tag" data-wall-purpose>${tr('כבוי')}</span>`)}
        ${this.row(tr('תבניות מתקדמות'), tr('נשארות נעולות, נשמרות כמו שהן'), html`<span class="tag" data-wall-templates><sw-icon name="lock" size=${12}></sw-icon>${tr('נעול')}</span>`)}` : nothing}
    </sw-card>`;
  }

  private prechecks(): TemplateResult {
    const d = this.draft;
    const [wlo, whi] = AUTOMATION_SETTING_RANGES.conflict_window_min;
    // CR-CMP2-SELECTS-2450 (owner N11): the shared segmented control; each key keeps its data-seg hook
    const seg = <T extends string>(attr: string, value: T, opts: Array<[T, string]>, set: (v: T) => void) =>
      html`<sw-segmented label=${attr} value=${value} .options=${opts.map(([v, l]) => ({ value: v, label: l, attrs: { 'data-seg': `${attr}:${v}` } }))}
        @change=${(e: CustomEvent<SegmentedChange>) => set(e.detail.value as T)}></sw-segmented>`;
    return html`<sw-card heading=${tr('בדיקות לפני שמירה')} data-card="prechecks">
      ${this.row(tr('בדיקות לפני שמירה'), tr('התנגשויות, התקן לא זמין, כפתור שכבר בשימוש'), this.tog(tr('בדיקות לפני שמירה'), d.precheck_enabled, (v) => this.set({ precheck_enabled: v }), 'precheck_enabled'))}
      ${d.precheck_enabled ? html`
        ${this.row(tr('חלון זיהוי התנגשות'), tr('פעולות הפוכות על אותו התקן, בין תזמונים ואוטומציות'), this.stepper('conflict_window_min', d.conflict_window_min, tr('דק׳'), wlo, whi, (v) => this.set({ conflict_window_min: v }), tr('חלון זיהוי התנגשות')))}
        ${this.row(tr('לאפשר "שמירה עם אזהרות"'), tr('שגיאה חוסמת תמיד'), this.tog(tr('שמירה עם אזהרות'), d.save_with_warnings, (v) => this.set({ save_with_warnings: v }), 'save_with_warnings'))}
        ${this.row(tr('כפתור שכבר משמש פריט אחר'), tr('אותה לחיצה מפעילה שני פריטים'), seg('button_reuse', d.button_reuse, [['warn', tr('אזהרה')], ['error', tr('שגיאה')]], (v) => this.set({ button_reuse: v })))}` : nothing}
      ${this.row(tr('בדיקה על ההתקן'), tr('למי שמורשה לערוך וגם להפעיל ידנית'), this.tog(tr('בדיקה על ההתקן'), d.device_test_enabled, (v) => this.set({ device_test_enabled: v }), 'device_test_enabled'))}
      ${d.device_test_enabled ? html`
        ${this.row(tr('בדיקה על ההתקן: בסיום'), tr('מה קורה להתקנים שהופעלו בבדיקה'), seg('device_test_end', d.device_test_end, [['ask', tr('לשאול')], ['restore', tr('להחזיר')], ['keep', tr('להשאיר')]], (v) => this.set({ device_test_end: v })))}
        ${this.row(tr('בדיקה על ההתקן לפעולה רגישה'), tr('כמו היום: לפי הרשאת הפעלה ידנית'), html`<span class="tag" data-device-test-sensitive><sw-icon name="lock" size=${12}></sw-icon>${tr('לפי הרשאה')}</span>`)}` : nothing}
      ${this.row(tr('"מי במבנה" באוטומציות'), tr('החיישן שמדווח אם יש מישהו במבנה'), html`<select class="sel" aria-label=${tr('מי במבנה')} data-presence-entity @change=${(e: Event) => this.set({ presence_entity: (e.target as HTMLSelectElement).value })}>
        <option value="" ?selected=${!d.presence_entity}>${tr('כבוי')}</option>
        ${this.presenceCandidates().map((id) => html`<option value=${id} ?selected=${id === d.presence_entity}>${id}</option>`)}</select>`)}
    </sw-card>`;
  }

  /** The binary sensors / input booleans the catalogue lists (the "who is in the building" entity is one of them). */
  private presenceCandidates(): string[] {
    const ids = this.candidates.filter((e) => /^(binary_sensor|input_boolean)\./.test(e));
    return this.draft.presence_entity && !ids.includes(this.draft.presence_entity) ? [this.draft.presence_entity, ...ids] : ids;
  }

  private delegation(): TemplateResult | typeof nothing {
    const s = this.status;
    if (!s) return nothing;
    const d = delegationLabel(s);
    const changed = s.admin?.delegation_changed_at ? whenText(s.admin.delegation_changed_at, this.now) : '';
    const delegated = this.review.filter((r) => r.issue === 'delegated_write').length;
    return html`<sw-card heading=${tr('האצלה לבני בית שאינם מנהלי Home Assistant')} data-card="delegation">
      ${this.row(tr('מתג ההאצלה ברכיב החיבור'), `${d.label}${changed ? ` · ${tr('שונה {time}', { time: changed })}` : ''} · ${tr('מאפשר שמירה של תוכן העורך הפשוט בלבד')}`, html`<span class=${`tag ${d.state === 'on' ? 'ok' : ''}`} data-delegation-state=${d.state}>${d.label}</span>`)}
      ${this.row(tr('איפה משנים'), tr('Home Assistant ‹ הגדרות ‹ התקנים ושירותים ‹ Arx Bridge ‹ אפשרויות. לא ניתן לשינוי מכאן.'), html`<span class="tag" data-delegation-readonly><sw-icon name="lock" size=${12}></sw-icon>${tr('לקריאה בלבד')}</span>`)}
      ${this.row(tr('כתיבות מואצלות'), tr('{n} ברשימת הסקירה', { n: delegated }), delegated ? html`<a class="link" href="#review" data-link-review @click=${(e: Event) => { e.preventDefault(); this.renderRoot.querySelector('[data-card="review"]')?.scrollIntoView({ block: 'center' }); }}>${tr('לסקירה')}</a>` : nothing)}
    </sw-card>`;
  }

  private codeView(): TemplateResult {
    return html`<sw-card heading=${tr('תצוגת קוד')} data-card="code">
      ${this.row(tr('מי רואה את המתג "בונה · קוד"'), tr('הצד השני של אותו עורך. שמירת תוכן שאינו מהבונה דורשת מנהל Home Assistant בכל מקרה.'), html`<div class="chipsrow" role="group" aria-label=${tr('תפקידים')}>${CODE_VIEW_ROLES.map((r) => {
        const on = this.draft.code_view_roles.includes(r.id) || r.locked;
        return html`<button type="button" class="rc" aria-pressed=${String(on)} ?disabled=${r.locked} data-code-role=${r.id} @click=${() => this.set({ code_view_roles: toggleCodeRole(this.draft.code_view_roles, r.id) })}><sw-icon name=${on ? 'check' : 'plus'} size=${14}></sw-icon>${r.label}</button>`;
      })}</div>`)}
    </sw-card>`;
  }

  private retention(): TemplateResult {
    const d = this.draft;
    const [tlo, thi] = AUTOMATION_SETTING_RANGES.trash_days;
    const [vlo, vhi] = AUTOMATION_SETTING_RANGES.versions_keep;
    return html`<sw-card heading=${tr('סל מחזור והיסטוריה')} data-card="retention">
      ${this.row(tr('שמירה בסל המחזור'), tr('פריט שנמחק ניתן לשחזור עם אותו מזהה'), this.stepper('trash_days', d.trash_days, tr('ימים'), tlo, thi, (v) => this.set({ trash_days: v }), tr('ימי שמירה בסל המחזור')))}
      ${this.row(tr('גרסאות לכל פריט'), tr('כולל שינויים שנעשו מחוץ למערכת'), this.stepper('versions_keep', d.versions_keep, tr('גרסאות'), vlo, vhi, (v) => this.set({ versions_keep: v }), tr('גרסאות לכל פריט')))}
      ${this.row(tr('סל המחזור'), tr('{n} פריטים', { n: this.trash.length }), html`<sw-button size="sm" icon="trash" data-open-trash @click=${() => (this.trashOpen = true)}>${tr('פתח')}</sw-button>`)}
    </sw-card>`;
  }

  private limits(): TemplateResult {
    const l = this.draft.limits;
    const st = (k: LimKey, unit: string, min: number, max: number, label: string) => this.stepper(k, l[k], unit, min, max, (v) => this.setLimit(k, v), label);
    return html`<sw-card heading=${tr('מגבלות')} data-card="limits">
      ${this.row(tr('שמירות לדקה למשתמש'), '', st('writes_per_min', '', 5, 120, tr('שמירות לדקה')))}
      ${this.row(tr('תצוגות מקדימות לדקה'), '', st('preview_per_min', '', 10, 240, tr('תצוגות מקדימות לדקה')))}
      ${this.row(tr('הרצה חוזרת של אותו פריט'), tr('מרווח מינימלי'), st('run_interval_s', tr('שנ׳'), 3, 60, tr('מרווח הרצה')))}
      ${this.row(tr('הפעלת סצנה חוזרת'), '', st('scene_apply_interval_s', tr('שנ׳'), 1, 30, tr('מרווח הפעלת סצנה')))}
      ${this.row(tr('סערת הרצות · פריט'), tr('התראה מעל {item} ריצות לדקה לפריט או {total} בסך הכל', { item: l.storm_item_per_min, total: l.storm_total_per_min }), st('storm_item_per_min', tr('/דק׳'), 5, 100, tr('סף לפריט')))}
      ${this.row(tr('סערת הרצות · סך הכל'), '', st('storm_total_per_min', tr('/דק׳'), 50, 1000, tr('סף כולל')))}
      ${this.row(tr('כיבוי אוטומטי בסערה'), tr('ברירת המחדל: התראה למנהל עם כיבוי בלחיצה'), this.tog(tr('כיבוי אוטומטי בסערה'), this.draft.storm_auto_disable, (v) => this.set({ storm_auto_disable: v }), 'storm_auto_disable'))}
    </sw-card>`;
  }

  private sensitive(): TemplateResult {
    const approved = new Set(this.draft.notify_targets);
    return html`<sw-card heading=${tr('פעולות רגישות')} data-card="sensitive">
      ${this.row(tr('הכלל'), tr('אזעקה, מנעולים, דלתות, שערים וצופרים מותרים באוטומציות כמו כל פעולה, ועוברים את אותן בדיקות הרשאה כמו שליטה ידנית. קודים לעולם לא נשמרים.'), html`<span class="tag ok"><sw-icon name="check" size=${12}></sw-icon>${tr('החלטת הבעלים')}</span>`)}
      ${this.row(tr('צ׳יפ אזהרה על צעד רגיש'), tr('מוצג בעורך וברשימה'), this.tog(tr('צ׳יפ אזהרה על צעד רגיש'), this.draft.sensitive_warning, (v) => this.set({ sensitive_warning: v }), 'sensitive_warning'))}
      ${this.row(tr('צבע הצ׳יפ'), tr('צהוב או אדום'), html`<sw-segmented label=${tr('צבע הצ׳יפ')} value=${this.draft.sensitive_chip} @change=${(e: CustomEvent<SegmentedChange>) => this.set({ sensitive_chip: e.detail.value as 'amber' | 'red' })}
        .options=${[{ value: 'amber', label: tr('צהוב'), attrs: { 'data-sensitive-chip': 'amber' } }, { value: 'red', label: tr('אדום'), attrs: { 'data-sensitive-chip': 'red' } }]}></sw-segmented>`)}
      ${this.notify.length ? html`<div class="row"><div class="lbl"><span>${tr('יעדי התראה מאושרים')}</span><span class="muted">${tr('רק אליהם אפשר לשלוח התראה מאוטומציה')}</span></div><div class="chipsrow" role="group" aria-label=${tr('יעדי התראה')}>${this.notify.map((n) => {
        const on = approved.has(n.name);
        return html`<button type="button" class="rc" aria-pressed=${String(on)} data-notify=${n.action} @click=${() => this.set({ notify_targets: on ? this.draft.notify_targets.filter((x) => x !== n.name) : [...this.draft.notify_targets, n.name] })}>${on ? html`<sw-icon name="check" size=${14}></sw-icon>` : nothing}${n.name}</button>`;
      })}</div></div>` : nothing}
    </sw-card>`;
  }

  private gallery(): TemplateResult {
    const hidden = new Set(this.draft.templates_hidden);
    const order = this.orderedTemplates();
    return html`<sw-card heading=${tr('גלריית תבניות')} data-card="templates">
      ${this.row(tr('גלריה פעילה'), tr('מוצגת בלחיצה על "חדש"'), this.tog(tr('גלריה פעילה'), this.draft.templates_enabled, (v) => this.set({ templates_enabled: v }), 'templates_enabled'))}
      ${order.map((t, i) => html`<div class=${`tpl${hidden.has(t.id) ? ' off' : ''}`} data-template=${t.id}>
        <span class="nm">${t.name}${t.suggest_schedule ? html` <span class="tag"><sw-icon name="calendar" size=${12}></sw-icon>${tr('גם כתזמון')}</span>` : nothing}</span>
        <button type="button" class="ib" aria-label=${`${tr('הקדם')} · ${t.name}`} data-template-up=${t.id} ?disabled=${i === 0} @click=${() => this.set({ templates_order: moveTemplate(order.map((x) => x.id), t.id, -1) })}><sw-icon name="arrowUp" size=${16}></sw-icon></button>
        <button type="button" class="ib" aria-label=${`${tr('אחר')} · ${t.name}`} data-template-down=${t.id} ?disabled=${i === order.length - 1} @click=${() => this.set({ templates_order: moveTemplate(order.map((x) => x.id), t.id, 1) })}><sw-icon name="arrowDown" size=${16}></sw-icon></button>
        ${this.tog(`${tr('הצגה')} · ${t.name}`, !hidden.has(t.id), () => this.set({ templates_hidden: toggleHidden(this.draft.templates_hidden, t.id) }), `tpl-${t.id}`)}
      </div>`)}
    </sw-card>`;
  }

  /** The gallery in the draft's order: the stored order first, the rest as the server lists them. */
  private orderedTemplates(): TplRef[] {
    const rank = new Map(this.draft.templates_order.map((id, i) => [id, i]));
    return [...this.templates].sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999));
  }

  private display(): TemplateResult {
    return html`<sw-card heading=${tr('הצגה')} data-card="display">
      ${this.row(tr('מסנן בטלפון'), tr('מקופל: "סינון" אחד · שורות: כל הבקרים מוצגים'), html`<sw-segmented label=${tr('מסנן בטלפון')} value=${this.draft.phone_filter} @change=${(e: CustomEvent<SegmentedChange>) => this.set({ phone_filter: e.detail.value as 'fold' | 'rows' })}
        .options=${[{ value: 'fold', label: tr('מקופל'), attrs: { 'data-phone-filter': 'fold' } }, { value: 'rows', label: tr('שורות'), attrs: { 'data-phone-filter': 'rows' } }]}></sw-segmented>`)}
      ${this.row(tr('"+ חדש" אחד ששואל "מתי?"'), tr('"בשעות קבועות" פותח תזמון חדש; "כשמשהו קורה" פותח את הבונה. כבוי = לכל לשונית הכפתור שלה.'), this.tog(tr('חדש ששואל מתי'), this.draft.ask_when_on_new, (v) => this.set({ ask_when_on_new: v }), 'ask_when_on_new'))}
    </sw-card>`;
  }

  private platform(): TemplateResult | typeof nothing {
    const a = this.status?.admin;
    if (!a) return nothing;
    const bridgeOk = !!a.bridge_version && a.bridge_version >= a.bridge_required;
    return html`<sw-card heading=${tr('מצב')} data-card="status">
      ${this.row('Home Assistant', `${a.ha_version} · ${tr('ממשק התצורה {state}', { state: a.config_api === 'ok' ? tr('זמין') : tr('לא זמין') })}`, html`<span class=${`tag ${a.config_api === 'ok' ? 'ok' : 'warn'}`}>${a.config_api === 'ok' ? tr('תקין') : tr('לא זמין')}</span>`)}
      ${this.row('Arx Bridge', a.bridge_version ? `${a.bridge_version} (${tr('נדרש {version}+', { version: a.bridge_required })})` : tr('לא מותקן'), html`<span class=${`tag ${bridgeOk ? 'ok' : 'warn'}`}>${bridgeOk ? tr('תקין') : tr('דורש עדכון')}</span>`)}
      ${this.status?.last_sync_at ? this.row(tr('סנכרון אחרון'), whenText(this.status.last_sync_at, this.now), nothing) : nothing}
      ${this.row(tr('האוטומציות במוצר'), tr('כיבוי מסתיר את הלשונית לכולם'), this.tog(tr('האוטומציות במוצר'), this.draft.enabled, (v) => this.set({ enabled: v }), 'enabled'))}
    </sw-card>`;
  }

  private reviewCard(): TemplateResult {
    return html`<sw-card heading=${tr('סקירה')} data-card="review">
      ${this.review.length
        ? this.review.map((r) => html`<div class="rev" data-review=${`${r.kind}:${r.id}:${r.issue}`}><span class="tag warn">${REVIEW_LABEL[r.issue]}</span><a href=${`#/devices/automations/${r.kind === 'automation' ? '' : `${r.kind === 'script' ? 'scripts' : 'scenes'}/`}${encodeURIComponent(r.id)}`}>${r.name}</a><span class="muted">${r.detail}</span></div>`)
        : html`<div class="muted" data-review-empty>${tr('אין פריטים לסקירה')}</div>`}
    </sw-card>`;
  }

  /** HA 2026.10 compatibility (read-only scan of the mirror, `GET /automations/compat`): shown only when something was found. */
  private compatCard(): TemplateResult | typeof nothing {
    const scan = this.compat;
    if (!scan || !scan.items.length) return nothing;
    const href = (kind: string, id: string) => `#/devices/automations/${kind === 'automation' ? '' : `${kind === 'script' ? 'scripts' : 'scenes'}/`}${encodeURIComponent(id)}`;
    return html`<sw-card heading=${tr('תאימות לתשתית המערכת 2026.10')} data-card="compat">
      <div class="muted" data-compat-summary>${scan.items.length === 1 ? tr('פריט אחד דורש תיקון לפני השדרוג.') : tr('{n} פריטים דורשים תיקון לפני השדרוג.', { n: scan.items.length })} ${tr('הבדיקה קוראת בלבד.')}</div>
      ${scan.items.map((i) => html`<div class="rev cmp" data-compat=${`${i.kind}:${i.id}`}>
        ${[...new Set(i.issues.map((x) => x.code))].map((code) => html`<span class="tag warn" data-compat-code=${code}>${COMPAT_LABEL[code]}</span>`)}
        <a href=${href(i.kind, i.id)}>${i.name}</a>
        <span class="muted">${i.issues.some((x) => x.code === 'admin_only_service')
          ? html`${tr('הפעלה ידנית תיכשל למי שאינו מנהל')} (<bdi>${i.issues.find((x) => x.service)?.service ?? ''}</bdi>)`
          : tr('ייכשל בבדיקת התצורה ולא יפעל')}</span>
      </div>`)}
      ${scan.truncated ? html`<div class="muted">${tr('מוצגים הפריטים הראשונים בלבד.')}</div>` : nothing}
    </sw-card>`;
  }

  render() {
    if (this.phase === 'loading') return html`<sw-page crumbs=${tr('הגדרות')} heading=${tr('אוטומציות')}><sw-state-panel state="loading"></sw-state-panel></sw-page>`;
    if (this.phase === 'error') return html`<sw-page crumbs=${tr('הגדרות')} heading=${tr('אוטומציות')}><sw-state-panel state="error" hint=${this.error} actionLabel=${tr('נסו שוב')} @action=${() => void this.load()}></sw-state-panel></sw-page>`;
    if (this.phase === 'forbidden') return html`<sw-page crumbs=${tr('הגדרות')} heading=${tr('אוטומציות')}><sw-state-panel state="forbidden" heading=${tr('אין הרשאה')} data-automations-settings-forbidden></sw-state-panel></sw-page>`;
    return html`<sw-page crumbs=${tr('הגדרות')} heading=${tr('אוטומציות')} subheading=${tr('כל אפשרות של האוטומציות, הסצנות והסקריפטים נמצאת כאן בלבד.')} wide data-automations-settings>
      <div class="cols">
        <div class="col set-col">${this.platform()}${this.wallButtons()}${this.codeView()}${this.who()}${this.retention()}${this.display()}<sw-list-display-settings list="automations"></sw-list-display-settings></div>
        <div class="col set-col">${this.prechecks()}${this.compatCard()}${this.delegation()}${this.limits()}${this.sensitive()}${this.gallery()}${this.reviewCard()}${isApi() ? html`<scenario-settings></scenario-settings>` : nothing}</div>
      </div>
      ${this.dirty || this.note || this.error
        ? html`<div class="savebar" data-settings-bar>
            ${this.error ? html`<span class="msg err" role="alert" data-settings-error><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>` : this.note ? html`<span class="msg ok" role="status" data-settings-saved><sw-icon name="check" size=${13}></sw-icon>${this.note}</span>` : html`<span class="dirty">${tr('יש שינויים שלא נשמרו.')}</span>`}
            <span class="grow"></span>
            ${this.dirty ? html`<sw-button variant="ghost" data-settings-cancel @click=${() => { this.draft = clone(this.saved); this.error = ''; }}>${tr('ביטול')}</sw-button><sw-button variant="primary" icon="check" data-settings-save ?disabled=${this.busy} @click=${() => void this.save()}>${this.busy ? tr('שומר…') : tr('שמירה')}</sw-button>` : nothing}
          </div>`
        : nothing}
      <automation-drawer .trash=${true} .open=${this.trashOpen} .status=${this.status} .now=${this.now} @drawer-close=${() => { this.trashOpen = false; void this.load(); }}></automation-drawer>
    </sw-page>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-automations': SystemAutomations;
  }
}
