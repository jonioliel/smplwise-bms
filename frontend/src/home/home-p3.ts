// HOME-V3-P3-2432: phase 3 of the home interface (the approved mockup v3, round 27): music and screens, announcements, the electricity
// bill, water, the house systems (view only) and the home map. One controller, owned by <sw-home> (a few short additive hooks there),
// with one file per screen / sheet (home-p3-media.ts, home-p3-announce.ts, home-p3-bills.ts, home-p3-water.ts, home-p3-systems.ts,
// home-p3-map.ts). Every capability is hidden when its category is off for the person, its module is off, or the person lacks its
// permission; every read and control is an existing route (each still checks its own permission on the server):
//   music and screens  GET multimedia/status, GET multimedia/devices(?kind=...), GET multimedia/devices/{key}(/library),
//                      POST multimedia/devices/{key}/commands, POST multimedia/groups/join | leave            (media.read / control / power / group)
//   announcements      GET announcements/areas, POST announcements (never the emergency one: full interface)   (media.announce)
//   electricity bill   GET energy/accounts, GET energy/accounts/{id}/status | periods                           (energy.bills, money only)
//   water              GET infra/water/status | meters | consumption | events/summary                         (water.view, the water module)
//   house systems      GET generator/devices/live, GET infra/elevators, GET infra/temperature (read only)      (generator.view / their own reach)
//   home map           the rooms of GET home/overview drawn as a schematic plan per floor (map.read); nothing of the full map is edited
import { html, nothing, type TemplateResult } from 'lit';
import { describeError, get, post } from '../api/client';
import { canAnywhere } from '../api/session';
import { commandId } from '../api/request-id';
import { isDead, isOn, needsPublic, type SourceItem } from '../api/media-screens';
import { playerErrorText, type LibraryItem, type PlayerDevice } from '../api/media-players';
import { listLive } from '../api/generator';
import { genHomeView, type GenHomeView } from '../generator/home-widget-model';
import { listElevators, type Elevator } from '../api/elevators';
import { listUnits, type TempUnit } from '../api/temperature';
import type { HomeData, HRoom } from './home-api';
import { paged } from './home-logic';
import { hi3 } from './home-p3-icons';
import { ils, isP3Screen, money, plural, TEMP_OK, type HomeModuleP3, type P3Screen } from './home-p3-logic';
import { sMedia, groupSheet, remoteSheet } from './home-p3-media';
import { announceSheet } from './home-p3-announce';
import { sBills } from './home-p3-bills';
import { sWater } from './home-p3-water';
import { sSystems } from './home-p3-systems';
import { sMap } from './home-p3-map';

/** What phase 3 uses of <sw-home> (members that are private there; reached through this interface, never changed in shape). */
export interface P3Host {
  requestUpdate(): void;
  readonly d: HomeData;
  readonly phone: boolean;
  scope: 'room' | 'floor' | 'house';
  ovl: unknown;
  ctx(): HRoom | null;
  visRooms(): HRoom[];
  roomById(id: string): HRoom | undefined;
  head(title: unknown, sub: unknown, acts?: unknown): TemplateResult;
  pager(key: string, pages: number): TemplateResult | typeof nothing;
  pg(key: string): number;
  href(p: string): string;
  toast(text: string, undo?: (() => void) | null): void;
  kioskLocked(): boolean;
  route(): { name: string; arg: string };
  scopeSeg(): unknown;
  scopeWord(): string;
  sRoom(): unknown;
  readonly isConnected: boolean;
}

/** A tile of the "עוד בבית" hub (phase 1 owns the hub; this is the registry entry phase 3 hands it). */
export interface HubTile { id: HomeModuleP3; href: string; label: string; icon: string; line: string; tone: '' | 'ok' | 'warn' | 'info'; badge: number; act?: string; kiosk: boolean }
export type P3Ovl = { type: 'p3'; sheet: 'remote' | 'group' | 'announce'; id?: string };
export type MediaCmd = Record<string, unknown> & { command: string };

export interface AnnArea { area_id: string; name: string; floor_name: string | null }
export interface AnnTemplate { id: string; kind: string; name: Record<string, string>; text: Record<string, string> }
export interface BillPeriod { from: string; to: string; state: string; bill: { id: string; total?: string | number | null; state: string; due_date: string | null } | null }
export interface BillAccount { id: string; name: string; status: string }
export interface BillView { accounts: BillAccount[]; acc: string | null; status: { period: { from: string; to: string } | null; amount_so_far?: string | number | null } | null; periods: BillPeriod[]; loading: boolean; error: string }
export interface WaterView { today: number | null; month: number | null; leaks: number; week: { start: string; litres: number | null }[] | null; meters: number }
export interface SysView { gen: GenHomeView | null; elev: Elevator[]; temps: TempUnit[] }

const enc = encodeURIComponent;
const MEDIA_KINDS = 'screen,speaker,player,receiver,group';
const expiry = () => new Date(Date.now() + 15_000).toISOString();

export class P3 {
  media: PlayerDevice[] | null = null;
  mp: string | null = null;
  sources: Record<string, SourceItem[]> = {};
  library: Record<string, LibraryItem[]> = {};
  ann: { areas: AnnArea[]; templates: AnnTemplate[]; max: number } | null = null;
  bill: BillView | null = null;
  water: WaterView | null = null;
  sys: SysView | null = null;
  mapFloor: string | null = null;
  /** true once the first load finished (whatever it found) */
  loaded = false;
  /** The open sheet's draft (announcement, play in more rooms). */
  draft: { msg?: string | null; text?: string; where?: 'room' | 'house'; grp?: string[] } = {};
  private volT = 0;
  private pollT = 0;
  private refreshT = 0;

  constructor(readonly h: P3Host) {}

  has(m: HomeModuleP3): boolean {
    return this.h.d.modules.has(m as never);
  }

  private up() {
    this.h.requestUpdate();
  }

  // ---------------------------------------------------------------- data

  async load(): Promise<void> {
    const jobs: Promise<unknown>[] = [];
    if (this.has('media')) jobs.push(this.loadMedia(true));
    if (this.has('announce') && canAnywhere('media.announce')) jobs.push(this.loadAnnounce());
    if (this.has('bills') && canAnywhere('energy.bills')) jobs.push(this.loadBillAccounts());
    if (this.has('water')) jobs.push(this.loadWater());
    if (this.has('systems')) jobs.push(this.loadSystems());
    await Promise.all(jobs.map((j) => j.catch(() => undefined)));
    this.loaded = true;
    window.clearInterval(this.pollT);
    // the media screen and a room's media tile follow what plays; the house systems follow their live state (both read-only refreshes)
    this.pollT = window.setInterval(() => {
      if (!this.h.isConnected) { window.clearInterval(this.pollT); return; }
      const name = this.h.route().name;
      if (name === 'media' && this.media) void this.loadMedia(false);
      if (name === 'systems' && this.sys) void this.loadSystems();
    }, 12_000);
    this.up();
  }

  async loadMedia(first: boolean): Promise<void> {
    try {
      if (first) {
        const st = await get<{ enabled: boolean; can: { read: boolean } }>('multimedia/status');
        if (!st.enabled || !st.can?.read) { this.media = null; return; }
      }
      const r = await get<{ devices: PlayerDevice[] }>(`multimedia/devices?kind=${MEDIA_KINDS}`);
      this.media = r.devices.filter((d) => d.live && d.caps);
    } catch {
      if (first) this.media = null;
    } finally {
      this.up();
    }
  }

  private async loadAnnounce() {
    try {
      const r = await get<{ enabled: boolean; areas: AnnArea[]; templates: AnnTemplate[]; max_text: number }>('announcements/areas');
      this.ann = r.enabled && r.areas.length ? { areas: r.areas, templates: (r.templates ?? []).filter((t) => t.kind !== 'emergency' && t.text?.he), max: r.max_text || 400 } : null;
    } catch {
      this.ann = null;
    }
  }

  private async loadBillAccounts() {
    try {
      const r = await get<{ items: BillAccount[] }>('energy/accounts');
      const accounts = r.items.filter((a) => a.status !== 'paused');
      this.bill = accounts.length ? { accounts, acc: accounts[0].id, status: null, periods: [], loading: true, error: '' } : null;
      if (this.bill) await this.loadBill(this.bill.acc as string);
    } catch {
      this.bill = null;
    }
  }

  async loadBill(acc: string): Promise<void> {
    if (!this.bill) return;
    this.bill = { ...this.bill, acc, loading: true, error: '' };
    this.up();
    try {
      const [status, per] = await Promise.all([
        get<BillView['status']>(`energy/accounts/${enc(acc)}/status`),
        get<{ periods: BillPeriod[] }>(`energy/accounts/${enc(acc)}/periods?past=6&future=0`),
      ]);
      this.bill = { ...this.bill, status, periods: per.periods.slice().reverse(), loading: false };
    } catch (err) {
      this.bill = { ...this.bill, status: null, periods: [], loading: false, error: describeError(err) };
    }
    this.up();
  }

  private async loadWater() {
    try {
      const st = await get<{ enabled: boolean; can_view: boolean; meters: number }>('infra/water/status');
      if (!st.enabled || !st.can_view || !st.meters) { this.water = null; return; }
      const to = new Date();
      const from = new Date(to.getFullYear(), to.getMonth(), to.getDate() - 6);
      const [m, s, c] = await Promise.all([
        get<{ items: { status: string; today_l: number | null; month_l: number | null }[] }>('infra/water/meters'),
        get<{ open_leaks: number }>('infra/water/events/summary').catch(() => ({ open_leaks: 0 })),
        get<{ series?: { start: string; litres: number | null }[] }>(`infra/water/consumption?from=${enc(from.toISOString())}&to=${enc(to.toISOString())}&bucket=1d`).catch(() => ({ series: undefined })),
      ]);
      const live = m.items.filter((x) => x.status !== 'retired');
      const sum = (k: 'today_l' | 'month_l') => (live.some((x) => x[k] != null) ? live.reduce((a, x) => a + (x[k] ?? 0), 0) : null);
      this.water = { today: sum('today_l'), month: sum('month_l'), leaks: s.open_leaks ?? 0, week: c.series ?? null, meters: live.length };
    } catch {
      this.water = null;
    }
  }

  private async loadSystems() {
    const [gen, elev, temps] = await Promise.all([
      canAnywhere('generator.view') ? listLive().then((r) => genHomeView(r.devices)).catch(() => null) : Promise.resolve(null),
      listElevators().then((r) => r.elevators).catch(() => [] as Elevator[]),
      listUnits(false).then((r) => r.units).catch(() => [] as TempUnit[]),
    ]);
    const g = gen && gen.total ? gen : null;
    this.sys = g || elev.length || temps.length ? { gen: g, elev, temps } : null;
    this.up();
  }

  // ---------------------------------------------------------------- the media model

  /** The devices of the scope: the room (always on a locked wall panel), its floor, or the house. */
  mList(): PlayerDevice[] {
    const all = this.media ?? [];
    const r = this.h.ctx();
    if (r && (this.h.kioskLocked() || this.h.scope === 'room')) return all.filter((d) => d.area_id === r.id);
    if (r && this.h.scope === 'floor') return all.filter((d) => d.floor_id === r.floor);
    return all;
  }

  mCur(list: PlayerDevice[]): PlayerDevice | null {
    return list.find((m) => m.key === this.mp) ?? list.find((m) => playing(m)) ?? list[0] ?? null;
  }

  /** Mirrors the server's own refusals (the route decides again): availability, power / control, the device's capabilities, a public screen. */
  offered(d: PlayerDevice, c: MediaCmd): boolean {
    const live = d.live;
    if (!live || isDead(live) || live.caps_known === false) return false;
    const caps = d.caps;
    const can = d.can ?? { control: false, power: false, public_ok: true };
    const power = c.command === 'power_on' || c.command === 'power_off' || c.command === 'source';
    if (power ? !can.power : !can.control) return false;
    if (!can.public_ok && needsPublic(c as never)) return false;
    if (c.command === 'power_on') return !!caps.power_on && live.power !== 'on';
    if (c.command === 'power_off') return !!caps.power_off && isOn(live);
    if (!isOn(live)) return false;
    switch (c.command) {
      case 'volume_set': return !!caps.volume_set;
      case 'volume_step': return !!caps.volume_step;
      case 'source': return !!caps.sources;
      case 'key': return (caps.keys ?? []).includes(c.key as never);
      case 'play_item': return !!(caps.favourites || caps.stations || caps.playlists);
      case 'transport': {
        const t = caps.transport ?? { play: false, pause: false, next: false, previous: false, stop: false, seek: false };
        return c.action === 'play_pause' ? t.play || t.pause : !!t[c.action as keyof typeof t];
      }
      default: return false;
    }
  }

  /** One command per deliberate tap (a fresh request id, never retried); the list is read again shortly after. */
  async cmd(d: PlayerDevice, c: MediaCmd, ok = ''): Promise<boolean> {
    try {
      await post(`multimedia/devices/${enc(d.key)}/commands`, { ...c, client_request_id: commandId(), expires_at: expiry() });
      if (ok) this.h.toast(ok);
      window.clearTimeout(this.refreshT);
      this.refreshT = window.setTimeout(() => void this.loadMedia(false), 1200);
      return true;
    } catch (err) {
      this.h.toast(playerErrorText(err));
      return false;
    }
  }

  /** What the play button does now: wake a sleeping device, else pause / play. */
  playCmd(d: PlayerDevice): MediaCmd | null {
    if (d.live && !isOn(d.live)) return this.offered(d, { command: 'power_on' }) ? { command: 'power_on' } : null;
    const c: MediaCmd = { command: 'transport', action: playing(d) ? 'pause' : 'play' };
    if (this.offered(d, c)) return c;
    const pp: MediaCmd = { command: 'transport', action: 'play_pause' };
    return this.offered(d, pp) ? pp : null;
  }

  async loadPicks(d: PlayerDevice): Promise<void> {
    const k = d.key;
    if (d.kind === 'screen' || d.kind === 'receiver') {
      if (this.sources[k]) return;
      this.sources[k] = [];
      try {
        const det = await get<{ sources?: SourceItem[]; apps?: SourceItem[] }>(`multimedia/devices/${enc(k)}`);
        this.sources[k] = (det.sources ?? []).filter((s) => !s.hidden);
      } catch {
        this.sources[k] = [];
      }
    } else if (d.caps.favourites) {
      if (this.library[k]) return;
      this.library[k] = [];
      try {
        const lib = await get<{ items: LibraryItem[] }>(`multimedia/devices/${enc(k)}/library?kind=favourites`);
        this.library[k] = lib.items.filter((i) => !i.hidden);
      } catch {
        this.library[k] = [];
      }
    }
    this.up();
  }

  setVolume(d: PlayerDevice, v: number) {
    if (d.live?.volume) d.live.volume.level = v;
    window.clearTimeout(this.volT);
    this.volT = window.setTimeout(() => void this.cmd(d, { command: 'volume_set', level: v }), 280);
  }

  // ---------------------------------------------------------------- the host's hooks

  /** <sw-home>'s screen switch: one of phase 3's screens, or null when the name is not one. A locked wall panel stays on its room
   * (owner decision 11.11: only that room's media and announcement are offered there). */
  screen(name: string): unknown {
    if (!isP3Screen(name)) return null;
    if (this.h.kioskLocked() && name !== 'media') return this.h.sRoom();
    const fn: Record<P3Screen, (p: P3) => unknown> = { media: sMedia, bills: sBills, water: sWater, systems: sSystems, map: sMap };
    return fn[name](this);
  }

  ovl(o: P3Ovl): unknown {
    return o.sheet === 'remote' ? remoteSheet(this, o.id ?? '') : o.sheet === 'group' ? groupSheet(this, o.id ?? '') : announceSheet(this);
  }

  /** The room screen's category row: "מדיה" when the room has a speaker or a screen. */
  roomChips(r: HRoom | null): [string, string, string, unknown, string, string?][] {
    if (!r || !this.has('media') || !this.media) return [];
    const l = this.media.filter((m) => m.area_id === r.id);
    if (!l.length) return [];
    return [['media', 'מדיה', 'music', l.some(playing) ? 'מתנגן' : 'כבוי', '', 'media']];
  }

  /** The announcement is offered: the category, the permission, the module on with at least one room, and (on a wall panel) its room. */
  canAnnounce(): boolean {
    if (!this.has('announce') || !this.ann) return false;
    const r = this.h.ctx();
    return !this.h.kioskLocked() || (!!r && this.ann.areas.some((a) => a.area_id === r.id));
  }

  openAnnounce() {
    const r = this.h.ctx();
    const here = !!r && !!this.ann?.areas.some((a) => a.area_id === r.id);
    this.draft = { msg: null, text: '', where: here ? 'room' : 'house' };
    this.h.ovl = { type: 'p3', sheet: 'announce' } satisfies P3Ovl;
    this.up();
  }

  /** The electricity screen's links to water and the bill (the mockup's two buttons next to the period switch). */
  energyActs() {
    const w = this.has('water') && this.water ? html`<a class="hbtn" href=${this.h.href('water')} data-p3-go="water">${hi3('drop')}<span class="bt">מים</span></a>` : nothing;
    const b = this.has('bills') && this.bill ? html`<a class="hbtn" href=${this.h.href('bills')} data-p3-go="bills">${hi3('bill')}<span class="bt">החשבון</span></a>` : nothing;
    return html`${w}${b}`;
  }

  mapOn(): boolean {
    return this.has('map') && canAnywhere('map.read') && this.h.d.floors.length > 0 && this.h.visRooms().length > 0;
  }

  /** The hub registry entries of phase 3 (phase 1's "עוד בבית" draws them), each with its live line; none when its capability is off. */
  tiles(): HubTile[] {
    const o: HubTile[] = [];
    const add = (id: HomeModuleP3, href: string, label: string, icon: string, line: string, tone: HubTile['tone'] = '', badge = 0, kiosk = false, act?: string) =>
      o.push({ id, href, label, icon, line, tone, badge, kiosk, act });
    if (this.has('media') && this.media) {
      const n = new Set(this.media.filter(playing).map((m) => m.area_id)).size;
      add('media', 'media', 'מוזיקה ומסכים', 'music', !this.media.length ? 'אין מכשירים מחוברים' : n ? plural(n, 'מתנגן בחדר אחד', 'חדרים מנגנים') : 'הכל שקט', '', 0, true);
    }
    if (this.canAnnounce()) add('announce', 'media', 'כריזה בבית', 'horn', 'הודעה קולית לחדרים', '', 0, true, 'p3Announce');
    if (this.has('bills') && this.bill) {
      const v = money(this.bill.status?.amount_so_far);
      add('bills', 'bills', 'חשבון חשמל', 'bill', v != null ? `${ils(v)} ₪ עד עכשיו` : 'עוד אין חשבון');
    }
    if (this.has('water') && this.water) {
      const w = this.water;
      add('water', 'water', 'מים', 'drop', w.leaks ? 'חשד לנזילה' : w.today != null ? `${ils(w.today)} ליטר היום` : 'עוד אין נתונים', w.leaks ? 'warn' : '');
    }
    if (this.has('systems') && this.sys) {
      const b = this.sysBad();
      add('systems', 'systems', 'מערכות הבית', 'gen', b ? plural(b, 'דבר אחד דורש תשומת לב', 'דברים דורשים תשומת לב') : 'הכל תקין', b ? 'warn' : 'ok');
    }
    if (this.mapOn()) add('map', 'map', 'מפת הבית', 'map', 'הבית לפי קומות');
    return this.h.kioskLocked() ? o.filter((t) => t.kiosk) : o;
  }

  sysBad(): number {
    const s = this.sys;
    if (!s) return 0;
    const g = s.gen;
    return (g && g.supply !== 'mains' && g.supply !== 'unknown' ? 1 : 0) + (g ? g.items.filter((x) => x.state === 'fault' || x.state === 'alarm').length : 0)
      + s.elev.filter((e) => ['fault', 'out_of_service', 'fire_service'].includes(e.state) && !e.stale).length
      + s.temps.filter((t) => !TEMP_OK.has(t.status) && t.status !== 'unknown' && t.status !== 'offline').length;
  }

  // ---------------------------------------------------------------- shared pieces of the screens

  icon = hi3;

  empty(icon: string, title: string, text: string) {
    return html`<div class="empty">${hi3(icon)}<h2>${title}</h2><p>${text}</p></div>`;
  }

  /** A screen whose capability is off for this person (a deep link): the mockup's quiet "not available" state. */
  off(title: string) {
    return html`${this.h.head(title, '')}${this.empty('lock', 'המסך הזה לא זמין', 'מנהל הבית לא הפעיל אותו עבורך. אפשר לבקש ממנו.')}`;
  }

  pill(tone: string, text: string) {
    return html`<span class="dst" data-tone=${tone}><i class="dot"></i><span class="clamp1">${text}</span></span>`;
  }

  seg(opts: [string, string][], cur: string, label: string, on: (v: string) => void) {
    return html`<div class="seg" role="group" aria-label=${label}>${opts.map(([v, t]) => html`<button aria-pressed=${String(v === cur)} @click=${() => on(v)}>${t}</button>`)}</div>`;
  }

  paged<T>(key: string, list: T[], per: number) {
    return paged(list, per, this.h.pg(key));
  }
}

export const playing = (d: PlayerDevice): boolean => !!d.live && d.live.power === 'on' && d.live.play === 'playing';
