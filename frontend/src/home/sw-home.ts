// HOME-SIMPLE-2420: the home interface ("ממשק ביתי") - a second, simpler, room-centred interface next to the full one (owner request
// 2026-11-10; the approved round-25 mockup "home-simple-v2" is the spec: always inside a room, the room name is the room picker, a row of
// category icons, the person's favourites as widgets, and a fixed "now" bar with what is on and one tap to turn the room off).
// Real data only (home-api.ts), existing control paths only (home-actions.ts). Hebrew, RTL, no platform names or internal terms.
// No control screen scrolls: every list pages (home-logic.ts paged / packPages). Themes: data-hs-theme + data-hs-scheme on the host.
import { LitElement, html, nothing, svg, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { homeMockupStyles } from './home-styles';
import { homeExtraStyles } from './home-styles-extra';
import { hi } from './home-icons';
import {
  adaptOverview, getHomePrefs, getOverview, loadAlerts, loadCameras, loadEnergy, loadScenes, putHomePrefs, switchInterface,
  type Fav, type HAlert, type HCamera, type HDoor, type HLight, type HLoad, type HomeData, type HomeLayout, type HomePrefs, type HRoom,
  type HScene, type HShade, type HZone, type InterfacePolicy,
} from './home-api';
import {
  MODES, PRESETS, activeRooms, activeText, defaultFavs, doorState, doorsText, favHeight, favOk, favWidth, floorName, greeting, homeBarText,
  doorNoOpenText, homeScenes, keptNote, lightsText, loadsOn, masterLevel, onCount, onWord, packPages, paged, roomLights, sameFav, shadeText, zoneOn,
  type FavWorld,
} from './home-logic';
import * as act from './home-actions';
import { api, apiUrl, post, describeError } from '../api/client';
import { GALLERY, galleryCss, switchUserMode } from './home-wall';
import { notify } from '../api/notifications';
import { snapshotUrl } from '../api/media';
import { getCallLog, type CallLogRow } from '../api/intercom-calls';
import { subscribeHa } from '../api/ha';
import { relTime } from './home-api';
import { alarmPanels, panelAction, type AlarmAction, type AlarmPanel } from '../api/alarm';
import { canAnywhere } from '../api/session';
import { getIntercomOverview } from '../api/intercom';
import { getStationMedia, type StationMediaTalk } from '../api/station-media';
import { get } from '../api/client';
import { logout as arxLogout } from '../arx/auth';
import './sw-home-call';
import type { HomeCallsState, SwHomeCall } from './sw-home-call';
import '../components/wk-talk-button';
import '../components/sw-camera-tile';
// HOME-V3-P1-2430: the v3 screens register themselves (home-ext.ts); sw-home only wires the registry in
import { homeV3Styles } from './home-styles-v3';
import { buildScreens, type ExtOvl, type HomeScreen } from './home-ext';
import { moreChild, moreTiles } from './more-registry';
import './home-v3-p1';
// HOME-V3-P3-2432: phase 3 (media + systems) lives in its own files; these few hooks are the only edits here
import { P3, type P3Host, type P3Ovl } from './home-p3';
import { homeP3Styles } from './home-p3-styles';

export const THEMES: [string, string, string, 1 | 2][] = [
  ['classic', 'קלאסי', 'פחם חם וכחול. המראה שאושר.', 2], ['ocean', 'אוקיינוס', 'כחול ים עמוק ותכלת צלול.', 2], ['sand', 'חול', 'אבן חמה וחימר.', 2],
  ['plum', 'שזיף', 'חציל כהה ולילך רך.', 2], ['midnight', 'חצות', 'כחול כמעט שחור עם פליז. כהה בלבד.', 1], ['nordic', 'נורדי', 'אבן בהירה וכחול צפחה.', 2],
  ['pastel', 'פסטל', 'לבנדר רך ופטל, לטאבלט של הילדים.', 2],
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
  | ExtOvl
  | P3Ovl
  | null;

const NAV: [string, string, string, string][] = [['r/home', 'הבית שלי', 'home', 'home'], ['scenes', 'סצנות', 'scenes', 'scenes'], ['active', 'פעיל עכשיו', 'pulse', 'active'], ['more', 'עוד', 'grid', 'more'], ['alerts', 'התראות', 'bell', 'alerts'], ['settings/favs', 'הגדרות', 'sliders', 'settings']];
const SCREENS = ['r', 'rooms', 'lights', 'climate', 'shades', 'doors', 'cameras', 'energy', 'alerts', 'scenes', 'active', 'settings', 'welcome', 'security'];
const ARM_LABEL: Record<string, string> = { arm_home: 'דריכה בבית', arm_away: 'דריכה ביציאה', arm_night: 'דריכת לילה', arm_vacation: 'דריכה לחופשה', arm_custom_bypass: 'דריכה חלקית', disarm: 'ניטרול' };
const KIOSK_UNLOCK_MS = 5 * 60_000;
const HE_WEEKDAY = new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jerusalem' });
const HE_TIME = new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });

@customElement('sw-home')
export class SwHome extends LitElement {
  static styles = [homeMockupStyles, homeV3Styles, homeExtraStyles, homeP3Styles]; // HOME-V3-P3-2432 last: its rules refine the shared v3 ones

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
  @state() private scope: 'room' | 'floor' | 'house' = 'room';
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
  @state() page: Record<string, number> = {};
  @state() ovl: Ovl = null;
  @state() private wallStamp = 0;
  @state() private toastMsg: { text: string; undo: (() => void) | null } | null = null;
  @state() private armed: string | null = null;
  @state() private sceneRun: string | null = null;
  @state() phone = window.innerWidth <= 700;
  @state() now = new Date();
  @state() visitors: CallLogRow[] = [];
  @state() private kioskUntil = 0;
  @state() private welcomePick: 'home' | 'full' = 'home';
  @state() panels: AlarmPanel[] = [];
  @state() private calls: HomeCallsState = { ringing: 0, waiting: 0 };
  /** The entrance this person may talk to without a call (the station drawer's "dial", the same talk session) - null = not offered. */
  @state() talkTo: { id: string; name: string; talk: StationMediaTalk; video: string } | null = null;
  /** The last scene this person ran in this session (else the scene the platform ran last, from its own run record). */
  @state() private lastScene: string | null = (() => { try { return sessionStorage.getItem('home.lastScene'); } catch { return null; } })();
  /** The price per kWh of the installation's fixed tariff - only for a person who may already read the tariffs (no new permission). */
  @state() private price: number | null = null;

  private stopHa: (() => void) | null = null;
  private refreshT = 0;
  private toastT = 0;
  private armT = 0;
  private clockT = 0;
  private holdT = 0;
  private held = false;
  private swipe: { x: number; y: number } | null = null;
  private down = { x: 0, y: 0 };
  private saveT = 0;
  private lastRoute = '';
  /** HOME-V3-P1-2430: the registered v3 screens (home-ext.ts) */
  readonly ext: HomeScreen[] = buildScreens(this);
  /** shared scratch state of the v3 modules (each keeps its own key) */
  readonly extState: Record<string, unknown> = {};
  /** HOME-V3-P3-2432: media, announcements, bill, water, house systems, map (home-p3.ts). */
  readonly p3 = new P3(this as unknown as P3Host);

  // ---------------------------------------------------------------- lifecycle and data

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('resize', this.onResize);
    this.clockT = window.setInterval(() => { this.now = new Date(); }, 20_000);
    void this.load();
    this.stopHa = subscribeHa((m) => {
      if (m.type === 'entity_state_changed' || m.type === 'structure_changed') this.scheduleRefresh();
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('resize', this.onResize);
    window.clearInterval(this.clockT);
    this.stopHa?.();
  }

  private onResize = () => {
    const p = window.innerWidth <= 700;
    if (p !== this.phone) this.phone = p;
  };

  private scheduleRefresh(ms = 600) {
    window.clearTimeout(this.refreshT);
    this.refreshT = window.setTimeout(() => void this.loadOverview(), ms);
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
          mods.has('energy') ? loadEnergy() : Promise.resolve(null),
        ]);
        this.data = { ...this.data, scenes, alerts, energy };
        const rt = this.route();
        this.extFor(rt.name)?.enter?.(rt.name, rt.arg); // HOME-V3-P1-2430: a deep link into a v3 screen loads its data once the home is known
        if (mods.has('security') && canAnywhere('alarm.view')) void this.loadPanels();
        if (mods.has('doors') && canAnywhere('access.call')) void this.loadTalk();
        if (mods.has('energy') && (canAnywhere('energy.bills') || canAnywhere('energy.manage'))) void this.loadPrice();
        if (mods.has('doors')) void getCallLog(null, 8).then((p) => { this.visitors = p.calls; }).catch(() => undefined);
        void this.p3.load();
      }
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private async loadTalk() {
    try {
      const feed = await getIntercomOverview();
      for (const s of (feed as unknown as { stations?: { id: string; name: string; online: boolean }[] }).stations ?? []) {
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
      const r = await get<{ items: { kind: string; current: { price?: string | null } | null }[] }>('energy/tariffs');
      const fixed = r.items.find((x) => x.kind === 'fixed' && x.current?.price);
      const v = fixed ? parseFloat(String(fixed.current?.price)) : NaN;
      this.price = Number.isFinite(v) && v > 0 ? v : null;
    } catch {
      this.price = null;
    }
  }

  async loadPanels() {
    try {
      this.panels = (await alarmPanels()).panels;
    } catch {
      this.panels = [];
    }
  }

  private async loadOverview() {
    try {
      const [ov, cameras] = await Promise.all([getOverview(), this.data ? Promise.resolve(this.data.cameras) : loadCameras()]);
      const base = adaptOverview(ov, ov.modules.includes('cameras') ? cameras : []);
      this.data = { scenes: [], alerts: [], energy: null, ...(this.data ?? {}), ...base, cameras: ov.modules.includes('cameras') ? cameras : [] };
      if (!this.floor && base.floors[0]) this.floor = base.floors[0].id;
      this.error = '';
    } catch (err) {
      if (!this.data) this.error = describeError(err);
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
    if (pol?.kiosk && pol.kiosk_area_id && !this.path) this.room = pol.kiosk_area_id;
  }

  pol(): InterfacePolicy | null {
    return this.policy ?? this.data?.policy ?? null;
  }

  private saveLayout(patch: HomeLayout) {
    this.prefs = { ...this.prefs, layout: { ...this.prefs.layout, ...patch } };
    this.applyLayout();
    void putHomePrefs({ layout: patch }).catch((err) => this.toast(describeError(err)));
  }

  private saveFavs(key: string, list: Fav[]) {
    this.prefs = { ...this.prefs, favourites: { ...this.prefs.favourites, [key]: list } };
    window.clearTimeout(this.saveT);
    this.saveT = window.setTimeout(() => void putHomePrefs({ favourites: { [key]: list } }).catch((err) => this.toast(describeError(err))), 400);
  }

  // ---------------------------------------------------------------- routing

  protected willUpdate(changed: PropertyValues): void {
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

  private route(): { name: string; arg: string } {
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
    return { name: known ? name : 'r', arg: known ? arg : '' };
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

  private visRooms(): HRoom[] {
    const hidden = new Set(this.prefs.layout.hidden_rooms ?? []);
    return this.d.rooms.filter((r) => !hidden.has(r.id));
  }

  roomById(id: string): HRoom | undefined {
    return this.d.rooms.find((r) => r.id === id);
  }

  ctx(): HRoom | null {
    return this.room === 'home' ? null : this.roomById(this.room) ?? null;
  }

  private scopeRooms(): HRoom[] {
    const r = this.ctx();
    if (!r || this.scope === 'house') return this.visRooms();
    if (this.scope === 'floor') return this.visRooms().filter((x) => x.floor === r.floor);
    return [r];
  }

  private scopeWord(): string {
    const r = this.ctx();
    return !r || this.scope === 'house' ? 'בכל הבית' : this.scope === 'floor' ? 'ב' + floorName(this.d.floors, r.floor) : 'ב' + r.name;
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
      case 'scene': return 'סצנה: ' + name(this.d.scenes.find((s) => s.id === f.id));
      case 'light': return name(this.findLight(f.id ?? ''));
      case 'switch': return name(this.findIn((r) => r.loads, f.id ?? ''));
      case 'shade': return name(this.findIn((r) => r.shades, f.id ?? ''));
      case 'climate': { const z = this.findIn((r) => r.zones, f.id ?? ''); return 'מיזוג: ' + (z?.name ?? ''); }
      case 'cam': return 'מצלמה: ' + name(this.d.cameras.find((c) => c.id === f.id));
      case 'door': return name(this.findIn((r) => r.doors, f.id ?? ''));
      case 'allLights': return 'כל האורות';
      default: return 'חשמל היום';
    }
  }

  // ---------------------------------------------------------------- toasts and commands

  toast(text: string, undo: (() => void) | null = null) {
    this.toastMsg = { text, undo };
    window.clearTimeout(this.toastT);
    this.toastT = window.setTimeout(() => { this.toastMsg = null; }, 5200);
  }

  private async outcome(p: Promise<act.Outcome>, okText?: string) {
    const o = await p;
    if (!o.ok) this.toast(o.note || 'הפעולה לא הצליחה.');
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
      this.toastMsg = null;
      this.requestUpdate();
      this.scheduleRefresh(1200);
    };
  }

  private bulkScope(rs: HRoom[]): { kind: 'building' | 'area'; id: string } | null {
    if (rs.length === 1 && rs[0].canBulk) return { kind: 'area', id: rs[0].id };
    if (rs.length > 1 && rs.length === this.d.rooms.length && this.d.canBulk) return { kind: 'building', id: '*' };
    return null;
  }

  private offLights(rs: HRoom[], withClimate: boolean, label: string) {
    const n = onCount(rs);
    const snap = this.snapshotLights(rs);
    for (const r of rs) {
      r.lights.forEach((l) => { if (l.can) l.on = false; });
      if (withClimate) r.zones.forEach((z) => { if (z.can) z.mode = 'off'; });
    }
    this.requestUpdate();
    const tasks: Promise<act.Outcome>[] = [act.lightsOff(rs, this.bulkScope(rs))];
    if (withClimate) tasks.push(act.climateOff(this.zonesOf(rs)));
    void Promise.all(tasks).then((res) => {
      const bad = res.find((o) => !o.ok);
      if (bad) this.toast(bad.note || 'חלק מהכיבוי לא הצליח.');
      this.scheduleRefresh(900);
    });
    this.toast((label || (n === 1 ? 'האור כובה' : `${n} אורות כובו`)) + keptNote(rs), this.undoLights(snap));
  }

  // ---------------------------------------------------------------- events (one delegated handler, as the mockup)

  private onClick = (ev: Event) => {
    if (this.held) {
      this.held = false;
      ev.preventDefault();
      return;
    }
    const el = (ev.composedPath() as HTMLElement[]).find((n) => n instanceof HTMLElement && n.dataset && n.dataset.act) as HTMLElement | undefined;
    if (!el || (el as HTMLButtonElement).disabled) return;
    const act = el.dataset.act ?? '';
    const own = (this as unknown as Record<string, ((el: HTMLElement) => boolean | void) | undefined>)['a_' + act];
    const mod = own ? null : this.ext.find((m) => m.acts && act in m.acts);
    const fn = own ? own.bind(this) : mod?.acts?.[act];
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
          act.setLevel(l, l.lvl, (o) => { if (!o.ok) this.toast(o.note || 'העמעום לא הצליח.'); });
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
      act.setLevel(l, l.lvl, (o) => { if (!o.ok) { this.toast(o.note || 'העמעום לא הצליח.'); this.scheduleRefresh(200); } });
    }
  };

  private onPointerDown = (ev: PointerEvent) => {
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

  private onKey = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape' && this.ovl) this.ovl = null;
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
    if (!l || !l.can) return this.toast(l && !l.ok ? 'האור לא זמין כרגע.' : 'אין הרשאה להפעיל את האור הזה.');
    l.on = !l.on;
    this.requestUpdate();
    void this.outcome(l.sw ? act.setPower(l, l.on) : l.on ? new Promise((res) => act.setLevel(l, l.lvl || 100, res)) : act.setPower(l, false));
  }
  a_load(el: HTMLElement) {
    const x = this.findIn((r) => r.loads, el.dataset.ld ?? '');
    if (!x || !x.can) return this.toast('אין הרשאה להפעיל את המפסק הזה.');
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
    void this.outcome(act.setPower(x, false), 'כובה');
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
  a_allOff() { this.offLights(this.visRooms(), false, ''); }
  a_scopeOff() { this.offLights(this.scopeRooms(), false, ''); }
  a_roomOff() { const r = this.ctx(); this.offLights(r ? [r] : this.visRooms(), true, r ? `${r.name}: האורות והמיזוג כובו` : 'האורות והמיזוג בכל הבית כובו'); }
  a_roomOffId(el: HTMLElement) { const r = this.roomById(el.dataset.room ?? ''); if (r) this.offLights([r], true, `${r.name}: האורות והמיזוג כובו`); }
  a_houseOff() { this.offLights(this.visRooms(), true, 'האורות והמיזוג בכל הבית כובו'); }
  a_undo() { this.toastMsg?.undo?.(); }
  a_scene(el: HTMLElement) {
    const s = this.d.scenes.find((x) => x.id === el.dataset.scene);
    if (!s) return;
    const runIt = () => {
      this.sceneRun = s.id;
      window.setTimeout(() => { this.sceneRun = null; }, 620);
      this.lastScene = s.id;
      try { sessionStorage.setItem('home.lastScene', s.id); } catch { /* storage unavailable: this page only */ }
      void this.outcome(act.applyScene(s), `סצנת ${s.name} הופעלה`);
    };
    if (s.sensitive) this.ovl = { type: 'ask', title: `להפעיל את ${s.name}?`, text: 'הסצנה הזו משנה גם דברים רגישים.', yes: 'כן, הפעל', run: runIt };
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
    this.toast('הוסר מהמועדפים', () => { const back = this.favs(key).slice(); back.push(f); this.saveFavs(key, back); this.toastMsg = null; });
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
    if (i >= 0) { l.splice(i, 1); this.toast('הוסר מהמועדפים'); }
    else { if (f.t === 'light') f.w = this.findLight(f.id ?? '')?.sw ? 1 : 2; l.push(f); this.toast(`נוסף למועדפים של ${r ? r.name : 'הבית שלי'}`); }
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
    this.toast(k === 'home' ? 'נוסף ל"הבית שלי"' : 'המועדפים עודכנו');
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
    if (!z || !z.can) return this.toast('אין הרשאה לכוון את המזגן הזה.');
    const base = z.target ?? z.temp ?? 23;
    z.target = Math.max(z.min, Math.min(z.max, base + (+(el.dataset.d ?? 0)) * (z.step || 1)));
    if (z.mode === 'off') z.mode = z.modes.includes('cool') ? 'cool' : 'auto';
    this.requestUpdate();
    void this.outcome(act.setTarget(z, z.target));
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
    if (!s || !s.can) return this.toast('אין הרשאה להזיז את התריס הזה.');
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
    this.ovl = { type: 'ask', title: v === 'open' ? 'לפתוח את כל התריסים?' : 'לסגור את כל התריסים?', text: `${list.length === 1 ? 'תריס אחד' : list.length + ' תריסים'} ${this.scopeWord()}.`, yes: v === 'open' ? 'כן, פתח' : 'כן, סגור',
      run: () => { list.forEach((s) => { s.moving = true; void act.moveShade(s, v); }); this.toast(v === 'open' ? 'התריסים נפתחים' : 'התריסים נסגרים'); this.scheduleRefresh(1500); } };
  }
  a_doorAsk(el: HTMLElement) { this.ovl = { type: 'confirm', door: el.dataset.door ?? '' }; }
  a_doorOpen(el: HTMLElement) {
    const d = this.findIn((r) => r.doors, el.dataset.door ?? '');
    this.ovl = null;
    if (!d) return;
    void act.openDoor(d).then((o) => {
      if (!o.ok) this.toast(o.note || 'הדלת לא נפתחה.');
      else this.toast(`${d.name}: נשלחה פקודת פתיחה. ${d.kind === 'gate' ? 'השער ייסגר' : 'הדלת תינעל'} שוב מעצמ${d.kind === 'gate' ? 'ו' : 'ה'}.`);
      this.scheduleRefresh(1500);
    });
  }
  a_doorLock(el: HTMLElement) {
    const d = this.findIn((r) => r.doors, el.dataset.door ?? '');
    if (!d) return;
    void this.outcome(act.lockDoor(d), `${d.name} ננעלה`);
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
    void notify().ack(a.id).then(() => { a.open = false; a.tone = 'ok'; this.requestUpdate(); this.toast('טופל. תודה.'); }).catch((err) => this.toast(describeError(err)));
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
    if (prompt === 'unverifiable' || prompt === 'pin_missing') return this.toast(prompt === 'pin_missing' ? 'צריך קוד אישי לאזעקה. מגדירים אותו בממשק המלא.' : 'אי אפשר לאמת קוד לפעולה הזו מכאן.');
    const send = (code?: string) => {
      this.ovl = null;
      void panelAction(p.entity_id, action, { confirmed: true, code })
        .then(() => { this.toast(`${p.name}: ${ARM_LABEL[action]} נשלחה`); window.setTimeout(() => void this.loadPanels(), 1500); })
        .catch((err) => this.toast(describeError(err)));
    };
    if (prompt === 'pin' || prompt === 'panel') this.ovl = { type: 'code', title: `${ARM_LABEL[action]}: ${p.name}`, code: '', error: '', run: (c) => send(c) };
    else this.ovl = { type: 'ask', title: `${ARM_LABEL[action]}?`, text: p.name, yes: 'כן', run: () => send() };
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
      this.toast('מסך הקיר פתוח לחמש דקות.');
    }).catch((err) => { this.ovl = { type: 'kiosk', code: '', error: describeError(err) }; });
  }

  // ---------------------------------------------------------------- shared pieces

  pg(key: string): number {
    return this.page[key] ?? 0;
  }

  pager(key: string, pages: number): TemplateResult | typeof nothing {
    if (pages <= 1) return nothing;
    const p = Math.min(this.pg(key), pages - 1);
    return html`<div class="pager" role="group" aria-label="דפדוף"><button class="rb" data-act="page" data-key=${key} data-d="-1" ?disabled=${p === 0} aria-label="הקודם">${hi('back')}</button><span class="pg num" aria-live="polite">${p + 1} מתוך ${pages}</span><button class="rb" data-act="page" data-key=${key} data-d="1" ?disabled=${p >= pages - 1} aria-label="הבא">${hi('fwd')}</button></div>`;
  }

  seg(a: string, opts: [string, string][], cur: string, label: string) {
    return html`<div class="seg" role="group" aria-label=${label}>${opts.map(([v, t]) => html`<button data-act=${a} data-v=${v} aria-pressed=${String(v === cur)}>${t}</button>`)}</div>`;
  }

  private scopeSeg() {
    return this.ctx() ? this.seg('scope', [['room', 'החדר הזה'], ['floor', 'הקומה'], ['house', 'כל הבית']], this.scope, 'איפה') : nothing;
  }

  private onlySeg(a: string, cur: boolean, word: string) {
    return this.seg(a, [['0', 'הכל'], ['1', word]], cur ? '1' : '0', 'סינון');
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
    return html`<button class="rb star" data-act="star" data-ft=${f.t} data-fid=${f.id ?? ''} aria-pressed=${String(on)} aria-label=${on ? 'הסר מהמועדפים' : 'הוסף למועדפים'}>${hi('star')}</button>`;
  }

  private sw(on: boolean, a: string, label: string, id = '') {
    return html`<button class="hsw" role="switch" aria-checked=${String(on)} data-act=${a} data-id=${id} aria-label=${label}><i></i></button>`;
  }

  private dimmer(l: HLight) {
    const v = l.on ? l.lvl : 0;
    return html`<label class="dim${l.on && l.lvl >= 50 ? '' : ' lo'}"><span class="dim-fill" style=${`transform:scaleX(${v / 100})`}></span><span class="dim-edge" style=${`transform:translateX(${-v}%)`}><i></i></span><input type="range" min="1" max="100" .value=${String(l.lvl)} data-dim=${l.id} ?disabled=${!l.can} aria-label=${'עוצמת ' + l.name}><span class="dim-v num">${l.on ? l.lvl + '%' : 'כבוי'}</span></label>`;
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
      return html`<button class="rb${armed ? ' armed' : ''}" data-act="shade" data-id=${s.id} data-v=${v} ?disabled=${!s.can} aria-label=${armed ? label + ': לחצו שוב לאישור' : label}>${hi(icon)}</button>`;
    };
    return html`<div class="trio">${b('open', 'up', 'פתח')}${b('stop', 'stop', 'עצור')}${b('close', 'down', 'סגור')}</div>`;
  }

  camPic(c: HCamera, live: boolean) {
    return html`${c.ok ? html`<sw-camera-tile class="scene-pic" dark noDemo fit="cover" cameraId=${c.id} state="live" ?live=${live} profile="sub" autoProfile poster=${snapshotUrl(c.id)} .stillRefresh=${live ? 0 : 30}></sw-camera-tile>` : html`<div class="cam-off">${hi('camoff')}<span>המצלמה לא זמינה כרגע</span></div>`}<div class="cap"><span class="clamp1">${c.name}</span>${c.ok ? html`<span class="live"><i class="dot"></i>חי</span>` : nothing}</div>`;
  }

  // ---------------------------------------------------------------- shell

  private strip(name: string) {
    const doors = this.allDoors();
    const u = doors.filter((d) => !d.locked);
    const a = this.d.alerts.filter((x) => x.open).length;
    const r = this.ctx();
    const sub = name !== 'r';
    const locked = this.kioskLocked();
    const fr = this.favRooms();
    const at = fr.indexOf(this.room);
    const roomTitle = html`<span class="tb-t"><h1 class="clamp1">${r ? r.name : 'הבית שלי'}</h1><span class="tb-c clamp1">${r ? floorName(this.d.floors, r.floor) : this.userFull || this.userName}</span></span>`;
    return html`<header class="hs-strip">
      ${sub ? (this.extBack(name) ? html`<a class="tb-back" href=${this.href(this.extBack(name) as string)} aria-label="חזרה">${hi('back')}</a>` : html`<a class="tb-back" href=${this.href('r/' + this.room)} aria-label=${'חזרה אל ' + (r ? r.name : 'הבית שלי')}>${hi('back')}</a>`) : nothing}
      ${locked ? html`<span class="tb-room">${roomTitle}</span>` : html`<a class="tb-room" href=${this.href('rooms')} aria-label=${'החלפת חדר. עכשיו: ' + (r ? r.name : 'הבית שלי')}>${roomTitle}${hi('down')}</a>`}
      ${fr.length > 1 && !locked ? html`<div class="tb-fav" role="group" aria-label="חדרים מועדפים"><button class="rb" data-act="roomStep" data-d="-1" aria-label="החדר המועדף הקודם">${hi('back')}</button><span class="dots" aria-hidden="true">${fr.map((_, i) => html`<i class=${i === at ? 'on' : ''}></i>`)}</span><button class="rb" data-act="roomStep" data-d="1" aria-label="החדר המועדף הבא">${hi('fwd')}</button></div>` : nothing}
      <div class="hs-now"><span class="time num">${HE_TIME.format(this.now)}</span><span class="date">${HE_WEEKDAY.format(this.now)}</span>${this.d.weather && this.d.weather.t != null ? html`<span class="wx" title="מזג האוויר בחוץ">${hi('sun')}<span class="num">${this.d.weather.t}°</span><span class="wxt ellip">${this.d.weather.text}</span></span>` : nothing}</div>
      <div class="hs-status">
        ${this.calls.waiting ? html`<button class="st-pill call" data-act="ring">${hi('bell')}<span>מחכים בדלת</span></button>` : nothing}
        ${this.d.modules.has('doors') ? html`<a class="st-pill" href=${this.href('doors')} data-tone=${!doors.length ? 'neutral' : u.length ? 'warn' : 'ok'}><i class="dot"></i><span>${doorsText(doors)}</span></a>` : nothing}
        ${this.d.modules.has('alerts') ? html`<a class="st-btn" href=${this.href('alerts')} aria-label=${'התראות' + (a ? ': ' + a + ' דורשות טיפול' : '')}>${hi('bell')}${a ? html`<b class="count num">${a}</b>` : nothing}</a>` : nothing}
        <button class="st-me" data-act="menu" aria-haspopup="dialog" aria-label=${'התפריט של ' + this.userName}><span class="av">${(this.userName || '?').slice(0, 1)}</span></button>
      </div></header>`;
  }

  private nav(cur: string) {
    const items = NAV.filter(([, , , id]) => id !== 'alerts' || this.d.modules.has('alerts')).filter(([, , , id]) => id !== 'scenes' || this.d.modules.has('scenes')).filter(([, , , id]) => id !== 'more' || (!this.kioskLocked() && !!this.extFor('more') && moreTiles(this).length > 0));
    cur = this.extFor(cur)?.navCur?.(cur) ?? (moreChild(cur) ? 'more' : cur);
    return html`<nav class="hs-nav" aria-label="ניווט ראשי">${items.map(([h, label, icon, id]) => html`<a href=${this.href(h)} aria-current=${cur === id ? 'page' : nothing}>${hi(icon)}<span>${id === 'active' ? html`פעיל<span class="nv-x"> עכשיו</span>` : label}</span></a>`)}</nav>`;
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
    return html`<footer class="nowbar" aria-label=${r ? 'עכשיו ב' + r.name : 'עכשיו בבית'}><a class="nb-t" href=${this.href('active')}><span class="nb-k">${r ? 'עכשיו בחדר' : 'עכשיו בבית'}</span><b class="clamp1">${text}</b></a>
      ${!r && !this.phone ? html`<span class="nb-rooms">${activeRooms(this.visRooms()).slice(0, 3).map((x) => html`<a class="chip2" href=${this.href('r/' + x.id)}><span class="clamp1">${x.name}</span></a>`)}</span>` : nothing}
      ${m != null && r ? html`<span class="nb-ml">כל האורות</span><label class="dim master${m >= 50 ? '' : ' lo'}"><span class="dim-fill" style=${`transform:scaleX(${m / 100})`}></span><span class="dim-edge" style=${`transform:translateX(${-m}%);opacity:${m ? 1 : 0}`}><i></i></span><input type="range" min="0" max="100" .value=${String(m)} data-master=${r.id} aria-label=${'עוצמת כל האורות ב' + r.name}><span class="dim-v num">${m ? m + '%' : 'כבוי'}</span></label>` : nothing}
      <button class="hbtn nb-off" data-act="roomOff" ?disabled=${!any}>${hi('power')}<span class="bt">${r ? 'כיבוי החדר' : 'כיבוי כל הבית'}</span></button></footer>`;
  }

  // ---------------------------------------------------------------- the room screen

  private chips() {
    const r = this.ctx();
    const rs = r ? [r] : this.visRooms();
    const mods = this.d.modules;
    const out: [string, string, string, unknown, string, string?][] = [];
    const nL = rs.reduce((a, x) => a + x.lights.length + x.loads.length, 0);
    const on = onCount(rs);
    if (nL && mods.has('lights')) out.push(['lights', 'תאורה', 'bulb', on === 0 ? 'כבויים' : on === 1 ? 'אחד דולק' : on + ' דולקים', on > 0 ? 'lit' : '']);
    const zs = this.zonesOf(rs);
    if (zs.length && mods.has('climate')) out.push(['climate', 'אקלים', 'thermo', r ? (zs[0].mode === 'off' ? 'כבוי' : html`<span class="num">${zs[0].target ?? '—'}°</span>`) : `${zs.filter(zoneOn).length} פועלים`, '']);
    const sh = rs.flatMap((x) => x.shades);
    if (sh.length && mods.has('shades')) { const o = sh.filter((s) => (s.pos ?? 0) > 0).length; out.push(['shades', 'תריסים', 'shade', o === 0 ? 'סגורים' : o === 1 ? 'אחד פתוח' : o + ' פתוחים', '']); }
    const dh = rs.flatMap((x) => x.doors);
    if (dh.length && mods.has('doors')) { const u = dh.filter((d) => !d.locked).length; out.push(['doors', 'דלתות', u ? 'unlock' : 'lock', u ? (u === 1 ? 'אחת פתוחה' : u + ' פתוחות') : 'נעול', u ? 'warn' : 'ok']); }
    const cams = r ? this.d.cameras.filter((c) => r.cams.includes(c.id)) : this.d.cameras;
    if (cams.length && mods.has('cameras')) { const bad = cams.filter((c) => !c.ok).length; out.push(['cameras', 'מצלמות', 'cam', r ? (bad ? 'לא זמינה' : 'חי') : bad ? `${cams.length - bad} מתוך ${cams.length}` : cams.length + ' פועלות', '']); }
    if (!r && mods.has('doors') && this.visitors.length) out.push(['doors', 'אינטרקום', 'phone', `${this.visitors.length} ביקורים`, '', 'intercom']);
    if (!r && this.d.energy && this.d.energy.today.length && mods.has('energy')) out.push(['energy', 'חשמל', 'bolt', html`<span class="num">${this.d.energy.today.reduce((a, b) => a + b, 0).toFixed(1)}</span> קוט״ש`, '']);
    if (!r && this.panels.length && mods.has('security')) {
      const armed = this.panels.some((p) => p.state && p.state !== 'disarmed');
      const alarm = this.panels.some((p) => p.state === 'triggered');
      out.push(['security', 'אבטחה', 'shield', alarm ? 'אזעקה!' : armed ? 'דרוך' : 'לא דרוך', alarm ? 'warn' : armed ? 'ok' : '']);
    }
    const sc = r ? this.d.scenes.filter((s) => s.rooms.includes(r.id)) : this.d.scenes;
    if (mods.has('scenes') && this.d.scenes.length) out.push(['scenes', 'סצנות', 'scenes', r ? (sc.length ? sc.length + ' בחדר' : 'של הבית') : this.d.scenes.length + ' בבית', '']);
    out.push(...this.p3.roomChips(r)); // HOME-V3-P3-2432: "מדיה" when the room has a speaker or a screen
    const shown = out.slice(0, 8);
    // HOME-V3-P1-2430: the intercom chip opens the intercom screen when it is offered; "עוד" is the ninth category of the home screen
    const ic = shown.find((x) => x[5] === 'intercom');
    if (ic && this.extFor('intercom')) ic[0] = 'intercom';
    if (!r && this.extFor('more') && !this.kioskLocked() && moreTiles(this).length) shown.push(['more', 'עוד', 'grid', this.moreChipText(), '', 'more']);
    return { n: shown.length, t: shown.map(([h, label, icon, st, tone, key]) => html`<a class="chip3" href=${this.href(h)} data-cat=${key ?? h}>${hi(icon, tone === 'lit' ? 'lit' : '')}<span class="c3-t"><b>${label}</b><span class="c3-s" data-tone=${tone === 'ok' || tone === 'warn' ? tone : nothing}>${tone === 'ok' || tone === 'warn' ? html`<i class="dot"></i>` : nothing}<span>${st}</span></span></span></a>`) };
  }

  /** the "עוד" chip's line: how many new things wait in the hub, else how many capabilities it holds */
  private moreChipText(): string {
    const st = (this.extState.moreSummary as { tiles: number; badges: number } | undefined) ?? { tiles: moreTiles(this).length, badges: 0 };
    return st.badges ? (st.badges === 1 ? 'דבר חדש' : `${st.badges} חדשים`) : `${st.tiles} נוספים`;
  }

  private widget(f: Fav, ix: number) {
    const w = favWidth(f, f.t === 'light' && !!this.findLight(f.id ?? '')?.sw);
    const ed = this.edit ? html`<div class="wg-ed"><span class="ed-n clamp1">${this.favLabel(f)}</span><span class="ed-b"><button class="rb" data-act="wgMove" data-ix=${ix} data-d="-1" aria-label="הזז אחורה">${hi('back')}</button>${f.t === 'light' && !this.findLight(f.id ?? '')?.sw ? html`<button class="rb" data-act="wgSize" data-ix=${ix} aria-label=${w === 2 ? 'הקטן' : 'הגדל, עם עמעום'}>${hi('size')}</button>` : nothing}<button class="rb" data-act="wgMove" data-ix=${ix} data-d="1" aria-label="הזז קדימה">${hi('fwd')}</button><button class="rb del" data-act="wgDel" data-ix=${ix} aria-label="הסר מהמועדפים">${hi('x')}</button></span></div>` : nothing;
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
        : html`<button class="wg-btn ltile${l.on ? ' is-on' : ''}" data-act="light" data-l=${l.id} aria-pressed=${String(l.on)}>${hi(l.sw ? 'switch' : 'bulb')}<span class="lt"><b class="clamp2">${l.name}</b></span><span class="lv num">${l.sw ? onWord(l.on) : l.on ? l.lvl + '%' : 'כבוי'}</span></button>`;
    } else if (f.t === 'switch') {
      const x = this.findIn((r) => r.loads, f.id ?? '') as HLoad;
      body = html`<button class="wg-btn ltile ld${x.on ? ' is-on' : ''}" data-act="load" data-ld=${x.id} aria-pressed=${String(x.on)}>${hi(this.loadIcon(x))}<span class="lt"><b class="clamp2">${x.name}</b></span><span class="lv">${onWord(x.on)}</span></button>`;
    } else if (f.t === 'climate') {
      const z = this.findIn((r) => r.zones, f.id ?? '') as HZone;
      const off = z.mode === 'off';
      body = html`<a class="cover" href=${this.href('climate')} data-act="zoneGo" data-v=${z.id} aria-label=${'אקלים: ' + z.name}></a><div class="wg-c"><span class="wg-k clamp1">${hi('thermo')}${this.room === z.room ? 'אקלים' : z.name}</span><b class="big num">${off || z.target == null ? '—' : z.target + '°'}</b><span class="muted">${off ? 'כבוי' : html`עכשיו <span class="num">${z.temp ?? '—'}°</span>`}</span></div><div class="pm"><button class="rb" data-act="temp" data-zone=${z.id} data-d="-1" aria-label="קר יותר">${hi('down')}</button><button class="rb" data-act="temp" data-zone=${z.id} data-d="1" aria-label="חם יותר">${hi('up')}</button></div>`;
    } else if (f.t === 'cam') {
      const c = this.d.cameras.find((x) => x.id === f.id) as HCamera;
      body = html`<button class="wg-btn pic" data-act="cam" data-cam=${c.id} aria-label=${'מצלמה: ' + c.name}>${this.camPic(c, true)}</button>`;
    } else if (f.t === 'door') {
      const d = this.findIn((r) => r.doors, f.id ?? '') as HDoor;
      body = this.doorBody(d, false);
    } else if (f.t === 'shade') {
      const s = this.findIn((r) => r.shades, f.id ?? '') as HShade;
      body = html`<span class="dn"><b class="clamp1">${s.name}</b><span class="muted">${shadeText(s.pos, s.moving, s.state)}</span></span>${this.trio(s)}`;
    } else if (f.t === 'allLights') {
      const n = onCount(this.visRooms());
      body = html`<a class="cover" href=${this.href('lights')} aria-label="אורות"></a><div class="wg-c"><span class="wg-k">${hi('bulb', n ? 'lit' : '')}אורות בבית</span><b class="mid">${lightsText(n)}</b></div><button class="hbtn" data-act="allOff" ?disabled=${!n}>${hi('power')}<span class="bt">כבה הכל</span></button>`;
    } else {
      const t = (this.d.energy?.today ?? []).reduce((a, b) => a + b, 0);
      body = html`<a class="cover" href=${this.href('energy')} aria-label=${`חשמל היום: ${t.toFixed(1)} קוט״ש`}></a><div class="wg-c en1"><span class="wg-k">${hi('bolt')}חשמל היום</span><b class="mid num">${t.toFixed(1)}</b><span class="muted">קוט״ש</span></div>`;
    }
    return html`<div class=${cls} data-ft=${f.t} data-fid=${f.id ?? ''}>${body}${ed}</div>`;
  }

  private doorBody(d: HDoor, withStar: boolean) {
    return html`<span class="di" data-tone=${d.locked ? 'ok' : 'warn'}>${hi(d.locked ? 'lock' : 'unlock')}</span><span class="dn"><b class="clamp2">${d.name}</b><span class="dst" data-tone=${d.locked ? 'ok' : 'warn'}><i class="dot"></i>${d.ok ? doorState(d) : 'לא זמינה כרגע'}</span></span>${(d.locked || d.wiskey) && d.noOpen ? html`<span class="dno clamp2" data-door-reason=${d.noOpen}>${doorNoOpenText(d.noOpen)}</span>` : d.locked || d.wiskey ? html`<button class="hbtn" data-act="doorAsk" data-door=${d.id} ?disabled=${!d.can}>פתח</button>` : html`<button class="hbtn" data-act="doorLock" data-door=${d.id} ?disabled=${!d.can}>נעל</button>`}${withStar ? this.star({ t: 'door', id: d.id }) : nothing}`;
  }

  private loadIcon(x: HLoad): string {
    return ({ boiler: 'drop', fridge: 'fridge', socket: 'plug', pump: 'pump', other: 'plug' } as const)[x.type];
  }

  private sRoom() {
    const r = this.ctx();
    const w = this.world();
    const all = this.favs(this.room).filter((f) => favOk(f, w));
    const cols = this.phone ? 3 : 6;
    const rows = this.phone ? 5 : 3;
    const area = (x: [Fav, number]) => {
      const f = x[0];
      const fw = favWidth(f, f.t === 'light' && !!this.findLight(f.id ?? '')?.sw);
      return (this.phone && (fw === 2 || this.edit) ? 3 : fw) * favHeight(f);
    };
    const pages = packPages(all.map((f, i) => [f, i] as [Fav, number]), area, cols, rows);
    const key = 'fav-' + this.room;
    const p = Math.min(this.pg(key), pages.length - 1);
    const ch = this.chips();
    return html`<nav class="chips3" style=${`--c:${ch.n <= 5 ? ch.n : 4}`} aria-label=${r ? 'מה יש ב' + r.name : 'מה יש בבית'}>${ch.t}</nav>
      <section class="favz" aria-label="מועדפים"><div class="bar"><h2>${r ? 'המועדפים שלי כאן' : greeting(this.userName, this.now)}</h2><div class="acts">${this.pager(key, pages.length)}<button class="hbtn" data-act="edit" aria-pressed=${String(this.edit)}>${hi(this.edit ? 'check' : 'edit')}<span class="bt">${this.edit ? 'סיום' : 'עריכה'}</span></button></div></div>
        <div class="wgrid">${pages[p].length ? pages[p].map(([f, ix]) => this.widget(f, ix)) : this.empty('star', 'עוד אין כאן מועדפים', 'פתחו אורות, סצנות או מצלמות ולחצו על הכוכב כדי להצמיד אותם לכאן.')}</div></section>`;
  }

  // ---------------------------------------------------------------- rooms

  private roomTile(r: HRoom) {
    const on = r.lights.some((l) => l.on);
    const fav = this.favRooms().includes(r.id);
    return html`<div class="tile room" data-room=${r.id} data-cur=${this.room === r.id ? '1' : nothing}><a class="cover" href=${this.href('r/' + r.id)} aria-label=${r.name}></a><div class="rt"><b class="clamp1">${r.name}</b><span class="meta">${r.temp != null ? html`<span class="num">${r.temp}°</span> · ` : nothing}${roomLights(r)}</span></div>${this.roomsEdit ? html`<button class="lamp heart" data-act="favRoom" data-id=${r.id} aria-pressed=${String(fav)} aria-label=${fav ? 'הסר מהחדרים המועדפים' : 'הוסף לחדרים המועדפים'}>${hi('heart')}</button>` : r.lights.length ? html`<button class="lamp" data-act="roomLights" data-room=${r.id} aria-pressed=${String(on)} aria-label=${'האורות ב' + r.name}>${hi('bulb')}</button>` : nothing}</div>`;
  }

  private sRooms() {
    const acts = html`<button class="hbtn" data-act="roomsEdit" aria-pressed=${String(this.roomsEdit)}>${hi(this.roomsEdit ? 'check' : 'heart')}<span class="bt">${this.roomsEdit ? 'סיום' : 'חדרים מועדפים'}</span></button><a class="hbtn${this.room === 'home' ? ' cur' : ''}" href=${this.href('r/home')}>${hi('home')}<span class="bt">הבית שלי</span></a>`;
    const vis = this.visRooms();
    const fl = this.d.floors.filter((f) => vis.some((r) => r.floor === f.id));
    if (!vis.length) return html`${this.head('לאיזה חדר?', '', acts)}${this.empty('rooms', 'עוד אין חדרים', 'כשיוגדרו חדרים בבית, הם יופיעו כאן לפי קומות.')}`;
    if (this.phone) {
      const cur = fl.some((f) => f.id === this.floor) ? this.floor : fl[0]?.id ?? '';
      const pg = paged(vis.filter((r) => r.floor === cur), 6, this.pg('roomsP'));
      return html`${this.head('לאיזה חדר?', this.roomsEdit ? 'סמנו בלב חדרים שתרצו לעבור ביניהם בהחלקה' : `${vis.length} חדרים ב-${fl.length} קומות`, acts)}<div class="bar">${this.seg('floor', fl.map((f) => [f.id, f.short]), cur, 'קומה')}</div><div class="room-list">${pg.items.map((r) => this.roomTile(r))}</div>${this.pager('roomsP', pg.pages)}`;
    }
    return html`${this.head('לאיזה חדר?', this.roomsEdit ? 'סמנו בלב חדרים שתרצו לעבור ביניהם בהחלקה או בחצים שלמעלה' : 'כל הבית לפי קומות. הנורה מדליקה ומכבה את החדר בלי להיכנס אליו.', acts)}<div class="floors-cols" style=${`--n:${fl.length}`}>${fl.map((f) => {
      const rs = vis.filter((r) => r.floor === f.id);
      const pg = paged(rs, 6, this.pg('fl-' + f.id));
      return html`<section class="fcol"><div class="fch"><h2>${f.name}</h2><span class="muted">${lightsText(onCount(rs))}</span></div><div class="fcl">${pg.items.map((r) => this.roomTile(r))}</div>${this.pager('fl-' + f.id, pg.pages)}</section>`;
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
    const tabs = this.seg('lightsTab', [['lights', 'אורות'], ...(anyLoads ? [['loads', 'מפסקים'] as [string, string]] : []), ...(sceneList.length ? [['scenes', 'סצנות'] as [string, string]] : [])], tab, 'תצוגה');
    if (tab === 'scenes') {
      const pg = paged(sceneList, this.phone ? 4 : 8, this.pg('lsc'));
      return html`${this.headT('תאורה', 'סצנות ' + this.scopeWord(), tabs)}<div class="card-grid">${pg.items.map((s) => this.sceneCard(s, false))}</div>${this.pager('lsc', pg.pages)}`;
    }
    if (tab === 'loads') {
      let list = rs.flatMap((r) => r.loads);
      const on = list.filter((x) => x.on).length;
      if (this.only) list = list.filter((x) => x.on);
      const pg = paged(list, this.phone ? 4 : 8, this.pg('loads'));
      return html`${this.headT(on === 0 ? 'כל המפסקים כבויים' : on === 1 ? 'מפסק אחד דולק' : `${on} מפסקים דולקים`, 'מפסקים שאינם אור ' + this.scopeWord() + '. "כיבוי הכל" וכיבוי חדר לא נוגעים בהם.', tabs)}
        <div class="bar wrap">${this.scopeSeg()}${this.onlySeg('only', this.only, 'דולקים')}</div>
        <div class="card-grid">${pg.items.length ? pg.items.map((x) => html`<div class="tile lcard sw${x.on ? ' is-on' : ''}" data-ft="switch" data-fid=${x.id}><button class="lamp ld" data-act="load" data-ld=${x.id} aria-pressed=${String(x.on)} ?disabled=${!x.ok} aria-label=${x.name}>${hi(this.loadIcon(x))}</button><span class="ln"><b class="clamp1">${x.name}</b><span class="muted clamp1">${x.guard ? 'מוגן: שואל לפני כיבוי' : 'לא נכבה ב"כיבוי הכל"'}${multi ? ' · ' + (this.roomById(x.room)?.name ?? '') : ''}</span></span><span class="swc"><span class="sw-t">${onWord(x.on)}</span><button class="hsw" role="switch" aria-checked=${String(x.on)} data-act="load" data-ld=${x.id} ?disabled=${!x.ok} aria-label=${x.name}><i></i></button></span>${this.star({ t: 'switch', id: x.id })}</div>`)
          : this.empty('plug', this.only ? 'אין מפסק דולק ' + this.scopeWord() : 'אין מפסקים ' + this.scopeWord(), 'בחרו "כל הבית" או "הכל" כדי לראות עוד.')}</div>${this.pager('loads', pg.pages)}`;
    }
    let list = rs.flatMap((r) => r.lights);
    if (this.only) list = list.filter((l) => l.on);
    const pg = paged(list, this.phone ? 3 : 8, this.pg('lights'));
    return html`${this.headT(lightsText(n), this.scopeWord(), tabs, html`<button class="hbtn strong" data-act="scopeOff" ?disabled=${!n}>${hi('power')}<span class="bt">כבה הכל</span></button>`)}
      <div class="bar wrap">${this.scopeSeg()}${this.onlySeg('only', this.only, 'דולקים')}</div>
      <div class="card-grid">${pg.items.length ? pg.items.map((l) => html`<div class="tile lcard lrow${l.sw ? ' sw' : ''}${l.on ? ' is-on' : ''}" data-ft="light" data-fid=${l.id}>${this.lampBtn(l)}<span class="ln"><b class="clamp1">${l.name}</b>${l.sw || multi || !l.ok ? html`<span class="muted clamp1">${[!l.ok ? 'לא זמין כרגע' : '', l.sw ? 'מפסק, בלי עמעום' : '', multi ? this.roomById(l.room)?.name ?? '' : ''].filter(Boolean).join(' · ')}</span>` : nothing}</span>${l.sw ? this.swCtl(l) : this.dimmer(l)}${this.star({ t: 'light', id: l.id })}</div>`)
        : this.empty('bulb', this.only ? 'אין אור דולק ' + this.scopeWord() : 'אין אורות ' + this.scopeWord(), this.only ? 'בחרו "הכל" כדי לראות את כל האורות.' : 'כשיחוברו אורות הם יופיעו כאן.')}</div>${this.pager('lights', pg.pages)}`;
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
    return html`<div class="tile lcard sc${big ? ' big' : ''}" data-ft="scene" data-fid=${s.id}><button class="lamp go${this.sceneRun === s.id ? ' run' : ''}" data-act="scene" data-scene=${s.id} aria-pressed=${String(this.activeScene() === s.id)} aria-label=${'הפעל: ' + s.name}>${hi(s.icon)}</button><span class="ln"><b class="clamp1">${s.name}</b><span class="muted clamp1">${s.does || (s.rooms.length === 1 ? 'רק ב' + (this.roomById(s.rooms[0])?.name ?? 'חדר אחד') : 'סצנה של הבית')}</span></span>${this.star({ t: 'scene', id: s.id })}</div>`;
  }

  private dial(z: HZone) {
    const min = z.min, max = z.max, a0 = 135, sweep = 270, R = 118, cx = 150, cy = 150;
    const pt = (t: number) => { const a = (a0 + sweep * Math.max(0, Math.min(1, (t - min) / (max - min || 1)))) * Math.PI / 180; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; };
    const arc = (t0: number, t1: number) => { const [x0, y0] = pt(t0); const [x1, y1] = pt(t1); const large = (sweep * (t1 - t0) / (max - min || 1)) > 180 ? 1 : 0; return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${R} ${R} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
    const off = z.mode === 'off';
    const [nx, ny] = pt(z.temp ?? min);
    return html`<svg class="dial" viewBox="0 0 300 300" data-mode=${z.mode} role="img" aria-label=${`${off ? 'המיזוג כבוי' : 'מכוון ל-' + z.target + ' מעלות'}, עכשיו ${z.temp ?? 'לא ידוע'} מעלות`}><path class="trk" d=${arc(min, max)}></path>${off || z.target == null ? nothing : svg`<path class="val" d=${arc(min, Math.max(min + 0.01, z.target))}></path>`}${z.temp != null ? svg`<circle class="now" cx=${nx.toFixed(1)} cy=${ny.toFixed(1)} r="7"></circle>` : nothing}</svg>`;
  }

  private sClimate() {
    const rs = this.scopeRooms();
    const zs = this.zonesOf(rs);
    const z = this.mainZone(rs);
    if (!z) return html`${this.head('אקלים', this.scopeWord(), this.scopeSeg())}${this.empty('thermo', 'אין מיזוג ' + this.scopeWord(), this.ctx() ? 'בחרו "כל הבית" כדי לראות את שאר המזגנים.' : 'כשיחובר מזגן או תרמוסטט, אפשר יהיה לכוון אותו מכאן.')}`;
    const pg = paged(zs, 4, this.pg('zones'));
    const off = z.mode === 'off';
    const stateTxt = !z.ok ? 'לא זמין כרגע' : off ? 'המיזוג כבוי' : z.temp == null || z.target == null ? MODES[z.mode] ?? '' : z.temp > z.target ? 'מקרר עכשיו' : z.temp < z.target ? 'מחמם עכשיו' : 'נעים בדיוק';
    const presetBtns = (cls: string) => PRESETS.map(([n, t]) => html`<button class=${cls} data-act="preset" data-zone=${z.id} data-v=${t} aria-pressed=${String(!off && z.target === t)} ?disabled=${!z.can || t < z.min || t > z.max}><span>${n}</span>${cls === 'chip2' ? html`<span class="num">${t}°</span>` : html`<b class="num">${t}°</b>`}</button>`);
    const side = zs.length > 1 && !this.phone
      ? html`<section class="zone-list" aria-label="אזורים">${pg.items.map((x) => html`<button class="tile zrow" data-act="zone" data-v=${x.id} aria-pressed=${String(x.id === z.id)}><span class="zn clamp2">${x.name}</span><span class="zt"><b class="num">${x.mode === 'off' ? 'כבוי' : (x.target ?? '—') + '°'}</b><span class="muted">עכשיו <span class="num">${x.temp ?? '—'}°</span></span></span></button>`)}${this.pager('zones', pg.pages)}</section>`
      : this.phone ? nothing : html`<section class="tile pane clim-side"><h2>מצבים מוכנים</h2>${presetBtns('hbtn wideb')}</section>`;
    const modes = Object.entries(MODES).filter(([m]) => m === 'off' || z.modes.includes(m)).filter(([m], i, a) => a.findIndex(([x]) => MODES[x] === MODES[m]) === i);
    return html`${this.head('אקלים', `${z.name} · ${stateTxt}`, html`${this.scopeSeg()}${this.phone && zs.length > 1 ? html`<button class="hbtn" data-act="zones"><span class="clamp1">${z.name}</span>${hi('down')}</button>` : nothing}`)}
      <div class="clim-body"><section class="tile thermo" aria-label=${z.name}>
        <div class="dial-wrap">${this.dial(z)}<div class="dial-c"><b class="huge num">${off || z.target == null ? '—' : z.target + '°'}</b><span class="muted">עכשיו <span class="num">${z.temp ?? '—'}°</span></span></div>
          <div class="dial-pm"><button class="rb xl" data-act="temp" data-zone=${z.id} data-d="-1" ?disabled=${!z.can} aria-label="קר יותר">${hi('down')}</button><button class="rb xl" data-act="temp" data-zone=${z.id} data-d="1" ?disabled=${!z.can} aria-label="חם יותר">${hi('up')}</button></div></div>
        ${zs.length > 1 || this.phone ? html`<div class="presets">${presetBtns('chip2')}</div>` : nothing}
        ${this.seg('modeSeg', modes as [string, string][], z.mode === 'heat_cool' ? 'auto' : z.mode, 'מצב')}</section>${side}</div>`;
  }

  private sShades() {
    const rs = this.scopeRooms();
    let list = rs.flatMap((r) => r.shades);
    const open = list.filter((s) => (s.pos ?? 0) > 0).length;
    if (this.shadesOnly) list = list.filter((s) => (s.pos ?? 0) > 0);
    const pg = paged(list, this.phone ? 4 : 8, this.pg('shades'));
    return html`${this.head(open === 0 ? 'כל התריסים סגורים' : open === 1 ? 'תריס אחד פתוח' : `${open} תריסים פתוחים`, this.scopeWord(), html`<button class="hbtn" data-act="shadesAll" data-v="open">${hi('up')}<span class="bt">פתח הכל</span></button><button class="hbtn" data-act="shadesAll" data-v="close">${hi('down')}<span class="bt">סגור הכל</span></button>`)}
      <div class="bar wrap">${this.scopeSeg()}${this.onlySeg('shadesOnly', this.shadesOnly, 'פתוחים')}</div><div class="card-grid">${pg.items.length ? pg.items.map((s) => html`<div class="tile lcard sh" data-ft="shade" data-fid=${s.id}><span class="ln"><b class="clamp1">${s.name}</b><span class="muted clamp1">${this.armed?.startsWith(s.id + ':') ? 'לחצו שוב לאישור' : shadeText(s.pos, s.moving, s.state)}${rs.length > 1 ? ' · ' + (this.roomById(s.room)?.name ?? '') : ''}</span></span>${this.trio(s)}${this.star({ t: 'shade', id: s.id })}</div>`)
        : this.empty('shade', this.shadesOnly ? 'אין תריס פתוח ' + this.scopeWord() : 'אין תריסים ' + this.scopeWord(), 'בחרו "כל הבית" או "הכל" כדי לראות עוד.')}</div>${this.pager('shades', pg.pages)}`;
  }

  // ---------------------------------------------------------------- doors, cameras, energy, alerts, scenes, active

  private sDoors() {
    const all = this.allDoors();
    const doors = this.doorsOnly ? all.filter((d) => !d.locked) : all;
    const pgD = paged(doors, this.phone ? 3 : 4, this.pg('doors'));
    const pgV = paged(this.visitors, this.phone ? 2 : 4, this.pg('visitors'));
    const vis = (v: CallLogRow) => {
      const result = v.door_opened_by_name ? `${v.door_opened_by_name} פתח/ה` : v.outcome === 'answered' ? (v.answered_by_name ? `${v.answered_by_name} ענה/תה` : 'נענה') : v.outcome === 'missed' ? 'לא נענה' : v.outcome === 'rejected' ? 'נדחה' : 'הסתיים';
      const tone = v.door_opened_at || v.outcome === 'answered' ? 'ok' : v.outcome === 'missed' ? 'warn' : 'neutral';
      return html`<div class="vrow"><span class="vp vp-ic">${hi('bell')}</span><span class="vn"><b class="clamp1">צלצול</b><span class="muted clamp1">${v.station_name}</span></span><span class="vr"><span class="num">${relTime(v.rang_at)}</span><span class="vres" data-tone=${tone}>${result}</span></span></div>`;
    };
    return html`${this.head(this.phone ? 'דלתות' : 'דלתות ואינטרקום', doorsText(all), html`${this.onlySeg('doorsOnly', this.doorsOnly, 'לא נעולות')}${this.talkTo ? html`<button class="hbtn" data-act="talk">${hi('phone')}<span class="bt">דבר עם הכניסה</span></button>` : nothing}`)}
      <div class="doors-body"><section class="door-list" aria-label="דלתות">${pgD.items.length ? pgD.items.map((d) => html`<div class="tile drow" data-ft="door" data-fid=${d.id}>${this.doorBody(d, true)}</div>`) : this.empty('door', this.doorsOnly && all.length ? 'כל הדלתות נעולות' : 'אין דלתות מחוברות', this.doorsOnly && all.length ? 'אין מה לנעול כרגע.' : 'כשתחובר דלת או אינטרקום, אפשר יהיה לפתוח ולראות מי הגיע.')}${this.pager('doors', pgD.pages)}</section>
      <section class="tile pane visitors" aria-label="מי הגיע"><div class="bar"><h2>מי הגיע</h2>${this.pager('visitors', pgV.pages)}</div>${pgV.items.length ? pgV.items.map(vis) : html`<p class="muted">עוד לא הגיע אף אחד היום.</p>`}</section></div>`;
  }

  private sCameras() {
    const r = this.ctx();
    const cams = r && this.scope === 'room' && r.cams.length ? this.d.cameras.filter((c) => r.cams.includes(c.id)) : this.d.cameras;
    const pg = paged(cams, this.phone ? 4 : 6, this.pg('cams'));
    const bad = cams.filter((c) => !c.ok).length;
    const rec = this.extFor('playback') && this.recOk() ? html`<a class="hbtn" href=${this.href('playback')} data-home-rec>${hi('film')}<span class="bt">הקלטות</span></a>` : nothing;
    return html`${this.head('מצלמות', !cams.length ? '' : bad === 0 ? (cams.length === 1 ? 'המצלמה פועלת' : 'כל המצלמות פועלות') : bad === 1 ? 'מצלמה אחת לא זמינה כרגע' : `${bad} מצלמות לא זמינות כרגע`, html`${r && r.cams.length ? this.seg('scope', [['room', 'החדר הזה'], ['house', 'כל הבית']], this.scope === 'room' ? 'room' : 'house', 'איפה') : nothing}${this.pager('cams', pg.pages)}${cams.length ? rec : nothing}`)}
      ${cams.length ? html`<div class=${`cam-grid n${Math.min(pg.items.length, 6)}`}>${pg.items.map((c) => html`<div class="tile cam-t${c.ok ? '' : ' off'}"><button class="wg-btn pic" data-act="cam" data-cam=${c.id} aria-label=${c.name}>${this.camPic(c, false)}</button>${this.star({ t: 'cam', id: c.id })}</div>`)}</div>` : this.empty('cam', 'אין מצלמות מחוברות', 'כשתחובר מצלמה, התמונה שלה תופיע כאן.')}`;
  }

  private sEnergy() {
    const E = this.d.energy;
    if (!E || !E.today.length) return html`${this.head('חשמל', '')}${this.empty('bolt', 'עוד אין נתוני חשמל', 'אחרי יום שימוש ראשון נראה כאן כמה חשמל הבית צורך.')}`;
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
    const weekday = new Intl.DateTimeFormat('he-IL', { weekday: 'long', timeZone: 'Asia/Jerusalem' }).format(this.now);
    return html`${this.head(html`${day ? 'היום' : 'השבוע'}: <span class="num">${tot.toFixed(1)}</span> קוט״ש`, html`${usualSame > 0 ? (diff === 0 ? 'כמו ביום רגיל' : html`<span class="num">${Math.abs(diff)}%</span> ${diff < 0 ? 'פחות' : 'יותר'} מ${day ? weekday + ' רגיל' : 'שבוע רגיל'}`) : ''}${this.price != null ? html` · בערך <span class="num" data-energy-cost>₪${(tot * this.price).toFixed(2)}</span>` : nothing}`, html`${this.p3.energyActs()}${this.seg('period', [['day', 'היום'], ['week', 'השבוע']], this.period, 'תקופה')}`)}
      <div class="en-body"><section class="tile pane chart" aria-label=${'צריכה לפי ' + (day ? 'שעה' : 'יום')}><div class="bar"><h2>${day ? 'לפי שעה' : 'לפי יום'}</h2><div class="legend"><span><i class="k today"></i>${day ? 'היום' : 'השבוע'}</span><span><i class="k usual"></i>${day ? 'יום רגיל' : 'שבוע רגיל'}</span></div></div>
        <div class="plot" style=${`--n:${rows.length}`} @pointerover=${this.tipOver} @pointerleave=${this.tipOff} @focusin=${this.tipOver} @focusout=${this.tipOff}><div class="yax">${ticks.map((v) => html`<span style=${`bottom:${v / top * 100}%`}><em class="num">${v}</em></span>`)}</div>
          <div class="cols">${rows.map((r) => html`<div class=${'col' + (r[1] == null ? ' future' : '')} tabindex="0" data-tip=${`${r[0]}|${r[1] == null ? '' : r[1].toFixed(1)}|${r[2].toFixed(1)}`}>${r[1] == null ? nothing : html`<i class="b" style=${`height:${Math.max(1.5, r[1] / top * 100)}%`}></i>`}<i class="u" style=${`bottom:${r[2] / top * 100}%`}></i></div>`)}</div>
          <div class="xax">${rows.map((r, i) => html`<span>${day ? (i % 3 === 0 ? html`<em class="num">${r[0].slice(0, 2)}</em>` : nothing) : r[0]}</span>`)}</div><div class="tip" hidden></div></div><p class="unit muted">קוט״ש ל${day ? 'שעה' : 'יום'}</p></section>
      <section class="tile pane byroom" aria-label="מה צורך הכי הרבה"><h2>איפה צורכים הכי הרבה</h2>${br.slice(0, 5).map((b) => html`<div class="hb"><span class="hl clamp1">${b[0]}</span><span class="ht"><i style=${`transform:scaleX(${b[1] / brMax})`}></i></span><span class="hv num">${b[1].toFixed(1)}</span></div>`)}<p class="unit muted">קוט״ש היום</p></section></div>`;
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
    const s1 = document.createElement('span'); s1.textContent = t ? t + ' קוט״ש' : 'עוד לא הגענו'; tip.append(s1);
    const s2 = document.createElement('span'); s2.textContent = u + ' ביום רגיל'; tip.append(s2);
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
    return html`${this.head('התראות', n === 0 ? 'אין שום דבר שדורש טיפול' : n === 1 ? 'דבר אחד מחכה לך' : `${n} דברים מחכים לך`, this.seg('alertTab', [['open', 'מחכות לי'], ['all', 'הכל']], this.alertTab, 'סינון'))}
      <div class="alert-list">${pg.items.length ? pg.items.map((a) => html`<div class="tile arow${a.open ? '' : ' done'}" data-tone=${a.tone}><span class="ai">${hi(a.icon)}</span><span class="at"><b class="clamp2">${a.text}</b><span class="muted">${a.when}</span></span>${a.open && a.canAck ? html`<button class="hbtn" data-act="alertAck" data-id=${a.id}><span class="clamp1">הבנתי</span></button>` : a.open ? nothing : html`<span class="muted done-t">${hi('check')}טופל</span>`}</div>`) : this.empty('check', 'הכל בסדר בבית', 'כשמשהו ידרוש את תשומת הלב שלך, הוא יופיע כאן.')}</div>${this.pager('alerts', pg.pages)}`;
  }

  private sScenes() {
    const r = this.ctx();
    const list = r ? [...homeScenes(this.world()), ...this.d.scenes.filter((s) => s.rooms.length === 1 && s.rooms[0] === r.id)] : this.d.scenes;
    const pg = paged(list, this.phone ? 4 : 8, this.pg('scenes'));
    const canEdit = this.d.scenes.some((s) => s.canEdit);
    return html`${this.head('סצנות', r ? `של הבית ושל ${r.name}. נגיעה מפעילה.` : 'נגיעה אחת מפעילה כמה דברים יחד.', canEdit ? html`<a class="hbtn" href=${this.href('settings/scenes')}>${hi('edit')}<span class="bt">עריכת סצנות</span></a>` : nothing)}
      <div class="card-grid">${pg.items.length ? pg.items.map((s) => this.sceneCard(s, true)) : this.empty('scenes', 'עוד אין סצנות', 'מנהל הבית יכול להגדיר סצנות שמפעילות כמה דברים יחד.')}</div>${this.pager('scenes', pg.pages)}`;
  }

  private sActive() {
    const list = activeRooms(this.visRooms());
    const kept = loadsOn(this.visRooms());
    const items: ({ r: HRoom } | { kept: HLoad[] })[] = [...list.map((r) => ({ r })), ...(kept.length ? [{ kept }] : [])];
    const pg = paged(items, this.phone ? 4 : 5, this.pg('active'));
    const n = onCount(this.visRooms());
    return html`${this.head('פעיל עכשיו בבית', list.length === 0 ? 'כל האורות והמיזוג כבויים' : `${lightsText(n)} · ${list.length === 1 ? 'חדר אחד פעיל' : list.length + ' חדרים פעילים'}`, html`<button class="hbtn strong" data-act="houseOff" ?disabled=${!list.length}>${hi('power')}<span class="bt">כיבוי כל הבית</span></button>`)}
      <div class="alert-list act">${pg.items.length ? pg.items.map((o) => 'kept' in o
        ? html`<div class="tile arow kept"><span class="ai">${hi('plug')}</span><span class="at"><b class="clamp1">${o.kept.length === 1 ? 'מפסק אחד שאינו אור דולק' : o.kept.length + ' מפסקים שאינם אור דולקים'}</b><span class="muted clamp1">${o.kept.slice(0, 3).map((k) => k.name).join(', ')}${o.kept.length > 3 ? ' ועוד' : ''} · לא נכבים ב"כיבוי כל הבית"</span></span><a class="hbtn" href=${this.href('lights')} data-act="goLoads">${hi('fwd')}<span class="bt">למפסקים</span></a></div>`
        : html`<div class="tile arow"><span class="ai" data-on="1">${hi('pulse')}</span><a class="at" href=${this.href('r/' + o.r.id)}><b class="clamp1">${o.r.name}</b><span class="muted">${activeText(o.r)} · ${floorName(this.d.floors, o.r.floor)}</span></a><button class="hbtn" data-act="roomOffId" data-room=${o.r.id}>${hi('power')}<span class="bt">כבה</span></button></div>`)
        : this.empty('night', 'הכל כבוי בבית', 'כשיידלק אור או מזגן, החדר יופיע כאן.')}</div>${this.pager('active', pg.pages)}`;
  }

  // ---------------------------------------------------------------- settings, welcome, the interface choice

  private faceChoice(cur: 'home' | 'full') {
    const canSwitch = !!this.pol()?.may_switch;
    return html`<div class="face-choice" role="radiogroup" aria-label="הממשק שלי">
      <button role="radio" aria-checked=${String(cur === 'home')} data-act="face" data-v="home" ?disabled=${!canSwitch}><span class="fc-pic home" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="fc-t"><b>ממשק ביתי</b><span>פשוט וגדול, לכל המשפחה</span></span>${hi('check', 'tick')}</button>
      <button role="radio" aria-checked=${String(cur === 'full')} data-act="face" data-v="full" ?disabled=${!canSwitch}><span class="fc-pic full" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span><span class="fc-t"><b>ממשק מלא</b><span>כל היכולות, למי שמנהל את הבית</span></span>${hi('check', 'tick')}</button>
    </div>${canSwitch ? nothing : html`<p class="lock-note">${hi('lock')}הממשק נקבע על ידי מנהל הבית.</p>`}`;
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
      body = html`<p class="hint">המועדפים של ${r ? r.name : 'הבית שלי'}. מוסיפים בכוכב שליד כל אור, תריס, דלת, מצלמה או סצנה. אפשר לסדר גם במסך החדר עצמו, בכפתור "עריכה".</p><div class="set-list two">${pg.items.length ? pg.items.map(([f, ix]) => html`<div class="tile setrow"><span class="sname clamp1">${this.favLabel(f)}</span><span class="mv"><button class="rb" data-act="wgMove" data-ix=${ix} data-d="-1" ?disabled=${ix === 0} aria-label="הזז למעלה">${hi('up')}</button><button class="rb" data-act="wgMove" data-ix=${ix} data-d="1" ?disabled=${ix >= list.length - 1} aria-label="הזז למטה">${hi('down')}</button><button class="rb" data-act="wgDel" data-ix=${ix} aria-label="הסר">${hi('x')}</button></span></div>`) : this.empty('star', 'עוד אין כאן מועדפים', 'לחצו על הכוכב שליד אור, תריס או מצלמה.')}</div>${this.pager('setFavs', pg.pages)}`;
    } else if (t === 'rooms') {
      const fl = this.d.floors;
      const cur = fl.some((f) => f.id === this.floor) ? this.floor : fl[0]?.id ?? '';
      const hidden = new Set(this.prefs.layout.hidden_rooms ?? []);
      const pg = paged(this.d.rooms.filter((x) => x.floor === cur), this.phone ? 5 : 8, this.pg('setRooms'));
      body = html`<div class="bar wrap"><p class="hint">לב: חדר מועדף, עוברים אליו בהחלקה. מתג: האם החדר מופיע בכלל.</p>${this.seg('floor', fl.map((f) => [f.id, f.short]), cur, 'קומה')}</div><div class="set-list two">${pg.items.map((x) => html`<div class="tile setrow"><span class="sname clamp1">${x.name}</span><button class="lamp heart" data-act="favRoom" data-id=${x.id} aria-pressed=${String(this.favRooms().includes(x.id))} aria-label="חדר מועדף">${hi('heart')}</button>${this.sw(!hidden.has(x.id), 'roomVis', 'הצג את ' + x.name, x.id)}</div>`)}</div>${this.pager('setRooms', pg.pages)}`;
    } else if (t === 'scenes') {
      const pg = paged(this.d.scenes, this.phone ? 5 : 8, this.pg('setScenes'));
      body = html`<p class="hint">סצנה מפעילה כמה דברים בנגיעה אחת. ${this.d.scenes.some((s) => s.canEdit) ? 'את תוכן הסצנה עורכים בממשק המלא.' : 'רק מנהל הבית יכול לערוך סצנות.'}</p><div class="set-list two">${pg.items.map((s) => html`<div class="tile setrow">${hi(s.icon)}<span class="sname"><b>${s.name}</b><span class="muted clamp1">${s.does}</span></span>${s.canEdit && !this.pol()?.home_only ? html`<a class="hbtn" href="#/devices/automations/scenes">${hi('edit')}<span class="bt">עריכה</span></a>` : nothing}</div>`)}</div>${this.pager('setScenes', pg.pages)}`;
    } else if (t === 'themes') {
      const curT = this.getAttribute('data-hs-theme') ?? 'classic';
      const scheme = this.getAttribute('data-hs-scheme') ?? 'dark';
      const list = this.phone ? paged(THEMES, 4, this.pg('themes')) : { items: THEMES, pages: 1 };
      body = html`<div class="bar wrap"><p class="hint">הצבעים של הממשק הביתי שלי. צבעי המצב (תקין, שים לב, אזעקה) נשארים זהים בכל ערכה.</p>${this.seg('theme', [['dark', 'כהה'], ['light', 'בהיר']], scheme, 'מראה')}</div>
        <div class="theme-grid" role="radiogroup" aria-label="ערכת נושא">${list.items.map(([id, name, line, n]) => html`<button class="tile thm" role="radio" aria-checked=${String(id === curT)} data-act="hs" data-v=${id}><span class="thm-pv" data-hs-theme=${id} data-hs-scheme=${n === 1 ? 'dark' : scheme} aria-hidden="true"><i class="pv-a"></i><i class="pv-b"></i><i class="pv-c"></i><i class="pv-d"></i></span><span class="thm-t"><b>${name}</b><span class="muted clamp2">${line}</span></span>${hi('check', 'tick')}</button>`)}</div>${this.pager('themes', list.pages)}`;
    } else if (t === 'wall') {
      body = this.wallSettings();
    } else {
      const l = this.prefs.layout;
      const tn = THEMES.find((x) => x[0] === (this.getAttribute('data-hs-theme') ?? 'classic'))?.[1] ?? '';
      body = html`<div class="set-view"><section class="tile pane"><h2>הממשק שלי</h2>${this.faceChoice('home')}</section>
        <section class="tile pane"><h2>תצוגה</h2><div class="setrow flat"><span class="sname">מה נפתח ראשון</span>${this.seg('start', [['home', 'הבית שלי'], ['last', 'החדר האחרון'], ['fixed', 'חדר קבוע']], l.start ?? 'home', 'מסך פתיחה')}</div><div class="setrow flat"><span class="sname"><b>ערכת נושא</b><span class="muted">${tn}, ${this.getAttribute('data-hs-scheme') === 'light' ? 'בהיר' : 'כהה'}</span></span><a class="hbtn" href=${this.href('settings/themes')}>${hi('palette')}<span class="bt">החלפה</span></a></div><div class="setrow flat"><span class="sname"><b>כתב גדול</b><span class="muted">מגדיל גם את האריחים</span></span>${this.sw(!!l.big_text, 'bigText', 'כתב גדול')}</div></section></div>`;
    }
    return html`${this.headT('הגדרות', 'המועדפים, החדרים והתצוגה שלי', this.seg('setTab', [['favs', 'מועדפים'], ['rooms', 'חדרים'], ['scenes', 'סצנות'], ['themes', this.phone ? 'צבעים' : 'ערכות נושא'], ...(wallOn ? [['wall', 'רקע'] as [string, string]] : []), ['view', 'תצוגה']], t, 'נושא'))}${body}`;
  }

  private sWelcome() {
    return html`<div class="welcome"><span class="mark big" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M6 24 16 7l10 17"></path><path d="M11 24h10"></path></svg></span><h1>שלום ${this.userName}, איך נוח לך לראות את הבית?</h1><p class="sub">אפשר להחליף בכל רגע מהתפריט האישי.</p>
      <div class="wl-choice" role="radiogroup" aria-label="בחירת ממשק">
        <button class="tile wl" role="radio" aria-checked=${String(this.welcomePick === 'home')} data-act="welcomePick" data-v="home"><span class="wl-pic home" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span><b>ממשק ביתי</b><span>חדר אחרי חדר: מה שיש בחדר, המועדפים שלך, וכיבוי בנגיעה. בלי מונחים טכניים. מתאים לכל המשפחה ולמסך על הקיר.</span>${hi('check', 'tick')}</button>
        <button class="tile wl" role="radio" aria-checked=${String(this.welcomePick === 'full')} data-act="welcomePick" data-v="full"><span class="wl-pic full" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><b>ממשק מלא</b><span>כל המסכים והיכולות: מפות, הקלטות, תזמונים, הרשאות והגדרות. מתאים למי שמנהל את הבית.</span>${hi('check', 'tick')}</button>
      </div><button class="hbtn strong wide" data-act="welcomeGo">המשך</button></div>`;
  }

  // ---------------------------------------------------------------- overlays

  /** HOME-V3-P1-2430: recordings are offered while the cameras category is on and the person may play recordings */
  recOk(): boolean {
    return this.d.modules.has('cameras') && this.d.cameras.length > 0 && canAnywhere('video.playback');
  }

  private ovlHtml(): unknown {
    const o = this.ovl;
    if (!o) return nothing;
    if (o.type === 'ext') return this.ext.find((m) => m.id === o.mod)?.ovl?.(o) ?? nothing;
    if (o.type === 'p3') return this.p3.ovl(o);
    if (o.type === 'cam') {
      const c = this.d.cameras.find((x) => x.id === o.id) ?? this.d.cameras[0];
      if (!c) return nothing;
      return html`<div class="hscrim solid"></div><section class="camfull" role="dialog" aria-modal="true" aria-label=${c.name}><div class="cf-pic">${c.ok ? html`<sw-camera-tile class="scene-pic" dark noDemo cameraId=${c.id} state="live" live profile="main" autoProfile poster=${snapshotUrl(c.id)}></sw-camera-tile>` : html`<div class="cam-off big">${hi('camoff')}<span>המצלמה לא זמינה כרגע</span><small>אנחנו מנסים להתחבר שוב. אין צורך לעשות דבר.</small></div>`}</div>
        <header class="cf-bar"><button class="rb onpic" data-act="close" aria-label="סגור">${hi('x')}</button><div class="cf-t"><b class="clamp1">${c.name}</b>${c.ok ? html`<span class="live onpic"><i class="dot"></i>חי</span>` : nothing}</div><span class="cf-nav"><button class="rb onpic" data-act="camStep" data-d="-1" aria-label="המצלמה הקודמת">${hi('back')}</button><button class="rb onpic" data-act="camStep" data-d="1" aria-label="המצלמה הבאה">${hi('fwd')}</button></span></header>${this.extFor('playback') && this.recOk() ? html`<footer class="cf-foot"><a class="hbtn onpic" href=${this.href('playback/' + encodeURIComponent(c.id))} data-act="closeNav" data-home-rec>${hi('film')}הקלטות של המצלמה</a></footer>` : nothing}</section>`;
    }
    if (o.type === 'confirm') {
      const d = this.findIn((r) => r.doors, o.door);
      if (!d) return nothing;
      return html`<div class="hscrim" data-act="close"></div><section class="sheet dialog" role="alertdialog" aria-modal="true" aria-label="אישור פתיחה"><span class="dlg-ic">${hi('unlock')}</span><h2>לפתוח את ${d.name}?</h2><p class="muted">${d.kind === 'gate' ? 'השער ייסגר שוב מעצמו.' : 'הדלת תינעל שוב מעצמה אחרי כמה שניות.'}</p><div class="dlg-acts"><button class="hbtn strong" data-act="doorOpen" data-door=${d.id}>כן, פתח</button><button class="hbtn" data-act="close">ביטול</button></div></section>`;
    }
    if (o.type === 'ask') {
      return html`<div class="hscrim" data-act="close"></div><section class="sheet dialog" role="alertdialog" aria-modal="true" aria-label=${o.title}><span class="dlg-ic">${hi('check')}</span><h2 class="clamp2">${o.title}</h2><p class="muted">${o.text}</p><div class="dlg-acts"><button class="hbtn strong" data-act="askYes">${o.yes}</button><button class="hbtn" data-act="close">ביטול</button></div></section>`;
    }
    if (o.type === 'guard') {
      const x = this.findIn((r) => r.loads, o.id);
      if (!x) return nothing;
      return html`<div class="hscrim" data-act="close"></div><section class="sheet dialog" role="alertdialog" aria-modal="true" aria-label="אישור כיבוי"><span class="dlg-ic">${hi(this.loadIcon(x))}</span><h2 class="clamp2">לכבות את ${x.name}?</h2><p class="muted">המפסק הזה מסומן כמוגן, כדי שלא יכבה בטעות.</p><div class="dlg-acts"><button class="hbtn strong" data-act="guardOff">כן, כבה</button><button class="hbtn" data-act="close">ביטול</button></div></section>`;
    }
    if (o.type === 'menu') {
      const scheme = this.getAttribute('data-hs-scheme');
      return html`<div class="hscrim clear" data-act="close"></div><section class="sheet umenu" role="dialog" aria-modal="true" aria-label="התפריט האישי"><header class="menu-h"><span class="av lg">${(this.userName || '?').slice(0, 1)}</span><span class="mh-t"><b class="clamp1">${this.userFull || this.userName}</b><span class="muted">${this.role}</span></span><button class="rb" data-act="close" aria-label="סגור">${hi('x')}</button></header>
        <h3>הממשק שלי</h3>${this.faceChoice('home')}
        <div class="menu-rows"><a class="mrow" href=${this.href('settings/favs')} data-act="closeNav">${hi('sliders')}<span>ההגדרות שלי</span>${hi('fwd')}</a><button class="mrow" data-act="theme" data-v=${scheme === 'dark' ? 'light' : 'dark'}>${hi(scheme === 'dark' ? 'sun' : 'night')}<span>${scheme === 'dark' ? 'מראה בהיר' : 'מראה כהה'}</span></button>${switchUserMode() ? html`<button class="mrow" data-act="switchUser" data-home-switch-user>${hi('user')}<span>החלף משתמש</span>${hi('fwd')}</button>` : nothing}</div></section>`;
    }
    if (o.type === 'zones') {
      const zs = this.zonesOf(this.scopeRooms()).slice(0, 6);
      const cur = this.mainZone(this.scopeRooms());
      return html`<div class="hscrim" data-act="close"></div><section class="sheet bottom" role="dialog" aria-modal="true" aria-label="בחירת אזור"><span class="grab" aria-hidden="true"></span><h2>איזה חדר?</h2><div class="pick-list">${zs.map((z) => html`<button class="mrow" data-act="zone" data-v=${z.id} aria-pressed=${String(z.id === cur?.id)}><span class="clamp1">${z.name}</span><b class="num">${z.mode === 'off' ? 'כבוי' : (z.target ?? '—') + '°'}</b></button>`)}</div></section>`;
    }
    if (o.type === 'hold') {
      const here = this.favs(this.room).some((x) => sameFav(x, o.f));
      const r = this.ctx();
      return html`<div class="hscrim" data-act="close"></div><section class="sheet dialog" role="dialog" aria-modal="true" aria-label="מועדפים"><span class="dlg-ic">${hi('star')}</span><h2 class="clamp2">${o.label}</h2><p class="muted">מועדף מופיע במסך החדר, בנגיעה אחת.</p><div class="pick-list wide"><button class="mrow" data-act="holdFav" data-k=${this.room}>${hi('star')}<span>${here ? 'הסר מהמועדפים של ' : 'הוסף למועדפים של '}${r ? r.name : 'הבית שלי'}</span></button>${r ? html`<button class="mrow" data-act="holdFav" data-k="home">${hi('home')}<span>הוסף ל"הבית שלי"</span></button>` : nothing}<button class="mrow" data-act="close">${hi('x')}<span>ביטול</span></button></div></section>`;
    }
    if (o.type === 'talk') {
      const s = this.talkTo;
      if (!s) return nothing;
      return html`<div class="hscrim solid"></div><section class="call" role="dialog" aria-modal="true" aria-label=${'דבר עם ' + s.name}><div class="call-video">${s.video ? html`<sw-camera-tile class="scene-pic" dark noDemo fit="cover" state="live" live .livePath=${s.video} profile="sub"></sw-camera-tile>` : html`<div class="cam-off big">${hi('camoff')}<span>אין תמונה מהכניסה הזו</span></div>`}</div>
        <div class="call-side"><p class="ring-line">${hi('phone')}שיחה יוצאת</p><h1>מדברים עם ${s.name}</h1><p class="sub">נגיעה פותחת את המיקרופון. השיחה נסגרת בנגיעה נוספת.</p><div class="call-acts"><wk-talk-button dial idleLabel="דבר עם הכניסה" .stationId=${s.id} .talk=${s.talk}></wk-talk-button><button class="hbtn xl" data-act="close">סגור</button></div></div></section>`;
    }
    if (o.type === 'code') {
      const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'go'];
      return html`<div class="hscrim" data-act="close"></div><section class="sheet dialog kiosk-pad" role="dialog" aria-modal="true" aria-label=${o.title}><span class="dlg-ic">${hi('shield')}</span><h2 class="clamp2">${o.title}</h2><p class="muted">${o.error || 'הקלידו את הקוד.'}</p><p class="kp-dots num" aria-live="polite">${o.code.replace(/./g, '•') || ' '}</p><div class="kp-grid">${keys.map((k) => k === 'go' ? html`<button class="hbtn strong" data-act="codeGo" ?disabled=${!o.code}>אישור</button>` : k === 'del' ? html`<button class="hbtn" data-act="codeKey" data-k="del" aria-label="מחק">${hi('back')}</button>` : html`<button class="hbtn num" data-act="codeKey" data-k=${k}>${k}</button>`)}</div><div class="dlg-acts"><button class="hbtn" data-act="close">ביטול</button></div></section>`;
    }
    if (o.type === 'switchHost') {
      return html`<div class="hscrim" data-act="close"></div><section class="sheet dialog" role="alertdialog" aria-modal="true" aria-label="החלפת משתמש" data-home-switch-host><span class="dlg-ic">${hi('user')}</span><h2>החלפת משתמש</h2><p class="muted">הכניסה כאן היא של מערכת הבית. נפתח את דף החשבון שלה: שם יוצאים, והאדם הבא נכנס בשם שלו.</p><div class="dlg-acts"><button class="hbtn strong" data-act="switchHostGo">לדף החשבון</button><button class="hbtn" data-act="close">ביטול</button></div></section>`;
    }
    if (o.type === 'kiosk') {
      const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'go'];
      return html`<div class="hscrim" data-act="close"></div><section class="sheet dialog kiosk-pad" role="dialog" aria-modal="true" aria-label="יציאה ממסך הקיר"><span class="dlg-ic">${hi('lock')}</span><h2>קוד מנהל</h2><p class="muted">${o.error || 'הקוד פותח את מסך הקיר לחמש דקות.'}</p><p class="kp-dots num" aria-live="polite">${o.code.replace(/./g, '•') || ' '}</p><div class="kp-grid">${keys.map((k) => k === 'go' ? html`<button class="hbtn strong" data-act="kioskGo" ?disabled=${o.code.length < 4}>אישור</button>` : k === 'del' ? html`<button class="hbtn" data-act="kioskKey" data-k="del" aria-label="מחק">${hi('back')}</button>` : html`<button class="hbtn num" data-act="kioskKey" data-k=${k}>${k}</button>`)}</div><div class="dlg-acts"><button class="hbtn" data-act="close">ביטול</button></div></section>`;
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
    const opts: [string, string, string][] = [['', 'בלי רקע', ''], ...GALLERY.map((g) => ['g:' + g.id, g.name, galleryCss(g.id)] as [string, string, string])];
    const pg = paged(opts, this.phone ? 6 : 9, this.pg('wall'));
    return html`<div class="bar wrap"><p class="hint">הרקע של ${r ? r.name : 'הבית שלי'}. הוא מעומעם מאחורי הכפתורים, כדי שהכתב יישאר ברור.</p>${withImg ? html`<label class="hbtn" data-wall-upload>${hi('plus')}<span class="bt">${cur === 'img' ? 'החלפת התמונה שלי' : 'תמונה שלי'}</span><input type="file" accept="image/jpeg,image/png" hidden @change=${(e: Event) => this.uploadWall(e)}></label>${cur === 'img' ? html`<button class="hbtn" data-act="wallDel">${hi('x')}<span class="bt">הסרת התמונה</span></button>` : nothing}` : nothing}</div>
      <div class="wall-grid" role="radiogroup" aria-label="רקע לחדר">${pg.items.map(([id, name, bg]) => html`<button class="tile wall-opt" role="radio" aria-checked=${String(id === cur)} data-act="wall" data-v=${id} data-wall-opt=${id || 'none'}><span class="wall-pv" style=${bg ? `--hs-wall:${bg}` : nothing} aria-hidden="true"></span><b class="clamp1">${name}</b>${hi('check', 'tick')}</button>`)}</div>${this.pager('wall', pg.pages)}`;
  }

  a_wall(el: HTMLElement) {
    const v = el.dataset.v ?? '';
    this.saveLayout({ wallpapers: { ...(this.prefs.layout.wallpapers ?? {}), [this.room]: v } });
  }

  a_wallDel() {
    void api<{ layout: HomeLayout }>(`home/wallpaper/${encodeURIComponent(this.room)}`, { method: 'DELETE' })
      .then((r) => { this.prefs = { ...this.prefs, layout: r.layout }; this.toast('התמונה הוסרה'); })
      .catch((err) => this.toast(describeError(err)));
  }

  private uploadWall(e: Event) {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    if (!/^image\/(jpeg|png)$/.test(f.type)) return this.toast('אפשר להעלות JPEG או PNG בלבד.');
    if (f.size > 2_000_000) return this.toast('התמונה גדולה מ-2 MB.');
    const form = new FormData();
    form.append('file', f);
    void api<{ layout: HomeLayout }>(`home/wallpaper/${encodeURIComponent(this.room)}`, { method: 'PUT', body: form })
      .then((r) => { this.wallStamp = Date.now(); this.prefs = { ...this.prefs, layout: r.layout }; this.toast('התמונה נשמרה כרקע'); })
      .catch((err) => this.toast(describeError(err)));
  }

  // ---------------------------------------------------------------- render

  render() {
    if (!this.data) {
      return html`<div class="hs v2 bare"><main class="hs-main">${this.error ? this.empty('x', 'לא הצלחנו לטעון את הבית', this.error) : html`<div class="empty loading" aria-busy="true">${hi('home')}<h2>טוענים את הבית…</h2></div>`}</main></div>`;
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
    const anim = this.path !== this.lastRoute;
    this.lastRoute = this.path;
    return html`<div class="app-root" @click=${this.onClick} @input=${this.onInput} @pointerdown=${this.onPointerDown} @pointermove=${this.onPointerMove} @pointerup=${this.onPointerUp} @pointercancel=${() => { window.clearTimeout(this.holdT); this.swipe = null; }} @keydown=${this.onKey}>
      <div class=${'hs v2' + (this.kioskLocked() ? ' kiosk' : '') + (name === 'r' && this.wallOf(this.room) ? ' walled' : '')} data-screen=${name} data-wall=${name === 'r' ? this.wallOf(this.room) ?? nothing : nothing} style=${name === 'r' && this.wallOf(this.room) ? `--hs-wall:${this.wallBg(this.room)}` : nothing}>${this.strip(name)}${this.nav(cur)}<main class=${'hs-main' + (anim ? ' enter' : '')} id="main">${screen}</main>${this.nowBar()}</div>
      <div class="ovl">${this.ovlHtml()}</div>${this.toasts()}
      <sw-home-call data-hs-theme=${this.getAttribute('data-hs-theme') ?? 'classic'} data-hs-scheme=${this.getAttribute('data-hs-scheme') ?? 'dark'} ?data-hs-big=${this.hasAttribute('data-hs-big')} @home-calls=${(e: CustomEvent<HomeCallsState>) => { this.calls = e.detail; }}></sw-home-call></div>`;
  }

  private toasts() {
    const t = this.toastMsg;
    return html`<div class="toasts" aria-live="polite">${t ? html`<div class="toast2"><span>${t.text}</span>${t.undo ? html`<button data-act="undo">ביטול</button>` : nothing}</div>` : nothing}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-home': SwHome;
  }
}
