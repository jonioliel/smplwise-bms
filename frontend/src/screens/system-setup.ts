import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-steps';
import '../components/sw-field';
import '../components/sw-icon';
import '../components/sw-state-panel';
import { isApi } from '../api/session';
import { get, describeError } from '../api/client';
import { listCameras } from '../api/maps';
import { healthReport, type HealthReport } from '../api/health';
import { listNvrChanges, notifyStatus, nvrConnection, nvrSystem, pulseNvrOutput, rebootNvr, rollbackNvrChange, setNotify, setNvrConnection, setNvrNtp, setNvrTime, startSmartTest, type NotifyStatus, type NvrChange, type NvrConnection, type NvrSystem } from '../api/nvr';
import '../components/sw-dialog';

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
}

const OPTIONS: { key: string; label: string }[] = [
  { key: 'nvr_host', label: 'כתובת ה־NVR' },
  { key: 'nvr_http_port', label: 'פורט ISAPI (HTTP)' },
  { key: 'nvr_rtsp_port', label: 'פורט RTSP' },
  { key: 'nvr_username', label: 'משתמש NVR (קריאה)' },
  { key: 'nvr_password', label: 'סיסמת NVR' },
  { key: 'go2rtc_url', label: 'כתובת go2rtc' },
  { key: 'go2rtc_api_username', label: 'משתמש go2rtc (אם מוגן)' },
  { key: 'go2rtc_api_password', label: 'סיסמת go2rtc' },
  { key: 'bootstrap_admin_username', label: 'שם משתמש HA של המנהל הראשון' },
  { key: 'log_level', label: 'רמת לוג' },
];

function when(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const STEPS = ['גילוי', 'NVR', 'go2rtc', 'גשר HA', 'מנהל ראשון', 'שעון', 'סיום'];

/** SC26 — onboarding wizard (board 3 screen 22): numbered steps, discovery card with progress, device rows, Cancel / Next. */
@customElement('system-setup')
export class SystemSetup extends LitElement {
  @state() private step = 0;
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
  @state() private sysError = '';
  @state() private sysMsg = '';
  @state() private sysBusy = false;
  @state() private ntpForm: { host: string; port: number; interval_min: number } | null = null;
  @state() private rebootWord = '';
  @state() private rebootOpen = false;
  @state() private connection: NvrConnection | null = null;
  @state() private connForm: { host: string; http_port: number; rtsp_port: number; user: string; password: string } | null = null;
  @state() private connMsg = '';
  @state() private connBusy = false;
  @state() private changes: NvrChange[] = [];

  connectedCallback() {
    super.connectedCallback();
    if (isApi()) void this.load();
  }

  private async load() {
    void this.loadNvr();
    this.busy = true;
    try {
      this.raw = await get<RawHealth>('health');
      this.error = '';
    } catch (err) {
      this.error = describeError(err);
    }
    // extra facts when the caller may see them; neither is required for the page
    try {
      this.recorder = (await listCameras()).recorder;
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

  private async loadNvr() {
    if (!isApi()) return;
    try {
      const [n, c] = await Promise.all([notifyStatus(), listNvrChanges(10)]);
      this.notify = n;
      this.changes = c.changes;
      this.notifyError = '';
    } catch (err) {
      this.notifyError = describeError(err);
    }
    void this.loadSystem();
    void nvrConnection().then((v) => (this.connection = v)).catch(() => (this.connection = null));
  }

  private async loadSystem() {
    try {
      this.sys = await nvrSystem();
      this.sysError = '';
    } catch (err) {
      this.sysError = describeError(err);
    }
  }

  /** One NVR system action with the shared busy flag and result line (0.1.71). */
  private async sysAction(label: string, run: () => Promise<unknown>) {
    if (this.sysBusy) return;
    this.sysBusy = true;
    this.sysMsg = '';
    try {
      await run();
      await Promise.all([this.loadSystem(), listNvrChanges(10).then((c) => (this.changes = c.changes))]);
      this.sysMsg = `${label}: בוצע ונרשם באודיט.`; // after the refresh, so the next button is already enabled
    } catch (err) {
      this.sysMsg = `${label}: ${describeError(err)}`;
    } finally {
      this.sysBusy = false;
    }
  }

  private async saveConnection() {
    const f = this.connForm;
    if (!f || this.connBusy) return;
    this.connBusy = true;
    this.connMsg = '';
    try {
      const r = await setNvrConnection({ host: f.host.trim(), http_port: f.http_port, rtsp_port: f.rtsp_port, user: f.user.trim(), ...(f.password ? { password: f.password } : {}) });
      this.connection = r;
      this.connForm = null;
      this.connMsg = r.restarting
        ? `החיבור נבדק (${r.device.model} · ${r.device.firmware}) ונשמר ב־Add-on options; ה־Add-on מופעל מחדש כעת.`
        : `החיבור נבדק (${r.device.model} · ${r.device.firmware}) ונשמר; בתוקף מיד.`;
      void this.loadSystem();
    } catch (err) {
      this.connMsg = `לא נשמר: ${describeError(err)}`;
    } finally {
      this.connBusy = false;
    }
  }

  private renderSystemCard() {
    const s = this.sys;
    const gb = (mb: number) => `${(mb / 1024).toFixed(0)} GB`;
    const drift = s?.time?.drift_s ?? null;
    const driftTone = drift === null ? '' : Math.abs(drift) <= 2 ? 'ok' : Math.abs(drift) <= 30 ? 'warn' : 'err';
    return html`<sw-card heading="מערכת ה־NVR" subheading="שעון ו־NTP, דיסקים ובדיקת S.M.A.R.T., יציאות אזעקה, הפעלה מחדש · כל כתיבה דורשת הרשאה רגישה ונרשמת" data-nvr-system>
      ${this.sysError ? html`<div class="hint" data-nvr-system-error>${this.sysError}</div>` : nothing}
      ${!s
        ? this.sysError ? nothing : html`<div class="hint">קורא את מצב המערכת מה־NVR…</div>`
        : html`
          <div class="hint" style="margin-block-start:4px"><b>שעון</b></div>
          ${s.time
            ? html`${this.row('שעון ה־NVR', `${s.time.local_time ?? '—'} · ${s.time.mode === 'NTP' ? 'NTP' : 'ידני'}`)}
                ${this.row('סטייה מול שעון השרת', drift === null ? '—' : `${drift > 0 ? '+' : ''}${drift} שנ׳`, driftTone as 'ok' | 'warn' | 'err' | '')}
                ${this.row('שרת NTP', s.time.ntp ? `${s.time.ntp.host ?? '—'}:${s.time.ntp.port} · כל ${s.time.ntp.interval_min} דק׳` : '—')}
                ${s.can.time
                  ? html`<div class="actions">
                      <sw-button size="sm" icon="clock" ?disabled=${this.sysBusy} data-nvr-sync-clock @click=${() => this.sysAction('סנכרון השעון', () => setNvrTime({ sync_now: true }))}>סנכרן לשעון השרת עכשיו</sw-button>
                      <sw-button size="sm" variant="ghost" ?disabled=${this.sysBusy} data-nvr-ntp-edit @click=${() => (this.ntpForm = this.ntpForm ? null : { host: s.time?.ntp?.host ?? '', port: s.time?.ntp?.port ?? 123, interval_min: s.time?.ntp?.interval_min || 1440 })}>שרת NTP…</sw-button>
                    </div>
                    ${this.ntpForm
                      ? html`<div class="two" data-nvr-ntp-form>
                          <sw-field label="שרת NTP"><input data-ltr .value=${this.ntpForm.host} @input=${(e: Event) => (this.ntpForm = { ...this.ntpForm!, host: (e.target as HTMLInputElement).value })} /></sw-field>
                          <sw-field label="מרווח (דקות)"><input type="number" min="1" max="10080" data-ltr .value=${String(this.ntpForm.interval_min)} @input=${(e: Event) => (this.ntpForm = { ...this.ntpForm!, interval_min: Number((e.target as HTMLInputElement).value) })} /></sw-field>
                          <div class="actions"><sw-button size="sm" variant="primary" ?disabled=${this.sysBusy || !this.ntpForm.host} data-nvr-ntp-save @click=${() => { const f = this.ntpForm!; void this.sysAction('שרת NTP', async () => { await setNvrNtp({ host: f.host.trim(), port: f.port, interval_min: f.interval_min }); this.ntpForm = null; }); }}>כתוב ל־NVR</sw-button></div>
                        </div>`
                      : nothing}`
                  : html`<div class="hint">כתיבת שעון / NTP: הרשאה nvr.config.time (תפקיד מותאם).</div>`}`
            : html`<div class="hint">השעון לא נקרא${s.errors.time ? ` (${s.errors.time})` : ''}.</div>`}
          <div class="hint" style="margin-block-start:10px"><b>דיסקים</b></div>
          ${s.disks.length
            ? s.disks.map((d) => html`<div data-nvr-disk=${d.id}>
                ${this.row(`${d.name} (${d.type})`, `${d.status} · ${gb(d.capacity_mb)} · פנוי ${gb(d.free_mb)} (${d.capacity_mb ? Math.round((d.free_mb / d.capacity_mb) * 100) : 0}%)`, d.status === 'ok' ? 'ok' : 'warn')}
                ${d.smart
                  ? this.row('S.M.A.R.T.', `${d.smart.all_eval ?? '—'} · ${d.smart.temperature_c ?? '—'}°C · ${d.smart.power_on_days ?? '—'} ימי פעילות${d.smart.test_status ? ` · בדיקה: ${d.smart.test_status} ${d.smart.test_percent}%` : ''}`, d.smart.all_eval === 'functional' ? 'ok' : 'warn')
                  : this.row('S.M.A.R.T.', 'לא זמין')}
                ${s.can.storage ? html`<div class="actions"><sw-button size="sm" icon="storage" ?disabled=${this.sysBusy} data-nvr-smart-test=${d.id} @click=${() => this.sysAction('בדיקת S.M.A.R.T. קצרה', () => startSmartTest(d.id, 'short'))}>בדיקת S.M.A.R.T. קצרה</sw-button><span class="hint">מעמיסה את הדיסק בזמן ריצתה; מומלץ בשעות שקטות</span></div>` : nothing}
              </div>`)
            : html`<div class="hint">לא נקראו דיסקים${s.errors.disks ? ` (${s.errors.disks})` : ''}.</div>`}
          <div class="hint" style="margin-block-start:10px"><b>יציאות אזעקה</b></div>
          ${s.outputs.length
            ? s.outputs.map((o) => html`<div class="check" data-nvr-output=${o.id}><span>יציאה ${o.id}${o.name ? ` · ${o.name}` : ''} <span class="hint">${o.io_type === 'local' ? 'ממסר ב־NVR' : 'במצלמה'} · ${o.use_type === 'whiteLight' ? 'אור לבן' : o.use_type === 'disable' ? 'לא בשימוש' : o.use_type}${o.pulse_ms ? ` · פולס ${o.pulse_ms / 1000} שנ׳` : ''}</span></span>
                ${!o.pulse_supported
                  ? html`<span class="val" data-nvr-output-unsupported>הפעלה דרך המצלמה בלבד (ה־NVR לא מעביר)</span>`
                  : s.can.alarm ? html`<sw-button size="sm" icon="bell" ?disabled=${this.sysBusy || !o.enabled} data-nvr-pulse=${o.id} @click=${() => this.sysAction(`הפעלת יציאה ${o.id}`, () => pulseNvrOutput(o.id))}>הפעל (pulse)</sw-button>` : html`<span class="val">${o.enabled ? 'פעיל' : 'כבוי'}</span>`}
              </div>`)
            : html`<div class="hint">אין יציאות${s.errors.outputs ? ` (${s.errors.outputs})` : ''}.</div>`}
          <div class="hint" style="margin-block-start:10px"><b>הפעלה מחדש</b></div>
          ${s.can.reboot
            ? html`<div class="actions"><sw-button size="sm" variant="danger" icon="refresh" ?disabled=${this.sysBusy} data-nvr-reboot @click=${() => { this.rebootWord = ''; this.rebootOpen = true; }}>הפעל מחדש את ה־NVR…</sw-button><span class="hint">1–2 דקות בלי לייב ובלי הקלטה</span></div>`
            : html`<div class="hint">הפעלה מחדש: הרשאה nvr.system.reboot (תפקיד מותאם).</div>`}
          ${this.sysMsg ? html`<div class="hint" data-nvr-system-msg>${this.sysMsg}</div>` : nothing}`}
      ${this.rebootOpen
        ? html`<sw-dialog open heading="הפעלה מחדש של ה־NVR" subheading="במשך 1–2 דקות אין לייב ואין הקלטה" data-nvr-reboot-dialog @close=${() => (this.rebootOpen = false)}>
            <div style="font-size:var(--sw-fs-sm);line-height:1.6">הקלד <b>RESTART</b> כדי לאשר. הפעולה נרשמת באודיט עם שם המשתמש.</div>
            <sw-field label="אישור"><input data-ltr data-nvr-reboot-word .value=${this.rebootWord} @input=${(e: Event) => (this.rebootWord = (e.target as HTMLInputElement).value)} /></sw-field>
            <div slot="footer"><sw-button variant="danger" ?disabled=${this.sysBusy || this.rebootWord.trim().toUpperCase() !== 'RESTART'} data-nvr-reboot-run @click=${() => { const w = this.rebootWord; this.rebootOpen = false; void this.sysAction('הפעלה מחדש', () => rebootNvr(w)); }}>הפעל מחדש</sw-button><sw-button variant="ghost" @click=${() => (this.rebootOpen = false)}>ביטול</sw-button></div>
          </sw-dialog>`
        : nothing}
    </sw-card>`;
  }

  private renderConnectionCard() {
    const v = this.connection;
    if (!v) return nothing;
    const f = this.connForm;
    return html`<sw-card heading="חיבור ל־NVR" subheading=${v.in_addon ? 'נשמר ב־Add-on options דרך ה־Supervisor; שמירה מפעילה מחדש את ה־Add-on' : 'נשמר ליד הנתונים (nvr_connection.json); בתוקף מיד'} data-nvr-connection>
      ${this.row('כתובת · פורט HTTP · RTSP', `${v.host ?? '—'} · ${v.http_port} · ${v.rtsp_port}`)}
      ${this.row('משתמש', `${v.user ?? '—'} · ${v.has_password ? 'סיסמה מוגדרת' : 'ללא סיסמה'}`, v.has_password ? 'ok' : 'warn')}
      ${f
        ? html`<div class="two" data-nvr-connection-form>
            <sw-field label="כתובת"><input data-ltr data-conn-host .value=${f.host} @input=${(e: Event) => (this.connForm = { ...f, host: (e.target as HTMLInputElement).value })} /></sw-field>
            <sw-field label="פורט HTTP"><input type="number" data-ltr .value=${String(f.http_port)} @input=${(e: Event) => (this.connForm = { ...f, http_port: Number((e.target as HTMLInputElement).value) })} /></sw-field>
            <sw-field label="פורט RTSP"><input type="number" data-ltr .value=${String(f.rtsp_port)} @input=${(e: Event) => (this.connForm = { ...f, rtsp_port: Number((e.target as HTMLInputElement).value) })} /></sw-field>
            <sw-field label="משתמש"><input data-ltr data-conn-user .value=${f.user} @input=${(e: Event) => (this.connForm = { ...f, user: (e.target as HTMLInputElement).value })} /></sw-field>
            <sw-field label="סיסמה (ריק = ללא שינוי)"><input type="password" data-ltr data-conn-password .value=${f.password} @input=${(e: Event) => (this.connForm = { ...f, password: (e.target as HTMLInputElement).value })} /></sw-field>
            <div class="actions">
              <sw-button size="sm" variant="primary" icon="check" ?disabled=${this.connBusy || !f.host || !f.user} data-conn-save @click=${() => this.saveConnection()}>${this.connBusy ? 'בודק…' : 'בדוק ושמור'}</sw-button>
              <sw-button size="sm" variant="ghost" ?disabled=${this.connBusy} @click=${() => (this.connForm = null)}>ביטול</sw-button>
            </div>
            <div class="hint">הבדיקה קוראת deviceInfo עם הפרטים החדשים; בלי הצלחה לא נשמר דבר.</div>
          </div>`
        : html`<div class="actions"><sw-button size="sm" icon="edit" data-conn-edit @click=${() => (this.connForm = { host: v.host ?? '', http_port: v.http_port, rtsp_port: v.rtsp_port, user: v.user ?? '', password: '' })}>עריכת פרטי החיבור</sw-button></div>`}
      ${this.connMsg ? html`<div class="hint" data-conn-msg>${this.connMsg}</div>` : nothing}
    </sw-card>`;
  }

  private planNotify(channels: number[] | null, smart: boolean, enabled: boolean) {
    const n = channels ? channels.length : this.notify?.channels.length ?? 0;
    this.notifyResult = '';
    this.notifyPlan = { channels, smart, enabled, label: `${enabled ? 'הפעלת' : 'כיבוי'} Notify Surveillance Center ב־${n} ערוצים${smart ? ' · תנועה + אירועים חכמים' : ' · זיהוי תנועה'}` };
  }

  private async runNotify() {
    const p = this.notifyPlan;
    if (!p || this.notifyBusy) return;
    this.notifyBusy = true;
    try {
      const r = await setNotify({ channels: p.channels, smart: p.smart, enabled: p.enabled });
      this.notifyResult = `בוצע: ${r.applied} שינויים · ${r.unchanged} כבר היו כך · ${r.skipped} דולגו (סוג אירוע שלא מוגדר בערוץ) · ${r.failed} נכשלו`;
      this.notifyPlan = null;
      await this.loadNvr();
    } catch (err) {
      this.notifyResult = describeError(err);
    } finally {
      this.notifyBusy = false;
    }
  }

  private async rollback(c: NvrChange) {
    if (this.notifyBusy) return;
    this.notifyBusy = true;
    try {
      await rollbackNvrChange(c.id);
      this.notifyResult = `השינוי ${c.target} הוחזר למצב הקודם.`;
      await this.loadNvr();
    } catch (err) {
      this.notifyResult = describeError(err);
    } finally {
      this.notifyBusy = false;
    }
  }

  private renderNotifyCard() {
    const n = this.notify;
    const yes = (v: boolean | null) => (v === null ? '—' : v ? '✓' : '✗');
    return html`<sw-card heading="התראות מה־NVR (Notify Surveillance Center)" subheading="אילו ערוצים מודיעים ל־VMS על תנועה ועל אירועים חכמים · כתיבה מאושרת ל־NVR, עם החזר" data-nvr-notify>
      ${this.notifyError ? html`<div class="hint" data-nvr-notify-error>${this.notifyError}</div>` : nothing}
      ${!n
        ? this.notifyError ? nothing : html`<div class="hint">קורא את הגדרות ה־NVR…</div>`
        : html`<table class="matrix" data-nvr-matrix>
            <thead><tr><th>ערוץ</th><th>מצלמה</th><th>תנועה</th><th>אירועים חכמים</th><th></th></tr></thead>
            <tbody>${n.channels.map((c) => html`<tr data-nvr-channel=${c.channel}>
              <td class="ltr">${c.channel}</td><td>${c.name}</td>
              <td data-nvr-motion=${c.motion.supported ? String(c.motion.center) : 'none'}>${c.motion.supported ? yes(c.motion.center) : 'לא מוגדר'}</td>
              <td>${c.smart_supported ? `${c.smart_center}/${c.smart_supported}` : 'אין'}</td>
              <td>${n.can_write && c.motion.supported && !c.motion.center ? html`<sw-button size="sm" data-nvr-enable-one=${c.channel} @click=${() => this.planNotify([c.channel], false, true)}>הפעל</sw-button>` : nothing}</td>
            </tr>`)}</tbody>
          </table>
          <div class="hint">✓ = ההתראה נשלחת ל־VMS · ✗ = הערוץ מקליט אבל לא מודיע · אירועים חכמים = חציית קו, פריצה לאזור, כניסה ויציאה מאזור (רק במצלמות שמגדירות אותם).</div>
          ${n.can_write
            ? html`<div class="actions">
                <sw-button variant="primary" size="sm" icon="bell" ?disabled=${this.notifyBusy} data-nvr-enable-all @click=${() => this.planNotify(null, false, true)}>הפעל תנועה בכל הערוצים</sw-button>
                <sw-button size="sm" icon="bell" ?disabled=${this.notifyBusy} data-nvr-enable-smart @click=${() => this.planNotify(null, true, true)}>הפעל גם אירועים חכמים</sw-button>
              </div>`
            : html`<div class="hint" data-nvr-no-permission>לכתיבה ל־NVR נדרשת ההרשאה "${n.permission}" — מוקנית רק דרך תפקיד מותאם (הגדרות › משתמשים והרשאות › תפקידים), גם למנהל מערכת.</div>`}
          ${this.notifyResult ? html`<div class="hint" data-nvr-result>${this.notifyResult}</div>` : nothing}
          ${this.changes.length ? html`<div class="hint" style="margin-block-start:8px"><b>שינויים אחרונים ב־NVR</b></div>
            <ul class="changes" data-nvr-changes>${this.changes.map((c) => html`<li><span class="ltr">${c.created_at.slice(0, 16).replace('T', ' ')}</span> · ${c.target} · ${c.note || c.kind} · ${c.status === 'applied' ? 'בוצע' : c.status === 'unchanged' ? 'ללא שינוי' : c.status === 'rolled_back' ? 'הוחזר' : 'נכשל'}${c.actor_username ? ` · ${c.actor_username}` : ''}
              ${c.status === 'applied' && n.can_write ? html`<sw-button variant="ghost" size="sm" ?disabled=${this.notifyBusy} data-nvr-rollback=${c.id} @click=${() => this.rollback(c)}>החזר</sw-button>` : nothing}</li>`)}</ul>` : nothing}`}
      ${this.notifyPlan
        ? html`<sw-dialog open heading="כתיבה ל־NVR" subheading=${this.notifyPlan.label} data-nvr-confirm @close=${() => (this.notifyPlan = null)}>
            <div style="font-size:var(--sw-fs-sm);line-height:1.5">השינוי נכתב להגדרות ה־NVR בזהות המשתמש המוגדר ב־Add-on, נרשם באודיט עם המסמך לפני ואחרי, וניתן להחזרה מרשימת השינויים. הקלטות אינן מושפעות.</div>
            <div slot="footer"><sw-button variant="primary" ?disabled=${this.notifyBusy} data-nvr-confirm-run @click=${() => this.runNotify()}>${this.notifyBusy ? 'כותב…' : 'כתוב ל־NVR'}</sw-button><sw-button variant="ghost" @click=${() => (this.notifyPlan = null)}>ביטול</sw-button></div>
          </sw-dialog>`
        : nothing}
    </sw-card>`;
  }

  private renderApi() {
    const h = this.raw;
    return html`
      <sw-page heading="חיבורים" subheading="מצב החיבורים של ה־Add-on: NVR, go2rtc, Home Assistant ואחסון · קריאה בלבד · הערכים עצמם מוגדרים ב־Home Assistant › Add-ons › SMPLWISE VMS › Configuration">
        <sw-button slot="actions" icon="refresh" ?disabled=${this.busy} @click=${() => this.load()}>${this.busy ? 'בודק…' : 'רענון'}</sw-button>
        ${this.error ? html`<sw-state-panel state="error" heading="מצב החיבורים לא נטען" hint=${this.error}></sw-state-panel>` : nothing}
        ${!h
          ? this.error ? nothing : html`<sw-state-panel state="loading" heading="קורא את מצב החיבורים…"></sw-state-panel>`
          : html`<div class="two" data-connections>
              <sw-card heading="NVR (Hikvision, ISAPI + RTSP)" subheading=${h.nvr_configured ? 'מוגדר · קריאה בלבד' : 'לא מוגדר'}>
                ${this.row('מוגדר ב־Add-on options', h.nvr_configured ? 'כן' : 'לא', h.nvr_configured ? 'ok' : 'err')}
                ${this.recorder ? this.row('דגם · קושחה', `${this.recorder.model ?? '—'} · ${this.recorder.firmware ?? '—'}`) : nothing}
                ${this.row('גילוי מצלמות', `${h.discovery.cameras} ערוצים · כל ${Math.round(h.discovery.interval_s / 60)} דק׳`)}
                ${this.row('גילוי אחרון תקין', when(h.discovery.cameras_last_ok), h.discovery.cameras_last_error ? 'warn' : 'ok')}
                ${h.discovery.cameras_last_error ? this.row('שגיאת גילוי', h.discovery.cameras_last_error, 'err') : nothing}
                ${this.row('זרם התראות (alertStream)', h.events.ingest.connected ? `מחובר · פעימה ${when(h.events.ingest.last_heartbeat_at)}` : `מנותק${h.events.ingest.last_error ? ` · ${h.events.ingest.last_error}` : ''}`, h.events.ingest.connected ? 'ok' : 'err')}
                ${this.row('התראות שנשמרו מאז ההפעלה', h.events.ingest.events_stored, h.events.ingest.connected && !h.events.ingest.events_stored ? 'warn' : '')}
                ${h.events.ingest.connected && !h.events.ingest.last_event_at ? html`<div class="hint" data-no-alerts-hint>ה־NVR מחובר אבל לא שלח התראה מאז ההפעלה — ב־NVR יש להפעיל "Notify Surveillance Center" ב־linkage של זיהוי התנועה; עד אז אירועי תנועה נגזרים מההקלטות כל 10 דקות.</div>` : nothing}
                ${this.row('אירועים שנגזרו מהקלטות (ריצה אחרונה)', `${h.events.derive.derived} · ${when(h.events.derive.last_ok)}`, h.events.derive.last_error ? 'warn' : '')}
              </sw-card>
              ${this.renderNotifyCard()}
              ${this.renderSystemCard()}
              ${this.renderConnectionCard()}
              <sw-card heading="go2rtc (relay לווידאו)" subheading=${h.go2rtc_configured ? 'מוגדר' : 'לא מוגדר'}>
                ${this.row('מוגדר ב־Add-on options', h.go2rtc_configured ? 'כן' : 'לא', h.go2rtc_configured ? 'ok' : 'err')}
                ${this.row('סנכרון זרמים אחרון תקין', when(h.discovery.streams_last_ok), h.discovery.streams_last_error ? 'warn' : 'ok')}
                ${h.discovery.streams_last_error ? this.row('שגיאת סנכרון זרמים', h.discovery.streams_last_error, 'err') : nothing}
                ${this.check('go2rtc') ? this.row('בדיקת בריאות', this.check('go2rtc')!.detail, this.check('go2rtc')!.status === 'ok' ? 'ok' : this.check('go2rtc')!.status === 'warn' ? 'warn' : 'err') : html`<div class="hint">פרטי הזרמים והגרסה מוצגים ב"הגדרות › כללי › בריאות ועבודות" (דורש הרשאת ניהול).</div>`}
              </sw-card>
              <sw-card heading="Home Assistant" subheading=${h.home_assistant.connected ? `מחובר · HA ${h.home_assistant.ha_version ?? ''}` : h.home_assistant.configured ? 'מוגדר, מנותק' : 'לא מוגדר'}>
                ${this.row('חיבור', h.home_assistant.connected ? 'מחובר' : `מנותק${h.home_assistant.last_error ? ` · ${h.home_assistant.last_error}` : ''}`, h.home_assistant.connected ? 'ok' : 'err')}
                ${this.row('ישויות בקטלוג', h.home_assistant.entities)}
                ${this.row('תמונת מצב אחרונה', when(h.home_assistant.last_snapshot_at))}
                ${this.row('עדכון ישות אחרון', when(h.home_assistant.last_event_at))}
                ${this.row('רישום (אזורים / קומות) עודכן', when(h.home_assistant.last_registry_at))}
                ${this.row('התחברויות מחדש מאז ההפעלה', h.home_assistant.reconnects, h.home_assistant.reconnects > 3 ? 'warn' : '')}
                ${this.row('מקור הזהות', h.identity_source === 'ingress' ? 'Home Assistant Ingress' : h.identity_source)}
              </sw-card>
              <sw-card heading="אחסון וכלים" subheading=${`גרסה ${h.version}`}>
                ${this.row('בסיס הנתונים', h.db.ok ? `תקין · מהדורת הרשאות ${h.db.permission_revision}` : 'שגיאה', h.db.ok ? 'ok' : 'err')}
                ${this.row('תיקיית הנתונים (/data)', h.data_dir_writable ? 'ניתנת לכתיבה' : 'לא ניתנת לכתיבה', h.data_dir_writable ? 'ok' : 'err')}
                ${this.row('ממיר תוכניות PDF', h.renderer ?? 'חסר', h.renderer ? 'ok' : 'warn')}
                ${this.row('אירועים שמורים', h.events.stored)}
                ${this.check('thumbnails') ? this.row('תמונות אירועים (ffmpeg)', this.check('thumbnails')!.detail, this.check('thumbnails')!.status === 'ok' ? 'ok' : 'warn') : nothing}
                ${this.check('backups') ? this.row('גיבויים', this.check('backups')!.detail, this.check('backups')!.status === 'ok' ? 'ok' : 'warn') : nothing}
              </sw-card>
            </div>
            <sw-card heading="איפה מגדירים" subheading="הערכים אינם מוצגים כאן ואינם נשמרים ב־VMS; שינוי דורש הפעלה מחדש של ה־Add-on">
              <div class="opts" data-connection-options>
                ${OPTIONS.map((o) => html`<div class="check"><span>${o.label}</span><span class="val ltr">${o.key}</span></div>`)}
              </div>
              <div class="hint">Home Assistant › הגדרות › Add-ons › SMPLWISE VMS › Configuration. משתמש ה־NVR צריך הרשאות צפייה והקלטות בלבד; ה־VMS לא כותב ל־NVR.</div>
            </sw-card>`}
      </sw-page>
    `;
  }

  static styles = css`
    .matrix {
      inline-size: 100%;
      border-collapse: collapse;
      font-size: var(--sw-fs-sm);
      margin-block: 6px;
    }
    .matrix th,
    .matrix td {
      text-align: start;
      padding: 4px 8px;
      border-block-end: 1px solid var(--sw-border);
    }
    .matrix th {
      color: var(--sw-text-3);
      font-weight: 500;
      font-size: var(--sw-fs-xs);
    }
    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-block-start: 8px;
    }
    ul.changes {
      margin: 4px 0 0;
      padding-inline-start: 18px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    ul.changes li {
      margin-block: 2px;
    }
    .wrap {
      max-inline-size: 760px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .check {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .check:last-child {
      border-block-end: 0;
    }
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .val {
      color: var(--sw-text-2);
      text-align: start;
      max-inline-size: 60%;
      overflow-wrap: anywhere;
    }
    .val.ok {
      color: var(--sw-success, #15803d);
    }
    .val.warn {
      color: var(--sw-warning, #b45309);
    }
    .val.err {
      color: var(--sw-danger);
      font-weight: 600;
    }
    .opts {
      columns: 2;
      column-gap: 24px;
    }
    .opts .check {
      break-inside: avoid;
    }
    @media (max-width: 767px) {
      .two {
        grid-template-columns: 1fr;
      }
      .opts {
        columns: 1;
      }
    }
    .foot {
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }
    .scan {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 18px 0 14px;
      text-align: center;
    }
    .scan .ic {
      display: grid;
      place-items: center;
      inline-size: 48px;
      block-size: 48px;
      border-radius: 50%;
      background: var(--sw-accent-soft);
      color: var(--sw-accent);
      margin-block-end: 4px;
    }
    .scan b {
      font-size: var(--sw-fs-md);
    }
    .track {
      block-size: 6px;
      border-radius: 3px;
      background: var(--sw-surface-3);
      overflow: hidden;
      inline-size: 100%;
      max-inline-size: 420px;
      margin-block: 8px 4px;
    }
    .track i {
      display: block;
      block-size: 100%;
      inline-size: 72%;
      background: var(--sw-accent);
      border-radius: 3px;
    }
    .found {
      font-size: var(--sw-fs-xs);
      color: var(--sw-accent-text);
    }
    .dev {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .dev:last-child {
      border-block-end: 0;
    }
    .dev .grow {
      flex: 1;
    }
    .dev .ip {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      font-family: var(--sw-font-mono);
      direction: ltr;
    }
    .users label {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    @media (max-width: 767px) {
      .two {
        grid-template-columns: 1fr;
      }
    }
  `;

  private renderStep() {
    switch (this.step) {
      case 0:
        return html`<sw-card heading="גילוי מכשירים" subheading="חיפוש NVR ומצלמות ברשת המקומית · קריאה בלבד, ללא שינוי תצורה במכשיר">
          <div class="scan">
            <div class="ic"><sw-icon name="wifi" size=${22}></sw-icon></div>
            <b>סורק את הרשת…</b>
            <span class="hint">מחפש NVR, מצלמות ומכשירים תואמים. זה עשוי לקחת כמה רגעים.</span>
            <div class="track"><i></i></div>
            <span class="found">3 מכשירים נמצאו</span>
          </div>
          <div class="dev"><input type="checkbox" checked aria-label="בחר" /><span>NVR ראשי</span><span class="ip">192.168.x.x</span><span class="grow"></span><span class="hint">10 ערוצים</span><sw-button size="sm" variant="primary">הוסף הכל</sw-button></div>
          <div class="dev"><input type="checkbox" checked aria-label="בחר" /><span>מצלמת כניסה</span><span class="ip">192.168.x.x</span><span class="grow"></span><span class="hint">ONVIF</span><sw-button size="sm">הוסף</sw-button></div>
          <div class="dev"><input type="checkbox" aria-label="בחר" /><span>מצלמת חניה</span><span class="ip">192.168.x.x</span><span class="grow"></span><span class="hint">RTSP</span><sw-button size="sm">הוסף</sw-button></div>
        </sw-card>`;
      case 1:
        return html`<sw-card heading="חיבור ל־NVR">
          <div class="two">
            <sw-field label="כתובת"><input data-ltr placeholder="192.168.x.x" /></sw-field>
            <sw-field label="פורט HTTP"><input data-ltr value="80" /></sw-field>
            <sw-field label="משתמש"><input data-ltr placeholder="smplwise" /></sw-field>
            <sw-field label="סיסמה"><input type="password" data-ltr /></sw-field>
          </div>
          <div class="hint">מומלץ משתמש ייעודי לא־admin. בדיקת החיבור קוראת deviceInfo, time ו־capabilities בלבד.</div>
        </sw-card>`;
      case 2:
        return html`<sw-card heading="go2rtc חיצוני">
          <div class="two">
            <sw-field label="כתובת API"><input data-ltr value="http://…:1984" /></sw-field>
            <sw-field label="אימות API (מומלץ)"><input data-ltr placeholder="user:password" /></sw-field>
          </div>
          <div class="check"><span>גרסה</span><sw-badge kind="live" label="1.9.x"></sw-badge></div>
          <div class="check"><span>שמירת זרמים לקובץ ההגדרות</span><sw-badge kind="stale" label="כן: המוצר ישתמש במאגר slots קבוע"></sw-badge></div>
          <div class="check"><span>זרמים זרים (אינטרקום, מצלמות)</span><sw-badge kind="neutral" label="20 · לא ייגעו"></sw-badge></div>
        </sw-card>`;
      case 3:
        return html`<sw-card heading="גשר Home Assistant">
          <div class="check"><span>אינטגרציה מותקנת</span><sw-badge kind="live" label="smplwise_vms 0.1"></sw-badge></div>
          <div class="check"><span>Pairing</span><sw-badge kind="stale" label="ממתין לאישור מנהל HA"></sw-badge></div>
          <div class="check"><span>סנכרון משתמשים</span><sw-badge kind="unknown" label="טרם בוצע"></sw-badge></div>
          <div class="check"><span>Ingress: זהות משתמש מהכותרות</span><sw-badge kind="live" label="מאומת מול ה־proxy"></sw-badge></div>
          <div class="hint">ה־Bridge מספק קטלוג מצומצם ומבצע פעולות בשם המשתמש. אין קריאת config/auth/list מהדפדפן ואין קידום משתמשים.</div>
        </sw-card>`;
      case 4:
        return html`<sw-card heading="בחירת מנהל VMS ראשון">
          <div class="hint" style="margin-block-end:8px">מנהל HA מזוהה בוחר במפורש משתמש HA קיים. אין קידום אוטומטי לכל מנהלי HA; הבחירה נרשמת פעם אחת באודיט וה־bootstrap ננעל.</div>
          <div class="users">
            <label><input type="radio" name="admin" checked /> יוני (joni)</label>
            <label><input type="radio" name="admin" /> דנה (dana) — משתמשת רגילה ב־HA, מותר</label>
            <label><input type="radio" name="admin" /> יוסי (yossi)</label>
          </div>
        </sw-card>`;
      case 5:
        return html`<sw-card heading="פרופיל שעון">
          <div class="check"><span>אזור זמן האתר</span><span class="ltr">Asia/Jerusalem</span></div>
          <div class="check"><span>שעון NVR מול שרת</span><sw-badge kind="live" label="סטייה 2 שנ׳"></sw-badge></div>
          <div class="check"><span>פרשנות זמני חיפוש</span><sw-badge kind="stale" label="שעון מקומי (פרופיל דגם)"></sw-badge></div>
          <div class="hint">אין הזזה קבועה של שעות. שעון קיץ/חורף לפי התאריך המבוקש.</div>
        </sw-card>`;
      default:
        return html`<sw-card heading="מצלמה ומפה ראשונות">
          <div class="check"><span>ערוצים שהתגלו</span><span>10 (ללא נוסחת track)</span></div>
          <div class="check"><span>קומה ראשונה</span><span>קומה 0 · תוכנית: להעלות</span></div>
          <div class="check"><span>Add-on</span><sw-badge kind="live" label="רץ · /data מתמשך"></sw-badge></div>
          <div class="check"><span>panel_admin</span><sw-badge kind="neutral" label="false"></sw-badge></div>
          <div class="check"><span>משתמש רגיל דרך Ingress</span><sw-badge kind="stale" label="לבדיקה (T081)"></sw-badge></div>
          <div class="hint">גילוי אינו משנה תצורה במכשיר. הצבה על המפה יוצרת Binding בלבד.</div>
        </sw-card>`;
    }
  }

  render() {
    if (isApi()) return this.renderApi();
    return html`
      <sw-page heading="אשף התקנה" subheading="גילוי NVR ומצלמות, בדיקת זרמים, שמות וקומות · בדיקות קריאה בלבד · נתוני הדגמה">
        <div class="wrap">
          <sw-card><sw-steps .steps=${STEPS} .current=${this.step}></sw-steps></sw-card>
          ${this.renderStep()}
          <div class="foot">
            <sw-button variant="ghost" ?disabled=${this.step === 0} @click=${() => (this.step = Math.max(0, this.step - 1))}>הקודם</sw-button>
            <div style="display:flex;gap:8px">
              <sw-button>ביטול</sw-button>
              <sw-button variant="primary" @click=${() => (this.step = Math.min(STEPS.length - 1, this.step + 1))}>${this.step === STEPS.length - 1 ? 'סיום' : 'הבא'}</sw-button>
            </div>
          </div>
        </div>
      </sw-page>
    `;
  }
}
