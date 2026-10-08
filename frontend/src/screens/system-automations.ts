import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-toggle';
import '../components/sw-icon';
import '../components/sw-state-panel';
import './automation-drawer';
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

type NumKey = 'trash_days' | 'versions_keep';
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
  private noteTimer = 0;

  static styles = [css`
    :host {
      display: block;
    }
    .cols {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 14px;
      align-items: start;
    }
    .col {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-inline-size: 0;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
      flex-wrap: wrap;
    }
    .row:last-child {
      border-block-end: 0;
    }
    .lbl {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-inline-size: 0;
      flex: 1 1 220px;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
    }
    .muted {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      font-weight: var(--sw-fw-regular);
    }
    .tag {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      white-space: nowrap;
    }
    .tag.ok {
      background: var(--sw-success-soft);
      color: #15803d;
    }
    .tag.warn {
      background: var(--sw-stale-soft);
      color: #92400e;
    }
    table.mtx {
      inline-size: 100%;
      border-collapse: collapse;
      font-size: var(--sw-fs-sm);
    }
    .mtx th {
      text-align: start;
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      padding: 6px 4px;
    }
    .mtx td {
      padding: 8px 4px;
      border-block-start: 1px solid var(--sw-border);
    }
    .mtx td small {
      display: block;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .mtx .c {
      text-align: center;
      inline-size: 64px;
    }
    .yes {
      color: #15803d;
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
      padding-inline: 14px;
      border-radius: 999px;
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
    }
    .rc[aria-pressed='true'] {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .rc:disabled {
      opacity: 0.6;
      cursor: default;
    }
    .seg {
      display: inline-flex;
      border: 1px solid var(--sw-border-strong);
      border-radius: 8px;
      overflow: hidden;
    }
    .seg button {
      border: 0;
      background: var(--sw-surface);
      padding: 0 14px;
      min-block-size: 36px;
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      color: var(--sw-text-2);
    }
    .seg button + button {
      border-inline-start: 1px solid var(--sw-border);
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .stepper {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      border: 1px solid var(--sw-border-strong);
      border-radius: 8px;
      background: var(--sw-surface);
    }
    .stepper button {
      inline-size: 36px;
      block-size: 36px;
      border: 0;
      background: transparent;
      font: inherit;
      font-size: 18px;
      cursor: pointer;
      color: var(--sw-text);
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
      gap: 10px;
      padding: 6px 0;
      border-block-end: 1px dashed var(--sw-border);
      font-size: var(--sw-fs-sm);
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
      inline-size: 32px;
      block-size: 32px;
      border: 1px solid var(--sw-border-strong);
      border-radius: 8px;
      background: var(--sw-surface);
      color: var(--sw-text);
      cursor: pointer;
    }
    .ib:disabled {
      opacity: 0.35;
      cursor: default;
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
    .rev a {
      color: var(--sw-accent-text);
      text-decoration: none;
      font-weight: var(--sw-fw-medium);
    }
    .link {
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-sm);
      text-decoration: none;
    }
    .ok {
      color: #15803d;
      font-size: var(--sw-fs-sm);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    .bar {
      position: sticky;
      inset-block-end: 12px;
      display: flex;
      align-items: center;
      gap: 10px;
      margin-block-start: 14px;
      padding: 10px 14px;
      border: 1px solid var(--sw-border);
      border-radius: 12px;
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-2);
    }
    @media (max-width: 1023px) {
      .cols {
        grid-template-columns: 1fr;
      }
    }
  `, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
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
      this.say('נשמר');
    } catch (err) {
      this.error = automationErrorText(err);
    } finally {
      this.busy = false;
    }
  }

  // ------------------------------------------------------------------------------------------------ pieces

  private stepper(key: NumKey | LimKey, value: number, unit: string, min: number, max: number, set: (v: number) => void, label: string): TemplateResult {
    return html`<div class="stepper" role="group" aria-label=${label}>
      <button type="button" aria-label="פחות" data-step-minus=${key} ?disabled=${value <= min} @click=${() => set(Math.max(min, value - 1))}>−</button>
      <span class="v" data-setting=${key}><bdi>${value}</bdi>${unit ? html`<small>${unit}</small>` : nothing}</span>
      <button type="button" aria-label="יותר" data-step-plus=${key} ?disabled=${value >= max} @click=${() => set(Math.min(max, value + 1))}>+</button>
    </div>`;
  }

  private tog(label: string, on: boolean, set: (v: boolean) => void, attr: string): TemplateResult {
    return html`<sw-toggle label=${label} labelHidden .checked=${on} data-toggle=${attr} @change=${(e: CustomEvent<{ checked: boolean }>) => set(e.detail.checked)}></sw-toggle>`;
  }

  private row(name: string, sub: string, ctl: TemplateResult | typeof nothing): TemplateResult {
    return html`<div class="row"><div class="lbl"><span>${name}</span>${sub ? html`<span class="muted">${sub}</span>` : nothing}</div><div>${ctl}</div></div>`;
  }

  private who(): TemplateResult {
    const tick = (on: boolean) => (on ? html`<sw-icon class="yes" name="check" size=${16}></sw-icon>` : html`<span class="no">—</span>`);
    const codeOn = (id: string, fixed: boolean | null) => (fixed !== null ? fixed : this.draft.code_view_roles.includes(id));
    return html`<sw-card heading="מי רשאי" data-card="who">
      <table class="mtx" data-roles-matrix>
        <thead><tr><th>תפקיד</th><th class="c">הפעלה</th><th class="c">יצירה ועריכה</th><th class="c">קוד</th></tr></thead>
        <tbody>${ROLE_ROWS.map((r) => html`<tr data-role=${r.id}><td>${r.label}${r.scope ? html`<small>${r.scope}</small>` : nothing}</td><td class="c">${tick(r.run)}</td><td class="c">${tick(r.edit)}</td><td class="c">${tick(codeOn(r.id, r.codeFixed))}</td></tr>`)}</tbody>
      </table>
      ${this.row('הרשאות ותפקידים', 'ההקצאה למשתמשים ולקומות במסך "משתמשים והרשאות".', html`<a class="link" href="#/system/access" data-link-access>למסך המשתמשים</a>`)}
    </sw-card>`;
  }

  private delegation(): TemplateResult | typeof nothing {
    const s = this.status;
    if (!s) return nothing;
    const d = delegationLabel(s);
    const changed = s.admin?.delegation_changed_at ? whenText(s.admin.delegation_changed_at, this.now) : '';
    const delegated = this.review.filter((r) => r.issue === 'delegated_write').length;
    return html`<sw-card heading="האצלה לבני בית שאינם מנהלי Home Assistant" data-card="delegation">
      ${this.row('מתג ההאצלה ברכיב החיבור', `${d.label}${changed ? ` · שונה ${changed}` : ''} · מאפשר שמירה של תוכן העורך הפשוט בלבד`, html`<span class=${`tag ${d.state === 'on' ? 'ok' : ''}`} data-delegation-state=${d.state}>${d.label}</span>`)}
      ${this.row('איפה משנים', 'Home Assistant › הגדרות › התקנים ושירותים › Arx Bridge › אפשרויות. לא ניתן לשינוי מכאן.', html`<span class="tag" data-delegation-readonly><sw-icon name="lock" size=${12}></sw-icon>לקריאה בלבד</span>`)}
      ${this.row('כתיבות מואצלות', `${delegated} ברשימת הסקירה`, delegated ? html`<a class="link" href="#review" data-link-review @click=${(e: Event) => { e.preventDefault(); this.renderRoot.querySelector('[data-card="review"]')?.scrollIntoView({ block: 'center' }); }}>לסקירה</a>` : nothing)}
    </sw-card>`;
  }

  private codeView(): TemplateResult {
    return html`<sw-card heading="תצוגת קוד" data-card="code">
      ${this.row('מי רואה את המתג "בונה · קוד"', 'הצד השני של אותו עורך. שמירת תוכן שאינו מהבונה דורשת מנהל Home Assistant בכל מקרה.', html`<div class="chipsrow" role="group" aria-label="תפקידים">${CODE_VIEW_ROLES.map((r) => {
        const on = this.draft.code_view_roles.includes(r.id) || r.locked;
        return html`<button type="button" class="rc" aria-pressed=${String(on)} ?disabled=${r.locked} data-code-role=${r.id} @click=${() => this.set({ code_view_roles: toggleCodeRole(this.draft.code_view_roles, r.id) })}>${on ? '✓ ' : '+ '}${r.label}</button>`;
      })}</div>`)}
    </sw-card>`;
  }

  private retention(): TemplateResult {
    const d = this.draft;
    const [tlo, thi] = AUTOMATION_SETTING_RANGES.trash_days;
    const [vlo, vhi] = AUTOMATION_SETTING_RANGES.versions_keep;
    return html`<sw-card heading="סל מחזור והיסטוריה" data-card="retention">
      ${this.row('שמירה בסל המחזור', 'פריט שנמחק ניתן לשחזור עם אותו מזהה', this.stepper('trash_days', d.trash_days, 'ימים', tlo, thi, (v) => this.set({ trash_days: v }), 'ימי שמירה בסל המחזור'))}
      ${this.row('גרסאות לכל פריט', 'כולל שינויים שנעשו מחוץ למערכת', this.stepper('versions_keep', d.versions_keep, 'גרסאות', vlo, vhi, (v) => this.set({ versions_keep: v }), 'גרסאות לכל פריט'))}
      ${this.row('סל המחזור', `${this.trash.length} פריטים`, html`<sw-button size="sm" icon="trash" data-open-trash @click=${() => (this.trashOpen = true)}>פתח</sw-button>`)}
    </sw-card>`;
  }

  private limits(): TemplateResult {
    const l = this.draft.limits;
    const st = (k: LimKey, unit: string, min: number, max: number, label: string) => this.stepper(k, l[k], unit, min, max, (v) => this.setLimit(k, v), label);
    return html`<sw-card heading="מגבלות" data-card="limits">
      ${this.row('שמירות לדקה למשתמש', '', st('writes_per_min', '', 5, 120, 'שמירות לדקה'))}
      ${this.row('תצוגות מקדימות לדקה', '', st('preview_per_min', '', 10, 240, 'תצוגות מקדימות לדקה'))}
      ${this.row('הרצה חוזרת של אותו פריט', 'מרווח מינימלי', st('run_interval_s', 'שנ׳', 3, 60, 'מרווח הרצה'))}
      ${this.row('הפעלת סצנה חוזרת', '', st('scene_apply_interval_s', 'שנ׳', 1, 30, 'מרווח הפעלת סצנה'))}
      ${this.row('סערת הרצות · פריט', `התראה מעל ${l.storm_item_per_min} ריצות לדקה לפריט או ${l.storm_total_per_min} בסך הכל`, st('storm_item_per_min', '/דק׳', 5, 100, 'סף לפריט'))}
      ${this.row('סערת הרצות · סך הכל', '', st('storm_total_per_min', '/דק׳', 50, 1000, 'סף כולל'))}
      ${this.row('כיבוי אוטומטי בסערה', 'ברירת המחדל: התראה למנהל עם כיבוי בלחיצה', this.tog('כיבוי אוטומטי בסערה', this.draft.storm_auto_disable, (v) => this.set({ storm_auto_disable: v }), 'storm_auto_disable'))}
    </sw-card>`;
  }

  private sensitive(): TemplateResult {
    const approved = new Set(this.draft.notify_targets);
    return html`<sw-card heading="פעולות רגישות" data-card="sensitive">
      ${this.row('הכלל', 'אזעקה, מנעולים, דלתות, שערים וצופרים מותרים באוטומציות כמו כל פעולה, ועוברים את אותן בדיקות הרשאה כמו שליטה ידנית. קודים לעולם לא נשמרים.', html`<span class="tag ok"><sw-icon name="check" size=${12}></sw-icon>החלטת הבעלים</span>`)}
      ${this.row('צ׳יפ אזהרה על צעד רגיש', 'מוצג בעורך וברשימה', this.tog('צ׳יפ אזהרה על צעד רגיש', this.draft.sensitive_warning, (v) => this.set({ sensitive_warning: v }), 'sensitive_warning'))}
      ${this.row('צבע הצ׳יפ', 'צהוב או אדום', html`<div class="seg" role="group" aria-label="צבע הצ׳יפ"><button type="button" aria-pressed=${String(this.draft.sensitive_chip === 'amber')} data-sensitive-chip="amber" @click=${() => this.set({ sensitive_chip: 'amber' })}>צהוב</button><button type="button" aria-pressed=${String(this.draft.sensitive_chip === 'red')} data-sensitive-chip="red" @click=${() => this.set({ sensitive_chip: 'red' })}>אדום</button></div>`)}
      ${this.notify.length ? html`<div class="row"><div class="lbl"><span>יעדי התראה מאושרים</span><span class="muted">רק אליהם אפשר לשלוח התראה מאוטומציה</span></div><div class="chipsrow" role="group" aria-label="יעדי התראה">${this.notify.map((n) => {
        const on = approved.has(n.name);
        return html`<button type="button" class="rc" aria-pressed=${String(on)} data-notify=${n.action} @click=${() => this.set({ notify_targets: on ? this.draft.notify_targets.filter((x) => x !== n.name) : [...this.draft.notify_targets, n.name] })}>${on ? '✓ ' : ''}${n.name}</button>`;
      })}</div></div>` : nothing}
    </sw-card>`;
  }

  private gallery(): TemplateResult {
    const hidden = new Set(this.draft.templates_hidden);
    const order = this.orderedTemplates();
    return html`<sw-card heading="גלריית תבניות" data-card="templates">
      ${this.row('גלריה פעילה', 'מוצגת בלחיצה על "חדש"', this.tog('גלריה פעילה', this.draft.templates_enabled, (v) => this.set({ templates_enabled: v }), 'templates_enabled'))}
      ${order.map((t, i) => html`<div class=${`tpl${hidden.has(t.id) ? ' off' : ''}`} data-template=${t.id}>
        <span class="nm">${t.name}${t.suggest_schedule ? html` <span class="tag"><sw-icon name="calendar" size=${12}></sw-icon>גם כתזמון</span>` : nothing}</span>
        <button type="button" class="ib" aria-label=${`הקדם · ${t.name}`} data-template-up=${t.id} ?disabled=${i === 0} @click=${() => this.set({ templates_order: moveTemplate(order.map((x) => x.id), t.id, -1) })}>▲</button>
        <button type="button" class="ib" aria-label=${`אחר · ${t.name}`} data-template-down=${t.id} ?disabled=${i === order.length - 1} @click=${() => this.set({ templates_order: moveTemplate(order.map((x) => x.id), t.id, 1) })}>▼</button>
        ${this.tog(`הצגה · ${t.name}`, !hidden.has(t.id), () => this.set({ templates_hidden: toggleHidden(this.draft.templates_hidden, t.id) }), `tpl-${t.id}`)}
      </div>`)}
    </sw-card>`;
  }

  /** The gallery in the draft's order: the stored order first, the rest as the server lists them. */
  private orderedTemplates(): TplRef[] {
    const rank = new Map(this.draft.templates_order.map((id, i) => [id, i]));
    return [...this.templates].sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999));
  }

  private display(): TemplateResult {
    return html`<sw-card heading="הצגה" data-card="display">
      ${this.row('מסנן בטלפון', 'מקופל: "סינון" אחד · שורות: כל הבקרים מוצגים', html`<div class="seg" role="group" aria-label="מסנן בטלפון"><button type="button" aria-pressed=${String(this.draft.phone_filter === 'fold')} data-phone-filter="fold" @click=${() => this.set({ phone_filter: 'fold' })}>מקופל</button><button type="button" aria-pressed=${String(this.draft.phone_filter === 'rows')} data-phone-filter="rows" @click=${() => this.set({ phone_filter: 'rows' })}>שורות</button></div>`)}
      ${this.row('"+ חדש" אחד ששואל "מתי?"', '"בשעות קבועות" פותח תזמון חדש; "כשמשהו קורה" פותח את הבונה. כבוי = לכל לשונית הכפתור שלה.', this.tog('חדש ששואל מתי', this.draft.ask_when_on_new, (v) => this.set({ ask_when_on_new: v }), 'ask_when_on_new'))}
    </sw-card>`;
  }

  private platform(): TemplateResult | typeof nothing {
    const a = this.status?.admin;
    if (!a) return nothing;
    const bridgeOk = !!a.bridge_version && a.bridge_version >= a.bridge_required;
    return html`<sw-card heading="מצב" data-card="status">
      ${this.row('Home Assistant', `${a.ha_version} · ממשק התצורה ${a.config_api === 'ok' ? 'זמין' : 'לא זמין'}`, html`<span class=${`tag ${a.config_api === 'ok' ? 'ok' : 'warn'}`}>${a.config_api === 'ok' ? 'תקין' : 'לא זמין'}</span>`)}
      ${this.row('Arx Bridge', a.bridge_version ? `${a.bridge_version} (נדרש ${a.bridge_required}+)` : 'לא מותקן', html`<span class=${`tag ${bridgeOk ? 'ok' : 'warn'}`}>${bridgeOk ? 'תקין' : 'דורש עדכון'}</span>`)}
      ${this.status?.last_sync_at ? this.row('סנכרון אחרון', whenText(this.status.last_sync_at, this.now), nothing) : nothing}
      ${this.row('האוטומציות במוצר', 'כיבוי מסתיר את הלשונית לכולם', this.tog('האוטומציות במוצר', this.draft.enabled, (v) => this.set({ enabled: v }), 'enabled'))}
    </sw-card>`;
  }

  private reviewCard(): TemplateResult {
    return html`<sw-card heading="סקירה" data-card="review">
      ${this.review.length
        ? this.review.map((r) => html`<div class="rev" data-review=${`${r.kind}:${r.id}:${r.issue}`}><span class="tag warn">${REVIEW_LABEL[r.issue]}</span><a href=${`#/devices/automations/${r.kind === 'automation' ? '' : `${r.kind === 'script' ? 'scripts' : 'scenes'}/`}${encodeURIComponent(r.id)}`}>${r.name}</a><span class="muted">${r.detail}</span></div>`)
        : html`<div class="muted" data-review-empty>אין פריטים לסקירה</div>`}
    </sw-card>`;
  }

  /** HA 2026.10 compatibility (read-only scan of the mirror, `GET /automations/compat`): shown only when something was found. */
  private compatCard(): TemplateResult | typeof nothing {
    const scan = this.compat;
    if (!scan || !scan.items.length) return nothing;
    const href = (kind: string, id: string) => `#/devices/automations/${kind === 'automation' ? '' : `${kind === 'script' ? 'scripts' : 'scenes'}/`}${encodeURIComponent(id)}`;
    return html`<sw-card heading="תאימות לתשתית המערכת 2026.10" data-card="compat">
      <div class="muted" data-compat-summary>${scan.items.length === 1 ? 'פריט אחד דורש תיקון לפני השדרוג.' : `${scan.items.length} פריטים דורשים תיקון לפני השדרוג.`} הבדיקה קוראת בלבד.</div>
      ${scan.items.map((i) => html`<div class="rev" data-compat=${`${i.kind}:${i.id}`}>
        ${[...new Set(i.issues.map((x) => x.code))].map((code) => html`<span class="tag warn" data-compat-code=${code}>${COMPAT_LABEL[code]}</span>`)}
        <a href=${href(i.kind, i.id)}>${i.name}</a>
        <span class="muted">${i.issues.some((x) => x.code === 'admin_only_service')
          ? html`הפעלה ידנית תיכשל למי שאינו מנהל (<bdi>${i.issues.find((x) => x.service)?.service ?? ''}</bdi>)`
          : 'ייכשל בבדיקת התצורה ולא יפעל'}</span>
      </div>`)}
      ${scan.truncated ? html`<div class="muted">מוצגים הפריטים הראשונים בלבד.</div>` : nothing}
    </sw-card>`;
  }

  render() {
    if (this.phase === 'loading') return html`<sw-page heading="הגדרות › אוטומציות"><sw-state-panel state="loading"></sw-state-panel></sw-page>`;
    if (this.phase === 'error') return html`<sw-page heading="הגדרות › אוטומציות"><sw-state-panel state="error" hint=${this.error} actionLabel="נסו שוב" @action=${() => void this.load()}></sw-state-panel></sw-page>`;
    if (this.phase === 'forbidden') return html`<sw-page heading="הגדרות › אוטומציות"><sw-state-panel state="forbidden" heading="אין הרשאה" data-automations-settings-forbidden></sw-state-panel></sw-page>`;
    return html`<sw-page heading="הגדרות › אוטומציות" subheading="כל אפשרות של האוטומציות, הסצנות והסקריפטים נמצאת כאן בלבד." wide data-automations-settings>
      <div class="cols">
        <div class="col">${this.who()}${this.codeView()}${this.retention()}${this.display()}${this.platform()}</div>
        <div class="col">${this.compatCard()}${this.delegation()}${this.limits()}${this.sensitive()}${this.gallery()}${this.reviewCard()}</div>
      </div>
      ${this.dirty || this.note || this.error
        ? html`<div class="bar" data-settings-bar>
            ${this.error ? html`<span class="err" role="alert" data-settings-error>${this.error}</span>` : this.note ? html`<span class="ok" role="status" data-settings-saved>${this.note}</span>` : html`<span class="muted">יש שינויים שלא נשמרו.</span>`}
            <span style="flex:1"></span>
            ${this.dirty ? html`<sw-button variant="ghost" data-settings-cancel @click=${() => { this.draft = clone(this.saved); this.error = ''; }}>ביטול</sw-button><sw-button variant="primary" data-settings-save ?disabled=${this.busy} @click=${() => void this.save()}>${this.busy ? 'שומר…' : 'שמירה'}</sw-button>` : nothing}
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
