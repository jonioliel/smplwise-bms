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
import { describeError, get } from '../api/client';
import { navigate, parseRoute } from '../router';
import { bridgePairing, haStatus, fmtTime, installBridge, type HaIntegrationStatus, type HaStatus } from '../api/ha';
import { DEFAULT_NAMES, applyDesign, currentDesign, designOverride, parseNames, setDesignOverride, type DesignId } from '../api/design';
import { KIND_LABEL, TABLE_LABEL, backupDownloadUrl, createBackup, deleteBackup, fmtBytes, listBackups, restoreBackup, uploadBackup, type BackupEntry } from '../api/backup';
import '../components/sw-dialog';
import { STATUS_KIND, STATUS_LABEL, fmtUptime, healthReport, type HealthReport } from '../api/health';

const TABS = [
  { id: 'general', label: 'כללי' },
  { id: 'media', label: 'וידאו ומדיה' },
  { id: 'ha', label: 'גשר Home Assistant' },
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
  @state() private version = '';
  @state() private ha: HaStatus | null = null;
  @state() private pairing: { pairing_code: string; addon_host: string; addon_url: string; paired_at: string | null } | null = null;
  @state() private showCode = false;
  @state() private regenArmed = false;
  @state() private copied = false;
  @state() private report: HealthReport | null = null;
  @state() private reportBusy = false;
  @state() private backups: BackupEntry[] | null = null;
  @state() private backupPolicy: Record<string, number> = {};
  @state() private backupBusy = false;
  @state() private backupNote = '';
  @state() private backupMsg = '';
  @state() private restoreTarget: BackupEntry | null = null;
  @state() private restoreMode: 'replace' | 'merge' = 'replace';
  @state() private restoreAccess = false;
  @state() private restoreConfirm = '';
  @state() private health: { discovery?: Record<string, unknown>; events?: { ingest: { connected: boolean; last_heartbeat_at: string | null; last_event_at: string | null; last_error: string | null; reconnects: number; events_stored: number }; derive: { last_ok: string | null; last_error: string | null; derived: number }; stored: number } } | null = null;

  static styles = css`
    code {
      font-family: var(--sw-font-mono, ui-monospace, monospace);
      font-size: var(--sw-fs-xs);
      background: var(--sw-surface-2, var(--sw-accent-soft));
      padding: 2px 6px;
      border-radius: 4px;
      direction: ltr;
      unicode-bidi: isolate;
    }
    .steps {
      margin: 0;
      padding-inline-start: 20px;
      font-size: var(--sw-fs-sm);
      line-height: 1.6;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
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
    .hgrid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 10px;
    }
    .hcard {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      padding: 10px 12px;
      background: var(--sw-surface);
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .hcard.error {
      border-color: var(--sw-danger);
    }
    .hcard.warn {
      border-color: var(--sw-stale);
    }
    .hcard .hh {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-sm);
    }
    .hcard .hd {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      line-height: 1.5;
    }
    .hsum {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-block-end: 10px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .hsum .grow {
      flex: 1;
    }
    .blist {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-block-start: 8px;
    }
    .brow {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px 12px;
      align-items: center;
      padding: 8px 10px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
    }
    .brow .name {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-sm);
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .brow .sub {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      margin-block-start: 2px;
    }
    .brow .acts {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .brow a {
      text-decoration: none;
    }
    .note-in {
      inline-size: 200px;
      border: 1px solid var(--sw-border);
      border-radius: 8px;
      padding: 6px 8px;
      font: inherit;
      color: var(--sw-text);
      background: var(--sw-surface);
    }
    .confirm-in {
      inline-size: 100%;
      border: 1px solid var(--sw-border);
      border-radius: 8px;
      padding: 8px 10px;
      font: inherit;
      font-family: var(--sw-font-mono);
      direction: ltr;
      margin-block-start: 8px;
      color: var(--sw-text);
      background: var(--sw-surface);
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
    const wanted = parseRoute().params.get('tab');
    if (wanted && TABS.some((x) => x.id === wanted)) {
      this.tab = wanted;
      if (wanted === 'health') void this.loadReport();
      if (wanted === 'backup') void this.loadBackups();
      if (wanted === 'media') void this.loadMedia();
      if (wanted === 'ha') void this.loadHa();
    }
    void this.loadSettings();
  }

  private async loadSettings() {
    if (!isApi()) return;
    try {
      const [r, h] = await Promise.all([getSettings(), get<{ version: string; discovery?: Record<string, unknown>; events?: never }>('health').catch(() => null)]);
      this.settings = r.settings;
      this.canEdit = r.can_edit;
      this.draft = {};
      this.version = h?.version ?? '';
      this.health = (h as unknown as typeof this.health) ?? null;
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

  private async loadHa(regenerate = false) {
    if (!isApi()) return;
    this.error = '';
    try {
      this.ha = await haStatus();
      if (this.canEdit) this.pairing = await bridgePairing(regenerate);
      if (regenerate) {
        this.regenArmed = false;
        this.showCode = true;
        this.message = 'נוצר קוד צימוד חדש; יש להגדיר מחדש את האינטגרציה ב־Home Assistant.';
        setTimeout(() => (this.message = ''), 4000);
      }
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private async copyCode() {
    if (!this.pairing) return;
    try {
      await navigator.clipboard.writeText(this.pairing.pairing_code);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {
      this.showCode = true;
    }
  }

  private async installBridgeNow() {
    this.busy = true;
    this.error = '';
    try {
      const st = await installBridge();
      this.message = st.state === 'installed_pending' ? 'האינטגרציה הועתקה ל־Home Assistant; הפעל מחדש את Home Assistant ואשר את הגשר שהתגלה.' : st.state === 'active' ? 'האינטגרציה פעילה.' : st.state === 'not_available' ? 'תיקיית ההגדרות של Home Assistant אינה נגישה ל־Add-on.' : `מצב: ${st.state}`;
      await this.loadHa();
      setTimeout(() => (this.message = ''), 6000);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private integrationText(i: HaIntegrationStatus): string {
    switch (i.state) {
      case 'active':
        return `פעילה ב־Home Assistant (גרסה ${i.active_version ?? '?'})`;
      case 'installed_pending':
        return `הועתקה לתיקיית ההגדרות של HA (גרסה ${i.installed_version ?? '?'}) ב־${fmtTime(i.installed_at)} · הפעל מחדש את Home Assistant ואז אשר את "SMPLWISE Bridge" שהתגלה בהגדרות → מכשירים ושירותים`;
      case 'update_pending':
        return `עודכנה לגרסה ${i.installed_version ?? '?'} אך Home Assistant עדיין מריץ ${i.active_version ?? '?'} · נדרש Restart ל־Home Assistant`;
      case 'not_installed':
        return 'טרם הועתקה';
      case 'error':
        return `ההעתקה נכשלה (${i.last_error ?? ''})`;
      default:
        return i.last_error === 'ha_config_not_mapped'
          ? 'ה־Add-on לא רואה את תיקיית ההגדרות של Home Assistant (המיפוי homeassistant_config לא ניתן) · התקנה ידנית לפי השלבים למטה'
          : i.last_error === 'source_missing'
            ? 'קבצי האינטגרציה חסרים בתמונת ה־Add-on · התקנה ידנית לפי השלבים למטה'
            : `ההתקנה האוטומטית נכשלה (${i.last_error ?? 'סיבה לא ידועה'}) · התקנה ידנית לפי השלבים למטה`;
    }
  }

  private renderIntegration(h: HaStatus) {
    const i = h.integration;
    if (!i) return nothing;
    const kind = i.state === 'active' ? 'live' : i.state === 'installed_pending' || i.state === 'update_pending' ? 'stale' : i.state === 'error' ? 'error' : 'unknown';
    const label = i.state === 'active' ? 'פעילה' : i.state === 'installed_pending' ? 'ממתינה ל־Restart' : i.state === 'update_pending' ? 'עדכון ממתין' : i.state === 'error' ? 'שגיאה' : i.state === 'not_installed' ? 'לא הותקנה' : 'לא זמין';
    return html`<div class="row"><span class="lbl">התקנת האינטגרציה ב־Home Assistant<span class="muted">${this.integrationText(i)}${i.discovery_posted_at ? ` · הוכרזה ל־Supervisor ${fmtTime(i.discovery_posted_at)}` : ''}</span></span><span style="display:flex;gap:8px;align-items:center"><sw-badge kind=${kind} label=${label}></sw-badge>${this.canEdit && i.state !== 'not_available' ? html`<sw-button size="sm" ?disabled=${this.busy} @click=${() => this.installBridgeNow()}>התקן / עדכן</sw-button>` : nothing}</span></div>`;
  }

  private renderHa() {
    if (!isApi()) {
      return html`<div class="sections"><sw-card heading="גשר Home Assistant"><div class="muted">נתוני הדגמה — הסטטוס והצימוד זמינים מול השרת.</div></sw-card></div>`;
    }
    const h = this.ha;
    const s = h?.sync;
    const p = this.pairing;
    return html`<div class="sections">
      <sw-card heading="חיבור ל־Home Assistant" subheading="קריאה בלבד: מצבים, רישום ישויות, אזורים וקומות">
        ${!h
          ? html`<div class="muted">טוען…</div>`
          : html`
            <div class="row"><span class="lbl">גישה ל־API של Home Assistant<span class="muted">${h.configured ? 'דרך ה־Supervisor (homeassistant_api) או HA_URL בפיתוח' : 'לא מוגדר — ה־Add-on לא קיבל SUPERVISOR_TOKEN'}</span></span><sw-badge kind=${h.configured ? 'live' : 'offline'}></sw-badge></div>
            <div class="row"><span class="lbl">סנכרון מצבים (WebSocket)<span class="muted">${s?.connected ? `מחובר · HA ${s.ha_version ?? '?'} · ${s.entities} ישויות · אירוע אחרון ${fmtTime(s.last_event_at)}` : `מנותק${s?.last_error ? ` · ${s.last_error}` : ''} · ${s?.reconnects ?? 0} חיבורים מחדש`}</span></span><sw-badge kind=${s?.connected ? 'live' : 'offline'}></sw-badge></div>
            <div class="row"><span class="lbl">רישום ישויות (registry)<span class="muted">עודכן ${fmtTime(s?.last_registry_at)} · תמונת מצב ${fmtTime(s?.last_snapshot_at)}</span></span><sw-button size="sm" @click=${() => navigate('/explore/entities')}>לקטלוג</sw-button></div>`}
      </sw-card>
      <sw-card heading="גשר SMPLWISE (אינטגרציה ב־Home Assistant)" subheading="פעולות על ישויות רצות רק דרך הגשר, בזהות המשתמש, לפי ההרשאות של Home Assistant">
        ${h
          ? html`${this.renderIntegration(h)}<div class="row"><span class="lbl">צימוד<span class="muted">${h.bridge.paired ? `מצומד מאז ${fmtTime(h.bridge.paired_at)}` : 'לא מצומד — פעולות HA ייחסמו עד להתקנת הגשר'}</span></span><sw-badge kind=${h.bridge.paired ? 'live' : 'stale'} label=${h.bridge.paired ? 'מצומד' : 'לא מצומד'}></sw-badge></div>
            <div class="row"><span class="lbl">ספריית משתמשי HA<span class="muted">${h.bridge.directory_users} משתמשים · עודכן ${fmtTime(h.bridge.last_directory_at)}</span></span><sw-badge kind=${h.bridge.directory_users ? 'recorded' : 'unknown'}></sw-badge></div>`
          : nothing}
        ${p
          ? html`<div class="row"><span class="lbl">כתובת ה־Add-on ברשת של HA<span class="muted">להדביק בשדה "כתובת" של האינטגרציה</span></span><code class="ltr">${p.addon_url}</code></div>
            <div class="row"><span class="lbl">קוד צימוד<span class="muted">סוד משותף; מוצג רק למנהלי מערכת ונרשם באודיט</span></span><span style="display:flex;gap:8px;align-items:center"><code class="ltr">${this.showCode ? p.pairing_code : '••••••••••••'}</code><sw-button size="sm" @click=${() => (this.showCode = !this.showCode)}>${this.showCode ? 'הסתר' : 'הצג'}</sw-button><sw-button size="sm" @click=${() => this.copyCode()}>${this.copied ? 'הועתק' : 'העתק'}</sw-button></span></div>
            <div class="row"><span class="lbl">יצירת קוד חדש<span class="muted">מבטל את הצימוד הקיים; יש להגדיר מחדש את האינטגרציה</span></span>${this.regenArmed ? html`<span style="display:flex;gap:8px"><sw-button size="sm" variant="danger" @click=${() => this.loadHa(true)}>אשר יצירה</sw-button><sw-button size="sm" variant="ghost" @click=${() => (this.regenArmed = false)}>ביטול</sw-button></span>` : html`<sw-button size="sm" @click=${() => (this.regenArmed = true)}>צור קוד חדש</sw-button>`}</div>`
          : this.canEdit
            ? nothing
            : html`<div class="muted">קוד הצימוד מוצג למנהלי מערכת בלבד.</div>`}
      </sw-card>
      <sw-card heading="התקנת הגשר (פעם אחת)">
        <ol class="steps">
          <li>ה־Add-on מעתיק בעצמו את <code class="ltr">custom_components/smplwise_bridge</code> אל תיקיית ההגדרות של Home Assistant (השורה "התקנת האינטגרציה" למעלה). אם זה לא זמין: העתק את התיקייה מהמאגר אל <code class="ltr">/config/custom_components/</code>, או הוסף את המאגר ב־HACS כ־Custom repository מסוג Integration.</li>
          <li>הפעל מחדש את Home Assistant (הגדרות → מערכת → הפעלה מחדש) כדי שהרכיב ייטען.</li>
          <li>הגדרות → מכשירים ושירותים: אשר את <strong>SMPLWISE Bridge</strong> שהתגלה (קוד הצימוד כבר מולא). אם לא הופיע: הוספת אינטגרציה → SMPLWISE Bridge והדבקת הכתובת והקוד מהמסך הזה.</li>
          <li>הסטטוס למעלה יתעדכן ל"מצומד"; ספריית המשתמשים נשלחת כל דקה ומאפשרת להקצות תפקידים למשתמשי HA.</li>
        </ol>
        <div class="muted">הגשר מריץ רק פעולות מרשימת ההיתר (תאורה, מתגים, מאווררים, תריסים, מנעולים, כפתורים, סקריפטים, סצנות) ורק עבור משתמש HA קיים ופעיל. ה־Supervisor token של ה־Add-on אינו משמש לפעולות.</div>
      </sw-card>
    </div>`;
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

  private renderDesign() {
    if (!isApi()) return nothing;
    const names = parseNames(this.value('ui.design_names'));
    const design = (this.value('ui.design') as DesignId | undefined) ?? 'a';
    const override = designOverride();
    const dirty = 'ui.design' in this.draft || 'ui.design_names' in this.draft;
    const setName = (id: DesignId, v: string) => this.set('ui.design_names', JSON.stringify({ ...names, [id]: v.slice(0, 24) }));
    return html`<sw-card heading="עיצוב הממשק" subheading=${`פעיל עכשיו בדפדפן הזה: ${names[currentDesign()]}${override ? ' (עקיפה מקומית)' : ''}`}>
      <div class="row"><span class="lbl">ברירת המחדל של המערכת<span class="muted">חל על כל המשתמשים; כל אחד יכול לעקוף בדפדפן שלו</span></span><sw-field class="ctl"><select ?disabled=${!this.canEdit} @change=${(e: Event) => this.set('ui.design', (e.target as HTMLSelectElement).value as DesignId)}><option value="a" ?selected=${design === 'a'}>${names.a}</option><option value="b" ?selected=${design === 'b'}>${names.b}</option></select></sw-field></div>
      <div class="row"><span class="lbl">שם העיצוב החדש<span class="muted">ברירת מחדל: ${DEFAULT_NAMES.a} · העיצוב מחבילת 50 המסכים</span></span><sw-field class="ctl"><input maxlength="24" ?disabled=${!this.canEdit} .value=${names.a} @change=${(e: Event) => setName('a', (e.target as HTMLInputElement).value)} /></sw-field></div>
      <div class="row"><span class="lbl">שם העיצוב הקודם<span class="muted">ברירת מחדל: ${DEFAULT_NAMES.b} · הלוחות המקוריים</span></span><sw-field class="ctl"><input maxlength="24" ?disabled=${!this.canEdit} .value=${names.b} @change=${(e: Event) => setName('b', (e.target as HTMLInputElement).value)} /></sw-field></div>
      <div class="row"><span class="lbl">בדפדפן הזה בלבד<span class="muted">עקיפה אישית שנשמרת במכשיר; לא משנה את ברירת המחדל</span></span><sw-field class="ctl"><select @change=${(e: Event) => { const v = (e.target as HTMLSelectElement).value; setDesignOverride(v === 'a' || v === 'b' ? v : null); if (v !== 'a' && v !== 'b') applyDesign(design); this.requestUpdate(); }}><option value="" ?selected=${!override}>לפי ברירת המחדל</option><option value="a" ?selected=${override === 'a'}>${names.a}</option><option value="b" ?selected=${override === 'b'}>${names.b}</option></select></sw-field></div>
      ${this.canEdit ? html`<div class="foot"><sw-button variant="primary" size="sm" icon="check" ?disabled=${!dirty || this.busy} @click=${() => this.saveDesign()}>שמור עיצוב</sw-button>${this.message && this.tab === 'general' ? html`<span class="ok" style="align-self:center">${this.message}</span>` : nothing}${this.error && this.tab === 'general' ? html`<span class="err" style="align-self:center">${this.error}</span>` : nothing}</div>` : nothing}
    </sw-card>`;
  }

  private async saveDesign() {
    await this.save();
    if (!designOverride() && this.settings) applyDesign(this.settings['ui.design'] === 'b' ? 'b' : 'a');
  }

  private renderGeneral() {
    return html`<div class="sections">
      ${this.renderDesign()}
      <sw-card heading="זמן ומיקום">
        <div class="row"><span class="lbl">אזור זמן לתצוגה<span class="muted">פנימית הכל UTC; שעון קיץ לפי התאריך המבוקש</span></span><sw-field class="ctl"><select><option>(UTC+02:00) Asia/Jerusalem</option></select></sw-field></div>
        <div class="row"><span class="lbl">פרופיל זמן של ה־NVR<span class="muted">נקבע לפי ראיות לדגם ולקושחה</span></span><sw-field class="ctl"><select><option>hikvision · ds-76xx · שעון מקומי</option></select></sw-field></div>
        ${isApi() ? nothing : html`<div class="row"><span class="lbl">NTP במכשיר<span class="muted">pool.ntp.org · סטייה 2 שנ׳</span></span><sw-toggle checked label="פעיל"></sw-toggle></div>`}
      </sw-card>
      <sw-card heading="מדיניות אחסון (קריאה מה־NVR)">
        <div class="row"><span class="lbl">שמירת הקלטות</span><sw-field class="ctl"><select disabled><option>לפי מקום פנוי (overwrite)</option></select></sw-field></div>
        <div class="row"><span class="lbl">כשהאחסון מתמלא</span><sw-field class="ctl"><select disabled><option>דריסת הישן ביותר</option></select></sw-field></div>
        <div class="row"><span class="lbl">התראת אחסון נמוך<span class="muted">מתחת ל־10% פנוי</span></span><sw-toggle checked label="פעיל"></sw-toggle></div>
      </sw-card>
      <sw-card heading="אינטגרציות">
        <div class="row"><span class="lbl">go2rtc (חיצוני)<span class="muted">זרמים בשם smplwise_* בלבד · זרמים זרים לא ייגעו</span></span><span style="display:flex;gap:8px;align-items:center"><sw-toggle checked label="מופעל"></sw-toggle><sw-button size="sm" @click=${() => { this.tab = 'media'; void this.loadMedia(); }}>הגדרה</sw-button></span></div>
        <div class="row"><span class="lbl">גשר Home Assistant<span class="muted">קטלוג ישויות, פעולות בשם המשתמש וספריית המשתמשים</span></span><sw-button size="sm" @click=${() => { this.tab = 'ha'; void this.loadHa(); }}>הגדרה</sw-button></div>
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
        <div class="row"><span class="lbl">תעבורה ברירת מחדל<span class="muted">MSE (ברירת המחדל) עובד דרך Ingress, Cloudflare ומאחורי CGNAT · WebRTC נותן השהיה נמוכה אך דורש UDP ישיר ל־go2rtc (רשת מקומית או ללא CGNAT) · אוטומטי מנסה WebRTC ונופל ל־MSE</span></span>
          <sw-field class="ctl"><select ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.set('media.transport_default', (e.target as HTMLSelectElement).value as ProductSettings['media.transport_default'])}>
            ${(['mse', 'auto', 'webrtc'] as const).map((t) => html`<option value=${t} ?selected=${(this.value('media.transport_default') ?? 'mse') === t}>${t === 'auto' ? 'אוטומטי (WebRTC → MSE)' : t === 'webrtc' ? 'WebRTC בלבד' : 'MSE (ברירת מחדל)'}</option>`)}
          </select></sw-field></div>
        <div class="row"><span class="lbl">פרופיל לקיר המצלמות<span class="muted">משני חוסך CPU ורוחב פס; ראשי לתצוגה בודדת</span></span>
          <sw-field class="ctl"><select ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.set('media.wall_profile', (e.target as HTMLSelectElement).value as 'sub' | 'main')}>
            <option value="sub" ?selected=${(this.value('media.wall_profile') ?? 'sub') === 'sub'}>משני</option><option value="main" ?selected=${this.value('media.wall_profile') === 'main'}>ראשי</option>
          </select></sw-field></div>
        <div class="row"><span class="lbl">מצלמות בקיר כברירת מחדל<span class="muted">כל דפדפן זוכר את הבחירה האחרונה שלו; זו נקודת הפתיחה. מעל מכסת הזרמים החיים האריחים מציגים צילום</span></span>
          <sw-field class="ctl"><select data-set-wall-count ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.set('ui.wall_count', Number((e.target as HTMLSelectElement).value))}>
            ${[1, 2, 4, 6, 8, 9, 12, 16, 20, 25, 32].map((n) => html`<option value=${n} ?selected=${Number(this.value('ui.wall_count') ?? 4) === n}>${n}</option>`)}
          </select></sw-field></div>
        <div class="row"><span class="lbl">פריסת קיוסק כברירת מחדל<span class="muted">עמודות × שורות בעמוד; קישור קיוסק עם cols/rows גובר</span></span>
          <sw-field class="ctl"><select data-set-kiosk-layout ?disabled=${!api || !this.canEdit} @change=${(e: Event) => { const [c, r] = (e.target as HTMLSelectElement).value.split('x').map(Number); this.set('ui.kiosk_cols', c); this.set('ui.kiosk_rows', r); }}>
            ${[[2, 2], [3, 2], [3, 3], [4, 3], [4, 4], [5, 4], [6, 4]].map(([c, r]) => html`<option value=${`${c}x${r}`} ?selected=${Number(this.value('ui.kiosk_cols') ?? 3) === c && Number(this.value('ui.kiosk_rows') ?? 2) === r}>${c}×${r} · ${c * r} מצלמות</option>`)}
          </select></sw-field></div>
        <div class="row"><span class="lbl">הסתרת חיפוש AI<span class="muted">מסיר את הלשונית מהניווט; המסך עצמו נשאר זמין בכתובת</span></span>
          <sw-field class="ctl"><select data-set-hide-search ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.set('ui.hide_search', (e.target as HTMLSelectElement).value)}>
            <option value="false" ?selected=${String(this.value('ui.hide_search') ?? 'false') !== 'true'}>מוצג</option><option value="true" ?selected=${String(this.value('ui.hide_search') ?? 'false') === 'true'}>מוסתר</option>
          </select></sw-field></div>
        <div class="row"><span class="lbl">מקסימום זרמים חיים במקביל<span class="muted">מגן על ה־NVR; מעבר למכסה מוצג צילום בלבד</span></span><sw-field class="ctl"><input type="number" min="1" max="32" data-ltr ?disabled=${!api || !this.canEdit} .value=${String(this.value('media.max_live_sessions') ?? 8)} @change=${(e: Event) => this.set('media.max_live_sessions', Number((e.target as HTMLInputElement).value))} /></sw-field></div>
        <div class="row"><span class="lbl">רעננות צילום (שניות)<span class="muted">snapshot מה־NVR לאריחים; cache בשרת</span></span><sw-field class="ctl"><input type="number" min="5" max="3600" data-ltr ?disabled=${!api || !this.canEdit} .value=${String(this.value('snapshots.max_age_s') ?? 60)} @change=${(e: Event) => this.set('snapshots.max_age_s', Number((e.target as HTMLInputElement).value))} /></sw-field></div>
        <div class="row"><span class="lbl">סשני ניגון במקביל<span class="muted">כל ניגון = זרם playback אחד מה־NVR דרך go2rtc</span></span><sw-field class="ctl"><input type="number" min="1" max="16" data-ltr ?disabled=${!api || !this.canEdit} .value=${String(this.value('playback.max_sessions') ?? 4)} @change=${(e: Event) => this.set('playback.max_sessions', Number((e.target as HTMLInputElement).value))} /></sw-field></div>
        <div class="row"><span class="lbl">פקיעת סשן ניגון ללא פעילות (שניות)<span class="muted">אחרי הזמן הזה הזרם נמחק מ־go2rtc אוטומטית</span></span><sw-field class="ctl"><input type="number" min="60" max="3600" data-ltr ?disabled=${!api || !this.canEdit} .value=${String(this.value('playback.lease_s') ?? 600)} @change=${(e: Event) => this.set('playback.lease_s', Number((e.target as HTMLInputElement).value))} /></sw-field></div>
        <div class="row"><span class="lbl">גודל ייצוא מקסימלי (MB)<span class="muted">לפי הנפח המשוער של קבצי ה־NVR בטווח</span></span><sw-field class="ctl"><input type="number" min="50" max="20480" data-ltr ?disabled=${!api || !this.canEdit} .value=${String(this.value('exports.max_mb') ?? 2048)} @change=${(e: Event) => this.set('exports.max_mb', Number((e.target as HTMLInputElement).value))} /></sw-field></div>
        <div class="row"><span class="lbl">שמירת קבצי ייצוא (ימים)<span class="muted">אחרי התקופה הקבצים נמחקים מ־/data/exports</span></span><sw-field class="ctl"><input type="number" min="1" max="365" data-ltr ?disabled=${!api || !this.canEdit} .value=${String(this.value('exports.retention_days') ?? 7)} @change=${(e: Event) => this.set('exports.retention_days', Number((e.target as HTMLInputElement).value))} /></sw-field></div>
        <div class="row"><span class="lbl">אזור זמן של האתר וה־NVR<span class="muted">IANA · חיפוש והקלטות מתורגמים לשעון הקיר של ה־NVR לפי הכלל הזה (כולל שעון קיץ)</span></span><sw-field class="ctl"><input type="text" data-ltr ?disabled=${!api || !this.canEdit} .value=${String(this.value('time.zone') ?? 'Asia/Jerusalem')} @change=${(e: Event) => this.set('time.zone', (e.target as HTMLInputElement).value.trim())} /></sw-field></div>
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

  private async loadReport(fresh = false) {
    if (!isApi()) return;
    this.reportBusy = true;
    try {
      this.report = await healthReport(fresh);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.reportBusy = false;
    }
  }

  private renderReport() {
    const r = this.report;
    if (!r) return html`<div class="sections"><sw-card heading="בריאות המערכת"><div class="muted">${this.reportBusy ? 'בודק…' : 'טוען…'}</div></sw-card></div>`;
    const checked = new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(r.checked_at));
    return html`<div class="sections">
      <sw-card heading="בריאות המערכת" subheading="מצב נפרד לכל רכיב, לא נורה אחת">
        <div class="hsum"><sw-badge kind=${STATUS_KIND[r.status]} label=${r.status === 'ok' ? 'הכל תקין' : r.status === 'warn' ? 'יש מה לבדוק' : 'יש תקלה'}></sw-badge><span>גרסה <span class="ltr">${r.version}</span> · פעיל ${fmtUptime(r.uptime_s)} · נבדק <span class="ltr" data-health-checked>${checked}</span></span><span class="grow"></span><sw-button size="sm" icon="refresh" ?disabled=${this.reportBusy} @click=${() => this.loadReport(true)}>${this.reportBusy ? 'בודק…' : 'בדוק עכשיו'}</sw-button></div>
        <div class="hgrid">${r.checks.map((c) => html`<div class="hcard ${c.status}" data-health-card=${c.id}><div class="hh"><span>${c.label}</span><sw-badge kind=${STATUS_KIND[c.status]} label=${STATUS_LABEL[c.status]}></sw-badge></div><div class="hd">${c.detail}</div></div>`)}</div>
        <div class="muted" style="margin-block-start:10px">בדיקות המכשירים (NVR, go2rtc) נשמרות ${r.probe_ttl_s} שניות; "בדוק עכשיו" מריץ אותן מחדש. זרמים זרים ב־go2rtc לעולם אינם נוגעים.</div>
      </sw-card>
    </div>`;
  }

  private renderHealth() {
    if (isApi()) return this.renderReport();
    return html`<div class="sections">
      <sw-card heading="מצבים נפרדים, לא נורה אחת">${demoHealth.map((h) => html`<div class="row"><span class="lbl">${h.name}<span class="muted">${h.detail}</span></span><sw-badge kind=${h.state}></sw-badge></div>`)}
        <div class="row"><span class="lbl">הקלטה ב־NVR<span class="muted">5/10 ערוצים מקליטים כרגע (לפי תצורה)</span></span><sw-badge kind="live"></sw-badge></div>
        <div class="row"><span class="lbl">זרמים פעילים<span class="muted">${isApi() ? `${this.sessions.length} דרך ה־relay` : '4 חיים · 1 ניגון · 0 יתומים'}</span></span><sw-badge kind="live"></sw-badge></div>
        ${isApi() && this.health?.events ? html`<div class="row"><span class="lbl">קליטת אירועים מה־NVR (alertStream)<span class="muted">${this.health.events.ingest.connected ? `מחובר · פעימה אחרונה ${this.health.events.ingest.last_heartbeat_at?.replace('T', ' ').replace('Z', ' UTC') ?? '—'}` : `מנותק${this.health.events.ingest.last_error ? ` · ${this.health.events.ingest.last_error}` : ''}`} · ${this.health.events.ingest.events_stored} אירועים נקלטו · ${this.health.events.ingest.reconnects} חיבורים מחדש</span></span><sw-badge kind=${this.health.events.ingest.connected ? 'live' : 'offline'}></sw-badge></div>
        <div class="row"><span class="lbl">אירועים מהקלטות (inferred)<span class="muted">${this.health.events.derive.last_error ? `שגיאה: ${this.health.events.derive.last_error}` : this.health.events.derive.last_ok ? `עודכן ${this.health.events.derive.last_ok.replace('T', ' ').replace('Z', ' UTC')}` : 'טרם רץ'} · ${this.health.events.stored} אירועים במאגר</span></span><sw-badge kind=${this.health.events.derive.last_error ? 'stale' : 'recorded'}></sw-badge></div>` : nothing}
      </sw-card>
      <sw-card heading="תור עבודות">${demoJobs.map((j) => html`<div class="row"><span class="lbl">${j.title}<span class="muted">${j.status}</span></span><span style="display:flex;align-items:center;gap:10px"><span class="bar ${j.status.startsWith('נכשל') ? 'fail' : ''}"><i style="--p:${j.progress}%"></i></span><span class="ltr">${j.progress}%</span></span></div>`)}</sw-card>
    </div>`;
  }

  private async loadBackups() {
    if (!isApi()) return;
    try {
      const r = await listBackups();
      this.backups = r.backups;
      this.backupPolicy = r.policy;
    } catch (err) {
      this.error = describeError(err);
      this.backups = [];
    }
  }

  private async createBackup() {
    this.backupBusy = true;
    this.backupMsg = '';
    try {
      const e = await createBackup({ note: this.backupNote.trim() });
      this.backupNote = '';
      this.backupMsg = `הגיבוי ${e.name} נוצר (${fmtBytes(e.bytes)})`;
      await this.loadBackups();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.backupBusy = false;
    }
  }

  private async onBackupFile(file: File | undefined) {
    if (!file) return;
    this.backupBusy = true;
    this.backupMsg = '';
    try {
      const e = await uploadBackup(file);
      this.backupMsg = `הקובץ הועלה כ־${e.name}; עכשיו אפשר לשחזר ממנו`;
      await this.loadBackups();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.backupBusy = false;
    }
  }

  private async removeBackup(b: BackupEntry) {
    if (!window.confirm(`למחוק את הגיבוי ${b.name}?`)) return;
    this.backupBusy = true;
    try {
      await deleteBackup(b.name);
      await this.loadBackups();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.backupBusy = false;
    }
  }

  private openRestore(b: BackupEntry) {
    this.restoreTarget = b;
    this.restoreMode = 'replace';
    this.restoreAccess = false;
    this.restoreConfirm = '';
  }

  private async doRestore() {
    const b = this.restoreTarget;
    if (!b || this.restoreConfirm !== 'RESTORE') return;
    this.backupBusy = true;
    this.error = '';
    try {
      const r = await restoreBackup(b.name, { mode: this.restoreMode, scope: this.restoreAccess ? 'project+access' : 'project', confirm: this.restoreConfirm });
      const parts = Object.entries(r.tables).filter(([k]) => TABLE_LABEL[k]).map(([k, n]) => `${n} ${TABLE_LABEL[k]}`);
      this.backupMsg = `שוחזר מ־${b.name} (${r.mode === 'replace' ? 'החלפה' : 'מיזוג'}): ${parts.join(', ')} · ${r.files} קבצים`;
      this.restoreTarget = null;
      invalidateSettings();
      await this.loadBackups();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.backupBusy = false;
    }
  }

  private fmtWhen(iso: string) {
    return new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
  }

  private renderBackupRow(b: BackupEntry) {
    const counts = ['sites', 'floors', 'plan_versions', 'map_anchors', 'spatial_zones', 'cameras'].filter((k) => b.tables[k] !== undefined).map((k) => `${b.tables[k]} ${TABLE_LABEL[k]}`).join(' · ');
    return html`<div class="brow" data-backup-row>
      <div>
        <div class="name"><span class="ltr">${b.name}</span><sw-badge kind=${b.kind.startsWith('auto') ? 'neutral' : b.kind === 'upload' ? 'stale' : 'live'} label=${KIND_LABEL[b.kind] ?? b.kind}></sw-badge>${!b.valid ? html`<sw-badge kind="error" label="קובץ לא תקין"></sw-badge>` : nothing}</div>
        <div class="sub">${this.fmtWhen(b.created_at)} · ${fmtBytes(b.bytes)} · גרסה ${b.app_version ?? '?'}${b.note ? ` · ${b.note}` : ''}</div>
        ${counts ? html`<div class="sub">${counts} · ${b.files} קבצי תוכנית</div>` : nothing}
      </div>
      <div class="acts">
        <a href=${backupDownloadUrl(b.name)} download=${b.name} data-backup-download><sw-button size="sm" icon="download">הורד</sw-button></a>
        <sw-button size="sm" icon="history" ?disabled=${!b.valid || this.backupBusy} data-backup-restore @click=${() => this.openRestore(b)}>שחזר</sw-button>
        <sw-button size="sm" variant="ghost" icon="trash" ?disabled=${this.backupBusy} @click=${() => this.removeBackup(b)}>מחק</sw-button>
      </div>
    </div>`;
  }

  private renderRestoreDialog(b: BackupEntry) {
    return html`<sw-dialog open heading="שחזור גיבוי" subheading=${b.name} @close=${() => (this.restoreTarget = null)}>
      <div class="row"><span class="lbl">אופן השחזור<span class="muted">${this.restoreMode === 'replace' ? 'הנתונים הנוכחיים של הפרויקט מוחלפים במה שבגיבוי' : 'רק פריטים שחסרים היום מתווספים; הקיימים נשארים'}</span></span>
        <select data-restore-mode @change=${(e: Event) => (this.restoreMode = (e.target as HTMLSelectElement).value as 'replace' | 'merge')}><option value="replace" ?selected=${this.restoreMode === 'replace'}>החלפה</option><option value="merge" ?selected=${this.restoreMode === 'merge'}>מיזוג</option></select></div>
      <div class="row"><span class="lbl">כולל משתמשים והרשאות<span class="muted">ברירת המחדל: רק נתוני הפרויקט. ההרשאות שלך נשמרות בכל מקרה.</span></span><sw-toggle ?checked=${this.restoreAccess} label="כולל הרשאות" labelHidden @change=${(e: CustomEvent<{ checked: boolean }>) => (this.restoreAccess = e.detail.checked)}></sw-toggle></div>
      <div class="muted" style="margin-block-start:8px">הגיבוי מגרסה ${b.app_version ?? '?'} מ־${this.fmtWhen(b.created_at)}. השחזור נרשם באודיט. לאישור הקלד <code>RESTORE</code>:</div>
      <input class="confirm-in" data-restore-confirm placeholder="RESTORE" .value=${this.restoreConfirm} @input=${(e: Event) => (this.restoreConfirm = (e.target as HTMLInputElement).value)} />
      <div slot="footer"><sw-button variant="danger" icon="history" ?disabled=${this.restoreConfirm !== 'RESTORE' || this.backupBusy} data-restore-go @click=${() => this.doRestore()}>${this.backupBusy ? 'משחזר…' : 'שחזר עכשיו'}</sw-button><sw-button variant="ghost" @click=${() => (this.restoreTarget = null)}>ביטול</sw-button></div>
    </sw-dialog>`;
  }

  private renderBackup() {
    const list = this.backups ?? [];
    return html`<div class="sections">
      <sw-card heading="גיבויים של הפרויקט" subheading="אתרים, קומות, תוכניות, עוגנים, אזורים, מצלמות והגדרות · בלי סודות ובלי וידאו">
        <div class="row"><span class="lbl">גיבוי ידני עכשיו<span class="muted">נשמר בתוך התוסף (/data/backups) ואפשר להוריד למחשב</span></span>
          <span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><input class="note-in" placeholder="הערה (אופציונלי)" .value=${this.backupNote} @input=${(e: Event) => (this.backupNote = (e.target as HTMLInputElement).value)} /><sw-button variant="primary" size="sm" icon="download" ?disabled=${this.backupBusy || !isApi()} data-backup-create @click=${() => this.createBackup()}>${this.backupBusy ? 'עובד…' : 'צור גיבוי'}</sw-button></span></div>
        <div class="row"><span class="lbl">העלאת גיבוי<span class="muted">קובץ zip שהורד מכאן (גם מהתקנה קודמת); אחרי ההעלאה לוחצים "שחזר"</span></span>
          <span><input type="file" accept=".zip,application/zip" hidden @change=${(e: Event) => { const inp = e.target as HTMLInputElement; void this.onBackupFile(inp.files?.[0]); inp.value = ''; }} /><sw-button size="sm" icon="upload" ?disabled=${this.backupBusy || !isApi()} @click=${() => (this.renderRoot.querySelector('input[type=file]') as HTMLInputElement | null)?.click()}>בחר קובץ…</sw-button></span></div>
        ${this.backupMsg ? html`<div class="muted" style="color:#15803d;padding-block:6px" data-backup-msg>${this.backupMsg}</div>` : nothing}
        ${!isApi()
          ? html`<div class="muted">נתוני הדגמה: הגיבויים עובדים מול השרת.</div>`
          : this.backups === null
            ? html`<div class="muted">טוען…</div>`
            : list.length
              ? html`<div class="blist" data-backups>${list.map((b) => this.renderBackupRow(b))}</div>`
              : html`<div class="muted" style="padding-block:6px">עדיין אין גיבויים. הראשון ייווצר אוטומטית לפני העדכון הבא, או עכשיו בלחיצה.</div>`}
      </sw-card>
      <sw-card heading="אוטומטי ו־Rollback">
        <div class="row"><span class="lbl">לפני כל עדכון גרסה<span class="muted">עותק של הנתונים נכתב לפני שהגרסה החדשה נוגעת במסד; נשמרים ${this.backupPolicy['auto-pre-upgrade'] ?? 5} האחרונים</span></span><sw-badge kind="live" label="פעיל"></sw-badge></div>
        <div class="row"><span class="lbl">יומי<span class="muted">עותק אחד ביום, נשמרים ${this.backupPolicy['auto-daily'] ?? 7} האחרונים</span></span><sw-badge kind="live" label="פעיל"></sw-badge></div>
        <div class="row"><span class="lbl">Rollback<span class="muted">חוזרים לגרסה קודמת דרך Home Assistant ואז משחזרים את הגיבוי "לפני עדכון" (החלפה)</span></span><span class="ltr">${this.version || '…'}</span></div>
        <div class="row"><span class="lbl">גיבוי Home Assistant<span class="muted">ה־Add-on מוגדר backup: hot, ולכן /data (כולל הגיבויים האלה) נכלל גם בגיבוי המלא של HA</span></span></div>
      </sw-card>
    </div>
    ${this.restoreTarget ? this.renderRestoreDialog(this.restoreTarget) : nothing}`;
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
        <sw-tabs underline .items=${TABS} .active=${this.tab} @change=${(e: CustomEvent<{ id: string }>) => { this.tab = e.detail.id; if (this.tab === 'media') void this.loadMedia(); if (this.tab === 'ha') void this.loadHa(); if (this.tab === 'backup') void this.loadBackups(); if (this.tab === 'health') void this.loadReport(); }}></sw-tabs>
        ${this.message && this.tab === 'ha' ? html`<div class="muted" style="color:#15803d">${this.message}</div>` : nothing}
        ${this.error && this.tab === 'ha' ? html`<div class="muted" style="color:var(--sw-error)">${this.error}</div>` : nothing}
        ${this.tab === 'general' ? this.renderGeneral() : this.tab === 'media' ? this.renderMedia() : this.tab === 'ha' ? this.renderHa() : this.tab === 'health' ? this.renderHealth() : this.tab === 'backup' ? this.renderBackup() : this.renderSupport()}
      </sw-page>
    `;
  }
}
