// HOME-SIMPLE-2420: the home interface ("ממשק ביתי") - a second, simpler, room-centred interface next to the full one (owner request
// 2026-11-10; the approved round-25 mockup "home-simple-v2" is the spec: always inside a room, the room name is the room picker, a row of
// category icons, the person's favourites as widgets, and a fixed "now" bar with what is on and one tap to turn the room off).
// Real data only (home-api.ts), existing control paths only (home-actions.ts). Hebrew, RTL, no platform names or internal terms.
// No control screen scrolls: every list pages (home-logic.ts paged / packPages). Themes: data-hs-theme + data-hs-scheme on the host.
import { uiLocale } from '../i18n/locale';
import { LitElement, html, nothing, svg, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { homeMockupStyles } from './home-styles';
import { homeExtraStyles } from './home-styles-extra';
import { hi } from './home-icons';
import {
  adaptOverview, getHomePrefs, getOverview, loadAlerts, loadCameras, loadEnergy, loadScenes, putHomePrefs, switchInterface,
  type Fav, type HAlert, type HCamera, type HDoor, type HLight, type HLoad, type HomeData, type HomeLayout, type HomePrefs, type HRoom,
  type HScene, type HShade, type HZone, type InterfacePolicy,
} from './home-api';
import {
  MODES, PRESETS, activeRooms, activeText, defaultFavs, doorNotLocked, doorOpen, doorState, doorTone, doorsText, doorsTone, favHeight, favOk, favWidth, floorName, greeting, homeBarText,
  doorNoOpenText, homeScenes, keepHiddenFavs, keptNote, lightsText, loadsOn, masterLevel, onCount, onWord, paged, roomLights, sameFav, shadeText, zoneOn,
  type FavWorld,
} from './home-logic';
import * as act from './home-actions';
import { PushRefresh, PUSH_QUIET_MS, homeDraws, keepLocal } from './home-refresh';
import { api, apiUrl, post, describeError } from '../api/client';
import type * as HiWire from '../api/generated/wire-home-interface';
import { GALLERY, galleryCss, switchUserMode } from './home-wall';
import { notify } from '../api/notifications';
import { snapshotUrl } from '../api/media';
import { stillIntervalMs } from '../api/frigate';
import { callResult, securityChip } from './home-v3-words';
import { followAlarmAction } from './home-alarm-follow';
import { diffWords, fixedTariffPrice, num1 } from './home-p3-logic';
import type { EnergyTariffList } from '../api/generated/wire-consumption';
import { getCallLog, type CallLogRow } from '../api/intercom-calls';
import { subscribeHa } from '../api/ha';
import { relTime } from './home-api';
import { alarmPanels, panelAction, type AlarmAction, type AlarmPanel } from '../api/alarm';
import { canAnywhere } from '../api/session';
import { getIntercomOverview } from '../api/intercom';
import { keyedDebounce } from './keyed-debounce';
// HOME-FAVORITES-2500: the favourites grid in the person's order with "+ הוסף" holes, the long-press drag, the scene sheet and suggestion
import { cellArea, layoutFavPages, type FavCell } from './home-favgrid';
import { FavDrag, favHole } from './home-fav-ui';
import { afterScene, sceneEditBtn, sceneSuggestRow } from './home-scene-2500';
import { getStationMedia, type StationMediaTalk } from '../api/station-media';
import { get } from '../api/client';
import { logout as arxLogout } from '../arx/auth';
import './sw-home-call';
import type { HomeCallsState, SwHomeCall } from './sw-home-call';
import '../components/wk-talk-button';
import '../components/sw-camera-tile';
import '../components/sw-segmented'; // CR-HOME-V3-SEGMENTS-2470: seg() below (and home-p3's)
import type { SegmentOption } from '../components/sw-segmented';
import { STILL_REFRESH_MS } from '../components/sw-live-player';
// HOME-V3-P1-2430: the v3 screens register themselves (home-ext.ts); sw-home only wires the registry in
import { homeV3Styles } from './home-styles-v3';
import { buildScreens, type ExtOvl, type HomeScreen } from './home-ext';
import { gapAlertActs, gapMenuRow } from './home-gaps'; // HOME-V3-GAPS-2436
import { accountMenuRow } from './home-account'; // HOME-T120-REST-2530: "החשבון שלי" (security, my sign-ins, language)
import { moreChild, moreTiles } from './more-registry';
import './home-v3-p1';
import './home-p3-ext'; // RELEASE-2430-TRAIN: phase 3's screens and hub tiles join the registry
// HOME-V3-P3-2432: phase 3 (media + systems) lives in its own files; these few hooks are the only edits here
import { P3, type P3Host, type P3Ovl } from './home-p3';
// MULTI-BUILDING-HOME-2500 (owner Q64-Q67): the building level (display only; the server cuts "כבה הכל" of one building)
import { ALL, alsoNote, byBuilding, floorBuilding, keepBuilding, nameOf, offLabel, offRooms, pickBuilding, readLast, roomsIn, saveLast, servedBy, shows } from './home-buildings';
import { homeP3Styles } from './home-p3-styles';
import { HandModal } from '../components/hand-modal';
// HOME-V3-P2-2431: the family and building screens (home-v3-p2.ts); two hooks below: the scenes screen's buttons, the wall panel's chips
import { sceneScreenActs, wallChips } from './home-v3-p2';
import { tr } from '../i18n/msg/home';
import { ToastController } from '../components/toast-controller';
// HOME-WALL-NIGHT-2500: the wall panel's rest screen, night dimming and screen takeover (home-wall-rest.ts); five hooks below
import { WallPanel } from './home-wall-rest';
import { homeWallRestStyles } from './home-wall-rest-styles';

export const THEMES: [string, string, string, 1 | 2][] = [
  ['classic', tr('קלאסי'), tr('פחם חם וכחול. המראה שאושר.'), 2], ['ocean', tr('אוקיינוס'), tr('כחול ים עמוק ותכלת צלול.'), 2], ['sand', tr('חול'), tr('אבן חמה וחימר.'), 2],
  ['plum', tr('שזיף'), tr('חציל כהה ולילך רך.'), 2], ['midnight', tr('חצות'), tr('כחול כמעט שחור עם פליז. כהה בלבד.'), 1], ['nordic', tr('נורדי'), tr('אבן בהירה וכחול צפחה.'), 2],
  ['pastel', tr('פסטל'), tr('לבנדר רך ופטל, לטאבלט של הילדים.'), 2],
];

type Ovl =
  | { type: 'cam'; id: string }
  | { type: 'confirm'; door: string }
  | { type: 'menu' }
  | { type: 'zones' }
  | { type: 'hold'; f: Fav; label: string }
  | { type: 'guard'; id: string }
  | { type: 'ask'; title: string; text: string; yes: string; run: () => void }
  | { type: 'kiosk'; code: string; error: string }
  | { type: 'code'; title: string; code: string; error: string; run: (code: string) => void }
  | { type: 'talk' }
  | { type: 'switchHost' }
  | { type: 'bld' } // MULTI-BUILDING-HOME-2500: the building sheet
  | ExtOvl
  | P3Ovl
  | null;

const NAV: [string, string, string, string][] = [['r/home', tr('הבית שלי'), 'home', 'home'], ['scenes', tr('סצנות'), 'scenes', 'scenes'], ['active', tr('פעיל עכשיו'), 'pulse', 'active'], ['more', tr('עוד'), 'grid', 'more'], ['alerts', tr('התראות'), 'bell', 'alerts'], ['settings/favs', tr('הגדרות'), 'sliders', 'settings']];
const SCREENS = ['r', 'rooms', 'lights', 'climate', 'shades', 'doors', 'cameras', 'energy', 'alerts', 'scenes', 'active', 'settings', 'welcome', 'security'];
const ARM_LABEL: Record<string, string> = { arm_home: tr('דריכה בבית'), arm_away: tr('דריכה ביציאה'), arm_night: tr('דריכת לילה'), arm_vacation: tr('דריכה לחופשה'), arm_custom_bypass: tr('דריכה חלקית'), disarm: tr('ניטרול') };
const KIOSK_UNLOCK_MS = 5 * 60_000;
/** The cameras screen's still refresh, in seconds (sw-camera-tile stillRefresh; the tile's word says the same number). */
const HOME_STILL_SECS = 30;
const KIOSK_ROUTES = ['r', 'lights', 'climate', 'shades', 'doors', 'scenes', 'active', 'alerts', 'media', 'notices', 'calendar'];
/** HOME-V3-AUDITFIX-2437 (audit item 2): the phone / wide boundary of the home interface - the same query as every phone block of the
 *  home style sheets (`(max-width: 700px), (max-width: 899px) and (orientation: portrait)`; the wide blocks are its complement). A portrait
 *  tablet 701-899 px wide takes the phone layout with the bottom bar; a landscape phone of that width keeps the wide one, as before. */
export const HOME_PHONE_MQ = '(max-width: 700px), (max-width: 899px) and (orientation: portrait)';
const isPhone = () => window.matchMedia(HOME_PHONE_MQ).matches;
/** HOME-R32-ANSWERS-2438 (owner round 32 Q-HOME-1 a): the portrait tablet band of the phone layout - four tiles per row (home-styles-extra.ts
 *  uses the same query). */
const HOME_TABLET_PORTRAIT_MQ = '(min-width: 701px) and (max-width: 899px) and (orientation: portrait)';
const isTabletPortrait = () => window.matchMedia(HOME_TABLET_PORTRAIT_MQ).matches;
/** HOME-V3-AUDITFIX-2437 (audit item 7): the theme, scheme and background this device last drew the home in (read by public/home-paint.js). */
const PAINT_KEY = 'arx-home-paint';
function readPaintHint(): { theme: string; scheme: 'light' | 'dark' } | null {
  try {
    const p = JSON.parse(localStorage.getItem(PAINT_KEY) || 'null') as { theme?: unknown; scheme?: unknown } | null;
    return p && typeof p.theme === 'string' ? { theme: p.theme, scheme: p.scheme === 'light' ? 'light' : 'dark' } : null;
  } catch { return null; }
}
function writePaintHint(theme: string, scheme: string, bg: string) {
  try { if (bg) localStorage.setItem(PAINT_KEY, JSON.stringify({ theme, scheme, bg })); } catch { /* storage off: the usual first frame */ }
}
const HE_WEEKDAY = new Intl.DateTimeFormat(uiLocale(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jerusalem' });
const HE_TIME = new Intl.DateTimeFormat(uiLocale(), { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });

type ActFn = (el: HTMLElement) => boolean | void;
/** The names after `a_` of the element's own action handlers. */
type OwnAct = { [K in keyof SwHome]-?: K extends `a_${infer N}` ? N : never }[keyof SwHome];

@customElement('sw-home')
export class SwHome extends LitElement implements P3Host {
  static styles = [homeMockupStyles, homeV3Styles, homeExtraStyles, homeP3Styles, homeWallRestStyles]; // HOME-V3-P3-2432: its rules refine the shared v3 ones

  /** The route below #/home (e.g. "r/living", "lights", "settings/themes"). */
  @property() path = '';
  @property() userName = '';
  @property() userFull = '';
  @property() role = '';
  @property({ attribute: false }) policy: InterfacePolicy | null = null;

  @state() data: HomeData | null = null;
  @state() private error = '';
  @state() private prefs: HomePrefs = { favourites: {}, layout: {}, seed: {} };
  @state() private room = 'home';
  @state() scope: 'room' | 'floor' | 'house' = 'room';
  @state() private only = false;
  @state() private lightsTab: 'lights' | 'loads' | 'scenes' = 'lights';
  @state() private zone: string | null = null;
  @state() private period: 'day' | 'week' = 'day';
  @state() private alertTab: 'open' | 'all' = 'open';
  @state() private edit = false;
  @state() private roomsEdit = false;
  @state() private doorsOnly = false;
  @state() private shadesOnly = false;
  @state() private floor = '';
  /** MULTI-BUILDING-HOME-2500: the chosen building ('' = no building level, ALL = "כל הבניינים" where the installation offers it) */
  @state() bld = '';
  @state() page: Record<string, number> = {};
  @state() ovl: Ovl = null;
  @state() private wallStamp = 0;
  /** CR-CMP2-TOAST-2440 (07:F12): the message and its one timer (stopped when the home leaves the page); the undo rides beside it. */
  private readonly toaster = new ToastController(this, { ms: 5200 });
  private toastUndo: (() => void) | null = null;
  private get toastMsg(): { text: string; undo: (() => void) | null } | null {
    return this.toaster.visible ? { text: this.toaster.text, undo: this.toastUndo } : null;
  }
  @state() private armed: string | null = null;
  @state() private sceneRun: string | null = null;
  @state() phone = isPhone();
  /** HOME-R32-ANSWERS-2438: a portrait tablet (phone layout, four tiles per row) */
  @state() tab4 = isTabletPortrait();
  @state() now = new Date();
  @state() visitors: CallLogRow[] = [];
  @state() private kioskUntil = 0;
  @state() private welcomePick: 'home' | 'full' = 'home';
  @state() panels: AlarmPanel[] = [];
  /** SCREENS-FIX-A-2520 (SCR-06): whether the panels were read - 'none' (not yet), 'ok', 'error' (the last read failed; `panels` keeps
   * the last list that was read, the alarm screen says "unavailable" - never "no alarm system"). */
  @state() panelsRead: 'none' | 'ok' | 'error' = 'none';
  /** SCR-06: the newest panels read only (a push, the alarm screen's beat and a command's follow-up overlap) */
  private panelsSeq = 0;
  /** SCR-06: a pushed alarm-panel change re-reads the panels (debounced), on every home device - phone, tablet and wall panel */
  private alarmPushT = 0;
  @state() private calls: HomeCallsState = { ringing: 0, waiting: 0 };
  /** The entrance this person may talk to without a call (the station drawer's "dial", the same talk session) - null = not offered. */
  @state() talkTo: { id: string; name: string; talk: StationMediaTalk; video: string } | null = null;
  /** The last scene this person ran in this session (else the scene the platform ran last, from its own run record). */
  @state() private lastScene: string | null = (() => { try { return sessionStorage.getItem('home.lastScene'); } catch { return null; } })();
  /** The price per kWh of the installation's fixed tariff - only for a person who may already read the tariffs (no new permission). */
  @state() private price: number | null = null;

  private stopHa: (() => void) | null = null;
  /** MEDIUM-REST-2540 (SCR-30): the overview refresh after a push or a command - a quiet period with a maximum wait (home-refresh.ts) */
  private refresher = new PushRefresh(() => this.loadOverview());
  /** SCR-30: the newest overview read only (a push, a command's follow-up and the first load overlap) */
  private ovSeq = 0;
  private armT = 0;
  private clockT = 0;
  private holdT = 0;
  private held = false;
  private swipe: { x: number; y: number } | null = null;
  private down = { x: 0, y: 0 };
  /** Review 08:F21: the favourites saves, debounced per list - two lists changed within the delay are both sent. */
  private favSaves = keyedDebounce<Fav[]>(
    (key, list) => void putHomePrefs({ favourites: { [key]: list } }).catch((err) => { if (this.isConnected) this.toast(describeError(err)); }),
    400,
    { set: (fn, ms) => window.setTimeout(fn, ms), clear: (id) => window.clearTimeout(id) },
  );
  /** HOME-FAVORITES-2500: the favourites as home-fav-ui.ts and home-scene-2500.ts use them; `list` is what the grid shows, in order */
  readonly favApi = {
    key: (): string => this.room,
    editing: (): boolean => this.edit,
    list: (key: string): Fav[] => this.favs(key).filter((f) => favOk(f, this.world())),
    save: (key: string, list: Fav[]) => this.saveFavs(key, list),
    label: (f: Fav): string => this.favLabel(f),
    world: (): FavWorld => this.world(),
    layout: (): HomeLayout => this.prefs.layout,
    /** a drag took the press: no room swipe, no click at the release */
    claim: () => { this.held = true; this.swipe = null; window.clearTimeout(this.holdT); },
  };
  private favDrag = new FavDrag(this);
  private lastRoute = '';
  private lastName = ''; // HOME-R32-ANSWERS-2438: the screen shown before, for the entry motion
  /** HOME-R32-ANSWERS-2438: the entry class of the current screen, kept until the next one (a data reload mid-entry no longer cuts it);
   *  the screen is keyed by its address, so every screen change - another room, another tab - draws fresh and plays it once */
  private enterCls = '';
  /** HOME-V3-P1-2430: the registered v3 screens (home-ext.ts) */
  readonly ext: HomeScreen[] = buildScreens(this);
  /** shared scratch state of the v3 modules (each keeps its own key) */
  readonly extState: Record<string, unknown> = {};
  /** HOME-V3-P3-2432: media, announcements, bill, water, house systems, map (home-p3.ts). */
  readonly p3 = new P3(this);
  /** HOME-WALL-NIGHT-2500: rest screen, night dimming, takeover - only on a wall panel. */
  readonly wall = new WallPanel(this);

  // ---------------------------------------------------------------- lifecycle and data

  connectedCallback(): void {
    super.connectedCallback();
    // HOME-V3-AUDITFIX-2437 (audit item 7): until the person's layout arrives, draw in the theme / scheme this device last showed
    // (public/home-paint.js painted the page behind it the same way); the page's own background is handed back to the shell's skin
    const hint = readPaintHint();
    if (hint && !this.hasAttribute('data-hs-scheme')) { this.setAttribute('data-hs-theme', hint.theme); this.setAttribute('data-hs-scheme', hint.scheme); }
    const root = document.documentElement;
    if (root.hasAttribute('data-home-paint')) { root.style.removeProperty('--sw-bg'); root.style.removeProperty('background'); root.removeAttribute('data-home-paint'); }
    window.addEventListener('resize', this.onResize);
    this.clockT = window.setInterval(() => { this.now = new Date(); }, 20_000);
    void this.load();
    this.wall.connect();
    this.stopHa = subscribeHa((m) => {
      // SCR-30: only a change of something the home draws asks for a refresh (a power meter's every second no longer holds it back)
      if (m.type === 'structure_changed' || (m.type === 'entity_state_changed' && homeDraws(m.entity))) this.scheduleRefresh();
      if (m.type === 'entity_state_changed') this.alarmPushed(m.entity.entity_id);
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('resize', this.onResize);
    window.clearInterval(this.clockT);
    window.clearTimeout(this.alarmPushT);
    this.stopHa?.();
    this.stopHa = null;
    // FE-LEAK-TEXTKEY-2435: the active v3 screen gives back what it holds (a playing recording closes its server playback session
    // and stops its 1 s clock), and no timer of this element fires on a detached host. A pending favourites save is sent now
    // instead of being dropped.
    this.extFor(this.extRoute)?.leave?.();
    this.p3.dispose();
    this.wall.disconnect();
    this.modal.release();
    for (const t of [this.armT, this.holdT]) window.clearTimeout(t);
    this.refresher.cancel();
    this.armT = this.holdT = this.clockT = 0;
    this.flushFavs();
  }

  private onResize = () => {
    const p = isPhone();
    if (p !== this.phone) this.phone = p;
    const t = isTabletPortrait();
    if (t !== this.tab4) this.tab4 = t;
  };

  private scheduleRefresh(ms = PUSH_QUIET_MS) {
    this.refresher.poke(ms);
  }

  private async load() {
    try {
      const [prefs] = await Promise.all([getHomePrefs().catch(() => this.prefs), this.loadOverview()]);
      this.prefs = prefs;
      this.applyLayout();
      if (this.data) {
        const mods = this.data.modules;
        const [scenes, alerts, energy] = await Promise.all([
          mods.has('scenes') || mods.has('lights') ? loadScenes() : Promise.resolve([] as HScene[]),
          mods.has('alerts') ? loadAlerts() : Promise.resolve([] as HAlert[]),
          mods.has('energy') ? loadEnergy(this.meterKeep()) : Promise.resolve(null),
        ]);
        this.data = { ...this.data, scenes, alerts, energy };
        if (!this.isConnected) return; // FE-LEAK-TEXTKEY-2435: left the page while loading - start nothing (a reconnect loads again)
        const rt = this.route();
        this.extFor(rt.name)?.enter?.(rt.name, rt.arg); // HOME-V3-P1-2430: a deep link into a v3 screen loads its data once the home is known
        if (mods.has('security') && canAnywhere('alarm.view')) void this.loadPanels();
        if (mods.has('doors') && canAnywhere('access.call')) void this.loadTalk();
        if (mods.has('energy') && (canAnywhere('energy.bills') || canAnywhere('energy.manage'))) void this.loadPrice();
        if (mods.has('doors') || mods.has('intercom')) void getCallLog(null, 8).then((p) => { this.visitors = p.calls; }).catch(() => undefined);
        void this.p3.load();
      }
    } catch (err) {
      this.error = describeError(err);
    }
  }

  /** MULTI-BUILDING-HOME-2500 (Q67): the meters of the chosen building (a meter serving two buildings counts in each, with its note). */
  private meterKeep(): ((area: string | null) => string | null) | undefined {
    if (!this.data?.buildings?.length) return undefined;
    return (area) => { const b = this.bldOf([area]); return b.show ? b.note : null; };
  }

  private async reloadEnergy() {
    const energy = await loadEnergy(this.meterKeep());
    if (this.data) this.data = { ...this.data, energy };
  }

  private async loadTalk() {
    try {
      const feed = await getIntercomOverview();
      // TALK-OVERVIEW-FIX: the reply carries the stations under `overview.stations` (routers/access_control.py); the old
      // top-level read matched only the home test mocks, so the button never showed in a real install.
      for (const s of feed.overview?.stations ?? []) {
        if (!s.online) continue;
        const m = await getStationMedia(s.id).catch(() => null);
        if (m?.talk?.available) {
          const video = m.video?.allowed ? m.video.paths.sub ?? m.video.paths.main ?? '' : '';
          this.talkTo = { id: s.id, name: s.name, talk: m.talk, video };
          return;
        }
      }
    } catch {
      this.talkTo = null;
    }
  }

  private async loadPrice() {
    try {
      this.price = fixedTariffPrice(await get<EnergyTariffList>('energy/tariffs'));
    } catch {
      this.price = null;
    }
  }

  async loadPanels() {
    const seq = ++this.panelsSeq;
    try {
      const panels = (await alarmPanels()).panels;
      if (seq !== this.panelsSeq) return;
      this.panels = panels;
      this.panelsRead = 'ok';
    } catch {
      // SCR-06: a failed read keeps the last panels and says so - it is not "no alarm system"
      if (seq === this.panelsSeq) this.panelsRead = 'error';
    }
  }

  /** SCR-06: an alarm panel's pushed change re-reads the panels on every home device (before: only a wall panel did, so a phone on the
   * alarm screen stayed on "arming" and the home chip kept the state from page load). */
  private alarmPushed(entityId: string | undefined) {
    if (!entityId?.startsWith('alarm_control_panel.') || !this.data || !this.d.modules.has('security') || !canAnywhere('alarm.view')) return;
    window.clearTimeout(this.alarmPushT);
    this.alarmPushT = window.setTimeout(() => void this.loadPanels(), 400);
  }

  private async loadOverview() {
    const seq = ++this.ovSeq;
    const since = Date.now();
    try {
      const [ov, cameras] = await Promise.all([getOverview(), this.data ? Promise.resolve(this.data.cameras) : loadCameras()]);
      if (seq !== this.ovSeq) return; // SCR-30: a newer read is on its way
      const base = adaptOverview(ov, ov.modules.includes('cameras') ? cameras : []);
      // SCR-30: a device with this person's command in flight (or sent after this read started) keeps what the screen shows
      base.rooms = keepLocal(this.data?.rooms, base.rooms, act.localIds(since));
      this.data = { scenes: [], alerts: [], energy: null, ...(this.data ?? {}), ...base, cameras: ov.modules.includes('cameras') ? cameras : [] };
      // MULTI-BUILDING-HOME-2500 (Q65): open on the wall panel's / the person's building, else the device's last choice, else the first
      const bs = base.buildings ?? [];
      this.bld = this.bld ? keepBuilding(this.bld, bs, !!base.bAll, base.bEntry ?? null) : pickBuilding(bs, base.bEntry ?? null, readLast(), !!base.bAll);
      if (!this.floor && base.floors[0]) this.floor = base.floors[0].id;
      this.error = '';
    } catch (err) {
      if (seq === this.ovSeq && !this.data) this.error = describeError(err);
    }
  }

  private applyLayout() {
    const l = this.prefs.layout;
    const pol = this.pol();
    const t = THEMES.find((x) => x[0] === (l.theme ?? 'classic')) ?? THEMES[0];
    let scheme = l.scheme === 'light' ? 'light' : l.scheme === 'auto' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : 'dark';
    if (t[3] === 1) scheme = 'dark';
    this.setAttribute('data-hs-theme', t[0]);
    this.setAttribute('data-hs-scheme', scheme);
    this.toggleAttribute('data-hs-big', !!l.big_text);
    void this.updateComplete.then(() => writePaintHint(t[0], scheme, getComputedStyle(this).getPropertyValue('--hs-bg').trim()));
    if (pol?.kiosk && pol.kiosk_area_id && !this.path) this.room = pol.kiosk_area_id;
  }

  pol(): InterfacePolicy | null {
    return this.policy ?? this.data?.policy ?? null;
  }

  /** HOME-R32-ANSWERS-2438: the person's own layout keys, for the screen modules (the calendar week strip). */
  myLayout(): HomeLayout { return this.prefs.layout; }
  saveMyLayout(patch: HomeLayout) { this.saveLayout(patch); }

  private saveLayout(patch: HomeLayout) {
    this.prefs = { ...this.prefs, layout: { ...this.prefs.layout, ...patch } };
    this.applyLayout();
    void putHomePrefs({ layout: patch }).catch((err) => this.toast(describeError(err)));
  }

  private saveFavs(key: string, visible: Fav[]) {
    const list = keepHiddenFavs(this.favs(key), visible, this.world()); // SCR-08: hidden favourites are kept
    this.prefs = { ...this.prefs, favourites: { ...this.prefs.favourites, [key]: list } };
    this.favSaves.push(key, list);
  }

  /** Sends the debounced favourites saves at once (the element is leaving the page). */
  private flushFavs() {
    this.favSaves.flush();
  }

  // ---------------------------------------------------------------- routing

  /** HOME-V3-AUDITFIX-2437 (audit, motion): a closing sheet leaves with a short exit (160 ms, faster than its entry) instead of vanishing.
   * The last frame of the overlay is copied into an inert, hidden-from-readers layer that fades out and removes itself. A sheet that holds a
   * live element (a player, a camera) is not copied - a copy would start its own stream - and simply closes as before. The copy lives in
   * its own closed shadow root with the same style sheets, so nothing (a query, an assistive tool, a test) ever finds two sheets. */
  private ghostOverlay() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const root = this.renderRoot as ShadowRoot;
    const live = root.querySelector('.app-root > .ovl');
    if (!live || !live.querySelector('.sheet') || Array.from(live.querySelectorAll('*')).some((n) => n.localName.includes('-'))) return;
    const host = document.createElement('div');
    for (const a of ['data-hs-theme', 'data-hs-scheme', 'data-hs-big']) { const v = this.getAttribute(a); if (v != null) host.setAttribute(a, v); }
    host.setAttribute('aria-hidden', 'true');
    host.inert = true;
    const sr = host.attachShadow({ mode: 'closed' });
    if (root.adoptedStyleSheets?.length) sr.adoptedStyleSheets = root.adoptedStyleSheets;
    else root.querySelectorAll('style').forEach((s) => sr.appendChild(s.cloneNode(true)));
    const g = live.cloneNode(true) as HTMLElement;
    g.classList.add('ghost');
    // the copy starts where the sheet was (no @starting-style entry), then takes the mockup's own exit classes (`.out`, home-styles.ts)
    const parts = Array.from(g.querySelectorAll<HTMLElement>('.hscrim, .sheet'));
    for (const el of parts) el.style.transition = 'none';
    sr.appendChild(g);
    root.appendChild(host);
    g.getBoundingClientRect();
    requestAnimationFrame(() => { for (const el of parts) { el.style.transition = ''; el.classList.add('out'); } });
    window.setTimeout(() => host.remove(), 260);
  }

  /** CR-MODAL-STACK-B-2442: every overlay of the home interface (`ovl`: the sheets, the confirmations, the full-screen camera, the code
   * pads, the v3 / phase-3 module sheets) is ONE layer of the shared modal stack: Escape closes it only while it is the top layer, Tab
   * stays inside it, the screen behind it is inert, and focus returns to the control that opened it. */
  private ovlBox = () => this.renderRoot.querySelector('.app-root > .ovl');
  private modal = new HandModal({
    box: this.ovlBox,
    close: () => { this.ovl = null; },
    inert: () => [this.renderRoot.querySelector('.app-root > .hs')],
  });

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    this.modal.sync(!!this.ovl && !!this.ovlBox()?.firstElementChild);
  }

  protected willUpdate(changed: PropertyValues): void {
    this.wall.sync();
    if (changed.has('ovl') && changed.get('ovl') && !this.ovl) this.ghostOverlay();
    if (changed.has('path')) {
      const { name, arg } = this.route();
      const pol = this.pol();
      if (name === 'r') {
        let id = arg && this.data?.rooms.some((r) => r.id === arg) ? arg : arg === 'home' || !arg ? 'home' : this.data ? 'home' : arg;
        if (this.kioskLocked() && pol?.kiosk_area_id) id = pol.kiosk_area_id;
        if (id !== this.room) {
          this.room = id;
          this.scope = 'room';
          this.edit = false;
          if (id !== 'home' && this.prefs.layout.start === 'last') this.saveLayout({ start_room: id });
        }
      }
      if (this.kioskLocked() && pol?.kiosk_area_id && this.room !== pol.kiosk_area_id) this.room = pol.kiosk_area_id;
      if (this.ovl) this.ovl = null;
      const prev = this.extFor(this.extRoute);
      if (prev && prev !== this.extFor(name)) prev.leave?.();
      this.extRoute = name;
      if (this.data) this.extFor(name)?.enter?.(name, arg);
    }
  }

  private extRoute = '';

  /** HOME-V3-P1-2430: the registered screen that renders this route name, if any. */
  extFor(name: string): HomeScreen | undefined {
    return this.ext.find((m) => m.names.includes(name));
  }

  route(): { name: string; arg: string } {
    const raw = (this.path || '').replace(/^\/+/, '');
    if (!raw) {
      const l = this.prefs.layout;
      const pol = this.pol();
      if (pol?.kiosk && pol.kiosk_area_id) return { name: 'r', arg: pol.kiosk_area_id };
      if (pol?.choose || (pol?.may_switch && !l.welcomed)) return { name: 'welcome', arg: '' };
      if ((l.start === 'last' || l.start === 'fixed') && l.start_room) return { name: 'r', arg: l.start_room };
      // owner decision: a wall panel opens its own room, a phone opens "הבית שלי"
      return { name: 'r', arg: 'home' };
    }
    const [name, arg = ''] = raw.split('/');
    const known = SCREENS.includes(name) || this.extFor(name) != null;
    // HOME-V3-AUDITFIX-2437 (audit item 13): a wall panel locked to its room draws only what its own screen links to; any other address
    // (typed or kept from before the lock) opens the room instead
    if (known && this.kioskLocked() && !this.kioskAllows(name)) return { name: 'r', arg: this.pol()?.kiosk_area_id ?? '' };
    return { name: known ? name : 'r', arg: known ? arg : '' };
  }

  /** The routes a locked wall panel reaches by touch: its room, the room's categories, the bottom bar's items, and (owner answer round 27
   * #14) the room's media, the notice board and the calendar. The cameras screen only when the room has a camera (its chip leads there). */
  private kioskAllows(name: string): boolean {
    if (KIOSK_ROUTES.includes(name)) return true;
    if (name !== 'cameras') return false;
    const id = this.pol()?.kiosk_area_id;
    return !!this.data?.rooms.find((x) => x.id === id)?.cams.length;
  }

  kioskLocked(): boolean {
    return !!this.pol()?.kiosk && Date.now() > this.kioskUntil;
  }

  href(p: string): string {
    return `#/home/${p}`;
  }

  go(p: string) {
    const h = this.href(p);
    if (location.hash === h) this.requestUpdate();
    else location.hash = h;
  }

  // ---------------------------------------------------------------- model helpers

  get d(): HomeData {
    return this.data as HomeData;
  }

  private world(): FavWorld {
    const d = this.d;
    return { rooms: this.visRooms(), cameras: d.cameras, scenes: d.scenes, hasEnergy: !!d.energy && d.energy.today.length > 0, hasSecurity: false };
  }

  visRooms(): HRoom[] {
    const hidden = new Set(this.prefs.layout.hidden_rooms ?? []);
    return roomsIn(this.d.rooms.filter((r) => !hidden.has(r.id)), this.bld); // MULTI-BUILDING-HOME-2500: the chosen building's rooms
  }

  /** MULTI-BUILDING-HOME-2500 (Q66): the rooms "כבה הכל" reaches - the chosen building's own rooms (never a room in no building). */
  private houseRooms(): HRoom[] {
    return offRooms(this.visRooms(), this.bld);
  }

  /** The chosen building's name ('' = none or "כל הבניינים"). */
  bName(): string {
    return nameOf(this.d.buildings ?? [], this.bld);
  }

  /** Q66: no whole-site "כבה הכל" in the home interface - under "כל הבניינים" the house-wide off is not offered. */
  private houseOffShown(): boolean {
    return this.bld !== ALL;
  }

  /** Q67: whether an item touching these areas shows under the chosen building, and its "גם ב..." note. */
  bldOf(areas: (string | null | undefined)[]): { show: boolean; note: string } {
    const bs = this.d.buildings ?? [];
    if (!bs.length) return { show: true, note: '' };
    const served = servedBy(areas, this.d.areaB ?? {}, bs);
    return { show: shows(served, this.bld), note: alsoNote(served, this.bld, bs) };
  }

  roomById(id: string): HRoom | undefined {
    return this.d.rooms.find((r) => r.id === id);
  }

  ctx(): HRoom | null {
    return this.room === 'home' ? null : this.roomById(this.room) ?? null;
  }

  private scopeRooms(): HRoom[] {
    const r = this.ctx();
    if (!r || this.scope === 'house') return this.houseRooms();
    if (this.scope === 'floor') return this.visRooms().filter((x) => x.floor === r.floor);
    return [r];
  }

  scopeWord(): string {
    const r = this.ctx();
    // MULTI-BUILDING-HOME-2500: "the house" of a multi-building site is the chosen building
    const house = this.bName() ? tr('ב{name}', { name: this.bName() }) : this.bld === ALL ? tr('בכל הבניינים') : tr('בכל הבית');
    return !r || this.scope === 'house' ? house : tr('ב{name}', { name: this.scope === 'floor' ? floorName(this.d.floors, r.floor) : r.name });
  }

  allDoors(): HDoor[] {
    return this.visRooms().flatMap((r) => r.doors);
  }

  private zonesOf(rs: HRoom[]): HZone[] {
    return rs.flatMap((r) => r.zones);
  }

  private mainZone(rs: HRoom[]): HZone | null {
    const zs = this.zonesOf(rs);
    return zs.find((z) => z.id === this.zone) ?? zs[0] ?? null;
  }

  private favRooms(): string[] {
    const rs = (this.prefs.layout.fav_rooms ?? this.visRooms().slice(0, 3).map((r) => r.id)).filter((id) => this.visRooms().some((r) => r.id === id));
    return ['home', ...rs];
  }

  private favs(key: string): Fav[] {
    return this.prefs.favourites[key] ?? this.prefs.seed[key] ?? defaultFavs(key, this.world());
  }

  private findLight(id: string): HLight | undefined {
    for (const r of this.d.rooms) {
      const l = r.lights.find((x) => x.id === id);
      if (l) return l;
    }
    return undefined;
  }

  private findIn<T extends { id: string }>(pick: (r: HRoom) => T[], id: string): T | undefined {
    for (const r of this.d.rooms) {
      const x = pick(r).find((y) => y.id === id);
      if (x) return x;
    }
    return undefined;
  }

  private favLabel(f: Fav): string {
    const name = (x?: { name: string }) => x?.name ?? '';
    switch (f.t) {
      case 'scene': return tr('סצנה: ') + name(this.d.scenes.find((s) => s.id === f.id));
      case 'light': return name(this.findLight(f.id ?? ''));
      case 'switch': return name(this.findIn((r) => r.loads, f.id ?? ''));
      case 'shade': return name(this.findIn((r) => r.shades, f.id ?? ''));
      case 'climate': { const z = this.findIn((r) => r.zones, f.id ?? ''); return tr('מיזוג: ') + (z?.name ?? ''); }
      case 'cam': return tr('מצלמה: ') + name(this.d.cameras.find((c) => c.id === f.id));
      case 'door': return name(this.findIn((r) => r.doors, f.id ?? ''));
      case 'allLights': return tr('כל האורות');
      default: return tr('חשמל היום');
    }
  }

  // ---------------------------------------------------------------- toasts and commands

  toast(text: string, undo: (() => void) | null = null) {
    this.toastUndo = undo;
    this.toaster.show(text);
  }

  private async outcome(p: Promise<act.Outcome>, okText?: string) {
    const o = await p;
    if (!o.ok) this.toast(o.note || tr('הפעולה לא הצליחה.'));
    else if (okText) this.toast(okText);
    this.scheduleRefresh(900);
  }

  private snapshotLights(rs: HRoom[]): { l: HLight; on: boolean; lvl: number }[] {
    return rs.flatMap((r) => r.lights.map((l) => ({ l, on: l.on, lvl: l.lvl })));
  }

  private undoLights(snap: { l: HLight; on: boolean; lvl: number }[]) {
    return () => {
      for (const s of snap) {
        if (!s.on) continue;
        s.l.on = true;
        if (!s.l.sw) act.setLevel(s.l, s.lvl, () => undefined);
        else void act.setPower(s.l, true);
      }
      this.toaster.clear();
      this.requestUpdate();
      this.scheduleRefresh(1200);
    };
  }

  private bulkScope(rs: HRoom[]): { kind: 'building' | 'area'; id: string; building?: string } | null {
    // MULTI-BUILDING-HOME-2500 (Q66): inside a building the request names it, and the server cuts the scope to that building's areas
    const b = this.bld && this.bld !== ALL ? this.bld : '';
    if (rs.length === 1 && rs[0].canBulk) return { kind: 'area', id: rs[0].id, ...(b && rs[0].bld === b ? { building: b } : {}) };
    if (b) return rs.length > 1 && rs.length === offRooms(this.d.rooms, b).length && this.d.canBulk ? { kind: 'building', id: '*', building: b } : null;
    if (this.bld === ALL) return null; // no whole-site off from the home interface: one command per light of the rooms shown
    if (rs.length > 1 && rs.length === this.d.rooms.length && this.d.canBulk) return { kind: 'building', id: '*' };
    return null;
  }

  private offLights(rs: HRoom[], withClimate: boolean, label: string) {
    const n = onCount(rs);
    const snap = this.snapshotLights(rs);
    // MEDIUM-REST-2540: what is on is read BEFORE the screen shows it off (the per-light path and the climate sent nothing: they read
    // the optimistic "off" and found nothing to turn off)
    const lit = rs.flatMap((r) => r.lights.filter((l) => l.on && l.can));
    const zonesOn = withClimate ? this.zonesOf(rs).filter((z) => z.mode !== 'off' && z.can) : [];
    for (const r of rs) {
      r.lights.forEach((l) => { if (l.can) l.on = false; });
      if (withClimate) r.zones.forEach((z) => { if (z.can) z.mode = 'off'; });
    }
    this.requestUpdate();
    const tasks: Promise<act.Outcome>[] = [act.lightsOff(rs, this.bulkScope(rs), lit)];
    if (withClimate) tasks.push(act.climateOff(zonesOn));
    void Promise.all(tasks).then((res) => {
      const bad = res.find((o) => !o.ok);
      if (bad) this.toast(bad.note || tr('חלק מהכיבוי לא הצליח.'));
      this.scheduleRefresh(900);
    });
    this.toast((label || (n === 1 ? tr('האור כובה') : tr('{n} אורות כובו', { n }))) + keptNote(rs), this.undoLights(snap));
  }

  // ---------------------------------------------------------------- events (one delegated handler, as the mockup)

  /** Review 08:F19: `data-act` -> its handler, as a typed table (was a string-built `this['a_' + act]` lookup). `OwnAct` is derived from the
   *  `a_*` methods, so a method without an entry - or an entry without a method - does not compile. */
  private readonly acts: Record<OwnAct, ActFn> = {
    light: (el) => this.a_light(el), load: (el) => this.a_load(el), guardOff: () => this.a_guardOff(),
    roomLights: (el) => this.a_roomLights(el), allOff: () => this.a_allOff(), scopeOff: () => this.a_scopeOff(),
    roomOff: () => this.a_roomOff(), roomOffId: (el) => this.a_roomOffId(el), houseOff: () => this.a_houseOff(), undo: () => this.a_undo(),
    scene: (el) => this.a_scene(el), askYes: () => this.a_askYes(), roomStep: (el) => this.a_roomStep(el),
    favRoom: (el) => this.a_favRoom(el), roomsEdit: () => this.a_roomsEdit(), edit: () => this.a_edit(), wgMove: (el) => this.a_wgMove(el),
    wgDel: (el) => this.a_wgDel(el), wgSize: (el) => this.a_wgSize(el), star: (el) => this.a_star(el), holdFav: (el) => this.a_holdFav(el),
    scope: (el) => this.a_scope(el), only: (el) => this.a_only(el), shadesOnly: (el) => this.a_shadesOnly(el),
    doorsOnly: (el) => this.a_doorsOnly(el), lightsTab: (el) => this.a_lightsTab(el), goLoads: () => this.a_goLoads(),
    floor: (el) => this.a_floor(el), page: (el) => this.a_page(el), temp: (el) => this.a_temp(el), preset: (el) => this.a_preset(el),
    modeSeg: (el) => this.a_modeSeg(el), zone: (el) => this.a_zone(el), zoneGo: (el) => this.a_zoneGo(el), zones: () => this.a_zones(),
    shade: (el) => this.a_shade(el), shadesAll: (el) => this.a_shadesAll(el), doorAsk: (el) => this.a_doorAsk(el),
    doorOpen: (el) => this.a_doorOpen(el), doorLock: (el) => this.a_doorLock(el), cam: (el) => this.a_cam(el),
    camStep: (el) => this.a_camStep(el), period: (el) => this.a_period(el), alertTab: (el) => this.a_alertTab(el),
    alertAck: (el) => this.a_alertAck(el), menu: () => this.a_menu(), close: () => this.a_close(), closeNav: () => this.a_closeNav(),
    face: (el) => this.a_face(el), theme: (el) => this.a_theme(el), hs: (el) => this.a_hs(el), bigText: () => this.a_bigText(),
    motion: (el) => this.a_motion(el), start: (el) => this.a_start(el), setTab: (el) => this.a_setTab(el),
    roomVis: (el) => this.a_roomVis(el), welcomePick: (el) => this.a_welcomePick(el), welcomeGo: () => this.a_welcomeGo(),
    alarm: (el) => this.a_alarm(el), codeKey: (el) => this.a_codeKey(el), codeGo: () => this.a_codeGo(), talk: () => this.a_talk(),
    p3Announce: () => this.a_p3Announce(), ring: () => this.a_ring(), switchUser: () => this.a_switchUser(),
    switchHostGo: () => this.a_switchHostGo(), kioskKey: (el) => this.a_kioskKey(el), kioskGo: () => this.a_kioskGo(),
    wall: (el) => this.a_wall(el), wallDel: () => this.a_wallDel(),
    bldPick: () => this.a_bldPick(), bld: (el) => this.a_bld(el), // MULTI-BUILDING-HOME-2500
  };

  private onClick = (ev: Event) => {
    if (this.held) {
      this.held = false;
      ev.preventDefault();
      return;
    }
    const el = (ev.composedPath() as HTMLElement[]).find((n) => n instanceof HTMLElement && n.dataset && n.dataset.act) as HTMLElement | undefined;
    if (!el || (el as HTMLButtonElement).disabled) return;
    const act = el.dataset.act ?? '';
    const own = Object.prototype.hasOwnProperty.call(this.acts, act) ? this.acts[act as OwnAct] : undefined;
    const mod = own ? null : this.ext.find((m) => m.acts && act in m.acts);
    const fn = own ?? mod?.acts?.[act];
    if (!fn) return;
    if (fn(el) !== true && el.tagName === 'A') ev.preventDefault();
  };

  private onInput = (ev: Event) => {
    const el = ev.composedPath()[0] as HTMLInputElement;
    if (!(el instanceof HTMLInputElement)) return;
    const v = +el.value;
    if (el.dataset.master) {
      const r = this.roomById(el.dataset.master);
      if (!r) return;
      const dims = r.lights.filter((l) => !l.sw && l.can);
      const any = dims.some((l) => l.on);
      for (const l of r.lights) {
        if (!l.can) continue;
        if (v === 0) {
          if (l.on) { l.on = false; if (l.sw) void act.setPower(l, false); else act.setLevel(l, 0, () => undefined); }
        } else if (!l.sw && (!any || l.on)) {
          l.on = true;
          l.lvl = Math.max(1, v);
          act.setLevel(l, l.lvl, (o) => { if (!o.ok) this.toast(o.note || tr('העמעום לא הצליח.')); });
        }
      }
      this.requestUpdate();
      return;
    }
    if (el.dataset.dim) {
      const l = this.findLight(el.dataset.dim);
      if (!l || !l.can) return;
      l.lvl = Math.max(1, v);
      l.on = true;
      this.requestUpdate();
      act.setLevel(l, l.lvl, (o) => { if (!o.ok) { this.toast(o.note || tr('העמעום לא הצליח.')); this.scheduleRefresh(200); } });
    }
  };

  private onPointerDown = (ev: PointerEvent) => {
    this.favDrag.down(ev); // HOME-FAVORITES-2500 (Q77): a long press in "עריכה" lifts the tile
    const path = ev.composedPath() as HTMLElement[];
    const host = path.find((n) => n instanceof HTMLElement && n.dataset?.ft && (n.classList.contains('lcard') || n.classList.contains('wdg')));
    const inCtl = path.some((n) => n instanceof HTMLElement && (n.tagName === 'INPUT' || n.classList?.contains('dim') || n.classList?.contains('star')));
    this.down = { x: ev.clientX, y: ev.clientY };
    this.swipe = this.route().name === 'r' && !inCtl && path.some((n) => n instanceof HTMLElement && n.id === 'main') ? { x: ev.clientX, y: ev.clientY } : null;
    window.clearTimeout(this.holdT);
    if (host && !this.edit && !inCtl) {
      this.holdT = window.setTimeout(() => {
        this.held = true;
        const f: Fav = { t: host.dataset.ft as Fav['t'], id: host.dataset.fid };
        this.ovl = { type: 'hold', f, label: this.favLabel(f) };
      }, 550);
    }
    const clock = path.find((n) => n instanceof HTMLElement && n.classList?.contains('hs-now'));
    if (clock && this.pol()?.kiosk && this.pol()?.kiosk_exit !== 'none') {
      this.holdT = window.setTimeout(() => { this.held = true; this.ovl = { type: 'kiosk', code: '', error: '' }; }, 1200);
    }
  };

  private onPointerMove = (ev: PointerEvent) => {
    if (Math.abs(ev.clientX - this.down.x) + Math.abs(ev.clientY - this.down.y) > 10) window.clearTimeout(this.holdT);
  };

  private onPointerUp = (ev: PointerEvent) => {
    window.clearTimeout(this.holdT);
    window.setTimeout(() => { this.held = false; }, 50);
    if (this.swipe && !this.kioskLocked()) {
      const dx = ev.clientX - this.swipe.x;
      const dy = ev.clientY - this.swipe.y;
      if (Math.abs(dx) > 70 && Math.abs(dy) < 50) {
        this.held = true;
        this.stepRoom(dx > 0 ? 1 : -1);
      }
    }
    this.swipe = null;
  };

  private stepRoom(d: number) {
    const fr = this.favRooms();
    const at = Math.max(0, fr.indexOf(this.room));
    this.go('r/' + fr[(at + d + fr.length) % fr.length]);
  }

  private fromEl(el: HTMLElement): Fav {
    const f: Fav = { t: el.dataset.ft as Fav['t'] };
    if (el.dataset.fid) f.id = el.dataset.fid;
    return f;
  }

  // the actions (data-act="<name>" -> a_<name>)
  a_light(el: HTMLElement) {
    const l = this.findLight(el.dataset.l ?? '');
    if (!l || !l.can) return this.toast(l && !l.ok ? tr('האור לא זמין כרגע.') : tr('אין הרשאה להפעיל את האור הזה.'));
    l.on = !l.on;
    this.requestUpdate();
    void this.outcome(l.sw ? act.setPower(l, l.on) : l.on ? new Promise((res) => act.setLevel(l, l.lvl || 100, res)) : act.setPower(l, false));
  }
  a_load(el: HTMLElement) {
    const x = this.findIn((r) => r.loads, el.dataset.ld ?? '');
    if (!x || !x.can) return this.toast(tr('אין הרשאה להפעיל את המפסק הזה.'));
    if (x.on && x.guard) { this.ovl = { type: 'guard', id: x.id }; return; }
    x.on = !x.on;
    this.requestUpdate();
    void this.outcome(act.setPower(x, x.on));
  }
  a_guardOff() {
    const o = this.ovl;
    if (o?.type !== 'guard') return;
    const x = this.findIn((r) => r.loads, o.id);
    this.ovl = null;
    if (!x) return;
    x.on = false;
    void this.outcome(act.setPower(x, false), tr('כובה'));
  }
  a_roomLights(el: HTMLElement) {
    const r = this.roomById(el.dataset.room ?? '');
    if (!r) return;
    const any = r.lights.some((l) => l.on);
    if (any) return this.offLights([r], false, '');
    for (const l of r.lights.filter((x) => x.can)) {
      l.on = true;
      void (l.sw ? act.setPower(l, true) : new Promise((res) => act.setLevel(l, l.lvl || 100, res)));
    }
    this.requestUpdate();
    this.scheduleRefresh(1200);
  }
  a_allOff() { if (this.houseOffShown()) this.offLights(this.houseRooms(), false, ''); }
  a_scopeOff() { if (this.ctx() && this.scope !== 'house' || this.houseOffShown()) this.offLights(this.scopeRooms(), false, ''); }
  a_roomOff() { const r = this.ctx(); if (r) this.offLights([r], true, tr('{name}: האורות והמיזוג כובו', { name: r.name })); else this.a_houseOff(); }
  a_roomOffId(el: HTMLElement) { const r = this.roomById(el.dataset.room ?? ''); if (r) this.offLights([r], true, tr('{name}: האורות והמיזוג כובו', { name: r.name })); }
  // MULTI-BUILDING-HOME-2500 (Q66): the house of a multi-building site is the chosen building, never the whole site
  a_houseOff() { if (this.houseOffShown()) this.offLights(this.houseRooms(), true, this.bName() ? tr('האורות והמיזוג ב{name} כובו', { name: this.bName() }) : tr('האורות והמיזוג בכל הבית כובו')); }
  a_bldPick() { this.ovl = { type: 'bld' }; }
  a_bld(el: HTMLElement) {
    const v = el.dataset.v ?? '';
    this.ovl = null;
    if (!v || v === this.bld) return;
    this.bld = v;
    saveLast(v); // Q65: the device remembers the last building chosen
    this.page = {};
    if (this.room !== 'home' && !this.visRooms().some((r) => r.id === this.room)) this.go('r/home');
    if (this.data?.modules.has('energy')) void this.reloadEnergy();
  }
  a_undo() { this.toastMsg?.undo?.(); }
  a_scene(el: HTMLElement) {
    const s = this.d.scenes.find((x) => x.id === el.dataset.scene);
    if (!s) return;
    const runIt = () => {
      this.sceneRun = s.id;
      window.setTimeout(() => { this.sceneRun = null; }, 620);
      this.lastScene = s.id;
      try { sessionStorage.setItem('home.lastScene', s.id); } catch { /* storage unavailable: this page only */ }
      // HOME-FAVORITES-2500 (Q79): once it ran, a leaving / night scene may suggest locking the doors or arming (always asked, with the code)
      void act.applyScene(s).then((o) => { void this.outcome(Promise.resolve(o), tr('סצנת {name} הופעלה', { name: s.name })); if (o.ok) void afterScene(this, s); });
    };
    if (s.sensitive) this.ovl = { type: 'ask', title: tr('להפעיל את {name}?', { name: s.name }), text: tr('הסצנה הזו משנה גם דברים רגישים.'), yes: tr('כן, הפעל'), run: runIt };
    else runIt();
  }
  a_askYes() { const o = this.ovl; this.ovl = null; if (o?.type === 'ask') o.run(); }
  a_roomStep(el: HTMLElement) { this.stepRoom(+(el.dataset.d ?? 1)); }
  a_favRoom(el: HTMLElement) {
    const id = el.dataset.id ?? '';
    const cur = (this.prefs.layout.fav_rooms ?? this.favRooms().slice(1)).slice();
    const i = cur.indexOf(id);
    if (i >= 0) cur.splice(i, 1); else cur.push(id);
    this.saveLayout({ fav_rooms: cur });
  }
  a_roomsEdit() { this.roomsEdit = !this.roomsEdit; }
  a_edit() { this.edit = !this.edit; }
  a_wgMove(el: HTMLElement) {
    const l = this.favs(this.room).filter((f) => favOk(f, this.world())).slice();
    const i = +(el.dataset.ix ?? 0); const j = i + +(el.dataset.d ?? 0);
    if (j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j], l[i]];
    this.saveFavs(this.room, l);
  }
  a_wgDel(el: HTMLElement) {
    const l = this.favs(this.room).filter((f) => favOk(f, this.world())).slice();
    const [f] = l.splice(+(el.dataset.ix ?? 0), 1);
    const key = this.room;
    this.saveFavs(key, l);
    this.toast(tr('הוסר מהמועדפים'), () => { const back = this.favs(key).slice(); back.push(f); this.saveFavs(key, back); this.toaster.clear(); });
  }
  a_wgSize(el: HTMLElement) {
    const l = this.favs(this.room).filter((f) => favOk(f, this.world())).map((f) => ({ ...f }));
    const f = l[+(el.dataset.ix ?? 0)];
    if (f?.t !== 'light') return;
    f.w = favWidth(f) === 2 ? 1 : 2;
    this.saveFavs(this.room, l);
  }
  a_star(el: HTMLElement) {
    const f = this.fromEl(el);
    const l = this.favs(this.room).slice();
    const i = l.findIndex((x) => sameFav(x, f));
    const r = this.ctx();
    if (i >= 0) { l.splice(i, 1); this.toast(tr('הוסר מהמועדפים')); }
    else { if (f.t === 'light') f.w = this.findLight(f.id ?? '')?.sw ? 1 : 2; l.push(f); this.toast(tr('נוסף למועדפים של {v1}', { v1: r ? r.name : tr('הבית שלי') })); }
    this.saveFavs(this.room, l);
  }
  a_holdFav(el: HTMLElement) {
    const o = this.ovl;
    if (o?.type !== 'hold') return;
    const k = el.dataset.k ?? this.room;
    const l = this.favs(k).slice();
    const i = l.findIndex((x) => sameFav(x, o.f));
    if (i >= 0 && k === this.room) l.splice(i, 1); else if (i < 0) l.push({ ...o.f, ...(o.f.t === 'light' ? { w: 2 as const } : {}) });
    this.saveFavs(k, l);
    this.ovl = null;
    this.toast(k === 'home' ? tr('נוסף ל"הבית שלי"') : tr('המועדפים עודכנו'));
  }
  a_scope(el: HTMLElement) { this.scope = el.dataset.v as never; this.page = {}; this.zone = null; }
  a_only(el: HTMLElement) { this.only = el.dataset.v === '1'; this.page = { ...this.page, lights: 0, loads: 0 }; }
  a_shadesOnly(el: HTMLElement) { this.shadesOnly = el.dataset.v === '1'; this.page = { ...this.page, shades: 0 }; }
  a_doorsOnly(el: HTMLElement) { this.doorsOnly = el.dataset.v === '1'; this.page = { ...this.page, doors: 0 }; }
  a_lightsTab(el: HTMLElement) { this.lightsTab = el.dataset.v as never; }
  a_goLoads() { this.lightsTab = 'loads'; this.scope = 'house'; this.only = true; return true; }
  a_floor(el: HTMLElement) { this.floor = el.dataset.v ?? ''; this.page = { ...this.page, roomsP: 0, setRooms: 0 }; }
  a_page(el: HTMLElement) { const k = el.dataset.key ?? ''; this.page = { ...this.page, [k]: Math.max(0, (this.page[k] ?? 0) + +(el.dataset.d ?? 0)) }; }
  a_temp(el: HTMLElement) {
    const z = this.findIn((r) => r.zones, el.dataset.zone ?? '');
    if (!z || !z.can) return this.toast(tr('אין הרשאה לכוון את המזגן הזה.'));
    // MEDIUM-REST-2540 (SCR-31): +/- on a zone that is off turns it on with the new target (cool, else its first other mode); the
    // "off" is read before the screen shows it on - setTarget used to see the optimistic mode and sent the setpoint only. A unit that
    // offers no mode but off says so and changes nothing.
    const wasOff = z.mode === 'off';
    const mode = wasOff ? act.onModeFor(z) : null;
    if (wasOff && !mode) return this.toast(tr('{name} כבוי ואי אפשר להדליק אותו מכאן.', { name: z.name }));
    const base = z.target ?? z.temp ?? 23;
    z.target = Math.max(z.min, Math.min(z.max, base + (+(el.dataset.d ?? 0)) * (z.step || 1)));
    if (mode) z.mode = mode;
    this.requestUpdate();
    void this.outcome(act.setTarget(z, z.target, wasOff));
  }
  a_preset(el: HTMLElement) {
    const z = this.findIn((r) => r.zones, el.dataset.zone ?? '');
    if (!z || !z.can) return;
    z.target = +(el.dataset.v ?? 23);
    this.requestUpdate();
    void this.outcome(act.setTarget(z, z.target));
  }
  a_modeSeg(el: HTMLElement) {
    const z = this.mainZone(this.scopeRooms());
    if (!z || !z.can) return;
    z.mode = el.dataset.v ?? 'off';
    this.requestUpdate();
    void this.outcome(act.setMode(z, z.mode));
  }
  a_zone(el: HTMLElement) { this.zone = el.dataset.v ?? null; this.ovl = null; }
  a_zoneGo(el: HTMLElement) { this.zone = el.dataset.v ?? null; const r = this.ctx(); if (r && !r.zones.some((z) => z.id === this.zone)) this.scope = 'house'; return true; }
  a_zones() { this.ovl = { type: 'zones' }; }
  a_shade(el: HTMLElement) {
    const s = this.findIn((r) => r.shades, el.dataset.id ?? '');
    const v = el.dataset.v as 'open' | 'close' | 'stop';
    if (!s || !s.can) return this.toast(tr('אין הרשאה להזיז את התריס הזה.'));
    const key = `${s.id}:${v}`;
    if (v !== 'stop' && this.armed !== key) {
      // the platform asks a person to confirm a movement: a second tap within 3 seconds sends it
      this.armed = key;
      window.clearTimeout(this.armT);
      this.armT = window.setTimeout(() => { this.armed = null; }, 3000);
      return;
    }
    this.armed = null;
    s.moving = v !== 'stop';
    s.state = v === 'open' ? 'opening' : v === 'close' ? 'closing' : s.state;
    this.requestUpdate();
    void this.outcome(act.moveShade(s, v));
  }
  a_shadesAll(el: HTMLElement) {
    const v = el.dataset.v === 'open' ? 'open' : 'close';
    const list = this.scopeRooms().flatMap((r) => r.shades).filter((s) => s.can);
    if (!list.length) return;
    this.ovl = { type: 'ask', title: v === 'open' ? tr('לפתוח את כל התריסים?') : tr('לסגור את כל התריסים?'), text: `${list.length === 1 ? tr('תריס אחד') : list.length + tr(' תריסים')} ${this.scopeWord()}.`, yes: v === 'open' ? tr('כן, פתח') : tr('כן, סגור'),
      run: () => { list.forEach((s) => { s.moving = true; void act.moveShade(s, v); }); this.toast(v === 'open' ? tr('התריסים נפתחים') : tr('התריסים נסגרים')); this.scheduleRefresh(1500); } };
  }
  a_doorAsk(el: HTMLElement) { this.ovl = { type: 'confirm', door: el.dataset.door ?? '' }; }
  a_doorOpen(el: HTMLElement) {
    const d = this.findIn((r) => r.doors, el.dataset.door ?? '');
    this.ovl = null;
    if (!d) return;
    void act.openDoor(d).then((o) => {
      if (!o.ok) this.toast(o.note || tr('הדלת לא נפתחה.'));
      else this.toast(d.kind === 'gate' ? tr('{name}: נשלחה פקודת פתיחה. השער ייסגר שוב מעצמו.', { name: d.name }) : tr('{name}: נשלחה פקודת פתיחה. הדלת תינעל שוב מעצמה.', { name: d.name }));
      this.scheduleRefresh(1500);
    });
  }
  a_doorLock(el: HTMLElement) {
    const d = this.findIn((r) => r.doors, el.dataset.door ?? '');
    if (!d) return;
    void this.outcome(act.lockDoor(d), tr('{name} ננעלה', { name: d.name }));
  }
  a_cam(el: HTMLElement) { this.ovl = { type: 'cam', id: el.dataset.cam ?? '' }; }
  a_camStep(el: HTMLElement) {
    const o = this.ovl;
    if (o?.type !== 'cam') return;
    const cs = this.d.cameras;
    const i = cs.findIndex((c) => c.id === o.id);
    this.ovl = { type: 'cam', id: cs[(i + +(el.dataset.d ?? 1) + cs.length) % cs.length].id };
  }
  a_period(el: HTMLElement) { this.period = el.dataset.v as never; }
  a_alertTab(el: HTMLElement) { this.alertTab = el.dataset.v as never; this.page = { ...this.page, alerts: 0 }; }
  a_alertAck(el: HTMLElement) {
    const a = this.d.alerts.find((x) => x.id === el.dataset.id);
    if (!a) return;
    void notify().ack(a.id).then(() => { a.open = false; a.tone = 'ok'; this.requestUpdate(); this.toast(tr('טופל. תודה.')); }).catch((err) => this.toast(describeError(err)));
  }
  a_menu() { this.ovl = { type: 'menu' }; }
  a_close() { this.ovl = null; }
  a_closeNav() { this.ovl = null; return true; }
  a_face(el: HTMLElement) {
    const v = el.dataset.v === 'full' ? 'full' : 'home';
    this.ovl = null;
    if (v === 'home') return;
    void switchInterface('full').then(() => { location.hash = '#/'; location.reload(); }).catch((err) => this.toast(describeError(err)));
  }
  a_theme(el: HTMLElement) { this.saveLayout({ scheme: el.dataset.v === 'light' ? 'light' : 'dark' }); }
  a_hs(el: HTMLElement) { this.saveLayout({ theme: el.dataset.v ?? 'classic' }); }
  a_bigText() { this.saveLayout({ big_text: !this.prefs.layout.big_text }); }
  a_motion(el: HTMLElement) { this.saveLayout({ motion: el.dataset.v === 'rise' ? 'rise' : 'fade' }); }
  a_start(el: HTMLElement) { const v = el.dataset.v as HomeLayout['start']; this.saveLayout({ start: v, start_room: v === 'fixed' || v === 'last' ? (this.ctx()?.id ?? this.prefs.layout.start_room ?? null) : null }); }
  a_setTab(el: HTMLElement) { this.go('settings/' + (el.dataset.v ?? 'favs')); }
  a_roomVis(el: HTMLElement) {
    const id = el.dataset.id ?? '';
    const h = new Set(this.prefs.layout.hidden_rooms ?? []);
    if (h.has(id)) h.delete(id); else h.add(id);
    this.saveLayout({ hidden_rooms: [...h] });
  }
  a_welcomePick(el: HTMLElement) { this.welcomePick = el.dataset.v === 'full' ? 'full' : 'home'; }
  a_welcomeGo() {
    this.saveLayout({ welcomed: true });
    if (this.welcomePick === 'full') void switchInterface('full').then(() => { location.hash = '#/'; location.reload(); }).catch((err) => this.toast(describeError(err)));
    else { void switchInterface('home').catch(() => undefined); this.go('r/home'); }
  }
  a_alarm(el: HTMLElement) {
    const p = this.panels.find((x) => x.entity_id === el.dataset.panel);
    const action = el.dataset.v as AlarmAction;
    if (!p) return;
    const prompt = action === 'disarm' ? p.code.disarm : p.code.arm;
    if (prompt === 'unverifiable' || prompt === 'pin_missing') return this.toast(prompt === 'pin_missing' ? tr('צריך קוד אישי לאזעקה. מגדירים אותו בממשק המלא.') : tr('אי אפשר לאמת קוד לפעולה הזו מכאן.'));
    const send = (code?: string) => {
      this.ovl = null;
      void panelAction(p.entity_id, action, { confirmed: true, code })
        .then((rec) => followAlarmAction(this, rec, action)) // SCREENS-FIX-A-2520 (SCR-06): "sent" until the panel confirms
        .catch((err) => this.toast(describeError(err)));
    };
    if (prompt === 'pin' || prompt === 'panel') this.ovl = { type: 'code', title: `${ARM_LABEL[action]}: ${p.name}`, code: '', error: '', run: (c) => send(c) };
    else this.ovl = { type: 'ask', title: `${ARM_LABEL[action]}?`, text: p.name, yes: tr('כן'), run: () => send() };
  }
  a_codeKey(el: HTMLElement) {
    const o = this.ovl;
    if (o?.type !== 'code') return;
    const k = el.dataset.k ?? '';
    this.ovl = { ...o, code: k === 'del' ? o.code.slice(0, -1) : o.code.length < 12 ? o.code + k : o.code, error: '' };
  }
  a_codeGo() { const o = this.ovl; if (o?.type === 'code' && o.code) o.run(o.code); }
  a_talk() { if (this.talkTo) this.ovl = { type: 'talk' }; }
  a_p3Announce() { this.p3.openAnnounce(); } // HOME-V3-P3-2432: the hub's "כריזה בבית" tile
  a_ring() { (this.renderRoot.querySelector('sw-home-call') as SwHomeCall | null)?.unhideRinging(); }
  a_switchUser() {
    const mode = switchUserMode();
    if (mode === 'arx') { this.ovl = null; void arxLogout('logout'); return; }
    this.ovl = { type: 'switchHost' };
  }
  /** HOME-SIMPLE-2421: inside the home system the sign-in is the host's own: open its account page (same origin, the top window), where
   * the person signs out and the next person signs in. Arx signs nobody out and touches no user. */
  a_switchHostGo() {
    this.ovl = null;
    try {
      (window.top ?? window).location.assign('/profile/general');
    } catch {
      window.location.assign('/profile/general');
    }
  }
  a_kioskKey(el: HTMLElement) {
    const o = this.ovl;
    if (o?.type !== 'kiosk') return;
    const k = el.dataset.k ?? '';
    const code = k === 'del' ? o.code.slice(0, -1) : o.code.length < 8 ? o.code + k : o.code;
    this.ovl = { ...o, code, error: '' };
  }
  a_kioskGo() {
    const o = this.ovl;
    if (o?.type !== 'kiosk' || o.code.length < 4) return;
    void post('home/kiosk/exit', { code: o.code }).then(() => {
      this.kioskUntil = Date.now() + KIOSK_UNLOCK_MS;
      this.ovl = null;
      this.toast(tr('מסך הקיר פתוח לחמש דקות.'));
    }).catch((err) => { this.ovl = { type: 'kiosk', code: '', error: describeError(err) }; });
  }

  // ---------------------------------------------------------------- shared pieces

  pg(key: string): number {
    return this.page[key] ?? 0;
  }

  pager(key: string, pages: number): TemplateResult | typeof nothing {
    if (pages <= 1) return nothing;
    const p = Math.min(this.pg(key), pages - 1);
    return html`<div class="pager" role="group" aria-label="${tr('דפדוף')}"><button class="rb" data-act="page" data-key=${key} data-d="-1" ?disabled=${p === 0} aria-label="${tr('הקודם')}">${hi('back')}</button><span class="pg num" aria-live="polite">${p + 1} ${tr('מתוך')} ${pages}</span><button class="rb" data-act="page" data-key=${key} data-d="1" ?disabled=${p >= pages - 1} aria-label="${tr('הבא')}">${hi('fwd')}</button></div>`;
  }

  /** CR-HOME-V3-SEGMENTS-2470 (owner N11): a one-of-N choice is the shared `sw-segmented`. Each key carries its `data-act` / `data-v`
   *  (the component's `attrs`), so the press still reaches the ONE delegated click handler (`onClick` reads `composedPath()`, which
   *  runs through the key inside the component's open shadow root) - the `a_*` handlers and the screens' specs are unchanged. The
   *  component's own `change` is not listened to here (the click already carries the choice). */
  seg(a: string, opts: [string, string][], cur: string, label: string) {
    return html`<sw-segmented label=${label} value=${cur} .options=${opts.map(([v, t]): SegmentOption => ({ value: v, label: t, attrs: { 'data-act': a, 'data-v': v } }))}></sw-segmented>`;
  }

  scopeSeg() {
    return this.ctx() ? this.seg('scope', [['room', tr('החדר הזה')], ['floor', tr('הקומה')], ['house', tr('כל הבית')]], this.scope, tr('איפה')) : nothing;
  }

  private onlySeg(a: string, cur: boolean, word: string) {
    return this.seg(a, [['0', tr('הכל')], ['1', word]], cur ? '1' : '0', tr('סינון'));
  }

  head(title: unknown, sub: unknown, acts?: unknown) {
    return html`<header class="hs-head"><div class="ttl"><h2 class="pg-t clamp1">${title}</h2>${sub ? html`<p class="sub clamp1">${sub}</p>` : nothing}</div>${acts ? html`<div class="acts">${acts}</div>` : nothing}</header>`;
  }

  headT(title: unknown, sub: unknown, tabs: unknown, acts?: unknown) {
    return this.phone ? html`${this.head(title, sub, acts)}<div class="bar tabsrow">${tabs}</div>` : this.head(title, sub, html`${tabs}${acts ?? nothing}`);
  }

  empty(icon: string, title: string, text: string) {
    return html`<div class="empty">${hi(icon)}<h2>${title}</h2><p>${text}</p></div>`;
  }

  private star(f: Fav) {
    const on = this.favs(this.room).some((x) => sameFav(x, f));
    return html`<button class="rb star" data-act="star" data-ft=${f.t} data-fid=${f.id ?? ''} aria-pressed=${String(on)} aria-label=${on ? tr('הסר מהמועדפים') : tr('הוסף למועדפים')}>${hi('star')}</button>`;
  }

  private sw(on: boolean, a: string, label: string, id = '') {
    return html`<button class="hsw" role="switch" aria-checked=${String(on)} data-act=${a} data-id=${id} aria-label=${label}><i></i></button>`;
  }

  private dimmer(l: HLight) {
    const v = l.on ? l.lvl : 0;
    return html`<label class="dim${l.on && l.lvl >= 50 ? '' : ' lo'}"><span class="dim-fill" style=${`transform:scaleX(${v / 100})`}></span><span class="dim-edge" style=${`transform:translateX(${-v}%)`}><i></i></span><input type="range" min="1" max="100" .value=${String(l.lvl)} data-dim=${l.id} ?disabled=${!l.can} aria-label=${tr('עוצמת ') + l.name}><span class="dim-v num">${l.on ? l.lvl + '%' : tr('כבוי')}</span></label>`;
  }

  private lampBtn(l: HLight) {
    return html`<button class="lamp" data-act="light" data-l=${l.id} aria-pressed=${String(l.on)} ?disabled=${!l.ok} aria-label=${l.name}>${hi(l.sw ? 'switch' : 'bulb')}</button>`;
  }

  private swCtl(l: HLight) {
    return html`<span class="swc"><span class="sw-t">${onWord(l.on)}</span><button class="hsw" role="switch" aria-checked=${String(l.on)} data-act="light" data-l=${l.id} ?disabled=${!l.ok} aria-label=${l.name}><i></i></button></span>`;
  }

  private trio(s: HShade) {
    const b = (v: string, icon: string, label: string) => {
      const armed = this.armed === `${s.id}:${v}`;
      return html`<button class="rb${armed ? ' armed' : ''}" data-act="shade" data-id=${s.id} data-v=${v} ?disabled=${!s.can} aria-label=${armed ? label + tr(': לחצו שוב לאישור') : label}>${hi(icon)}</button>`;
    };
    return html`<div class="trio">${b('open', 'up', tr('פתח'))}${b('stop', 'stop', tr('עצור'))}${b('close', 'down', tr('סגור'))}</div>`;
  }

  /** HOME-V3-AUDITFIX-2437 (audit item 5): what a live camera tile really shows, from its player's status (no entry = connecting) */
  private camMode: Record<string, 'live' | 'still'> = {};

  private onCamStatus(id: string, e: Event) {
    const d = (e as CustomEvent<{ status?: string }>).detail;
    const player = e.composedPath()[0] as { stillNotice?: string } | undefined;
    const mode = d?.status === 'playing' ? 'live' : d?.status === 'error' && player?.stillNotice ? 'still' : undefined;
    if (this.camMode[id] === mode) return;
    if (mode) this.camMode = { ...this.camMode, [id]: mode };
    else { const { [id]: _, ...rest } = this.camMode; this.camMode = rest; }
    this.requestUpdate();
  }

  /** HOME-R32-ANSWERS-2438 (owner round 32 Q-HOME-3 a): how often a camera tile without video refreshes its still, in seconds - the
   *  cameras screen's own stills (HOME_STILL_SECS), or the player's snapshot fallback of a favourite tile (STILL_REFRESH_MS) */
  private stillSecs(live: boolean): number {
    return Math.round((live ? STILL_REFRESH_MS : stillIntervalMs(HOME_STILL_SECS)) / 1000);
  }

  camPic(c: HCamera, live: boolean) {
    // the state word is the true state (DESIGN.md "Dot-and-Word Rule"): a playing stream = "חי"; a refreshing still = "תמונה" with the
    // offline dot (how often in the title); a stream not yet playing = "מתחבר", no dot. The tile's own still label is off: it sat under the star.
    const mode = !c.ok ? null : live ? (this.camMode[c.id] ?? 'wait') : 'still';
    const word = mode === 'live' ? html`<span class="live" data-cam-mode="live"><i class="dot"></i>${tr('חי')}</span>`
      : mode === 'still' ? html`<span class="lv-g"><span class="live still" data-cam-mode="still" title=${tr('מתעדכנת כל {v1} שנ׳', { v1: this.stillSecs(live) })}><i class="dot"></i>${tr('תמונה')}</span><small class="lv-d" data-cam-every=${this.stillSecs(live)}>${tr('מתעדכנת כל')} <span class="num">${this.stillSecs(live)}</span> ${tr('שנ׳')}</small></span>`
        : mode === 'wait' ? html`<span class="live wait" data-cam-mode="wait">${tr('מתחבר')}</span>` : nothing;
    return html`${c.ok ? html`<sw-camera-tile class="scene-pic" dark noDemo noLabel fit="cover" cameraId=${c.id} state="live" ?live=${live} profile="sub" autoProfile poster=${snapshotUrl(c.id)} .stillRefresh=${live ? 0 : HOME_STILL_SECS} @player-status=${(e: Event) => this.onCamStatus(c.id, e)}></sw-camera-tile>` : html`<div class="cam-off">${hi('camoff')}<span>${tr('המצלמה לא זמינה כרגע')}</span></div>`}<div class="cap"><span class="clamp1" dir="auto" title=${c.name}>${c.name}</span>${word}</div>`;
  }

  // ---------------------------------------------------------------- shell

  private strip(name: string) {
    const doors = this.allDoors();
    const a = this.d.alerts.filter((x) => x.open).length;
    const r = this.ctx();
    const sub = name !== 'r';
    const locked = this.kioskLocked();
    const fr = this.favRooms();
    const at = fr.indexOf(this.room);
    const roomTitle = html`<span class="tb-t"><h1 class="clamp1">${r ? r.name : tr('הבית שלי')}</h1><span class="tb-c clamp1">${r ? floorName(this.d.floors, r.floor) : this.userFull || this.userName}</span></span>`;
    return html`<header class="hs-strip">
      ${sub ? (this.extBack(name) ? html`<a class="tb-back" href=${this.href(this.extBack(name) as string)} aria-label="${tr('חזרה')}">${hi('back')}</a>` : html`<a class="tb-back" href=${this.href('r/' + this.room)} aria-label=${tr('חזרה אל ') + (r ? r.name : tr('הבית שלי'))}>${hi('back')}</a>`) : nothing}
      ${locked ? html`<span class="tb-room">${roomTitle}</span>` : html`<a class="tb-room" href=${this.href('rooms')} aria-label=${tr('החלפת חדר. עכשיו: ') + (r ? r.name : tr('הבית שלי'))}>${roomTitle}${hi('down')}</a>`}
      ${this.bld && !locked ? html`<button class="tb-bld" data-act="bldPick" aria-haspopup="dialog" aria-label=${tr('החלפת בניין. עכשיו: ') + (this.bName() || tr('כל הבניינים'))}>${hi('building')}<span class="clamp1">${this.bName() || tr('כל הבניינים')}</span>${hi('down')}</button>` : nothing}
      ${fr.length > 1 && !locked ? html`<div class="tb-fav" role="group" aria-label="${tr('חדרים מועדפים')}"><button class="rb" data-act="roomStep" data-d="-1" aria-label="${tr('החדר המועדף הקודם')}">${hi('back')}</button><span class="dots" aria-hidden="true">${fr.map((_, i) => html`<i class=${i === at ? 'on' : ''}></i>`)}</span><button class="rb" data-act="roomStep" data-d="1" aria-label="${tr('החדר המועדף הבא')}">${hi('fwd')}</button></div>` : nothing}
      <div class="hs-now"><span class="time num">${HE_TIME.format(this.now)}</span><span class="date">${HE_WEEKDAY.format(this.now)}</span>${this.d.weather && this.d.weather.t != null ? (this.extFor('weather') ? html`<a class="wx" href=${this.href('weather')} aria-label="${tr('מזג האוויר בחוץ')}">${hi('sun')}<span class="num">${this.d.weather.t}°</span><span class="wxt ellip">${this.d.weather.text}</span></a>` : html`<span class="wx" title="${tr('מזג האוויר בחוץ')}">${hi('sun')}<span class="num">${this.d.weather.t}°</span><span class="wxt ellip">${this.d.weather.text}</span></span>`) : nothing}</div>
      <div class="hs-status">
        ${this.calls.waiting ? html`<button class="st-pill call" data-act="ring">${hi('bell')}<span>${tr('מחכים בדלת')}</span></button>` : nothing}
        ${this.d.modules.has('doors') ? html`<a class="st-pill" href=${this.href('doors')} data-tone=${doorsTone(doors)}><i class="dot"></i><span>${doorsText(doors)}</span></a>` : nothing}
        ${this.d.modules.has('alerts') ? html`<a class="st-btn" href=${this.href('alerts')} aria-label=${tr('התראות') + (a ? ': ' + a + tr(' דורשות טיפול') : '')}>${hi('bell')}${a ? html`<b class="count num">${a}</b>` : nothing}</a>` : nothing}
        <button class="st-me" data-act="menu" aria-haspopup="dialog" aria-label=${tr('התפריט של ') + this.userName}><span class="av">${(this.userName || '?').slice(0, 1)}</span></button>
      </div></header>`;
  }

  private nav(cur: string) {
    const items = NAV.filter(([, , , id]) => id !== 'alerts' || this.d.modules.has('alerts')).filter(([, , , id]) => id !== 'scenes' || this.d.modules.has('scenes')).filter(([, , , id]) => id !== 'more' || (!this.kioskLocked() && !!this.extFor('more') && moreTiles(this).length > 0));
    cur = this.extFor(cur)?.navCur?.(cur) ?? (moreChild(cur) ? 'more' : cur);
    return html`<nav class="hs-nav" aria-label="${tr('ניווט ראשי')}">${items.map(([h, label, icon, id]) => html`<a href=${this.href(h)} aria-current=${cur === id ? 'page' : nothing}>${hi(icon)}<span>${id === 'active' ? html`${tr('פעיל')}<span class="nv-x"> ${tr('עכשיו')}</span>` : label}</span></a>`)}</nav>`;
  }

  /** HOME-V3-P1-2430: the back target of a registered screen (the hub's children go back to the hub). */
  private extBack(name: string): string | null {
    const m = this.extFor(name);
    if (m?.back) return m.back(name);
    return moreChild(name) && name !== 'more' ? 'more' : null;
  }

  private nowBar() {
    const r = this.ctx();
    const any = r ? r.lights.some((l) => l.on) || r.zones.some(zoneOn) : activeRooms(this.visRooms()).length > 0;
    const m = r && r.lights.some((l) => !l.sw) ? masterLevel(r) : null;
    const text = r ? activeText(r) : homeBarText(this.visRooms());
    return html`<footer class="nowbar" aria-label=${r ? tr('עכשיו ב') + r.name : tr('עכשיו בבית')}><a class="nb-t" href=${this.href('active')}><span class="nb-k">${r ? tr('עכשיו בחדר') : tr('עכשיו בבית')}</span><b class="clamp1">${text}</b></a>
      ${!r && !this.phone ? html`<span class="nb-rooms">${activeRooms(this.visRooms()).slice(0, 3).map((x) => html`<a class="chip2" href=${this.href('r/' + x.id)}><span class="clamp1">${x.name}</span></a>`)}</span>` : nothing}
      ${m != null && r ? html`<span class="nb-ml">${tr('כל האורות')}</span><label class="dim master${m >= 50 ? '' : ' lo'}"><span class="dim-fill" style=${`transform:scaleX(${m / 100})`}></span><span class="dim-edge" style=${`transform:translateX(${-m}%);opacity:${m ? 1 : 0}`}><i></i></span><input type="range" min="0" max="100" .value=${String(m)} data-master=${r.id} aria-label=${tr('עוצמת כל האורות ב') + r.name}><span class="dim-v num">${m ? m + '%' : tr('כבוי')}</span></label>` : nothing}
      ${r || this.houseOffShown() ? html`<button class="hbtn nb-off" data-act="roomOff" ?disabled=${!any} aria-label=${!r && this.bName() ? offLabel(this.bName()) : nothing}>${hi('power')}<span class="bt">${r ? tr('כיבוי החדר') : this.bName() ? offLabel(this.bName()) : tr('כיבוי כל הבית')}</span></button>` : nothing}</footer>`;
  }

  // ---------------------------------------------------------------- the room screen

  private chips() {
    const r = this.ctx();
    const rs = r ? [r] : this.visRooms();
    const mods = this.d.modules;
    const out: [string, string, string, unknown, string, string?, string?][] = [];
    const nL = rs.reduce((a, x) => a + x.lights.length + x.loads.length, 0);
    const on = onCount(rs);
    if (nL && mods.has('lights')) out.push(['lights', tr('תאורה'), 'bulb', on === 0 ? tr('כבויים') : on === 1 ? tr('אחד דולק') : on + tr(' דולקים'), on > 0 ? 'lit' : '']);
    const zs = this.zonesOf(rs);
    if (zs.length && mods.has('climate')) out.push(['climate', tr('אקלים'), 'thermo', r ? (zs[0].mode === 'off' ? tr('כבוי') : html`<span class="num">${zs[0].target ?? '—'}°</span>`) : tr('{length} פועלים', { length: zs.filter(zoneOn).length }), '']);
    const sh = rs.flatMap((x) => x.shades);
    if (sh.length && mods.has('shades')) { const o = sh.filter((s) => (s.pos ?? 0) > 0).length; out.push(['shades', tr('תריסים'), 'shade', o === 0 ? tr('סגורים') : o === 1 ? tr('אחד פתוח') : o + tr(' פתוחים'), '']); }
    const dh = rs.flatMap((x) => x.doors);
    if (dh.length && mods.has('doors')) {
      // HONEST-STATES-2540 (SCR-10): an offline / unknown lock is "לא ידוע", never an open door and never "נעול"
      const u = dh.filter(doorOpen).length;
      const k = dh.filter((d) => !d.known).length;
      out.push(['doors', tr('דלתות'), u ? 'unlock' : k ? 'door' : 'lock', u ? (u === 1 ? tr('אחת פתוחה') : u + tr(' פתוחות')) : k ? tr('לא ידוע') : tr('נעול'), u ? 'warn' : k ? '' : 'ok']);
    }
    const cams = r ? this.d.cameras.filter((c) => r.cams.includes(c.id)) : this.d.cameras;
    if (cams.length && mods.has('cameras')) { const bad = cams.filter((c) => !c.ok).length; out.push(['cameras', tr('מצלמות'), 'cam', r ? (bad ? tr('לא זמינה') : tr('חי')) : bad ? tr('{v1} מתוך {length}', { v1: cams.length - bad, length: cams.length }) : cams.length + tr(' פועלות'), '']); }
    if (!r && mods.has('intercom') && this.visitors.length) out.push(['doors', tr('אינטרקום'), 'phone', tr('{length} ביקורים', { length: this.visitors.length }), '', 'intercom']);
    if (!r && this.d.energy && this.d.energy.today.length && mods.has('energy')) out.push(['energy', tr('חשמל'), 'bolt', html`<span class="num">${num1(this.d.energy.today.reduce((a, b) => a + b, 0))}</span> ${tr('קוט״ש')}`, '']);
    if (!r && this.panels.length && mods.has('security')) {
      // HONEST-STATES-2540 (SCR-09): an unavailable / unknown panel is never "דרוך" (green); home-v3-words.securityChip says why
      const c = securityChip(this.panels);
      out.push(['security', tr('אבטחה'), 'shield', c.text, c.tone]);
    }
    const sc = r ? this.d.scenes.filter((s) => s.rooms.includes(r.id)) : this.d.scenes;
    if (mods.has('scenes') && this.d.scenes.length) out.push(['scenes', tr('סצנות'), 'scenes', r ? (sc.length ? sc.length + tr(' בחדר') : tr('של הבית')) : this.d.scenes.length + tr(' בבית'), '']);
    out.push(...this.p3.roomChips(r)); // HOME-V3-P3-2432: "מדיה" when the room has a speaker or a screen
    if (r && this.kioskLocked()) out.push(...wallChips(this)); // HOME-V3-P2-2431: a wall panel also shows the notice board and the calendar
    const shown = out.slice(0, 8);
    // HOME-V3-P1-2430: the intercom chip opens the intercom screen when it is offered; "עוד" is the ninth category of the home screen
    const ic = shown.find((x) => x[5] === 'intercom');
    if (ic && this.extFor('intercom')) ic[0] = 'intercom';
    if (!r && this.extFor('more') && !this.kioskLocked() && moreTiles(this).length) shown.push(['more', tr('עוד'), 'grid', this.moreChipText(), '', 'more']);
    return { n: shown.length, t: shown.map(([h, label, icon, st, tone, key, full]) => html`<a class="chip3" href=${this.href(h)} data-cat=${key ?? h} title=${full ?? nothing}>${hi(icon, tone === 'lit' ? 'lit' : '')}<span class="c3-t"><b>${label}</b><span class="c3-s" data-tone=${tone === 'ok' || tone === 'warn' ? tone : nothing}>${tone === 'ok' || tone === 'warn' ? html`<i class="dot"></i>` : nothing}<span>${st}</span></span></span></a>`) };
  }

  /** the "עוד" chip's line: how many new things wait in the hub, else how many capabilities it holds */
  private moreChipText(): string {
    const st = (this.extState.moreSummary as { tiles: number; badges: number } | undefined) ?? { tiles: moreTiles(this).length, badges: 0 };
    return st.badges ? (st.badges === 1 ? tr('דבר חדש') : tr('{badges} חדשים', { badges: st.badges })) : tr('{tiles} נוספים', { tiles: st.tiles });
  }

  private widget(f: Fav, ix: number, at?: FavCell<Fav>) {
    const w = favWidth(f, f.t === 'light' && !!this.findLight(f.id ?? '')?.sw);
    const ed = this.edit ? html`<div class="wg-ed"><span class="ed-n clamp1">${this.favLabel(f)}</span><span class="ed-b"><button class="rb" data-act="wgMove" data-ix=${ix} data-d="-1" aria-label="${tr('הזז אחורה')}">${hi('back')}</button>${f.t === 'light' && !this.findLight(f.id ?? '')?.sw ? html`<button class="rb" data-act="wgSize" data-ix=${ix} aria-label=${w === 2 ? tr('הקטן') : tr('הגדל, עם עמעום')}>${hi('size')}</button>` : nothing}<button class="rb" data-act="wgMove" data-ix=${ix} data-d="1" aria-label="${tr('הזז קדימה')}">${hi('fwd')}</button><button class="rb del" data-act="wgDel" data-ix=${ix} aria-label="${tr('הסר מהמועדפים')}">${hi('x')}</button></span></div>` : nothing;
    const cls = `tile wdg w${this.edit && this.phone ? 2 : w} h${favHeight(f)} wg-${f.t === 'switch' ? 'load' : f.t}${w === 1 ? ' s1' : ''}${this.edit ? ' editing' : ''}`;
    let body: unknown = nothing;
    if (f.t === 'scene') {
      const s = this.d.scenes.find((x) => x.id === f.id) as HScene;
      body = html`<button class="wg-btn scene${this.sceneRun === s.id ? ' run' : ''}" data-act="scene" data-scene=${s.id} aria-pressed=${String(this.activeScene() === s.id)}>${hi(s.icon)}<span class="sn clamp2">${s.name}</span></button>`;
    } else if (f.t === 'light') {
      const l = this.findLight(f.id ?? '') as HLight;
      const far = this.room !== l.room;
      body = w === 2
        ? html`<div class="lrow wl2${l.on ? ' is-on' : ''}">${this.lampBtn(l)}<span class="ln"><b class="clamp1">${l.name}</b>${far ? html`<span class="muted clamp1">${this.roomById(l.room)?.name ?? ''}</span>` : nothing}</span>${this.dimmer(l)}</div>`
        : html`<button class="wg-btn ltile${l.on ? ' is-on' : ''}" data-act="light" data-l=${l.id} aria-pressed=${String(l.on)}>${hi(l.sw ? 'switch' : 'bulb')}<span class="lt"><b class="clamp2">${l.name}</b></span><span class="lv num">${l.sw ? onWord(l.on) : l.on ? l.lvl + '%' : tr('כבוי')}</span></button>`;
    } else if (f.t === 'switch') {
      const x = this.findIn((r) => r.loads, f.id ?? '') as HLoad;
      body = html`<button class="wg-btn ltile ld${x.on ? ' is-on' : ''}" data-act="load" data-ld=${x.id} aria-pressed=${String(x.on)}>${hi(this.loadIcon(x))}<span class="lt"><b class="clamp2">${x.name}</b></span><span class="lv">${onWord(x.on)}</span></button>`;
    } else if (f.t === 'climate') {
      const z = this.findIn((r) => r.zones, f.id ?? '') as HZone;
      const off = z.mode === 'off';
      body = html`<a class="cover" href=${this.href('climate')} data-act="zoneGo" data-v=${z.id} aria-label=${tr('אקלים: ') + z.name}></a><div class="wg-c"><span class="wg-k clamp1">${hi('thermo')}${this.room === z.room ? tr('אקלים') : z.name}</span><b class="big num">${off || z.target == null ? '—' : z.target + '°'}</b><span class="muted">${off ? tr('כבוי') : html`${tr('עכשיו')} <span class="num">${z.temp ?? '—'}°</span>`}</span></div><div class="pm"><button class="rb" data-act="temp" data-zone=${z.id} data-d="-1" aria-label="${tr('קר יותר')}">${hi('down')}</button><button class="rb" data-act="temp" data-zone=${z.id} data-d="1" aria-label="${tr('חם יותר')}">${hi('up')}</button></div>`;
    } else if (f.t === 'cam') {
      const c = this.d.cameras.find((x) => x.id === f.id) as HCamera;
      body = html`<button class="wg-btn pic" data-act="cam" data-cam=${c.id} aria-label=${tr('מצלמה: ') + c.name}>${this.camPic(c, true)}</button>`;
    } else if (f.t === 'door') {
      const d = this.findIn((r) => r.doors, f.id ?? '') as HDoor;
      body = this.doorBody(d, false);
    } else if (f.t === 'shade') {
      const s = this.findIn((r) => r.shades, f.id ?? '') as HShade;
      body = html`<span class="dn"><b class="clamp1">${s.name}</b><span class="muted">${shadeText(s.pos, s.moving, s.state)}</span></span>${this.trio(s)}`;
    } else if (f.t === 'allLights') {
      const n = onCount(this.visRooms());
      body = html`<a class="cover" href=${this.href('lights')} aria-label="${tr('אורות')}"></a><div class="wg-c"><span class="wg-k">${hi('bulb', n ? 'lit' : '')}${tr('אורות בבית')}</span><b class="mid">${lightsText(n)}</b></div>${this.houseOffShown() ? html`<button class="hbtn" data-act="allOff" ?disabled=${!n}>${hi('power')}<span class="bt">${this.bName() ? offLabel(this.bName()) : tr('כבה הכל')}</span></button>` : nothing}`;
    } else {
      const t = (this.d.energy?.today ?? []).reduce((a, b) => a + b, 0);
      body = html`<a class="cover" href=${this.href('energy')} aria-label=${tr('חשמל היום: {v1} קוט״ש', { v1: t.toFixed(1) })}></a><div class="wg-c en1"><span class="wg-k">${hi('bolt')}${tr('חשמל היום')}</span><b class="mid num">${t.toFixed(1)}</b><span class="muted">${tr('קוט״ש')}</span></div>`;
    }
    return html`<div class=${cls} data-ft=${f.t} data-fid=${f.id ?? ''} data-ix=${at ? String(ix) : nothing} style=${at ? cellArea(at) : nothing}>${body}${ed}</div>`;
  }

  private doorBody(d: HDoor, withStar: boolean) {
    // HONEST-STATES-2540 (SCR-10): an offline / unknown lock draws neutral with the door icon and says so (doorState), never "פתוחה"
    const tone = doorTone(d);
    return html`<span class="di" data-tone=${tone}>${hi(!d.known ? 'door' : d.locked ? 'lock' : 'unlock')}</span><span class="dn"><b class="clamp2">${d.name}</b><span class="dst" data-tone=${tone} data-door-known=${d.known ? 'yes' : 'no'}><i class="dot"></i>${doorState(d)}</span></span>${(d.locked || d.wiskey) && d.noOpen ? html`<span class="dno clamp2" data-door-reason=${d.noOpen}>${doorNoOpenText(d.noOpen)}</span>` : d.locked || d.wiskey ? html`<button class="hbtn" data-act="doorAsk" data-door=${d.id} ?disabled=${!d.can}>${tr('פתח')}</button>` : html`<button class="hbtn" data-act="doorLock" data-door=${d.id} ?disabled=${!d.can}>${tr('נעל')}</button>`}${withStar ? this.star({ t: 'door', id: d.id }) : nothing}`;
  }

  private loadIcon(x: HLoad): string {
    return ({ boiler: 'drop', fridge: 'fridge', socket: 'plug', pump: 'pump', other: 'plug' } as const)[x.type];
  }

  sRoom() {
    const r = this.ctx();
    const w = this.world();
    const all = this.favs(this.room).filter((f) => favOk(f, w));
    // HOME-R32-ANSWERS-2438 (Q-HOME-1): a portrait tablet packs four tiles per row; a wide tile takes half the row there (a whole row on a phone)
    const cols = this.phone ? (this.tab4 ? 4 : 3) : 6;
    const rows = this.phone ? 5 : 3;
    const size = (f: Fav) => {
      const fw = favWidth(f, f.t === 'light' && !!this.findLight(f.id ?? '')?.sw);
      return { w: !this.phone ? fw : this.edit ? cols : fw === 2 ? (this.tab4 ? 2 : 3) : fw, h: favHeight(f) };
    };
    // HOME-FAVORITES-2500 (Q78): each tile in its own cell, in the person's order (no dense packing); a hole is "+ הוסף"
    const pages = layoutFavPages(all, size, cols, rows);
    const key = 'fav-' + this.room;
    const p = Math.min(this.pg(key), pages.length - 1);
    const ch = this.chips();
    return html`<nav class="chips3" style=${`--c:${ch.n <= 5 ? ch.n : 4}`} aria-label=${r ? tr('מה יש ב') + r.name : tr('מה יש בבית')}>${ch.t}</nav>
      <section class="favz" aria-label="${tr('מועדפים')}"><div class="bar"><h2 class="clamp2">${r ? tr('המועדפים שלי כאן') : greeting(this.userName, this.now)}</h2><div class="acts">${this.pager(key, pages.length)}<button class="hbtn" data-act="edit" aria-pressed=${String(this.edit)}>${hi(this.edit ? 'check' : 'edit')}<span class="bt">${this.edit ? tr('סיום') : tr('עריכה')}</span></button></div></div>
        <div class=${'wgrid' + (this.edit ? ' editing' : '')}>${pages[p].favs.length ? pages[p].cells.map((x) => (x.kind === 'fav' ? this.widget(x.item, x.ix, x) : favHole(this, x))) : this.empty('star', tr('עוד אין כאן מועדפים'), tr('פתחו אורות, סצנות או מצלמות ולחצו על הכוכב כדי להצמיד אותם לכאן.'))}</div></section>`;
  }

  // ---------------------------------------------------------------- rooms

  private roomTile(r: HRoom) {
    const on = r.lights.some((l) => l.on);
    const fav = this.favRooms().includes(r.id);
    return html`<div class="tile room" data-room=${r.id} data-cur=${this.room === r.id ? '1' : nothing}><a class="cover" href=${this.href('r/' + r.id)} aria-label=${r.name}></a><div class="rt"><b class="clamp1">${r.name}</b><span class="meta">${r.temp != null ? html`<span class="num">${r.temp}°</span> · ` : nothing}${roomLights(r)}</span></div>${this.roomsEdit ? html`<button class="lamp heart" data-act="favRoom" data-id=${r.id} aria-pressed=${String(fav)} aria-label=${fav ? tr('הסר מהחדרים המועדפים') : tr('הוסף לחדרים המועדפים')}>${hi('heart')}</button>` : r.lights.length ? html`<button class="lamp" data-act="roomLights" data-room=${r.id} aria-pressed=${String(on)} aria-label=${tr('האורות ב') + r.name}>${hi('bulb')}</button>` : nothing}</div>`;
  }

  private sRooms() {
    const acts = html`<button class="hbtn" data-act="roomsEdit" aria-pressed=${String(this.roomsEdit)}>${hi(this.roomsEdit ? 'check' : 'heart')}<span class="bt">${this.roomsEdit ? tr('סיום') : tr('חדרים מועדפים')}</span></button><a class="hbtn${this.room === 'home' ? ' cur' : ''}" href=${this.href('r/home')}>${hi('home')}<span class="bt">${tr('הבית שלי')}</span></a>`;
    const vis = this.visRooms();
    const fl0 = this.d.floors.filter((f) => vis.some((r) => r.floor === f.id));
    // MULTI-BUILDING-HOME-2500: under "כל הבניינים" the floor columns are grouped by building and each names its building
    const all = this.bld === ALL;
    const bs = this.d.buildings ?? [];
    const fl = all ? byBuilding(fl0, vis, bs) : fl0;
    const fName = (f: { id: string; name: string }) => { const b = all ? floorBuilding(f.id, vis, bs) : undefined; return b ? `${b.name} · ${f.name}` : f.name; };
    if (!vis.length) return html`${this.head(tr('לאיזה חדר?'), '', acts)}${this.empty('rooms', tr('עוד אין חדרים'), tr('כשיוגדרו חדרים בבית, הם יופיעו כאן לפי קומות.'))}`;
    if (this.phone) {
      const cur = fl.some((f) => f.id === this.floor) ? this.floor : fl[0]?.id ?? '';
      const pg = paged(vis.filter((r) => r.floor === cur), 6, this.pg('roomsP'));
      return html`${this.head(tr('לאיזה חדר?'), this.roomsEdit ? tr('סמנו בלב חדרים שתרצו לעבור ביניהם בהחלקה') : tr('{length} חדרים ב-{length2} קומות', { length: vis.length, length2: fl.length }), acts)}<div class="bar">${this.seg('floor', fl.map((f) => [f.id, f.short]), cur, tr('קומה'))}</div><div class="room-list">${pg.items.map((r) => this.roomTile(r))}</div>${this.pager('roomsP', pg.pages)}`;
    }
    return html`${this.head(tr('לאיזה חדר?'), this.roomsEdit ? tr('סמנו בלב חדרים שתרצו לעבור ביניהם בהחלקה או בחצים שלמעלה') : tr('כל הבית לפי קומות. הנורה מדליקה ומכבה את החדר בלי להיכנס אליו.'), acts)}<div class="floors-cols" style=${`--n:${fl.length}`}>${fl.map((f) => {
      const rs = vis.filter((r) => r.floor === f.id);
      const pg = paged(rs, 6, this.pg('fl-' + f.id));
      return html`<section class="fcol"><div class="fch"><h2 class=${all ? 'clamp1' : nothing} title=${all ? fName(f) : nothing}>${fName(f)}</h2><span class="muted">${lightsText(onCount(rs))}</span></div><div class="fcl">${pg.items.map((r) => this.roomTile(r))}</div>${this.pager('fl-' + f.id, pg.pages)}</section>`;
    })}</div>`;
  }

  // ---------------------------------------------------------------- lighting (lights + switches), climate, shades

  private sLights() {
    const rs = this.scopeRooms();
    const n = onCount(rs);
    const multi = rs.length > 1;
    const anyLoads = this.visRooms().some((r) => r.loads.length);
    const sceneList = this.lightScenes();
    const tab = this.lightsTab === 'loads' && !anyLoads ? 'lights' : this.lightsTab === 'scenes' && !sceneList.length ? 'lights' : this.lightsTab;
    const tabs = this.seg('lightsTab', [['lights', tr('אורות')], ...(anyLoads ? [['loads', tr('מפסקים')] as [string, string]] : []), ...(sceneList.length ? [['scenes', tr('סצנות')] as [string, string]] : [])], tab, tr('תצוגה'));
    if (tab === 'scenes') {
      const pg = paged(sceneList, this.phone ? 4 : 8, this.pg('lsc'));
      return html`${this.headT(tr('תאורה'), tr('סצנות ') + this.scopeWord(), tabs)}<div class="card-grid">${pg.items.map((s) => this.sceneCard(s, false))}</div>${this.pager('lsc', pg.pages)}`;
    }
    if (tab === 'loads') {
      let list = rs.flatMap((r) => r.loads);
      const on = list.filter((x) => x.on).length;
      if (this.only) list = list.filter((x) => x.on);
      const pg = paged(list, this.phone ? 4 : 8, this.pg('loads'));
      return html`${this.headT(on === 0 ? tr('כל המפסקים כבויים') : on === 1 ? tr('מפסק אחד דולק') : tr('{on} מפסקים דולקים', { on }), tr('מפסקים שאינם אור ') + this.scopeWord() + tr('. "כיבוי הכל" וכיבוי חדר לא נוגעים בהם.'), tabs)}
        <div class="bar wrap">${this.scopeSeg()}${this.onlySeg('only', this.only, tr('דולקים'))}</div>
        <div class="card-grid">${pg.items.length ? pg.items.map((x) => html`<div class="tile lcard sw${x.on ? ' is-on' : ''}" data-ft="switch" data-fid=${x.id}><button class="lamp ld" data-act="load" data-ld=${x.id} aria-pressed=${String(x.on)} ?disabled=${!x.ok} aria-label=${x.name}>${hi(this.loadIcon(x))}</button><span class="ln"><b class="clamp1">${x.name}</b><span class="muted clamp1">${x.guard ? tr('מוגן: שואל לפני כיבוי') : tr('לא נכבה ב"כיבוי הכל"')}${multi ? ' · ' + (this.roomById(x.room)?.name ?? '') : ''}</span></span><span class="swc"><span class="sw-t">${onWord(x.on)}</span><button class="hsw" role="switch" aria-checked=${String(x.on)} data-act="load" data-ld=${x.id} ?disabled=${!x.ok} aria-label=${x.name}><i></i></button></span>${this.star({ t: 'switch', id: x.id })}</div>`)
          : this.empty('plug', this.only ? tr('אין מפסק דולק ') + this.scopeWord() : tr('אין מפסקים ') + this.scopeWord(), tr('בחרו "כל הבית" או "הכל" כדי לראות עוד.'))}</div>${this.pager('loads', pg.pages)}`;
    }
    let list = rs.flatMap((r) => r.lights);
    if (this.only) list = list.filter((l) => l.on);
    const pg = paged(list, this.phone ? 3 : 8, this.pg('lights'));
    // MULTI-BUILDING-HOME-2500 (Q66): the house-wide "כבה הכל" names the building; under "כל הבניינים" it is not offered
    const house = !this.ctx() || this.scope === 'house';
    const offBtn = house && !this.houseOffShown() ? nothing : html`<button class="hbtn strong" data-act="scopeOff" ?disabled=${!n}>${hi('power')}<span class="bt">${house && this.bName() ? offLabel(this.bName()) : tr('כבה הכל')}</span></button>`;
    return html`${this.headT(lightsText(n), this.scopeWord(), tabs, offBtn)}
      <div class="bar wrap">${this.scopeSeg()}${this.onlySeg('only', this.only, tr('דולקים'))}</div>
      <div class="card-grid">${pg.items.length ? pg.items.map((l) => html`<div class="tile lcard lrow${l.sw ? ' sw' : ''}${l.on ? ' is-on' : ''}" data-ft="light" data-fid=${l.id}>${this.lampBtn(l)}<span class="ln"><b class="clamp1">${l.name}</b>${l.sw || multi || !l.ok ? html`<span class="muted clamp1">${[!l.ok ? tr('לא זמין כרגע') : '', l.sw ? tr('מפסק, בלי עמעום') : '', multi ? this.roomById(l.room)?.name ?? '' : ''].filter(Boolean).join(' · ')}</span>` : nothing}</span>${l.sw ? this.swCtl(l) : this.dimmer(l)}${this.star({ t: 'light', id: l.id })}</div>`)
        : this.empty('bulb', this.only ? tr('אין אור דולק ') + this.scopeWord() : tr('אין אורות ') + this.scopeWord(), this.only ? tr('בחרו "הכל" כדי לראות את כל האורות.') : tr('כשיחוברו אורות הם יופיעו כאן.'))}</div>${this.pager('lights', pg.pages)}`;
  }

  private lightScenes(): HScene[] {
    const r = this.ctx();
    const own = r ? this.d.scenes.filter((s) => s.rooms.includes(r.id)) : [];
    return [...own, ...homeScenes(this.world()).filter((s) => !own.includes(s))];
  }

  /** The scene shown as on: the one this person ran in this session, else the one the platform ran most recently today. */
  private activeScene(): string | null {
    if (this.lastScene && this.d.scenes.some((s) => s.id === this.lastScene)) return this.lastScene;
    const today = new Date().toDateString();
    const runs = this.d.scenes.filter((s) => s.lastRun && new Date(s.lastRun).toDateString() === today).sort((a, b) => Date.parse(b.lastRun ?? '') - Date.parse(a.lastRun ?? ''));
    return runs[0]?.id ?? null;
  }

  private sceneCard(s: HScene, big: boolean) {
    return html`<div class="tile lcard sc${big ? ' big' : ''}" data-ft="scene" data-fid=${s.id}><button class="lamp go${this.sceneRun === s.id ? ' run' : ''}" data-act="scene" data-scene=${s.id} aria-pressed=${String(this.activeScene() === s.id)} aria-label=${tr('הפעל: ') + s.name}>${hi(s.icon)}</button><span class="ln"><b class="clamp1">${s.name}</b><span class="muted clamp1">${s.does || (s.rooms.length === 1 ? tr('רק ב') + (this.roomById(s.rooms[0])?.name ?? tr('חדר אחד')) : tr('סצנה של הבית'))}</span></span>${this.star({ t: 'scene', id: s.id })}</div>`;
  }

  private dial(z: HZone) {
    const min = z.min, max = z.max, a0 = 135, sweep = 270, R = 118, cx = 150, cy = 150;
    const pt = (t: number) => { const a = (a0 + sweep * Math.max(0, Math.min(1, (t - min) / (max - min || 1)))) * Math.PI / 180; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; };
    const arc = (t0: number, t1: number) => { const [x0, y0] = pt(t0); const [x1, y1] = pt(t1); const large = (sweep * (t1 - t0) / (max - min || 1)) > 180 ? 1 : 0; return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${R} ${R} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
    const off = z.mode === 'off';
    const [nx, ny] = pt(z.temp ?? min);
    return html`<svg class="dial" viewBox="0 0 300 300" data-mode=${z.mode} role="img" aria-label=${tr('{v1}, עכשיו {v2} מעלות', { v1: off ? tr('המיזוג כבוי') : tr('מכוון ל-') + z.target + tr(' מעלות'), v2: z.temp ?? tr('לא ידוע') })}><path class="trk" d=${arc(min, max)}></path>${off || z.target == null ? nothing : svg`<path class="val" d=${arc(min, Math.max(min + 0.01, z.target))}></path>`}${z.temp != null ? svg`<circle class="now" cx=${nx.toFixed(1)} cy=${ny.toFixed(1)} r="7"></circle>` : nothing}</svg>`;
  }

  private sClimate() {
    const rs = this.scopeRooms();
    const zs = this.zonesOf(rs);
    const z = this.mainZone(rs);
    if (!z) return html`${this.head(tr('אקלים'), this.scopeWord(), this.scopeSeg())}${this.empty('thermo', tr('אין מיזוג ') + this.scopeWord(), this.ctx() ? tr('בחרו "כל הבית" כדי לראות את שאר המזגנים.') : tr('כשיחובר מזגן או תרמוסטט, אפשר יהיה לכוון אותו מכאן.'))}`;
    const pg = paged(zs, 4, this.pg('zones'));
    const off = z.mode === 'off';
    const stateTxt = !z.ok ? tr('לא זמין כרגע') : off ? tr('המיזוג כבוי') : z.temp == null || z.target == null ? MODES[z.mode] ?? '' : z.temp > z.target ? tr('מקרר עכשיו') : z.temp < z.target ? tr('מחמם עכשיו') : tr('נעים בדיוק');
    const presetBtns = (cls: string) => PRESETS.map(([n, t]) => html`<button class=${cls} data-act="preset" data-zone=${z.id} data-v=${t} aria-pressed=${String(!off && z.target === t)} ?disabled=${!z.can || t < z.min || t > z.max}><span>${n}</span>${cls === 'chip2' ? html`<span class="num">${t}°</span>` : html`<b class="num">${t}°</b>`}</button>`);
    const side = zs.length > 1 && !this.phone
      ? html`<section class="zone-list" aria-label="${tr('אזורים')}">${pg.items.map((x) => html`<button class="tile zrow" data-act="zone" data-v=${x.id} aria-pressed=${String(x.id === z.id)}><span class="zn clamp2">${x.name}</span><span class="zt"><b class="num">${x.mode === 'off' ? tr('כבוי') : (x.target ?? '—') + '°'}</b><span class="muted">${tr('עכשיו')} <span class="num">${x.temp ?? '—'}°</span></span></span></button>`)}${this.pager('zones', pg.pages)}</section>`
      : this.phone ? nothing : html`<section class="tile pane clim-side"><h2>${tr('מצבים מוכנים')}</h2>${presetBtns('hbtn wideb')}</section>`;
    const modes = Object.entries(MODES).filter(([m]) => m === 'off' || z.modes.includes(m)).filter(([m], i, a) => a.findIndex(([x]) => MODES[x] === MODES[m]) === i);
    return html`${this.head(tr('אקלים'), `${z.name} · ${stateTxt}`, html`${this.scopeSeg()}${this.phone && zs.length > 1 ? html`<button class="hbtn" data-act="zones"><span class="clamp1">${z.name}</span>${hi('down')}</button>` : nothing}`)}
      <div class="clim-body"><section class="tile thermo" aria-label=${z.name}>
        <div class="dial-wrap">${this.dial(z)}<div class="dial-c"><b class="huge num">${off || z.target == null ? '—' : z.target + '°'}</b><span class="muted">${tr('עכשיו')} <span class="num">${z.temp ?? '—'}°</span></span></div>
          <div class="dial-pm"><button class="rb xl" data-act="temp" data-zone=${z.id} data-d="-1" ?disabled=${!z.can} aria-label="${tr('קר יותר')}">${hi('down')}</button><button class="rb xl" data-act="temp" data-zone=${z.id} data-d="1" ?disabled=${!z.can} aria-label="${tr('חם יותר')}">${hi('up')}</button></div></div>
        ${zs.length > 1 || this.phone ? html`<div class="presets">${presetBtns('chip2')}</div>` : nothing}
        ${this.seg('modeSeg', modes as [string, string][], z.mode === 'heat_cool' ? 'auto' : z.mode, tr('מצב'))}</section>${side}</div>`;
  }

  private sShades() {
    const rs = this.scopeRooms();
    let list = rs.flatMap((r) => r.shades);
    const open = list.filter((s) => (s.pos ?? 0) > 0).length;
    if (this.shadesOnly) list = list.filter((s) => (s.pos ?? 0) > 0);
    const pg = paged(list, this.phone ? 4 : 8, this.pg('shades'));
    return html`${this.head(open === 0 ? tr('כל התריסים סגורים') : open === 1 ? tr('תריס אחד פתוח') : tr('{open} תריסים פתוחים', { open }), this.scopeWord(), html`<button class="hbtn" data-act="shadesAll" data-v="open">${hi('up')}<span class="bt">${tr('פתח הכל')}</span></button><button class="hbtn" data-act="shadesAll" data-v="close">${hi('down')}<span class="bt">${tr('סגור הכל')}</span></button>`)}
      <div class="bar wrap">${this.scopeSeg()}${this.onlySeg('shadesOnly', this.shadesOnly, tr('פתוחים'))}</div><div class="card-grid">${pg.items.length ? pg.items.map((s) => html`<div class="tile lcard sh" data-ft="shade" data-fid=${s.id}><span class="ln"><b class="clamp1">${s.name}</b><span class="muted clamp1">${this.armed?.startsWith(s.id + ':') ? tr('לחצו שוב לאישור') : shadeText(s.pos, s.moving, s.state)}${rs.length > 1 ? ' · ' + (this.roomById(s.room)?.name ?? '') : ''}</span></span>${this.trio(s)}${this.star({ t: 'shade', id: s.id })}</div>`)
        : this.empty('shade', this.shadesOnly ? tr('אין תריס פתוח ') + this.scopeWord() : tr('אין תריסים ') + this.scopeWord(), tr('בחרו "כל הבית" או "הכל" כדי לראות עוד.'))}</div>${this.pager('shades', pg.pages)}`;
  }

  // ---------------------------------------------------------------- doors, cameras, energy, alerts, scenes, active

  private sDoors() {
    const all = this.allDoors();
    const doors = this.doorsOnly ? all.filter(doorNotLocked) : all;
    const pgD = paged(doors, this.phone ? 3 : 4, this.pg('doors'));
    const pgV = paged(this.visitors, this.phone ? 2 : 4, this.pg('visitors'));
    const vis = (v: CallLogRow) => {
      // HOME-V3-AUDITFIX-2437 (audit items 12, 14): the call log's own words (no gendered slash), one line, the full text in the title
      const { text: result, tone } = callResult(v);
      return html`<div class="vrow"><span class="vp vp-ic">${hi('bell')}</span><span class="vn"><b class="clamp1">${tr('צלצול')}</b><span class="muted clamp1">${v.station_name}</span></span><span class="vr"><span class="num">${relTime(v.rang_at)}</span><span class="vres" data-tone=${tone} title=${result}>${result}</span></span></div>`;
    };
    return html`${this.head(this.phone ? tr('דלתות') : tr('דלתות ואינטרקום'), doorsText(all), html`${this.onlySeg('doorsOnly', this.doorsOnly, tr('לא נעולות'))}${this.talkTo ? html`<button class="hbtn" data-act="talk">${hi('phone')}<span class="bt">${tr('דבר עם הכניסה')}</span></button>` : nothing}`)}
      <div class="doors-body"><section class="door-list" aria-label="${tr('דלתות')}">${pgD.items.length ? pgD.items.map((d) => html`<div class="tile drow" data-ft="door" data-fid=${d.id}>${this.doorBody(d, true)}</div>`) : this.empty('door', this.doorsOnly && all.length ? tr('כל הדלתות נעולות') : tr('אין דלתות מחוברות'), this.doorsOnly && all.length ? tr('אין מה לנעול כרגע.') : tr('כשתחובר דלת או אינטרקום, אפשר יהיה לפתוח ולראות מי הגיע.'))}${this.pager('doors', pgD.pages)}</section>
      <section class="tile pane visitors" aria-label="${tr('מי הגיע')}"><div class="bar"><h2>${tr('מי הגיע')}</h2>${this.pager('visitors', pgV.pages)}</div>${pgV.items.length ? pgV.items.map(vis) : html`<p class="muted">${tr('עוד לא הגיע אף אחד היום.')}</p>`}</section></div>`;
  }

  private sCameras() {
    const r = this.ctx();
    const cams = r && this.scope === 'room' && r.cams.length ? this.d.cameras.filter((c) => r.cams.includes(c.id)) : this.d.cameras;
    const pg = paged(cams, this.phone ? 4 : 6, this.pg('cams'));
    const bad = cams.filter((c) => !c.ok).length;
    const rec = this.extFor('playback') && this.recOk() ? html`<a class="hbtn" href=${this.href('playback')} data-home-rec>${hi('film')}<span class="bt">${tr('הקלטות')}</span></a>` : nothing;
    return html`${this.head(tr('מצלמות'), !cams.length ? '' : bad === 0 ? (cams.length === 1 ? tr('המצלמה פועלת') : tr('כל המצלמות פועלות')) : bad === 1 ? tr('מצלמה אחת לא זמינה כרגע') : tr('{bad} מצלמות לא זמינות כרגע', { bad }), html`${r && r.cams.length ? this.seg('scope', [['room', tr('החדר הזה')], ['house', tr('כל הבית')]], this.scope === 'room' ? 'room' : 'house', tr('איפה')) : nothing}${this.pager('cams', pg.pages)}${cams.length ? rec : nothing}`)}
      ${cams.length ? html`<div class=${`cam-grid n${Math.min(pg.items.length, 6)}`}>${pg.items.map((c) => html`<div class="tile cam-t${c.ok ? '' : ' off'}"><button class="wg-btn pic" data-act="cam" data-cam=${c.id} aria-label=${c.name}>${this.camPic(c, false)}</button>${this.star({ t: 'cam', id: c.id })}</div>`)}</div>` : this.empty('cam', tr('אין מצלמות מחוברות'), tr('כשתחובר מצלמה, התמונה שלה תופיע כאן.'))}`;
  }

  private sEnergy() {
    const E = this.d.energy;
    if (!E || !E.today.length) return html`${this.head(tr('חשמל'), '')}${this.empty('bolt', tr('עוד אין נתוני חשמל'), tr('אחרי יום שימוש ראשון נראה כאן כמה חשמל הבית צורך.'))}`;
    const day = this.period === 'day';
    const rows: [string, number | null, number][] = day ? E.usual.map((u, h) => [String(h).padStart(2, '0') + ':00', E.today[h] == null ? null : E.today[h], u]) : E.week;
    const tot = rows.reduce((a, r) => a + (r[1] ?? 0), 0);
    const usualSame = rows.reduce((a, r) => a + (r[1] == null ? 0 : r[2]), 0);
    const diff = usualSame > 0 ? Math.round((tot - usualSame) / usualSame * 100) : 0;
    const max = Math.max(0.1, ...rows.map((r) => Math.max(r[1] ?? 0, r[2])));
    const step = max > 12 ? 5 : max > 4 ? 2 : max > 2 ? 1 : 0.5;
    const top = Math.ceil(max / step) * step;
    const ticks: number[] = [];
    for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);
    const br = E.byRoom;
    const brMax = Math.max(...br.map((b) => b[1]), 0.1);
    const weekday = new Intl.DateTimeFormat(uiLocale(), { weekday: 'long', timeZone: 'Asia/Jerusalem' }).format(this.now);
    return html`${this.head(html`${day ? tr('היום') : tr('השבוע')}: <span class="num">${num1(tot)}</span> ${tr('קוט״ש')}`, html`${usualSame > 0 ? (diff === 0 ? tr('כמו ביום רגיל') : ((w) => (w.pct ? html`<span class="num">${w.pct}</span> ${w.words}` : w.words))(diffWords(diff, day ? tr('מ{weekday} רגיל', { weekday }) : tr('משבוע רגיל')))) : ''}${this.price != null ? html` ${tr('· בערך')} <span class="num" data-energy-cost>₪${(tot * this.price).toFixed(2)}</span>` : nothing}`, html`${this.p3.energyActs()}${this.seg('period', [['day', tr('היום')], ['week', tr('השבוע')]], this.period, tr('תקופה'))}`)}
      <div class="en-body"><section class="tile pane chart" aria-label=${tr('צריכה לפי ') + (day ? tr('שעה') : tr('יום'))}><div class="bar"><h2>${day ? tr('לפי שעה') : tr('לפי יום')}</h2><div class="legend"><span><i class="k today"></i>${day ? tr('היום') : tr('השבוע')}</span><span><i class="k usual"></i>${day ? tr('יום רגיל') : tr('שבוע רגיל')}</span></div></div>
        <div class="plot" style=${`--n:${rows.length}`} @pointerover=${this.tipOver} @pointerleave=${this.tipOff} @focusin=${this.tipOver} @focusout=${this.tipOff}><div class="yax">${ticks.map((v) => html`<span style=${`bottom:${v / top * 100}%`}><em class="num">${v}</em></span>`)}</div>
          <div class="cols">${rows.map((r) => html`<div class=${'col' + (r[1] == null ? ' future' : '')} tabindex="0" data-tip=${`${r[0]}|${r[1] == null ? '' : r[1].toFixed(1)}|${r[2].toFixed(1)}`}>${r[1] == null ? nothing : html`<i class="b" style=${`height:${Math.max(1.5, r[1] / top * 100)}%`}></i>`}<i class="u" style=${`bottom:${r[2] / top * 100}%`}></i></div>`)}</div>
          <div class="xax">${rows.map((r, i) => html`<span>${day ? (i % 3 === 0 ? html`<em class="num">${r[0].slice(0, 2)}</em>` : nothing) : r[0]}</span>`)}</div><div class="tip" hidden></div></div><p class="unit muted">${tr('קוט״ש ל')}${day ? tr('שעה') : tr('יום')}</p></section>
      <section class="tile pane byroom" aria-label="${tr('מה צורך הכי הרבה')}"><h2>${tr('איפה צורכים הכי הרבה')}</h2>${br.slice(0, 5).map((b) => html`<div class="hb"><span class="hl clamp1" dir="auto" title=${b[2] ?? nothing}>${b[0]}${b[2] ? html` <small class="muted" data-also>· ${b[2]}</small>` : nothing}</span><span class="ht"><i style=${`transform:scaleX(${b[1] / brMax})`}></i></span><span class="hv"><span class="num">${num1(b[1])}</span> <small>${tr('קוט״ש')}</small></span></div>`)}<p class="unit muted">${tr('הצריכה היום')}</p></section></div>`;
  }

  private tipOver = (ev: Event) => {
    const col = (ev.composedPath() as HTMLElement[]).find((n) => n instanceof HTMLElement && n.classList?.contains('col'));
    const plot = ev.currentTarget as HTMLElement;
    const tip = plot.querySelector('.tip') as HTMLElement | null;
    if (!col || !tip) return;
    const [h, t, u] = (col.dataset.tip ?? '').split('|');
    tip.hidden = false;
    tip.textContent = '';
    const b = document.createElement('b'); b.textContent = h; tip.append(b);
    const s1 = document.createElement('span'); s1.textContent = t ? t + tr(' קוט״ש') : tr('עוד לא הגענו'); tip.append(s1);
    const s2 = document.createElement('span'); s2.textContent = u + tr(' ביום רגיל'); tip.append(s2);
    const pr = col.parentElement!.getBoundingClientRect();
    const cr = col.getBoundingClientRect();
    tip.style.left = Math.max(84, Math.min(pr.width - 84, cr.left + cr.width / 2 - pr.left)) + 'px';
    plot.querySelectorAll('.col').forEach((c) => c.classList.toggle('hot', c === col));
  };

  private tipOff = (ev: Event) => {
    const plot = ev.currentTarget as HTMLElement;
    const tip = plot.querySelector('.tip') as HTMLElement | null;
    if (tip) tip.hidden = true;
    plot.querySelectorAll('.col.hot').forEach((c) => c.classList.remove('hot'));
  };

  private sAlerts() {
    const open = this.d.alerts.filter((a) => a.open);
    const list = this.alertTab === 'open' ? open : this.d.alerts;
    const pg = paged(list, 4, this.pg('alerts'));
    const n = open.length;
    return html`${this.head(tr('התראות'), n === 0 ? tr('אין שום דבר שדורש טיפול') : n === 1 ? tr('דבר אחד מחכה לך') : tr('{n} דברים מחכים לך', { n }), html`${this.seg('alertTab', [['open', tr('מחכות לי')], ['all', tr('הכל')]], this.alertTab, tr('סינון'))}${gapAlertActs(this)}`)}
      <div class="alert-list">${pg.items.length ? pg.items.map((a) => html`<div class="tile arow${a.open ? '' : ' done'}" data-tone=${a.tone}><span class="ai">${hi(a.icon)}</span><span class="at"><b class="clamp2">${a.text}</b><span class="muted">${a.when}</span></span>${a.open && a.canAck ? html`<button class="hbtn" data-act="alertAck" data-id=${a.id}><span class="clamp1">${tr('הבנתי')}</span></button>` : a.open ? nothing : html`<span class="muted done-t">${hi('check')}${tr('טופל')}</span>`}</div>`) : this.empty('check', tr('הכל בסדר בבית'), tr('כשמשהו ידרוש את תשומת הלב שלך, הוא יופיע כאן.'))}</div>${this.pager('alerts', pg.pages)}`;
  }

  private sScenes() {
    const r = this.ctx();
    const list = r ? [...homeScenes(this.world()), ...this.d.scenes.filter((s) => s.rooms.length === 1 && s.rooms[0] === r.id)] : this.d.scenes;
    const pg = paged(list, this.phone ? 4 : 8, this.pg('scenes'));
    const canEdit = this.d.scenes.some((s) => s.canEdit);
    return html`${this.head(tr('סצנות'), r ? tr('של הבית ושל {name}. נגיעה מפעילה.', { name: r.name }) : tr('נגיעה אחת מפעילה כמה דברים יחד.'), html`${sceneScreenActs(this)}${canEdit ? html`<a class="hbtn" href=${this.href('settings/scenes')}>${hi('edit')}<span class="bt">${tr('עריכת סצנות')}</span></a>` : nothing}`)}
      <div class="card-grid">${pg.items.length ? pg.items.map((s) => this.sceneCard(s, true)) : this.empty('scenes', tr('עוד אין סצנות'), tr('מנהל הבית יכול להגדיר סצנות שמפעילות כמה דברים יחד.'))}</div>${this.pager('scenes', pg.pages)}`;
  }

  private sActive() {
    const list = activeRooms(this.visRooms());
    const kept = loadsOn(this.visRooms());
    const items: ({ r: HRoom } | { kept: HLoad[] })[] = [...list.map((r) => ({ r })), ...(kept.length ? [{ kept }] : [])];
    const pg = paged(items, this.phone ? 4 : 5, this.pg('active'));
    const n = onCount(this.visRooms());
    return html`${this.head(tr('פעיל עכשיו בבית'), list.length === 0 ? tr('כל האורות והמיזוג כבויים') : `${lightsText(n)} · ${list.length === 1 ? tr('חדר אחד פעיל') : list.length + tr(' חדרים פעילים')}`, this.houseOffShown() ? html`<button class="hbtn strong" data-act="houseOff" ?disabled=${!list.length}>${hi('power')}<span class="bt">${this.bName() ? offLabel(this.bName()) : tr('כיבוי כל הבית')}</span></button>` : nothing)}
      <div class="alert-list act">${pg.items.length ? pg.items.map((o) => 'kept' in o
        ? html`<div class="tile arow kept"><span class="ai">${hi('plug')}</span><span class="at"><b class="clamp1">${o.kept.length === 1 ? tr('מפסק אחד שאינו אור דולק') : o.kept.length + tr(' מפסקים שאינם אור דולקים')}</b><span class="muted clamp1">${o.kept.slice(0, 3).map((k) => k.name).join(', ')}${o.kept.length > 3 ? tr(' ועוד') : ''} ${tr('· לא נכבים ב"כיבוי כל הבית"')}</span></span><a class="hbtn" href=${this.href('lights')} data-act="goLoads">${hi('fwd')}<span class="bt">${tr('למפסקים')}</span></a></div>`
        : html`<div class="tile arow"><span class="ai" data-on="1">${hi('pulse')}</span><a class="at" href=${this.href('r/' + o.r.id)}><b class="clamp1">${o.r.name}</b><span class="muted">${activeText(o.r)} · ${floorName(this.d.floors, o.r.floor)}</span></a><button class="hbtn" data-act="roomOffId" data-room=${o.r.id}>${hi('power')}<span class="bt">${tr('כבה')}</span></button></div>`)
        : this.empty('night', tr('הכל כבוי בבית'), tr('כשיידלק אור או מזגן, החדר יופיע כאן.'))}</div>${this.pager('active', pg.pages)}`;
  }

  // ---------------------------------------------------------------- settings, welcome, the interface choice

  private faceChoice(cur: 'home' | 'full') {
    const canSwitch = !!this.pol()?.may_switch;
    return html`<div class="face-choice" role="radiogroup" aria-label="${tr('הממשק שלי')}">
      <button role="radio" aria-checked=${String(cur === 'home')} data-act="face" data-v="home" ?disabled=${!canSwitch}><span class="fc-pic home" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="fc-t"><b>${tr('ממשק ביתי')}</b><span>${tr('פשוט וגדול, לכל המשפחה')}</span></span>${hi('check', 'tick')}</button>
      <button role="radio" aria-checked=${String(cur === 'full')} data-act="face" data-v="full" ?disabled=${!canSwitch}><span class="fc-pic full" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span><span class="fc-t"><b>${tr('ממשק מלא')}</b><span>${tr('כל היכולות, למי שמנהל את הבית')}</span></span>${hi('check', 'tick')}</button>
    </div>${canSwitch ? nothing : html`<p class="lock-note">${hi('lock')}${tr('הממשק נקבע על ידי מנהל הבית.')}</p>`}`;
  }

  private sSettings(tab: string) {
    const wallOn = (this.pol()?.wallpaper ?? 'none') !== 'none';
    const t = ['favs', 'rooms', 'scenes', 'themes', 'view', ...(wallOn ? ['wall'] : [])].includes(tab) ? tab : 'favs';
    const r = this.ctx();
    const w = this.world();
    let body: unknown = nothing;
    if (t === 'favs') {
      const list = this.favs(this.room).filter((f) => favOk(f, w));
      const pg = paged(list.map((f, ix) => [f, ix] as [Fav, number]), this.phone ? 5 : 8, this.pg('setFavs'));
      body = html`<p class="hint">${tr('המועדפים של')} ${r ? r.name : tr('הבית שלי')}${tr('. מוסיפים בכוכב שליד כל אור, תריס, דלת, מצלמה או סצנה. אפשר לסדר גם במסך החדר עצמו, בכפתור "עריכה".')}</p><div class="set-list two">${pg.items.length ? pg.items.map(([f, ix]) => html`<div class="tile setrow"><span class="sname clamp1">${this.favLabel(f)}</span><span class="mv"><button class="rb" data-act="wgMove" data-ix=${ix} data-d="-1" ?disabled=${ix === 0} aria-label="${tr('הזז למעלה')}">${hi('up')}</button><button class="rb" data-act="wgMove" data-ix=${ix} data-d="1" ?disabled=${ix >= list.length - 1} aria-label="${tr('הזז למטה')}">${hi('down')}</button><button class="rb" data-act="wgDel" data-ix=${ix} aria-label="${tr('הסר')}">${hi('x')}</button></span></div>`) : this.empty('star', tr('עוד אין כאן מועדפים'), tr('לחצו על הכוכב שליד אור, תריס או מצלמה.'))}</div>${this.pager('setFavs', pg.pages)}`;
    } else if (t === 'rooms') {
      const fl = this.d.floors;
      const cur = fl.some((f) => f.id === this.floor) ? this.floor : fl[0]?.id ?? '';
      const hidden = new Set(this.prefs.layout.hidden_rooms ?? []);
      const pg = paged(this.d.rooms.filter((x) => x.floor === cur), this.phone ? 5 : 8, this.pg('setRooms'));
      body = html`<div class="bar wrap"><p class="hint">${tr('לב: חדר מועדף, עוברים אליו בהחלקה. מתג: האם החדר מופיע בכלל.')}</p>${this.seg('floor', fl.map((f) => [f.id, f.short]), cur, tr('קומה'))}</div><div class="set-list two">${pg.items.map((x) => html`<div class="tile setrow"><span class="sname clamp1">${x.name}</span><button class="lamp heart" data-act="favRoom" data-id=${x.id} aria-pressed=${String(this.favRooms().includes(x.id))} aria-label="${tr('חדר מועדף')}">${hi('heart')}</button>${this.sw(!hidden.has(x.id), 'roomVis', tr('הצג את ') + x.name, x.id)}</div>`)}</div>${this.pager('setRooms', pg.pages)}`;
    } else if (t === 'scenes') {
      const pg = paged(this.d.scenes, this.phone ? 4 : 6, this.pg('setScenes'));
      // HOME-FAVORITES-2500: Q75 the edit sheet for whoever holds scene.manage (home-scene-2500.ts), Q79 the personal switch of the suggestion
      body = html`<p class="hint">${tr('סצנה מפעילה כמה דברים בנגיעה אחת.')} ${this.d.scenes.some((s) => s.canEdit) ? tr('אפשר לשנות שם, לשמור את המצב של עכשיו או להעביר לסל.') : tr('רק מי שמחזיק הרשאת ניהול סצנות יכול לערוך אותן.')}</p>${sceneSuggestRow(this)}<div class="set-list two">${pg.items.map((s) => html`<div class="tile setrow">${hi(s.icon)}<span class="sname"><b>${s.name}</b><span class="muted clamp1">${s.does}</span></span>${sceneEditBtn(this, s)}</div>`)}</div>${this.pager('setScenes', pg.pages)}`;
    } else if (t === 'themes') {
      const curT = this.getAttribute('data-hs-theme') ?? 'classic';
      const scheme = this.getAttribute('data-hs-scheme') ?? 'dark';
      const list = this.phone ? paged(THEMES, 4, this.pg('themes')) : { items: THEMES, pages: 1 };
      body = html`<div class="bar wrap"><p class="hint">${tr('הצבעים של הממשק הביתי שלי. צבעי המצב (תקין, שים לב, אזעקה) נשארים זהים בכל ערכה.')}</p>${this.seg('theme', [['dark', tr('כהה')], ['light', tr('בהיר')]], scheme, tr('מראה'))}</div>
        <div class="theme-grid" role="radiogroup" aria-label="${tr('ערכת נושא')}">${list.items.map(([id, name, line, n]) => html`<button class="tile thm" role="radio" aria-checked=${String(id === curT)} data-act="hs" data-v=${id}><span class="thm-pv" data-hs-theme=${id} data-hs-scheme=${n === 1 ? 'dark' : scheme} aria-hidden="true"><i class="pv-a"></i><i class="pv-b"></i><i class="pv-c"></i><i class="pv-d"></i></span><span class="thm-t"><b>${name}</b><span class="muted clamp2">${line}</span></span>${hi('check', 'tick')}</button>`)}</div>${this.pager('themes', list.pages)}`;
    } else if (t === 'wall') {
      body = this.wallSettings();
    } else {
      const l = this.prefs.layout;
      const tn = THEMES.find((x) => x[0] === (this.getAttribute('data-hs-theme') ?? 'classic'))?.[1] ?? '';
      body = html`<div class="set-view"><section class="tile pane"><h2>${tr('הממשק שלי')}</h2>${this.faceChoice('home')}</section>
        <section class="tile pane"><h2>${tr('תצוגה')}</h2><div class="setrow flat"><span class="sname">${tr('מה נפתח ראשון')}</span>${this.seg('start', [['home', tr('הבית שלי')], ['last', tr('החדר האחרון')], ['fixed', tr('חדר קבוע')]], l.start ?? 'home', tr('מסך פתיחה'))}</div><div class="setrow flat"><span class="sname"><b>${tr('ערכת נושא')}</b><span class="muted">${tn}, ${this.getAttribute('data-hs-scheme') === 'light' ? tr('בהיר') : tr('כהה')}</span></span><a class="hbtn" href=${this.href('settings/themes')}>${hi('palette')}<span class="bt">${tr('החלפה')}</span></a></div><div class="setrow flat"><span class="sname"><b>${tr('כתב גדול')}</b><span class="muted">${tr('מגדיל גם את האריחים')}</span></span>${this.sw(!!l.big_text, 'bigText', tr('כתב גדול'))}</div><div class="setrow flat" data-set-motion><span class="sname"><b>${tr('מעבר בין מסכים')}</b><span class="muted clamp1">${l.motion === 'rise' ? tr('כל מסך עולה מלמטה') : tr('הופעה מהירה, בלי תזוזה')}</span></span>${this.seg('motion', [['fade', tr('מהיר')], ['rise', tr('עם תנועה')]], l.motion === 'rise' ? 'rise' : 'fade', tr('מעבר בין מסכים'))}</div></section></div>`;
    }
    return html`${this.headT(tr('הגדרות'), tr('המועדפים, החדרים והתצוגה שלי'), this.seg('setTab', [['favs', tr('מועדפים')], ['rooms', tr('חדרים')], ['scenes', tr('סצנות')], ['themes', this.phone ? tr('צבעים') : tr('ערכות נושא')], ...(wallOn ? [['wall', tr('רקע')] as [string, string]] : []), ['view', tr('תצוגה')]], t, tr('נושא')))}${body}`;
  }

  private sWelcome() {
    return html`<div class="welcome"><span class="mark big" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M6 24 16 7l10 17"></path><path d="M11 24h10"></path></svg></span><h1>${tr('שלום')} ${this.userName}${tr(', איך נוח לך לראות את הבית?')}</h1><p class="sub">${tr('אפשר להחליף בכל רגע מהתפריט האישי.')}</p>
      <div class="wl-choice" role="radiogroup" aria-label="${tr('בחירת ממשק')}">
        <button class="tile wl" role="radio" aria-checked=${String(this.welcomePick === 'home')} data-act="welcomePick" data-v="home"><span class="wl-pic home" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span><b>${tr('ממשק ביתי')}</b><span>${tr('חדר אחרי חדר: מה שיש בחדר, המועדפים שלך, וכיבוי בנגיעה. בלי מונחים טכניים. מתאים לכל המשפחה ולמסך על הקיר.')}</span>${hi('check', 'tick')}</button>
        <button class="tile wl" role="radio" aria-checked=${String(this.welcomePick === 'full')} data-act="welcomePick" data-v="full"><span class="wl-pic full" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><b>${tr('ממשק מלא')}</b><span>${tr('כל המסכים והיכולות: מפות, הקלטות, תזמונים, הרשאות והגדרות. מתאים למי שמנהל את הבית.')}</span>${hi('check', 'tick')}</button>
      </div><button class="hbtn strong wide" data-act="welcomeGo">${tr('המשך')}</button></div>`;
  }

  // ---------------------------------------------------------------- overlays

  /** HOME-V3-P1-2430: recordings are offered while the cameras category is on and the person may play recordings */
  recOk(): boolean {
    return this.d.modules.has('cameras') && this.d.modules.has('recordings') && this.d.cameras.length > 0 && canAnywhere('video.playback'); // HOME-V3-FOLLOWUP-A-2431: its own category
  }

  private ovlHtml(): unknown {
    const o = this.ovl;
    if (!o) return nothing;
    if (o.type === 'ext') return this.ext.find((m) => m.id === o.mod)?.ovl?.(o) ?? nothing;
    if (o.type === 'p3') return this.p3.ovl(o);
    if (o.type === 'cam') {
      const c = this.d.cameras.find((x) => x.id === o.id) ?? this.d.cameras[0];
      if (!c) return nothing;
      return html`<div class="hscrim solid"></div><section class="camfull" role="dialog" aria-modal="true" aria-label=${c.name}><div class="cf-pic">${c.ok ? html`<sw-camera-tile class="scene-pic" dark noDemo cameraId=${c.id} state="live" live profile="main" autoProfile poster=${snapshotUrl(c.id)}></sw-camera-tile>` : html`<div class="cam-off big">${hi('camoff')}<span>${tr('המצלמה לא זמינה כרגע')}</span><small>${tr('אנחנו מנסים להתחבר שוב. אין צורך לעשות דבר.')}</small></div>`}</div>
        <header class="cf-bar"><button class="rb onpic" data-act="close" aria-label="${tr('סגור')}">${hi('x')}</button><div class="cf-t"><b class="clamp1">${c.name}</b>${c.ok ? html`<span class="live onpic"><i class="dot"></i>${tr('חי')}</span>` : nothing}</div><span class="cf-nav"><button class="rb onpic" data-act="camStep" data-d="-1" aria-label="${tr('המצלמה הקודמת')}">${hi('back')}</button><button class="rb onpic" data-act="camStep" data-d="1" aria-label="${tr('המצלמה הבאה')}">${hi('fwd')}</button></span></header>${this.extFor('playback') && this.recOk() ? html`<footer class="cf-foot"><a class="hbtn onpic" href=${this.href('playback/' + encodeURIComponent(c.id))} data-act="closeNav" data-home-rec>${hi('film')}${tr('הקלטות של המצלמה')}</a></footer>` : nothing}</section>`;
    }
    if (o.type === 'confirm') {
      const d = this.findIn((r) => r.doors, o.door);
      if (!d) return nothing;
      return html`<div class="hscrim" data-act="close"></div><section class="sheet dialog" role="alertdialog" aria-modal="true" aria-label="${tr('אישור פתיחה')}"><span class="dlg-ic">${hi('unlock')}</span><h2>${tr('לפתוח את')} ${d.name}?</h2><p class="muted">${d.kind === 'gate' ? tr('השער ייסגר שוב מעצמו.') : tr('הדלת תינעל שוב מעצמה אחרי כמה שניות.')}</p><div class="dlg-acts"><button class="hbtn strong" data-act="doorOpen" data-door=${d.id}>${tr('כן, פתח')}</button><button class="hbtn" data-act="close">${tr('ביטול')}</button></div></section>`;
    }
    if (o.type === 'ask') {
      return html`<div class="hscrim" data-act="close"></div><section class="sheet dialog" role="alertdialog" aria-modal="true" aria-label=${o.title}><span class="dlg-ic">${hi('check')}</span><h2 class="clamp2">${o.title}</h2><p class="muted">${o.text}</p><div class="dlg-acts"><button class="hbtn strong" data-act="askYes">${o.yes}</button><button class="hbtn" data-act="close">${tr('ביטול')}</button></div></section>`;
    }
    if (o.type === 'guard') {
      const x = this.findIn((r) => r.loads, o.id);
      if (!x) return nothing;
      return html`<div class="hscrim" data-act="close"></div><section class="sheet dialog" role="alertdialog" aria-modal="true" aria-label="${tr('אישור כיבוי')}"><span class="dlg-ic">${hi(this.loadIcon(x))}</span><h2 class="clamp2">${tr('לכבות את')} ${x.name}?</h2><p class="muted">${tr('המפסק הזה מסומן כמוגן, כדי שלא יכבה בטעות.')}</p><div class="dlg-acts"><button class="hbtn strong" data-act="guardOff">${tr('כן, כבה')}</button><button class="hbtn" data-act="close">${tr('ביטול')}</button></div></section>`;
    }
    if (o.type === 'menu') {
      const scheme = this.getAttribute('data-hs-scheme');
      return html`<div class="hscrim clear" data-act="close"></div><section class="sheet umenu" role="dialog" aria-modal="true" aria-label="${tr('התפריט האישי')}"><header class="menu-h"><span class="av lg">${(this.userName || '?').slice(0, 1)}</span><span class="mh-t"><b class="clamp1">${this.userFull || this.userName}</b><span class="muted">${this.role}</span></span><button class="rb" data-act="close" aria-label="${tr('סגור')}">${hi('x')}</button></header>
        <h3>${tr('הממשק שלי')}</h3>${this.faceChoice('home')}
        <div class="menu-rows">${gapMenuRow(this)}<a class="mrow" href=${this.href('settings/favs')} data-act="closeNav">${hi('sliders')}<span>${tr('ההגדרות שלי')}</span>${hi('fwd')}</a>${accountMenuRow(this)}<button class="mrow" data-act="theme" data-v=${scheme === 'dark' ? 'light' : 'dark'}>${hi(scheme === 'dark' ? 'sun' : 'night')}<span>${scheme === 'dark' ? tr('מראה בהיר') : tr('מראה כהה')}</span></button>${switchUserMode() ? html`<button class="mrow" data-act="switchUser" data-home-switch-user>${hi('user')}<span>${tr('החלף משתמש')}</span>${hi('fwd')}</button>` : nothing}</div></section>`;
    }
    if (o.type === 'bld') { // MULTI-BUILDING-HOME-2500 (Q64 / Q65): the buildings (shared last), "כל הבניינים" only where offered
      const bs: [string, string][] = [...(this.d.buildings ?? []).map((b): [string, string] => [b.id, b.name]), ...(this.d.bAll ? [[ALL, tr('כל הבניינים')] as [string, string]] : [])];
      return html`<div class="hscrim" data-act="close"></div><section class="sheet bottom" role="dialog" aria-modal="true" aria-label="${tr('בחירת בניין')}"><span class="grab" aria-hidden="true"></span><h2>${tr('איזה בניין?')}</h2><div class="pick-list">${bs.map(([id, name]) => html`<button class="mrow" data-act="bld" data-v=${id} aria-pressed=${String(id === this.bld)}>${hi(id === ALL ? 'grid' : 'building')}<span class="clamp1">${name}</span><b class="num">${id === ALL ? '' : lightsText(onCount(offRooms(this.d.rooms, id)))}</b></button>`)}</div></section>`;
    }
    if (o.type === 'zones') {
      const zs = this.zonesOf(this.scopeRooms()).slice(0, 6);
      const cur = this.mainZone(this.scopeRooms());
      return html`<div class="hscrim" data-act="close"></div><section class="sheet bottom" role="dialog" aria-modal="true" aria-label="${tr('בחירת אזור')}"><span class="grab" aria-hidden="true"></span><h2>${tr('איזה חדר?')}</h2><div class="pick-list">${zs.map((z) => html`<button class="mrow" data-act="zone" data-v=${z.id} aria-pressed=${String(z.id === cur?.id)}><span class="clamp1">${z.name}</span><b class="num">${z.mode === 'off' ? tr('כבוי') : (z.target ?? '—') + '°'}</b></button>`)}</div></section>`;
    }
    if (o.type === 'hold') {
      const here = this.favs(this.room).some((x) => sameFav(x, o.f));
      const r = this.ctx();
      return html`<div class="hscrim" data-act="close"></div><section class="sheet dialog" role="dialog" aria-modal="true" aria-label="${tr('מועדפים')}"><span class="dlg-ic">${hi('star')}</span><h2 class="clamp2">${o.label}</h2><p class="muted">${tr('מועדף מופיע במסך החדר, בנגיעה אחת.')}</p><div class="pick-list wide"><button class="mrow" data-act="holdFav" data-k=${this.room}>${hi('star')}<span>${here ? tr('הסר מהמועדפים של ') : tr('הוסף למועדפים של ')}${r ? r.name : tr('הבית שלי')}</span></button>${r ? html`<button class="mrow" data-act="holdFav" data-k="home">${hi('home')}<span>${tr('הוסף ל"הבית שלי"')}</span></button>` : nothing}<button class="mrow" data-act="close">${hi('x')}<span>${tr('ביטול')}</span></button></div></section>`;
    }
    if (o.type === 'talk') {
      const s = this.talkTo;
      if (!s) return nothing;
      return html`<div class="hscrim solid"></div><section class="call" role="dialog" aria-modal="true" aria-label=${tr('דבר עם ') + s.name}><div class="call-video">${s.video ? html`<sw-camera-tile class="scene-pic" dark noDemo fit="cover" state="live" live .livePath=${s.video} profile="sub"></sw-camera-tile>` : html`<div class="cam-off big">${hi('camoff')}<span>${tr('אין תמונה מהכניסה הזו')}</span></div>`}</div>
        <div class="call-side"><p class="ring-line">${hi('phone')}${tr('שיחה יוצאת')}</p><h1>${tr('מדברים עם')} ${s.name}</h1><p class="sub">${tr('נגיעה פותחת את המיקרופון. השיחה נסגרת בנגיעה נוספת.')}</p><div class="call-acts"><wk-talk-button dial idleLabel="${tr('דבר עם הכניסה')}" .stationId=${s.id} .talk=${s.talk}></wk-talk-button><button class="hbtn xl" data-act="close">${tr('סגור')}</button></div></div></section>`;
    }
    if (o.type === 'code') {
      const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'go'];
      return html`<div class="hscrim" data-act="close"></div><section class="sheet dialog kiosk-pad" role="dialog" aria-modal="true" aria-label=${o.title}><span class="dlg-ic">${hi('shield')}</span><h2 class="clamp2">${o.title}</h2><p class="muted">${o.error || tr('הקלידו את הקוד.')}</p><p class="kp-dots num" aria-live="polite">${o.code.replace(/./g, '•') || ' '}</p><div class="kp-grid">${keys.map((k) => k === 'go' ? html`<button class="hbtn strong" data-act="codeGo" ?disabled=${!o.code}>${tr('אישור')}</button>` : k === 'del' ? html`<button class="hbtn" data-act="codeKey" data-k="del" aria-label="${tr('מחק')}">${hi('back')}</button>` : html`<button class="hbtn num" data-act="codeKey" data-k=${k}>${k}</button>`)}</div><div class="dlg-acts"><button class="hbtn" data-act="close">${tr('ביטול')}</button></div></section>`;
    }
    if (o.type === 'switchHost') {
      return html`<div class="hscrim" data-act="close"></div><section class="sheet dialog" role="alertdialog" aria-modal="true" aria-label="${tr('החלפת משתמש')}" data-home-switch-host><span class="dlg-ic">${hi('user')}</span><h2>${tr('החלפת משתמש')}</h2><p class="muted">${tr('הכניסה כאן היא של מערכת הבית. נפתח את דף החשבון שלה: שם יוצאים, והאדם הבא נכנס בשם שלו.')}</p><div class="dlg-acts"><button class="hbtn strong" data-act="switchHostGo">${tr('לדף החשבון')}</button><button class="hbtn" data-act="close">${tr('ביטול')}</button></div></section>`;
    }
    if (o.type === 'kiosk') {
      const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'go'];
      return html`<div class="hscrim" data-act="close"></div><section class="sheet dialog kiosk-pad" role="dialog" aria-modal="true" aria-label="${tr('יציאה ממסך הקיר')}"><span class="dlg-ic">${hi('lock')}</span><h2>${tr('קוד מנהל')}</h2><p class="muted">${o.error || tr('הקוד פותח את מסך הקיר לחמש דקות.')}</p><p class="kp-dots num" aria-live="polite">${o.code.replace(/./g, '•') || ' '}</p><div class="kp-grid">${keys.map((k) => k === 'go' ? html`<button class="hbtn strong" data-act="kioskGo" ?disabled=${o.code.length < 4}>${tr('אישור')}</button>` : k === 'del' ? html`<button class="hbtn" data-act="kioskKey" data-k="del" aria-label="${tr('מחק')}">${hi('back')}</button>` : html`<button class="hbtn num" data-act="kioskKey" data-k=${k}>${k}</button>`)}</div><div class="dlg-acts"><button class="hbtn" data-act="close">${tr('ביטול')}</button></div></section>`;
    }
    return nothing;
  }

  // ---------------------------------------------------------------- HOME-SIMPLE-2421: the room wallpaper

  /** The wallpaper of a room for this person ('g:<name>' / 'img'), or null: none, or the installation does not offer it. */
  private wallOf(room: string): string | null {
    const mode = this.pol()?.wallpaper ?? 'none';
    // HOME-V3-P1-2430 (owner 16b): the administrator's wallpaper for everyone; a personal one wins, except on a wall panel
    const shared = this.pol()?.room_wallpapers?.[room];
    if (mode !== 'none' && shared && (this.pol()?.kiosk || !this.prefs.layout.wallpapers?.[room])) return 'shared:' + shared;
    const v = this.prefs.layout.wallpapers?.[room];
    if (mode === 'none' || !v) return null;
    if (v === 'img') return mode === 'gallery_image' ? v : null;
    return GALLERY.some((g) => 'g:' + g.id === v) ? v : null;
  }

  private wallBg(room: string): string {
    const w = this.wallOf(room);
    if (w === 'shared:img') return `url("${apiUrl('home/room-wallpapers/' + encodeURIComponent(room) + '/image')}") center / cover no-repeat`;
    const v = w?.startsWith('shared:') ? w.slice(7) : w;
    if (v === 'img') return `url("${apiUrl('home/wallpaper/' + encodeURIComponent(room))}?v=${this.wallStamp}") center / cover no-repeat`;
    return galleryCss(v?.slice(2) ?? '');
  }

  private wallSettings() {
    const room = this.room;
    const r = this.ctx();
    const cur = this.prefs.layout.wallpapers?.[room] ?? '';
    const withImg = this.pol()?.wallpaper === 'gallery_image';
    const opts: [string, string, string][] = [['', tr('בלי רקע'), ''], ...GALLERY.map((g) => ['g:' + g.id, g.name, galleryCss(g.id)] as [string, string, string])];
    const pg = paged(opts, this.phone ? 6 : 9, this.pg('wall'));
    return html`<div class="bar wrap"><p class="hint">${tr('הרקע של')} ${r ? r.name : tr('הבית שלי')}${tr('. הוא מעומעם מאחורי הכפתורים, כדי שהכתב יישאר ברור.')}</p>${withImg ? html`<label class="hbtn" data-wall-upload>${hi('plus')}<span class="bt">${cur === 'img' ? tr('החלפת התמונה שלי') : tr('תמונה שלי')}</span><input type="file" accept="image/jpeg,image/png" hidden @change=${(e: Event) => this.uploadWall(e)}></label>${cur === 'img' ? html`<button class="hbtn" data-act="wallDel">${hi('x')}<span class="bt">${tr('הסרת התמונה')}</span></button>` : nothing}` : nothing}</div>
      <div class="wall-grid" role="radiogroup" aria-label="${tr('רקע לחדר')}">${pg.items.map(([id, name, bg]) => html`<button class="tile wall-opt" role="radio" aria-checked=${String(id === cur)} data-act="wall" data-v=${id} data-wall-opt=${id || 'none'}><span class="wall-pv" style=${bg ? `--hs-wall:${bg}` : nothing} aria-hidden="true"></span><b class="clamp1">${name}</b>${hi('check', 'tick')}</button>`)}</div>${this.pager('wall', pg.pages)}`;
  }

  a_wall(el: HTMLElement) {
    const v = el.dataset.v ?? '';
    this.saveLayout({ wallpapers: { ...(this.prefs.layout.wallpapers ?? {}), [this.room]: v } });
  }

  a_wallDel() {
    void api<Omit<HiWire.WallpaperRemoved, 'layout'> & { layout: HomeLayout }>(`home/wallpaper/${encodeURIComponent(this.room)}`, { method: 'DELETE' })
      .then((r) => { this.prefs = { ...this.prefs, layout: r.layout }; this.toast(tr('התמונה הוסרה')); })
      .catch((err) => this.toast(describeError(err)));
  }

  private uploadWall(e: Event) {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    if (!/^image\/(jpeg|png)$/.test(f.type)) return this.toast(tr('אפשר להעלות JPEG או PNG בלבד.'));
    if (f.size > 2_000_000) return this.toast(tr('התמונה גדולה מ-2 MB.'));
    const form = new FormData();
    form.append('file', f);
    void api<Omit<HiWire.WallpaperSaved, 'layout'> & { layout: HomeLayout }>(`home/wallpaper/${encodeURIComponent(this.room)}`, { method: 'PUT', body: form })
      .then((r) => { this.wallStamp = Date.now(); this.prefs = { ...this.prefs, layout: r.layout }; this.toast(tr('התמונה נשמרה כרקע')); })
      .catch((err) => this.toast(describeError(err)));
  }

  // ---------------------------------------------------------------- render

  render() {
    if (!this.data) {
      return html`<div class="hs v2 bare"><main class="hs-main">${this.error ? this.empty('x', tr('לא הצלחנו לטעון את הבית'), this.error) : html`<div class="empty loading" aria-busy="true">${hi('home')}<h2>${tr('טוענים את הבית…')}</h2></div>`}</main></div>`;
    }
    const r = this.route();
    const pol = this.pol();
    if (r.name === 'welcome') return html`<div class="app-root" @click=${this.onClick}><div class="hs bare"><main class="hs-main enter">${this.sWelcome()}</main></div>${this.toasts()}</div>`;
    let name = r.name;
    if (this.kioskLocked() && name === 'rooms') name = 'r';
    if (name === 'settings' && pol?.kiosk && this.kioskLocked()) name = 'r';
    const cur = name === 'r' ? (this.room === 'home' ? 'home' : '') : name;
    const extScreen = this.extFor(name);
    const screen = extScreen ? extScreen.render(name, r.arg) : name === 'r' ? this.sRoom() : name === 'rooms' ? this.sRooms() : name === 'lights' ? this.sLights() : name === 'climate' ? this.sClimate() : name === 'shades' ? this.sShades()
      : name === 'doors' ? this.sDoors() : name === 'cameras' ? this.sCameras() : name === 'energy' ? this.sEnergy() : name === 'alerts' ? this.sAlerts() : name === 'scenes' ? this.sScenes()
      : name === 'active' ? this.sActive() : this.sSettings(r.arg); // 'security' is the v3 alarm screen (home-alarm.ts)
    // HOME-R32-ANSWERS-2438 (owner Q-HOME-6 a): a screen change fades in place (opacity only); the rise stays where it explains
    // something - a screen opened from "עוד" - or everywhere when the person chose it in "הגדרות › תצוגה". Reduced motion: a fade.
    if (this.path !== this.lastRoute) {
      const rise = this.prefs.layout.motion === 'rise' || (this.lastName === 'more' && name !== 'more' && moreChild(name));
      this.enterCls = rise ? ' enter rise' : ' enter fade';
      this.lastName = name;
      this.lastRoute = this.path;
    }
    return html`<div class="app-root" @click=${this.onClick} @pointerover=${this.titleHint} @input=${this.onInput} @pointerdown=${this.onPointerDown} @pointermove=${this.onPointerMove} @pointerup=${this.onPointerUp} @pointercancel=${() => { window.clearTimeout(this.holdT); this.swipe = null; }}>
      <div class=${'hs v2' + (this.kioskLocked() ? ' kiosk' : '') + (name === 'r' && this.wallOf(this.room) ? ' walled' : '')} data-screen=${name} data-wall=${name === 'r' ? this.wallOf(this.room) ?? nothing : nothing} style=${name === 'r' && this.wallOf(this.room) ? `--hs-wall:${this.wallBg(this.room)}` : nothing}>${this.strip(name)}${this.nav(cur)}<main class=${'hs-main' + this.enterCls} id="main">${keyed(this.lastRoute, screen)}</main>${this.nowBar()}</div>
      <div class="ovl">${this.ovlHtml()}</div>${this.toasts()}
      <sw-home-call data-hs-theme=${this.getAttribute('data-hs-theme') ?? 'classic'} data-hs-scheme=${this.getAttribute('data-hs-scheme') ?? 'dark'} ?data-hs-big=${this.hasAttribute('data-hs-big')} @home-calls=${(e: CustomEvent<HomeCallsState>) => { this.calls = e.detail; this.wall.calls(e.detail.ringing, e.detail.waiting); }}></sw-home-call>${this.wall.render()}</div>`;
  }

  /** HOME-V3-AUDITFIX-2437 (audit item 28): a truncated line shows its full text on mouse hover. Measured only when the pointer reaches it
   * (no layout work per render); a title the screen set itself is never touched. */
  private titleHint = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const t = e.composedPath()[0];
    const el = t instanceof Element ? t.closest('.clamp1, .clamp2, .clamp3, .ellip, .c3-s, .vres') : null;
    if (!(el instanceof HTMLElement) || (el.title && !el.hasAttribute('data-auto-title'))) return;
    const cut = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
    const full = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (cut && full) { el.title = full; el.setAttribute('data-auto-title', ''); }
    else if (el.hasAttribute('data-auto-title')) { el.removeAttribute('title'); el.removeAttribute('data-auto-title'); }
  };

  private toasts() {
    const t = this.toastMsg;
    return html`<div class="toasts" aria-live="polite">${t ? html`<div class="toast2"><span>${t.text}</span>${t.undo ? html`<button data-act="undo">${tr('ביטול')}</button>` : nothing}</div>` : nothing}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-home': SwHome;
  }
}
