import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-tabs';
import '../components/sw-field';
import '../components/sw-toggle';
import '../components/sw-icon';
import { demoHealth, demoJobs } from '../fixtures/catalog';
import { isApi } from '../api/session';
import { getSettings, listSessions, listStreams, patchSettings, syncStreams, type ProductSettings } from '../api/media';
import { invalidateSettings } from '../api/prefs';
import { describeError } from '../api/client';

const TABS = [
  { id: 'general', label: 'כללי' },
  { id: 'media', label: 'וידאו ומדיה' },
  { id: 'health', label: 'בריאות ועבודות' },
  { id: 'backup', label: 'גיבוי ושחזור' },
  { id: 'support', label: 'תמיכה' },
];

/** SC28 — system settings (board 3 screen 23): underline tabs, label / control rows; the media tab is live against the backend. */
@customElement('system-diagnostics')
export class SystemDiagnostics extends LitElement {
  @state() private tab = 'general';
  @state() private settings: ProductSettings | null = null;
  @state() private canEdit = false;
  @state() private draft: Partial<ProductSettings> = {};
  @state() private streams: { name: string; online: boolean }[] | null = null;
  @state() private go2rtc: Record<string, unknown> | null = null;
  @state() private foreign = 0;
  @state() private sessions: { id: string; camera_id: string; stream: string; username: string; seconds: number; bytes_down: number }[] = [];
  @state() private busy = false;
  @state() private message = '';
  @state() private error = '';

  static styles = css`
    .sections {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-inline-size: 760px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 9px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .row:last-child {
      border-block-end: 0;
    }
    .row .lbl {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .row .ctl {
      inline-size: 220px;
      flex-shrink: 0;
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .ok {
      color: #15803d;
      font-size: var(--sw-fs-xs);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-xs);
    }
    .health {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .health .dot {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-stale);
    }
    .foot {
      display: flex;
      gap: 8px;
      padding-block-start: 10px;
    }
    .bar {
      block-size: 6px;
      border-radius: 3px;
      background: var(--sw-surface-3);
      inline-size: 140px;
      overflow: hidden;
    }
    .bar i {
      display: block;
      block-size: 100%;
      background: var(--sw-accent);
      inline-size: var(--p);
    }
    .bar.fail i {
      background: var(--sw-danger);
    }
    .stream {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-size: var(--sw-fs-xs);
      padding: 5px 0;
      border-block-end: 1px solid var(--sw-border);
      font-family: var(--sw-font-mono);
      direction: ltr;
    }
    @media (max-width: 767px) {
      .row {
        flex-direction: column;
        align-items: stretch;
      }
      .row .ctl {
        inline-size: auto;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    void this.loadSettings();
  }

  private async loadSettings() {
    if (!isApi()) return;
    try {
      const r = await getSettings();
      this.settings = r.settings;
      this.canEdit = r.can_edit;
      this.draft = {};
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private async loadMedia() {
    if (!isApi() || !this.canEdit) return;
    try {
      const [s, sess] = await Promise.all([listStreams(), listSessions()]);
      this.streams = s.streams;
      this.go2rtc = s.go2rtc;
      this.foreign = s.foreign_streams;
      this.sessions = sess.sessions;
      this.error = '';
    } catch (err) {
      this.streams = [];
      this.error = describeError(err);
    }
  }

  private set<K extends keyof ProductSettings>(key: K, value: ProductSettings[K]) {
    this.draft = { ...this.draft, [key]: value };
  }

  private value<K extends keyof ProductSettings>(key: K): ProductSettings[K] | undefined {
    return (this.draft[key] ?? this.settings?.[key]) as ProductSettings[K] | undefined;
  }

  private async save() {
    if (!Object.keys(this.draft).length) return;
    this.busy = true;
    this.error = '';
    try {
      const r = await patchSettings(this.draft);
      this.settings = r.settings;
      this.draft = {};
      invalidateSettings();
      this.message = 'ההגדרות נשמרו';
      setTimeout(() => (this.message = ''), 2500);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async sync() {
    this.busy = true;
    this.error = '';
    try {
      const r = await syncStreams();
      this.message = `זרמים: ${r.created} נוצרו, ${r.updated} עודכנו, ${r.unchanged} ללא שינוי · ${r.foreign_streams_untouched} זרמים זרים לא נגעו`;
      await this.loadMedia();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private renderGeneral() {
    return html`<div class="sections">
      <sw-card heading="זמן ומיקום">
        <div class="row"><span class="lbl">אזור זמן לתצוגה<span class="muted">פנימית הכל UTC; שעון קיץ לפי התאריך המבוקש</span></span><sw-field class="ctl"><select><option>(UTC+02:00) Asia/Jerusalem</option></select></sw-field></div>
        <div class="row"><span class="lbl">פרופיל זמן של ה־NVR<span class="muted">נקבע לפי ראיות לדגם ולקושחה</span></span><sw-field class="ctl"><select><option>hikvision · ds-76xx · שעון מקומי</option></select></sw-field></div>
        <div class="row"><span class="lbl">NTP במכשיר<span class="muted">pool.ntp.org · סטייה 2 שנ׳</span></span><sw-toggle checked label="פעיל"></sw-toggle></div>
      </sw-card>
      <sw-card heading="מדיניות אחסון (קריאה מה־NVR)">
        <div class="row"><span class="lbl">שמירת הקלטות</span><sw-field class="ctl"><select disabled><option>לפי מקום פנוי (overwrite)</option></select></sw-field></div>
        <div class="row"><span class="lbl">כשהאחסון מתמלא</span><sw-field class="ctl"><select disabled><option>דריסת הישן ביותר</option></select></sw-field></div>
        <div class="row"><span class="lbl">התראת אחסון נמוך<span class="muted">מתחת ל־10% פנוי</span></span><sw-toggle checked label="פעיל"></sw-toggle></div>
      </sw-card>
      <sw-card heading="אינטגרציות">
        <div class="row"><span class="lbl">go2rtc (חיצוני)<span class="muted">זרמים בשם smplwise_* בלבד · זרמים זרים לא ייגעו</span></span><span style="display:flex;gap:8px;align-items:center"><sw-toggle checked label="מופעל"></sw-toggle><sw-button size="sm" @click=${() => { this.tab = 'media'; void this.loadMedia(); }}>הגדרה</sw-button></span></div>
        <div class="row"><span class="lbl">גשר Home Assistant<span class="muted">קטלוג ישויות ופעולות בשם המשתמש (T025)</span></span><span style="display:flex;gap:8px;align-items:center"><sw-toggle label="טרם"></sw-toggle><sw-button size="sm" disabled>הגדרה</sw-button></span></div>
      </sw-card>
      <sw-card heading="בריאות המערכת">
        <div class="row"><span class="health"><i class="dot"></i><span class="lbl">מצב חלקי<span class="muted">גשר HA טרם חובר · שאר הרכיבים תקינים</span></span></span><sw-button size="sm" icon="activity">הרצת דיאגנוסטיקה</sw-button></div>
      </sw-card>
    </div>`;
  }

  private renderMedia() {
    const api = isApi();
    const dirty = Object.keys(this.draft).length > 0;
    return html`<div class="sections">
      <sw-card heading="תעבורת וידאו" subheading="ברירת המחדל לכל הנגנים; כל נגן יכול לעקוף אותה לדפדפן הנוכחי">
        <div class="row"><span class="lbl">תעבורה ברירת מחדל<span class="muted">אוטומטי = WebRTC ואם נכשל MSE · WebRTC דורש UDP לרשת המקומית · MSE עובד גם דרך Ingress/Cloudflare</span></span>
          <sw-field class="ctl"><select ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.set('media.transport_default', (e.target as HTMLSelectElement).value as ProductSettings['media.transport_default'])}>
            ${(['auto', 'webrtc', 'mse'] as const).map((t) => html`<option value=${t} ?selected=${(this.value('media.transport_default') ?? 'auto') === t}>${t === 'auto' ? 'אוטומטי (WebRTC → MSE)' : t === 'webrtc' ? 'WebRTC בלבד' : 'MSE בלבד'}</option>`)}
          </select></sw-field></div>
        <div class="row"><span class="lbl">פרופיל לקיר המצלמות<span class="muted">משני חוסך CPU ורוחב פס; ראשי לתצוגה בודדת</span></span>
          <sw-field class="ctl"><select ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.set('media.wall_profile', (e.target as HTMLSelectElement).value as 'sub' | 'main')}>
            <option value="sub" ?selected=${(this.value('media.wall_profile') ?? 'sub') === 'sub'}>משני</option><option value="main" ?selected=${this.value('media.wall_profile') === 'main'}>ראשי</option>
          </select></sw-field></div>
        <div class="row"><span class="lbl">מקסימום זרמים חיים במקביל<span class="muted">מגן על ה־NVR; מעבר למכסה מוצג צילום בלבד</span></span><sw-field class="ctl"><input type="number" min="1" max="32" data-ltr ?disabled=${!api || !this.canEdit} .value=${String(this.value('media.max_live_sessions') ?? 8)} @change=${(e: Event) => this.set('media.max_live_sessions', Number((e.target as HTMLInputElement).value))} /></sw-field></div>
        <div class="row"><span class="lbl">רעננות צילום (שניות)<span class="muted">snapshot מה־NVR לאריחים; cache בשרת</span></span><sw-field class="ctl"><input type="number" min="5" max="3600" data-ltr ?disabled=${!api || !this.canEdit} .value=${String(this.value('snapshots.max_age_s') ?? 60)} @change=${(e: Event) => this.set('snapshots.max_age_s', Number((e.target as HTMLInputElement).value))} /></sw-field></div>
        <div class="foot"><sw-button variant="primary" icon="check" ?disabled=${!dirty || this.busy || !api} @click=${() => this.save()}>שמור</sw-button>${this.message ? html`<span class="ok" style="align-self:center">${this.message}</span>` : nothing}${this.error ? html`<span class="err" style="align-self:center">${this.error}</span>` : nothing}</div>
        ${!api ? html`<div class="muted">נתוני הדגמה: ההגדרות נשמרות רק מול השרת.</div>` : nothing}
      </sw-card>
      <sw-card heading="go2rtc" subheading="זרמים של המוצר בשרת החיצוני (קריאה); זרמים זרים אינם מוצגים ואינם משתנים">
        ${!api || !this.canEdit
          ? html`<div class="muted">${api ? 'נדרשת הרשאת מנהל מערכת.' : 'נתוני הדגמה.'}</div>`
          : html`<div class="row"><span class="lbl">שרת<span class="muted">${this.go2rtc ? `גרסה ${String((this.go2rtc as { version?: string }).version ?? '?')}` : 'לא נבדק'}</span></span><span style="display:flex;gap:8px"><sw-button size="sm" icon="refresh" ?disabled=${this.busy} @click=${() => this.loadMedia()}>בדיקה</sw-button><sw-button size="sm" variant="primary" icon="link" ?disabled=${this.busy} @click=${() => this.sync()}>סנכרון זרמים</sw-button></span></div>
              ${this.streams === null ? nothing : this.streams.length ? this.streams.map((st) => html`<div class="stream"><span>${st.name}</span><span>${st.online ? 'online' : 'idle'}</span></div>`) : html`<div class="muted">אין עדיין זרמים של המוצר — לחץ "סנכרון זרמים".</div>`}
              ${this.streams !== null ? html`<div class="muted" style="margin-block-start:6px">${this.foreign} זרמים זרים (אינטרקום, מצלמות אחרות) קיימים בשרת ולא נגענו בהם.</div>` : nothing}`}
      </sw-card>
      ${api && this.canEdit
        ? html`<sw-card heading="זרמים חיים כרגע" subheading="sessions דרך ה־relay של ה־Add-on">
            ${this.sessions.length ? this.sessions.map((x) => html`<div class="row"><span class="lbl">${x.stream}<span class="muted">${x.username} · ${x.seconds} שנ׳ · ${(x.bytes_down / 1024 / 1024).toFixed(1)} MB</span></span></div>`) : html`<div class="muted">אין זרמים פתוחים.</div>`}
          </sw-card>`
        : nothing}
    </div>`;
  }

  private renderHealth() {
    return html`<div class="sections">
      <sw-card heading="מצבים נפרדים, לא נורה אחת">${demoHealth.map((h) => html`<div class="row"><span class="lbl">${h.name}<span class="muted">${h.detail}</span></span><sw-badge kind=${h.state}></sw-badge></div>`)}
        <div class="row"><span class="lbl">הקלטה ב־NVR<span class="muted">5/10 ערוצים מקליטים כרגע (לפי תצורה)</span></span><sw-badge kind="live"></sw-badge></div>
        <div class="row"><span class="lbl">זרמים פעילים<span class="muted">${isApi() ? `${this.sessions.length} דרך ה־relay` : '4 חיים · 1 ניגון · 0 יתומים'}</span></span><sw-badge kind="live"></sw-badge></div>
      </sw-card>
      <sw-card heading="תור עבודות">${demoJobs.map((j) => html`<div class="row"><span class="lbl">${j.title}<span class="muted">${j.status}</span></span><span style="display:flex;align-items:center;gap:10px"><span class="bar ${j.status.startsWith('נכשל') ? 'fail' : ''}"><i style="--p:${j.progress}%"></i></span><span class="ltr">${j.progress}%</span></span></div>`)}</sw-card>
    </div>`;
  }

  private renderBackup() {
    return html`<div class="sections">
      <sw-card heading="גיבוי">
        <div class="row"><span class="lbl">גיבוי</span><span class="muted">ה־Add-on מוגדר backup: hot — הנתונים ב־/data נכללים בגיבוי של Home Assistant</span></div>
        <div class="row"><span class="lbl">תוכן</span><span class="muted">DB, מקורות תוכניות, גרסאות, עוגנים, צילומים, הגדרות</span></div>
        <div class="row"><span class="lbl">סודות</span><span class="muted">בהגדרות ה־Add-on בלבד (options), לא במסד הנתונים</span></div>
      </sw-card>
      <sw-card heading="שדרוג ו־Rollback">
        <div class="row"><span class="lbl">גרסת Add-on</span><span class="ltr">0.1.1</span></div>
        <div class="row"><span class="lbl">סכימת DB</span><span class="ltr">1</span></div>
        <div class="row"><span class="lbl">Rollback</span><span class="muted">דרך HA (גרסה קודמת) + שחזור גיבוי</span></div>
      </sw-card>
    </div>`;
  }

  private renderSupport() {
    return html`<div class="sections"><sw-card heading="חבילת תמיכה מצונזרת">
      <div class="muted" style="padding-block-end:8px">כוללת logs עם request/session/job id, מדדים, capability matrix, גרסאות. לא כוללת וידאו, תוכניות, סודות או כתובות מלאות ללא הסכמה.</div>
      <div class="row"><span class="lbl">כלול תוכניות קומה</span><sw-toggle label="לא"></sw-toggle></div>
      <div class="row"><span class="lbl">כלול תמונות מצלמה</span><sw-toggle label="לא"></sw-toggle></div>
      <div class="foot"><sw-button variant="primary" icon="download" disabled>יצירת חבילה (בהמשך)</sw-button></div>
    </sw-card></div>`;
  }

  render() {
    return html`
      <sw-page heading="הגדרות המערכת" subheading=${isApi() ? 'תעבורת וידאו, go2rtc, מכסות ובריאות' : 'אזור זמן, מדיניות אחסון, אינטגרציות ובריאות · נתוני הדגמה'}>
        <sw-tabs underline .items=${TABS} .active=${this.tab} @change=${(e: CustomEvent<{ id: string }>) => { this.tab = e.detail.id; if (this.tab === 'media') void this.loadMedia(); }}></sw-tabs>
        ${this.tab === 'general' ? this.renderGeneral() : this.tab === 'media' ? this.renderMedia() : this.tab === 'health' ? this.renderHealth() : this.tab === 'backup' ? this.renderBackup() : this.renderSupport()}
      </sw-page>
    `;
  }
}
