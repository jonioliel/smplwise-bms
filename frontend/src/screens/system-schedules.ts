import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-dialog';
import '../components/sw-button';
import '../components/sw-field';
import '../components/sw-icon';
import '../components/sw-toggle';
import '../components/sw-badge';
import '../components/sw-state-panel';
import { ApiError, patch } from '../api/client';
import { isApi } from '../api/session';
import { invalidateSettings, productSettings } from '../api/prefs';
import { navigate } from '../router';
import { scheduleErrorText } from './schedules-logic';
import { applySchedulesHidden } from '../shell/nav';
import { demoStore } from '../api/schedules-mock';
import {
  ALL_CLASSES,
  CLASS_LABEL,
  SCHEDULE_SETTINGS_DEFAULT,
  SENSITIVE_CLASSES,
  getConditionCandidates,
  getScheduleStatus,
  saveScheduleSettings,
  scheduleSettingsOf,
  scheduleSettingsPatch,
  whenLabel,
  type ConditionCandidate,
  type RepeatType,
  type ScheduleClass,
  type ScheduleSettings,
  type ScheduleStatus,
} from '../api/schedules';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';

/** The technical name of each class as the settings page shows it (a settings screen keeps the exact names). */
const CLASS_DOMAIN: Record<ScheduleClass, string> = {
  light: 'light',
  switch: 'switch',
  cover: 'cover',
  climate: 'climate',
  fan: 'fan',
  alarm: 'alarm_control_panel',
  lock: 'lock',
  door: 'cover · door layer',
};

const CLASS_NOTE: Partial<Record<ScheduleClass, string>> = {
  switch: 'רק מתגים שסומנו "בטוחים להפעלה מרוכזת"',
  cover: 'לא שערים, דלתות ומה שמסומן בשכבת הדלתות',
  alarm: 'דריכה ונטרול; דורש הרשאה לתזמון פעולות רגישות',
  lock: 'נעילה ופתיחה; דורש הרשאה לתזמון פעולות רגישות',
  door: 'דלתות ושערים; דורש הרשאה לתזמון פעולות רגישות',
};

const REPEAT_OPTIONS: { value: RepeatType; label: string }[] = [
  { value: 'repeat', label: 'חוזר' },
  { value: 'pause', label: 'פעם אחת ואז מושהה (נשמר)' },
  { value: 'single', label: 'פעם אחת ואז נמחק' },
];

const RETENTION = [30, 90, 180, 365];

/** "0.3.0" before "0.10.0": numeric, part by part. */
function versionLess(a: string, b: string): boolean {
  const pa = a.split('.').map((x) => parseInt(x, 10) || 0);
  const pb = b.split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d < 0;
  }
  return false;
}

/** The three permissions per built-in role, as the contract defaults (docs/architecture/SCHEDULER_API.md §4.1). Read only:
 * the owner grants them per user or role in משתמשים והרשאות. */
const ROLE_ROWS: { role: string; view: boolean; manage: boolean; sensitive: boolean; scoped?: boolean }[] = [
  { role: 'צופה', view: false, manage: false, sensitive: false },
  { role: 'מפעיל', view: false, manage: false, sensitive: false },
  { role: 'עורך מפות ותצוגות', view: false, manage: false, sensitive: false },
  { role: 'מנהל אתר / מבנה / קומה', view: true, manage: true, sensitive: false, scoped: true },
  { role: 'מנהל מערכת', view: true, manage: true, sensitive: true },
];

/**
 * CR-014 הגדרות › תזמונים (`#/system/schedules`): the connection to the scheduler component and the Arx bridge, the
 * feature switch (`schedules.enabled`), the Shabbat / holiday sensor the presets use, the editor's defaults, the device
 * classes that may be scheduled, and who may do what (read only, with the way to change it). system.configure only; the
 * server checks it again on every write. Exact technical names are allowed here (docs/design/UI_COPY_RULES.md: settings
 * screens keep them).
 */
@customElement('system-schedules')
export class SystemSchedules extends LitElement {
  /** 0.1.157: the bubble skin's chrome keys on the host's data-skin (styles/bubble-chrome.ts). */
  readonly bubbleSkin = new SkinController(this);
  @state() private status: ScheduleStatus | null = null;
  @state() private saved: ScheduleSettings = { ...SCHEDULE_SETTINGS_DEFAULT };
  @state() private draft: ScheduleSettings = { ...SCHEDULE_SETTINGS_DEFAULT };
  @state() private sensors: ConditionCandidate[] = [];
  @state() private error = '';
  @state() private note = '';
  @state() private busy = false;
  @state() private help = false;
  @state() private confirmSensor = false;
  @state() private loaded = false;
  private noteTimer = 0;

  static styles = [css`
    :host {
      display: block;
    }
    .cols {
      display: grid;
      grid-template-columns: minmax(0, 1.7fr) minmax(280px, 1fr);
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
    }
    .row:last-child {
      border-block-end: 0;
    }
    .lbl {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-inline-size: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
    }
    .muted {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      font-weight: var(--sw-fw-regular);
    }
    code,
    .mono {
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      direction: ltr;
      unicode-bidi: isolate;
    }
    .ic {
      display: grid;
      place-items: center;
      inline-size: 30px;
      block-size: 30px;
      border-radius: 9px;
      background: var(--sw-success-soft);
      color: #15803d;
      flex: none;
    }
    .ic.warn {
      background: var(--sw-stale-soft);
      color: #b45309;
    }
    .ic.mute {
      background: var(--sw-surface-3);
      color: var(--sw-text-3);
    }
    .ctl {
      min-inline-size: 180px;
      max-inline-size: 280px;
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
      min-block-size: 30px;
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
    ol {
      margin: 8px 0 0;
      padding-inline-start: 20px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .link {
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      background: none;
      border: 0;
      padding: 0;
      font-family: inherit;
    }
    table {
      inline-size: 100%;
      border-collapse: collapse;
      font-size: var(--sw-fs-sm);
    }
    th {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      font-weight: var(--sw-fw-medium);
      text-align: center;
      padding: 6px 4px;
      border-block-end: 1px solid var(--sw-border-strong);
    }
    th:first-child,
    td:first-child {
      text-align: start;
    }
    td {
      text-align: center;
      padding: 7px 4px;
      border-block-end: 1px solid var(--sw-border);
    }
    td.yes {
      color: #15803d;
    }
    td.no {
      color: var(--sw-text-3);
    }
    .bar {
      position: sticky;
      inset-block-end: 12px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-3);
      z-index: 3;
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    .ok {
      color: #15803d;
      font-size: var(--sw-fs-sm);
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

  private async load() {
    this.error = '';
    try {
      this.status = await getScheduleStatus();
      if (!this.status.can.configure) {
        this.loaded = true;
        return;
      }
      const current = isApi() ? scheduleSettingsOf((await productSettings(true)) as unknown as Record<string, unknown>) : { ...demoStore().settings, classes: [...demoStore().settings.classes] };
      // the sensor name the status carries is authoritative when the settings map has not been read yet
      this.saved = current;
      this.draft = { ...current, classes: [...current.classes] };
      try {
        this.sensors = (await getConditionCandidates({ domain: 'binary_sensor' })).entities;
      } catch {
        this.sensors = [];
      }
    } catch (err) {
      // /schedules/status answers only holders of schedule.view: without it this page has nothing to read
      if (err instanceof ApiError && err.status === 403) this.status = null;
      else this.error = scheduleErrorText(err);
    } finally {
      this.loaded = true;
    }
  }

  /** The sensor the draft picks is not one of the suggested (Jewish calendar / issur melacha) candidates. */
  private get unsuggestedPick(): ConditionCandidate | null {
    const id = this.draft.shabbatSensor;
    if (!id || id === this.saved.shabbatSensor) return null;
    const c = this.sensors.find((x) => x.entity_id === id);
    return !c || !c.suggested_shabbat ? (c ?? { entity_id: id, name: id, domain: 'binary_sensor', device_class: null, state: null, unit: null, numeric: false, suggested_shabbat: false }) : null;
  }

  /** Save: a sensor that is not a calendar sensor is confirmed first (`schedules.shabbat_sensor_force`, never stored). */
  private requestSave() {
    if (this.unsuggestedPick) this.confirmSensor = true;
    else void this.save(false);
  }

  /** The PATCH with the override flag: the typed client's `saveScheduleSettings` sends what differs, this adds the flag. */
  private async persist(force: boolean): Promise<ScheduleSettings> {
    if (!force || !isApi()) return saveScheduleSettings(this.saved, this.draft);
    const r = await patch<{ settings: Record<string, unknown> }>('settings', { ...scheduleSettingsPatch(this.saved, this.draft), 'schedules.shabbat_sensor_force': true });
    invalidateSettings();
    return scheduleSettingsOf(r.settings);
  }

  private get dirty(): boolean {
    const a = this.saved;
    const b = this.draft;
    return a.enabled !== b.enabled || a.snapMinutes !== b.snapMinutes || a.defaultRepeat !== b.defaultRepeat || a.runsRetentionDays !== b.runsRetentionDays || a.shabbatSensor !== b.shabbatSensor || JSON.stringify(a.classes) !== JSON.stringify(b.classes);
  }

  private patch(p: Partial<ScheduleSettings>) {
    this.draft = { ...this.draft, ...p };
    this.note = '';
  }

  private setClass(c: ScheduleClass, on: boolean) {
    const set = new Set(this.draft.classes);
    if (on) set.add(c);
    else set.delete(c);
    this.patch({ classes: ALL_CLASSES.filter((x) => set.has(x)) });
  }

  private async save(force: boolean) {
    this.busy = true;
    this.error = '';
    this.confirmSensor = false;
    try {
      const to = await this.persist(force);
      this.saved = to;
      this.draft = { ...to, classes: [...to.classes] };
      applySchedulesHidden({ 'schedules.enabled': String(to.enabled) }); // the "תזמונים" tab follows at once
      this.note = 'ההגדרות נשמרו.';
      window.clearTimeout(this.noteTimer);
      this.noteTimer = window.setTimeout(() => (this.note = ''), 4000);
      void getScheduleStatus().then((s) => (this.status = s)).catch(() => undefined);
    } catch (err) {
      this.error = scheduleErrorText(err);
      // the server does not take the sensor for a calendar one: the same confirmation, then the override
      if (err instanceof ApiError && err.code === 'not_calendar_sensor' && !force) this.confirmSensor = true;
    } finally {
      this.busy = false;
    }
  }

  private cancel() {
    this.draft = { ...this.saved, classes: [...this.saved.classes] };
    this.error = '';
  }

  // ---------------------------------------------------------------------------- render

  private renderConnection(s: ScheduleStatus) {
    const a = s.admin;
    const found = a?.component === 'found';
    const missing = a?.component === 'missing';
    const bridgeOld = !!a && !!a.bridge_version && versionLess(a.bridge_version, a.bridge_required);
    const bridgeMissing = !!a && !a.bridge_version;
    return html`<sw-card heading="חיבור" data-sched-connection>
      <div class="row">
        <span style="display:flex;gap:12px;align-items:center"><span class=${found ? 'ic' : missing ? 'ic warn' : 'ic mute'}><sw-icon name=${found ? 'check' : 'warning'} size=${16}></sw-icon></span>
          <span class="lbl">רכיב התזמונים (Scheduler)<span class="muted" data-component-line>${found ? `נמצא · גרסה ${a?.component_version ?? '?'} · דורש Home Assistant 2024.11.0 ומעלה${a?.ha_version ? ` · מותקן ${a.ha_version}` : ''}` : missing ? 'לא נמצא' : 'לא נבדק'}</span></span></span>
        <sw-button size="sm" icon="refresh" data-recheck @click=${() => void this.load()}>בדיקה מחדש</sw-button>
      </div>
      <div class="row">
        <span style="display:flex;gap:12px;align-items:center"><span class=${bridgeOld || bridgeMissing ? 'ic warn' : 'ic'}><sw-icon name=${bridgeOld || bridgeMissing ? 'warning' : 'check'} size=${16}></sw-icon></span>
          <span class="lbl">גשר Arx<span class="muted">${bridgeMissing ? `לא מותקן (נדרש ${a?.bridge_required ?? ''} ומעלה לשמירת תזמונים)` : `גרסה ${a?.bridge_version ?? '?'} (נדרש ${a?.bridge_required ?? '?'} ומעלה)${bridgeOld ? ' · נדרש עדכון של רכיב החיבור' : ''}`}</span></span></span>
      </div>
      <div class="row">
        <span style="display:flex;gap:12px;align-items:center"><span class="ic mute"><sw-icon name="clock" size=${16}></sw-icon></span>
          <span class="lbl">סנכרון אחרון<span class="muted">${s.last_sync_at ? whenLabel(s.last_sync_at) : 'עדיין לא'} · ${s.counts.visible} תזמונים${s.counts.hidden ? ` · ${s.counts.hidden} מוסתרים מהמשתמש הנוכחי` : ''}${s.stale ? ' · אין חיבור נוכחי' : ''}</span></span></span>
      </div>
      <button class="link" data-help-toggle @click=${() => (this.help = !this.help)}>הרכיב לא מותקן? הוראות התקנה ${this.help ? '▴' : '◂'}</button>
      ${this.help
        ? html`<ol data-help>
            <li>מתקינים את האינטגרציה המותאמת "Scheduler" (ב־HACS: "scheduler component"), או מעתיקים ידנית את התיקייה <code>custom_components/scheduler</code>.</li>
            <li>מפעילים מחדש את Home Assistant.</li>
            <li>בהגדרות › מכשירים ושירותים › הוספת אינטגרציה, בוחרים "Scheduler".</li>
            <li>דרושה גרסת Home Assistant 2024.11.0 ומעלה. אחרי ההתקנה לוחצים "בדיקה מחדש".</li>
          </ol>`
        : nothing}
    </sw-card>`;
  }

  private renderOperation() {
    const d = this.draft;
    const sensor = this.sensors.find((c) => c.entity_id === d.shabbatSensor);
    const known = !d.shabbatSensor || !!sensor;
    const suggested = this.sensors.filter((c) => c.suggested_shabbat);
    const others = this.sensors.filter((c) => !c.suggested_shabbat);
    return html`<sw-card heading="הפעלה" data-sched-operation>
      <div class="row"><span class="lbl">הצגת הטאב "תזמונים" במסך הראשי<span class="muted">כבוי = הטאב אינו מוצג לאף משתמש והתזמונים ממשיכים לפעול ברכיב</span></span><sw-toggle label="הצגת הטאב תזמונים" labelHidden .checked=${d.enabled} data-set-enabled @change=${(e: CustomEvent<{ checked: boolean }>) => this.patch({ enabled: e.detail.checked })}></sw-toggle></div>
      <div class="row">
        <span class="lbl">חיישן שבת וחג<span class="muted">${sensor?.state ? `מצב נוכחי: ${sensor.state === 'on' ? 'איסור מלאכה בתוקף' : sensor.state === 'off' ? 'איסור מלאכה אינו בתוקף' : sensor.state}` : 'משמש את התבניות "רק בשבת ובחג" ו"לא בשבת ובחג"'}</span></span>
        <sw-field class="ctl"><select aria-label="חיישן שבת וחג" data-shabbat-sensor @change=${(e: Event) => this.patch({ shabbatSensor: (e.target as HTMLSelectElement).value })}>
          <option value="" .selected=${!d.shabbatSensor}>ללא חיישן</option>
          ${!known ? html`<option value=${d.shabbatSensor} selected>${d.shabbatSensor} (לא נמצא)</option>` : nothing}
          ${suggested.length ? html`<optgroup label="לוח שנה יהודי (מומלצים)">${suggested.map((c) => html`<option value=${c.entity_id} .selected=${c.entity_id === d.shabbatSensor}>${c.name}</option>`)}</optgroup>` : nothing}
          ${others.length ? html`<optgroup label="חיישנים אחרים">${others.map((c) => html`<option value=${c.entity_id} .selected=${c.entity_id === d.shabbatSensor}>${c.name}</option>`)}</optgroup>` : nothing}
        </select></sw-field>
      </div>
    </sw-card>`;
  }

  private renderClasses() {
    const d = this.draft;
    return html`<sw-card heading="סוגי התקנים מותרים בתזמון" data-sched-classes>
      ${ALL_CLASSES.map(
        (c) => html`<div class="row"><span class="lbl">${CLASS_LABEL[c]}<span class="muted"><code>${CLASS_DOMAIN[c]}</code>${CLASS_NOTE[c] ? ` · ${CLASS_NOTE[c]}` : ''}</span></span>
          <span style="display:flex;gap:10px;align-items:center">${SENSITIVE_CLASSES.includes(c) ? html`<sw-badge kind="stale" label="רגיש"></sw-badge>` : nothing}<sw-toggle label=${CLASS_LABEL[c]} labelHidden .checked=${d.classes.includes(c)} data-class=${c} @change=${(e: CustomEvent<{ checked: boolean }>) => this.setClass(c, e.detail.checked)}></sw-toggle></span></div>`,
      )}
    </sw-card>`;
  }

  private renderDefaults() {
    const d = this.draft;
    const retention = RETENTION.includes(d.runsRetentionDays) ? RETENTION : [...RETENTION, d.runsRetentionDays].sort((a, b) => a - b);
    return html`<sw-card heading="ברירות מחדל לעורך" data-sched-defaults>
      <div class="row"><span class="lbl">הצמדת זמן</span><span class="seg" role="group" aria-label="הצמדת זמן">${([5, 15, 30] as const).map((m) => html`<button type="button" data-snap=${m} aria-pressed=${d.snapMinutes === m} @click=${() => this.patch({ snapMinutes: m })}>${m} דק׳</button>`)}</span></div>
      <div class="row"><span class="lbl">סוג חזרה</span><sw-field class="ctl"><select aria-label="סוג חזרה" data-default-repeat @change=${(e: Event) => this.patch({ defaultRepeat: (e.target as HTMLSelectElement).value as RepeatType })}>${REPEAT_OPTIONS.map((o) => html`<option value=${o.value} .selected=${o.value === d.defaultRepeat}>${o.label}</option>`)}</select></sw-field></div>
      <div class="row"><span class="lbl">שמירת הרצות אחרונות</span><sw-field class="ctl"><select aria-label="שמירת הרצות אחרונות" data-retention @change=${(e: Event) => this.patch({ runsRetentionDays: Number((e.target as HTMLSelectElement).value) })}>${retention.map((n) => html`<option value=${n} .selected=${n === d.runsRetentionDays}>${n} ימים</option>`)}</select></sw-field></div>
    </sw-card>`;
  }

  private renderRoles() {
    const cell = (on: boolean, scoped = false) => html`<td class=${on ? 'yes' : 'no'}>${on ? html`<sw-icon name="check" size=${14}></sw-icon>${scoped ? html`<span class="muted"> בהיקף</span>` : nothing}` : '—'}</td>`;
    return html`<sw-card heading="מי רשאי מה" data-sched-roles>
      <table><thead><tr><th>תפקיד</th><th>צפייה</th><th>ניהול</th><th>רגיש</th></tr></thead>
        <tbody>${ROLE_ROWS.map((r) => html`<tr><td>${r.role}</td>${cell(r.view)}${cell(r.manage, r.scoped)}${cell(r.sensitive)}</tr>`)}</tbody></table>
      <p class="muted" style="margin:10px 0 8px">ברירות המחדל. ניהול תזמונים ותזמון פעולות רגישות (אזעקה, מנעולים, דלתות ושערים) ניתנים במפורש לכל משתמש או תפקיד, בהיקף שבחרתם.</p>
      <sw-button size="sm" data-open-access @click=${() => navigate('/system/access')}>משתמשים והרשאות</sw-button>
    </sw-card>`;
  }

  render() {
    if (!this.loaded) return html`<sw-page heading="תזמונים"><sw-state-panel state="loading"></sw-state-panel></sw-page>`;
    if (this.error && !this.status) return html`<sw-page heading="תזמונים"><sw-state-panel state="error" hint=${this.error} actionLabel="נסו שוב" @action=${() => void this.load()}></sw-state-panel></sw-page>`;
    const s = this.status;
    if (!s || !s.can.configure) return html`<sw-page heading="תזמונים"><sw-state-panel state="forbidden" data-schedules-settings-forbidden></sw-state-panel></sw-page>`;
    const pick = this.unsuggestedPick;
    return html`<sw-page heading="הגדרות › תזמונים" subheading="רק למנהל מערכת. מסך התזמונים של המשתמשים אינו מציג הגדרות אלה." wide data-schedules-settings>
      ${this.confirmSensor
        ? html`<sw-dialog open heading="חיישן שבת וחג" data-sensor-confirm @close=${() => (this.confirmSensor = false)}>
            <p style="margin:0;font-size:var(--sw-fs-sm)">חיישן שאינו לוח שנה יהודי - להשתמש בו בכל זאת?${pick ? html`<br /><b>${pick.name}</b> <code>${pick.entity_id}</code>` : nothing}</p>
            <sw-button slot="footer" variant="ghost" data-sensor-cancel @click=${() => (this.confirmSensor = false)}>ביטול</sw-button>
            <sw-button slot="footer" variant="primary" data-sensor-force @click=${() => void this.save(true)}>כן, להשתמש בו</sw-button>
          </sw-dialog>`
        : nothing}
      <div class="cols">
        <div class="col">${this.renderConnection(s)}${this.renderOperation()}${this.renderClasses()}</div>
        <div class="col">${this.renderDefaults()}${this.renderRoles()}</div>
      </div>
      ${this.dirty || this.note || this.error
        ? html`<div class="bar" data-settings-bar>
            ${this.error ? html`<span class="err" role="alert" data-settings-error>${this.error}</span>` : this.note ? html`<span class="ok" role="status" data-settings-saved>${this.note}</span>` : html`<span class="muted">יש שינויים שלא נשמרו.</span>`}
            <span style="flex:1"></span>
            ${this.dirty ? html`<sw-button variant="ghost" data-settings-cancel @click=${() => this.cancel()}>ביטול</sw-button><sw-button variant="primary" data-settings-save ?disabled=${this.busy} @click=${() => this.requestSave()}>${this.busy ? 'שומר…' : 'שמירה'}</sw-button>` : nothing}
          </div>`
        : nothing}
    </sw-page>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-schedules': SystemSchedules;
  }
}
