import { uiLocale } from '../i18n/locale';
import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-field';
import '../components/sw-icon';
import '../components/sw-state-panel';
import { can, installationSupported, isApi, nvrLess } from '../api/session';
import { UNSUPPORTED_NVR_WITHOUT_GO2RTC } from '../api/capabilities';
import { ApiError, get, describeError } from '../api/client';
import './system-doors'; // CR-033: station placement + door map cards
import './wiskey-relay-map'; // WISKEY-RELAYMAP-2310: the WisKey relay map approval (api relay -> physical relay per station)
import './system-door-blocks'; // WXUNBLK: what the door path blocks, and the one audited release per virtual device
import './system-emergency-open'; // EMROLE-295: the emergency-open role's settings (expiry, who may give it, retry by holders)
import { clearIntercomCredentials, getIntercomCredentials, setIntercomCredentials, type IntercomCredentialsList, type IntercomStationCredentials } from '../api/intercom';
import { listCameras } from '../api/maps';
import { healthReport, type HealthReport } from '../api/health';
import { listNvrChanges, notifyStatus, nvrSystemApi, rollbackNvrChange, setNotify, type NotifyStatus, type NvrChange, type NvrSystem } from '../api/nvr';
import { physicalOutcome } from '../api/physical-outcome';
import { confirmDialog } from '../components/confirm-dialog';
import { focusIfLost } from '../components/focus-return';
import '../components/sw-dialog';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { settingsStyles } from '../styles/settings';
import '../components/nvr-connection-form';
import '../components/nvr-recorders-card';
import '../components/frigate-summary';
import '../components/sw-secrets-card'; // TKSECRETS2: הגדרות › חיבורים › סודות
import '../components/sw-table';
import type { TableColumn } from '../components/sw-table';
import '../components/sw-bridge-key-card'; // CR-WISKEY-HMAC-ROTATION-295: הגדרות › חיבורים › מפתח הגשר (system administrator)
import '../components/sw-partner-api-card'; // PARTNERAPI113-295: הגדרות › חיבורים › ממשק לשותפים (partner.manage, system administrator)
import { tr } from '../i18n/msg/system-b';

/** GET /api/v1/health — the add-on's own connection facts (no device probe, every signed-in user). */
interface RawHealth {
  status: string;
  version: string;
  db: { ok: boolean; permission_revision: number };
  data_dir_writable: boolean;
  nvr_configured: boolean;
  go2rtc_configured: boolean;
  discovery: { cameras_last_ok: string | null; cameras_last_error: string | null; cameras_last_run: string | null; streams_last_ok: string | null; streams_last_error: string | null; last_reason: string | null; cameras: number; interval_s: number };
  events: { ingest: { connected: boolean; last_heartbeat_at: string | null; last_event_at: string | null; last_error: string | null; reconnects: number; events_stored: number; started_at: string | null }; derive: { last_run: string | null; last_ok: string | null; last_error: string | null; derived: number }; stored: number };
  home_assistant: { configured: boolean; connected: boolean; last_snapshot_at: string | null; last_event_at: string | null; last_registry_at: string | null; last_error: string | null; reconnects: number; sequence: number; entities: number; started_at: string | null; ha_version: string | null };
  identity_source: string;
  renderer: string | null;
  /** NVR-less mode (Home Assistant only) */
  mode?: 'full' | 'ha_only';
}

const OPTIONS: { key: string; label: string }[] = [
  { key: 'go2rtc_url', label: tr('כתובת go2rtc') },
  { key: 'go2rtc_api_username', label: tr('משתמש go2rtc (אם מוגן)') },
  { key: 'wiskey_username', label: tr('משתמש עמדות WisKey (מצלמות)') },
  // TKSECRETS2: the go2rtc / WisKey passwords are no add-on options any more - they are in the "סודות" card
  { key: 'bootstrap_admin_username', label: tr('שם משתמש של המנהל הראשון') },
  { key: 'log_level', label: tr('רמת לוג') },
];

function when(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString(uiLocale(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** הגדרות › חיבורים (0.1.50, F6): the add-on's connection facts and the approved NVR writes. The onboarding wizard
 * (SC26) is system-wizard.ts since T071. */
@customElement('system-setup')
export class SystemSetup extends LitElement {
  /** 0.1.157: the bubble skin's chrome keys on the host's data-skin (styles/bubble-chrome.ts). */
  readonly bubbleSkin = new SkinController(this);
  @state() private raw: RawHealth | null = null;
  @state() private report: HealthReport | null = null;
  @state() private recorder: { model: string | null; firmware: string | null; name: string; last_seen_at: string | null } | null = null;
  @state() private error = '';
  @state() private busy = false;
  /** NVR writes (0.1.64): the notify matrix, the pending confirmation, the last result and the change log. */
  @state() private notify: NotifyStatus | null = null;
  @state() private notifyError = '';
  @state() private notifyPlan: { channels: number[] | null; smart: boolean; enabled: boolean; label: string } | null = null;
  @state() private notifyBusy = false;
  @state() private notifyResult = '';
  // 0.1.71: system card + connection editor
  @state() private sys: NvrSystem | null = null;
  /** CR-024: the recorder the NVR system card reads and acts on (a selector appears with two or more recorders). */
  @state() private sysRecorder = 'nvr-1';
  @state() private sysRecorders: { id: string; name: string; vendor?: string | null }[] = [];
  private get sysApi() {
    return nvrSystemApi(this.sysRecorder);
  }
  @state() private sysError = '';
  @state() private sysMsg = '';
  @state() private sysBusy = false;
  @state() private ntpForm: { host: string; port: number; interval_min: number } | null = null;
  @state() private rebootWord = '';
  @state() private rebootOpen = false;
  @state() private changes: NvrChange[] = [];
  /** WisKey station RTSP accounts (0.1.109 API; this screen is the follow-up): the list is loaded only for a system
   * administrator; the form never holds a stored value, only what is being typed. */
  @state() private wiskey: IntercomCredentialsList | null = null;
  @state() private wiskeyError = '';
  @state() private wiskeyForm: { station_id: string; username: string; password: string } | null = null;
  @state() private wiskeyClear: IntercomStationCredentials | null = null;
  @state() private wiskeyMsg = '';
  @state() private wiskeyBusy = false;
  /** SETUPPLAN-POLISH-2331: the tone of the three result lines (sysMsg, notifyResult, wiskeyMsg) - set with the text, never guessed from it. */
  /** true = ok, false = failed (red), 'warn' = a physical action whose outcome is unknown (amber; PHYSICAL-CONFIRM-2540). */
  @state() private sysOk: boolean | 'warn' = true;
  /** 'warn' (amber): a revert the server refused without writing anything (LISTENER-DEADLINE-2540). */
  @state() private notifyOk: boolean | 'warn' = true;
  @state() private wiskeyOk = true;

  /** A result line in the settings vocabulary (.msg: a tinted pill with its icon; styles/settings.ts), the screen's hook kept. */
  private static statusLine(text: string, ok: boolean | 'warn', hook: 'data-nvr-system-msg' | 'data-nvr-result' | 'data-wiskey-cred-msg') {
    const icon = html`<sw-icon name=${ok === true ? 'check' : 'warning'} size=${13}></sw-icon>`;
    if (hook === 'data-nvr-system-msg') {
      const tone = ok === 'warn' ? 'warn' : ok ? 'ok' : 'err';
      return html`<div class=${`msg ${tone}`} role=${ok === true ? 'status' : 'alert'} data-nvr-system-msg=${tone}>${icon}${text}</div>`;
    }
    if (hook === 'data-nvr-result') {
      const tone = ok === 'warn' ? 'warn' : ok ? 'ok' : 'err';
      return html`<div class=${`msg ${tone}`} role=${ok === true ? 'status' : 'alert'} data-nvr-result=${tone}>${icon}${text}</div>`;
    }
    return html`<div class=${`msg ${ok ? 'ok' : 'err'}`} role=${ok ? 'status' : 'alert'} data-wiskey-cred-msg>${icon}${text}</div>`;
  }

  connectedCallback() {
    super.connectedCallback();
    if (isApi()) void this.load();
  }

  private async load() {
    void this.loadNvr();
    void this.loadWiskey();
    this.busy = true;
    try {
      this.raw = await get<RawHealth>('health');
      this.error = '';
    } catch (err) {
      this.error = describeError(err);
    }
    // extra facts when the caller may see them; neither is required for the page
    try {
      const cams = nvrLess() ? null : await listCameras();
      this.recorder = cams?.recorder ?? null;
      this.sysRecorders = cams?.recorders ?? [];
    } catch {
      this.recorder = null;
    }
    try {
      this.report = await healthReport();
    } catch {
      this.report = null;
    }
    this.busy = false;
  }

  private check(id: string) {
    return this.report?.checks.find((c) => c.id === id) ?? null;
  }

  private row(label: string, value: unknown, tone: 'ok' | 'warn' | 'err' | '' = '') {
    return html`<div class="check"><span>${label}</span><span class=${`val ${tone}`}>${value === null || value === undefined || value === '' ? '—' : String(value)}</span></div>`;
  }

  /** CR-NVR-GUARD-2438 (owner O2 = b): why a settings write is not offered - the recorder's "allow settings changes" switch is
   * off. Operational actions (disk test, output pulse, manual recording) are not affected and keep their buttons. */
  private static writesOffHint(where: string) {
    return html`<div class="hint" role="note" data-nvr-writes-off=${where}><sw-icon name="lock" size=${13}></sw-icon> ${tr('שינויי הגדרות ב־NVR כבויים עבור המקליט הזה. אפשר להפעיל אותם בהגדרות החיבור של ה־NVR.')}</div>`;
  }

  private sectionHead(icon: string, label: string) {
    return html`<div class="syshead"><sw-icon name=${icon} size=${15}></sw-icon>${label}</div>`;
  }

  private async loadNvr() {
    if (!isApi()) return;
    if (nvrLess()) return; // NVR-less mode: nothing to read from an NVR (the connection form loads itself)
    try {
      const [n, c] = await Promise.all([notifyStatus(), listNvrChanges(10)]);
      this.notify = n;
      this.changes = c.changes;
      this.notifyError = '';
    } catch (err) {
      this.notifyError = describeError(err);
    }
    void this.loadSystem();
  }

  /** TKFRIGLIVE: the clock / disks / outputs card is a Hikvision card; a Frigate recorder is never asked (it answered 409 on every
   * load) and shows its own summary instead. */
  private get sysVendor(): string | null {
    return this.sysRecorders.find((r) => r.id === this.sysRecorder)?.vendor ?? this.sys?.vendor ?? null;
  }

  private async loadSystem() {
    if (this.sysRecorders.find((r) => r.id === this.sysRecorder)?.vendor === 'frigate') {
      this.sys = null;
      this.sysError = '';
      return;
    }
    // PHYSICAL-CONFIRM-2540 (review SCR-14): the answer belongs to the recorder it was asked for - a late answer for recorder A is
    // dropped once B is selected, so the card never shows A's outputs while its buttons act on B
    const rid = this.sysRecorder;
    try {
      const sys = await nvrSystemApi(rid).nvrSystem();
      if (rid !== this.sysRecorder) return;
      this.sys = sys;
      this.sysError = '';
    } catch (err) {
      if (rid !== this.sysRecorder) return;
      this.sysError = describeError(err);
    }
  }

  /** The selected recorder's name, only when there is more than one to choose from (the confirmations name it). */
  private recorderName(rid: string): string {
    return this.sysRecorders.length > 1 ? this.sysRecorders.find((r) => r.id === rid)?.name ?? rid : '';
  }

  /** PHYSICAL-CONFIRM-2540 (review SCR-15): an alarm-output pulse energises a physical relay (a siren, a light, a gate) - it is never
   * one click away. The confirmation names the output, the recorder (with two or more) and the pulse length, opens with the focus on
   * cancel, and the pulse goes to the recorder the operator saw when he confirmed (`rid`), once. */
  private async pulse(o: NvrSystem['outputs'][number]) {
    if (this.sysBusy) return;
    const rid = this.sysRecorder;
    const output = tr('יציאה {id}{v}', { id: o.id, v: o.name ? ` · ${o.name}` : '' });
    const rec = this.recorderName(rid);
    const ok = await confirmDialog({
      heading: tr('הפעלת יציאת אזעקה'),
      body: [
        tr('להפעיל עכשיו את {output}{rec}?', { output, rec: rec ? tr(' ב־{name}', { name: rec }) : '' }),
        tr('זהו ממסר פיזי: הוא עשוי להפעיל צופר, תאורה או שער{v}.', { v: o.pulse_ms ? tr(' למשך {v} שנ׳', { v: o.pulse_ms / 1000 }) : '' }),
        tr('הפעולה נרשמת באודיט עם שם המשתמש.'),
      ].join('\n'),
      confirmLabel: tr('הפעל את היציאה'),
      danger: true,
      focusCancel: true,
    });
    if (!ok || rid !== this.sysRecorder) return; // the recorder changed while the question was open: nothing is sent
    void this.sysAction(tr('הפעלת יציאה {id}', { id: o.id }), () => nvrSystemApi(rid).pulseNvrOutput(o.id), true);
  }

  /** One NVR system action with the shared busy flag and result line (0.1.71). PHYSICAL-CONFIRM-2540: a `physical` action (the
   * output pulse, the restart) that did not answer with success is read honestly - a refusal is a failure (red), anything else
   * (a dropped connection, a time-out) is "unknown, check on site" (amber), never "failed" and never "done". */
  private async sysAction(label: string, run: () => Promise<unknown>, physical = false) {
    if (this.sysBusy) return;
    this.sysBusy = true;
    this.sysMsg = '';
    const doneText = () => (physical ? tr('{label}: ה־NVR אישר את הפקודה · נרשם באודיט.', { label }) : tr('{label}: בוצע ונרשם באודיט.', { label }));
    let sent = false;
    try {
      await run();
      sent = true;
      await Promise.all([this.loadSystem(), listNvrChanges(10).then((c) => (this.changes = c.changes))]);
      this.sysOk = true;
      this.sysMsg = doneText(); // after the refresh, so the next button is already enabled
    } catch (err) {
      if (sent) {
        // the action itself was accepted; only the refresh after it failed
        this.sysOk = true;
        this.sysMsg = doneText();
      } else if (physical && physicalOutcome(err) === 'unknown') {
        this.sysOk = 'warn';
        this.sysMsg = `${label}: ${tr('לא ידוע אם הפעולה בוצעה · בדקו במקום לפני הפעלה חוזרת')}`;
      } else {
        this.sysOk = false;
        this.sysMsg = `${label}: ${describeError(err)}`;
      }
    } finally {
      this.sysBusy = false;
      // A11Y-NEW-2550: the button waited disabled - a focus that fell back to the page goes to the outcome line (role status / alert)
      void this.updateComplete.then(() => focusIfLost(this.renderRoot.querySelector<HTMLElement>('[data-nvr-system-msg]')));
    }
  }

  private renderSystemCard() {
    const s = this.sys;
    const gb = (mb: number) => `${(mb / 1024).toFixed(0)} GB`;
    const drift = s?.time?.drift_s ?? null;
    const driftTone = drift === null ? '' : Math.abs(drift) <= 2 ? 'ok' : Math.abs(drift) <= 30 ? 'warn' : 'err';
    return html`<sw-card heading=${tr('מערכת ה־NVR')} subheading=${tr('שעון ו־NTP, דיסקים ובדיקת S.M.A.R.T., יציאות אזעקה, הפעלה מחדש · כל כתיבה דורשת הרשאה רגישה ונרשמת')} data-nvr-system>
      ${this.sysRecorders.length > 1
        ? html`<sw-field label="NVR"><select data-nvr-system-recorder ?disabled=${this.sysBusy} @change=${(e: Event) => { this.sysRecorder = (e.target as HTMLSelectElement).value; this.sys = null; this.sysMsg = ''; void this.loadSystem(); }}>
            ${this.sysRecorders.map((r) => html`<option value=${r.id} ?selected=${r.id === this.sysRecorder}>${r.name}</option>`)}
          </select></sw-field>`
        : nothing}
      ${this.sysVendor === 'frigate'
        ? html`<frigate-summary recorder-id=${this.sysRecorder} data-nvr-system-frigate></frigate-summary>`
        : s && s.supported === false
        ? html`<div class="hint" data-nvr-system-unsupported>${tr('פרטי השעון, הדיסקים והיציאות אינם זמינים עבור מקליט מסוג זה.')}</div>`
        : html`${this.sysError ? html`<div class="msg err" role="alert" data-nvr-system-error><sw-icon name="warning" size=${13}></sw-icon>${this.sysError}</div>` : nothing}
      ${!s
        ? this.sysError ? nothing : html`<div class="hint">${tr('קורא את מצב המערכת מה־NVR…')}</div>`
        : html`
          ${this.sectionHead('clock', tr('שעון'))}
          ${s.time
            ? html`${this.row(tr('שעון ה־NVR'), `${s.time.local_time ?? '—'} · ${s.time.mode === 'NTP' ? 'NTP' : tr('ידני')}`)}
                ${this.row(tr('סטייה מול שעון השרת'), drift === null ? '—' : tr('{v}{drift} שנ׳', { v: drift > 0 ? '+' : '', drift }), driftTone as 'ok' | 'warn' | 'err' | '')}
                ${this.row(tr('שרת NTP'), s.time.ntp ? tr('{v}:{port} · כל {interval_min} דק׳', { v: s.time.ntp.host ?? '—', port: s.time.ntp.port, interval_min: s.time.ntp.interval_min }) : '—')}
                ${s.can.time
                  ? html`<div class="actions">
                      <sw-button size="sm" icon="clock" ?disabled=${this.sysBusy} data-nvr-sync-clock @click=${() => this.sysAction(tr('סנכרון השעון'), () => this.sysApi.setNvrTime({ sync_now: true }))}>${tr('סנכרן לשעון השרת עכשיו')}</sw-button>
                      <sw-button size="sm" variant="ghost" ?disabled=${this.sysBusy} data-nvr-ntp-edit @click=${() => (this.ntpForm = this.ntpForm ? null : { host: s.time?.ntp?.host ?? '', port: s.time?.ntp?.port ?? 123, interval_min: s.time?.ntp?.interval_min || 1440 })}>${tr('שרת NTP…')}</sw-button>
                    </div>
                    ${this.ntpForm
                      ? html`<div class="two" data-nvr-ntp-form>
                          <sw-field label=${tr('שרת NTP')}><input data-ltr .value=${this.ntpForm.host} @input=${(e: Event) => (this.ntpForm = { ...this.ntpForm!, host: (e.target as HTMLInputElement).value })} /></sw-field>
                          <sw-field label=${tr('מרווח (דקות)')}><input type="number" min="1" max="10080" data-ltr .value=${String(this.ntpForm.interval_min)} @input=${(e: Event) => (this.ntpForm = { ...this.ntpForm!, interval_min: Number((e.target as HTMLInputElement).value) })} /></sw-field>
                          <div class="actions"><sw-button size="sm" variant="primary" ?disabled=${this.sysBusy || !this.ntpForm.host} data-nvr-ntp-save @click=${() => { const f = this.ntpForm!; void this.sysAction(tr('שרת NTP'), async () => { await this.sysApi.setNvrNtp({ host: f.host.trim(), port: f.port, interval_min: f.interval_min }); this.ntpForm = null; }); }}>${tr('כתוב ל־NVR')}</sw-button></div>
                        </div>`
                      : nothing}`
                  : s.writes_enabled === false
                    ? SystemSetup.writesOffHint('time')
                    : html`<div class="hint">${tr('כתיבת שעון / NTP: הרשאה nvr.config.time (תפקיד מותאם).')}</div>`}`
            : html`<div class="hint">${tr('השעון לא נקרא{v}.', { v: s.errors.time ? ` (${s.errors.time})` : '' })}</div>`}
          ${this.sectionHead('storage', tr('דיסקים ו־S.M.A.R.T.'))}
          ${s.disks.length
            ? s.disks.map((d) => html`<div data-nvr-disk=${d.id}>
                ${this.row(`${d.name} (${d.type})`, tr('{status} · {gb} · פנוי {gb2} ({v}%)', { status: d.status, gb: gb(d.capacity_mb), gb2: gb(d.free_mb), v: d.capacity_mb ? Math.round((d.free_mb / d.capacity_mb) * 100) : 0 }), d.status === 'ok' ? 'ok' : 'warn')}
                ${d.smart
                  ? this.row('S.M.A.R.T.', tr('{v} · {v2}°C · {v3} ימי פעילות{v4}', { v: d.smart.all_eval ?? '—', v2: d.smart.temperature_c ?? '—', v3: d.smart.power_on_days ?? '—', v4: d.smart.test_status ? tr(' · בדיקה: {test_status} {test_percent}%', { test_status: d.smart.test_status, test_percent: d.smart.test_percent }) : '' }), d.smart.all_eval === 'functional' ? 'ok' : 'warn')
                  : this.row('S.M.A.R.T.', tr('לא זמין'))}
                ${s.can.storage ? html`<div class="actions"><sw-button size="sm" icon="storage" ?disabled=${this.sysBusy} data-nvr-smart-test=${d.id} @click=${() => this.sysAction(tr('בדיקת S.M.A.R.T. קצרה'), () => this.sysApi.startSmartTest(d.id, 'short'))}>${tr('בדיקת S.M.A.R.T. קצרה')}</sw-button><span class="hint">${tr('מעמיסה את הדיסק בזמן ריצתה; מומלץ בשעות שקטות')}</span></div>` : nothing}
              </div>`)
            : html`<div class="hint">${tr('לא נקראו דיסקים{v}.', { v: s.errors.disks ? ` (${s.errors.disks})` : '' })}</div>`}
          ${this.sectionHead('bell', tr('יציאות אזעקה'))}
          ${s.outputs.length
            ? s.outputs.map((o) => html`<div class="check" data-nvr-output=${o.id}><span>${tr('יציאה {id}{v}', { id: o.id, v: o.name ? ` · ${o.name}` : '' })} <span class="hint">${o.io_type === 'local' ? tr('ממסר ב־NVR') : tr('במצלמה')} · ${o.use_type === 'whiteLight' ? tr('אור לבן') : o.use_type === 'disable' ? tr('לא בשימוש') : o.use_type}${o.pulse_ms ? tr(' · פולס {v} שנ׳', { v: o.pulse_ms / 1000 }) : ''}</span></span>
                ${!o.pulse_supported
                  ? html`<span class="val" data-nvr-output-unsupported>${tr('הפעלה דרך המצלמה בלבד (ה־NVR לא מעביר)')}</span>`
                  : s.can.alarm ? html`<sw-button size="sm" icon="bell" ?disabled=${this.sysBusy || !o.enabled} data-nvr-pulse=${o.id} @click=${() => void this.pulse(o)}>${tr('הפעל (pulse)')}</sw-button>` : html`<span class="val">${o.enabled ? tr('פעיל') : tr('כבוי')}</span>`}
              </div>`)
            : html`<div class="hint">${tr('אין יציאות{v}.', { v: s.errors.outputs ? ` (${s.errors.outputs})` : '' })}</div>`}
          ${this.sectionHead('refresh', tr('הפעלה מחדש'))}
          ${s.can.reboot
            ? html`<div class="actions"><sw-button size="sm" variant="danger" icon="refresh" ?disabled=${this.sysBusy} data-nvr-reboot @click=${() => { this.rebootWord = ''; this.rebootOpen = true; }}>${tr('הפעל מחדש את ה־NVR…')}</sw-button><span class="hint">${tr('1–2 דקות בלי לייב ובלי הקלטה')}</span></div>`
            : s.writes_enabled === false
            ? SystemSetup.writesOffHint('reboot')
            : html`<div class="hint">${tr('הפעלה מחדש: הרשאה nvr.system.reboot (תפקיד מותאם).')}</div>`}
          ${this.sysMsg ? SystemSetup.statusLine(this.sysMsg, this.sysOk, 'data-nvr-system-msg') : nothing}`}`}
      ${this.rebootOpen
        ? html`<sw-dialog open heading=${tr('הפעלה מחדש של ה־NVR')} subheading=${this.recorderName(this.sysRecorder) ? `${this.recorderName(this.sysRecorder)} · ${tr('במשך 1–2 דקות אין לייב ואין הקלטה')}` : tr('במשך 1–2 דקות אין לייב ואין הקלטה')} data-nvr-reboot-dialog @close=${() => (this.rebootOpen = false)}>
            <div class="dlgtext">${tr('הקלד')} <b>RESTART</b> ${tr('כדי לאשר. הפעולה נרשמת באודיט עם שם המשתמש.')}</div>
            <sw-field label=${tr('אישור')}><input data-ltr data-nvr-reboot-word .value=${this.rebootWord} @input=${(e: Event) => (this.rebootWord = (e.target as HTMLInputElement).value)} /></sw-field>
            <div slot="footer"><sw-button variant="danger" ?disabled=${this.sysBusy || this.rebootWord.trim().toUpperCase() !== 'RESTART'} data-nvr-reboot-run @click=${() => { const w = this.rebootWord; const rid = this.sysRecorder; this.rebootOpen = false; void this.sysAction(tr('הפעלה מחדש'), () => nvrSystemApi(rid).rebootNvr(w), true); }}>${tr('הפעל מחדש')}</sw-button><sw-button variant="ghost" @click=${() => (this.rebootOpen = false)}>${tr('ביטול')}</sw-button></div>
          </sw-dialog>`
        : nothing}
    </sw-card>`;
  }

  private async loadWiskey() {
    if (!can('system.configure')) return;
    try {
      this.wiskey = await getIntercomCredentials();
      this.wiskeyError = '';
    } catch (err) {
      this.wiskeyError = SystemSetup.wiskeyFailure(tr('רשימת העמדות לא נטענה'), err);
    }
  }

  /** The API's own answer, code included (`source_not_configured`, `forbidden` ...), never softened. */
  private static wiskeyFailure(prefix: string, err: unknown): string {
    return `${prefix}: ${describeError(err)}${err instanceof ApiError ? ` (${err.code})` : ''}`;
  }

  private wiskeyName(stationId: string): string {
    const s = this.wiskey?.stations.find((x) => x.station_id === stationId);
    return s?.name || stationId;
  }

  private async saveWiskey() {
    const f = this.wiskeyForm;
    if (!f || this.wiskeyBusy) return;
    this.wiskeyBusy = true;
    this.wiskeyMsg = '';
    try {
      await setIntercomCredentials(f.station_id, { username: f.username.trim(), password: f.password });
      this.wiskeyForm = null;
      this.wiskeyOk = true;
      this.wiskeyMsg = tr('החשבון של {wiskeyName} נשמר; התמונה מהמצלמה תילקח מחדש איתו.', { wiskeyName: this.wiskeyName(f.station_id) });
      await this.loadWiskey();
    } catch (err) {
      this.wiskeyOk = false;
      this.wiskeyMsg = SystemSetup.wiskeyFailure(tr('לא נשמר'), err);
    } finally {
      this.wiskeyBusy = false;
    }
  }

  private async clearWiskey() {
    const s = this.wiskeyClear;
    if (!s || this.wiskeyBusy) return;
    this.wiskeyBusy = true;
    this.wiskeyMsg = '';
    try {
      await clearIntercomCredentials(s.station_id);
      this.wiskeyClear = null;
      this.wiskeyOk = true;
      this.wiskeyMsg = s.known ? tr('החשבון של {v} הוסר; העמדה חוזרת לחשבון המשותף.', { v: s.name || s.station_id }) : tr('הרשומה של {station_id} הוסרה.', { station_id: s.station_id });
      await this.loadWiskey();
    } catch (err) {
      this.wiskeyOk = false;
      this.wiskeyMsg = SystemSetup.wiskeyFailure(tr('לא הוסר'), err);
    } finally {
      this.wiskeyBusy = false;
    }
  }

  private renderWiskeyStation(s: IntercomStationCredentials, w: IntercomCredentialsList) {
    const f = this.wiskeyForm?.station_id === s.station_id ? this.wiskeyForm : null;
    const state = s.override ? 'override' : w.default_configured ? 'default' : 'none';
    const status = s.override ? tr('חשבון משלה · מאז {when}', { when: when(s.override_updated_at) }) : w.default_configured ? tr('החשבון המשותף') : tr('אין חשבון · אין תמונה מהמצלמה');
    return html`<div data-wiskey-station=${s.station_id} data-wiskey-cred-state=${state}>
      <div class="check">
        <span>${s.name || s.station_id}${!s.known ? html` <span class="hint" data-wiskey-cred-unknown>${tr('· לא ברשימת העמדות של WisKey כרגע')}</span>` : s.has_camera ? nothing : html` <span class="hint">${tr('· ללא מצלמה')}</span>`}</span>
        <span class=${`val ${s.override ? 'ok' : w.default_configured ? '' : 'warn'}`} data-wiskey-cred-status>${status}</span>
      </div>
      ${f
        ? html`<div class="two" data-wiskey-cred-form>
            <sw-field label=${tr('משתמש')}><input data-ltr data-wiskey-cred-user autocomplete="off" .value=${f.username} @input=${(e: Event) => (this.wiskeyForm = { ...f, username: (e.target as HTMLInputElement).value })} /></sw-field>
            <sw-field label=${tr('סיסמה')}><input type="password" data-ltr data-wiskey-cred-password autocomplete="new-password" .value=${f.password} @input=${(e: Event) => (this.wiskeyForm = { ...f, password: (e.target as HTMLInputElement).value })} /></sw-field>
            <div class="actions">
              <sw-button size="sm" variant="primary" icon="check" ?disabled=${this.wiskeyBusy || !f.username.trim() || !f.password} data-wiskey-cred-save @click=${() => this.saveWiskey()}>${this.wiskeyBusy ? tr('שומר…') : tr('שמור')}</sw-button>
              <sw-button size="sm" variant="ghost" ?disabled=${this.wiskeyBusy} data-wiskey-cred-cancel @click=${() => (this.wiskeyForm = null)}>${tr('ביטול')}</sw-button>
            </div>
            <div class="hint">${tr('החשבון נשמר בבסיס הנתונים של Arx ואינו מוצג שוב; השמירה נרשמת באודיט בלי הסיסמה. החשבון אינו נבדק מול העמדה - אם הוא שגוי, במרכז הכניסה לא תהיה תמונה מהמצלמה.')}</div>
          </div>`
        : html`<div class="actions">
            ${s.known ? html`<sw-button size="sm" icon="edit" ?disabled=${this.wiskeyBusy} data-wiskey-cred-edit @click=${() => { this.wiskeyMsg = ''; this.wiskeyForm = { station_id: s.station_id, username: '', password: '' }; }}>${s.override ? tr('החלפת החשבון…') : tr('חשבון משלה לעמדה…')}</sw-button>` : nothing}
            ${s.override ? html`<sw-button size="sm" variant="ghost" icon="trash" ?disabled=${this.wiskeyBusy} data-wiskey-cred-clear @click=${() => { this.wiskeyMsg = ''; this.wiskeyClear = s; }}>${s.known ? tr('חזרה לחשבון המשותף') : tr('הסרת הרשומה')}</sw-button>` : nothing}
          </div>`}
    </div>`;
  }

  /** Per-station WisKey RTSP accounts (system.configure only; hidden otherwise). The station's host is never shown. */
  private renderWiskeyCard() {
    if (!can('system.configure')) return nothing;
    const w = this.wiskey;
    const c = this.wiskeyClear;
    return html`<sw-card heading=${tr('מצלמות עמדות WisKey')} subheading=${tr('חשבון ה־RTSP שאיתו go2rtc מושך את מצלמת כל עמדה: המשותף שהוגדר בתשתית המערכת, או חשבון משלה לעמדה שצריכה אחר · הערכים עצמם אינם מוצגים')} data-wiskey-credentials>
      ${this.wiskeyError ? html`<div class="msg err" role="alert" data-wiskey-cred-error><sw-icon name="warning" size=${13}></sw-icon>${this.wiskeyError}</div>` : nothing}
      ${!w
        ? this.wiskeyError ? nothing : html`<div class="hint">${tr('קורא את רשימת העמדות…')}</div>`
        : html`${this.row(tr('חשבון משותף (wiskey_username, הסיסמה בכרטיס סודות)'), w.default_configured ? tr('מוגדר') : tr('לא מוגדר'), w.default_configured ? 'ok' : 'warn')}
          ${w.state !== 'ready' ? html`<div class="hint" data-wiskey-cred-feed=${w.state}>${tr('WisKey אינו מחובר כרגע (מצב:')} <span class="ltr">${w.state}</span>${tr('); מוצג מה שידוע ל־Arx.')}</div>` : nothing}
          ${w.stations.length ? w.stations.map((s) => this.renderWiskeyStation(s, w)) : html`<div class="hint" data-wiskey-cred-empty>${tr('אין עמדות ברשימה.')}</div>`}
          ${this.wiskeyMsg ? SystemSetup.statusLine(this.wiskeyMsg, this.wiskeyOk, 'data-wiskey-cred-msg') : nothing}`}
      ${c
        ? html`<sw-dialog open heading=${tr('הסרת החשבון של העמדה')} subheading=${c.name || c.station_id} data-wiskey-cred-confirm @close=${() => (this.wiskeyClear = null)}>
            <div class="dlgtext">${tr('{v} ההסרה נרשמת באודיט.', { v: !c.known ? tr('הרשומה תימחק מבסיס הנתונים של Arx.') : w?.default_configured ? tr('העמדה תחזור לחשבון המשותף, והתמונה מהמצלמה תילקח מחדש איתו.') : tr('לעמדה לא יישאר חשבון, ולא תהיה ממנה תמונה עד שיוגדר אחד.') })}</div>
            <div slot="footer"><sw-button variant="danger" ?disabled=${this.wiskeyBusy} data-wiskey-cred-confirm-run @click=${() => this.clearWiskey()}>${this.wiskeyBusy ? tr('מסיר…') : tr('הסר')}</sw-button><sw-button variant="ghost" @click=${() => (this.wiskeyClear = null)}>${tr('ביטול')}</sw-button></div>
          </sw-dialog>`
        : nothing}
    </sw-card>`;
  }

  /** CR-022: the NVR connection - vendor, address, ports, user, write-only password - lives in the shared form. Only a holder of
   * system.configure sees anything (the form renders nothing otherwise); the restart banner is the shell's. */
  private renderConnectionCard() {
    if (!can('system.configure')) return nothing;
    // CR-024: the recorders card - the connection form for one recorder (as before), the recorders list for two or more
    return html`<nvr-recorders-card></nvr-recorders-card>`;
  }

  private planNotify(channels: number[] | null, smart: boolean, enabled: boolean) {
    const n = channels ? channels.length : this.notify?.channels.length ?? 0;
    this.notifyResult = '';
    this.notifyPlan = { channels, smart, enabled, label: tr('{v} Notify Surveillance Center ב־{n} ערוצים{v2}', { v: enabled ? tr('הפעלת') : tr('כיבוי'), n, v2: smart ? tr(' · תנועה + אירועים חכמים') : tr(' · זיהוי תנועה') }) };
  }

  private async runNotify() {
    const p = this.notifyPlan;
    if (!p || this.notifyBusy) return;
    this.notifyBusy = true;
    try {
      const r = await setNotify({ channels: p.channels, smart: p.smart, enabled: p.enabled });
      this.notifyOk = !r.failed;
      this.notifyResult = tr('בוצע: {applied} שינויים · {unchanged} כבר היו כך · {skipped} דולגו (סוג אירוע שלא מוגדר בערוץ) · {failed} נכשלו', { applied: r.applied, unchanged: r.unchanged, skipped: r.skipped, failed: r.failed });
      this.notifyPlan = null;
      await this.loadNvr();
    } catch (err) {
      this.notifyOk = false;
      this.notifyResult = describeError(err);
    } finally {
      this.notifyBusy = false;
    }
  }

  /** The change log's revert. LISTENER-DEADLINE-2540 (follow-up of CAST-RELAY-HARDEN-2540, deep review V-03): when the device no
   * longer holds what the change left (409 `changed_since`) the server's reason is shown and the operator is asked whether to revert
   * anyway - the shared confirmation, danger styled, the focus on cancel (a stray Enter overwrites nothing); only "revert anyway"
   * resends, once, with `force`. A change already reverted (409 `already_rolled_back`) is a plain message and the list is refreshed;
   * it is never forced from here. */
  private async rollback(c: NvrChange, force = false) {
    if (this.notifyBusy) return;
    this.notifyBusy = true;
    let reason: string | null = null;
    try {
      await rollbackNvrChange(c.id, force);
      this.notifyOk = true;
      this.notifyResult = force ? tr('השינוי {target} הוחזר למצב הקודם בכל זאת · נרשם באודיט.', { target: c.target }) : tr('השינוי {target} הוחזר למצב הקודם.', { target: c.target });
      await this.loadNvr();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : '';
      if (code === 'changed_since' && !force) {
        reason = describeError(err);
        this.notifyOk = 'warn';
        this.notifyResult = `${reason} ${tr('לא נכתב דבר ל־NVR.')}`;
      } else if (code === 'already_rolled_back') {
        this.notifyOk = 'warn';
        this.notifyResult = tr('השינוי {target} כבר הוחזר קודם לכן · לא נכתב דבר ל־NVR.', { target: c.target });
        await this.loadNvr(); // the row shows "reverted" and loses its button (loadNvr never throws)
      } else {
        this.notifyOk = false;
        this.notifyResult = describeError(err);
      }
    } finally {
      this.notifyBusy = false;
    }
    // A11Y-NEW-2550: the revert button waited disabled and, once reverted, leaves the list - a focus that fell back to the page goes to the
    // outcome line; before "revert anyway" is asked it goes back to the button, so the question returns the focus there on cancel
    await this.updateComplete;
    if (reason === null) {
      focusIfLost(this.renderRoot.querySelector<HTMLElement>('[data-nvr-result]'));
      return;
    }
    focusIfLost(this.renderRoot.querySelector(`[data-nvr-rollback="${CSS.escape(c.id)}"]`)?.shadowRoot?.querySelector<HTMLElement>('button'));
    const ok = await confirmDialog({
      heading: tr('החזרת שינוי ב־NVR'),
      body: [
        reason,
        tr('החזרה בכל זאת תכתוב ל־NVR את המצב שלפני השינוי {target} ותדרוס את מה שמוגדר בו עכשיו.', { target: c.target }),
        tr('הפעולה נרשמת באודיט עם שם המשתמש.'),
      ].join('\n'),
      confirmLabel: tr('החזר בכל זאת'),
      danger: true,
      focusCancel: true,
    });
    if (ok) await this.rollback(c, true);
  }

  private renderNotifyCard() {
    const n = this.notify;
    // SETUPPLAN-POLISH-2331: the matrix said yes / no with the glyphs ✓ / ✗ (a font's guess, not the icon set); a drawn mark in a tinted
    // chip reads the same in every skin, and the label stays for a screen reader
    const yes = (v: boolean | null) =>
      v === null
        ? '—'
        : html`<span class=${`yn ${v ? 'on' : 'off'}`} part=${`yn ${v ? 'yn-on' : 'yn-off'}`} role="img" aria-label=${v ? tr('נשלחת') : tr('לא נשלחת')}><sw-icon name=${v ? 'check' : 'close'} size=${12}></sw-icon></span>`;
    type Ch = NonNullable<typeof n>['channels'][number];
    // CR-CMP2-TABLES-REST-2470 (owner N10): the channel matrix on the shared table - the channel number, the camera (it wraps), the motion
    // mark (its tinted chip through the yn parts; cell hook data-nvr-motion), the smart events as figures, the row's "enable" key
    const cols: TableColumn<Ch>[] = [
      { key: 'channel', label: tr('ערוץ'), kind: 'num', align: 'start' },
      { key: 'name', label: tr('מצלמה'), cellAttrs: () => ({ 'data-nvr-cam': true }) },
      { key: 'motion', label: tr('תנועה'), cellAttrs: (c) => ({ 'data-nvr-motion': c.motion.supported ? String(c.motion.center) : 'none' }),
        render: (c) => (c.motion.supported ? yes(c.motion.center) : html`<span class="mut">${tr('לא מוגדר')}</span>`) },
      { key: 'smart', label: tr('אירועים חכמים'), render: (c) => (c.smart_supported ? html`<span class="num">${c.smart_center}/${c.smart_supported}</span>` : html`<span class="mut">${tr('אין')}</span>`) },
      { key: 'act', label: tr('פעולה'), kind: 'actions',
        render: (c) => (n?.can_write && c.motion.supported && !c.motion.center ? html`<sw-button size="sm" data-nvr-enable-one=${c.channel} @click=${() => this.planNotify([c.channel], false, true)}>${tr('הפעל')}</sw-button>` : nothing) },
    ];
    return html`<sw-card heading=${tr('התראות מה־NVR (Notify Surveillance Center)')} subheading=${tr('אילו ערוצים מודיעים ל־Arx על תנועה ועל אירועים חכמים · כתיבה מאושרת ל־NVR, עם החזר')} data-nvr-notify>
      ${this.notifyError ? html`<div class="msg err" role="alert" data-nvr-notify-error><sw-icon name="warning" size=${13}></sw-icon>${this.notifyError}</div>` : nothing}
      ${!n
        ? this.notifyError ? nothing : html`<div class="hint">${tr('קורא את הגדרות ה־NVR…')}</div>`
        : html`<sw-table class="matrix" bare static-rows data-nvr-matrix rowKey="channel" .columns=${cols as unknown as TableColumn[]} .rows=${n.channels as unknown as Record<string, unknown>[]}
            .rowAttrs=${(c: Record<string, unknown>) => ({ 'data-nvr-channel': String(c.channel) })}></sw-table>
          <div class="hint legend"><span class="yn on"><sw-icon name="check" size=${12}></sw-icon></span> ${tr('ההתראה נשלחת ל־Arx ·')} <span class="yn off"><sw-icon name="close" size=${12}></sw-icon></span> ${tr('הערוץ מקליט אבל לא מודיע · אירועים חכמים = חציית קו, פריצה לאזור, כניסה ויציאה מאזור (רק במצלמות שמגדירות אותם).')}</div>
          ${n.can_write
            ? html`<div class="actions">
                <sw-button variant="primary" size="sm" icon="bell" ?disabled=${this.notifyBusy} data-nvr-enable-all @click=${() => this.planNotify(null, false, true)}>${tr('הפעל תנועה בכל הערוצים')}</sw-button>
                <sw-button size="sm" icon="bell" ?disabled=${this.notifyBusy} data-nvr-enable-smart @click=${() => this.planNotify(null, true, true)}>${tr('הפעל גם אירועים חכמים')}</sw-button>
              </div>`
            : n.writes_enabled === false
            ? SystemSetup.writesOffHint('notify')
            : html`<div class="hint" data-nvr-no-permission>${tr('לכתיבה ל־NVR נדרשת ההרשאה "{permission}" — מוקנית למנהל המערכת, ולאחרים דרך תפקיד מותאם (הגדרות ‹ משתמשים והרשאות ‹ תפקידים), גם למנהל מערכת.', { permission: n.permission })}</div>`}
          ${this.notifyResult ? SystemSetup.statusLine(this.notifyResult, this.notifyOk, 'data-nvr-result') : nothing}
          ${this.changes.length ? html`<div class="syshead"><sw-icon name="history" size=${15}></sw-icon>${tr('שינויים אחרונים ב־NVR')}</div>
            <ul class="changes" data-nvr-changes>${this.changes.map((c) => html`<li><span class="ltr">${c.created_at.slice(0, 16).replace('T', ' ')}</span> · ${c.target} · ${c.note || c.kind} · ${c.status === 'applied' ? tr('בוצע') : c.status === 'unchanged' ? tr('ללא שינוי') : c.status === 'rolled_back' ? tr('הוחזר') : tr('נכשל')}${c.actor_username ? ` · ${c.actor_username}` : ''}
              ${c.status === 'applied' && n.can_write && c.writes_enabled !== false ? html`<sw-button variant="ghost" size="sm" ?disabled=${this.notifyBusy} data-nvr-rollback=${c.id} @click=${() => this.rollback(c)}>${tr('החזר')}</sw-button>` : nothing}
              ${c.status === 'applied' && c.writes_enabled === false ? html`<span class="dim" data-nvr-rollback-off=${c.id}>${tr('· החזר כבוי (שינויי הגדרות ב־NVR כבויים)')}</span>` : nothing}</li>`)}</ul>` : nothing}`}
      ${this.notifyPlan
        ? html`<sw-dialog open heading=${tr('כתיבה ל־NVR')} subheading=${this.notifyPlan.label} data-nvr-confirm @close=${() => (this.notifyPlan = null)}>
            <div class="dlgtext">${tr('השינוי נכתב להגדרות ה־NVR בזהות המשתמש של חיבור ה־NVR, נרשם באודיט עם המסמך לפני ואחרי, וניתן להחזרה מרשימת השינויים. הקלטות אינן מושפעות.')}</div>
            <div slot="footer"><sw-button variant="primary" ?disabled=${this.notifyBusy} data-nvr-confirm-run @click=${() => this.runNotify()}>${this.notifyBusy ? tr('כותב…') : tr('כתוב ל־NVR')}</sw-button><sw-button variant="ghost" @click=${() => (this.notifyPlan = null)}>${tr('ביטול')}</sw-button></div>
          </sw-dialog>`
        : nothing}
    </sw-card>`;
  }

  private renderApi() {
    const h = this.raw;
    return html`
      <sw-page crumbs=${tr('הגדרות')} heading=${tr('חיבורים')} subheading=${tr('מצב החיבורים של המערכת: NVR, go2rtc, תשתית המערכת ואחסון · פרטי חיבור ה־NVR נשמרים כאן')}>
        <sw-button slot="actions" icon="refresh" ?disabled=${this.busy} @click=${() => this.load()}>${this.busy ? tr('בודק…') : tr('רענון')}</sw-button>
        ${this.error ? html`<sw-state-panel state="error" heading=${tr('מצב החיבורים לא נטען')} hint=${this.error}></sw-state-panel>` : nothing}
        ${!h
          ? this.error ? nothing : html`<sw-state-panel state="loading" heading=${tr('קורא את מצב החיבורים…')}></sw-state-panel>`
          : html`<div class="two" data-connections>
              <div class="grouplabel">${tr('מערכת ה־NVR')}</div>
              ${h.mode === 'ha_only'
                ? html`<sw-card heading=${tr('NVR - מצב ללא NVR')} subheading=${tr('לא מוגדר - דילוג מכוון')} data-nvr-less-connections>
                    ${this.row(tr('מצב ההתקנה'), tr('תשתית המערכת בלבד (ללא NVR)'))}
                    <div class="hint">${tr('מצלמות, לייב, אירועים, הקלטות, תיקים וייצוא מוסתרים; המפה, חשמל והתקנים ו־WisKey עובדים כרגיל.')}</div>
                  </sw-card>
                  ${this.renderConnectionCard()}`
                : html`
              <sw-card heading="NVR (Hikvision, ISAPI + RTSP)" subheading=${h.nvr_configured ? tr('מוגדר · קריאה בלבד') : tr('לא מוגדר')}>
                ${this.row(tr('חיבור מוגדר'), h.nvr_configured ? tr('כן') : tr('לא'), h.nvr_configured ? 'ok' : 'err')}
                ${this.recorder ? this.row(tr('דגם · קושחה'), `${this.recorder.model ?? '—'} · ${this.recorder.firmware ?? '—'}`) : nothing}
                ${this.row(tr('גילוי מצלמות'), tr('{cameras} ערוצים · כל {v} דק׳', { cameras: h.discovery.cameras, v: Math.round(h.discovery.interval_s / 60) }))}
                ${this.row(tr('גילוי אחרון תקין'), when(h.discovery.cameras_last_ok), h.discovery.cameras_last_error ? 'warn' : 'ok')}
                ${h.discovery.cameras_last_error ? this.row(tr('שגיאת גילוי'), h.discovery.cameras_last_error, 'err') : nothing}
                ${this.row(tr('זרם התראות (alertStream)'), h.events.ingest.connected ? tr('מחובר · פעימה {when}', { when: when(h.events.ingest.last_heartbeat_at) }) : tr('מנותק{v}', { v: h.events.ingest.last_error ? ` · ${h.events.ingest.last_error}` : '' }), h.events.ingest.connected ? 'ok' : 'err')}
                ${this.row(tr('התראות שנשמרו מאז ההפעלה'), h.events.ingest.events_stored, h.events.ingest.connected && !h.events.ingest.events_stored ? 'warn' : '')}
                ${h.events.ingest.connected && !h.events.ingest.last_event_at ? html`<div class="hint" data-no-alerts-hint>${tr('ה־NVR מחובר אבל לא שלח התראה מאז ההפעלה — ב־NVR יש להפעיל "Notify Surveillance Center" ב־linkage של זיהוי התנועה; עד אז אירועי תנועה נגזרים מההקלטות כל 10 דקות.')}</div>` : nothing}
                ${this.row(tr('אירועים שנגזרו מהקלטות (ריצה אחרונה)'), `${h.events.derive.derived} · ${when(h.events.derive.last_ok)}`, h.events.derive.last_error ? 'warn' : '')}
              </sw-card>
              ${this.renderNotifyCard()}
              ${this.renderSystemCard()}
              ${this.renderConnectionCard()}`}
              <div class="grouplabel">${tr('שירותים ותשתית נוספים')}</div>
              <sw-card heading=${tr('go2rtc (relay לווידאו)')} subheading=${h.go2rtc_configured ? tr('מוגדר') : h.mode === 'ha_only' ? tr('לא מוגדר - רשות במצב ללא NVR') : !installationSupported() ? tr('לא מוגדר - נדרש כשיש NVR') : tr('לא מוגדר')}>
                ${this.row(tr('חיבור מוגדר'), h.go2rtc_configured ? tr('כן') : tr('לא'), h.go2rtc_configured ? 'ok' : h.mode === 'ha_only' ? '' : 'err')}
                ${!h.go2rtc_configured && h.mode === 'ha_only' ? html`<div class="hint" data-go2rtc-optional>${tr('במצב ללא NVR go2rtc נדרש רק לווידאו של עמדות WisKey.')}</div>` : nothing}
                ${!installationSupported() ? html`<div class="hint" data-go2rtc-required>${UNSUPPORTED_NVR_WITHOUT_GO2RTC}</div>` : nothing}
                ${this.row(tr('סנכרון זרמים אחרון תקין'), when(h.discovery.streams_last_ok), h.discovery.streams_last_error ? 'warn' : 'ok')}
                ${h.discovery.streams_last_error ? this.row(tr('שגיאת סנכרון זרמים'), h.discovery.streams_last_error, 'err') : nothing}
                ${this.check('go2rtc') ? this.row(tr('בדיקת בריאות'), this.check('go2rtc')!.detail, this.check('go2rtc')!.status === 'ok' ? 'ok' : this.check('go2rtc')!.status === 'warn' ? 'warn' : 'err') : html`<div class="hint">${tr('פרטי הזרמים והגרסה מוצגים ב"הגדרות ‹ כללי ‹ בריאות ועבודות" (דורש הרשאת ניהול).')}</div>`}
              </sw-card>
              ${this.renderWiskeyCard()}
              ${can('system.configure') ? html`<sw-secrets-card></sw-secrets-card>` : nothing}
              ${can('system.configure') ? html`<sw-bridge-key-card></sw-bridge-key-card>` : nothing}
              ${can('partner.manage') ? html`<sw-partner-api-card></sw-partner-api-card>` : nothing}
              ${can('system.configure') ? html`<sw-door-setup data-door-setup></sw-door-setup><sw-door-inventory data-door-inventory></sw-door-inventory><sw-door-blocks data-door-blocks></sw-door-blocks><sw-emergency-open-settings></sw-emergency-open-settings>` : nothing}
              ${can('system.configure') || can('access.admin.read') ? html`<sw-wiskey-relay-map data-relay-map></sw-wiskey-relay-map>` : nothing}
              <sw-card heading=${tr('תשתית המערכת')} subheading=${h.home_assistant.connected ? tr('מחובר · גרסה {v}', { v: h.home_assistant.ha_version ?? '' }) : h.home_assistant.configured ? tr('מוגדר, מנותק') : tr('לא מוגדר')}>
                ${this.row(tr('חיבור'), h.home_assistant.connected ? tr('מחובר') : tr('מנותק{v}', { v: h.home_assistant.last_error ? ` · ${h.home_assistant.last_error}` : '' }), h.home_assistant.connected ? 'ok' : 'err')}
                ${this.row(tr('ישויות בקטלוג'), h.home_assistant.entities)}
                ${this.row(tr('תמונת מצב אחרונה'), when(h.home_assistant.last_snapshot_at))}
                ${this.row(tr('עדכון ישות אחרון'), when(h.home_assistant.last_event_at))}
                ${this.row(tr('רישום (אזורים / קומות) עודכן'), when(h.home_assistant.last_registry_at))}
                ${this.row(tr('התחברויות מחדש מאז ההפעלה'), h.home_assistant.reconnects, h.home_assistant.reconnects > 3 ? 'warn' : '')}
                ${this.row(tr('מקור הזהות'), h.identity_source === 'ingress' ? tr('תשתית המערכת (כניסה מקומית)') : h.identity_source)}
              </sw-card>
              <sw-card heading=${tr('אחסון וכלים')} subheading=${tr('גרסה {version}', { version: h.version })}>
                ${this.row(tr('בסיס הנתונים'), h.db.ok ? tr('תקין · מהדורת הרשאות {permission_revision}', { permission_revision: h.db.permission_revision }) : tr('שגיאה'), h.db.ok ? 'ok' : 'err')}
                ${this.row(tr('תיקיית הנתונים (/data)'), h.data_dir_writable ? tr('ניתנת לכתיבה') : tr('לא ניתנת לכתיבה'), h.data_dir_writable ? 'ok' : 'err')}
                ${this.row(tr('ממיר תוכניות PDF'), h.renderer ?? tr('חסר'), h.renderer ? 'ok' : 'warn')}
                ${this.row(tr('אירועים שמורים'), h.events.stored)}
                ${this.check('thumbnails') ? this.row(tr('תמונות אירועים (ffmpeg)'), this.check('thumbnails')!.detail, this.check('thumbnails')!.status === 'ok' ? 'ok' : 'warn') : nothing}
                ${this.check('backups') ? this.row(tr('גיבויים'), this.check('backups')!.detail, this.check('backups')!.status === 'ok' ? 'ok' : 'warn') : nothing}
              </sw-card>
            </div>
            <sw-card heading=${tr('איפה מגדירים')} subheading=${tr('חיבורים נוספים מוגדרים בהגדרות SmplWise Arx בתשתית המערכת; הערכים אינם מוצגים כאן ושינוי דורש הפעלה מחדש; סיסמאות ומפתחות בכרטיס סודות')}>
              <div class="opts" data-connection-options>
                ${OPTIONS.map((o) => html`<div class="check"><span>${o.label}</span><span class="val ltr">${o.key}</span></div>`)}
              </div>
              <div class="hint">${tr('משתמש ה־NVR צריך הרשאות צפייה והקלטות; Arx כותב ל־NVR רק דרך הפעולות המאושרות בעמוד הזה, ורק עם הרשאה רגישה.')}</div>
            </sw-card>`}
      </sw-page>
    `;
  }

  static styles = [settingsStyles, css`
    /* SETUPPLAN-POLISH-2331: the channel matrix is a dense data table (ui-ux-pro-max: tabular numerals, a quiet header, a row
       hover under a pointer that hovers, a scroll box of its own so a 16-channel recorder never widens the page on a phone) */
    /* CR-CMP2-TABLES-REST-2470 (owner N10): the channel matrix is the shared table on the well (a 16-channel recorder never widens the page:
       the camera names wrap, the table is never wider than the card) */
    sw-table.matrix {
      --sw-table-min: 0;
      --sw-table-head-bg: transparent;
      --sw-table-cell-pad: 8px 12px;
      margin-block: var(--sw-s-2);
      border-radius: var(--sw-r-md);
      background: var(--sw-well, var(--sw-surface-2));
    }
    sw-table.matrix::part(cell) {
      white-space: normal;
    }
    sw-table.matrix::part(yn) {
      display: inline-grid;
      place-items: center;
      inline-size: 22px;
      block-size: 22px;
      border-radius: var(--sw-r-pill);
      vertical-align: middle;
    }
    sw-table.matrix::part(yn-on) {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    sw-table.matrix::part(yn-off) {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    /* a yes / no mark: a drawn check or cross in a small tinted chip (the success / neutral tones of the fact rows) */
    .yn {
      display: inline-grid;
      place-items: center;
      inline-size: 22px;
      block-size: 22px;
      border-radius: var(--sw-r-pill);
      vertical-align: middle;
    }
    .yn.on {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .yn.off {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .legend .yn {
      inline-size: 18px;
      block-size: 18px;
    }
    .msg {
      margin-block-start: var(--sw-s-2);
    }
    .dlgtext {
      font-size: var(--sw-fs-sm);
      line-height: 1.6;
      color: var(--sw-text);
    }
    ul.changes {
      list-style: none;
      margin: 0;
      padding: 0;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    ul.changes li {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px var(--sw-s-2);
      padding-block: 6px;
      border-block-end: 1px solid var(--sw-border);
    }
    ul.changes li:last-child {
      border-block-end: 0;
    }
    ul.changes li .ltr {
      font-variant-numeric: tabular-nums;
      color: var(--sw-text-3);
    }
    /* owner round 4 (1.1): the system card packed clock/disks/outputs/reboot behind bare bold text with no
       separation - a wall of controls. A real section head (icon, label, rule) makes it scannable. */
    .syshead {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-block: 14px 4px;
      padding-block-start: 12px;
      border-block-start: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading, var(--sw-text));
    }
    .syshead:first-child {
      margin-block-start: 0;
      padding-block-start: 0;
      border-block-start: 0;
    }
    .syshead sw-icon {
      color: var(--sw-accent);
    }
    .opts {
      columns: 2;
      column-gap: 24px;
    }
    .opts .check {
      break-inside: avoid;
    }
    @media (max-width: 767px) {
      .opts {
        columns: 1;
      }
      .check {
        flex-wrap: wrap;
      }
      .val {
        max-inline-size: 100%;
      }
    }
  `, bubbleChrome];

  render() {
    if (isApi()) return this.renderApi();
    // T071: the demo onboarding wizard that lived here became the real wizard (system-wizard.ts, #/system/wizard);
    // this page lists live connection facts, which a design preview without a backend does not have.
    return html`<sw-page crumbs=${tr('הגדרות')} heading=${tr('חיבורים')} subheading=${tr('מצב החיבורים של המערכת: NVR, go2rtc, תשתית המערכת ואחסון · כתיבה ל־NVR רק בפעולות המאושרות, עם הרשאה רגישה')}>
      <sw-state-panel icon="link" state="empty" heading=${tr('החיבורים מוצגים מול שרת אמיתי')} hint=${tr('במצב הדגמה אין חיבורים לקרוא. שלבי ההתקנה עם נתוני הדגמה נמצאים באשף ההתקנה.')} actionLabel=${tr('לאשף ההתקנה')} @action=${() => (window.location.hash = '#/system/wizard')}></sw-state-panel>
    </sw-page>`;
  }
}
