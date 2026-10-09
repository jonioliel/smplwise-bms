import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-toggle';
import '../components/sw-field';
import { describeError } from '../api/client';
import {
  RETENTION_CHOICES, SENSOR_KEYS, SENSOR_LABEL, breakGlass, getPresenceSettings, listPresenceDevices, policyProblem, putPresenceSettings,
  type PresenceDevice, type PresenceSettings, type SensorKey,
} from '../api/presence';
import { can, isApi } from '../api/session';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';

const DEMO: PresenceSettings = {
  enabled: false, mode: 'continuous', interval_s: 60, distance_filter_m: 50, notice_text: '', notice_version: 1, sensors_allowed: [...SENSOR_KEYS], intervals_s: {},
  sites: [], beacons: [], wifi_sites: [], retention_days: 30, required_sensors: { enabled: false, sensors: [], apply_to_web: false, max_stale_hours: 48, roles: [], users: [], exempt_users: [] },
  break_glass: { until: null, reason: '', by: null },
};

/**
 * CR-027: הגדרות › אפליקציה לנייד. The administrator's side of the phone app's data sharing (system.configure): the master
 * switch (off by default: the phones collect nothing and ask for no permission), which sensors the installation allows, the
 * employee notice (its version rises by itself when the text changes; every phone must acknowledge the new version), the
 * required-sensors policy with its break-glass, retention of the event log, and the registered devices (presence.sensors.view).
 * Short confirmations only; the explanations live in the change request. Without a backend the defaults are shown read-only.
 */
@customElement('system-presence')
export class SystemPresence extends LitElement {
  /** 0.1.157: the bubble skin's chrome keys on the host's data-skin (styles/bubble-chrome.ts). */
  readonly bubbleSkin = new SkinController(this);
  @state() private draft: PresenceSettings = DEMO;
  @state() private saved: PresenceSettings = DEMO;
  @state() private canEdit = false;
  @state() private busy = false;
  @state() private message = '';
  @state() private error = '';
  @state() private devices: PresenceDevice[] | null = null;
  @state() private glassReason = '';

  static styles = [css`
    :host {
      display: grid;
      gap: 12px;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .row:last-of-type {
      border-block-end: 0;
    }
    .lbl {
      font-weight: var(--sw-fw-medium);
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .muted {
      color: var(--sw-text-muted);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-regular);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 6px 16px;
      padding: 8px 0;
    }
    .chk {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 36px;
    }
    textarea {
      width: 100%;
      min-height: 120px;
      resize: vertical;
      font: inherit;
      padding: 8px 10px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-radius-sm, 8px);
      background: var(--sw-surface);
      color: inherit;
      box-sizing: border-box;
    }
    .foot {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
      margin-block-start: 12px;
    }
    .ok {
      color: var(--sw-live);
      font-size: var(--sw-fs-sm);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    .warn {
      color: var(--sw-warning);
      font-size: var(--sw-fs-sm);
    }
    .glass {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }
    .glass input {
      flex: 1 1 200px;
      min-width: 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--sw-fs-sm);
    }
    th,
    td {
      text-align: start;
      padding: 6px 8px;
      border-block-end: 1px solid var(--sw-border);
      vertical-align: top;
    }
    th {
      color: var(--sw-text-muted);
      font-weight: var(--sw-fw-medium);
    }
    .wrap {
      overflow-x: auto;
    }
    @media (max-width: 767px) {
      .row {
        flex-direction: column;
        align-items: stretch;
      }
      .row > :not(.lbl) {
        align-self: flex-end;
      }
    }
  `, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
    if (isApi()) {
      void getPresenceSettings()
        .then((r) => {
          this.saved = r.settings;
          this.draft = structuredClone(r.settings);
          this.canEdit = true;
        })
        .catch((err) => {
          this.canEdit = false;
          if (!(err instanceof Error && /403|אין הרשאה/.test(err.message))) this.error = describeError(err);
        });
      if (can('presence.sensors.view')) {
        void listPresenceDevices()
          .then((r) => (this.devices = r.devices))
          .catch(() => (this.devices = []));
      }
    }
  }

  private get dirty(): boolean {
    return JSON.stringify(this.draft) !== JSON.stringify(this.saved);
  }

  private patch(p: Partial<PresenceSettings>) {
    this.draft = { ...this.draft, ...p };
    this.message = '';
  }

  private toggleSensor(key: SensorKey, on: boolean) {
    const set = new Set(this.draft.sensors_allowed);
    if (on) set.add(key);
    else set.delete(key);
    this.patch({ sensors_allowed: SENSOR_KEYS.filter((k) => set.has(k)) });
  }

  private toggleRequired(key: SensorKey, on: boolean) {
    const set = new Set(this.draft.required_sensors.sensors);
    if (on) set.add(key);
    else set.delete(key);
    this.patch({ required_sensors: { ...this.draft.required_sensors, sensors: SENSOR_KEYS.filter((k) => set.has(k)) } });
  }

  private async save() {
    const problem = policyProblem(this.draft);
    if (problem && this.draft.required_sensors.enabled && this.draft.required_sensors.sensors.length === 0) {
      this.error = problem;
      return;
    }
    this.busy = true;
    this.error = '';
    try {
      const d = this.draft;
      const r = await putPresenceSettings({
        enabled: d.enabled, notice_text: d.notice_text, sensors_allowed: d.sensors_allowed, retention_days: d.retention_days,
        required_sensors: d.required_sensors,
      });
      this.saved = r.settings;
      this.draft = structuredClone(r.settings);
      this.message = 'ההגדרות נשמרו';
      setTimeout(() => (this.message = ''), 2500);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async glass(hours: number) {
    this.busy = true;
    this.error = '';
    try {
      const r = await breakGlass(hours, this.glassReason);
      this.saved = { ...this.saved, break_glass: r.break_glass };
      this.draft = { ...this.draft, break_glass: r.break_glass };
      this.glassReason = '';
      this.message = hours ? 'הדרישה הושעתה' : 'ההשעיה הסתיימה';
      setTimeout(() => (this.message = ''), 2500);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private renderDevices() {
    if (this.devices === null) return nothing;
    const fmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }) : '—');
    return html`<sw-card heading="מכשירים רשומים" subheading=${this.devices.length ? `${this.devices.length} מכשירים` : 'אין מכשירים רשומים'} data-presence-devices>
      ${this.devices.length
        ? html`<div class="wrap"><table>
            <thead><tr><th>משתמש</th><th>מכשיר</th><th>משתף</th><th>במבנה</th><th>דיווח אחרון</th><th>התראות</th></tr></thead>
            <tbody>${this.devices.map((d) => html`<tr data-presence-device=${d.device_id}>
              <td>${d.user?.display_name ?? ''}</td>
              <td>${d.name}<div class="muted">${d.platform === 'ios' ? 'iPhone' : 'Android'} · ${d.app_version ?? ''}</div></td>
              <td>${SENSOR_KEYS.filter((k) => d.status.sensors[k] === 'on').map((k) => SENSOR_LABEL[k]).join(', ') || '—'}</td>
              <td>${d.presence.inside === true ? 'כן' : d.presence.inside === false ? 'לא' : '—'}</td>
              <td>${fmt(d.last_event_at ?? d.last_seen_at)}</td>
              <td>${d.push.registered ? 'רשום' : '—'}</td>
            </tr>`)}</tbody>
          </table></div>`
        : nothing}
    </sw-card>`;
  }

  render() {
    const editable = this.canEdit && isApi();
    const d = this.draft;
    const req = d.required_sensors;
    const problem = policyProblem(d);
    const glass = d.break_glass.until ? new Date(d.break_glass.until).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }) : null;
    return html`<sw-card heading="שיתוף נתונים מהאפליקציה" subheading="כבוי כברירת מחדל; הטלפונים לא אוספים דבר עד ההפעלה" data-presence-card>
        <div class="row" data-presence-row="enabled"><span class="lbl">שיתוף פעיל<span class="muted">מופעל רק אחרי שההודעה לעובדים נשלחה</span></span>
          <sw-toggle ?checked=${d.enabled} ?disabled=${!editable || this.busy} label="שיתוף פעיל" labelHidden data-presence-enabled @change=${(e: CustomEvent<{ checked: boolean }>) => this.patch({ enabled: e.detail.checked })}></sw-toggle></div>
        <div class="row" data-presence-row="sensors"><span class="lbl">חיישנים מאושרים<span class="muted">העובד בוחר באפליקציה מתוך הרשימה הזו בלבד</span></span></div>
        <div class="grid" data-presence-sensors>${SENSOR_KEYS.map((k) => html`<label class="chk"><input type="checkbox" data-presence-sensor=${k} .checked=${d.sensors_allowed.includes(k)} ?disabled=${!editable || this.busy} @change=${(e: Event) => this.toggleSensor(k, (e.target as HTMLInputElement).checked)} /> ${SENSOR_LABEL[k]}</label>`)}</div>
        <div class="row" data-presence-row="notice"><span class="lbl">הודעה לעובדים<span class="muted">גרסה ${d.notice_version}; שינוי בטקסט מעלה את הגרסה וכל מכשיר מאשר מחדש</span></span></div>
        <textarea data-presence-notice placeholder="טקסט ההודעה לעובדים (ניסוח משפטי של בעל המערכת)" .value=${d.notice_text} ?disabled=${!editable || this.busy} @input=${(e: Event) => this.patch({ notice_text: (e.target as HTMLTextAreaElement).value })}></textarea>
        <div class="row" data-presence-row="retention"><span class="lbl">שמירת יומן הדיווחים</span>
          <sw-field><select data-presence-retention ?disabled=${!editable || this.busy} @change=${(e: Event) => this.patch({ retention_days: Number((e.target as HTMLSelectElement).value) })}>
            ${RETENTION_CHOICES.map((n) => html`<option value=${n} ?selected=${d.retention_days === n}>${n} ימים</option>`)}
          </select></sw-field></div>
      </sw-card>
      <sw-card heading="חיישנים נדרשים לשימוש מהאפליקציה" subheading="מי שלא הפעיל חיישן נדרש לא ייכנס מהאפליקציה; מנהלי מערכת לעולם לא נחסמים" data-presence-policy>
        <div class="row" data-presence-row="policy"><span class="lbl">הדרישה פעילה<span class="muted">חלה על הפעלות מהאפליקציה בלבד, אלא אם סומן אחרת</span></span>
          <sw-toggle ?checked=${req.enabled} ?disabled=${!editable || this.busy} label="הדרישה פעילה" labelHidden data-presence-policy-enabled @change=${(e: CustomEvent<{ checked: boolean }>) => this.patch({ required_sensors: { ...req, enabled: e.detail.checked } })}></sw-toggle></div>
        <div class="grid" data-presence-required>${SENSOR_KEYS.map((k) => html`<label class="chk"><input type="checkbox" data-presence-required-sensor=${k} .checked=${req.sensors.includes(k)} ?disabled=${!editable || this.busy || !req.enabled} @change=${(e: Event) => this.toggleRequired(k, (e.target as HTMLInputElement).checked)} /> ${SENSOR_LABEL[k]}</label>`)}</div>
        <div class="row" data-presence-row="web"><span class="lbl">גם בדפדפן<span class="muted">משתמש בלי האפליקציה ייחסם גם בדפדפן</span></span>
          <sw-toggle ?checked=${req.apply_to_web} ?disabled=${!editable || this.busy || !req.enabled} label="גם בדפדפן" labelHidden data-presence-policy-web @change=${(e: CustomEvent<{ checked: boolean }>) => this.patch({ required_sensors: { ...req, apply_to_web: e.detail.checked } })}></sw-toggle></div>
        ${problem && req.enabled ? html`<div class="warn" role="status" data-presence-policy-problem>${problem}</div>` : nothing}
        ${editable
          ? html`<div class="row" data-presence-row="glass"><span class="lbl">השעיה זמנית<span class="muted">${glass ? `מושעה עד ${glass}${this.saved.break_glass.reason ? ` · ${this.saved.break_glass.reason}` : ''}` : 'פותח את הכניסה לכולם ל־24 שעות, עם סיבה'}</span></span>
              <span class="glass">${glass
                ? html`<sw-button size="sm" data-presence-glass-end ?disabled=${this.busy} @click=${() => void this.glass(0)}>סיים השעיה</sw-button>`
                : html`<input type="text" data-presence-glass-reason placeholder="סיבה" maxlength="200" .value=${this.glassReason} @input=${(e: Event) => (this.glassReason = (e.target as HTMLInputElement).value)} /><sw-button size="sm" data-presence-glass ?disabled=${this.busy || this.glassReason.trim().length < 3} @click=${() => void this.glass(24)}>השעה ל־24 שעות</sw-button>`}</span></div>`
          : nothing}
        ${editable
          ? html`<div class="foot">
              <sw-button variant="primary" size="sm" icon="check" data-presence-save ?disabled=${!this.dirty || this.busy} @click=${() => void this.save()}>שמור</sw-button>
              ${this.message ? html`<span class="ok" role="status" data-presence-message>${this.message}</span>` : nothing}
              ${this.error ? html`<span class="err" role="alert" data-presence-error>${this.error}</span>` : nothing}
            </div>`
          : nothing}
      </sw-card>
      ${this.renderDevices()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-presence': SystemPresence;
  }
}
