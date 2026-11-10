import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  activeText, defaultFavs, doorNoOpenText, doorsText, favOk, favWidth, greeting, homeBarText, keptNote, lightsText, masterLevel, onCount, packPages, paged, roomLights, shadeText,
  type FavWorld,
} from '../src/home/home-logic';
import { GALLERY, galleryCss } from '../src/home/home-wall';
import type { HDoor, HLight, HLoad, HRoom, HZone } from '../src/home/home-api';

// HOME-SIMPLE-2420: the home interface's pure rules (src/home/home-logic.ts) and two source checks: the home interface never names
// the platform or an internal term, and a "turn off" sweep never sends a command to a non-light switch.

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (f: string) => readFileSync(path.join(here, '..', 'src', 'home', f), 'utf8');

const L = (id: string, on: boolean, lvl = 80, sw = false): HLight => ({ id: `light.${id}`, name: id, on, lvl, sw, can: true, ok: true, room: 'r1' });
const Z = (mode: string, target = 23): HZone => ({ id: 'climate.z', name: 'z', room: 'r1', temp: 24, target, mode, modes: ['off', 'cool'], min: 16, max: 30, step: 1, can: true, ok: true, unit: '°C', action: null });
const X = (id: string, on: boolean): HLoad => ({ id: `switch.${id}`, name: id, on, type: 'boiler', guard: false, can: true, ok: true, room: 'r1' });
const R = (id: string, parts: Partial<HRoom> = {}): HRoom => ({ id, name: id, floor: 'g', temp: null, canBulk: true, lights: [], loads: [], zones: [], shades: [], doors: [], cams: [], ...parts });

test('the words: lights, rooms, doors, shutters', () => {
  expect(lightsText(0)).toBe('כל האורות כבויים');
  expect(lightsText(1)).toBe('אור אחד דולק');
  expect(lightsText(3)).toBe('3 אורות דולקים');
  expect(roomLights(R('a'))).toBe('אין כאן התקנים');
  expect(roomLights(R('a', { lights: [L('x', false)] }))).toBe('חשוך');
  expect(activeText(R('a', { lights: [L('x', true), L('y', true)], zones: [Z('cool', 22)] }))).toBe('2 אורות · מיזוג 22°');
  expect(activeText(R('a', { zones: [Z('off')] }))).toBe('הכל כבוי');
  const d = (name: string, locked: boolean, kind: 'door' | 'gate' = 'door'): HDoor => ({ id: name, name, locked, can: true, ok: true, wiskey: false, room: 'r1', kind, noOpen: null });
  expect(doorsText([])).toBe('אין דלתות מחוברות');
  expect(doorsText([d('דלת הכניסה', true)])).toBe('כל הדלתות נעולות');
  expect(doorsText([d('שער החניה', false, 'gate')])).toBe('שער החניה פתוח');
  expect(doorsText([d('a', false), d('b', false)])).toBe('2 דלתות פתוחות');
  expect(shadeText(0)).toBe('סגור');
  expect(shadeText(100)).toBe('פתוח');
  expect(shadeText(40)).toBe('פתוח 40%');
  expect(shadeText(40, true, 'closing')).toBe('נסגר');
  expect(greeting('נועה', new Date(2026, 10, 10, 19, 0))).toBe('ערב טוב, נועה');
  expect(greeting('נועה', new Date(2026, 10, 10, 8, 0))).toBe('בוקר טוב, נועה');
});

test('the house bar and the master dimmer count lights, never other switches', () => {
  const rs = [R('a', { lights: [L('x', true, 40), L('y', true, 80), L('s', true, 100, true)], loads: [X('boiler', true)] }), R('b', { lights: [L('z', false)] })];
  expect(onCount(rs)).toBe(3);
  expect(homeBarText(rs)).toBe('3 אורות דולקים · בחדר אחד');
  expect(masterLevel(rs[0])).toBe(60); // dimmable lights only: (40 + 80) / 2
  expect(keptNote(rs)).toBe(' · boiler נשאר דולק');
  expect(homeBarText([R('c')])).toBe('הכל כבוי בבית');
});

test('paging never returns more than a page, and the widgets pack into pages', () => {
  const p = paged([1, 2, 3, 4, 5], 2, 9);
  expect(p).toEqual({ items: [5], pages: 3, page: 2 });
  expect(paged([], 4, 0)).toEqual({ items: [], pages: 1, page: 0 });
  const pages = packPages([2, 2, 2, 1, 6, 6], (x) => x, 6, 1);
  expect(pages).toEqual([[2, 2, 2], [1], [6], [6]]);
});

test('default favourites follow what the room has; a stale favourite is dropped', () => {
  const room = R('living', { lights: [L('a', true), L('b', false), L('c', false)], loads: [X('boiler', false)], zones: [Z('cool')], cams: ['cam1'] });
  const w: FavWorld = { rooms: [room], cameras: [{ id: 'cam1', name: 'c', ok: true, room: 'living' }], scenes: [{ id: 'evening', name: 'ערב', rooms: [], canRun: true, canEdit: false, sensitive: false, icon: 'evening', does: '' }], hasEnergy: true, hasSecurity: false };
  const f = defaultFavs('living', w);
  expect(f.map((x) => x.t)).toEqual(['light', 'light', 'switch', 'climate', 'cam', 'light']);
  expect(defaultFavs('home', w).map((x) => x.t)).toEqual(['scene', 'energy', 'allLights', 'cam', 'climate']);
  expect(favOk({ t: 'light', id: 'light.gone' }, w)).toBe(false);
  expect(favOk({ t: 'switch', id: 'switch.boiler' }, w)).toBe(true);
  expect(favWidth({ t: 'switch', id: 'x' })).toBe(1);
  expect(favWidth({ t: 'light', id: 'x', w: 2 }, true)).toBe(1); // a light switch: small on/off tile, no resize
  expect(favWidth({ t: 'light', id: 'x' })).toBe(2);
});

test('no home interface source names the platform or an internal term in what it shows', () => {
  for (const f of ['sw-home.ts', 'home-logic.ts', 'home-wall.ts', 'sw-home-admin.ts']) {
    const text = src(f).split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    const shown = [...text.matchAll(/[>'"`]([^<>'"`]*[֐-׿][^<>'"`]*)[<'"`]/g)].map((m) => m[1]).join(' ');
    for (const w of ['Home Assistant', 'go2rtc', 'NVR', 'WebRTC', 'ישות', 'entity']) expect(shown, `${f} shows ${w}`).not.toContain(w);
  }
});

test('the off sweeps reach lights only: lightsOff never touches a load (a non-light switch)', () => {
  const a = src('home-actions.ts');
  const body = a.slice(a.indexOf('export async function lightsOff'), a.indexOf('export async function climateOff'));
  expect(body).toContain("'lights_off'");
  expect(body).toContain('r.lights.filter');
  expect(body).not.toContain('loads');
  expect(body).not.toContain('all_off');
});

test('the switch glyph is an on/off toggle (a pill with its knob), not an exclamation mark', () => {
  const icons = src('home-icons.ts');
  const line = icons.split('\n').find((l) => l.trimStart().startsWith('switch:')) ?? '';
  expect(line).toContain('rx="5"');
  expect(line).toContain('<circle');
  expect(line).not.toMatch(/v4"|v\d+"\/><circle cx="12"/);
});

test('HOME-SIMPLE-2421: a door that may not be opened says why, in calm words; never an open button', () => {
  expect(doorNoOpenText('door_not_mapped')).toBe('הדלת עדיין לא משויכת לעמדה');
  expect(doorNoOpenText('no_permission')).toBe('אין הרשאה לפתוח');
  expect(doorNoOpenText('something_new')).toBe('אי אפשר לפתוח מכאן כרגע');
  const home = src('sw-home.ts');
  expect(home).toContain('(d.locked || d.wiskey) && d.noOpen ?');
});

test('HOME-SIMPLE-2421: the wallpaper gallery is CSS only (no picture files, no addresses) and matches the server list', () => {
  const server = ['dusk', 'tide', 'dune', 'moss', 'ember', 'slate', 'aurora', 'linen'];
  expect(GALLERY.map((g) => g.id)).toEqual(server);
  for (const g of GALLERY) {
    expect(galleryCss(g.id)).toContain('gradient(');
    expect(galleryCss(g.id)).not.toMatch(/url\(|https?:/);
  }
  expect(galleryCss('nope')).toBe('');
});
