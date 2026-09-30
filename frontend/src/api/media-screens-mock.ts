/**
 * CR-015: the MOCK adapter of the media API (docs/architecture/MEDIA_API.md §4). Eight screens taken from the approved
 * mockup (docs/design/mockups/media/index.html, SEED): a Samsung playing an app with a linked receiver, an LG on the TV
 * source, a Samsung Frame in art mode, an Android TV that is off, a generic screen, an LG without remote power-on, an
 * Android TV on its screensaver with a receiver, and an unavailable LG. Same shapes and error codes as the backend;
 * mutations apply at once (the specs stay deterministic) and are kept for the session. No network, no timers.
 *
 * Owned by the coordinator with media-screens.ts. Names and values are invented; nothing here comes from a real system.
 */
import { ApiError } from './client';
import {
  DEFAULT_REMOTE, EMPTY_LAYOUT, KEY_IDS, TEXT_MAX, commandOffered,
  type BulkPreview, type BulkScope, type CommandResult, type DeviceRemoteBody, type Glyph, type KeyId, type LayoutResponse,
  type MediaAdapter, type MediaCaps, type MediaCommand, type MediaDevice, type MediaDeviceDetail, type MediaLayout, type MediaStatus,
  type NowShowing, type ProfileId, type RecentItem, type RemoteConfig, type SourceItem,
} from './media-screens';

/** Built on first use, never at module load: media-screens.ts and this file import each other, so reading KEY_IDS while the
 * module evaluates would hit the temporal dead zone when this file is the one loaded first. */
function profileKeys(p: ProfileId): KeyId[] {
  switch (p) {
    case 'samsung_smart': return KEY_IDS.filter((k) => !['settings', 'blue', 'rew', 'ff'].includes(k));
    case 'lg_webos': return KEY_IDS.filter((k) => !['tools', 'source', 'settings', 'chlist', 'prech', 'stop', 'rew', 'ff'].includes(k));
    case 'android_tv': return KEY_IDS.filter((k) => !['exit', 'tools', 'chlist', 'prech'].includes(k));
    default: return [];
  }
}

type Feat = 'on' | 'off' | 'vset' | 'vstep' | 'mute' | 'src' | 'play' | 'pause' | 'stop' | 'next' | 'prev';
interface Seed {
  key: string; name: string; area: [string, string]; floor: [string, string]; profile: ProfileId; feat: Feat[];
  power: MediaDevice['live']['power']; play: MediaDevice['live']['play']; now: Partial<NowShowing> & { kind: NowShowing['kind'] };
  volume: number; sources: string[]; apps: string[]; recent: string[]; link?: string; public?: boolean; since?: string;
}

const G = ['קומת קרקע', 'g'] as const;
const U1 = ['קומה 1', 'u1'] as const;
const B = ['מרתף', 'b'] as const;
const ALL: Feat[] = ['on', 'off', 'vset', 'vstep', 'mute', 'src', 'play', 'pause', 'stop', 'next', 'prev'];
const APP_GLYPH: Record<string, [Glyph, number]> = {
  Netflix: ['film', 265], YouTube: ['playRect', 172], 'Disney+': ['sparkle', 232], Spotify: ['music', 38], ספורט: ['ball', 135],
  חדשות: ['news', 217], ילדים: ['smile', 330], Plex: ['playRect', 48], דפדפן: ['globe', 215], גלריה: ['image', 190],
};

function seeds(): Seed[] {
  return [
    { key: 'md-living', name: 'טלוויזיה סלון', area: ['סלון', 'living'], floor: [G[1], G[0]], profile: 'samsung_smart', feat: ALL, power: 'on', play: 'playing',
      now: { kind: 'app', label: 'Netflix', app_id: 'Netflix', title: 'סדרה · עונה 2 פרק 3', position_s: 1520, duration_s: 3120 }, volume: 32,
      sources: ['TV', 'HDMI1', 'HDMI2', 'HDMI3'], apps: ['Netflix', 'YouTube', 'Disney+', 'Spotify', 'ספורט', 'חדשות', 'דפדפן', 'גלריה'],
      recent: ['app:Netflix', 'src:HDMI1', 'app:YouTube'], link: 'מגבר סלון' },
    { key: 'md-kitchen', name: 'טלוויזיה מטבח', area: ['מטבח', 'kitchen'], floor: [G[1], G[0]], profile: 'lg_webos', feat: ALL, power: 'on', play: null,
      now: { kind: 'source', label: 'טלוויזיה', source_id: 'Live TV', channel: '12' }, volume: 18,
      sources: ['Live TV', 'HDMI 1', 'HDMI 2'], apps: ['YouTube', 'Netflix', 'חדשות', 'Spotify', 'דפדפן'], recent: ['src:Live TV', 'app:YouTube'] },
    { key: 'md-pergola', name: 'מסך פרגולה', area: ['פרגולה', 'pergola'], floor: [G[1], G[0]], profile: 'samsung_smart', feat: ALL, power: 'art', play: null,
      now: { kind: 'art', label: 'מצב אמנות' }, volume: 20, sources: ['TV', 'HDMI1'], apps: ['YouTube', 'Netflix', 'Spotify', 'גלריה'], recent: ['app:YouTube'], public: true },
    { key: 'md-parents', name: 'טלוויזיה הורים', area: ['חדר הורים', 'parents'], floor: [U1[1], U1[0]], profile: 'android_tv',
      feat: ['on', 'off', 'vstep', 'mute', 'play', 'pause', 'stop', 'next', 'prev'], power: 'off', play: null, now: { kind: 'home', label: '' }, volume: 12,
      sources: [], apps: ['Netflix', 'YouTube', 'Disney+', 'Plex', 'Spotify', 'ילדים'], recent: ['app:Netflix', 'app:Plex'] },
    { key: 'md-kids', name: 'מסך ילדים', area: ['חדר ילדים', 'kids'], floor: [U1[1], U1[0]], profile: 'generic', feat: ['on', 'off', 'vset', 'mute', 'src', 'play', 'pause'],
      power: 'on', play: 'paused', now: { kind: 'source', label: 'HDMI 1', source_id: 'HDMI 1', title: 'סרט אנימציה', position_s: 2400, duration_s: 5400 }, volume: 20,
      sources: ['HDMI 1', 'HDMI 2', 'USB'], apps: [], recent: ['src:HDMI 1', 'src:USB'] },
    { key: 'md-office', name: 'מסך חדר עבודה', area: ['חדר עבודה', 'office'], floor: [U1[1], U1[0]], profile: 'lg_webos',
      feat: ['off', 'vset', 'vstep', 'mute', 'src', 'play', 'pause', 'stop', 'next', 'prev'], power: 'off', play: null, now: { kind: 'none', label: '' }, volume: 25,
      sources: ['Live TV', 'HDMI 1', 'HDMI 2'], apps: ['YouTube', 'דפדפן'], recent: [] },
    { key: 'md-cinema', name: 'קולנוע ביתי', area: ['מרתף', 'basement'], floor: [B[1], B[0]], profile: 'android_tv',
      feat: ['on', 'off', 'vstep', 'mute', 'play', 'pause', 'stop', 'next', 'prev'], power: 'on', play: 'idle', now: { kind: 'saver', label: 'שומר מסך' }, volume: 22,
      sources: [], apps: ['Netflix', 'YouTube', 'Disney+', 'Plex', 'Spotify', 'ספורט'], recent: ['app:Plex', 'app:Netflix', 'app:ספורט'], link: 'מגבר מרתף' },
    { key: 'md-gym', name: 'מסך חדר כושר', area: ['חדר כושר', 'gym'], floor: [B[1], B[0]], profile: 'lg_webos',
      feat: ['off', 'vset', 'vstep', 'mute', 'src', 'play', 'pause'], power: 'unavailable', play: null, now: { kind: 'none', label: '' }, volume: 30,
      sources: ['Live TV', 'HDMI 1'], apps: ['YouTube', 'Spotify'], recent: [], since: '2026-09-30T11:20:00Z' },
  ];
}

const srcGlyph = (s: string): Glyph => (/^(tv|live tv)$/i.test(s) ? 'antenna' : /usb/i.test(s) ? 'image' : 'hdmi');
const srcLabel = (s: string): string => (/^(tv|live tv)$/i.test(s) ? 'טלוויזיה' : s.replace(/^HDMI(\d)$/, 'HDMI $1'));
const source = (s: string): SourceItem => ({ id: s, label: srcLabel(s), kind: 'source', glyph: srcGlyph(s), hue: null });
const app = (a: string): SourceItem => ({ id: a, label: a, kind: 'app', glyph: APP_GLYPH[a]?.[0] ?? 'app', hue: APP_GLYPH[a]?.[1] ?? 210 });

function caps(s: Seed): MediaCaps {
  const f = (x: Feat) => s.feat.includes(x);
  const keys = profileKeys(s.profile);
  return {
    power_on: f('on'), power_on_reason: f('on') ? null : 'no_remote_wake', power_off: f('off'),
    volume_set: f('vset') && !s.link, volume_step: f('vstep') || !!s.link, mute: f('mute'),
    sources: f('src') && s.sources.length > 0, apps: s.apps.length > 0, sound_outputs: s.profile === 'lg_webos' ? ['tv_speaker', 'external_arc'] : [],
    transport: { play: f('play'), pause: f('pause'), stop: f('stop'), next: f('next'), previous: f('prev'), seek: false },
    keys, text: s.profile === 'samsung_smart' || s.profile === 'android_tv', touchpad: keys.length > 0, art_mode: s.power === 'art',
  };
}

interface Row { seed: Seed; device: MediaDeviceDetail }

function build(s: Seed): Row {
  const now: NowShowing = { label: '', app_id: null, source_id: null, title: null, channel: null, position_s: null, duration_s: null, position_at: null, artwork: null, glyph: 'app', hue: null, ...s.now };
  if (now.kind === 'app' && now.app_id) [now.glyph, now.hue] = APP_GLYPH[now.app_id] ?? ['app', 210];
  if (now.kind === 'source' && now.source_id) now.glyph = srcGlyph(now.source_id);
  const recent: RecentItem[] = s.recent.map((r) => {
    const [kind, id] = r.split(':') as ['app' | 'src', string];
    const it = kind === 'app' ? app(id) : source(id);
    return { kind: kind === 'app' ? 'app' : 'source', id, label: it.label, glyph: it.glyph };
  });
  const device: MediaDeviceDetail = {
    key: s.key, name: s.name, kind: 'screen', profile: s.profile, floor_id: s.floor[0], floor_name: s.floor[1], area_id: s.area[1], area_name: s.area[0],
    public: !!s.public,
    live: { power: s.power, play: s.play, confirmed: s.power !== 'unknown', since: s.since ?? null, now,
      volume: { level: s.volume, muted: false, target: s.link ? 'linked' : 'screen', step_only: !!s.link || !s.feat.includes('vset') }, sound_output: s.profile === 'lg_webos' ? 'tv_speaker' : null },
    caps: caps(s),
    audio_link: s.link ? { key: `${s.key}-amp`, name: s.link, default: 'linked' } : null,
    can: { control: true, power: true, public_ok: true, bulk: true },
    sources: s.sources.map(source), apps: s.apps.map(app), recent,
    remote: { ...DEFAULT_REMOTE, sections: DEFAULT_REMOTE.sections.map((x) => ({ ...x })), more: [...DEFAULT_REMOTE.more] },
    model_keys: [],
  };
  return { seed: s, device };
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const fail = (status: number, code: string, message: string): never => {
  throw new ApiError(status, { code, user_message: message, retryable: false, correlation_id: 'mock', details: {} });
};
const list = (d: MediaDeviceDetail): MediaDevice => {
  const { sources: _s, apps: _a, recent: _r, remote: _m, model_keys: _k, ...rest } = d;
  return clone(rest);
};

export class MediaMockStore implements MediaAdapter {
  rows: Row[] = seeds().map(build);
  layoutState: { layout: MediaLayout; revision: number } = { layout: clone(EMPTY_LAYOUT), revision: 1 };
  remoteState: RemoteConfig = clone(DEFAULT_REMOTE);
  /** Every command the mock accepted, in order (specs assert on it the way the live fixture logs keys). */
  sent: { key: string; command: MediaCommand }[] = [];
  private seen = new Set<string>();

  private row(key: string): Row {
    return this.rows.find((r) => r.device.key === key) ?? fail(404, 'not_found', 'המסך לא נמצא.');
  }

  async status(): Promise<MediaStatus> {
    const screens = this.rows.map((r) => r.device);
    return {
      enabled: true, bridge: { paired: true, version: '0.4.0', media_ready: true },
      can: { read: true, control: true, power: true, public: true, bulk: true, layout: true, configure: true, personalize: true },
      counts: { screens: screens.length, on: screens.filter((d) => d.live.power === 'on').length, pending_approval: 0 }, profiles_version: 1,
    };
  }

  async list(q: { floor?: string; area?: string; q?: string } = {}): Promise<{ devices: MediaDevice[] }> {
    const text = (q.q ?? '').trim();
    return {
      devices: this.rows.map((r) => r.device)
        .filter((d) => (!q.floor || d.floor_id === q.floor) && (!q.area || d.area_id === q.area) && (!text || d.name.includes(text) || (d.area_name ?? '').includes(text)))
        .map(list),
    };
  }

  async get(key: string): Promise<MediaDeviceDetail> {
    return clone(this.row(key).device);
  }

  async command(key: string, body: MediaCommand & { client_request_id: string; expires_at: string }): Promise<CommandResult> {
    const d = this.row(key).device;
    const { client_request_id: rid, expires_at: _e, ...cmd } = body;
    const command = cmd as MediaCommand;
    if (this.seen.has(rid)) return { command_id: rid, status: 'accepted', action_id: null, confirm: 'none', error: null };
    if (command.command === 'text' && command.text.length > TEXT_MAX) fail(422, 'validation', `עד ${TEXT_MAX} תווים.`);
    if (d.live.power === 'unavailable') fail(409, 'unavailable', 'המסך אינו זמין.');
    if (!commandOffered(d, command)) fail(422, d.live.power === 'on' ? 'not_supported' : 'screen_off', 'הפעולה אינה זמינה למסך זה עכשיו.');
    this.seen.add(rid);
    this.sent.push({ key, command });
    const l = d.live;
    switch (command.command) {
      case 'power_on': l.power = 'on'; l.play = null; break;
      case 'power_off': l.power = 'off'; l.play = null; break;
      case 'volume_set': l.volume.level = Math.round(command.level); break;
      case 'volume_step': l.volume.level = Math.max(0, Math.min(100, (l.volume.level ?? 0) + (command.direction === 'up' ? 2 : -2))); break;
      case 'mute': l.volume.muted = command.muted; break;
      case 'source': case 'app': {
        const it = (command.command === 'source' ? d.sources : d.apps).find((x) => x.id === (command.command === 'source' ? command.source_id : command.app_id))
          ?? fail(422, 'not_supported', 'המקור אינו ברשימה.');
        l.now = { ...l.now, kind: command.command === 'source' ? 'source' : 'app', label: it.label, app_id: command.command === 'app' ? it.id : null, source_id: command.command === 'source' ? it.id : null, title: null, glyph: it.glyph, hue: it.hue };
        const pick: RecentItem = { kind: command.command === 'source' ? 'source' : 'app', id: it.id, label: it.label, glyph: it.glyph };
        d.recent = [pick, ...d.recent.filter((r) => r.id !== it.id)].slice(0, 6);
        break;
      }
      case 'transport': l.play = command.action === 'pause' || (command.action === 'play_pause' && l.play === 'playing') ? 'paused' : command.action === 'stop' ? 'idle' : 'playing'; break;
      case 'sound_output': l.sound_output = command.output; break;
      default: return { command_id: rid, status: 'sent', action_id: null, confirm: 'none', error: null }; // keys, text
    }
    const confirmable = !['volume_step'].includes(command.command);
    return { command_id: rid, status: 'accepted', action_id: confirmable ? `mock-${this.sent.length}` : null, confirm: confirmable ? 'state' : 'none', error: null };
  }

  async layout(): Promise<LayoutResponse> {
    return { installation: clone(this.layoutState.layout), personal: null, revision: this.layoutState.revision, can_edit: true, can_personalize: true };
  }

  async saveLayout(layout: MediaLayout, baseRevision: number): Promise<LayoutResponse> {
    if (baseRevision !== this.layoutState.revision) fail(409, 'revision_conflict', 'המסך נערך במקום אחר; טענו מחדש.');
    this.layoutState = { layout: clone(layout), revision: this.layoutState.revision + 1 };
    return this.layout();
  }

  async resetLayout(): Promise<LayoutResponse> {
    this.layoutState = { layout: clone(EMPTY_LAYOUT), revision: this.layoutState.revision + 1 };
    return this.layout();
  }

  async remoteDefault(): Promise<RemoteConfig> {
    return clone(this.remoteState);
  }

  async saveRemoteDefault(cfg: RemoteConfig): Promise<RemoteConfig> {
    this.remoteState = { ...clone(cfg), scope: 'default' };
    for (const r of this.rows) if (r.device.remote.scope === 'default') r.device.remote = clone(this.remoteState);
    return this.remoteDefault();
  }

  async saveDeviceRemote(key: string, body: DeviceRemoteBody): Promise<MediaDeviceDetail> {
    const d = this.row(key).device;
    d.remote = body.remote ? { ...clone(body.remote), scope: 'device' } : clone(this.remoteState);
    const curate = (items: SourceItem[], edits: DeviceRemoteBody['sources']) => {
      if (!edits) return items;
      const byId = new Map(items.map((i) => [i.id, i]));
      return edits.filter((e) => !e.hidden && byId.has(e.id)).map((e) => ({ ...byId.get(e.id)!, label: e.label ?? byId.get(e.id)!.label, glyph: e.glyph ?? byId.get(e.id)!.glyph }));
    };
    d.sources = curate(d.sources, body.sources);
    d.apps = curate(d.apps, body.apps);
    return clone(d);
  }

  async bulkPreview(scope: BulkScope, id: string): Promise<BulkPreview> {
    const inScope = this.rows.map((r) => r.device).filter((d) => (scope === 'floor' ? d.floor_id : d.area_id) === id);
    const reason = (d: MediaDevice): BulkPreview['devices'][number]['reason'] => {
      if (!d.can.bulk) return 'not_allowed';
      if (d.live.power === 'unavailable' || d.live.power === 'unknown') return 'unavailable';
      if (d.live.power === 'off' || d.live.power === 'standby') return 'already_off';
      if (d.live.power === 'on' && !d.live.confirmed) return 'not_confirmed';
      return null;
    };
    const devices = inScope.map((d) => ({ key: d.key, name: d.name, will: reason(d) ? ('skip' as const) : ('off' as const), reason: reason(d) }));
    const count = (r: string) => devices.filter((x) => x.reason === r).length;
    const label = scope === 'floor' ? inScope[0]?.floor_name ?? id : inScope[0]?.area_name ?? id;
    return { scope, id, label, devices, counts: { send: devices.filter((x) => x.will === 'off').length, already_off: count('already_off'), not_confirmed: count('not_confirmed'), unavailable: count('unavailable'), not_allowed: count('not_allowed') } };
  }

  async bulkRun(scope: BulkScope, id: string, clientRequestId: string, _expiresAt: string): Promise<{ bulk_id: string; status: string }> {
    const p = await this.bulkPreview(scope, id);
    for (const x of p.devices) if (x.will === 'off') this.row(x.key).device.live.power = 'off';
    return { bulk_id: `mock-bulk-${clientRequestId.slice(0, 8)}`, status: 'done' };
  }
}

let store: MediaMockStore | null = null;
/** The session's mock store (one per page load). */
export function mediaMock(): MediaMockStore {
  return (store ??= new MediaMockStore());
}
/** A fresh store (specs). */
export function resetMediaMock(): MediaMockStore {
  store = new MediaMockStore();
  return store;
}
