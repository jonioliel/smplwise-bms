import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-state-panel';
import {
  alarmConfig,
  alarmSettingsPatch,
  clearPanelCode,
  clearUserPin,
  deleteOverride,
  putOverride,
  setNotAlarm,
  setPanelCode,
  setUserAlarmPolicy,
  setUserPin,
  userAlarmPolicy,
  type AlarmConfig,
  type AlarmPanel,
  type AlarmZone,
  type CodePolicy,
  type UserAlarmPolicy,
} from '../api/alarm';
import { ApiError, describeError } from '../api/client';
import { noteAlarmPanels } from '../api/alarm-presence';
import { invalidateSettings } from '../api/prefs';
import { isApi, session } from '../api/session';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';

const STRATEGY: Record<string, string> = {
  device: 'אותו device',
  zone_id: 'מזהה אזור (unique id)',
  entity_id: 'שורש entity id',
  unique_id: 'שורש unique id',
  name: 'שם',
  zone_number: 'מספר אזור',
  override: 'שיוך ידני',
};

const shared = css`
  :host {
    display: block;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    align-items: center;
    justify-content: space-between;
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
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-medium);
    min-inline-size: 0;
    flex: 1 1 260px;
  }
  .muted {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-regular);
  }
  .ltr {
    direction: ltr;
    unicode-bidi: isolate;
    font-family: var(--sw-font-mono);
    font-size: var(--sw-fs-xs);
  }
  select,
  input {
    font: inherit;
    font-size: var(--sw-fs-sm);
    padding: 6px 8px;
    border: 1px solid var(--sw-border-strong);
    border-radius: var(--sw-r-sm);
    background: var(--sw-surface);
    color: var(--sw-text);
    max-inline-size: 100%;
  }
  input[type='password'] {
    direction: ltr;
    letter-spacing: 0.2em;
    inline-size: 140px;
  }
  .ok {
    color: #15803d;
    font-size: var(--sw-fs-sm);
  }
  .err {
    color: var(--sw-danger);
    font-size: var(--sw-fs-sm);
  }
  .inline {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
  }
`;

/** הגדרות › אבטחה › ניהול אזעקה (CR-010): the discovered panels and their integration, the write-only panel code, the zone ↔
 * bypass pairing with manual overrides, the unpaired controls, and the remote / code settings. A settings screen - the
 * technical names are shown here on purpose (docs/design/UI_COPY_RULES.md). */
@customElement('system-alarm-settings')
export class SystemAlarmSettings extends LitElement {
  /** 0.1.157: the bubble skin's chrome keys on the host's data-skin (styles/bubble-chrome.ts). */
  readonly bubbleSkin = new SkinController(this);
  @property({ type: Boolean }) canEdit = false;
  @state() private cfg: AlarmConfig | null = null;
  @state() private error = '';
  @state() private message = '';
  @state() private busy = false;
  @state() private codeDraft: Record<string, string> = {};

  static styles = [
    bubbleChrome,
    shared,
    css`
      .panels {
        display: grid;
        gap: 14px;
      }
      table {
        inline-size: 100%;
        border-collapse: collapse;
        font-size: var(--sw-fs-sm);
      }
      th,
      td {
        text-align: start;
        padding: 6px 6px;
        border-block-end: 1px solid var(--sw-border);
        vertical-align: middle;
      }
      th {
        color: var(--sw-text-3);
        font-weight: var(--sw-fw-medium);
        font-size: var(--sw-fs-xs);
      }
      .scroll {
        overflow-x: auto;
      }
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    if (!isApi()) return;
    try {
      this.cfg = await alarmConfig();
      noteAlarmPanels(this.cfg.panels.length); // the navigation's "is there a panel" answer, refreshed for free
      this.error = '';
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private async run(fn: () => Promise<unknown>, ok: string) {
    this.busy = true;
    this.message = '';
    this.error = '';
    try {
      await fn();
      this.message = ok;
      await this.load();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async setting(key: string, value: string) {
    await this.run(async () => {
      await alarmSettingsPatch({ [key]: value });
      invalidateSettings();
    }, 'נשמר');
  }

  render() {
    if (!isApi()) return html`<sw-card heading="אזעקה"><div class="muted">נתוני הדגמה: הגדרות האזעקה זמינות רק מול השרת.</div></sw-card>`;
    if (this.error && !this.cfg) return html`<sw-card heading="אזעקה"><sw-state-panel state="error" heading="לא ניתן לטעון את הגדרות האזעקה" hint=${this.error}></sw-state-panel></sw-card>`;
    if (!this.cfg) return html`<sw-card heading="אזעקה"><sw-state-panel state="loading"></sw-state-panel></sw-card>`;
    const c = this.cfg;
    const ro = !this.canEdit || this.busy;
    const s = c.settings;
    const yesNo = (key: string, on: boolean, yes: string, no: string, attr: string) => html`<select data-alarm-setting=${attr} ?disabled=${ro} @change=${(e: Event) => void this.setting(key, (e.target as HTMLSelectElement).value)}>
      <option value="true" ?selected=${on}>${yes}</option><option value="false" ?selected=${!on}>${no}</option></select>`;
    return html`<div class="panels" data-alarm-settings>
      <sw-card heading="אזעקה · מדיניות" subheading="מה מותר מחוץ לרשת המקומית (SmplWise Arx), ואיזה קוד מקליד משתמש שחייב קוד. ההרשאות (alarm.view / arm / disarm / bypass) נקבעות בתפקידים; המדיניות לכל משתמש - במשתמשים והרשאות.">
        <div class="row"><span class="lbl">שליטה מרחוק<span class="muted">alarm.remote_control - כבוי: אין דריכה, נטרול או עקיפה מחוץ לרשת המקומית.</span></span>${yesNo('alarm.remote_control', s.remote_control, 'מותרת', 'חסומה', 'remote_control')}</div>
        <div class="row"><span class="lbl">נטרול ועקיפה מרחוק<span class="muted">alarm.remote_disarm - כבוי: מבחוץ אפשר רק לדרוך ולהחזיר חיישן להגנה.</span></span>${yesNo('alarm.remote_disarm', s.remote_disarm, 'מותרים', 'חסומים', 'remote_disarm')}</div>
        <div class="row"><span class="lbl">ללא קוד גם מרחוק<span class="muted">alarm.remote_codeless - פעיל (ברירת מחדל, החלטת בעלים): משתמש "ללא קוד" דורך ומנטרל ללא קוד גם מבחוץ. נעילה ביומטרית קיימת רק באפליקציית האנדרואיד ורק אם הופעלה; בדפדפן אין נעילה כזו. כבוי: מבחוץ כל אחד מקליד קוד.</span></span>${yesNo('alarm.remote_codeless', s.remote_codeless, 'פעיל', 'כבוי', 'remote_codeless')}</div>
        <div class="row"><span class="lbl">הקוד שמקליד משתמש שחייב קוד<span class="muted">alarm.code_mode - קוד אישי (ברירת מחדל): לכל משתמש קוד Arx משלו, שמור כ-hash בלבד, והמערכת שולחת ללוח את קוד הלוח השמור; קוד הלוח: המשתמש מקליד את קוד הלוח עצמו.</span></span>
          <select data-alarm-setting="code_mode" ?disabled=${ro} @change=${(e: Event) => void this.setting('alarm.code_mode', (e.target as HTMLSelectElement).value)}>
            <option value="personal_pin" ?selected=${s.code_mode === 'personal_pin'}>קוד אישי לכל משתמש</option><option value="panel_code" ?selected=${s.code_mode === 'panel_code'}>קוד הלוח</option></select></div>
        ${this.message ? html`<div class="ok" role="status">${this.message}</div>` : nothing}${this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing}
      </sw-card>
      ${c.fallback_controls?.length || c.not_alarm?.length
        ? html`<sw-card heading="מתגים דמויי עקיפה ללא שיוך למערכת" subheading="מתגים עם סימן עקיפה (bypass) מאותה אינטגרציה כמו לוח אזעקה, שלא ידוע לאיזו התקנה שלה הם שייכים. הם מוחזקים כחלק מהאזעקה עד שמסמנים אותם 'אינו רכיב אזעקה'." data-fallback-controls>
            ${(c.fallback_controls ?? []).map((id) => this.renderNotAlarmRow(id, false, ro))}${(c.not_alarm ?? []).map((id) => this.renderNotAlarmRow(id, true, ro))}
          </sw-card>`
        : nothing}
      ${c.panels.length
        ? c.panels.map((p) => this.renderPanel(p, ro))
        : html`<sw-card heading="לא נמצא לוח אזעקה"><div class="muted">לא נמצאה ישות alarm_control_panel. חברו את האינטגרציה של מערכת האזעקה ב-Home Assistant (למשל Risco, Visonic, PIMA, Paradox), ואז רעננו.</div></sw-card>`}
    </div>`;
  }

  private renderPanel(p: AlarmPanel, ro: boolean) {
    const info = p.panel_code;
    const draft = this.codeDraft[p.entity_id] ?? '';
    const overrides = new Map((this.cfg?.overrides ?? []).map((o) => [o.zone_entity_id, o]));
    const controls = this.cfg?.candidates.controls ?? [];
    const otherPanels = (this.cfg?.panels ?? []).filter((x) => x.config_entry_id === p.config_entry_id && x.platform === p.platform);
    return html`<sw-card heading=${`${p.name}`} subheading=${`${p.integration} · ${p.entity_id}`} data-alarm-settings-panel=${p.entity_id}>
      <div class="row"><span class="lbl">שילוב<span class="muted">${p.integration_note || '—'} · config entry <span class="ltr">${p.config_entry_id ?? '—'}</span> · מצבי דריכה: ${p.arm_modes.join(', ')}${p.features_reported ? '' : ' (לא דווחו)'} · קוד: ${p.code_format ?? 'לא נדרש'}${p.code_format ? ` · קוד לדריכה: ${p.code_arm_required ? 'כן' : 'לא'}` : ''}</span></span></div>
      <div class="row"><span class="lbl">קוד הלוח<span class="muted">נשמר מוצפן (AES-GCM, מפתח בתיקיית הנתונים של התוסף), לא מוצג ולא יוצא מהמערכת. משמש לשליחה ללוח עבור משתמשים מורשים.${info?.set ? ` מוגדר · ${new Date(info.set_at ?? '').toLocaleString('he-IL')} · ${info.set_by ?? ''}` : ' לא מוגדר.'}</span></span>
        <span class="inline">
          <input type="password" inputmode=${p.code_format === 'number' ? 'numeric' : 'text'} autocomplete="new-password" maxlength="32" placeholder="קוד חדש" aria-label="קוד הלוח" data-panel-code-input ?disabled=${ro}
            .value=${draft} @input=${(e: Event) => (this.codeDraft = { ...this.codeDraft, [p.entity_id]: (e.target as HTMLInputElement).value })} />
          <sw-button size="sm" variant="primary" data-panel-code-save ?disabled=${ro || !draft} @click=${() => { const v = draft; this.codeDraft = { ...this.codeDraft, [p.entity_id]: '' }; void this.run(() => setPanelCode(p.entity_id, v), 'קוד הלוח נשמר'); }}>שמירה</sw-button>
          ${info?.set ? html`<sw-button size="sm" variant="ghost" data-panel-code-clear ?disabled=${ro} @click=${() => void this.run(() => clearPanelCode(p.entity_id), 'קוד הלוח נמחק')}>מחיקה</sw-button>` : nothing}
        </span></div>
      <div class="scroll"><table data-alarm-pairing>
        <thead><tr><th>חיישן</th><th>מתג עקיפה</th><th>שיוך לפי</th><th>לוח</th><th></th></tr></thead>
        <tbody>${p.zones.map((z) => this.renderZoneRow(p, z, overrides.get(z.entity_id), controls, otherPanels, ro))}</tbody>
      </table></div>
      ${p.unpaired_controls.length
        ? html`<div class="row" data-unpaired-controls><span class="lbl">ללא שיוך<span class="muted">מתגי עקיפה של המערכת שלא שויכו לחיישן. מתג שאינו חלק מהאזעקה: "אינו רכיב אזעקה" מחזיר אותו להיות מתג רגיל.</span></span></div>
            ${p.unpaired_controls.map((u) => this.renderNotAlarmRow(u.entity_id, false, ro))}`
        : nothing}
    </sw-card>`;
  }

  /** Final review item 3: "אינו רכיב אזעקה" releases a false positive (audited); "החזר לאזעקה" takes the mark back. */
  private renderNotAlarmRow(entityId: string, marked: boolean, ro: boolean) {
    return html`<div class="row" data-not-alarm-row=${entityId}><span class="lbl"><span class="ltr">${entityId}</span></span>
      <sw-button size="sm" variant="ghost" data-not-alarm=${entityId} ?disabled=${ro}
        @click=${() => void this.run(() => setNotAlarm(entityId, !marked), marked ? 'הסימון בוטל' : 'סומן כאינו רכיב אזעקה')}>${marked ? 'החזר לאזעקה' : 'אינו רכיב אזעקה'}</sw-button></div>`;
  }

  private renderZoneRow(p: AlarmPanel, z: AlarmZone, o: { bypass_entity_id: string | null; panel_entity_id: string | null } | undefined, controls: { entity_id: string; name: string }[], panels: AlarmPanel[], ro: boolean) {
    const current = z.bypass?.entity_id ?? '';
    const pairValue = o?.bypass_entity_id === '' ? '__none' : o?.bypass_entity_id ? o.bypass_entity_id : '__auto';
    return html`<tr data-pair-row=${z.entity_id}>
      <td>${z.name}<div class="ltr">${z.entity_id}</div></td>
      <td><select data-pair-select ?disabled=${ro} @change=${(e: Event) => {
        const v = (e.target as HTMLSelectElement).value;
        void this.run(async () => {
          if (v === '__auto') return deleteOverride(z.entity_id);
          const body = { bypass_entity_id: v === '__none' ? '' : v, panel_entity_id: o?.panel_entity_id ?? null };
          try {
            return await putOverride(z.entity_id, body);
          } catch (err) {
            // review L4: a switch with no bypass marker is paired only on an explicit confirmation
            if (err instanceof ApiError && err.body.code === 'not_bypass_like' && window.confirm(`הישות ${v} אינה נראית כמו מתג עקיפה. אחרי השיוך היא תופעל רק ממסך האזעקה ותיעלם מפעולות רגילות ומרוכזות. לשייך בכל זאת?`))
              return putOverride(z.entity_id, { ...body, confirm_not_bypass_like: true });
            throw err;
          }
        }, 'השיוך נשמר');
      }}>
        <option value="__auto" ?selected=${pairValue === '__auto'}>אוטומטי${current && pairValue === '__auto' ? ` (${current})` : ''}</option>
        <option value="__none" ?selected=${pairValue === '__none'}>ללא עקיפה</option>
        ${controls.map((cc) => html`<option value=${cc.entity_id} ?selected=${pairValue === cc.entity_id}>${cc.entity_id}</option>`)}
      </select></td>
      <td>${z.bypass ? STRATEGY[z.bypass.strategy] ?? z.bypass.strategy : '—'}</td>
      <td>${panels.length > 1
        ? html`<select data-zone-panel ?disabled=${ro} @change=${(e: Event) => {
            const v = (e.target as HTMLSelectElement).value;
            void this.run(() => putOverride(z.entity_id, { panel_entity_id: v || null, bypass_entity_id: o?.bypass_entity_id ?? null }), 'השיוך נשמר');
          }}><option value="" ?selected=${z.shared}>משותף</option>${panels.map((x) => html`<option value=${x.entity_id} ?selected=${!z.shared && x.entity_id === p.entity_id}>${x.name}</option>`)}</select>`
        : '—'}</td>
      <td><sw-button size="sm" variant="ghost" data-zone-exclude ?disabled=${ro} @click=${() => void this.run(() => putOverride(z.entity_id, { excluded: true }), 'החיישן הוצא מהרשימה')}>הוצא</sw-button></td>
    </tr>`;
  }
}

/** משתמשים והרשאות › משתמש (CR-010): who may arm / disarm without a code, and the user's personal PIN (set or clear -
 * the PIN itself is never shown). system.configure; everything audited server-side without the value. */
@customElement('system-alarm-user')
export class SystemAlarmUser extends LitElement {
  /** 0.1.157: the bubble skin's chrome keys on the host's data-skin (styles/bubble-chrome.ts). */
  readonly bubbleSkin = new SkinController(this);
  @property() userId = '';
  @property({ type: Boolean }) canEdit = false;
  @state() private pol: UserAlarmPolicy | null = null;
  @state() private error = '';
  @state() private message = '';
  @state() private busy = false;
  @state() private pin = '';
  /** Security review M3: administrators change their OWN policy / PIN only with their current PIN. */
  @state() private current = '';

  static styles = [bubbleChrome, shared];

  private get self(): boolean {
    return session.me?.user.id === this.userId;
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('userId') && this.userId && isApi()) void this.load();
  }

  private async load() {
    try {
      this.pol = await userAlarmPolicy(this.userId);
      this.error = '';
    } catch (err) {
      this.pol = null;
      this.error = describeError(err);
    }
  }

  private async run(fn: () => Promise<unknown>, ok: string) {
    this.busy = true;
    this.message = '';
    this.error = '';
    try {
      await fn();
      this.message = ok;
      await this.load();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  render() {
    if (!isApi()) return nothing;
    if (!this.pol) return this.error ? html`<div class="err">${this.error}</div>` : nothing;
    const p = this.pol;
    const ro = !this.canEdit || this.busy;
    const sel = (key: 'arm_policy' | 'disarm_policy', v: CodePolicy) => html`<select data-alarm-policy=${key} ?disabled=${ro} @change=${(e: Event) => void this.run(() => setUserAlarmPolicy(this.userId, { [key]: (e.target as HTMLSelectElement).value as CodePolicy, ...(this.self && this.current ? { current_pin: this.current } : {}) }), 'נשמר')}>
      <option value="code_required" ?selected=${v === 'code_required'}>חייב קוד</option><option value="no_code" ?selected=${v === 'no_code'}>ללא קוד</option></select>`;
    return html`<div data-alarm-user=${this.userId}>
      ${this.self
        ? html`<div class="row"><span class="lbl">הקוד האישי הנוכחי שלך<span class="muted">את המדיניות והקוד של עצמך משנים רק עם הקוד הנוכחי - או שמנהל מערכת אחר משנה אותם.</span></span>
            <input type="password" inputmode="numeric" autocomplete="one-time-code" maxlength="8" aria-label="הקוד האישי הנוכחי" data-user-pin-current .value=${this.current} @input=${(e: Event) => (this.current = (e.target as HTMLInputElement).value)} /></div>`
        : nothing}
      <div class="row"><span class="lbl">דריכה<span class="muted">ללא קוד: לחיצה אחת, והמערכת שולחת את קוד הלוח השמור</span></span>${sel('arm_policy', p.arm_policy)}</div>
      <div class="row"><span class="lbl">נטרול ועקיפה<span class="muted">עקיפת חיישן הולכת לפי מדיניות הנטרול</span></span>${sel('disarm_policy', p.disarm_policy)}</div>
      <div class="row"><span class="lbl">קוד אישי<span class="muted">${p.pin_set ? `מוגדר${p.pin_set_at ? ` · ${new Date(p.pin_set_at).toLocaleString('he-IL')}` : ''}${p.pin_set_by ? ` · ${p.pin_set_by}` : ''}` : 'לא מוגדר'} · 4–8 ספרות, נשמר כ-hash בלבד</span></span>
        <span class="inline"><input type="password" inputmode="numeric" autocomplete="new-password" maxlength="8" placeholder="קוד חדש" aria-label="קוד אישי" data-user-pin ?disabled=${ro} .value=${this.pin} @input=${(e: Event) => (this.pin = (e.target as HTMLInputElement).value)} />
          <sw-button size="sm" variant="primary" data-user-pin-save ?disabled=${ro || !/^\d{4,8}$/.test(this.pin)} @click=${() => { const v = this.pin; this.pin = ''; void this.run(() => setUserPin(this.userId, v, this.self ? this.current || undefined : undefined), 'הקוד האישי נשמר'); }}>שמירה</sw-button>
          ${p.pin_set ? html`<sw-button size="sm" variant="ghost" data-user-pin-clear ?disabled=${ro} @click=${() => void this.run(() => clearUserPin(this.userId), 'הקוד האישי נמחק')}>מחיקה</sw-button>` : nothing}</span></div>
      ${this.message ? html`<div class="ok" role="status">${this.message}</div>` : nothing}${this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-alarm-settings': SystemAlarmSettings;
    'system-alarm-user': SystemAlarmUser;
  }
}
