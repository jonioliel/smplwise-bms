import { t } from '../i18n/he';
import { LitElement, html, css, nothing } from 'lit';
import './plan-area-links-admin';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-tabs';
import '../components/sw-field';
import '../components/sw-toggle';
import '../components/sw-icon';
import '../components/sw-remote-sessions';
import '../components/sw-csp-reports';
import '../components/recorder-health-panel'; // CR-026: per-recorder health cards and thresholds (בריאות ועבודות)
import '../components/camera-image-health-settings'; // CAMHEALTH091: the camera picture check (off by default), its thresholds and recipients
import '../components/sw-search-access';
import { sa } from '../i18n/search-access';
import { parseSearchRoles, searchModeOf } from '../api/search-access';
import '../components/sw-offbox-backup'; // DATASTORE-295 phase 2: off-box copies, encryption key, restore drill
import { logout as arxLogout } from '../arx/auth';
import { demoHealth, demoJobs } from '../fixtures/catalog';
import { can, isApi, nvrLess, onRemote, LOCAL_ONLY_GENERIC } from '../api/session';
import { getSettings, listSessions, listStreams, patchSettings, syncStreams, type ProductSettings } from '../api/media';
import { invalidateSettings, TRANSPORT_DEFAULT, transportLabel } from '../api/prefs';
import { ApiError, describeError, get } from '../api/client';
import { navigate, parseRoute, replaceRoute } from '../router';
import { settingsStyles } from '../styles/settings';
import { TabsModeController, settingsNavOf } from '../shell/tabs-mode';
import { bridgePairing, haStatus, fmtTime, installBridge, type HaIntegrationStatus, type HaStatus } from '../api/ha';
import '../components/sw-kpi';
import { TILE_LAYOUT_LABEL, TILE_LAYOUTS, resolveTileLayout, setInstallationTileLayout, setTileLayoutOverride, tileLayoutOverride, type TileLayoutSetting } from '../api/tile-layout';
import { bpt } from '../i18n/backup-password';
import { KIND_LABEL, TABLE_LABEL, backupDownloadUrl, createBackup, deleteBackup, fmtBytes, getMeterBackup, listBackups, restoreBackup, setMeterBackup, uploadBackup, type BackupEntry, type MeterBackupSetting } from '../api/backup';
import '../components/sw-dialog';
import { STATUS_KIND, STATUS_LABEL, fmtUptime, healthReport, type HealthReport } from '../api/health';
import { applyWiskeyUi, applyWiskeyHidden, applySnapshotHidden, type WiskeyScreen } from '../shell/nav';
import { setInstallWiskeyView } from '../wiskey/wiskey-prefs';
import { getSkinsStatus, runSkinsTest, type SkinsStatus, type SkinsTestResult } from '../api/skins';
import { GLASS_SCHEMES, devicesPrefsOf, setGlassScheme, type DevicesStyle } from './devices-style';
import './devices-theme-picker';
import './devices-climate-kind-admin'; // owner 2026-09-30: מיזוג / חימום per climate entity
import './devices-type-admin'; // DEVTYPE (owner 2026-10-09): סוגי התקנים - the fixed type of a switch-wired device
import './area-row-editor'; // release 0.1.149: הגדרות › חשמל והתקנים › מה מוצג ליד שם האזור
import type { AreaRowChange } from './area-row-editor';
import './devices-protected-switches-admin'; // CR-019: הגדרות › חשמל והתקנים › מתגים מוגנים (replaces פעולה קבוצתית)
import './system-tabs'; // owner 2026-09-30: הגדרות › כללי › לשוניות
import './system-nav-size'; // UI round 1b: הגדרות › כללי › גודל הניווט
import './system-design'; // design foundation: הגדרות › כללי › מראה המערכת (skin, light / dark)
import './system-look'; // Bubble foundation: הגדרות › כללי › מראה (the look dials)
import './system-plan-view'; // CR-029 ST7 UI: הגדרות › מפה › תצוגה ריאליסטית (plan.view, the person's own dials, the site location)
import './system-home-screen'; // home redesign: הגדרות › חשמל והתקנים › מסך ראשי
import './system-mobile-options'; // owner 2026-09-30: הגדרות › כללי › אפשרויות נייד
import './system-xs-options'; // 2.29.0: הגדרות › כללי › חתך הבניין והמפה הסינופטית
import './system-presence'; // CR-027: הגדרות › אפליקציה לנייד
import './system-brand-logos'; // LOGOS-295: הגדרות › כללי › מראה המערכת › לוגו ושם המערכת (company logo, size, dark background, tab title)
import './system-brand-installer'; // WHITELABEL097-295: הגדרות › כללי › מראה המערכת › מיתוג מתקין (default off)
import './system-brand-colors';// 2.4.4: הגדרות › כללי › צבעי המותג (accent, switch-on colour)
import './system-timeline-colors'; // owner 2026-10-01: הגדרות › וידאו ומדיה › צבעי ציר הזמן
import './system-video-conn-test'; // owner 2026-10-01: הגדרות › גישה מרחוק › בדיקת חיבור וידאו
import './system-wiskey-diagnostics'; // WisKey B0: הגדרות › מתגי מסכי כניסה › WisKey רואה את Arx כ־
import './system-access-display'; // CR-036 S12: הגדרות › מתגי מסכי כניסה › תצוגת מסך התחנות (the four S6 display settings)
import './system-access-parity'; // CR-036 S12: הגדרות › מתגי מסכי כניסה › השוואה למסכי האינטרקום (the side-by-side check before a screen is switched)
import { loadTree } from '../api/catalog';
import type { Site } from '../api/types';
import type { DevicesPick } from './devices-theme-picker';
import { inAndroidApp, switchServer } from '../arx/android-app';
import { SkinController } from '../design/skin';
import { BUBBLE_SCREENS_ENABLED } from '../design/skins'; // BUBBLECLEAN-297: the Look dials card is bubble-only, hidden while the skin is frozen
import { bubbleChrome } from '../styles/bubble-chrome';
import { syncDisconnectedText } from '../api/ha-sync-status';
import { OWN_MODES, QUALITY_MODES, QUALITY_MODE_HINT, QUALITY_MODE_LABEL, modeFromWire, modeToWire, ownModeFromWire, type QualityWire } from '../map/quality-mode';
import { RUNG_HE, type QualityMode } from '../map/quality-ladder';
import { loadOwnMode, saveOwnMode } from '../api/plan-quality';
import { planViewPrefs, type SiteLocation } from '../api/plan-view';
import { timeText, dayTimeText } from '../api/day-format';

/** הגדרות › מתגי מסכי כניסה: the SMPLWISE WisKey screens that can show either WisKey's own panel or the screen built here. */
const ACCESS_SCREENS: { screen: WiskeyScreen; label: string; href: string; detail: string }[] = [
  { screen: 'overview', label: 'מרכז הכניסה', href: '#/wiskey/overview', detail: 'עמדות, צלצולים, פתיחת דלת ושיחה' },
  { screen: 'events', label: 'פעילות', href: '#/wiskey/events', detail: 'יומן הכניסות והאירועים' },
  { screen: 'people', label: 'אנשים', href: '#/wiskey/people', detail: 'כולל עורך האדם וקליטת כרטיס שנפתחים ממנו' },
  { screen: 'stations', label: 'תחנות ודלתות', href: '#/wiskey/devices', detail: 'התחנות, פתיחת דלת, מענה לשיחה והכרזה; לשונית "עמדות" של WisKey' },
  { screen: 'schedules', label: 'לוחות זמנים', href: '#/wiskey/schedules', detail: 'תוכניות הדלתות, ספריית לוחות הזמנים והצעות הפריסה, לצפייה בלבד; ב־WisKey הם בכלי הניהול, ולכן בבחירת WisKey אין לשונית נפרדת' },
];

/** CR-008 D7: GET /health `video_codecs` - how many main / sub streams play over WebRTC (from the last discovery). */
interface VideoCodecs {
  cameras: number;
  checked: number;
  main: { ok: number; no: number; unknown: number };
  sub: { ok: number; no: number; unknown: number };
  checked_at: string | null;
}

/** WISKEY-ADOPT-2272 review L9: "install / update" also stages WisKey's native component when the automatic installation is on, and then
 *  requests ONE Home Assistant restart - the button says so (text only). */
export const BRIDGE_INSTALL_RESTART_WARNING = 'כשהתקנת WisKey האוטומטית פעילה, "התקן / עדכן" עלול להפעיל מחדש את Home Assistant';

/** SET-polish: one line under the page title per sub-tab - what the tab is about, as the title now names the tab. */
const TAB_SUB: Record<string, string> = {
  general: 'המראה של המערכת, הניווט, הזמן והאינטגרציות',
  tabs: 'אילו לשוניות מוצגות בכל אזור, באיזה סדר ובאיזה סגנון',
  media: 'תעבורת וידאו, קיר המצלמות, מסך הפתיחה, מכסות ושמירת נתונים',
  map: 'איך מפות הקומה נפתחות ומה מוצג בסרגל המפלסים',
  ha: 'החיבור לתשתית, הגשר והצימוד שלו',
  'access-control': 'אילו מסכי WisKey מוטמעים ואילו נבנו כאן',
  devices: 'המראה של מסכי החשמל וההתקנים לכל המשתמשים',
  remote: 'כניסה מרחוק, אימות, הכניסות הפעילות והווידאו מבחוץ',
  mobile: 'שיתוף הנתונים של אפליקציית הטלפון ומדיניות החיישנים',
  health: 'מצב נפרד לכל רכיב, הבדיקות ותור העבודות',
  backup: 'גיבויים של הפרויקט, העלאה, שחזור וגיבוי אוטומטי',
  support: 'חבילת תמיכה מצונזרת',
};

/** UXFIX-NAV-295: the settings' own first page is "מראה ותצוגה" - "כללי" is the label of the settings strip one level up (shell/nav.ts), so the strip, the
 * page title and this list each carry a different name. */
const TABS = [
  { id: 'general', label: 'מראה ותצוגה' },
  { id: 'tabs', label: 'לשוניות' }, // 2026-09-30: which tabs each navigation section shows and in which order (ui.tabs)
  { id: 'media', label: 'וידאו ומדיה' },
  { id: 'map', label: 'מפה' },
  { id: 'ha', label: 'גשר Home Assistant' },
  { id: 'access-control', label: 'מתגי מסכי כניסה' },
  { id: 'devices', label: 'חשמל והתקנים' },
  { id: 'remote', label: 'גישה מרחוק' },
  { id: 'mobile', label: 'אפליקציה לנייד' }, // CR-027: the phone app's data sharing, the employee notice, the required-sensors policy
  { id: 'health', label: 'בריאות ועבודות' },
  { id: 'backup', label: 'גיבוי ושחזור' },
  { id: 'support', label: 'תמיכה' },
];

/** SC28 — system settings (board 3 screen 23): underline tabs, label / control rows; the media tab is live against the backend. */
@customElement('system-diagnostics')
export class SystemDiagnostics extends LitElement {
  /** 0.1.157: the bubble skin's chrome keys on the host's data-skin (styles/bubble-chrome.ts). */
  readonly bubbleSkin = new SkinController(this);
  /** 0.1.157: the settings sub-tabs (11) follow the tabs mode and the dropdown style of the settings group like every other tab row. */
  // release 2.10.0: UXFIX-NAV-295's phone-only dropdown was reverted (owner rule 0.1.157: no phone-only gate; owner decision pending).
  private tabsMode = new TabsModeController(this, 'settings');
  @state() private tab = 'general';
  /** PHONENAV-295 (owner 2026-10-21): at phone width a user who chose "dropdown" (Settings > General > Tabs, a personal preference) gets the sub-pages as ONE select instead of the tab row. */
  @state() private phone = typeof matchMedia === 'function' && matchMedia('(max-width: 767px)').matches;
  private phoneMq: MediaQueryList | null = null;
  private readonly onPhoneMq = (e: MediaQueryListEvent) => { this.phone = e.matches; };
  private get phoneSelect(): boolean { return this.phone && settingsNavOf() === 'dropdown'; }
  @state() private settings: ProductSettings | null = null;
  @state() private canEdit = false;
  /** The viewer's own 3D mode (null = the installation default; undefined = not read / no backend). */
  @state() private ownQuality: QualityMode | null | undefined = undefined;
  /** CR-029 S2: the location the sun uses (GET /plan-view/prefs `location`); null = not read / no backend. */
  @state() private siteLoc: SiteLocation | null = null;
  @state() private nvrChannels: number | null = null;
  @state() private floorTree: Site[] = [];
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
  @state() private pairing: { pairing_code: string | null; key_set?: boolean; addon_host: string; addon_url: string; paired_at: string | null } | null = null;
  @state() private showCode = false;
  @state() private regenArmed = false;
  @state() private copied = false;
  @state() private report: HealthReport | null = null;
  @state() private reportBusy = false;
  @state() private backups: BackupEntry[] | null = null;
  @state() private backupPolicy: Record<string, number> = {};
  @state() private backupBusy = false;
  @state() private backupNote = '';
  /** BACKUP-HASH-ENC: typed at create / restore time, sent once, cleared right after; never stored or logged. */
  @state() private backupPassword = '';
  @state() private restorePassword = '';
  @state() private restoreSkip = false;
  @state() private restoreCanSkip = false;
  @state() private backupMinBusy = false;
  @state() private backupMsg = '';
  @state() private meterBackup: MeterBackupSetting | null = null;
  @state() private meterBackupBusy = false;
  @state() private meterBackupError = '';
  @state() private skins: SkinsStatus | null = null;
  @state() private skinsTest: SkinsTestResult | null = null;
  @state() private skinsBusy = false;
  @state() private skinsError = '';
  @state() private restoreTarget: BackupEntry | null = null;
  @state() private removeTarget: BackupEntry | null = null;
  @state() private restoreMode: 'replace' | 'merge' = 'replace';
  @state() private restoreAccess = false;
  @state() private restoreConfirm = '';
  @state() private health: { discovery?: Record<string, unknown>; video_codecs?: VideoCodecs; remote?: { live_streams?: number }; events?: { ingest: { connected: boolean; last_heartbeat_at: string | null; last_event_at: string | null; last_error: string | null; reconnects: number; events_stored: number }; derive: { last_ok: string | null; last_error: string | null; derived: number }; stored: number } } | null = null;

  static styles = [settingsStyles, css`
    .steps {
      margin: 0;
      padding-inline-start: 20px;
      font-size: var(--sw-fs-sm);
      line-height: 1.6;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    /* K88: the plan.surfaces check rows */
    .chk {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
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
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); /* CR-026 guard: a 300px column overflowed a 320px phone */
      gap: 10px;
    }
    /* R5-SYSTEM-297: a health card is a well of the ladder (surface-2, no hairline); a failing one is a FILLED danger / stale field,
       not a coloured outline; its name reads at 14/600 in the heading ink */
    .hcard {
      border: 1px solid transparent;
      border-radius: var(--sw-r-md);
      padding: 12px 14px;
      background: var(--sw-surface-2);
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .hcard.error {
      background: var(--sw-danger-soft);
      border-color: color-mix(in srgb, var(--sw-danger) 35%, transparent);
    }
    .hcard.warn {
      background: var(--sw-stale-soft);
      border-color: color-mix(in srgb, var(--sw-stale) 35%, transparent);
    }
    .hcard .hh {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-md);
      color: var(--sw-heading, var(--sw-text));
    }
    .hcard .hd {
      font-size: var(--sw-fs-sm);
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
      padding: 10px 12px;
      border: 0;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
    }
    .brow .name {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-md);
      color: var(--sw-heading, var(--sw-text));
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
      min-block-size: var(--sw-ctl-h-md);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      padding: 5px 10px;
      font: inherit;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
      background: var(--sw-surface);
    }
    .note-in:focus,
    .confirm-in:focus {
      outline: none;
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    .confirm-in {
      inline-size: 100%;
      box-sizing: border-box;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      padding: 8px 10px;
      font: inherit;
      font-family: var(--sw-font-mono);
      direction: ltr;
      margin-block-start: 8px;
      color: var(--sw-text);
      background: var(--sw-surface);
    }
    /* owner 2026-09-29: the live preview of "פריסת אריחים" (two sample tiles in the chosen shape) */
    .tile-preview {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 170px));
      gap: 8px;
      padding-block: 4px 8px;
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
    /* CR-007 6a: הגדרות › חשמל והתקנים - the two style previews (static swatches, no screen is rendered) */
    .swatches {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .swatch {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 6px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      text-align: start;
      cursor: pointer;
    }
    .swatch[aria-pressed='true'] {
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 2px var(--sw-accent-soft);
    }
    .swatch:disabled {
      cursor: default;
    }
    .swatch .cap {
      display: flex;
      align-items: center;
      gap: 6px;
      padding-inline: 2px;
      font-weight: var(--sw-fw-medium);
    }
    .swatch .cap .muted {
      font-weight: var(--sw-fw-regular);
    }
    .sw-prev {
      inline-size: 176px;
      block-size: 104px;
      border-radius: var(--sw-r-sm);
      padding: 8px;
      display: grid;
      grid-template-columns: 44px 1fr 1fr;
      grid-template-rows: 1fr 1fr;
      gap: 6px;
      overflow: hidden;
    }
    .sw-prev i {
      display: block;
      border-radius: var(--sw-r-2xs);
    }
    .sw-prev .tree {
      grid-row: 1 / 3;
    }
    .sw-prev.smplwise {
      background: #f6f7fb;
    }
    .sw-prev.smplwise i {
      background: #ffffff;
      border: 1px solid #e9edf3;
      box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
    }
    .sw-prev.smplwise i.on {
      background: linear-gradient(180deg, var(--sw-warning-soft), #ffffff 70%);
      border-color: #f7d49a;
    }
    .sw-prev.glass {
      background: radial-gradient(140px 80px at 85% -10%, rgba(255, 184, 86, 0.45), transparent 60%), radial-gradient(120px 80px at 10% 110%, rgba(10, 132, 255, 0.5), transparent 60%), #0a0a0c;
    }
    .sw-prev.glass i {
      border-radius: var(--sw-r-md);
      background: rgba(44, 44, 46, 0.62);
      border: 1px solid rgba(255, 255, 255, 0.13);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.45);
      display: flex;
      align-items: flex-start;
      padding: 5px;
    }
    .sw-prev.glass i::before {
      content: '';
      inline-size: 12px;
      block-size: 12px;
      border-radius: 50%;
      background: rgba(235, 235, 245, 0.3);
    }
    .sw-prev.glass i.tree::before {
      display: none;
    }
    .sw-prev.glass i.on {
      background: linear-gradient(135deg, rgba(61, 90, 254, 0.55), rgba(61, 90, 254, 0.15)), rgba(44, 44, 46, 0.62);
      border-color: rgba(100, 140, 255, 0.45);
      box-shadow: 0 0 14px rgba(61, 90, 254, 0.4);
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
      /* border-box: the full-width field keeps its padding and border inside the row (BACKUP-HASH-ENC's password / minimum
         fields stand alone in a stacked row and ran 7 px past the card at 390 - 2.7.0 gate) */
      .note-in {
        inline-size: 100%;
        box-sizing: border-box;
      }
    }
  `, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
    this.readTab();
    window.addEventListener('hashchange', this.onHash);
    if (typeof matchMedia === 'function') {
      this.phoneMq = matchMedia('(max-width: 767px)');
      this.phone = this.phoneMq.matches;
      this.phoneMq.addEventListener('change', this.onPhoneMq);
    }
    void this.loadSettings();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('hashchange', this.onHash);
    this.phoneMq?.removeEventListener('change', this.onPhoneMq);
    this.phoneMq = null;
  }

  /** SET-polish: the sub-tab is a deep link (`#/system/diagnostics?tab=backup`): read on arrival and whenever the address changes while this
   * screen stays mounted (the settings navigation), written back in place when the user switches a tab. */
  private readTab() {
    const wanted = parseRoute().params.get('tab') ?? 'general';
    if (wanted !== this.tab && TABS.some((x) => x.id === wanted)) this.openTab(wanted, false);
  }

  private onHash = () => {
    const h = window.location.hash;
    if (h.startsWith('#/system/diagnostics') || h === '#/system') this.readTab();
  };

  private openTab(id: string, write = true) {
    this.tab = id;
    if (id === 'health') void this.loadReport();
    if (id === 'backup') void this.loadBackups();
    if (id === 'media') void this.loadMedia();
    if (id === 'ha') void this.loadHa();
    if (write) replaceRoute('/system/diagnostics', id === 'general' ? undefined : new URLSearchParams({ tab: id }));
  }

  private async loadSettings() {
    if (!isApi()) return;
    try {
      const [r, h] = await Promise.all([getSettings(), get<{ version: string; discovery?: Record<string, unknown>; events?: never }>('health').catch(() => null)]);
      this.settings = r.settings;
      this.canEdit = r.can_edit;
      this.nvrChannels = r.nvr_channels ?? null;
      this.draft = {};
      this.version = h?.version ?? '';
      this.health = (h as unknown as typeof this.health) ?? null;
    } catch (err) {
      this.error = describeError(err);
    }
    // the floors for הגדרות › מפה › קומת ברירת מחדל (grouped by site and building)
    void loadTree().then((t) => (this.floorTree = t.sites)).catch(() => undefined);
    // the viewer's own 3D mode (/me/prefs plan.quality): unreadable = the row stays disabled
    void loadOwnMode().then((m) => (this.ownQuality = m));
    void this.loadSiteLocation();
  }

  /** CR-029 S2 (owner 2026-10-11): the location the sun uses and the home's own value, for the site-location rows. */
  private async loadSiteLocation() {
    this.siteLoc = (await planViewPrefs(true).catch(() => null))?.location ?? null;
  }

  /** The site-location rows (Plan Studio 6 sun): the home's location by default, an explicit manual override on request.
   * Shown to system.configure holders only (SEC247 I3: the server sends the override values to them only). */
  private renderSiteLocation(api: boolean) {
    const ro = !api || !this.canEdit;
    const mode = this.value('site.location_source') === 'manual' ? 'manual' : 'home';
    const home = this.siteLoc?.home ?? null;
    const homeLine = home
      ? `מיקום הבית בהגדרות Home Assistant: ${home.latitude.toFixed(2)}, ${home.longitude.toFixed(2)}${home.time_zone ? ` · ${home.time_zone}` : ''}`
      : 'מיקום הבית עדיין לא נקרא מ־Home Assistant; עד אז השמש מחושבת למרכז הארץ';
    const coord = (key: 'site.latitude' | 'site.longitude', attr: string, label: string) => html`<sw-field class="ctl"><input type="text" inputmode="decimal" data-ltr
        aria-label=${label} placeholder=${label} data-set-site=${attr} ?disabled=${ro} .value=${String(this.value(key) ?? '')}
        @change=${(e: Event) => this.set(key, (e.target as HTMLInputElement).value.trim())} /></sw-field>`;
    return html`<div class="row" data-set-site-location-row><span class="lbl">מיקום האתר לשמש בתלת־ממד<span class="muted">${homeLine}</span></span>
        <sw-field class="ctl"><select data-set-site-location ?disabled=${ro} @change=${(e: Event) => this.set('site.location_source', (e.target as HTMLSelectElement).value === 'manual' ? 'manual' : 'home')}>
          <option value="home" ?selected=${mode === 'home'}>לפי מיקום הבית (ברירת מחדל)</option><option value="manual" ?selected=${mode === 'manual'}>ידני</option>
        </select></sw-field></div>
      ${mode === 'manual'
        ? html`<div class="row" data-set-site-manual-row><span class="lbl">מיקום ידני<span class="muted">קו רוחב וקו אורך במעלות (צפון ומזרח חיוביים); בלי שניהם — מיקום הבית</span></span>
            ${coord('site.latitude', 'lat', 'קו רוחב')}${coord('site.longitude', 'lon', 'קו אורך')}</div>`
        : nothing}`;
  }

  /** מצב התצוגה שלי: the viewer's own 3D mode ('' = back to the installation default), the same key the 3D toolbar writes. */
  private async saveOwnQuality(value: string) {
    const mode = value === '' ? null : ownModeFromWire(value);
    if (value !== '' && mode === null) return;
    this.ownQuality = mode;
    await saveOwnMode(mode);
  }

  private async loadMedia() {
    void this.loadSkins();
    if (!isApi() || !this.canEdit || nvrLess()) return; // NVR-less mode: no camera streams to list
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
      if (this.canEdit && !onRemote()) this.pairing = await bridgePairing(regenerate);
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
      await navigator.clipboard.writeText(this.pairing.pairing_code ?? '');
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
    return html`<div class="row"><span class="lbl">התקנת האינטגרציה ב־Home Assistant<span class="muted">${this.integrationText(i)}${i.discovery_posted_at ? ` · הוכרזה ל־Supervisor ${fmtTime(i.discovery_posted_at)}` : ''} · ${BRIDGE_INSTALL_RESTART_WARNING}</span></span><span class="end"><sw-badge kind=${kind} label=${label}></sw-badge>${this.canEdit && !onRemote() && i.state !== 'not_available' ? html`<sw-button size="sm" ?disabled=${this.busy} @click=${() => this.installBridgeNow()}>התקן / עדכן</sw-button>` : nothing}</span></div>`;
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
            <div class="row"><span class="lbl">סנכרון מצבים (WebSocket)<span class="muted">${s?.connected ? `מחובר · HA ${s.ha_version ?? '?'} · ${s.entities} ישויות · אירוע אחרון ${fmtTime(s.last_event_at)}` : `${syncDisconnectedText(s?.last_error)} · ${s?.reconnects ?? 0} חיבורים מחדש`}</span></span><sw-badge kind=${s?.connected ? 'live' : 'offline'}></sw-badge></div>
            <div class="row"><span class="lbl">רישום ישויות (registry)<span class="muted">עודכן ${fmtTime(s?.last_registry_at)} · תמונת מצב ${fmtTime(s?.last_snapshot_at)}</span></span><sw-button size="sm" @click=${() => navigate('/system/entities')}>לקטלוג</sw-button></div>`}
      </sw-card>
      <sw-card heading="גשר Arx (אינטגרציה ב־Home Assistant)" subheading="פעולות על ישויות רצות רק דרך הגשר, בזהות המשתמש, לפי ההרשאות של Home Assistant">
        ${h
          ? html`${this.renderIntegration(h)}<div class="row"><span class="lbl">צימוד<span class="muted">${h.bridge.paired ? `מצומד מאז ${fmtTime(h.bridge.paired_at)}` : 'לא מצומד — פעולות HA ייחסמו עד להתקנת הגשר'}</span></span><sw-badge kind=${h.bridge.paired ? 'live' : 'stale'} label=${h.bridge.paired ? 'מצומד' : 'לא מצומד'}></sw-badge></div>
            <div class="row"><span class="lbl">ספריית משתמשי HA<span class="muted">${h.bridge.directory_users} משתמשים · עודכן ${fmtTime(h.bridge.last_directory_at)}</span></span><sw-badge kind=${h.bridge.directory_users ? 'recorded' : 'unknown'}></sw-badge></div>`
          : nothing}
        ${p
          ? html`<div class="row"><span class="lbl">כתובת ה־Add-on ברשת של HA<span class="muted">להדביק בשדה "כתובת" של האינטגרציה</span></span><code class="ltr">${p.addon_url}</code></div>
            <div class="row"><span class="lbl">קוד צימוד<span class="muted">סוד משותף; מוצג רק למנהלי מערכת ונרשם באודיט</span></span><span class="end">${p.pairing_code === null ? html`<span class="muted" data-pairing-replaced>הוחלף במפתח מתחלף (Key rotation)</span>` : html`<code class="ltr">${this.showCode ? p.pairing_code : '••••••••••••'}</code><sw-button size="sm" @click=${() => (this.showCode = !this.showCode)}>${this.showCode ? 'הסתר' : 'הצג'}</sw-button><sw-button size="sm" @click=${() => this.copyCode()}>${this.copied ? 'הועתק' : 'העתק'}</sw-button>`}</span></div>
            <div class="row"><span class="lbl">יצירת קוד חדש<span class="muted">מבטל את הצימוד הקיים; יש להגדיר מחדש את האינטגרציה</span></span>${this.regenArmed ? html`<span class="end"><sw-button size="sm" variant="danger" @click=${() => this.loadHa(true)}>אשר יצירה</sw-button><sw-button size="sm" variant="ghost" @click=${() => (this.regenArmed = false)}>ביטול</sw-button></span>` : html`<sw-button size="sm" @click=${() => (this.regenArmed = true)}>צור קוד חדש</sw-button>`}</div>`
          : onRemote()
            ? html`<div class="muted" data-ha-local-only>${LOCAL_ONLY_GENERIC}</div>`
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

  /** Advisory only (never blocks the save): more playback sessions than half of the recorder's channels. Unknown capacity = no warning. */
  private playbackWarning(): string {
    const channels = this.nvrChannels;
    const v = Number(this.value('playback.max_sessions') ?? 0);
    if (!channels || !v || v * 2 <= channels) return '';
    return `${v} סשני ניגון במקביל זה יותר ממחצית הערוצים שה־NVR בנוי להם (${channels}). זה עלול להעמיס על ה־NVR ולפגוע בהקלטה ובצפייה החיה. השמירה אפשרית.`;
  }

  /** Same advisory rule for the two live-stream caps (never blocks the save; unknown capacity = no warning). */
  private liveCapWarning(key: 'media.max_live_sessions' | 'remote.max_live_streams'): string {
    const channels = this.nvrChannels;
    const v = Number(this.value(key) ?? 0);
    if (!channels || !v || v * 2 <= channels) return '';
    const what = key === 'media.max_live_sessions' ? 'זרמים חיים במקביל' : 'זרמים חיים לכל כניסה מרחוק';
    return `${v} ${what} זה יותר ממחצית הערוצים שה־NVR בנוי להם (${channels}). זה עלול להעמיס על ה־NVR ולפגוע בהקלטה. השמירה אפשרית.`;
  }

  /** CR-029 S0 / S3: one dial of the installation's `plan.view`, the draft first (a partial object) then the stored value. */
  private viewValue<K extends keyof NonNullable<ProductSettings['plan.view']>>(key: K, fallback: NonNullable<NonNullable<ProductSettings['plan.view']>[K]>): NonNullable<NonNullable<ProductSettings['plan.view']>[K]> {
    return (this.draft['plan.view']?.[key] ?? this.settings?.['plan.view']?.[key] ?? fallback) as NonNullable<NonNullable<ProductSettings['plan.view']>[K]>;
  }

  private setView(patch: NonNullable<ProductSettings['plan.view']>): void {
    this.set('plan.view', { ...(this.draft['plan.view'] ?? {}), ...patch });
  }

  /** CR-029 S3: one key of `plan.bakes`, the draft first then the stored value. */
  private bakeValue<K extends keyof NonNullable<ProductSettings['plan.bakes']>>(key: K, fallback: NonNullable<NonNullable<ProductSettings['plan.bakes']>[K]>): NonNullable<NonNullable<ProductSettings['plan.bakes']>[K]> {
    return (this.draft['plan.bakes']?.[key] ?? this.settings?.['plan.bakes']?.[key] ?? fallback) as NonNullable<NonNullable<ProductSettings['plan.bakes']>[K]>;
  }

  private setBakes(patch: NonNullable<ProductSettings['plan.bakes']>): void {
    this.set('plan.bakes', { ...(this.draft['plan.bakes'] ?? {}), ...patch });
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
      applyWiskeyUi(r.settings as unknown as Record<string, unknown>); // the WisKey tabs follow at once, no reload
      setInstallWiskeyView(r.settings as unknown as Record<string, unknown>); // WisKey rc.37: the installation's density / wall defaults
      applyWiskeyHidden(r.settings as unknown as Record<string, unknown>); // ditto for a direct URL landing on "not available"
      applySnapshotHidden(r.settings as unknown as Record<string, unknown>); // ui.security_snapshot: the live overview tab follows
      setGlassScheme(r.settings['devices.glass_scheme']); // 2.4.4: every open glass surface follows at once
      void this.loadSiteLocation(); // CR-029 S2: the sun's location may have changed source
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
    const dirty = 'ui.tile_layout' in this.draft;
    // owner 2026-09-29: the summary tiles' shape (Live overview, devices screens) - installation default + this browser
    const tileSetting = (this.value('ui.tile_layout') as TileLayoutSetting | undefined) ?? 'auto';
    const tileOverride = tileLayoutOverride();
    // review M5: the preview shows the INSTALLATION value being chosen; a local override is named next to it
    const previewLayout = resolveTileLayout(tileSetting);
    return html`<sw-card heading="עיצוב הממשק">
      <div class="row" data-tile-layout-row><span class="lbl">פריסת אריחים<span class="muted">אריחי הסיכום בתמונת המצב ובחשמל והתקנים: כרטיסים גבוהים, או קומפקטיים - מלבן עם הסמל לצד הערך. אוטומטי: קומפקטי בטלפון, כרטיסים במסך רחב. חל על כל המשתמשים אחרי שמירה; דפדפן שכבר פתוח מקבל את השינוי בטעינה הבאה של הדף</span></span><span class="ctl" style="display:flex;flex-direction:column;align-items:stretch;gap:4px"><sw-field><select data-set-tile-layout ?disabled=${!this.canEdit} @change=${(e: Event) => this.set('ui.tile_layout', (e.target as HTMLSelectElement).value as TileLayoutSetting)}>${TILE_LAYOUTS.map((v) => html`<option value=${v} ?selected=${tileSetting === v}>${TILE_LAYOUT_LABEL[v]}</option>`)}</select></sw-field>${tileOverride ? html`<span class="muted" data-tile-override-note>עקיפה מקומית פעילה בדפדפן הזה: ${TILE_LAYOUT_LABEL[tileOverride]} · <sw-button size="sm" variant="ghost" data-tile-override-clear @click=${() => { setTileLayoutOverride(null); this.requestUpdate(); }}>בטל עקיפה</sw-button></span>` : nothing}</span></div>
      <div class="row"><span class="lbl">פריסת אריחים בדפדפן הזה<span class="muted">עקיפה אישית שנשמרת במכשיר; לא משנה את ברירת המחדל</span></span><sw-field class="ctl"><select data-set-tile-override @change=${(e: Event) => { const v = (e.target as HTMLSelectElement).value; setTileLayoutOverride((TILE_LAYOUTS as readonly string[]).includes(v) ? (v as TileLayoutSetting) : null); this.requestUpdate(); }}><option value="" ?selected=${!tileOverride}>לפי ברירת המחדל</option>${TILE_LAYOUTS.map((v) => html`<option value=${v} ?selected=${tileOverride === v}>${TILE_LAYOUT_LABEL[v]}</option>`)}</select></sw-field></div>
      <div class="tile-preview" data-tile-preview=${previewLayout} aria-label=${`תצוגה מקדימה: ${previewLayout === 'compact' ? 'קומפקטי' : 'כרטיסים'}`}>
        <sw-kpi icon="bolt" value="0/33" label="מתגים פעילים" tone="neutral" layout=${previewLayout}></sw-kpi>
        <sw-kpi icon="lock" value="8/8" label="מנעולים נעולים" detail="הכול נעול" tone="live" layout=${previewLayout}></sw-kpi>
      </div>
      ${this.canEdit ? html`<div class="foot"><sw-button variant="primary" size="sm" icon="check" ?disabled=${!dirty || this.busy} @click=${() => this.saveDesign()}>שמור עיצוב</sw-button>${this.message && this.tab === 'general' ? html`<span class="msg ok" role="status"><sw-icon name="check" size=${13}></sw-icon>${this.message}</span>` : nothing}${this.error && this.tab === 'general' ? html`<span class="msg err" role="alert"><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>` : nothing}</div>` : nothing}
    </sw-card>`;
  }

  private async saveDesign() {
    await this.save();
    if (this.settings) setInstallationTileLayout(this.settings['ui.tile_layout']); // open screens follow at once
  }

  /** NVR-less mode: the neutral notice a settings section shows instead of NVR / video forms that could only fail. */
  private renderNvrLessNotice(what: string) {
    return html`<sw-card heading="מצב ללא NVR" subheading=${what} data-nvr-less-settings>
      <div class="muted">ההתקנה פועלת ללא NVR, ולכן ההגדרות של וידאו, הקלטות, ייצוא וחיפוש אירועים מוסתרות כאן. הן יחזרו כמו שהיו כשיחובר NVR בהגדרות ‹ חיבורים.</div>
    </sw-card>`;
  }

  private renderGeneral() {
    const NVR = nvrLess();
    return html`<div class="sections">
      ${this.renderDesign()}
      <system-design></system-design>
      <system-brand-logos></system-brand-logos>
      <system-brand-installer></system-brand-installer>
      <system-brand-colors></system-brand-colors>
      ${BUBBLE_SCREENS_ENABLED ? html`<system-look></system-look>` : nothing}
      <system-nav-size></system-nav-size>
      <system-mobile-options></system-mobile-options>
      <system-xs-options></system-xs-options>
      <sw-card heading="זמן ומיקום">
        <div class="row"><span class="lbl">אזור זמן לתצוגה<span class="muted">פנימית הכל UTC; שעון קיץ לפי התאריך המבוקש</span></span><sw-field class="ctl"><select><option>(UTC+02:00) Asia/Jerusalem</option></select></sw-field></div>
        ${NVR ? nothing : html`<div class="row"><span class="lbl">פרופיל זמן של ה־NVR<span class="muted">נקבע לפי ראיות לדגם ולקושחה</span></span><sw-field class="ctl"><select><option>hikvision · ds-76xx · שעון מקומי</option></select></sw-field></div>`}
        ${isApi() ? nothing : html`<div class="row"><span class="lbl">NTP במכשיר<span class="muted">pool.ntp.org · סטייה 2 שנ׳</span></span><sw-toggle checked label="פעיל"></sw-toggle></div>`}
      </sw-card>
      ${NVR ? this.renderNvrLessNotice('מדיניות האחסון נקראת מה־NVR') : html`<sw-card heading="מדיניות אחסון (קריאה מה־NVR)">
        <div class="row"><span class="lbl">שמירת הקלטות</span><sw-field class="ctl"><select disabled><option>לפי מקום פנוי (overwrite)</option></select></sw-field></div>
        <div class="row"><span class="lbl">כשהאחסון מתמלא</span><sw-field class="ctl"><select disabled><option>דריסת הישן ביותר</option></select></sw-field></div>
        <div class="row"><span class="lbl">התראת אחסון נמוך<span class="muted">מתחת ל־10% פנוי</span></span><sw-toggle checked label="פעיל"></sw-toggle></div>
      </sw-card>`}
      <sw-card heading="אינטגרציות">
        <div class="row"><span class="lbl">go2rtc (חיצוני)<span class="muted">זרמים בשם smplwise_* בלבד · זרמים זרים לא ייגעו</span></span><span class="end"><sw-toggle checked label="מופעל"></sw-toggle><sw-button size="sm" @click=${() => this.openTab('media')}>הגדרה</sw-button></span></div>
        <div class="row"><span class="lbl">גשר Home Assistant<span class="muted">קטלוג ישויות, פעולות בשם המשתמש וספריית המשתמשים</span></span><sw-button size="sm" @click=${() => this.openTab('ha')}>הגדרה</sw-button></div>
      </sw-card>
      <sw-card heading="בריאות המערכת">
        <div class="row"><span class="health"><i class="dot"></i><span class="lbl">מצב חלקי<span class="muted">גשר HA טרם חובר · שאר הרכיבים תקינים</span></span></span><sw-button size="sm" icon="activity">הרצת דיאגנוסטיקה</sw-button></div>
      </sw-card>
    </div>`;
  }

  private renderMedia() {
    const api = isApi();
    const dirty = Object.keys(this.draft).length > 0;
    const NVR = nvrLess(); // NVR-less mode: only the map, display and retention settings stay
    // CR-013: "ראשי" (the device overview) is the default start screen
    const starts = NVR ? [['devices', 'ראשי (ברירת מחדל)'], ['explore', 'מפת קומה']] : [['devices', 'ראשי (ברירת מחדל)'], ['explore', 'מפת קומה'], ['live', 'סקירה (לייב)'], ['wall', 'כל המצלמות'], ['events', 'מרכז אירועים'], ['playback', 'הקלטות']];
    return html`<div class="sections">
      ${NVR ? this.renderNvrLessNotice('הגדרות הווידאו וההקלטות אינן בשימוש') : nothing}
      <sw-card heading=${NVR ? 'תצוגה ומפה' : 'תעבורת וידאו'} subheading=${NVR ? 'מסך הפתיחה, המפה והתלת-ממד' : 'ברירת המחדל לכל הנגנים; כל נגן יכול לעקוף אותה לדפדפן הנוכחי'}>
        ${NVR ? nothing : html`<div class="row"><span class="lbl">תעבורה ברירת מחדל<span class="muted">אוטומטי (ברירת המחדל): WebRTC תחילה (השהיה נמוכה), ו־MSE רק כש־WebRTC אינו זמין · WebRTC בלבד: לעולם לא MSE · MSE בלבד: בחירה מכוונת ללקוח שאצלו WebRTC בלתי אפשרי (אין UDP ישיר ל־go2rtc: Ingress, Cloudflare, CGNAT)</span></span>
          <sw-field class="ctl"><select data-set-transport-default ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.set('media.transport_default', (e.target as HTMLSelectElement).value as ProductSettings['media.transport_default'])}>
            ${(['auto', 'webrtc', 'mse'] as const).map((t) => html`<option value=${t} ?selected=${(this.value('media.transport_default') ?? TRANSPORT_DEFAULT) === t}>${t === TRANSPORT_DEFAULT ? `${transportLabel(t)} — ברירת המחדל` : transportLabel(t)}</option>`)}
          </select></sw-field></div>
        <div class="row"><span class="lbl">הודעות על אופן ההזרמה<span class="muted">הודעה על הנגן כשהווידאו עובר ב־MSE במקום WebRTC, ושורות ההסבר מתחת למצלמה. כבוי (ברירת מחדל): המסך נקי, והתג על הנגן ממשיך להראות מה מתנגן ומסביר בריחוף. הפעלה מתאימה למי שבודק בעיית תעבורה</span></span>
          <sw-field class="ctl"><select data-set-video-notices ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.set('media.video_notices', (e.target as HTMLSelectElement).value as 'true' | 'false')}>
            <option value="false" ?selected=${String(this.value('media.video_notices') ?? 'false') !== 'true'}>מוסתרות</option><option value="true" ?selected=${String(this.value('media.video_notices') ?? 'false') === 'true'}>מוצגות</option>
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
          </select></sw-field></div>`}
        <div class="row"><span class="lbl">מסך פתיחה<span class="muted">המסך שהמערכת נפתחת עליו כשהכתובת לא מציינת מסך (ריענון של הכתובת הראשית)</span></span>
          <sw-field class="ctl"><select data-set-start-route ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.set('ui.start_route', (e.target as HTMLSelectElement).value)}>
            ${starts.map(([v, l]) => html`<option value=${v} ?selected=${String(this.value('ui.start_route') ?? 'devices') === v}>${l}</option>`)}
          </select></sw-field></div>
        <div class="row"><span class="lbl">הסתרת המפה<span class="muted">מסיר את אזור המפה מהניווט לכל המשתמשים; למשתמש בודד: תפקיד בלי ההרשאה map.read</span></span>
          <sw-field class="ctl"><select data-set-hide-map ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.set('ui.hide_map', (e.target as HTMLSelectElement).value)}>
            <option value="false" ?selected=${String(this.value('ui.hide_map') ?? 'false') !== 'true'}>מוצגת</option><option value="true" ?selected=${String(this.value('ui.hide_map') ?? 'false') === 'true'}>מוסתרת</option>
          </select></sw-field></div>
        <div class="row"><span class="lbl">גודל תצוגת WisKey<span class="muted">רגיל: ממלא את אזור התוכן. מותאם: WisKey מוצג בגודל וירטואלי גדול יותר ומוקטן, כך שנכנסים בו יותר כרטיסים ואריחים. מסך מלא: מכסה את כל החלון (יציאה: כפתור קטן בפינה, Esc או חזרה)</span></span>
          <sw-field class="ctl"><select data-set-wiskey-size ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.set('ui.wiskey_size', (e.target as HTMLSelectElement).value as ProductSettings['ui.wiskey_size'])}>
            ${([['normal', 'רגיל'], ['fit', 'מותאם'], ['full', 'מסך מלא']] as const).map(([v, l]) => html`<option value=${v} ?selected=${(this.value('ui.wiskey_size') ?? 'normal') === v}>${l}</option>`)}
          </select></sw-field></div>
        ${(this.value('ui.wiskey_size') ?? 'normal') === 'fit'
          ? html`<div class="row"><span class="lbl">קנה מידה במצב מותאם<span class="muted">100% זהה לרגיל; ככל שהמספר נמוך יותר WisKey מציג יותר, בכתב קטן יותר</span></span>
              <sw-field class="ctl"><select data-set-wiskey-scale ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.set('ui.wiskey_scale', (e.target as HTMLSelectElement).value as ProductSettings['ui.wiskey_scale'])}>
                ${(['100', '90', '80', '70'] as const).map((v) => html`<option value=${v} ?selected=${String(this.value('ui.wiskey_scale') ?? '90') === v}>${v}%</option>`)}
              </select></sw-field></div>`
          : nothing}
        <div class="row"><span class="lbl">מספר כרטיסים בסקירת WisKey<span class="muted">נקודת הפתיחה בכל טעינה; משתמש יכול לבחור אחרת בחשבון שלו. שינוי בתוך WisKey אינו נשמר. אוטומטי: WisKey מחליט לפי הגודל הפנוי</span></span>
          <sw-field class="ctl"><select data-set-wiskey-density ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.set('ui.wiskey_density', (e.target as HTMLSelectElement).value as ProductSettings['ui.wiskey_density'])}>
            ${(['auto', '4', '6', '8', '9', '12'] as const).map((v) => html`<option value=${v} ?selected=${String(this.value('ui.wiskey_density') ?? 'auto') === v}>${v === 'auto' ? 'אוטומטי' : v}</option>`)}
          </select></sw-field></div>
        <div class="row"><span class="lbl">מספר מצלמות בקיר WisKey<span class="muted">נקודת הפתיחה של קיר המצלמות; משתמש יכול לבחור אחרת בחשבון שלו. ברירת מחדל: 4 (12 דורש מספיק מצלמות פעילות ורוחב פס)</span></span>
          <sw-field class="ctl"><select data-set-wiskey-wall ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.set('ui.wiskey_wall', (e.target as HTMLSelectElement).value as ProductSettings['ui.wiskey_wall'])}>
            ${(['auto', '4', '9', '12'] as const).map((v) => html`<option value=${v} ?selected=${String(this.value('ui.wiskey_wall') ?? 'auto') === v}>${v === 'auto' ? 'ברירת מחדל' : v}</option>`)}
          </select></sw-field></div>
        ${NVR ? nothing : html`<div class="row"><span class="lbl">HA recorder כמקור משני להיסטוריה<span class="muted">במפה ההיסטורית: כשההיסטוריה המקומית לא יודעת מצב של ישות, הוא נקרא מה־recorder של Home Assistant ומסומן כמקור משני</span></span>
          <sw-field class="ctl"><select data-set-ha-secondary ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.set('history.ha_secondary', (e.target as HTMLSelectElement).value)}>
            <option value="false" ?selected=${String(this.value('history.ha_secondary') ?? 'false') !== 'true'}>כבוי</option><option value="true" ?selected=${String(this.value('history.ha_secondary') ?? 'false') === 'true'}>פעיל</option>
          </select></sw-field></div>`}
        ${NVR ? nothing : html`<div class="row" data-set-timescrub-row><span class="lbl">ציר זמן במפה ההיסטורית<span class="muted">שכבות, ניגון תקופה ופסי שינויים לכל שכבה במפה ההיסטורית</span></span>
          <sw-field class="ctl"><select data-set-timescrub ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.set('history.timescrub', (e.target as HTMLSelectElement).value)}>
            <option value="false" ?selected=${String(this.value('history.timescrub') ?? 'false') !== 'true'}>כבוי</option><option value="true" ?selected=${String(this.value('history.timescrub') ?? 'false') === 'true'}>פעיל</option>
          </select></sw-field></div>
        <div class="row"><span class="lbl">טווח ניגון מרבי (ימים)<span class="muted">החלון הארוך ביותר שבקשת ניגון אחת יכולה לכסות</span></span><sw-field class="ctl"><input type="number" min="1" max="30" data-ltr data-set-range-max-days ?disabled=${!api || !this.canEdit} .value=${String(this.value('history.range_max_days') ?? 7)} @change=${(e: Event) => this.set('history.range_max_days', Number((e.target as HTMLInputElement).value))} /></sw-field></div>
        <div class="row"><span class="lbl">נוכחות בהיסטוריה - ימי שמירה<span class="muted">מצבי חיישני תנועה ונוכחות ישנים יותר נמחקים מההיסטוריה המקומית</span></span><sw-field class="ctl"><input type="number" min="1" max="30" data-ltr data-set-presence-retention ?disabled=${!api || !this.canEdit} .value=${String(this.value('history.presence_retention_days') ?? 7)} @change=${(e: Event) => this.set('history.presence_retention_days', Number((e.target as HTMLInputElement).value))} /></sw-field></div>`}
        <div class="row"><span class="lbl">מידות לפני כיול<span class="muted">בעורך התוכנית, כשגרסת התוכנית עדיין לא כוילה: להציג אורכים ושטחים משוערים עם ≈, או להסתיר מטרים עד הכיול</span></span>
          <sw-field class="ctl"><select data-set-plan-estimates ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.set('plan.estimates', (e.target as HTMLSelectElement).value as 'true' | 'false')}>
            <option value="true" ?selected=${String(this.value('plan.estimates') ?? 'true') !== 'false'}>משוערות עם ≈</option><option value="false" ?selected=${String(this.value('plan.estimates') ?? 'true') === 'false'}>מוסתרות עד כיול</option>
          </select></sw-field></div>
        <div class="row"><span class="lbl">מפלסים בפתיחת מפה<span class="muted">המפלס שמוצג כברירת מחדל בכל מפה; שבבי המפלסים ממשיכים לאפשר מעבר בין מפלסים</span></span>
          <sw-field class="ctl"><select data-set-plan-levels ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.set('plan.levels', (e.target as HTMLSelectElement).value as 'all' | 'default')}>
            <option value="all" ?selected=${String(this.value('plan.levels') ?? 'all') !== 'default'}>כל המפלסים יחד</option><option value="default" ?selected=${String(this.value('plan.levels') ?? 'all') === 'default'}>מפלס ברירת המחדל של הקומה</option>
          </select></sw-field></div>
        <div class="row"><span class="lbl">מצב תצוגה ברירת מחדל<span class="muted">מצב התלת-ממד במפה לכל המשתמשים. רק במצב אוטומטי התצוגה יורדת לבד לסכמטי; בחירה ידנית נשארת</span></span>
          <sw-field class="ctl"><select data-set-plan-quality ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.set('plan.quality', (e.target as HTMLSelectElement).value as QualityWire)}>
            ${QUALITY_MODES.map((m) => html`<option value=${modeToWire(m)} ?selected=${(modeFromWire(this.value('plan.quality')) ?? 'auto') === m}>${QUALITY_MODE_LABEL[m]} — ${QUALITY_MODE_HINT[m]}</option>`)}
          </select></sw-field></div>
        <div class="row" data-plan-quality-own-row><span class="lbl">מצב התצוגה שלי<span class="muted">גובר על ברירת המחדל, רק עבורך; גם הבחירה בסרגל התלת-ממד נשמרת כאן</span></span>
          <sw-field class="ctl"><select data-set-plan-quality-own ?disabled=${this.ownQuality === undefined} @change=${(e: Event) => void this.saveOwnQuality((e.target as HTMLSelectElement).value)}>
            <option value="" ?selected=${!this.ownQuality}>לפי ברירת המחדל</option>
            ${OWN_MODES.map((m) => html`<option value=${m} ?selected=${this.ownQuality === m}>${RUNG_HE[m]}</option>`)}
          </select></sw-field></div>
        <div class="row"><span class="lbl">דעיכת סימון תנועה במפה<span class="muted">חדר שזוהתה בו תנועה נצבע בכחול; הצבע דוהה במשך הזמן הזה אחרי שהתנועה פסקה (כבוי: רק בזמן התנועה)</span></span>
          <sw-field class="ctl"><select data-set-plan-presence-fade ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.set('plan.presence_fade', (e.target as HTMLSelectElement).value)}>
            ${[['off', 'כבוי — רק בזמן תנועה'], ['1', 'דקה'], ['2', '2 דקות'], ['3', '3 דקות'], ['5', '5 דקות'], ['10', '10 דקות'], ['15', '15 דקות'], ['30', '30 דקות'], ['60', 'שעה']].map(([v, l]) => html`<option value=${v} ?selected=${String(this.value('plan.presence_fade') ?? '3') === v}>${l}</option>`)}
          </select></sw-field></div>
        <div class="row" data-set-stills-row><span class="lbl">מסך קיר — תצוגת התוכנית<span class="muted">מסך קיר מציג תלת־ממד חי; תמונות מוכנות חוסכות חום וסוללה. קומה בלי תמונות מוכנות נשארת בתלת־ממד חי</span></span>
          <sw-field class="ctl"><select data-set-wall-display ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.setView({ wall_display: (e.target as HTMLSelectElement).value as 'live' | 'stills' })}>
            <option value="live" ?selected=${this.viewValue('wall_display', 'live') !== 'stills'}>תלת־ממד חי</option><option value="stills" ?selected=${this.viewValue('wall_display', 'live') === 'stills'}>תמונות מוכנות</option>
          </select></sw-field></div>
        <div class="row" data-set-kiosk-idle-row><span class="lbl">מסך קיר — מעבר לתמונה מוכנה<span class="muted">אחרי הזמן הזה בלי נגיעה ובלי שינוי בתוכנית, מסך קיר עובר לתמונה המוכנה ומפסיק לצייר פריימים; נגיעה או שינוי מחזירים את התלת־ממד. כל מסך קיר יכול לקבוע זאת בעצמו (הגדרות ‹ מסכי קיר)</span></span>
          <sw-field class="ctl"><select data-set-kiosk-idle ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.setView({ kiosk_idle_s: Number((e.target as HTMLSelectElement).value) as 0 | 10 | 30 | 120 | 600 })}>
            ${([[0, 'לעולם לא'], [10, '10 שניות'], [30, '30 שניות'], [120, '2 דקות'], [600, '10 דקות']] as const).map(([v, l]) => html`<option value=${v} ?selected=${this.viewValue('kiosk_idle_s', 30) === v}>${l}</option>`)}
          </select></sw-field></div>
        <div class="row"><span class="lbl">תמונות מוכנות — סגנונות ושעות<span class="muted">מה „הכן תמונות ותאורה” מצייר לכל קומה: יותר סגנונות ושעות = יותר תמונות ואחסון</span></span>
          <sw-field class="ctl"><select data-set-bake-styles ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.setBakes({ styles: (e.target as HTMLSelectElement).value.split(',') as ('light' | 'dark')[] })}>
            ${[['light,dark', 'שני הסגנונות'], ['light', 'אדריכלי בהיר'], ['dark', 'תאום דיגיטלי כהה']].map(([v, l]) => html`<option value=${v} ?selected=${this.bakeValue('styles', ['light', 'dark']).join(',') === v}>${l}</option>`)}
          </select></sw-field>
          <sw-field class="ctl"><select data-set-bake-bands ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.setBakes({ bands: (e.target as HTMLSelectElement).value.split(',') as ('day' | 'sunset' | 'night')[] })}>
            ${[['day,sunset,night', 'יום, שקיעה ולילה'], ['day,night', 'יום ולילה'], ['day', 'יום בלבד']].map(([v, l]) => html`<option value=${v} ?selected=${this.bakeValue('bands', ['day', 'sunset', 'night']).join(',') === v}>${l}</option>`)}
          </select></sw-field></div>
        <div class="row"><span class="lbl">תמונות מוכנות — הפעלה ומבטים<span class="muted">ידני: העורך לוחץ „הכן תמונות ותאורה”. אוטומטי: ההכנה מתחילה לבד כשעורך פותח קומה שתמונותיה חסרות או אינן מעודכנות (בדפדפן שלו)</span></span>
          <sw-field class="ctl"><select data-set-bake-trigger ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.setBakes({ bake_trigger: (e.target as HTMLSelectElement).value as 'manual' | 'auto' })}>
            <option value="manual" ?selected=${this.bakeValue('bake_trigger', 'manual') !== 'auto'}>ידני — בלחיצה</option><option value="auto" ?selected=${this.bakeValue('bake_trigger', 'manual') === 'auto'}>אוטומטי — בפתיחת קומה</option>
          </select></sw-field>
          <sw-field class="ctl"><select data-set-bake-views ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.setBakes({ bake_views: (e.target as HTMLSelectElement).value as 'iso' | 'iso_top' })}>
            <option value="iso" ?selected=${this.bakeValue('bake_views', 'iso') !== 'iso_top'}>מבט איזומטרי בלבד</option><option value="iso_top" ?selected=${this.bakeValue('bake_views', 'iso') === 'iso_top'}>איזומטרי ומבט מלמעלה</option>
          </select></sw-field></div>
        <div class="row"><span class="lbl">תמונות מוכנות — גודל ומפת תאורה<span class="muted">מפת התאורה מוסיפה הצללה רכה ואור מנורות לתצוגה הריאליסטית</span></span>
          <sw-field class="ctl"><select data-set-bake-size ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.setBakes({ size: (e.target as HTMLSelectElement).value })}>
            ${['1280x800', '1600x1000', '1920x1200'].map((v) => html`<option value=${v} ?selected=${this.bakeValue('size', '1600x1000') === v}>${v.replace('x', '×')}</option>`)}
          </select></sw-field>
          <sw-field class="ctl"><select data-set-bake-lightmap ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.setBakes({ lightmap: (e.target as HTMLSelectElement).value === 'true' })}>
            <option value="true" ?selected=${this.bakeValue('lightmap', true) !== false}>עם מפת תאורה</option><option value="false" ?selected=${this.bakeValue('lightmap', true) === false}>בלי מפת תאורה</option>
          </select></sw-field></div>
        <div class="row"><span class="lbl">אחסון לתמונות מוכנות<span class="muted">לכל קומה / לכל המערכת. כשנגמר המקום נמחקות קודם תמונות שאינן מעודכנות; תמונות מעודכנות לא נמחקות לבד</span></span>
          <sw-field class="ctl"><select data-set-bake-floor-cap ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.setBakes({ floor_cap_mb: Number((e.target as HTMLSelectElement).value) })}>
            ${[16, 32, 64, 128, 256].map((v) => html`<option value=${v} ?selected=${this.bakeValue('floor_cap_mb', 64) === v}>${v} MB לקומה</option>`)}
          </select></sw-field>
          <sw-field class="ctl"><select data-set-bake-total-cap ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.setBakes({ total_cap_mb: Number((e.target as HTMLSelectElement).value) })}>
            ${[128, 256, 512, 1024, 2048].map((v) => html`<option value=${v} ?selected=${this.bakeValue('total_cap_mb', 512) === v}>${v >= 1024 ? `${v / 1024} GB` : `${v} MB`} בסך הכול</option>`)}
          </select></sw-field></div>
        ${api && this.canEdit ? this.renderSiteLocation(api) : nothing}
        <div class="row" data-global-search-row><span class="lbl">${sa('label')}<span class="muted">${sa('hint')}</span></span>
          <sw-search-access .mode=${searchModeOf(this.value('ui.global_search'))} .roles=${String(this.value('ui.global_search_roles') ?? '')} ?disabled=${!api || !this.canEdit}
            @sw-search-access-change=${(e: CustomEvent<{ mode: 'off' | 'admins' | 'roles' | 'all'; roles: string }>) => { this.set('ui.global_search', e.detail.mode); this.set('ui.global_search_roles', parseSearchRoles(e.detail.roles).join(',')); }}></sw-search-access></div>
        ${NVR ? nothing : html`<div class="row"><span class="lbl">הסתרת חיפוש AI<span class="muted">מסיר את הלשונית מהניווט; המסך עצמו נשאר זמין בכתובת</span></span>
          <sw-field class="ctl"><select data-set-hide-search ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.set('ui.hide_search', (e.target as HTMLSelectElement).value)}>
            <option value="false" ?selected=${String(this.value('ui.hide_search') ?? 'false') !== 'true'}>מוצג</option><option value="true" ?selected=${String(this.value('ui.hide_search') ?? 'false') === 'true'}>מוסתר</option>
          </select></sw-field></div>
        <div class="row"><span class="lbl">תמונת מצב באבטחה<span class="muted">העמוד הראשון בלייב; כשהוא מוסתר, לייב נפתח על כל המצלמות והכתובת הישנה מפנה אליהן</span></span>
          <sw-field class="ctl"><select data-set-security-snapshot ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.set('ui.security_snapshot', (e.target as HTMLSelectElement).value)}>
            <option value="true" ?selected=${String(this.value('ui.security_snapshot') ?? 'true') !== 'false'}>מוצגת</option><option value="false" ?selected=${String(this.value('ui.security_snapshot') ?? 'true') === 'false'}>מוסתרת</option>
          </select></sw-field></div>
        <div class="row"><span class="lbl">מקסימום זרמים חיים במקביל<span class="muted">מגן על ה־NVR; מעבר למכסה מוצג צילום בלבד</span></span><sw-field class="ctl"><input type="number" min="1" max="128" data-ltr data-live-max-sessions ?disabled=${!api || !this.canEdit} .value=${String(this.value('media.max_live_sessions') ?? 16)} @change=${(e: Event) => this.set('media.max_live_sessions', Number((e.target as HTMLInputElement).value))} /></sw-field></div>
        ${this.liveCapWarning('media.max_live_sessions') ? html`<div class="err" data-live-warning style="margin-block-start:-4px">${this.liveCapWarning('media.max_live_sessions')}</div>` : nothing}
        <div class="row"><span class="lbl">רעננות צילום (שניות)<span class="muted">snapshot מה־NVR לאריחים; cache בשרת</span></span><sw-field class="ctl"><input type="number" min="5" max="3600" data-ltr ?disabled=${!api || !this.canEdit} .value=${String(this.value('snapshots.max_age_s') ?? 60)} @change=${(e: Event) => this.set('snapshots.max_age_s', Number((e.target as HTMLInputElement).value))} /></sw-field></div>
        <div class="row"><span class="lbl">סשני ניגון במקביל<span class="muted">כל ניגון = זרם playback אחד מה־NVR דרך go2rtc</span></span><sw-field class="ctl"><input type="number" min="1" max="128" data-ltr data-playback-max-sessions ?disabled=${!api || !this.canEdit} .value=${String(this.value('playback.max_sessions') ?? 4)} @change=${(e: Event) => this.set('playback.max_sessions', Number((e.target as HTMLInputElement).value))} /></sw-field></div>
        ${this.playbackWarning() ? html`<div class="err" data-playback-warning style="margin-block-start:-4px">${this.playbackWarning()}</div>` : nothing}
        <div class="row" data-set-cross-sync-row><span class="lbl">ניגון מסונכרן בין מקליטים (ניסיוני)<span class="muted">לא הוכח על שני מקליטים אמיתיים. כבוי: ניגון מסונכרן רק למצלמות של אותו NVR. פעיל: כל מצלמה מנוגנת לפי אזור הזמן וסטיית השעון של המקליט שלה</span></span>
          <sw-field class="ctl"><select data-set-cross-sync ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.set('playback.cross_recorder_sync', (e.target as HTMLSelectElement).value)}>
            <option value="false" ?selected=${String(this.value('playback.cross_recorder_sync') ?? 'false') !== 'true'}>כבוי</option><option value="true" ?selected=${String(this.value('playback.cross_recorder_sync') ?? 'false') === 'true'}>פעיל (ניסיוני)</option>
          </select></sw-field></div>
        <div class="row"><span class="lbl">פקיעת סשן ניגון ללא פעילות (שניות)<span class="muted">אחרי הזמן הזה הזרם נמחק מ־go2rtc אוטומטית</span></span><sw-field class="ctl"><input type="number" min="60" max="3600" data-ltr ?disabled=${!api || !this.canEdit} .value=${String(this.value('playback.lease_s') ?? 600)} @change=${(e: Event) => this.set('playback.lease_s', Number((e.target as HTMLInputElement).value))} /></sw-field></div>
        <div class="row" data-set-stall-row><span class="lbl">זיהוי תקיעה בניגון (שניות)<span class="muted">ללא התקדמות בזמן הזה הנגן מציג "מתחבר מחדש" וממשיך מאותה נקודה</span></span><sw-field class="ctl"><input type="number" min="2" max="30" data-ltr data-set-stall-s ?disabled=${!api || !this.canEdit} .value=${String(this.value('playback.stall_s') ?? 5)} @change=${(e: Event) => this.set('playback.stall_s', Number((e.target as HTMLInputElement).value))} /></sw-field></div>
        <div class="row" data-set-stall-attempts-row><span class="lbl">ניסיונות חיבור מחדש אוטומטיים<span class="muted">אחריהם: "הניגון נעצר" עם כפתור נסה שוב. 0 = בלי ניסיון אוטומטי</span></span><sw-field class="ctl"><input type="number" min="0" max="5" data-ltr data-set-stall-attempts ?disabled=${!api || !this.canEdit} .value=${String(this.value('playback.auto_resume_attempts') ?? 3)} @change=${(e: Event) => this.set('playback.auto_resume_attempts', Number((e.target as HTMLInputElement).value))} /></sw-field></div>
        <div class="row"><span class="lbl">גודל ייצוא מקסימלי (MB)<span class="muted">לפי הנפח המשוער של קבצי ה־NVR בטווח</span></span><sw-field class="ctl"><input type="number" min="50" max="20480" data-ltr ?disabled=${!api || !this.canEdit} .value=${String(this.value('exports.max_mb') ?? 2048)} @change=${(e: Event) => this.set('exports.max_mb', Number((e.target as HTMLInputElement).value))} /></sw-field></div>
        <div class="row"><span class="lbl">שמירת קבצי ייצוא (ימים)<span class="muted">אחרי התקופה הקבצים נמחקים מ־/data/exports</span></span><sw-field class="ctl"><input type="number" min="1" max="365" data-ltr ?disabled=${!api || !this.canEdit} .value=${String(this.value('exports.retention_days') ?? 7)} @change=${(e: Event) => this.set('exports.retention_days', Number((e.target as HTMLInputElement).value))} /></sw-field></div>`}
        <div class="row"><span class="lbl">שמירת אירועים (ימים)<span class="muted">אירועים ישנים יותר נמחקים מהמאגר המקומי</span></span><sw-field class="ctl"><input type="number" min="1" max="3650" data-ltr data-set-events-retention ?disabled=${!api || !this.canEdit} .value=${String(this.value('events.retention_days') ?? 30)} @change=${(e: Event) => this.set('events.retention_days', Number((e.target as HTMLInputElement).value))} /></sw-field></div>
        <div class="row"><span class="lbl">שמירת היסטוריית פעילות (ימים)<span class="muted">מי הדליק, כיבה או שינה התקן; שורות ישנות יותר נמחקות</span></span><sw-field class="ctl"><input type="number" min="7" max="365" data-ltr data-set-activity-retention ?disabled=${!api || !this.canEdit} .value=${String(this.value('device_activity.retention_days') ?? 90)} @change=${(e: Event) => this.set('device_activity.retention_days', Number((e.target as HTMLInputElement).value))} /></sw-field></div>
        <div class="row"><span class="lbl">שמירת אודיט (ימים)<span class="muted">מי עשה מה ומתי — כתיבות ל־NVR, שינויי הרשאות, ייצוא; שורות ישנות יותר נמחקות</span></span><sw-field class="ctl"><input type="number" min="30" max="3650" data-ltr data-set-audit-retention ?disabled=${!api || !this.canEdit} .value=${String(this.value('audit.retention_days') ?? 365)} @change=${(e: Event) => this.set('audit.retention_days', Number((e.target as HTMLInputElement).value))} /></sw-field></div>
        ${NVR ? nothing : html`<div class="row"><span class="lbl">גודל מרבי לחבילת ראיות (MB)<span class="muted">אימות וייבוא של חבילה מהתקנה אחרת; הקובץ נכתב לקובץ זמני ונמחק</span></span><sw-field class="ctl"><input type="number" min="16" max="4096" data-ltr data-set-import-max ?disabled=${!api || !this.canEdit} .value=${String(this.value('cases.import_max_mb') ?? 512)} @change=${(e: Event) => this.set('cases.import_max_mb', Number((e.target as HTMLInputElement).value))} /></sw-field></div>`}
        <div class="row"><span class="lbl">אזור זמן של האתר וה־NVR<span class="muted">IANA · חיפוש והקלטות מתורגמים לשעון הקיר של ה־NVR לפי הכלל הזה (כולל שעון קיץ)</span></span><sw-field class="ctl"><input type="text" data-ltr ?disabled=${!api || !this.canEdit} .value=${String(this.value('time.zone') ?? 'Asia/Jerusalem')} @change=${(e: Event) => this.set('time.zone', (e.target as HTMLInputElement).value.trim())} /></sw-field></div>
        <div class="foot"><sw-button variant="primary" icon="check" ?disabled=${!dirty || this.busy || !api} @click=${() => this.save()}>שמור</sw-button>${this.message ? html`<span class="msg ok" role="status"><sw-icon name="check" size=${13}></sw-icon>${this.message}</span>` : nothing}${this.error ? html`<span class="msg err" role="alert"><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>` : nothing}</div>
        ${!api ? html`<div class="muted">נתוני הדגמה: ההגדרות נשמרות רק מול השרת.</div>` : nothing}
      </sw-card>
      ${NVR ? nothing : html`<system-timeline-colors></system-timeline-colors>`}
      ${this.renderSkins()}
      <sw-card heading="go2rtc" subheading="זרמים של המוצר בשרת החיצוני (קריאה); זרמים זרים אינם מוצגים ואינם משתנים">
        ${!api || !this.canEdit
          ? html`<div class="muted">${api ? 'נדרשת הרשאת מנהל מערכת.' : 'נתוני הדגמה.'}</div>`
          : html`<div class="row"><span class="lbl">שרת<span class="muted">${this.go2rtc ? `גרסה ${String((this.go2rtc as { version?: string }).version ?? '?')}` : 'לא נבדק'}</span></span><span class="end"><sw-button size="sm" icon="refresh" ?disabled=${this.busy} @click=${() => this.loadMedia()}>בדיקה</sw-button><sw-button size="sm" variant="primary" icon="link" ?disabled=${this.busy} @click=${() => this.sync()}>סנכרון זרמים</sw-button></span></div>
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

  /** "קומת ברירת מחדל במפה" (owner 2026-09-30, `map.default_floor`): the floor the map's floor tab opens first, chosen
   * from the tree grouped by site and building; "אוטומטי" (empty) = the first floor each user may read. A user who may not
   * read the chosen floor gets their own first floor (the setting never grants access); deleting the floor clears it. */
  private renderDefaultFloor(api: boolean) {
    const current = String(this.value('map.default_floor') ?? '');
    const groups = this.floorTree.flatMap((s) => (s.buildings ?? []).map((b) => ({ label: `${s.name} ‹ ${b.name}`, floors: b.floors ?? [] }))).filter((g) => g.floors.length);
    return html`<div class="row"><span class="lbl">קומת ברירת מחדל במפה<span class="muted">הקומה שנפתחת ראשונה כשנכנסים ללשונית "מפת קומה"; אוטומטי: הקומה הראשונה שהמשתמש רשאי לראות. משתמש שאינו רשאי לראות את הקומה שנבחרה מקבל את הקומה הראשונה שלו</span></span>
      <sw-field class="ctl"><select data-set-default-floor ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.set('map.default_floor', (e.target as HTMLSelectElement).value)}>
        <option value="" ?selected=${current === ''}>אוטומטי</option>
        ${groups.map((g) => html`<optgroup label=${g.label}>${g.floors.map((f) => html`<option value=${f.id} ?selected=${f.id === current}>${f.name}</option>`)}</optgroup>`)}
      </select></sw-field></div>`;
  }

  /** "מפה" (owner 2026-09-29): how the floor maps open and what the level bar lists. plan.levels also stays on the
   * media tab (the same key, mirrored), so nothing that pointed there moves. */
  private renderMap() {
    const api = isApi();
    const dirty = Object.keys(this.draft).length > 0;
    const surfaces = (this.value('plan.surfaces') as ('devices' | 'area')[] | undefined) ?? ['devices', 'area'];
    const sel = (key: keyof ProductSettings, dflt: string, attr: string, options: [string, string][]) => html`<sw-field class="ctl"><select data-set=${attr} ?disabled=${!api || !this.canEdit}
        @change=${(e: Event) => this.set(key, (e.target as HTMLSelectElement).value as never)}>${options.map(([v, l]) => html`<option value=${v} ?selected=${String(this.value(key) ?? dflt) === v}>${l}</option>`)}</select></sw-field>`;
    return html`<div class="sections">
      <sw-card heading="מפה" subheading="איך מפות הקומה נפתחות ומה מוצג בסרגל המפלסים" data-settings-map>
        ${this.renderDefaultFloor(api)}
        <div class="row"><span class="lbl">תצוגת פתיחה של מפה<span class="muted">המפה החיה, המפה ההיסטורית ודף האירוע נפתחים בתצוגה הזו כשלקומה יש מבנה; הכפתור 2D / 3D ממשיך להחליף בכל ביקור</span></span>
          ${sel('map.default_view', '2d', 'map-default-view', [['2d', 'דו-ממד (2D)'], ['3d', 'תלת-ממד (3D)']])}</div>
        <div class="row"><span class="lbl">מפלסים בפתיחת מפה<span class="muted">המפלס שמוצג כברירת מחדל בכל מפה; שבבי המפלסים ממשיכים לאפשר מעבר בין מפלסים</span></span>
          ${sel('plan.levels', 'all', 'map-plan-levels', [['all', 'כל המפלסים יחד'], ['default', 'מפלס ברירת המחדל של הקומה']])}</div>
        <div class="row"><span class="lbl">מפלסים של חלל משותף<span class="muted">בעורך של הקומה שמציגה חלל משותף (חלל בגובה כפול שהרצפה שלו בקומה אחרת): להציג בסרגל המפלסים גם את מפלסי הקומה שלו ("מפלס ראשי · קומה -1")</span></span>
          ${sel('map.shared_levels', 'show', 'map-shared-levels', [['show', 'מוצגים'], ['hide', 'מוסתרים']])}</div>
        <div class="row" data-plan-surfaces><span class="lbl">התוכנית החיה מחוץ ללשונית המפה<span class="muted">איפה עוד מוצגת תוכנית הקומה עם מצבי החדרים; כל מקום לחוד</span></span>
          <span class="ctl" style="display:flex;flex-direction:column;gap:6px">
            ${([['devices', 'תצוגת "תוכנית" במסך חשמל והתקנים (העץ נשאר בצד)'], ['area', 'כרטיס "על התוכנית" בדף האזור']] as const).map(([v, l]) => html`<label class="chk"><input type="checkbox" data-set-plan-surface=${v} ?disabled=${!api || !this.canEdit} .checked=${surfaces.includes(v)} @change=${(e: Event) => this.set('plan.surfaces', (e.target as HTMLInputElement).checked ? [...surfaces.filter((x) => x !== v), v] : surfaces.filter((x) => x !== v))} /> ${l}</label>`)}
          </span></div>
        <div class="row" data-camsuggest-distance><span class="lbl">הצעת מצלמה לאזור: טווח מרבי<span class="muted">בעורך התוכנית, כפתור "הצע מצלמה קרובה" באזור מציע רק מצלמות שנמצאות בתוך הטווח הזה מקצה האזור, באחוזים מרוחב התוכנית. ההצעה לא נשמרת עד שלוחצים "קבל"</span></span>
          ${sel('plan.camsuggest_distance', '35', 'camsuggest-distance', [['10', '10%'], ['20', '20%'], ['35', '35%'], ['50', '50%'], ['75', '75%'], ['100', '100%']])}</div>
        <div class="row" data-camsuggest-fov><span class="lbl">הצעת מצלמה לאזור: משקל כיוון הצילום<span class="muted">מצלמה עם שדה ראייה ידוע שאינה פונה אל האזור יורדת בדירוג; "מרחק בלבד" מתעלם מהכיוון, "חובה" מסתיר מצלמה שמחטיאה את האזור לגמרי</span></span>
          ${sel('plan.camsuggest_fov', '50', 'camsuggest-fov', [['0', 'מרחק בלבד'], ['25', 'נמוך'], ['50', 'בינוני'], ['75', 'גבוה'], ['100', 'חובה']])}</div>
        <div class="row" data-camsuggest-count><span class="lbl">הצעת מצלמה לאזור: מספר הצעות</span>
          ${sel('plan.camsuggest_count', '3', 'camsuggest-count', [['1', 'אחת'], ['2', 'שתיים'], ['3', 'שלוש']])}</div>
        <div class="foot"><sw-button variant="primary" icon="check" data-save-map ?disabled=${!dirty || this.busy || !api} @click=${() => this.save()}>שמור</sw-button>${this.message ? html`<span class="msg ok" role="status"><sw-icon name="check" size=${13}></sw-icon>${this.message}</span>` : nothing}${this.error ? html`<span class="msg err" role="alert"><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>` : nothing}</div>
        ${!api ? html`<div class="muted">נתוני הדגמה: ההגדרות נשמרות רק מול השרת.</div>` : nothing}
      </sw-card>
      <system-plan-view data-section="plan-view"></system-plan-view>
      ${api && this.canEdit ? html`<plan-area-links-admin data-section="area-links"></plan-area-links-admin>` : nothing}
    </div>`;
  }

  /** CR-006 phase 2 (slice 2a): AI-rendered floor skins - the provider, exactly what leaves the premises, the privacy
   * acknowledgement, the budgets and the owner's connection test (one synthetic 64x64 pattern, never a plan). */
  private renderSkins() {
    const api = isApi();
    const st = this.skins;
    const keys = ['skins.model', 'skins.privacy_ack', 'skins.budget_renders_per_floor', 'skins.budget_monthly'] as const;
    const dirty = keys.some((k) => k in this.draft);
    const ack = String(this.value('skins.privacy_ack') ?? 'false') === 'true';
    const t = this.skinsTest;
    return html`<sw-card data-skins heading="סקינים מרונדרים (AI)" subheading="תמונה פוטוריאליסטית של קומה מספק רינדור חיצוני — נשלחת רק אחרי אישור, פעם אחת לקומה, ונשמרת לשימוש חוזר">
      <div class="row"><span class="lbl">ספק ומודל<span class="muted">OpenAI (עריכת תמונה לפי תמונת בקרה). המודל ניתן לשינוי כשיוצא מודל חדש</span></span>
        <sw-field class="ctl"><input type="text" data-ltr data-set-skins-model ?disabled=${!api || !this.canEdit} .value=${String(this.value('skins.model') ?? 'gpt-image-1.5')} @change=${(e: Event) => this.set('skins.model', (e.target as HTMLInputElement).value.trim())} /></sw-field></div>
      <div class="row" data-skins-key><span class="lbl">מפתח API<span class="muted">מוזן בהגדרות ‹ חיבורים ‹ סודות ונשמר מוצפן; לא ביומנים, והמסך יודע רק אם הוגדר</span></span>
        <sw-badge kind=${st?.key_configured ? 'live' : 'unknown'} label=${!st ? '—' : st.key_configured ? 'מוגדר' : 'לא מוגדר'}></sw-badge></div>
      <div class="row" data-skins-leaves style="flex-direction:column;align-items:stretch"><span class="lbl">מה יוצא מהמתקן לספק כשנשלח רינדור</span>
        <ul class="steps">${(st?.leaves ?? []).map((x) => html`<li>${x}</li>`)}</ul>
        <span class="lbl">מה לעולם לא נשלח</span>
        <ul class="steps">${(st?.never_leaves ?? []).map((x) => html`<li>${x}</li>`)}</ul></div>
      <div class="row"><span class="lbl">אישור פרטיות<span class="muted">כל עוד לא אושר, שום דבר לא נשלח — גם לא בדיקת החיבור</span></span>
        <sw-field class="ctl"><select data-set-skins-ack ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.set('skins.privacy_ack', (e.target as HTMLSelectElement).value as 'true' | 'false')}>
          <option value="false" ?selected=${!ack}>לא אושר — לא נשלח דבר</option><option value="true" ?selected=${ack}>אושר — מותר לשלוח את המתואר למעלה</option>
        </select></sw-field></div>
      <div class="row"><span class="lbl">רינדורים לקומה<span class="muted">לכל קומה ולכל גרסת מבנה (ברירת מחדל 4)</span></span><sw-field class="ctl"><input type="number" min="0" max="6" data-ltr data-set-skins-per-floor ?disabled=${!api || !this.canEdit} .value=${String(this.value('skins.budget_renders_per_floor') ?? 4)} @change=${(e: Event) => this.set('skins.budget_renders_per_floor', Number((e.target as HTMLInputElement).value))} /></sw-field></div>
      <div class="row"><span class="lbl">רינדורים בחודש<span class="muted">${st ? `נוצלו החודש ${st.budget.used_month} מתוך ${st.budget.monthly_cap} (כולל בדיקות חיבור)` : 'לכל ההתקנה, לחודש קלנדרי'}</span></span><sw-field class="ctl"><input type="number" min="0" max="500" data-ltr data-set-skins-monthly ?disabled=${!api || !this.canEdit} .value=${String(this.value('skins.budget_monthly') ?? 20)} @change=${(e: Event) => this.set('skins.budget_monthly', Number((e.target as HTMLInputElement).value))} /></sw-field></div>
      ${st ? html`<div class="muted" data-skins-estimate>הערכת עלות לרינדור של קומה (${st.estimate.size}, ${st.estimate.quality}): כ־$${st.estimate.cost_estimate_usd} — הערכה בלבד, לא מחירון מאומת; העלות בפועל מופיעה בחשבון OpenAI.</div>` : nothing}
      ${this.canEdit && api
        ? html`<div class="foot">
            <sw-button variant="primary" icon="check" data-save-skins ?disabled=${!dirty || this.busy} @click=${() => this.save().then(() => this.loadSkins())}>שמור</sw-button>
            <sw-button icon="send" data-skins-test ?disabled=${this.skinsBusy || dirty} @click=${() => this.runSkinsTest()}>בדיקת חיבור לספק הרינדור</sw-button>
            ${dirty ? html`<span class="muted" style="align-self:center">שמור קודם — הבדיקה משתמשת בהגדרות השמורות</span>` : nothing}
          </div>
          <div class="muted">הבדיקה שולחת תמונת ניסיון סינתטית אחת בגודל 64×64 (פסי צבע ולוח שחמט — לא תוכנית ולא תמונה מהמתקן) עם הנחיה קבועה, נרשמת ביומן, ונספרת בתקציב החודשי.</div>`
        : nothing}
      ${this.skinsBusy ? html`<div class="muted" data-skins-test-busy>שולח בקשת בדיקה…</div>` : nothing}
      ${this.skinsError ? html`<div class="err" data-skins-test-error>${this.skinsError}</div>` : nothing}
      ${t
        ? html`<div class="row" data-skins-test-result data-ok=${t.ok ? 'true' : 'false'}><span class="lbl">${t.ok ? `הספק ענה: HTTP ${t.http_status}` : t.http_status ? `הספק סירב: HTTP ${t.http_status}` : 'הספק לא ענה'}<span class="muted">${t.model}${t.message ? ` · ${t.message}` : ''}${t.request_id ? ` · ${t.request_id}` : ''}${t.ok && !t.image ? ' · התשובה לא כללה תמונה' : ''}</span></span>
            ${t.image ? html`<img data-skins-test-image src=${t.image} alt="תשובת הספק לבדיקה" style="inline-size:96px;block-size:96px;object-fit:cover;border-radius:6px;border:1px solid var(--sw-border)" />` : nothing}</div>`
        : st?.last_test
          ? html`<div class="muted" data-skins-last-test>בדיקה אחרונה: ${fmtTime(st.last_test.created_at)} · ${st.last_test.status === 'ok' ? 'הצליחה' : `נכשלה (${st.last_test.error_code ?? st.last_test.http_status ?? ''})`}</div>`
          : nothing}
    </sw-card>`;
  }

  private async loadSkins() {
    if (!isApi()) return;
    try {
      this.skins = await getSkinsStatus();
    } catch {
      this.skins = null;
    }
  }

  private async runSkinsTest() {
    this.skinsBusy = true;
    this.skinsError = '';
    this.skinsTest = null;
    try {
      this.skinsTest = await runSkinsTest();
    } catch (err) {
      this.skinsError = describeError(err);
    } finally {
      this.skinsBusy = false;
      void this.loadSkins();
    }
  }

  /** הגדרות › מתגי מסכי כניסה (CR-005 recorded decision 2026-09-28, embedded panel): per screen, WisKey's own Home Assistant
   * panel embedded as-is (the default) or the SMPLWISE screen; WisKey's other screens are always embedded. */
  private renderAccessControl() {
    const api = isApi();
    const dirty = ACCESS_SCREENS.some((a) => `access.ui.${a.screen}` in this.draft) || 'ui.hide_wiskey' in this.draft || 'access.phone_embed' in this.draft;
    const choice = (s: WiskeyScreen) => (String(this.value(`access.ui.${s}`) ?? 'wiskey') === 'smplwise' ? 'smplwise' : 'wiskey');
    return html`<div class="sections">
      <sw-card heading="מתגי מסכי כניסה" subheading="לכל מסך: הממשק המקורי של WisKey מוטמע כמו שהוא, או המסך שנבנה ב־Arx. הלשונית נשארת באותו מקום ובאותו שם.">
        <div class="row"><span class="lbl">הצג את WisKey במערכת<span class="muted">הסתרה מסירה את כל אזור WisKey מהניווט לכל המשתמשים, ללא תלות בתפקיד; הבחירות למסכים הבודדים למטה חלות רק כשהאזור מוצג</span></span>
          <sw-field class="ctl"><select data-set-hide-wiskey ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.set('ui.hide_wiskey', (e.target as HTMLSelectElement).value)}>
            <option value="false" ?selected=${String(this.value('ui.hide_wiskey') ?? 'false') !== 'true'}>מוצג</option><option value="true" ?selected=${String(this.value('ui.hide_wiskey') ?? 'false') === 'true'}>מוסתר</option>
          </select></sw-field></div>
        ${ACCESS_SCREENS.map(
          (a) => html`<div class="row"><span class="lbl">${a.label}<span class="muted">${a.detail} · <span class="ltr">${a.href}</span></span></span>
            <sw-field class="ctl"><select data-set-access-ui=${a.screen} ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.set(`access.ui.${a.screen}`, (e.target as HTMLSelectElement).value as 'wiskey' | 'smplwise')}>
              <option value="wiskey" ?selected=${choice(a.screen) === 'wiskey'}>WisKey (מוטמע)</option>
              <option value="smplwise" ?selected=${choice(a.screen) === 'smplwise'}>Arx</option>
            </select></sw-field></div>`,
        )}
        <div class="row"><span class="lbl">הטמעה גם באפליקציית הטלפון (ניסיוני)<span class="muted">כבוי: באפליקציית הטלפון WisKey לא מוטמע - מוצג המסך של Arx או הערה, עם "פתח ב-WisKey". מופעל: Arx מעביר את ההזדהות של האפליקציה לתשתית המערכת שבתוך המסגרת. אם ההזדהות לא מצליחה, המסך חוזר לבד להתנהגות הרגילה.</span></span>
          <sw-field class="ctl"><select data-set-phone-embed ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.set('access.phone_embed', (e.target as HTMLSelectElement).value)}>
            <option value="false" ?selected=${String(this.value('access.phone_embed') ?? 'false') !== 'true'}>כבוי</option><option value="true" ?selected=${String(this.value('access.phone_embed') ?? 'false') === 'true'}>מופעל</option>
          </select></sw-field></div>
        <div class="row" data-access-ui-fixed><span class="lbl">שאר מסכי WisKey (סנכרון, בריאות, יומן שינויים, ניהול)<span class="muted">קיימים רק ב־WisKey, ולכן תמיד מוטמעים</span></span><sw-field class="ctl"><select disabled><option selected>WisKey (מוטמע) · קבוע</option></select></sw-field></div>
        <div class="muted" style="margin-block-start:8px">במסך מוטמע הדפדפן מריץ את הממשק של WisKey עצמו בתוך תשתית המערכת, עם החיבור של המשתמש אליה: ההרשאות, האישורים והאודיט שם הם של WisKey, לא של Arx. "פתח בחלון מלא" פותח את אותו לוח בלשונית נפרדת.</div>
        <div class="muted" data-access-ui-embed-api style="margin-block-start:6px">ההטמעה משתמשת בממשק ההטמעה של WisKey (WisKey 2.0.0-rc.19 ומעלה): הלשוניות נבנות מהמסכים ש־WisKey מתיר למשתמש והמעבר ביניהן נעשה בהודעות; בגרסאות WisKey ישנות יותר ההטמעה עוברת אוטומטית לשיטה הקודמת.</div>
        <div class="muted" data-access-ui-warning style="margin-block-start:6px;color:var(--sw-text)"><b>שים לב:</b> משתמש שחשבון תשתית המערכת שלו מחזיק ב־WisKey הרשאת ניהול (manage), או שהוא מנהל תשתית המערכת, יכול בתוך WisKey המוטמע לפתוח דלתות ולערוך אנשים (PIN, כרטיסים, תוקף) — בלי שלב האישור של Arx ובלי רישום באודיט של Arx. התיעוד של הפעולות האלה נמצא רק ביומן של WisKey.</div>
        ${this.canEdit
          ? html`<div class="foot"><sw-button variant="primary" icon="check" data-save-access-ui ?disabled=${!dirty || this.busy || !api} @click=${() => this.save()}>שמור</sw-button>${this.message && this.tab === 'access-control' ? html`<span class="msg ok" role="status"><sw-icon name="check" size=${13}></sw-icon>${this.message}</span>` : nothing}${this.error && this.tab === 'access-control' ? html`<span class="msg err" role="alert"><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>` : nothing}</div>`
          : html`<div class="muted">${api ? 'שינוי הבחירה דורש הרשאת מנהל מערכת.' : 'נתוני הדגמה: ההגדרות נשמרות רק מול השרת.'}</div>`}
      </sw-card>
      <system-access-display></system-access-display>
      ${!api || can('access.admin.read') ? html`<system-access-parity></system-access-parity>` : nothing}
      <system-wiskey-diagnostics></system-wiskey-diagnostics>
    </div>`;
  }

  /** הגדרות › גישה מרחוק (CR-008 SmplWise Arx, owner decisions D4/D5/D7/D8 of 2026-09-29): who may sign in through
   * `https://<HA hostname>/arx`, how the browser keeps the sign-in, and the remote video policy. The channel itself is the
   * add-on option remote_access; the per-user flag lives in משתמשים והרשאות. system.configure edits. */
  private renderRemote() {
    const api = isApi();
    const ro = !api || !this.canEdit;
    const keys = ['remote.policy', 'remote.admins_default', 'remote.session', 'remote.idle_lock_minutes', 'remote.default_profile', 'remote.mse_fallback', 'remote.require_mfa_admin', 'security.second_factor_policy', 'remote.max_live_streams', 'remote.wall_profile', 'app.android_url', 'app.android_version', 'app.android_sha256'] as const;
    const dirty = keys.some((k) => k in this.draft);
    const v = <K extends (typeof keys)[number]>(k: K, d: string) => String(this.value(k) ?? d);
    const sel = (key: (typeof keys)[number], d: string, options: [string, string][]) => html`<sw-field class="ctl"><select data-set-remote=${key} ?disabled=${ro} @change=${(e: Event) => this.set(key, (e.target as HTMLSelectElement).value as never)}>
        ${options.map(([val, label]) => html`<option value=${val} ?selected=${v(key, d) === val}>${label}</option>`)}
      </select></sw-field>`;
    const idle = v('remote.session', 'rolling_90d') === 'rolling_90d_idle_lock';
    return html`<div class="sections" data-remote-settings>
      ${inAndroidApp()
        ? html`<sw-card heading="אפליקציית Android" subheading="האפליקציה שומרת רשימת שרתים; אפשר לעבור ביניהם בכל רגע." data-remote-android-app>
            <div class="row" data-remote-android-switch><span class="lbl">שרתים באפליקציה<span class="muted">רשימת השרתים של האפליקציה: מעבר לשרת אחר, הוספה ועריכה</span></span><sw-button size="sm" icon="list" data-arx-switch-server @click=${() => switchServer()}>החלף שרת</sw-button></div>
          </sw-card>`
        : nothing}
      <sw-card heading="גישה מרחוק · SmplWise Arx" subheading="כניסה דרך https://<שם ה־Home Assistant>/arx עם מסך הכניסה של המערכת (שם משתמש וסיסמה של Home Assistant). הערוץ עצמו מופעל באפשרות ה־add-on remote_access.">
        <div class="row"><span class="lbl">מי רשאי להיכנס מרחוק<span class="muted">דגל אישי: רק משתמשים שהופעלה להם גישה מרחוק במסך משתמשים והרשאות · כל בעל תפקיד: כל משתמש Home Assistant עם תפקיד כלשהו במערכת</span></span>
          ${sel('remote.policy', 'flag', [['flag', 'דגל אישי לכל משתמש'], ['any_role', 'כל משתמש עם תפקיד']])}</div>
        <div class="row" data-remote-admins-default-row><span class="lbl">מנהלים – גישה מרחוק כברירת מחדל<span class="muted">מנהל מערכת נכנס מרחוק בלי דגל אישי · חל על "דגל אישי לכל משתמש"</span></span>
          ${sel('remote.admins_default', 'true', [['true', 'מופעלת'], ['false', 'כבויה']])}</div>
        <div class="row"><span class="lbl">שמירת הכניסה בדפדפן<span class="muted">90 יום מתחדשים: כמו האפליקציה של Home Assistant · עד סגירת הדפדפן: הכניסה נמחקת בסגירה · 90 יום עם נעילה: כניסה חוזרת אחרי זמן ללא פעילות</span></span>
          ${sel('remote.session', 'rolling_90d', [['rolling_90d', '90 יום מתחדשים'], ['browser_session', 'עד סגירת הדפדפן'], ['rolling_90d_idle_lock', '90 יום עם נעילה בחוסר פעילות']])}</div>
        <div class="muted" data-remote-shared-login style="margin-block-start:6px">שימו לב: הכניסה ל־Arx מחברת את אותו דפדפן גם ל־Home Assistant בכתובת <span class="ltr">/</span> של אותו שם מתחם (כדי ש־WisKey ייפתח מחובר). ב"עד סגירת הדפדפן" החיבור ל־Home Assistant קיים רק כל עוד דף Arx פתוח; בנעילה בחוסר פעילות הוא מבוטל כשהנעילה מופעלת ב־Arx, אבל עד שפותחים את Arx שוב, Home Assistant בכתובת <span class="ltr">/</span> עדיין פתוח באותו דפדפן. יציאה מ־Arx מנתקת משניהם.</div>
        ${idle
          ? html`<div class="row"><span class="lbl">נעילה אחרי (דקות ללא פעילות)<span class="muted">5 עד 10080 דקות · ברירת מחדל 720 (12 שעות)</span></span>
              <sw-field class="ctl"><input type="number" min="5" max="10080" step="5" data-set-remote="remote.idle_lock_minutes" .value=${v('remote.idle_lock_minutes', '720')} ?disabled=${ro} @change=${(e: Event) => this.set('remote.idle_lock_minutes', Number((e.target as HTMLInputElement).value))} /></sw-field></div>`
          : nothing}
        <div class="row"><span class="lbl">אימות דו־שלבי למנהלים<span class="muted">כשמופעל: משתמש עם הרשאות ניהול נכנס מרחוק רק אם הפעיל MFA בפרופיל ה־Home Assistant שלו</span></span>
          ${sel('remote.require_mfa_admin', 'false', [['false', 'רשות'], ['true', 'חובה למנהלים']])}</div>
        <div class="row" data-second-factor-policy-row><span class="lbl">${t('secondFactor.policyLabel')}</span>
          ${sel('security.second_factor_policy', 'optional', [['optional', t('secondFactor.policyOptional')], ['admins', t('secondFactor.policyAdmins')]])}</div>
      </sw-card>
      <sw-card heading="הורדת אפליקציית Android" subheading="מוצגת במסך הכניסה רק למי שנכנס ממכשיר Android, ורק כשהוגדרה כתובת. ריק = לא מוצגת." data-card="remote.android-download" data-android-download-settings>
        <div class="row"><span class="lbl">כתובת הורדה<span class="muted">https בלבד</span></span>
          <sw-field class="ctl"><input type="url" inputmode="url" maxlength="2000" placeholder="https://" data-ltr data-set-remote="app.android_url" .value=${v('app.android_url', '')} ?disabled=${ro} @change=${(e: Event) => this.set('app.android_url', (e.target as HTMLInputElement).value.trim() as never)} /></sw-field></div>
        <div class="row"><span class="lbl">תווית גרסה<span class="muted">לא חובה</span></span>
          <sw-field class="ctl"><input type="text" maxlength="32" data-ltr data-set-remote="app.android_version" .value=${v('app.android_version', '')} ?disabled=${ro} @change=${(e: Event) => this.set('app.android_version', (e.target as HTMLInputElement).value.trim() as never)} /></sw-field></div>
        <div class="row"><span class="lbl">SHA-256<span class="muted">לא חובה · מוצג לאימות הקובץ</span></span>
          <sw-field class="ctl"><input type="text" maxlength="64" spellcheck="false" data-ltr data-set-remote="app.android_sha256" .value=${v('app.android_sha256', '')} ?disabled=${ro} @change=${(e: Event) => this.set('app.android_sha256', (e.target as HTMLInputElement).value.trim() as never)} /></sw-field></div>
      </sw-card>
      ${api
        ? html`<sw-card heading="כניסות פעילות מרחוק" subheading=${this.canEdit ? 'כל הכניסות הפעילות של כל המשתמשים: דפדפן או אפליקציה, מאיפה (מדינה או כתובת מוסתרת), מתי. ניתוק סוגר מיד את חיבורי הווידאו והעדכונים שלה, והכניסה הזו לא תוכל לחזור בלי כניסה מחדש.' : 'הכניסות הפעילות שלך מרחוק.'} data-card="remote.sessions" data-remote-sessions-card>
            <sw-remote-sessions scope=${this.canEdit ? 'all' : 'own'} @remote-signed-out=${() => void arxLogout('logout')}></sw-remote-sessions>
          </sw-card>`
        : nothing}
      ${api && this.canEdit
        ? html`<sw-card heading="מדיניות אבטחת תוכן (CSP)" subheading="מדיניות מחמירה יותר לגישה מרחוק: בלי תגיות עיצוב מוטמעות בדף. היא רצה קודם במצב דיווח בלבד; אחרי שעוברים על הדיווחים כאן אפשר לאכוף אותה." data-card="remote.csp" data-csp-card>
            <sw-csp-reports .canEdit=${this.canEdit}></sw-csp-reports>
          </sw-card>`
        : nothing}
      <sw-card heading="וידאו מרחוק" subheading="WebRTC עובר ישירות בין הדפדפן ל־go2rtc; MSE מעביר את הווידאו עצמו דרך המנהרה ולכן הוא רק מוצא אחרון.">
        <div class="row"><span class="lbl">זרם ברירת מחדל<span class="muted">הזרם שצופה מרוחק מקבל ראשון, ב־WebRTC</span></span>
          ${sel('remote.default_profile', 'main', [['main', 'ראשי (main)'], ['sub', 'משני (sub)']])}</div>
        <div class="row" data-remote-wall-profile-row><span class="lbl">איכות בקיר המצלמות מבחוץ<span class="muted">הזרם שכל אריח בקיר "כל המצלמות" מנגן מרחוק; אפשר לשנות גם במכשיר עצמו, בקיר.<br /><span data-remote-wall-hint>זרם ראשי בקיר דורש חיבור מהיר; במכשיר נייד מוצגות רק המצלמות שעל המסך</span></span></span>
          ${sel('remote.wall_profile', 'sub', [['sub', 'רגילה (זרם משני)'], ['main', 'גבוהה (זרם ראשי)']])}</div>
        <div class="row"><span class="lbl">MSE כמוצא אחרון<span class="muted">כש־WebRTC לא מתחבר או לא מפענח (לא כשהתעבורה היא WebRTC בלבד). כבוי: אין וידאו דרך המנהרה בכלל</span></span>
          ${sel('remote.mse_fallback', 'true', [['true', 'מותר (מוצג לצופה)'], ['false', 'אסור']])}</div>
        <div class="row"><span class="lbl">זרמים חיים לכל כניסה<span class="muted">כמה צפיות חיות במקביל מותרות לכל דפדפן או אפליקציה שנכנסו מרחוק (1 עד 128, ברירת מחדל 16); הצפייה הבאה נדחית עם הסבר. המכסה הכללית של המערכת חלה בנוסף<br /><span data-remote-cap-hint>מומלץ: לפחות כמספר המצלמות בקיר</span>${this.health?.remote?.live_streams != null ? html` · <span data-remote-live-now>פעילים עכשיו: ${this.health.remote.live_streams}</span>` : nothing}</span></span>
          <sw-field class="ctl"><input type="number" min="1" max="128" data-ltr data-set-remote="remote.max_live_streams" .value=${v('remote.max_live_streams', '16')} ?disabled=${ro} @change=${(e: Event) => this.set('remote.max_live_streams', Number((e.target as HTMLInputElement).value))} /></sw-field></div>
        ${this.liveCapWarning('remote.max_live_streams') ? html`<div class="err" data-remote-live-warning style="margin-block-start:-4px">${this.liveCapWarning('remote.max_live_streams')}</div>` : nothing}
        ${this.renderCodecSummary()}
        <div class="muted" data-remote-codec-hint style="margin-block-start:8px">דפדפנים מפענחים ב־WebRTC רק H.264 ללא B-frames; H.265 לא מתנגן ב־WebRTC ברוב הדפדפנים. אם הזרם הראשי של ה־NVR אינו כזה, הגדירו בו H.264 ללא B-frames או בחרו כאן בזרם המשני.</div>
      </sw-card>
      ${api && can('system.configure') ? html`<system-video-conn-test></system-video-conn-test>` : nothing}
      ${this.canEdit
        ? html`<div class="foot"><sw-button variant="primary" icon="check" data-save-remote ?disabled=${!dirty || this.busy} @click=${() => this.save()}>שמור</sw-button>${this.message && this.tab === 'remote' ? html`<span class="msg ok" role="status"><sw-icon name="check" size=${13}></sw-icon>${this.message}</span>` : nothing}${this.error && this.tab === 'remote' ? html`<span class="msg err" role="alert"><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>` : nothing}</div>`
        : html`<div class="muted">${api ? 'שינוי ההגדרות דורש הרשאת מנהל מערכת.' : 'נתוני הדגמה: ההגדרות נשמרות רק מול השרת.'}</div>`}
    </div>`;
  }

  /** CR-008 D7: the codec check as one read-only line (counts from GET /health; the cameras and the hints are in the
   * health report's "וידאו ב־WebRTC" card). */
  private renderCodecSummary() {
    const v = this.health?.video_codecs;
    const open = (e: Event) => {
      e.preventDefault();
      this.openTab('health');
    };
    const link = html`<a href="#/system/diagnostics?tab=health" data-remote-codec-link @click=${open}>לפירוט בבריאות המערכת</a>`;
    let text: string;
    if (!isApi()) text = 'נתוני הדגמה: קידוד הזרמים נקרא מה־NVR רק מול השרת.';
    else if (!v) text = 'קידוד הזרמים לא נקרא.';
    else if (!v.checked) text = 'קידוד הזרמים טרם נקרא מה־NVR (נקרא בגילוי המצלמות הבא).';
    else text = `זרם ראשי: ${v.main.ok} מתוך ${v.checked} מצלמות מתנגנים ב־WebRTC${v.main.no ? ` · ${v.main.no} לא יתנגנו` : ''}${v.main.unknown ? ` · ${v.main.unknown} לא ידוע` : ''} · זרם משני: ${v.sub.ok} מתוך ${v.checked}`;
    return html`<div class="row" data-remote-codec-summary><span class="lbl">קידוד הזרמים ב־NVR<span class="muted">${text}</span></span>${isApi() ? link : nothing}</div>`;
  }

  /** הגדרות › חשמל והתקנים (CR-007 slice 6a): how the device-control screens look for everyone in the installation -
   * the style (with a static preview of each), the building screen's first view, the density, the sensors card and
   * the climate strip. Presentation only; per-area layout editing is slice 6b. */
  private renderDevices() {
    const api = isApi();
    const ro = !api || !this.canEdit;
    const keys = ['devices.style', 'devices.default_view', 'devices.density', 'devices.show_sensors', 'devices.area_row', 'devices.floor_row', 'devices.theme', 'devices.scheme', 'devices.glass_scheme', 'devices.area_design'] as const;
    const areaDesign = ({ ...(this.settings ?? {}), ...this.draft })['devices.area_design'] === 'sections' ? 'sections' : 'tiles';
    const dirty = keys.some((k) => k in this.draft);
    const p = devicesPrefsOf({ ...(this.settings ?? {}), ...this.draft });
    const pick = (style: DevicesStyle) => this.set('devices.style', style);
    const swatch = (style: DevicesStyle, name: string, hint: string) => html`<button type="button" class="swatch" data-devices-swatch=${style} aria-pressed=${String(p.style === style)} ?disabled=${ro} @click=${() => pick(style)}>
      <span class=${`sw-prev ${style}`} aria-hidden="true"><i class="tree"></i><i class="on"></i><i></i><i></i><i class="on"></i></span>
      <span class="cap">${name}<span class="muted">${hint}</span></span>
    </button>`;
    return html`<div class="sections">
      <system-home-screen></system-home-screen>
      <sw-card data-devices-settings heading="חשמל והתקנים" subheading="המראה של מסכי החשמל וההתקנים לכל המשתמשים במתקן. תצוגה בלבד: כללי הבטיחות של פעולות מרוכזות (חלון אישור, תוקף, בלי מנעולים, אזעקה ושחרור דלתות) אינם הגדרה.">
        <div class="row"><span class="lbl">סגנון<span class="muted">Arx הוא המראה של שאר המערכת; זכוכית היא הסגנון מהמוקאפ שאושר: משטחים שקופים ומטושטשים, אריחים מעוגלים עם אייקון. שניהם מימין לשמאל.</span></span>
          <sw-field class="ctl"><select data-set-devices-style ?disabled=${ro} @change=${(e: Event) => pick((e.target as HTMLSelectElement).value === 'glass' ? 'glass' : 'smplwise')}>
            <option value="smplwise" ?selected=${p.style === 'smplwise'}>Arx</option><option value="glass" ?selected=${p.style === 'glass'}>זכוכית</option>
          </select></sw-field></div>
        <div class="swatches" role="group" aria-label="תצוגה מקדימה של הסגנונות" data-devices-style-preview>
          ${swatch('smplwise', 'Arx', 'לבן, קווים דקים')}
          ${swatch('glass', 'זכוכית', 'שקוף, מעוגל, אייקונים')}
        </div>
        <devices-theme-picker data-devices-theme-picker .theme=${p.theme} .scheme=${p.scheme} ?disabled=${ro} @devices-pick=${(e: CustomEvent<DevicesPick>) => this.set(e.detail.key, e.detail.value as never)}></devices-theme-picker>
        <div class="row" data-glass-scheme-row><span class="lbl">${t('glassScheme.label')}<span class="muted">${t('glassScheme.hint')}</span></span>
          <sw-field class="ctl"><select data-set-glass-scheme ?disabled=${ro} @change=${(e: Event) => this.set('devices.glass_scheme', (e.target as HTMLSelectElement).value as never)}>
            ${GLASS_SCHEMES.map((g) => html`<option value=${g} ?selected=${p.glassScheme === g}>${t(`glassScheme.${g}`)}</option>`)}
          </select></sw-field></div>
        <div class="row"><span class="lbl">תצוגת הפתיחה של המבנה<span class="muted">מה שמשתמש רואה בפעם הראשונה. מי שבחר בעצמו "כרטיסים" או "אריחים" ממשיך עם הבחירה שלו.</span></span>
          <sw-field class="ctl"><select data-set-devices-view ?disabled=${ro} @change=${(e: Event) => this.set('devices.default_view', (e.target as HTMLSelectElement).value === 'tiles' ? 'tiles' : 'cards')}>
            <option value="cards" ?selected=${p.defaultView === 'cards'}>כרטיסים: עץ המבנה וכרטיסי קומה</option><option value="tiles" ?selected=${p.defaultView === 'tiles'}>אריחים: אריח לכל אזור</option>
          </select></sw-field></div>
        <div class="row"><span class="lbl">כיוון מסך האזור<span class="muted">אריחים צפופים: כרטיס לכל סוג התקנים, בעמודות. מקטעים ברצף: קטע אחרי קטע עם הכותרת בצד והחיישנים לצידם. משתמש עם ההרשאה "התאמה אישית של מסכי חשמל והתקנים" יכול לבחור אחרת רק לעצמו.</span></span>
          <sw-field class="ctl"><select data-set-devices-area-design ?disabled=${ro} @change=${(e: Event) => this.set('devices.area_design', (e.target as HTMLSelectElement).value === 'sections' ? 'sections' : 'tiles')}>
            <option value="tiles" ?selected=${areaDesign === 'tiles'}>אריחים צפופים</option><option value="sections" ?selected=${areaDesign === 'sections'}>מקטעים ברצף</option>
          </select></sw-field></div>
        <div class="row"><span class="lbl">צפיפות<span class="muted">דחוסה: אריחים, שורות ורווחים קטנים יותר, יותר אזורים במסך אחד</span></span>
          <sw-field class="ctl"><select data-set-devices-density ?disabled=${ro} @change=${(e: Event) => this.set('devices.density', (e.target as HTMLSelectElement).value === 'compact' ? 'compact' : 'comfortable')}>
            <option value="comfortable" ?selected=${p.density === 'comfortable'}>מרווחת</option><option value="compact" ?selected=${p.density === 'compact'}>דחוסה</option>
          </select></sw-field></div>
        <div class="row"><span class="lbl">חיישנים<span class="muted">כרטיס החיישנים במסך האזור ומונה החיישנים במסך המבנה</span></span>
          <sw-field class="ctl"><select data-set-devices-sensors ?disabled=${ro} @change=${(e: Event) => this.set('devices.show_sensors', (e.target as HTMLSelectElement).value === 'false' ? 'false' : 'true')}>
            <option value="true" ?selected=${p.showSensors}>מוצג</option><option value="false" ?selected=${!p.showSensors}>מוסתר</option>
          </select></sw-field></div>
        <div data-area-row-setting style="margin-block:12px">
          <div class="lbl" style="margin-block-end:8px"><strong>מה מוצג ליד שם האזור</strong><span class="muted">בשורת כל אזור ובכותרת הקומה, שורה אחת בלי גלישה. הסדר קובע: בטלפון מוצגים רק הפריטים שמעל הקו, השאר נאספים ל־+N. כל השאר תמיד בתוך האזור. מי שמוגדרת לו התאמה אישית של המסך יכול לבחור אחרת לעצמו.</span></div>
          <area-row-editor style="display:block;max-inline-size:460px" data-area-row-editor-settings .area=${p.areaRow} .floor=${p.floorRow} ?disabled=${ro} @area-row-change=${(e: CustomEvent<AreaRowChange>) => { this.set('devices.area_row', e.detail.area); this.set('devices.floor_row', e.detail.floor); }}></area-row-editor>
        </div>
        <div class="muted" data-devices-layout-next style="margin-block-start:8px">הפריסה עצמה (מיקום וגודל של כרטיסים ואריחים, כותרת, אייקון, גודל טקסט וצבע לפי תפקיד) נערכת במסך המבנה ובמסך האזור, בכפתור "ערוך פריסה".</div>
        ${this.canEdit && api
          ? html`<div class="foot"><sw-button variant="primary" icon="check" data-save-devices ?disabled=${!dirty || this.busy} @click=${() => this.save()}>שמור</sw-button>${this.message && this.tab === 'devices' ? html`<span class="msg ok" role="status"><sw-icon name="check" size=${13}></sw-icon>${this.message}</span>` : nothing}${this.error && this.tab === 'devices' ? html`<span class="msg err" role="alert"><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>` : nothing}</div>`
          : html`<div class="muted" data-devices-readonly>${api ? 'שינוי ההגדרות דורש הרשאת מנהל מערכת.' : 'נתוני הדגמה: ההגדרות נשמרות רק מול השרת.'}</div>`}
      </sw-card>
      ${api && this.canEdit ? html`<devices-climate-kind-admin data-section="climate-kind"></devices-climate-kind-admin>` : nothing}
      ${api && this.canEdit ? html`<devices-type-admin data-section="device-types"></devices-type-admin>` : nothing}
      ${api && this.canEdit ? html`<devices-protected-switches data-section="protected-switches"></devices-protected-switches>` : nothing}
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
    const checked = timeText(new Date(r.checked_at), { seconds: true });
    return html`<div class="sections">
      <sw-card heading="בריאות המערכת" subheading="מצב נפרד לכל רכיב, לא נורה אחת">
        <div class="hsum"><sw-badge kind=${STATUS_KIND[r.status]} label=${r.status === 'ok' ? 'הכל תקין' : r.status === 'warn' ? 'יש מה לבדוק' : 'יש תקלה'}></sw-badge><span>גרסה <span class="ltr">${r.version}</span> · פעיל ${fmtUptime(r.uptime_s)} · נבדק <span class="ltr" data-health-checked>${checked}</span></span><span class="grow"></span><sw-button size="sm" icon="refresh" ?disabled=${this.reportBusy} @click=${() => this.loadReport(true)}>${this.reportBusy ? 'בודק…' : 'בדוק עכשיו'}</sw-button></div>
        ${r.installation && !r.installation.supported ? html`<div class="hcard error" role="alert" data-health-unsupported=${r.installation.reason ?? ""}><div class="hh"><span>התקנה לא נתמכת</span></div><div class="hd">${r.installation.message} ${r.installation.action}</div></div>` : nothing}
        <div class="hgrid">${r.checks.map((c) => html`<div class="hcard ${c.status}" data-health-card=${c.id}><div class="hh"><span>${c.label}</span><sw-badge kind=${STATUS_KIND[c.status]} label=${STATUS_LABEL[c.status]}></sw-badge></div><div class="hd">${c.detail}</div>${this.renderVideoHints(c)}</div>`)}</div>
        <div class="muted" style="margin-block-start:10px">בדיקות המכשירים (NVR, go2rtc) נשמרות ${r.probe_ttl_s} שניות; "בדוק עכשיו" מריץ אותן מחדש. זרמים זרים ב־go2rtc לעולם אינם נוגעים.</div>
      </sw-card>
      ${r.mode !== 'ha_only' ? html`<recorder-health-panel ?manage=${this.canEdit}></recorder-health-panel>` : nothing}
      ${r.mode !== 'ha_only' && this.canEdit ? html`<camera-image-health-settings></camera-image-health-settings>` : nothing}
    </div>`;
  }

  /** CR-008 D7: under the "וידאו ב־WebRTC" card, the settings hint of each camera whose main stream will not play there. */
  private renderVideoHints(c: HealthReport['checks'][number]) {
    const items = c.id === 'video_webrtc' ? ((c.meta.main_not_webrtc as { camera_id: string; hint: string }[] | undefined) ?? []) : [];
    if (!items.length) return nothing;
    return html`<ul class="hd" data-video-hints style="margin:6px 0 0;padding-inline-start:18px">${items.map((it) => html`<li data-video-hint=${it.camera_id}>${it.hint}</li>`)}</ul>`;
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
    void getMeterBackup().then((m) => (this.meterBackup = m));
    try {
      const r = await listBackups();
      this.backups = r.backups;
      this.backupPolicy = r.policy;
    } catch (err) {
      this.error = describeError(err);
      this.backups = [];
    }
  }

  /** CR-023: "include the meter readings in the backup" (energy.include_history_in_backup) - saved at once, like the other switches. */
  private async toggleMeterBackup(on: boolean) {
    const before = this.meterBackup;
    if (!before || this.meterBackupBusy) return;
    this.meterBackupBusy = true;
    this.meterBackupError = '';
    this.meterBackup = { ...before, on };
    try {
      this.meterBackup = (await setMeterBackup(on)) ?? { ...before, on };
    } catch (err) {
      this.meterBackup = before;
      this.meterBackupError = describeError(err);
    } finally {
      this.meterBackupBusy = false;
    }
  }

  private renderMeterBackup() {
    const m = this.meterBackup;
    if (!m) return nothing;
    const size = m.bytes != null && m.bytes > 0 ? ` (כרגע ${fmtBytes(m.bytes)})` : '';
    return html`<div class="row" data-backup-meters><span class="lbl">נתוני מוני החשמל<span class="muted">${m.on ? `כל הקריאות נכנסות לגיבוי${size}` : 'בלי הקריאות עצמן; מונים, חיובים וסיכומים יומיים נכנסים תמיד'}</span></span>
        <sw-toggle data-backup-meters-toggle ?checked=${m.on} ?disabled=${!m.editable || this.meterBackupBusy} label="לכלול את נתוני המונים בגיבוי" labelHidden
          @change=${(e: CustomEvent<{ checked: boolean }>) => void this.toggleMeterBackup(e.detail.checked)}></sw-toggle></div>
      ${this.meterBackupError ? html`<div class="msg err" role="alert" data-backup-meters-error>${this.meterBackupError}</div>` : nothing}`;
  }

  private async createBackup() {
    this.backupBusy = true;
    this.backupMsg = '';
    try {
      const pw = this.backupPassword;
      const e = await createBackup({ note: this.backupNote.trim(), ...(pw ? { backup_password: pw } : {}) });
      this.backupNote = '';
      this.backupPassword = '';
      const sens = e.sensitive?.state === 'encrypted' ? bpt('createdEncrypted') : (e.sensitive?.counts?.password_hashes ?? 0) > 0 ? bpt('createdOmitted') : '';
      this.backupMsg = `הגיבוי ${e.name} נוצר (${fmtBytes(e.bytes)})${sens ? ` · ${sens}` : ''}`;
      await this.loadBackups();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.backupBusy = false;
    }
  }

  /** BACKUP-HASH-ENC: the minimum length in force (`backup.password_min`, 8-64, default 12). */
  private backupMin(): number {
    const n = Number(this.settings?.['backup.password_min'] ?? 12);
    return Number.isFinite(n) ? Math.max(8, Math.min(64, Math.round(n))) : 12;
  }

  /** Saved at once (like the meter switch); the server refuses a value under 8 or over 64. */
  private async saveBackupMin(input: HTMLInputElement) {
    const n = Number(input.value);
    if (!Number.isInteger(n) || n < 8 || n > 64) {
      this.error = bpt('minRange');
      input.value = String(this.backupMin());
      return;
    }
    this.backupMinBusy = true;
    this.error = '';
    try {
      const r = await patchSettings({ 'backup.password_min': n });
      this.settings = r.settings;
      invalidateSettings();
      this.backupMsg = bpt('minSaved');
    } catch (err) {
      this.error = describeError(err);
      input.value = String(this.backupMin());
    } finally {
      this.backupMinBusy = false;
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

  /** SET-polish: a destructive action asks in the product's own dialog (the native confirm box named no file size and could not be styled). */
  private async removeBackup(b: BackupEntry) {
    this.removeTarget = null;
    this.backupBusy = true;
    try {
      await deleteBackup(b.name);
      this.backupMsg = `הגיבוי ${b.name} נמחק`;
      await this.loadBackups();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.backupBusy = false;
    }
  }

  private renderRemoveDialog(b: BackupEntry) {
    return html`<sw-dialog open heading="למחוק את הגיבוי?" subheading=${b.name} data-backup-remove-dialog @close=${() => (this.removeTarget = null)}>
      <div class="hint" style="font-size:var(--sw-fs-sm)">${this.fmtWhen(b.created_at)} · ${fmtBytes(b.bytes)} · ${KIND_LABEL[b.kind] ?? b.kind}${b.note ? ` · ${b.note}` : ''}. הקובץ נמחק מ־/data/backups ואי אפשר לשחזר ממנו אחר כך; עותק שהורד למחשב אינו מושפע.</div>
      <div slot="footer"><sw-button variant="danger" icon="trash" ?disabled=${this.backupBusy} data-backup-remove-go @click=${() => void this.removeBackup(b)}>${this.backupBusy ? 'מוחק…' : 'מחק'}</sw-button><sw-button variant="ghost" @click=${() => (this.removeTarget = null)}>ביטול</sw-button></div>
    </sw-dialog>`;
  }

  private openRestore(b: BackupEntry) {
    this.restoreTarget = b;
    this.restoreMode = 'replace';
    this.restoreAccess = false;
    this.restoreConfirm = '';
    this.restorePassword = '';
    this.restoreSkip = false;
    this.restoreCanSkip = false;
  }

  private async doRestore() {
    const b = this.restoreTarget;
    if (!b || this.restoreConfirm !== 'RESTORE') return;
    this.backupBusy = true;
    this.error = '';
    try {
      const pw = this.restorePassword;
      const r = await restoreBackup(b.name, { mode: this.restoreMode, scope: this.restoreAccess ? 'project+access' : 'project', confirm: this.restoreConfirm,
        ...(pw ? { backup_password: pw } : {}), ...(this.restoreSkip ? { skip_sensitive: true } : {}) });
      this.restorePassword = '';
      const parts = Object.entries(r.tables).filter(([k]) => TABLE_LABEL[k]).map(([k, n]) => `${n} ${TABLE_LABEL[k]}`);
      const reset = r.passwords?.need_reset_count ? ` · ${bpt('resultNeedReset', { n: r.passwords.need_reset_count })}` : '';
      this.backupMsg = `שוחזר מ־${b.name} (${r.mode === 'replace' ? 'החלפה' : 'מיזוג'}): ${parts.join(', ')} · ${r.files} קבצים${r.files_skipped ? ` · ${r.files_skipped} קבצים לא שוחזרו` : ''}${reset}`;
      this.restoreTarget = null;
      invalidateSettings();
      await this.loadBackups();
    } catch (err) {
      this.error = describeError(err);
      // BACKUP-HASH-ENC: a missing / wrong password (or a damaged encrypted part) offers "restore without the passwords"
      this.restoreCanSkip = err instanceof ApiError && err.body.details?.can_skip === true;
      this.restorePassword = '';
    } finally {
      this.backupBusy = false;
    }
  }

  private fmtWhen(iso: string) {
    return dayTimeText(new Date(iso));
  }

  private renderBackupRow(b: BackupEntry) {
    const counts = ['sites', 'floors', 'plan_versions', 'map_anchors', 'spatial_zones', 'cameras'].filter((k) => b.tables[k] !== undefined).map((k) => `${b.tables[k]} ${TABLE_LABEL[k]}`).join(' · ');
    return html`<div class="brow" data-backup-row>
      <div>
        <div class="name"><span class="ltr">${b.name}</span><sw-badge kind=${b.kind.startsWith('auto') ? 'neutral' : b.kind === 'upload' ? 'stale' : 'live'} label=${KIND_LABEL[b.kind] ?? b.kind}></sw-badge>${this.renderSensitiveBadge(b)}${!b.valid ? html`<sw-badge kind="error" label="קובץ לא תקין"></sw-badge>` : nothing}</div>
        <div class="sub">${this.fmtWhen(b.created_at)} · ${fmtBytes(b.bytes)} · גרסה ${b.app_version ?? '?'}${b.note ? ` · ${b.note}` : ''}</div>
        ${counts ? html`<div class="sub">${counts} · ${b.files} קבצי תוכנית</div>` : nothing}
      </div>
      <div class="acts">
        <a href=${backupDownloadUrl(b.name)} download=${b.name} data-backup-download><sw-button size="sm" icon="download">הורד</sw-button></a>
        <sw-button size="sm" icon="history" ?disabled=${!b.valid || this.backupBusy} data-backup-restore @click=${() => this.openRestore(b)}>שחזר</sw-button>
        <sw-button size="sm" variant="ghost" icon="trash" ?disabled=${this.backupBusy} data-backup-remove @click=${() => (this.removeTarget = b)}>מחק</sw-button>
      </div>
    </div>`;
  }

  private renderSensitiveBadge(b: BackupEntry) {
    const s = b.sensitive;
    if (s?.state === 'encrypted') return html`<sw-badge kind="neutral" data-backup-sensitive="encrypted" label=${bpt('badgeEncrypted')}></sw-badge>`;
    if (s?.state === 'legacy') return html`<sw-badge kind="stale" data-backup-sensitive="legacy" label=${bpt('badgeLegacy')}></sw-badge>`;
    if (s?.state === 'omitted' && (s.counts?.password_hashes ?? 0) > 0) return html`<sw-badge kind="neutral" data-backup-sensitive="omitted" label=${bpt('badgeOmitted')}></sw-badge>`;
    return nothing;
  }

  /** BACKUP-HASH-ENC: the backup password (encrypted archive), the explicit "without the passwords" choice, or a one-line note. */
  private renderRestoreSensitive(b: BackupEntry) {
    const s = b.sensitive;
    if (s?.state === 'encrypted') {
      return html`<div class="row" data-restore-sensitive><span class="lbl">${bpt('restoreLabel')}<span class="muted">${bpt('restoreHint', { n: s.counts?.password_hashes ?? 0 })}</span></span>
          <input class="note-in" type="password" autocomplete="off" data-restore-password ?disabled=${this.restoreSkip} .value=${this.restorePassword} @input=${(e: Event) => (this.restorePassword = (e.target as HTMLInputElement).value)} /></div>
        ${this.restoreCanSkip || this.restoreSkip
          ? html`<div class="row" data-restore-skip-row><span class="lbl">${bpt('restoreSkip')}<span class="muted">${bpt('restoreSkipHint')}</span></span><sw-toggle data-restore-skip ?checked=${this.restoreSkip} label=${bpt('restoreSkip')} labelHidden @change=${(e: CustomEvent<{ checked: boolean }>) => { this.restoreSkip = e.detail.checked; if (this.restoreSkip) this.restorePassword = ''; }}></sw-toggle></div>`
          : nothing}`;
    }
    if (s?.state === 'legacy') return html`<div class="msg err" role="note" data-restore-legacy>${bpt('restoreLegacy')}</div>`;
    if (s?.state === 'omitted' && (s.counts?.password_hashes ?? 0) > 0) return html`<div class="muted" data-restore-omitted>${bpt('restoreOmitted')}</div>`;
    return nothing;
  }

  private renderRestoreDialog(b: BackupEntry) {
    return html`<sw-dialog open heading="שחזור גיבוי" subheading=${b.name} @close=${() => (this.restoreTarget = null)}>
      <div class="row"><span class="lbl">אופן השחזור<span class="muted">${this.restoreMode === 'replace' ? 'הנתונים הנוכחיים של הפרויקט מוחלפים במה שבגיבוי' : 'רק פריטים שחסרים היום מתווספים; הקיימים נשארים'}</span></span>
        <select data-restore-mode @change=${(e: Event) => (this.restoreMode = (e.target as HTMLSelectElement).value as 'replace' | 'merge')}><option value="replace" ?selected=${this.restoreMode === 'replace'}>החלפה</option><option value="merge" ?selected=${this.restoreMode === 'merge'}>מיזוג</option></select></div>
      <div class="row"><span class="lbl">כולל משתמשים והרשאות<span class="muted">ברירת המחדל: רק נתוני הפרויקט. ההרשאות שלך נשמרות בכל מקרה.</span></span><sw-toggle ?checked=${this.restoreAccess} label="כולל הרשאות" labelHidden @change=${(e: CustomEvent<{ checked: boolean }>) => (this.restoreAccess = e.detail.checked)}></sw-toggle></div>
      ${this.renderRestoreSensitive(b)}
      <div class="muted" style="margin-block-start:8px">הגיבוי מגרסה ${b.app_version ?? '?'} מ־${this.fmtWhen(b.created_at)}. השחזור נרשם באודיט. לאישור הקלד <code>RESTORE</code>:</div>
      <input class="confirm-in" data-restore-confirm placeholder="RESTORE" .value=${this.restoreConfirm} @input=${(e: Event) => (this.restoreConfirm = (e.target as HTMLInputElement).value)} />
      <div slot="footer"><sw-button variant="danger" icon="history" ?disabled=${this.restoreConfirm !== 'RESTORE' || this.backupBusy} data-restore-go @click=${() => this.doRestore()}>${this.backupBusy ? 'משחזר…' : 'שחזר עכשיו'}</sw-button><sw-button variant="ghost" @click=${() => (this.restoreTarget = null)}>ביטול</sw-button></div>
    </sw-dialog>`;
  }

  private renderBackup() {
    const list = this.backups ?? [];
    return html`<div class="sections">
      <sw-card heading="גיבויים של הפרויקט" subheading="אתרים, קומות, תוכניות, עוגנים, אזורים, מצלמות והגדרות · בלי סודות גלויים ובלי וידאו">
        <div class="row"><span class="lbl">גיבוי ידני עכשיו<span class="muted">נשמר בתוך התוסף (/data/backups) ואפשר להוריד למחשב</span></span>
          <span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><input class="note-in" placeholder="הערה (אופציונלי)" .value=${this.backupNote} @input=${(e: Event) => (this.backupNote = (e.target as HTMLInputElement).value)} /><sw-button variant="primary" size="sm" icon="download" ?disabled=${this.backupBusy || !isApi()} data-backup-create @click=${() => this.createBackup()}>${this.backupBusy ? 'עובד…' : 'צור גיבוי'}</sw-button></span></div>
        <div class="row" data-backup-password-row><span class="lbl">${bpt('createLabel')}<span class="muted">${bpt('createHint')}</span></span>
          <input class="note-in" type="password" autocomplete="new-password" data-backup-password placeholder=${bpt('createPlaceholder', { n: this.backupMin() })} .value=${this.backupPassword} @input=${(e: Event) => (this.backupPassword = (e.target as HTMLInputElement).value)} /></div>
        <div class="row" data-backup-min-row><span class="lbl">${bpt('minLabel')}<span class="muted">${bpt('minHint')}</span></span>
          <input class="note-in" type="number" min="8" max="64" data-ltr data-backup-min ?disabled=${!isApi() || !this.canEdit || this.backupMinBusy} .value=${String(this.backupMin())} @change=${(e: Event) => void this.saveBackupMin(e.target as HTMLInputElement)} /></div>
        <div class="row"><span class="lbl">העלאת גיבוי<span class="muted">קובץ zip שהורד מכאן (גם מהתקנה קודמת); אחרי ההעלאה לוחצים "שחזר"</span></span>
          <span><input type="file" accept=".zip,application/zip" hidden @change=${(e: Event) => { const inp = e.target as HTMLInputElement; void this.onBackupFile(inp.files?.[0]); inp.value = ''; }} /><sw-button size="sm" icon="upload" ?disabled=${this.backupBusy || !isApi()} @click=${() => (this.renderRoot.querySelector('input[type=file]') as HTMLInputElement | null)?.click()}>בחר קובץ…</sw-button></span></div>
        ${this.renderMeterBackup()}
        ${this.backupMsg ? html`<div class="msg ok" role="status" data-backup-msg><sw-icon name="check" size=${13}></sw-icon>${this.backupMsg}</div>` : nothing}
        ${!isApi()
          ? html`<div class="muted">נתוני הדגמה: הגיבויים עובדים מול השרת.</div>`
          : this.backups === null
            ? html`<div class="muted">טוען…</div>`
            : list.length
              ? html`<div class="blist" data-backups>${list.map((b) => this.renderBackupRow(b))}</div>`
              : html`<div class="muted" style="padding-block:6px">עדיין אין גיבויים. הראשון ייווצר אוטומטית לפני העדכון הבא, או עכשיו בלחיצה.</div>`}
      </sw-card>
      ${isApi() && can('backup.manage') ? html`<sw-offbox-backup data-offbox-section></sw-offbox-backup>` : nothing}
      <sw-card heading="אוטומטי ו־Rollback">
        <div class="row"><span class="lbl">לפני כל עדכון גרסה<span class="muted">עותק של הנתונים נכתב לפני שהגרסה החדשה נוגעת במסד; נשמרים ${this.backupPolicy['auto-pre-upgrade'] ?? 5} האחרונים</span></span><sw-badge kind="live" label="פעיל"></sw-badge></div>
        <div class="row"><span class="lbl">יומי<span class="muted">עותק אחד ביום, נשמרים ${this.backupPolicy['auto-daily'] ?? 7} האחרונים</span></span><sw-badge kind="live" label="פעיל"></sw-badge></div>
        <div class="row"><span class="lbl">Rollback<span class="muted">חוזרים לגרסה קודמת דרך Home Assistant ואז משחזרים את הגיבוי "לפני עדכון" (החלפה)</span></span><span class="ltr">${this.version || '…'}</span></div>
        <div class="row"><span class="lbl">גיבוי Home Assistant<span class="muted">ה־Add-on מוגדר backup: hot, ולכן /data (כולל הגיבויים האלה) נכלל גם בגיבוי המלא של HA</span></span></div>
      </sw-card>
    </div>
    ${this.restoreTarget ? this.renderRestoreDialog(this.restoreTarget) : nothing}
    ${this.removeTarget ? this.renderRemoveDialog(this.removeTarget) : nothing}`;
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
    const cur = TABS.find((t) => t.id === this.tab) ?? TABS[0];
    return html`
      <sw-page crumbs=${cur.id === 'general' ? 'הגדרות' : 'הגדרות | כללי'} heading=${cur.label} subheading=${`${TAB_SUB[cur.id] ?? ''}${isApi() ? '' : ' · נתוני הדגמה'}`}>
        <sw-tabs underline data-settings-tabs .variant=${this.phoneSelect ? 'dropdown' : this.tabsMode.props('').variant} ?adaptive=${this.phoneSelect ? false : this.tabsMode.props('').adaptive} ?tall=${this.phoneSelect} ?block=${this.phoneSelect} dd-style=${this.tabsMode.ddStyle} dd-size=${this.tabsMode.ddSize} dd-ring=${this.tabsMode.ddRing} dd-panel=${this.tabsMode.ddPanel} group-label="קטגוריה" .items=${TABS} .active=${this.tab} @change=${(e: CustomEvent<{ id: string }>) => this.openTab(e.detail.id)}></sw-tabs>
        ${this.message && this.tab === 'ha' ? html`<div class="msg ok" role="status"><sw-icon name="check" size=${13}></sw-icon>${this.message}</div>` : nothing}
        ${this.error && this.tab === 'ha' ? html`<div class="msg err" role="alert"><sw-icon name="warning" size=${13}></sw-icon>${this.error}</div>` : nothing}
        ${this.tab === 'general' ? this.renderGeneral() : this.tab === 'tabs' ? html`<system-tabs-config></system-tabs-config>` : this.tab === 'media' ? this.renderMedia() : this.tab === 'map' ? this.renderMap() : this.tab === 'ha' ? this.renderHa() : this.tab === 'access-control' ? this.renderAccessControl() : this.tab === 'devices' ? this.renderDevices() : this.tab === 'remote' ? this.renderRemote() : this.tab === 'mobile' ? html`<system-presence></system-presence>` : this.tab === 'health' ? this.renderHealth() : this.tab === 'backup' ? this.renderBackup() : this.renderSupport()}
      </sw-page>
    `;
  }
}
