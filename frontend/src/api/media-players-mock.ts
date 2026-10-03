/**
 * CR-016: the MOCK adapter of the players API (docs/architecture/MEDIA_PLAYERS_API.md; the client is ./media-players.ts).
 * Two fixture houses, the platform mix of the three read-only probes of 2026-10-01 in miniature:
 *  - 'ma'    (systems H and V): a music library answers (source of truth MA): the mockup's speakers plus a WiiM pair grouped in both
 *            layers, a Cast + MA pair, a Denon receiver with Main / Zone2, an unavailable speaker (last good mask, `caps_known`
 *            false) and a restored one that never reported a mask (everything off), unplaced speakers, a speaker in a "קיבוץ לא
 *            תואם" state, a live cross-brand sync group of four (resolved to ONE consistent group although its members disagree
 *            on `group_members` at the source) and a static group.
 *  - 'sonos' (system K): NO Music Assistant - six Sonos speakers (favourites and stations from the native list, no playlists, no
 *            next item), no floors, SmartThings mirrors hidden (never visible to a client), and the non-physical entries
 *            (eight Jellyfin sessions sharing one name, two group helpers, a Spotify source) only through `nonPhysical()`.
 * Same shapes and error codes as the backend; mutations apply at once (specs stay deterministic) and are kept for the session.
 * No network, no timers; the clock is `store.clock` (specs pin the night window with it).
 *
 * Load order: this file and media-players.ts import each other. Nothing here reads a value of media-players.ts (or media-screens.ts)
 * while the module evaluates; the seed tables are functions, built on first use. The mock is selected exactly like CR-015's.
 *
 * Owned by the coordinator with media-players.ts. Names and values are invented; nothing here comes from a real system.
 */
import { ApiError } from './client';
import type { AdminDevice, AdminEndpoint } from './media-admin';
import { DEFAULT_REMOTE, type BulkScope, type CommandResult, type Glyph, type PowerState, type SourceItem } from './media-screens';
import {
  GROUPABLE_KINDS, ITEM_REF_RE, NON_PHYSICAL_KINDS, PLAYER_KINDS, PRESET_RUNNING_MS, clampVolume, effectiveCeiling, groupLevel, groupSectionOffered, groupVolumePlan, joinDiff, matchesState, needsConfirmation,
  playerCommandOffered, unplacedBucket,
  type FavouritesCuration, type GroupJoinBody, type GroupLeaveBody, type GroupPreset, type GroupPresetBody, type GroupPreview, type GroupRecord,
  type GroupRunResult, type GroupVolumeBody, type LibraryItem, type LibraryKind, type LibraryPage, type MediaGroup, type MemberOutcome, type MergeSuggestion,
  type MusicProvider, type PausePreview, type PlayerCaps, type PlayerCommand, type PlayerDevice, type PlayerDeviceDetail, type PlayerKind, type PlayerListQuery,
  type PlayerNow, type PlayerStatus, type PlayersAdapter, type QueueEntry, type ReceiverZone, type RepeatMode, type UpNext, type VolumeNight,
  type BrowsePage, type BrowseType, type MaConnection, type MaConnectionBody, type MaTest, type QueueEditBody, type QueueEditResult, type QueueList, type QueueRow,
} from './media-players';

export type MockHouse = 'ma' | 'sonos';

// ------------------------------------------------------------------------------------------------ content (built on first use)

interface Track { title: string; artist: string | null; album: string | null; dur: number | null; hue: number; glyph: Glyph; station?: boolean }
interface Item { kind: LibraryItem['kind']; name: string; artist: string | null; glyph: Glyph; hue: number; /** what playing it starts */ plays: string; count: number }

function tracks(): Record<string, Track> {
  return {
    blue: { title: 'Blue in Green', artist: 'Miles Davis', album: 'Kind of Blue', dur: 337, hue: 210, glyph: 'music' },
    allblues: { title: 'All Blues', artist: 'Miles Davis', album: 'Kind of Blue', dur: 692, hue: 210, glyph: 'music' },
    holo: { title: 'Holocene', artist: 'Bon Iver', album: 'Bon Iver, Bon Iver', dur: 336, hue: 32, glyph: 'music' },
    erev: { title: 'ערב טוב', artist: 'שלומי שבן', album: 'צהוב', dur: 254, hue: 42, glyph: 'music' },
    glz: { title: 'גלגלצ', artist: null, album: null, dur: null, hue: 220, glyph: 'antenna', station: true },
    b88: { title: '88FM', artist: null, album: null, dur: null, hue: 24, glyph: 'antenna', station: true },
    kan: { title: 'כאן תרבות', artist: null, album: null, dur: null, hue: 140, glyph: 'antenna', station: true },
    jazzfm: { title: 'Jazz FM', artist: null, album: null, dur: null, hue: 235, glyph: 'antenna', station: true },
    classic: { title: 'קול המוזיקה', artist: null, album: null, dur: null, hue: 295, glyph: 'antenna', station: true },
  };
}
/** Library items by id; `plays` is the track (or station) that starts. Playlists start a track and report their own length. */
function items(): Record<string, Item> {
  const t = tracks();
  const fromTrack = (id: string, kind: Item['kind'] = 'track'): Item => ({ kind, name: t[id].title, artist: t[id].artist, glyph: t[id].glyph, hue: t[id].hue, plays: id, count: 1 });
  const pl = (name: string, n: number, hue: number, plays: string): Item => ({ kind: 'playlist', name, artist: `${n} שירים`, glyph: 'music', hue, plays, count: n });
  return {
    blue: fromTrack('blue'), holo: fromTrack('holo'), erev: fromTrack('erev'),
    glz: fromTrack('glz', 'radio'), b88: fromTrack('b88', 'radio'), kan: fromTrack('kan', 'radio'), jazzfm: fromTrack('jazzfm', 'radio'), classic: fromTrack('classic', 'radio'),
    morning: pl('פלייליסט בוקר', 42, 38, 'erev'), jazz: pl('ג׳אז שקט', 68, 245, 'blue'), kids: pl('שירי ילדים', 120, 330, 'erev'), focus: pl('ריכוז', 35, 172, 'holo'), party: pl('מסיבה', 80, 280, 'erev'),
    // phase 2b: what only the library tab lists (browse by type)
    allblues: fromTrack('allblues'),
    kob: { kind: 'album', name: 'Kind of Blue', artist: 'Miles Davis', glyph: 'music', hue: 210, plays: 'blue', count: 5 },
    biv: { kind: 'album', name: 'Bon Iver, Bon Iver', artist: 'Bon Iver', glyph: 'music', hue: 32, plays: 'holo', count: 10 },
    tzahov: { kind: 'album', name: 'צהוב', artist: 'שלומי שבן', glyph: 'music', hue: 42, plays: 'erev', count: 12 },
    miles: { kind: 'artist', name: 'Miles Davis', artist: null, glyph: 'smile', hue: 210, plays: 'blue', count: 1 },
    boniver: { kind: 'artist', name: 'Bon Iver', artist: null, glyph: 'smile', hue: 32, plays: 'holo', count: 1 },
    shaben: { kind: 'artist', name: 'שלומי שבן', artist: null, glyph: 'smile', hue: 42, plays: 'erev', count: 1 },
  };
}
/** Phase 2b: the order of the library tab per type (ids of `items()`). */
const BROWSE: Record<BrowseType, string[]> = {
  track: ['allblues', 'blue', 'holo', 'erev'],
  album: ['biv', 'kob', 'tzahov'],
  artist: ['boniver', 'miles', 'shaben'],
  playlist: ['focus', 'jazz', 'party', 'morning', 'kids'],
  radio: ['b88', 'glz', 'jazzfm', 'kan', 'classic'],
};
/** Phase 2b: the queue the mock invents for a leader that plays (names cycle through the tracks). */
const QUEUE_LEN = 12;
const LIBRARY: Record<LibraryKind, string[]> = {
  favourites: ['blue', 'holo', 'glz', 'jazz', 'erev', 'morning'],
  stations: ['glz', 'b88', 'kan', 'jazzfm', 'classic'],
  playlists: ['morning', 'jazz', 'focus', 'kids', 'party'],
};
/** The order "next" walks through. */
const TRACK_ORDER = ['blue', 'allblues', 'holo', 'erev'];

/** A stable hex string of `len` chars from a label (an item_ref or a preset id: ^[a-f0-9]{24}$ / hex32). */
function hex(label: string, len: number): string {
  let out = '';
  for (let i = 0; out.length < len; i++) {
    let h = (0x811c9dc5 ^ (i * 0x9e3779b1)) >>> 0;
    for (let c = 0; c < label.length; c++) h = Math.imul(h ^ label.charCodeAt(c), 0x01000193) >>> 0;
    out += h.toString(16).padStart(8, '0');
  }
  return out.slice(0, len);
}
const refOf = (itemId: string): string => hex(`item:${itemId}`, 24);

// ------------------------------------------------------------------------------------------------ seeds

type St = 'playing' | 'paused' | 'idle' | 'off' | 'unavailable';
/** pw power, vset volume, lib music layer (queue / favourites / shuffle / repeat / seek), grp live GROUPING, src sources, snd sound modes, tp plain transport (play / pause). */
type Feat = 'pw' | 'vset' | 'lib' | 'grp' | 'src' | 'snd' | 'tp';
interface Seed {
  id: string; name: string; kind: PlayerKind; area: readonly [string, string] | null; floor: readonly [string, string] | null; st: St;
  vol: number; provider: MusicProvider; feat: Feat[]; layer?: 'ma' | 'vendor';
  track?: string; pos?: number; queue?: { count: number; index: number }; shuffle?: boolean; repeat?: RepeatMode;
  max?: number; night?: VolumeNight; conflict?: boolean; since?: string;
  /** Restored entity that never reported a mask: nothing is known (every control off). */
  nocaps?: boolean;
  srcs?: string[]; src?: string; modes?: string[]; mode?: string; zone2?: Omit<ReceiverZone, 'id' | 'name'>;
}
interface Fixture { seeds: Seed[]; groups: Record<string, string[]>; provider: MusicProvider; presets: { name: string; leader: string; members: string[]; volumes: Record<string, number> | null }[]; suggestions: Omit<MergeSuggestion, 'id'>[]; helpers: { id: string; name: string; members: string[] }[] }

const G: readonly [string, string] = ['g', 'קומת קרקע'];
const U1: readonly [string, string] = ['u1', 'קומה 1'];
const B: readonly [string, string] = ['b', 'מרתף'];
const area = (id: string, name: string): readonly [string, string] => [id, name];
const FULL: Feat[] = ['pw', 'vset', 'lib', 'grp'];
const RECEIVER_SOURCES = [
  { id: 'TV', label: 'טלוויזיה · HDMI 2' }, { id: 'Game', label: 'נגן · HDMI 1' }, { id: 'Tuner', label: 'רדיו' }, { id: 'Bluetooth', label: 'Bluetooth' },
];

/** The house with a music library: the mockup's speakers plus what the probes showed on systems H and V. */
function maHouse(): Fixture {
  return {
    provider: 'ma',
    seeds: [
      // a WiiM pair, grouped in both layers: the vendor group is an alias, MA answers
      { id: 'liv', name: 'רמקול סלון', kind: 'speaker', area: area('living', 'סלון'), floor: G, st: 'playing', track: 'blue', pos: 192, vol: 34, max: 70, provider: 'ma', feat: FULL, layer: 'ma', queue: { count: 12, index: 3 }, shuffle: false, repeat: 'off' },
      { id: 'kit', name: 'רמקול מטבח', kind: 'speaker', area: area('kitchen', 'מטבח'), floor: G, st: 'playing', vol: 22, provider: 'ma', feat: FULL, layer: 'ma' },
      // a Cast + MA pair (Cast answers play only; MA the music layer)
      { id: 'per', name: 'רמקול פרגולה', kind: 'speaker', area: area('pergola', 'פרגולה'), floor: G, st: 'playing', track: 'glz', vol: 40, provider: 'ma', feat: FULL, layer: 'ma', queue: { count: 1, index: 0 }, shuffle: false, repeat: 'off' },
      // grouped in the vendor layer and not in MA
      { id: 'gst', name: 'רמקול חדר אורחים', kind: 'speaker', area: area('guest', 'חדר אורחים'), floor: G, st: 'idle', vol: 18, provider: 'ma', feat: FULL, layer: 'ma', conflict: true },
      // a Denon receiver: Main + Zone2 (one device with zones), HEOS for the queue, MA for the rich music
      { id: 'ampl', name: 'מגבר סלון', kind: 'receiver', area: area('living', 'סלון'), floor: G, st: 'idle', vol: 38, provider: 'heos', feat: ['pw', 'vset', 'src', 'snd'],
        srcs: RECEIVER_SOURCES.map((s) => s.id), src: 'TV', modes: ['סטריאו', 'קולנוע', 'מוזיקה', 'Dolby Surround', 'Pure Direct'], mode: 'סטריאו', zone2: { power: 'off', volume: 20, source_id: 'Tuner', sound_mode: null } },
      { id: 'par', name: 'רמקול הורים', kind: 'speaker', area: area('parents', 'חדר הורים'), floor: U1, st: 'paused', track: 'holo', pos: 85, vol: 15, night: { from: '22:00', to: '07:00', max: 25 }, provider: 'ma', feat: ['vset', 'lib', 'grp'], layer: 'ma', queue: { count: 8, index: 1 }, shuffle: true, repeat: 'all' },
      { id: 'kids', name: 'נגן ילדים', kind: 'player', area: area('kids', 'חדר ילדים'), floor: U1, st: 'idle', vol: 20, max: 50, provider: 'none', feat: ['pw', 'vset', 'tp'] },
      { id: 'off', name: 'רמקול חדר עבודה', kind: 'speaker', area: area('office', 'חדר עבודה'), floor: U1, st: 'off', vol: 25, provider: 'ma', feat: FULL, layer: 'ma' },
      { id: 'bamp', name: 'מגבר מרתף', kind: 'receiver', area: area('basement', 'מרתף'), floor: B, st: 'off', vol: 45, provider: 'none', feat: ['pw', 'vset', 'src'],
        srcs: ['TV', 'Game', 'Bluetooth'], src: 'TV' },
      // unavailable: the card keeps the last good mask (greyed), `caps_known` is false
      { id: 'gym', name: 'רמקול חדר כושר', kind: 'speaker', area: area('gym', 'חדר כושר'), floor: B, st: 'unavailable', since: '2026-09-30T11:20:00Z', vol: 30, provider: 'ma', feat: FULL, layer: 'ma' },
      // unplaced
      { id: 'balc', name: 'רמקול מרפסת', kind: 'speaker', area: null, floor: null, st: 'idle', vol: 30, provider: 'ma', feat: ['vset', 'lib', 'grp'], layer: 'ma' },
      // restored, unplaced, never reported a mask: nothing is known
      { id: 'bath', name: 'רמקול אמבטיה', kind: 'speaker', area: null, floor: null, st: 'unavailable', since: '2026-09-30T08:00:00Z', vol: 20, provider: 'ma', feat: [], nocaps: true },
      // the live cross-brand MA sync group of four (studio leader, HEOS, WiiM, Cast + MA): the members disagree on `group_members` at the source, the model resolves ONE group
      { id: 'stu', name: 'רמקול סטודיו', kind: 'speaker', area: area('studio', 'סטודיו'), floor: U1, st: 'playing', track: 'allblues', pos: 40, vol: 30, provider: 'ma', feat: FULL, layer: 'ma', queue: { count: 20, index: 2 }, shuffle: false, repeat: 'off' },
      { id: 'hal', name: 'רמקול מסדרון', kind: 'speaker', area: area('hall', 'מסדרון'), floor: G, st: 'playing', vol: 26, provider: 'ma', feat: FULL, layer: 'ma' },
      { id: 'ter', name: 'רמקול טרסה', kind: 'speaker', area: null, floor: null, st: 'playing', vol: 24, provider: 'ma', feat: FULL, layer: 'ma' },
      { id: 'pat', name: 'רמקול פטיו', kind: 'speaker', area: area('patio', 'פטיו'), floor: G, st: 'playing', vol: 24, provider: 'ma', feat: FULL, layer: 'ma' },
      // a static MA group (kind group): members are other devices
      { id: 'sgrp', name: 'קבוצת מרפסת ועבודה', kind: 'group', area: null, floor: null, st: 'idle', vol: 30, provider: 'ma', feat: ['vset', 'lib', 'grp'], layer: 'ma' },
    ],
    groups: { liv: ['kit'], stu: ['hal', 'ter', 'pat'], sgrp: ['balc', 'off'] },
    presets: [
      { name: 'סלון + מטבח', leader: 'liv', members: ['liv', 'kit'], volumes: null },
      { name: 'קומת קרקע', leader: 'liv', members: ['liv', 'kit', 'per'], volumes: null },
      { name: 'ערב שקט', leader: 'par', members: ['par', 'off'], volumes: { par: 18, off: 18 } },
      { name: 'מסיבה', leader: 'liv', members: ['liv', 'kit', 'per', 'par', 'off'], volumes: { liv: 45, kit: 45, per: 50, par: 30, off: 35 } },
    ],
    suggestions: [
      { endpoint_id: 'ha:media_player.cast_pergola', device_key: 'mp-per', rule: '3b', reason: 'same_model', endpoint_label: 'Cast · רמקול פרגולה', device_name: 'רמקול פרגולה' },
      { endpoint_id: 'ha:media_player.cast_kids', device_key: 'mp-kids', rule: '3b', reason: 'same_model', endpoint_label: 'Cast · מסך חדר ילדים', device_name: 'נגן ילדים' },
      { endpoint_id: 'ha:media_player.cast_balcony', device_key: 'mp-balc', rule: '5b', reason: 'same_name_area_one_side', endpoint_label: 'Cast · רמקול מרפסת', device_name: 'רמקול מרפסת' },
    ],
    helpers: [],
  };
}

/** The house without Music Assistant (system K): six Sonos, no floors; the music layer is the Sonos entity. */
function sonosHouse(): Fixture {
  const sn = (over: Partial<Seed> & Pick<Seed, 'id' | 'name' | 'area' | 'st' | 'vol'>): Seed => ({ kind: 'speaker', floor: null, provider: 'sonos', feat: ['vset', 'lib', 'grp'], layer: 'vendor', ...over });
  return {
    provider: 'sonos',
    seeds: [
      sn({ id: 'liv', name: 'רמקול סלון', area: area('living', 'סלון'), st: 'playing', track: 'erev', pos: 61, vol: 28, queue: { count: 14, index: 2 }, shuffle: false, repeat: 'off' }),
      sn({ id: 'kit', name: 'רמקול מטבח', area: area('kitchen', 'מטבח'), st: 'playing', vol: 20 }),
      sn({ id: 'bed', name: 'רמקול חדר שינה', area: area('bedroom', 'חדר שינה'), st: 'paused', track: 'holo', pos: 120, vol: 12, max: 40, night: { from: '22:30', to: '07:00', max: 20 }, queue: { count: 6, index: 4 }, shuffle: false, repeat: 'all' }),
      sn({ id: 'off', name: 'רמקול חדר עבודה', area: area('office', 'חדר עבודה'), st: 'idle', vol: 25 }),
      sn({ id: 'balc', name: 'רמקול מרפסת', area: area('balcony', 'מרפסת'), st: 'idle', vol: 30 }),
      sn({ id: 'bath', name: 'רמקול אמבטיה', area: null, st: 'idle', vol: 18 }),
    ],
    groups: { liv: ['kit'] },
    presets: [
      { name: 'סלון + מטבח', leader: 'liv', members: ['liv', 'kit'], volumes: null },
      { name: 'כל הבית', leader: 'liv', members: ['liv', 'kit', 'bed', 'off', 'balc'], volumes: { liv: 30, kit: 30, bed: 20, off: 25, balc: 30 } },
    ],
    suggestions: [
      { endpoint_id: 'ha:media_player.smartthings_bathroom', device_key: 'mp-bath', rule: '5b', reason: 'same_name_area_one_side', endpoint_label: 'SmartThings · רמקול אמבטיה', device_name: 'רמקול אמבטיה' },
    ],
    // helper groups: a fan-out with no GROUPING of its own, a shortcut in the groups tab; never joinable
    helpers: [{ id: 'vg5', name: 'קבוצת עזר · 5 רמקולים', members: ['liv', 'kit', 'bed', 'off', 'balc'] }, { id: 'vg2', name: 'קבוצת עזר · 2 מסכים', members: [] }],
  };
}

// ------------------------------------------------------------------------------------------------ rows

interface Row {
  seed: Seed;
  /** The administrator approved it (CR §5.1: only approved devices reach the pages; every seed starts approved, as an installation after "אשר את כל הנגנים"). */
  approved: boolean;
  st: St;
  track: string | null;
  pos: number;
  posAt: string;
  vol: number;
  muted: boolean;
  queue: { count: number; index: number } | null;
  shuffle: boolean;
  repeat: RepeatMode;
  src: string | null;
  mode: string | null;
  zone2: Omit<ReceiverZone, 'id' | 'name'> | null;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const fail = (status: number, code: string, message: string, details: Record<string, unknown> = {}): never => {
  throw new ApiError(status, { code, user_message: message, retryable: false, correlation_id: 'mock', details });
};
const listRow = (d: PlayerDeviceDetail): PlayerDevice => {
  const { sources: _s, apps: _a, recent: _r, remote: _m, model_keys: _k, ...rest } = d;
  return clone(rest);
};
const keyOf = (id: string): string => `mp-${id}`;
/** What a command to a static group fans out to (volume is the group volume route's). */
const GROUP_FAN: readonly string[] = ['power_on', 'power_off', 'source', 'sound_output', 'transport', 'seek', 'shuffle', 'repeat', 'play_item'];
const idOf = (key: string): string => key.replace(/^mp-/, '');


export class PlayersMockStore implements PlayersAdapter {
  readonly house: MockHouse;
  rows: Row[];
  /** leader id -> member ids (live groups and static groups alike). */
  grp: Record<string, string[]>;
  presetState: { id: string; name: string; leader_key: string; member_keys: string[]; volumes: Record<string, number> | null; revision: number; running: GroupPreset['running'] }[];
  curation: FavouritesCuration;
  /** Every command the mock accepted, in order (specs assert on it the way the live fixture logs keys). */
  sent: { key: string; command: PlayerCommand }[] = [];
  /** The clock of the night window and of "running" presets (specs pin it). */
  clock: () => Date = () => new Date();
  /** Device keys that refuse to join (specs: a `not_joined` member). */
  refuseJoin = new Set<string>();
  /** Leader keys with a join / leave in flight (409 `group_pending`). */
  pendingLeaders = new Set<string>();
  /** up-next reads fail (answers `confirmed: false`). */
  failUpNext = false;
  /** The Music Assistant entry is not loaded (the bridge answered `no_library`): `status.library.state` is `unavailable` and the reads of the music layer are 503. */
  libraryState: 'ready' | 'unavailable' = 'ready';
  /** Phase 2b (CR §17). Off by default so the 0.1.150 specs keep their shape: `browseOn` offers the library tab ("ספרייה"); `ma` is the direct
   * connection (its `state: 'ready'` opens the full queue and search). `canQueue` / `canBrowse` stand for media.queue / media.browse. */
  browseOn = false;
  ma: { enabled: boolean; url: string | null; token_set: boolean; token_set_at: string | null; state: MaConnection['state']; last_test: MaConnection['last_test'] } =
    { enabled: false, url: null, token_set: false, token_set_at: null, state: 'off', last_test: null };
  canQueue = true;
  canBrowse = true;
  /** Queue reads fail (`confirmed: false`). */
  failQueue = false;
  /** leader id -> the invented queue (row id, track id); built on first read. */
  private queues: Record<string, { id: string; track: string }[]> = {};
  /** Opens everything phase 2b offers (the evidence specs and the mock bar). */
  enablePhase2b(): void {
    this.browseOn = true;
    this.ma = { enabled: true, url: 'http://music.local:8095', token_set: true, token_set_at: new Date().toISOString(), state: 'ready', last_test: null };
  }
  /** Merge suggestions the administrator answered (`link` / `ignore` with the row's device): they leave the wizard's list. */
  private answered = new Set<string>();
  /** Helper groups an administrator switched off (a helper group is listed as a shortcut only while approved; the mock starts with them on). */
  private helperOff = new Set<string>();
  private records = new Map<string, GroupRecord>();
  private seen = new Map<string, unknown>();
  private serial = 0;
  private fx: Fixture;

  constructor(house: MockHouse = 'ma') {
    this.house = house;
    this.fx = house === 'ma' ? maHouse() : sonosHouse();
    const at = new Date().toISOString();
    this.rows = this.fx.seeds.map((s): Row => ({
      seed: s, approved: true, st: s.st, track: s.track ?? null, pos: s.pos ?? 0, posAt: at, vol: s.vol, muted: false, queue: s.queue ? { ...s.queue } : null,
      shuffle: s.shuffle ?? false, repeat: s.repeat ?? 'off', src: s.src ?? null, mode: s.mode ?? null, zone2: s.zone2 ? { ...s.zone2 } : null,
    }));
    this.grp = clone(this.fx.groups);
    this.presetState = this.fx.presets.map((p, i) => ({
      id: hex(`preset:${house}:${i}`, 32), name: p.name, leader_key: keyOf(p.leader), member_keys: p.members.filter((m) => m !== p.leader).map(keyOf), volumes: p.volumes ? Object.fromEntries(Object.entries(p.volumes).map(([k, v]) => [keyOf(k), v])) : null,
      revision: 1, running: null,
    }));
    this.curation = { kinds_on: house === 'ma' ? ['favourites', 'stations', 'playlists'] : ['favourites', 'stations'], items: [], revision: 1 };
  }

  // ---- helpers

  private row(key: string): Row {
    return this.rows.find((r) => keyOf(r.seed.id) === key) ?? fail(404, 'not_found', 'הנגן לא נמצא.');
  }
  private leaderId(id: string): string {
    return Object.keys(this.grp).find((l) => this.grp[l].includes(id) && !this.isStatic(l)) ?? id;
  }
  private isStatic(id: string): boolean {
    return this.rows.find((r) => r.seed.id === id)?.seed.kind === 'group';
  }
  private live(id: string): { leader: string; members: string[] } {
    const leader = this.leaderId(id);
    return { leader, members: this.grp[leader] && !this.isStatic(leader) ? this.grp[leader] : [] };
  }
  private once<T>(rid: string, run: () => T): T {
    if (this.seen.has(rid)) return this.seen.get(rid) as T;
    const out = run();
    this.seen.set(rid, out);
    return out;
  }
  private bulkId(kind: string): string {
    return `mock-${kind}-${++this.serial}`;
  }
  private detach(id: string): void {
    const l = this.leaderId(id);
    if (l === id) {
      for (const m of this.grp[id] ?? []) {
        if (this.isStatic(id)) continue;
        const r = this.row(keyOf(m));
        r.track = null;
        r.st = r.st === 'playing' || r.st === 'paused' ? 'idle' : r.st;
      }
      if (!this.isStatic(id)) delete this.grp[id];
    } else {
      this.grp[l] = this.grp[l].filter((m) => m !== id);
      if (!this.grp[l].length) delete this.grp[l];
      const r = this.row(keyOf(id));
      r.track = null;
      r.st = r.st === 'playing' || r.st === 'paused' ? 'idle' : r.st;
    }
  }
  private hasFloors(): boolean {
    return this.rows.some((r) => r.seed.floor !== null);
  }

  // ---- building the wire shapes

  private caps(r: Row): PlayerCaps {
    const s = r.seed;
    const f = (x: Feat) => !s.nocaps && s.feat.includes(x);
    const lib = f('lib') && (s.provider === 'ma' || s.provider === 'sonos');
    const plain = f('tp') || lib;
    const leaderOfGroup = this.isStatic(s.id) || !!this.grp[s.id];
    return {
      power_on: f('pw'), power_on_reason: f('pw') ? null : 'not_supported', power_off: f('pw'), volume_set: f('vset'), volume_step: f('vset'), mute: f('vset'),
      sources: f('src') && (s.srcs?.length ?? 0) > 0, apps: false, sound_outputs: f('snd') ? [...(s.modes ?? [])] : [],
      transport: { play: plain, pause: plain, stop: lib, next: lib, previous: lib, seek: lib },
      keys: [], text: false, touchpad: false, art_mode: false,
      shuffle: lib, repeat: lib, group: f('grp'), volume_group: f('grp') && leaderOfGroup, up_next: lib, favourites: lib, stations: lib, playlists: lib && s.provider === 'ma',
      transfer: lib && s.provider === 'ma',
      queue_list: lib && s.provider === 'ma' && this.ma.state === 'ready',
      browse: lib && s.provider === 'ma' && this.browseOn,
      search: lib && s.provider === 'ma' && this.browseOn && this.ma.state === 'ready',
    };
  }

  private nowOf(r: Row): PlayerNow {
    const base: PlayerNow = { kind: 'none', label: '', app_id: null, source_id: null, title: null, channel: null, position_s: null, duration_s: null, position_at: null, artwork: null, glyph: r.seed.kind === 'player' ? 'hdmi' : 'speaker', hue: null, artist: null, album: null };
    if (r.seed.kind === 'receiver') {
      const src = r.src ? this.sourceItems(r).find((x) => x.id === r.src) : null;
      return { ...base, kind: 'source', label: src?.label ?? '', source_id: r.src, glyph: 'hdmi' };
    }
    const lead = this.row(keyOf(this.leaderId(r.seed.id)));
    if (!lead.track || lead.st === 'idle' || lead.st === 'off' || lead.st === 'unavailable') return base;
    const t = tracks()[lead.track];
    return {
      ...base, kind: t.station ? 'station' : 'music', label: t.station ? 'רדיו' : 'מוזיקה', title: t.title, artist: t.artist, album: t.album,
      position_s: t.station ? null : lead.pos, duration_s: t.dur, position_at: t.station ? null : lead.posAt, glyph: t.glyph, hue: t.hue,
    };
  }

  private sourceItems(r: Row): SourceItem[] {
    const label = new Map(RECEIVER_SOURCES.map((s) => [s.id, s.label]));
    return (r.seed.srcs ?? []).map((id) => ({ id, label: label.get(id) ?? id, kind: 'source' as const, glyph: (id === 'Bluetooth' ? 'speaker' : id === 'Tuner' ? 'antenna' : 'hdmi') as Glyph, hue: null }));
  }

  private build(r: Row): PlayerDeviceDetail {
    const s = r.seed;
    const id = s.id;
    const isGroupDev = s.kind === 'group';
    const { leader, members } = this.live(id);
    const role = isGroupDev ? 'leader' : leader !== id ? 'member' : members.length ? 'leader' : 'none';
    const power: PowerState = r.st === 'unavailable' ? 'unavailable' : r.st === 'off' ? 'off' : 'on';
    const lead = this.row(keyOf(leader));
    const play = power !== 'on' || s.kind === 'receiver' ? null : (lead.st === 'playing' || lead.st === 'paused' ? lead.st : 'idle');
    const caps = this.caps(r);
    // `member_keys` are the group's OTHER devices (the leader is `leader_key`, the same list on every device of the group; a static group's children), like the server
    const memberKeys = isGroupDev ? (this.grp[id] ?? []).filter((m) => this.row(keyOf(m)).approved).map(keyOf) : role === 'none' ? [] : this.live(leader).members.filter((m) => this.row(keyOf(m)).approved).map(keyOf);
    const now = this.nowOf(r);
    const up = caps.up_next && !!lead.queue && play !== null && lead.track !== null;
    const zones: ReceiverZone[] | null = s.zone2
      ? [{ id: 'main', name: 'ראשי', power: power === 'on' ? 'on' : power === 'off' ? 'off' : 'unknown', volume: r.vol, source_id: r.src, sound_mode: r.mode },
        { id: 'z2', name: 'אזור 2', ...(r.zone2 ?? s.zone2) }]
      : null;
    const level = isGroupDev ? groupLevel((this.grp[id] ?? []).map((m) => this.memberPlan(this.row(keyOf(m))))) : r.vol;
    return {
      key: keyOf(id), name: s.name, kind: s.kind, profile: 'generic', floor_id: s.floor?.[0] ?? null, floor_name: s.floor?.[1] ?? null, area_id: s.area?.[0] ?? null, area_name: s.area?.[1] ?? null,
      public: false,
      live: {
        power, play, confirmed: power !== 'unavailable', since: power === 'unavailable' ? (s.since ?? null) : null, now,
        volume: { level, muted: isGroupDev ? null : r.muted, target: 'screen', step_only: false }, sound_output: r.mode,
        shuffle: caps.shuffle && power === 'on' ? lead.shuffle : null, repeat: caps.repeat && power === 'on' ? lead.repeat : null,
        group: { role, leader_key: role === 'none' ? null : keyOf(leader), member_keys: memberKeys, name: isGroupDev ? s.name : null, static: isGroupDev, layer: caps.group || isGroupDev ? (s.layer ?? null) : null, conflict: !!s.conflict },
        queue: up ? { count: lead.queue!.count, index: lead.queue!.index } : null,
        caps_known: power !== 'unavailable',
      },
      caps,
      audio_link: null,
      can: { control: true, power: true, public_ok: true, bulk: true, group: caps.group, queue: !!caps.queue_list && this.canQueue, browse: !!caps.browse && this.canBrowse },
      volume_max: s.max ?? null, volume_night: s.night ? { ...s.night } : null, music_provider: s.provider, zones, virtual_members: null,
      sources: this.sourceItems(r), apps: [], recent: [], remote: clone(DEFAULT_REMOTE), model_keys: [],
    };
  }

  private memberPlan(r: Row) {
    const d = this.build(r);
    return { key: d.key, volume_max: d.volume_max, volume_night: d.volume_night, can: d.can, live: { power: d.live.power, volume: { level: r.vol, muted: r.muted } } };
  }

  private physical(): PlayerDeviceDetail[] {
    return this.rows.filter((r) => r.approved).map((r) => this.build(r));
  }

  // ---- reads

  async status(): Promise<PlayerStatus> {
    const all = this.physical();
    const players = all.filter((d) => d.kind !== 'group');
    return {
      enabled: true, bridge: { paired: true, version: '0.5.0', media_ready: true, players_ready: true },
      can: { read: true, control: true, power: true, public: true, bulk: true, layout: true, configure: true, personalize: true, group: true },
      counts: {
        screens: 0, on: all.filter((d) => d.live.power === 'on').length, pending_approval: 0, players: players.length, playing: players.filter((d) => d.live.play === 'playing').length,
        groups: (await this.groups()).length, unplaced: unplacedBucket(players).unplaced.length, suggestions: this.fx.suggestions.length,
      },
      profiles_version: 1, floors: this.hasFloors(), library: { provider: this.fx.provider, state: this.fx.provider === 'ma' && this.libraryState === 'unavailable' ? 'unavailable' : 'ready' },
      direct: { state: this.ma.state },
    };
  }

  async list(q: PlayerListQuery = {}): Promise<{ devices: PlayerDevice[] }> {
    const kinds = q.kind ?? PLAYER_KINDS;
    const text = (q.q ?? '').trim();
    return {
      devices: this.physical()
        .filter((d) => kinds.includes(d.kind) && !NON_PHYSICAL_KINDS.includes(d.kind))
        .filter((d) => (!q.floor || d.floor_id === q.floor) && (!q.area || (q.area === 'none' ? d.area_id === null : d.area_id === q.area)))
        .filter((d) => !text || d.name.includes(text) || (d.area_name ?? '').includes(text))
        .filter((d) => matchesState(d, q.state))
        .map(listRow),
    };
  }

  async get(key: string): Promise<PlayerDeviceDetail> {
    return clone(this.build(this.row(key)));
  }

  async upNext(key: string): Promise<UpNext> {
    const r = this.row(key);
    const d = this.build(r);
    const lead = this.row(keyOf(this.leaderId(r.seed.id)));
    if (!d.caps.up_next || (d.music_provider === 'ma' && this.libraryState === 'unavailable')) return fail(503, 'no_library', 'אין ספריית מוזיקה.');
    const at = new Date().toISOString();
    const t = tracks();
    const entry = (id: string): QueueEntry => ({ name: t[id].title, artist: t[id].artist, album: t[id].album, duration_s: t[id].dur });
    if (this.failUpNext) return { confirmed: false, count: null, index: null, shuffle: null, repeat: null, current: null, next: null, read_at: null };
    if (!lead.track || !lead.queue) return { confirmed: true, count: 0, index: null, shuffle: lead.shuffle, repeat: lead.repeat, current: null, next: null, read_at: at };
    const nextId = lead.queue.index + 1 < lead.queue.count && r.seed.provider === 'ma' ? TRACK_ORDER[(TRACK_ORDER.indexOf(lead.track) + 1) % TRACK_ORDER.length] : null;
    return {
      confirmed: true, count: lead.queue.count, index: lead.queue.index, shuffle: lead.shuffle, repeat: lead.repeat, current: entry(lead.track),
      next: nextId && !t[lead.track].station ? entry(nextId) : null, read_at: at,
    };
  }

  async library(key: string, kind: LibraryKind, offset = 0, all = false): Promise<LibraryPage> {
    const d = this.build(this.row(key));
    if (d.music_provider === 'ma' && this.libraryState === 'unavailable') return fail(503, 'no_library', 'אין ספריית מוזיקה.');
    if (d.music_provider === 'none' || !d.caps[kind]) return fail(d.music_provider === 'none' ? 503 : 422, d.music_provider === 'none' ? 'no_library' : 'not_supported', d.music_provider === 'none' ? 'אין ספריית מוזיקה.' : 'הרשימה אינה זמינה.');
    const lib = items();
    const hiddenOrder = this.curation.items;
    const isHidden = (id: string) => !!hiddenOrder.find((c) => c.item_ref === refOf(id))?.hidden;
    // the curation editor (`all`, media.layout) also gets the hidden ones, marked; everyone else only what the administrator left visible
    const list = LIBRARY[kind].filter((id) => all || !isHidden(id));
    list.sort((a, b) => (hiddenOrder.find((c) => c.item_ref === refOf(a))?.order ?? 1e6) - (hiddenOrder.find((c) => c.item_ref === refOf(b))?.order ?? 1e6));
    return {
      kind, provider: d.music_provider, read_at: new Date().toISOString(), curated: hiddenOrder.length > 0,
      items: list.slice(offset).map((id): LibraryItem => ({ item_ref: refOf(id), ...(all ? { hidden: isHidden(id) } : {}), kind: lib[id].kind, name: lib[id].name, artist: lib[id].artist, glyph: lib[id].glyph, hue: lib[id].hue })),
    };
  }

  // ---- phase 2b: the full queue, the library tab, the direct connection (CR §17.7)

  /** The invented queue of a leader: the row at `index` is what it plays now (`current`), the rest follow the track order. */
  private queueOf(leaderId: string, index = 0, current: string | null = null): { id: string; track: string }[] {
    const t = Object.keys(tracks()).filter((k) => !tracks()[k].station);
    const shift = current && t.includes(current) ? (t.indexOf(current) - (index % t.length) + t.length) % t.length : 0;
    return (this.queues[leaderId] ??= Array.from({ length: QUEUE_LEN }, (_, n) => ({ id: `${leaderId}-${n}`, track: t[(n + shift) % t.length] })));
  }

  private queueHead(key: string): { lead: Row; leaderId: string; rows: { id: string; track: string }[]; index: number; lockedTo: number } {
    const r = this.row(key);
    const d = this.build(r);
    if (!d.caps.queue_list) fail(this.ma.state === 'ready' ? 422 : 503, this.ma.state === 'ready' ? 'not_supported' : 'ma_unavailable', 'התור המלא אינו זמין.');
    const leaderId = this.leaderId(r.seed.id);
    const lead = this.row(keyOf(leaderId));
    const index = lead.track ? Math.min(lead.queue?.index ?? 0, QUEUE_LEN - 1) : -1;
    const rows = this.queueOf(leaderId, Math.max(0, index), lead.track && !tracks()[lead.track].station ? lead.track : null);
    return { lead, leaderId, rows, index, lockedTo: index < 0 ? -1 : Math.min(rows.length - 1, index + 1) };
  }

  async queue(key: string, offset?: number): Promise<QueueList> {
    const h = this.queueHead(key);
    if (this.failQueue) return { confirmed: false, count: null, index: null, locked_to: null, offset: offset ?? 0, items: [], shuffle: null, repeat: null, read_at: null };
    const t = tracks();
    const start = offset ?? Math.max(0, h.index);
    const items: QueueRow[] = h.rows.slice(start, start + 50).map((row, n) => ({
      item: hex(`q:${row.id}`, 24), index: start + n, name: t[row.track].title, artist: t[row.track].artist, album: t[row.track].album, duration_s: t[row.track].dur, locked: start + n <= h.lockedTo,
    }));
    return { confirmed: true, count: h.rows.length, index: h.index < 0 ? null : h.index, locked_to: h.lockedTo, offset: start, items, shuffle: h.lead.shuffle, repeat: h.lead.repeat, read_at: new Date().toISOString() };
  }

  async queueEdit(key: string, body: QueueEditBody): Promise<QueueEditResult> {
    return this.once(body.client_request_id, () => {
      const d = this.build(this.row(key));
      if (!d.can.queue) fail(403, 'forbidden', 'אין הרשאה לערוך את התור.');
      const h = this.queueHead(key);
      if (body.op === 'clear' || body.op === 'clear_upcoming') {
        const pending = Math.max(0, h.rows.length - (h.lockedTo + 1));
        if (body.op === 'clear_upcoming' && pending === 0) return { status: 'accepted', op: body.op, count: 0 } as QueueEditResult;
        if (body.confirmed !== true) fail(409, 'confirm_required', 'לנקות את התור?', { count: pending });
        if (body.op === 'clear_upcoming' && pending > 200) fail(422, 'too_many', 'יש יותר מדי שירים.', { count: pending });
        h.rows.splice(body.op === 'clear' ? 0 : h.lockedTo + 1); // clear everything stops the player; clear upcoming keeps the current song
        if (h.lead.queue) h.lead.queue.count = h.rows.length;
        if (body.op === 'clear') h.lead.st = 'idle';
        return { status: 'accepted', op: body.op, count: pending } as QueueEditResult;
      }
      if (body.op === 'delete_many') {
        const ids = body.items ?? [];
        if (!ids.length || ids.length > 25 || new Set(ids).size !== ids.length) fail(422, 'validation', 'אפשר לבחור עד 25 שירים.', { fields: ['items'] });
        const ats = ids.map((id) => h.rows.findIndex((row) => hex(`q:${row.id}`, 24) === id));
        if (ats.some((a) => a < 0)) fail(422, 'unknown_item', 'הפריט אינו מוכר.');
        if (ats.some((a) => a <= h.lockedTo)) fail(409, 'locked', 'השיר הזה כבר מתנגן.');
        const gone = new Set(ats);
        h.rows.splice(0, h.rows.length, ...h.rows.filter((_, n) => !gone.has(n)));
        if (h.lead.queue) h.lead.queue.count = h.rows.length;
        return { status: 'accepted', op: 'delete_many', count: ids.length } as QueueEditResult;
      }
      const at = h.rows.findIndex((row) => hex(`q:${row.id}`, 24) === body.item);
      if (at < 0) fail(422, 'unknown_item', 'הפריט אינו מוכר.');
      if (body.op === 'play') {
        if (at === h.index) fail(409, 'locked', 'השיר הזה כבר מתנגן.');
        h.lead.queue = { count: h.rows.length, index: at };
        h.lead.track = h.rows[at].track;
        h.lead.pos = 0;
        h.lead.posAt = new Date().toISOString();
        h.lead.st = 'playing';
        return { status: 'accepted', op: 'play' } as QueueEditResult;
      }
      if (at <= h.lockedTo) fail(409, 'locked', 'השיר הזה כבר מתנגן.');
      if (body.op === 'delete') {
        h.rows.splice(at, 1);
        if (h.lead.queue) h.lead.queue.count = h.rows.length;
        return { status: 'accepted', op: 'delete' } as QueueEditResult;
      }
      const to = body.op === 'next' || body.op === 'top' ? h.lockedTo + 1 : body.to;
      if (typeof to !== 'number' || to <= h.lockedTo || to > h.rows.length - 1) fail(422, 'validation', 'מיקום לא תקין בתור.', { fields: ['to'] });
      const [row] = h.rows.splice(at, 1);
      h.rows.splice(to as number, 0, row);
      return { status: 'accepted', op: body.op, to } as QueueEditResult;
    });
  }

  async browse(key: string, type: BrowseType, q?: string, offset = 0): Promise<BrowsePage> {
    const d = this.build(this.row(key));
    const text = (q ?? '').trim();
    if (!d.caps.browse || !d.can.browse) fail(d.can.browse === false && d.caps.browse ? 403 : 422, d.caps.browse ? 'forbidden' : 'not_supported', 'הספרייה אינה זמינה.');
    if (text && !d.caps.search) fail(422, 'not_supported', 'החיפוש אינו זמין.', { reason: 'search' });
    const lib = items();
    const ids = BROWSE[type].filter((id) => !text || `${lib[id].name} ${lib[id].artist ?? ''}`.toLowerCase().includes(text.toLowerCase()));
    return {
      type, q: text || null, offset, more: false, read_at: new Date().toISOString(), provider: 'ma',
      items: ids.slice(offset, offset + 50).map((id): LibraryItem => ({ item_ref: refOf(id), kind: lib[id].kind, name: lib[id].name, artist: lib[id].artist, glyph: lib[id].glyph, hue: lib[id].hue })),
    };
  }

  private maView(): MaConnection {
    return { ...this.ma, min_schema: 27, token_expiring: false };
  }

  async maConnection(): Promise<MaConnection> {
    return clone(this.maView());
  }

  async saveMaConnection(body: MaConnectionBody): Promise<MaConnection> {
    if (body.url !== undefined && body.url !== null && body.url !== '' && !/^https?:\/\/[a-z0-9.-]+(:\d{1,5})?\/?$/i.test(body.url)) fail(422, 'validation', 'כתובת השרת: http(s)://שם-מארח:פורט בלבד.', { fields: ['url'] });
    if (body.token !== undefined && body.token.trim().length < 16) fail(422, 'validation', 'אסימון לא תקין.', { fields: ['token'] });
    if (body.url !== undefined) this.ma.url = body.url ? body.url.replace(/\/$/, '').toLowerCase() : null;
    if (body.clear_token) {
      this.ma.token_set = false;
      this.ma.token_set_at = null;
    } else if (body.token !== undefined) {
      this.ma.token_set = true;
      this.ma.token_set_at = new Date().toISOString();
    }
    if (body.enabled !== undefined) this.ma.enabled = body.enabled;
    if (this.ma.enabled && !this.ma.url) fail(422, 'validation', 'חיבור ישיר דורש כתובת שרת.', { fields: ['url'] });
    this.ma.state = this.ma.enabled && this.ma.url && this.ma.token_set ? 'ready' : 'off';
    return this.maConnection();
  }

  async testMaConnection(): Promise<MaTest> {
    const out: MaTest = this.ma.url && this.ma.token_set ? { state: 'ready', server_version: '2.10.4', schema_version: 28, players: this.rows.filter((r) => r.seed.provider === 'ma').length } : { state: 'off', server_version: null, schema_version: null, players: null };
    this.ma.last_test = { at: new Date().toISOString(), ...out };
    return clone(out);
  }

  async groups(): Promise<MediaGroup[]> {
    const out: MediaGroup[] = [];
    const member = (id: string) => {
      const r = this.row(keyOf(id));
      const d = this.build(r);
      return { key: d.key, name: d.name, area_name: d.area_name, volume: r.vol, muted: r.muted, available: d.live.power !== 'unavailable' };
    };
    for (const [leader, ms] of Object.entries(this.grp)) {
      const ids = (this.isStatic(leader) ? ms : [leader, ...ms]).filter((i) => this.row(keyOf(i)).approved);
      if (!ids.length) continue;
      const rows = ids.map((i) => this.row(keyOf(i)));
      const r = this.row(keyOf(leader));
      out.push({
        leader_key: keyOf(leader), name: this.isStatic(leader) ? r.seed.name : ids.map((i) => this.row(keyOf(i)).seed.area?.[1] ?? this.row(keyOf(i)).seed.name).join(' + '), static: this.isStatic(leader),
        floor_ids: [...new Set(rows.map((x) => x.seed.floor?.[0]).filter((f): f is string => !!f))], members: ids.map(member), volume: groupLevel(rows.map((x) => this.memberPlan(x))),
        can: { group: !this.isStatic(leader), volume: true },
      });
    }
    // helper shortcuts (no GROUPING of their own, never joinable): static, `can.group` false
    for (const h of this.fx.helpers.filter((x) => x.members.length && !this.helperOff.has(x.id))) {
      const rows = h.members.map((i) => this.row(keyOf(i)));
      out.push({ leader_key: keyOf(h.id), name: h.name, static: true, floor_ids: [], members: h.members.map(member), volume: groupLevel(rows.map((x) => this.memberPlan(x))), can: { group: false, volume: true } });
    }
    return out;
  }

  async suggestions(): Promise<MergeSuggestion[]> {
    return this.fx.suggestions.map((s, i) => ({ id: `s${i + 1}`, ...s })).filter((s) => !this.answered.has(s.id));
  }

  /** The administrator answered a row of the merge wizard: `link` (merge: the endpoint moves with its cluster) or `ignore` + the row's device (dismiss). Both
   * drop the row; a plain `ignore` (no device) hides the endpoint from every device and drops its rows too (the CR-015 meaning). */
  answerSuggestion(op: 'link' | 'ignore', endpointId: string, deviceKey?: string): void {
    this.fx.suggestions.forEach((s, i) => {
      if (s.endpoint_id === endpointId && (op === 'link' || !deviceKey || s.device_key === deviceKey)) this.answered.add(`s${i + 1}`);
    });
  }

  /** Approve or withdraw devices (`POST admin/approve`): by key, or - like "אשר את כל הנגנים שזוהו" - every device of the named kinds; the counts of the server's answer. */
  approve(keys: string[] | null, approved: boolean, kinds?: PlayerKind[]): { requested: number; changed: number; approved: number; pending_approval: number; approved_players?: number; pending_players?: number } {
    const targets = this.rows.filter((r) => (keys ? keys.includes(keyOf(r.seed.id)) : (kinds ?? []).includes(r.seed.kind)));
    let changed = 0;
    for (const r of targets) {
      if (r.approved !== approved) { r.approved = approved; changed += 1; }
      if (!approved && this.grp[r.seed.id]) this.detach(r.seed.id);
    }
    return { requested: targets.length, changed, approved: 0, pending_approval: 0, approved_players: this.rows.filter((r) => r.approved).length, pending_players: this.rows.filter((r) => !r.approved).length };
  }

  /** The settings' view of every discovered player (approved or not): the connections of each device as the server shows them (the vendor entity answers
   * power / volume, the music layer - hidden - the music, a Cast or SmartThings twin hidden), with the rung that joined them. */
  adminList(): AdminDevice[] {
    const ep = (id: string, platform: string, role: AdminEndpoint['role'], rule: string, hidden: boolean, primary_for: AdminEndpoint['primary_for']): AdminEndpoint => ({ endpoint_id: `ha:media_player.${id}`, platform, role, rule, link_source: 'auto', hidden, primary_for });
    return this.rows.map((r): AdminDevice => {
      const s = r.seed;
      const d = this.build(r);
      const caps = d.caps;
      const own: AdminEndpoint['primary_for'] = [...(caps.power_on || caps.power_off ? (['power'] as const) : []), ...(caps.volume_set || caps.volume_step ? (['volume', 'mute'] as const) : []), ...(caps.sources ? (['sources'] as const) : [])];
      const eps: AdminEndpoint[] = [];
      if (s.kind === 'group') eps.push(ep(`${s.id}_group`, 'music_assistant', 'ma_native', 'device', false, ['now_playing', ...own]));
      else if (s.provider === 'sonos') eps.push(ep(s.id, 'sonos', 'vendor', 'device', false, ['now_playing', ...own]), ...(s.id === 'liv' || s.id === 'bath' ? [ep(`${s.id}_st`, 'smartthings', 'mirror', '3b', true, [])] : []));
      else if (s.kind === 'receiver') eps.push(ep(s.id, 'denonavr', 'vendor', 'device', false, own), ...(s.provider === 'heos' ? [ep(`${s.id}_heos`, 'heos', 'vendor', '2b', false, ['now_playing']), ep(`${s.id}_ma`, 'music_assistant', 'music', '2c', true, [])] : []));
      else if (s.provider === 'ma') {
        const cast = s.id === 'per' || s.id === 'gst';
        eps.push(ep(s.id, cast ? 'cast' : 'wiim', cast ? 'cast' : 'vendor', 'device', false, own), ep(`${s.id}_ma`, 'music_assistant', 'music', cast ? '3b' : '2c', true, s.nocaps ? [] : ['now_playing']));
      } else eps.push(ep(s.id, 'dlna_dmr', 'dlna', 'device', false, [...own, 'now_playing']));
      return {
        key: keyOf(s.id), name: s.name, kind: s.kind, kind_source: 'auto', approved: r.approved, public: false, profile: 'generic', profile_source: 'auto',
        confidence: s.nocaps ? 'weak' : eps.length > 1 ? 'strong' : 'exact', anchor_entity_id: `media_player.${s.id}`, floor_name: s.floor?.[1] ?? null, area_name: s.area?.[1] ?? null, area_id: s.area?.[0] ?? null,
        audio_link_key: null, audio_default: 'screen', volume_max: s.max ?? null, volume_night: s.night ? { ...s.night } : null, music_provider: s.provider,
        zones: d.zones ? d.zones.map((z) => ({ id: z.id, name: z.name })) : null, model_keys: [], also_turns_on: [], endpoints: eps,
      };
    });
  }

  /** Settings: place an unplaced device in a room, change its ceilings or approval (the bridge writes the entity registry on the real server). */
  adminPatch(key: string, patch: { area?: { id: string; name: string; floor: readonly [string, string] | null } | null; volume_max?: number | null; volume_night?: VolumeNight | null; approved?: boolean; name?: string }): void {
    const helper = this.fx.helpers.find((h) => keyOf(h.id) === key);
    if (helper) {
      if (patch.approved === false) this.helperOff.add(helper.id);
      else if (patch.approved === true) this.helperOff.delete(helper.id);
      return;
    }
    const r = this.row(key);
    if (patch.area !== undefined) { r.seed.area = patch.area ? [patch.area.id, patch.area.name] : null; r.seed.floor = patch.area?.floor ?? null; }
    if (patch.volume_max !== undefined) r.seed.max = patch.volume_max ?? undefined;
    if (patch.volume_night !== undefined) r.seed.night = patch.volume_night ?? undefined;
    if (patch.name) r.seed.name = patch.name;
    if (patch.approved !== undefined) this.approve([key], patch.approved);
  }

  /** The folded "רכיבים לא פיזיים": eight Jellyfin sessions under one name, two helper groups and a Spotify source (the house without a music library). */
  async nonPhysical(): Promise<{ devices: (PlayerDevice & { approved?: boolean })[] }> {
    if (this.house === 'ma') return { devices: [] };
    const base = (id: string, name: string, kind: PlayerKind, extra: Partial<PlayerDevice> = {}): PlayerDevice & { approved?: boolean } => {
      const d = listRow(this.build(this.row(keyOf('off'))));
      return {
        ...d, approved: kind === 'virtual_group' && !this.helperOff.has(id), key: keyOf(id), name, kind, floor_id: null, floor_name: null, area_id: null, area_name: null, music_provider: 'none',
        live: { ...d.live, power: 'unavailable', play: null, confirmed: false, since: '2026-09-30T06:00:00Z', caps_known: false, group: { role: 'none', leader_key: null, member_keys: [], name: null, static: false, layer: null, conflict: false }, queue: null },
        caps: { ...d.caps, group: false, up_next: false, favourites: false, stations: false, playlists: false, transfer: false },
        can: { ...d.can, group: false }, ...extra,
      };
    };
    return {
      devices: [
        ...Array.from({ length: 8 }, (_, i) => base(`jf${i + 1}`, 'Jellyfin', 'session')),
        ...this.fx.helpers.map((h) => base(h.id, h.name, 'virtual_group', { virtual_members: h.members.map(keyOf) })),
        base('spot', 'Spotify Connect', 'service'),
      ],
    };
  }

  // ---- commands

  async command(key: string, body: PlayerCommand & { client_request_id: string; expires_at: string }): Promise<CommandResult> {
    const r = this.row(key);
    const { client_request_id: rid, expires_at: _e, ...rest } = body;
    const cmd = rest as PlayerCommand;
    return this.once(rid, () => this.runCommand(r, key, rid, cmd));
  }

  private runCommand(r: Row, key: string, rid: string, cmd: PlayerCommand): CommandResult {
    const d = this.build(r);
    const done = (confirm: CommandResult['confirm'] = 'state'): CommandResult => ({ command_id: rid, status: 'accepted', action_id: confirm === 'none' ? null : `mock-${this.sent.length}`, confirm, error: null });
    if (d.live.power === 'unavailable' || !d.live.caps_known) fail(503, 'caps_unknown', 'הנגן אינו זמין.');
    if (cmd.command === 'play_item' && (d.music_provider === 'none' || (d.music_provider === 'ma' && this.libraryState === 'unavailable'))) fail(503, 'no_library', 'אין ספריית מוזיקה.');
    if (cmd.command === 'transfer' && !d.caps.transfer) fail(d.music_provider === 'none' ? 503 : 422, d.music_provider === 'none' ? 'no_library' : 'not_supported', 'הפעולה אינה זמינה לנגן זה.');
    if (cmd.command === 'play_item') {
      const hit = Object.keys(items()).find((id) => refOf(id) === cmd.item_ref);
      if (!ITEM_REF_RE.test(cmd.item_ref) || !hit) fail(422, 'unknown_item', 'הפריט אינו זמין.');
      // a Sonos favourite is started with select_source: it cannot be queued after the current one or added
      if ((cmd.enqueue === 'next' || cmd.enqueue === 'add') && d.music_provider !== 'ma') fail(422, 'not_supported', 'ההוספה לתור אינה זמינה לנגן זה.');
    }
    if (cmd.command === 'transfer') {
      const from = this.row(cmd.from_key);
      const src = this.build(from);
      if (src.live.play !== 'playing') fail(409, 'not_playing', 'אין מה להעביר.');
    }
    if (r.seed.kind === 'group') {
      // a static group is one entity that acts on every member: its volume is the group volume route's (never one volume_set), and a party (four rooms or more, or
      // more than one floor) asks for `confirmed: true` after the preview - exactly a join's rule
      if (cmd.command === 'volume_set' || cmd.command === 'volume_step') fail(409, 'use_group_volume', 'עוצמת קבוצה נשלטת ממסך הקבוצה.', { route: `/multimedia/groups/${key}/volume` });
      if (GROUP_FAN.includes(cmd.command) && cmd.confirmed !== true) {
        const ids = (this.grp[r.seed.id] ?? []).filter((i) => this.row(keyOf(i)).approved);
        if (needsConfirmation(ids.map((i) => this.build(this.row(keyOf(i)))))) fail(409, 'confirm_required', 'קבוצה גדולה: נדרש אישור.', { preview: this.partyPreview(ids, {}) });
      }
    }
    if (cmd.command === 'mute' && cmd.muted === false) {
      // an unmute reveals the level the speaker was muted at: above a ceiling set later it is never sent (the caller lowers the level first)
      const ceiling = effectiveCeiling(d, this.clock());
      if (ceiling !== null && (d.live.volume.level === null || d.live.volume.level > ceiling)) fail(422, 'not_supported', 'העוצמה גבוהה מהתקרה.', { reason: 'ceiling', ceiling });
    }
    if (!playerCommandOffered(d, cmd)) fail(422, d.live.power === 'on' ? 'not_supported' : 'screen_off', 'הפעולה אינה זמינה לנגן זה עכשיו.');
    this.sent.push({ key, command: cmd });
    const z2 = !!cmd.zone && !!d.zones && cmd.zone !== d.zones[0].id && r.zone2 !== null;
    const lead = this.row(keyOf(this.leaderId(r.seed.id)));
    const at = this.clock().toISOString();
    switch (cmd.command) {
      case 'power_on': if (z2) r.zone2!.power = 'on'; else r.st = 'idle'; return done();
      case 'power_off':
        if (z2) r.zone2!.power = 'off';
        else { this.detach(r.seed.id); r.st = 'off'; r.track = null; }
        return done();
      case 'volume_set': case 'volume_step': {
        const cur = z2 ? r.zone2!.volume ?? 0 : r.vol;
        const want = cmd.command === 'volume_set' ? cmd.level : cur + (cmd.direction === 'up' ? 2 : -2);
        const v = clampVolume(d, want, this.clock());
        if (z2) r.zone2!.volume = v; else { r.vol = v; if (cmd.command === 'volume_step' && cmd.direction === 'up') r.muted = false; }
        return done(cmd.command === 'volume_step' ? 'none' : 'state');
      }
      case 'mute': r.muted = cmd.muted; return done();
      case 'source': {
        const src = this.sourceItems(r).find((x) => x.id === cmd.source_id) ?? fail(422, 'not_supported', 'המקור אינו ברשימה.');
        if (z2) r.zone2!.source_id = src.id; else r.src = src.id;
        return done();
      }
      case 'sound_output': if (z2) r.zone2!.sound_mode = cmd.output; else r.mode = cmd.output; return done();
      case 'transport': {
        const act = cmd.action;
        if (!lead.track && (act === 'play' || act === 'play_pause') && d.caps.up_next) {
          lead.track = this.house === 'ma' ? 'blue' : 'erev';
          lead.pos = 0; lead.posAt = at; lead.queue = { count: 12, index: 0 };
          lead.st = 'playing';
        } else if (act === 'pause' || (act === 'play_pause' && lead.st === 'playing')) { this.freeze(lead); lead.st = 'paused'; }
        else if (act === 'stop') { lead.st = 'idle'; lead.track = null; }
        else if (act === 'next' || act === 'previous') this.step(lead, act === 'next' ? 1 : -1, at);
        else { if (lead.st !== 'playing') lead.posAt = at; lead.st = 'playing'; }
        return done();
      }
      case 'seek': lead.pos = Math.floor(cmd.position_s); lead.posAt = at; return done();
      case 'shuffle': lead.shuffle = cmd.on; return done();
      case 'repeat': lead.repeat = cmd.mode; return done();
      case 'play_item': {
        const id = Object.keys(items()).find((i) => refOf(i) === cmd.item_ref)!;
        const it = items()[id];
        if (cmd.enqueue === 'next' || cmd.enqueue === 'add') {
          if (lead.queue) lead.queue.count += it.count;
          return done();
        }
        lead.track = it.plays; lead.pos = 0; lead.posAt = at; lead.st = 'playing';
        lead.queue = { count: it.count, index: 0 };
        return done();
      }
      case 'transfer': {
        const from = this.row(cmd.from_key);
        const fl = this.row(keyOf(this.leaderId(from.seed.id)));
        lead.track = fl.track; lead.pos = fl.pos; lead.posAt = fl.posAt; lead.queue = fl.queue ? { ...fl.queue } : null; lead.st = 'playing';
        lead.shuffle = fl.shuffle; lead.repeat = fl.repeat;
        fl.st = 'idle'; fl.track = null;
        return done();
      }
      default: return { command_id: rid, status: 'sent', action_id: null, confirm: 'none', error: null };
    }
  }

  private freeze(r: Row): void {
    if (r.track && tracks()[r.track].dur !== null && r.st === 'playing') {
      r.pos = Math.min(tracks()[r.track].dur!, r.pos + Math.max(0, this.clock().getTime() - Date.parse(r.posAt)) / 1000);
    }
  }
  private step(r: Row, dir: 1 | -1, at: string): void {
    if (!r.queue || !r.track) return;
    r.queue.index = Math.max(0, Math.min(r.queue.count - 1, r.queue.index + dir));
    const i = TRACK_ORDER.indexOf(r.track);
    if (i >= 0) r.track = TRACK_ORDER[(i + dir + TRACK_ORDER.length) % TRACK_ORDER.length];
    r.pos = 0; r.posAt = at;
  }

  // ---- groups

  private partyPreview(ids: string[], will: Record<string, 'join' | 'leave' | 'stay' | 'skip'>): GroupPreview {
    const ds = ids.map((i) => this.build(this.row(keyOf(i))));
    const floors = new Set(ds.map((d) => d.floor_id).filter((f): f is string => f !== null)).size;
    return {
      devices: ds.length, floors, needs_confirmation: needsConfirmation(ds), needs_bulk: false,
      members: ds.map((d) => ({ key: d.key, name: d.name, area_name: d.area_name, will: will[idOf(d.key)] ?? 'stay', reason: null })),
    };
  }

  /** Whether `m` may join `leader`'s group (the server's `not_groupable`: GROUPING, layer, availability, conflict, already elsewhere). */
  private joinProblem(leader: Row, m: Row): boolean {
    const ld = this.build(leader);
    const md = this.build(m);
    const l = this.leaderId(m.seed.id);
    const elsewhere = l !== m.seed.id ? l !== leader.seed.id : !!this.grp[m.seed.id] && !this.isStatic(m.seed.id);
    return !GROUPABLE_KINDS.includes(m.seed.kind) || !md.caps.group || md.live.power === 'unavailable' || md.live.group.conflict || md.live.group.layer !== ld.live.group.layer || elsewhere;
  }
  private checkLeader(leader: Row): void {
    const ld = this.build(leader);
    if (!groupSectionOffered(ld) || this.leaderId(leader.seed.id) !== leader.seed.id) fail(422, 'not_groupable', 'הנגן אינו יכול לנהל קבוצה.', { key: ld.key });
  }

  async join(body: GroupJoinBody): Promise<GroupRunResult> {
    return this.once(body.client_request_id, () => {
      const leader = this.row(body.leader_key);
      if (this.pendingLeaders.has(body.leader_key)) fail(409, 'group_pending', 'פעולת קיבוץ קודמת עדיין רצה.');
      const ids = [...new Set(body.member_keys.map(idOf))].filter((i) => i !== leader.seed.id);
      const rows = ids.map((i) => this.row(keyOf(i)));
      this.checkLeader(leader);
      for (const m of rows) if (this.joinProblem(leader, m)) fail(422, 'not_groupable', 'הנגן אינו יכול להצטרף לקבוצה הזו.', { key: keyOf(m.seed.id) });
      const existing = this.live(leader.seed.id).members;
      const result = [leader.seed.id, ...new Set([...existing, ...ids])];
      const need = needsConfirmation(result.map((i) => this.build(this.row(keyOf(i)))));
      if (!body.confirmed && need && ids.some((i) => !existing.includes(i))) {
        fail(409, 'confirm_required', 'נדרש אישור.', { preview: this.partyPreview(result, Object.fromEntries(ids.map((i) => [i, 'join' as const]))) });
      }
      const recs: GroupRecord['members'] = [];
      const joined: string[] = [];
      for (const r of rows) {
        const refused = this.refuseJoin.has(keyOf(r.seed.id));
        if (!refused) joined.push(r.seed.id);
        recs.push({ device_key: keyOf(r.seed.id), area_name: r.seed.area?.[1] ?? null, outcome: refused ? 'not_joined' : 'joined' });
      }
      const all = [...new Set([...existing, ...joined])];
      if (all.length) this.grp[leader.seed.id] = all;
      const id = this.bulkId('join');
      this.records.set(id, { bulk_id: id, status: 'done', members: recs });
      return { bulk_id: id, status: 'accepted' as const };
    });
  }

  async leave(body: GroupLeaveBody): Promise<GroupRunResult> {
    return this.once(body.client_request_id, () => {
      const recs: GroupRecord['members'] = [];
      for (const key of body.device_keys) {
        const r = this.row(key);
        const id = r.seed.id;
        const wasGrouped = this.live(id).leader !== id || this.live(id).members.length > 0;
        const affected = this.live(id).leader === id ? [id, ...this.live(id).members] : [id];
        if (wasGrouped) this.detach(id);
        for (const a of affected) recs.push({ device_key: keyOf(a), area_name: this.row(keyOf(a)).seed.area?.[1] ?? null, outcome: wasGrouped ? 'left' : 'unknown' });
      }
      const id = this.bulkId('leave');
      this.records.set(id, { bulk_id: id, status: 'done', members: recs });
      return { bulk_id: id, status: 'accepted' as const };
    });
  }

  async groupVolume(leaderKey: string, body: GroupVolumeBody): Promise<GroupRunResult> {
    return this.once(body.client_request_id, () => {
      if (!(body.level >= 0 && body.level <= 100)) fail(422, 'validation', 'עוצמה בין 0 ל־100.');
      const helper = this.fx.helpers.find((h) => keyOf(h.id) === leaderKey);
      const leader = helper ? this.rows[0] : this.row(leaderKey);
      const ids = helper ? helper.members : this.isStatic(leader.seed.id) ? this.grp[leader.seed.id] ?? [] : [this.live(leader.seed.id).leader, ...this.live(this.live(leader.seed.id).leader).members];
      const rows = ids.map((i) => this.row(keyOf(i)));
      const plan = groupVolumePlan(rows.map((x) => this.memberPlan(x)), body.level, body.mode, this.clock());
      const recs: GroupRecord['members'] = plan.steps.map((s, n) => {
        if (s.to !== null) rows[n].vol = s.to;
        return { device_key: s.key, area_name: rows[n].seed.area?.[1] ?? null, outcome: s.outcome, ...(s.to !== null ? { level: s.to } : s.from !== null ? { level: s.from } : {}) };
      });
      const id = this.bulkId('gvol');
      this.records.set(id, { bulk_id: id, status: 'done', members: recs });
      return { bulk_id: id, status: 'accepted' as const };
    });
  }

  async groupRecord(bulkId: string): Promise<GroupRecord> {
    return clone(this.records.get(bulkId) ?? fail(404, 'not_found', 'הפעולה לא נמצאה.'));
  }

  // ---- saved groups

  private presetOut(p: PlayersMockStore['presetState'][number]): GroupPreset {
    const known = new Set(this.rows.map((r) => keyOf(r.seed.id)));
    const running = p.running && this.clock().getTime() - Date.parse(p.running.started_at) < PRESET_RUNNING_MS ? { ...p.running } : null;
    return { id: p.id, name: p.name, leader_key: p.leader_key, member_keys: [...p.member_keys], volumes: p.volumes ? { ...p.volumes } : null, revision: p.revision, missing: p.member_keys.filter((k) => !known.has(k)), running };
  }
  private preset(id: string): PlayersMockStore['presetState'][number] {
    return this.presetState.find((p) => p.id === id) ?? fail(404, 'not_found', 'הקבוצה השמורה לא נמצאה.');
  }
  private checkPreset(b: GroupPresetBody): void {
    const name = b.name.trim();
    if (!name || name.length > 40) fail(422, 'validation', 'שם עד 40 תווים.');
    // the server's shape: `member_keys` are the OTHER rooms (the leader is `leader_key`, never in the list), at most 15 of them
    if (b.member_keys.length > 15 || b.member_keys.length === 0 || b.member_keys.includes(b.leader_key) || new Set(b.member_keys).size !== b.member_keys.length) fail(422, 'validation', 'עד 16 חדרים, המוביל לא ברשימה.');
    for (const k of [b.leader_key, ...b.member_keys]) this.row(k);
    for (const [k, v] of Object.entries(b.volumes ?? {})) if (![b.leader_key, ...b.member_keys].includes(k) || !(v >= 0 && v <= 100)) fail(422, 'validation', 'עוצמה לא תקינה.');
  }

  async presets(): Promise<GroupPreset[]> {
    return this.presetState.map((p) => this.presetOut(p));
  }
  async createPreset(body: GroupPresetBody): Promise<GroupPreset> {
    this.checkPreset(body);
    const p = { id: hex(`preset:${this.house}:new:${++this.serial}:${body.name}`, 32), name: body.name.trim(), leader_key: body.leader_key, member_keys: [...body.member_keys], volumes: body.volumes ? { ...body.volumes } : null, revision: 1, running: null };
    this.presetState.push(p);
    return this.presetOut(p);
  }
  async savePreset(id: string, body: GroupPresetBody, baseRevision: number): Promise<GroupPreset> {
    const p = this.preset(id);
    if (baseRevision !== p.revision) fail(409, 'revision_conflict', 'נערך במקום אחר; טענו מחדש.');
    this.checkPreset(body);
    Object.assign(p, { name: body.name.trim(), leader_key: body.leader_key, member_keys: [...body.member_keys], volumes: body.volumes ? { ...body.volumes } : null, revision: p.revision + 1 });
    return this.presetOut(p);
  }
  async deletePreset(id: string, baseRevision: number): Promise<void> {
    const p = this.preset(id);
    if (baseRevision !== p.revision) fail(409, 'revision_conflict', 'נערך במקום אחר; טענו מחדש.');
    this.presetState = this.presetState.filter((x) => x !== p);
  }

  /** "הפעל": a diff (unjoin the extras, join the missing), then the volumes (each limited to its member's ceiling where one is set), the result per member. */
  async applyPreset(id: string, body: { confirmed?: boolean; client_request_id: string; expires_at: string }): Promise<GroupRunResult> {
    return this.once(body.client_request_id, () => {
      const p = this.preset(id);
      const leader = this.row(p.leader_key);
      if (this.pendingLeaders.has(p.leader_key)) fail(409, 'group_pending', 'פעולת קיבוץ קודמת עדיין רצה.');
      const want = p.member_keys.map(idOf).filter((i) => i !== leader.seed.id);
      if (this.leaderId(leader.seed.id) !== leader.seed.id) this.detach(leader.seed.id);
      const current = this.live(leader.seed.id).members;
      const diff = joinDiff(current, want, leader.seed.id);
      const result = [leader.seed.id, ...want];
      if (!body.confirmed && needsConfirmation(result.map((i) => this.build(this.row(keyOf(i)))))) {
        fail(409, 'confirm_required', 'נדרש אישור.', { preview: this.partyPreview(result, { ...Object.fromEntries(diff.join.map((i) => [i, 'join' as const])), ...Object.fromEntries(diff.leave.map((i) => [i, 'leave' as const])) }) });
      }
      this.checkLeader(leader);
      const recs: GroupRecord['members'] = [];
      for (const i of diff.leave) { recs.push({ device_key: keyOf(i), area_name: this.row(keyOf(i)).seed.area?.[1] ?? null, outcome: 'left' }); this.detach(i); }
      const failed = new Set<string>();
      for (const i of diff.join) if (this.refuseJoin.has(keyOf(i)) || this.joinProblem(leader, this.row(keyOf(i)))) failed.add(i);
      const members = [...diff.stay, ...diff.join.filter((i) => !failed.has(i))];
      if (members.length) this.grp[leader.seed.id] = members; else delete this.grp[leader.seed.id];
      for (const i of [leader.seed.id, ...want]) {
        if (failed.has(i)) { recs.push({ device_key: keyOf(i), area_name: this.row(keyOf(i)).seed.area?.[1] ?? null, outcome: 'not_joined' }); continue; }
        const r = this.row(keyOf(i));
        let outcome: MemberOutcome = 'joined';
        let level: number | undefined;
        const v = p.volumes?.[keyOf(i)];
        if (v !== undefined) {
          const step = groupVolumePlan([this.memberPlan(r)], v, 'absolute', this.clock()).steps[0];
          outcome = step.outcome; // set | clamped | skipped_*
          if (step.to !== null) { r.vol = step.to; level = step.to; }
        }
        recs.push({ device_key: keyOf(i), area_name: r.seed.area?.[1] ?? null, outcome, ...(level !== undefined ? { level } : {}) });
      }
      const bulk = this.bulkId('preset');
      this.records.set(bulk, { bulk_id: bulk, status: 'done', members: recs });
      p.running = { bulk_id: bulk, started_at: this.clock().toISOString() };
      return { bulk_id: bulk, status: 'accepted' as const };
    });
  }

  // ---- favourites, pause, admin

  async favourites(): Promise<FavouritesCuration> {
    // a holder of media.layout also gets the names of the curated items (the server knows the ones it listed lately): a hidden item can be shown again
    const lib = items();
    const byRef = new Map(Object.keys(lib).map((id) => [refOf(id), lib[id]]));
    const c = clone(this.curation);
    c.items = c.items.map((i) => { const it = byRef.get(i.item_ref); return it ? { ...i, name: it.name, artist: it.artist, kind: it.kind } : i; });
    return c;
  }
  async saveFavourites(c: Omit<FavouritesCuration, 'revision'>, baseRevision: number): Promise<FavouritesCuration> {
    if (baseRevision !== this.curation.revision) fail(409, 'revision_conflict', 'נערך במקום אחר; טענו מחדש.');
    this.curation = { ...clone(c), revision: this.curation.revision + 1 };
    return this.favourites();
  }

  /** The devices of a floor / area and what "עצור מוזיקה" would do with each (the server's vocabulary: `pause` or `skip` with `not_playing` / `unavailable` / `not_allowed`). */
  private pauseDevices(scope: BulkScope, id: string): { dev: PlayerDevice; will: 'pause' | 'skip'; reason: PausePreview['devices'][number]['reason'] }[] {
    return this.physical().filter((d) => d.kind !== 'group' && (scope === 'floor' ? d.floor_id : d.area_id) === id).map((d) => {
      const reason = !d.can.bulk ? 'not_allowed' : d.live.power === 'unavailable' || d.live.power === 'unknown' ? 'unavailable' : d.live.play === 'playing' ? null : 'not_playing';
      return { dev: d, will: reason ? ('skip' as const) : ('pause' as const), reason } as const;
    });
  }

  async pausePreview(scope: BulkScope, id: string): Promise<PausePreview> {
    const inScope = this.pauseDevices(scope, id);
    const devices = inScope.map((x) => ({ key: x.dev.key, name: x.dev.name, will: x.will, reason: x.reason }));
    const count = (r: string) => devices.filter((x) => x.reason === r).length;
    const first = inScope[0]?.dev;
    const label = scope === 'floor' ? first?.floor_name ?? id : first?.area_name ?? id;
    return { scope, id, label, devices, counts: { send: devices.filter((x) => x.will === 'pause').length, not_playing: count('not_playing'), unavailable: count('unavailable'), not_allowed: count('not_allowed') } };
  }

  /** Pauses the playing rooms (once per group, through its leader) and records one row per device of the scope, like the server's: `will` `pause` -> `set`, a
   * skipped room -> `skipped_unavailable` / `not_allowed` (a room that was not playing is not a failure: the row says `will: skip`). */
  async pauseRun(scope: BulkScope, id: string, clientRequestId: string, _expiresAt: string): Promise<{ bulk_id: string; status: string }> {
    return this.once(clientRequestId, () => {
      const plan = this.pauseDevices(scope, id);
      const seen = new Set<string>();
      for (const x of plan.filter((p) => p.will === 'pause')) {
        const lead = this.row(keyOf(this.leaderId(idOf(x.dev.key))));
        if (seen.has(lead.seed.id)) continue;
        seen.add(lead.seed.id);
        this.freeze(lead);
        lead.st = 'paused';
      }
      const bulk = this.bulkId('pause');
      this.records.set(bulk, {
        bulk_id: bulk, status: 'done',
        members: plan.map((x) => ({ device_key: x.dev.key, name: x.dev.name, area_name: x.dev.area_name, will: x.will, outcome: x.will === 'pause' ? ('set' as const) : x.reason === 'unavailable' ? ('skipped_unavailable' as const) : ('not_allowed' as const) })),
      });
      return { bulk_id: bulk, status: 'done' };
    });
  }
}

let store: PlayersMockStore | null = null;
/** The session's mock store (one per page load; the house with a music library until a spec or the mock bar resets it). */
export function playersMock(): PlayersMockStore {
  return (store ??= new PlayersMockStore());
}
/** A fresh store (specs); `house` picks the fixture. */
export function resetPlayersMock(house: MockHouse = 'ma'): PlayersMockStore {
  store = new PlayersMockStore(house);
  return store;
}
