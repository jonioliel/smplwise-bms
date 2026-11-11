// HOME-SIMPLE-2420: what the home interface reads, and the view model it draws. Every read is an existing route (or the home
// interface's own /home/* routes); every control goes through the existing control paths (home-actions.ts). Nothing here knows
// a device protocol; the names the person sees are the names the installation gave the devices.
import type { HomeModuleP3 } from './home-p3-logic'; // HOME-V3-P3-2432
import { get, put } from '../api/client';
import { listCameras } from '../api/maps';
import { listMeters, meterSeries } from '../api/electricity-meters';
import { notify, type Notification } from '../api/notifications';
import { httpAutomations, type Item as AutoItem } from '../api/automations';
import { can, canAnywhere } from '../api/session';

export type Interface = 'home' | 'full';
export type HomeModule = 'lights' | 'climate' | 'shades' | 'doors' | 'cameras' | 'energy' | 'alerts' | 'scenes' | 'security' | HomeModuleP3;

export interface InterfacePolicy {
  default_interface: Interface;
  may_switch: boolean;
  home_only: boolean;
  kiosk: boolean;
  kiosk_area_id: string | null;
  rooms: string[] | null;
  modules: HomeModule[] | null;
  interface: Interface;
  configured: boolean;
  admin: boolean;
  kiosk_code_set: boolean;
  /** HOME-SIMPLE-2421: the installation asks this person to choose at the first sign-in (the welcome screen saves it) */
  choose?: boolean;
  /** HOME-SIMPLE-2421: 'none' = a wall panel never leaves its room (no exit code) */
  kiosk_exit?: 'code' | 'none';
  /** HOME-SIMPLE-2421: the room wallpaper the installation offers */
  wallpaper?: 'none' | 'gallery' | 'gallery_image';
  /** HOME-V3-P1-2430: the home administrator marked this person for guest invitations (never a grant by itself) */
  guests?: boolean;
  /** HOME-V3-P1-2430: the administrator's wallpaper per room for everyone ('g:<gallery>' | 'img') */
  room_wallpapers?: Record<string, string>;
}

// ---------------------------------------------------------------- wire shapes (GET /home/overview)

interface WireRow {
  entity_id: string;
  name: string;
  domain: string;
  state: string | null;
  available: boolean;
  active: boolean;
  can_control: boolean;
}
export interface WireLight extends WireRow { brightness_pct: number | null; dimmable: boolean; kind: 'light' | 'switch'; protected?: boolean; load_type?: string | null }
export interface WireClimate extends WireRow {
  climate_kind: string | null; hvac_mode: string | null; hvac_modes: string[] | null; hvac_action: string | null;
  current_temperature: number | null; target_temperature: number | null; min_temp: number | null; max_temp: number | null; target_temp_step: number | null;
  preset_mode: string | null; preset_modes: string[] | null; unit: string | null;
}
export interface WireCover extends WireRow { position: number | null; moving: boolean }
export interface WireLock extends WireRow { locked: boolean; wiskey_door: boolean; unlock_reason?: string; can_unlock?: boolean }
export interface WireRoom {
  id: string; name: string; floor_id: string; temperature: number | null; open_count: number; can_bulk: boolean;
  lights: WireLight[]; switches: WireLight[]; climate: WireClimate[]; shades: WireCover[]; locks: WireLock[];
}
export interface Overview {
  weather?: { t: number | null; text: string } | null;
  floors: { id: string; name: string; rooms: string[] }[];
  rooms: WireRoom[];
  can_bulk: boolean;
  scoped: boolean;
  modules: HomeModule[];
  policy: InterfacePolicy;
}

export type FavType = 'scene' | 'light' | 'switch' | 'climate' | 'shade' | 'cam' | 'door' | 'allLights' | 'energy' | 'security';
export interface Fav { t: FavType; id?: string; w?: 1 | 2 }
export interface HomeLayout {
  fav_rooms?: string[];
  hidden_rooms?: string[];
  start?: 'home' | 'last' | 'fixed';
  start_room?: string | null;
  scheme?: 'dark' | 'light' | 'auto';
  theme?: string | null;
  big_text?: boolean;
  welcomed?: boolean;
  /** HOME-SIMPLE-2421: per room, 'g:<gallery name>' or 'img' (the person's own picture) */
  wallpapers?: Record<string, string>;
}
export interface HomePrefs { favourites: Record<string, Fav[]>; layout: HomeLayout; seed: Record<string, Fav[]> }

export const getInterface = () => get<InterfacePolicy>('home/interface');
export const switchInterface = (iface: Interface) => put<InterfacePolicy>('me/interface', { interface: iface });
export const getOverview = () => get<Overview>('home/overview');
export const getHomePrefs = () => get<HomePrefs>('home/prefs');
export const putHomePrefs = (body: { favourites?: Record<string, Fav[]>; layout?: HomeLayout }) => put<HomePrefs>('home/prefs', body);

// ---------------------------------------------------------------- the view model

export interface HLight { id: string; name: string; on: boolean; lvl: number; sw: boolean; can: boolean; ok: boolean; room: string }
export interface HLoad { id: string; name: string; on: boolean; type: 'boiler' | 'fridge' | 'socket' | 'pump' | 'other'; guard: boolean; can: boolean; ok: boolean; room: string }
export interface HZone {
  id: string; name: string; room: string; temp: number | null; target: number | null; mode: string; modes: string[];
  min: number; max: number; step: number; can: boolean; ok: boolean; unit: string; action: string | null;
}
export interface HShade { id: string; name: string; pos: number | null; state: string | null; moving: boolean; can: boolean; ok: boolean; room: string }
export interface HDoor { id: string; name: string; locked: boolean; can: boolean; ok: boolean; wiskey: boolean; room: string; kind: 'door' | 'gate'; /** HOME-SIMPLE-2421: why opening is not offered (null = it is) */ noOpen: string | null }
export interface HRoom {
  id: string; name: string; floor: string; temp: number | null; canBulk: boolean;
  lights: HLight[]; loads: HLoad[]; zones: HZone[]; shades: HShade[]; doors: HDoor[]; cams: string[];
}
export interface HFloor { id: string; name: string; short: string }
export interface HCamera { id: string; name: string; ok: boolean; room: string | null }
export interface HScene { id: string; name: string; rooms: string[]; canRun: boolean; canEdit: boolean; sensitive: boolean; icon: string; does: string; lastRun?: string | null }
export interface HAlert { id: string; tone: 'warn' | 'info' | 'ok'; icon: string; text: string; when: string; open: boolean; canAck: boolean; link: string; door: Notification['door'] }
export interface HEnergy { today: number[]; usual: number[]; week: [string, number | null, number][]; byRoom: [string, number][]; price: number | null }

export interface HomeData {
  floors: HFloor[];
  rooms: HRoom[];
  cameras: HCamera[];
  scenes: HScene[];
  alerts: HAlert[];
  energy: HEnergy | null;
  canBulk: boolean;
  modules: Set<HomeModule>;
  policy: InterfacePolicy;
  weather: { t: number | null; text: string } | null;
}

const GATE_WORDS = /שער|gate/i;

const loadType = (name: string, t: string | null | undefined): HLoad['type'] => {
  if (t === 'water_heater' || /דוד|boiler|heater/i.test(name)) return 'boiler';
  if (/מקרר|מקפיא|fridge|freezer/i.test(name)) return 'fridge';
  if (t === 'valve' || /משאבה|pump/i.test(name)) return 'pump';
  if (t === 'outlet' || /שקע|socket|plug|outlet/i.test(name)) return 'socket';
  return 'other';
};

export function shortFloor(name: string): string {
  const s = name.replace(/^קומת\s+/, '').replace(/^קומה\s+/, '');
  return s.length > 10 ? s.slice(0, 10) : s;
}

export function adaptOverview(ov: Overview, cameras: HCamera[]): Pick<HomeData, 'floors' | 'rooms' | 'canBulk' | 'modules' | 'policy' | 'weather'> {
  const rooms: HRoom[] = ov.rooms.map((r) => {
    const lights: HLight[] = r.lights.map((l) => ({
      id: l.entity_id, name: l.name, on: l.active, lvl: l.dimmable ? (l.brightness_pct ?? (l.active ? 100 : 80)) : 100, sw: !l.dimmable,
      can: l.can_control && l.available, ok: l.available, room: r.id,
    }));
    const loads: HLoad[] = r.switches.map((s) => ({
      id: s.entity_id, name: s.name, on: s.active, type: loadType(s.name, s.load_type), guard: !!s.protected, can: s.can_control && s.available, ok: s.available, room: r.id,
    }));
    const zones: HZone[] = r.climate.map((c) => ({
      id: c.entity_id, name: r.climate.length > 1 ? c.name : r.name, room: r.id, temp: c.current_temperature, target: c.target_temperature,
      mode: c.hvac_mode ?? 'off', modes: (c.hvac_modes ?? ['off', 'cool', 'heat', 'auto']).filter((m) => ['off', 'cool', 'heat', 'auto', 'heat_cool', 'dry', 'fan_only'].includes(m)),
      min: c.min_temp ?? 16, max: c.max_temp ?? 30, step: c.target_temp_step ?? 1, can: c.can_control && c.available, ok: c.available, unit: c.unit ?? '°C', action: c.hvac_action,
    }));
    const shades: HShade[] = r.shades.map((s) => ({ id: s.entity_id, name: s.name, pos: s.position ?? (s.state === 'open' ? 100 : s.state === 'closed' ? 0 : null), state: s.state, moving: s.moving, can: s.can_control && s.available, ok: s.available, room: r.id }));
    const doors: HDoor[] = r.locks.map((d) => ({ id: d.entity_id, name: d.name, locked: d.locked, can: d.can_control && d.available, ok: d.available, wiskey: d.wiskey_door, room: r.id, kind: GATE_WORDS.test(d.name) ? 'gate' : 'door', noOpen: d.unlock_reason && d.unlock_reason !== 'ok' ? d.unlock_reason : null }));
    return { id: r.id, name: r.name, floor: r.floor_id, temp: r.temperature, canBulk: r.can_bulk, lights, loads, zones, shades, doors, cams: cameras.filter((c) => c.room === r.id).map((c) => c.id) };
  });
  const floors = ov.floors.map((f) => ({ id: f.id, name: f.name, short: shortFloor(f.name) }));
  return { floors, rooms, canBulk: ov.can_bulk, modules: new Set(ov.modules), policy: ov.policy, weather: ov.weather ?? null };
}

export async function loadCameras(): Promise<HCamera[]> {
  if (!canAnywhere('video.live') && !canAnywhere('map.read')) return [];
  try {
    const r = await listCameras();
    return r.cameras.map((c) => {
      const x = c as unknown as { id: string; name: string; can_view_live?: boolean; recorder_enabled?: boolean; area_id?: string | null; online?: boolean | null };
      return { id: x.id, name: x.name, ok: x.can_view_live !== false && x.recorder_enabled !== false && x.online !== false, room: x.area_id ?? null };
    });
  } catch {
    return [];
  }
}

const SCENE_ICON: [RegExp, string][] = [[/בוקר|morning/i, 'morning'], [/יציאה|leave|away/i, 'leave'], [/ערב|evening/i, 'evening'], [/לילה|night|sleep/i, 'night'], [/חזרה|arrive|home/i, 'arrive']];

export async function loadScenes(): Promise<HScene[]> {
  try {
    const r = await httpAutomations.list({ kind: 'scene', limit: 200 } as never);
    return r.items
      .filter((s: AutoItem) => !s.hidden && s.state !== 'invalid' && s.can.run)
      .map((s: AutoItem) => ({
        id: s.id, name: s.name, rooms: s.areas.map((a) => a.id), canRun: s.can.run, canEdit: s.can.edit && can('scene.manage'), sensitive: s.sensitive,
        icon: SCENE_ICON.find(([re]) => re.test(s.name))?.[1] ?? 'scenes', does: s.description || s.sentence || '', lastRun: s.last_run?.at ?? null,
      }));
  } catch {
    return [];
  }
}

const SEVERITY_TONE: Record<string, HAlert['tone']> = { critical: 'warn', alert: 'warn', info: 'info' };
const CATEGORY_ICON: Record<string, string> = { doors: 'door', door: 'door', water: 'drop', leak: 'drop', battery: 'battery', intercom: 'bell', camera: 'cam', security: 'shield' };

export function relTime(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const min = Math.round((now - t) / 60000);
  if (min < 1) return 'עכשיו';
  if (min < 60) return min === 1 ? 'לפני דקה' : `לפני ${min} דקות`;
  const d = new Date(t);
  const hm = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });
  const today = new Date(now).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' }) === d.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
  return today ? `היום, ${hm}` : `${d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', timeZone: 'Asia/Jerusalem' })}, ${hm}`;
}

export async function loadAlerts(): Promise<HAlert[]> {
  try {
    const r = await notify().list({ state: 'all', limit: 40 } as never);
    return r.notifications.map((n) => ({
      id: n.id, tone: n.state === 'open' ? SEVERITY_TONE[n.severity] ?? 'info' : 'ok', icon: CATEGORY_ICON[n.category] ?? (n.door ? 'door' : 'bell'),
      text: [n.title, n.place_name].filter(Boolean).join(' · '), when: relTime(n.last_at), open: n.state === 'open', canAck: n.can_ack, link: n.link, door: n.door,
    }));
  } catch {
    return [];
  }
}

const DAY = 86_400_000;
const HE_DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

function startOfDayLocal(at: number): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Today by hour and the usual hour (the mean of the same hour over the 7 days before), this week by day and the usual day (the mean of
 * the 4 weeks before), and today by room - summed over the meters the person may see (at most 12, the busiest of today first). */
export async function loadEnergy(): Promise<HEnergy | null> {
  if (!canAnywhere('energy.view')) return null;
  let meters;
  try {
    meters = await listMeters();
  } catch {
    return null;
  }
  if (!meters.length) return { today: [], usual: [], week: [], byRoom: [], price: null };
  const top = [...meters].sort((a, b) => (b.today_kwh ?? 0) - (a.today_kwh ?? 0)).slice(0, 12);
  const now = Date.now();
  const d0 = startOfDayLocal(now);
  const hourNow = new Date(now).getHours();
  const today = new Array<number>(hourNow + 1).fill(0);
  const usualSum = new Array<number>(24).fill(0);
  const w0 = d0 - new Date(now).getDay() * DAY;
  const weekDays = new Array<number | null>(7).fill(null);
  const usualDay = new Array<number>(7).fill(0);
  const iso = (t: number) => new Date(t).toISOString();
  await Promise.all(top.map(async (m) => {
    try {
      const hours = await meterSeries(m.id, '1h', iso(d0 - 7 * DAY), iso(now));
      for (const p of hours) {
        const t = Date.parse(p.t);
        const h = new Date(t).getHours();
        if (t >= d0) { if (h <= hourNow) today[h] += p.kwh; } else usualSum[h] += p.kwh / 7;
      }
      const days = await meterSeries(m.id, '1d', iso(w0 - 28 * DAY), iso(now));
      for (const p of days) {
        const t = Date.parse(p.t);
        const wd = new Date(t).getDay();
        if (t >= w0) weekDays[wd] = (weekDays[wd] ?? 0) + p.kwh; else usualDay[wd] += p.kwh / 4;
      }
    } catch {
      /* one meter that does not answer leaves the others */
    }
  }));
  const byArea = new Map<string, number>();
  for (const m of meters) byArea.set(m.area_name || 'שאר הבית', (byArea.get(m.area_name || 'שאר הבית') ?? 0) + (m.today_kwh ?? 0));
  const byRoom = [...byArea.entries()].sort((a, b) => b[1] - a[1]);
  const round = (v: number) => Math.round(v * 100) / 100;
  return {
    today: today.map(round),
    usual: usualSum.map(round),
    week: HE_DAYS.map((label, i) => [label, weekDays[i] == null ? null : round(weekDays[i] as number), round(usualDay[i])]),
    byRoom: byRoom.map(([n, v]) => [n, round(v)]),
    price: null,
  };
}
