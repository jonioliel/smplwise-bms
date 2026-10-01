/**
 * CR-015: the administration routes of the media model (MEDIA_API.md §3.11-§3.14, `#/system/multimedia`, system.configure):
 * every discovered device with its endpoints, approval, kind, public flag, profile, linked receiver and volume ceiling; the
 * link / unlink / ignore overrides; "approve all". The S0 client (media-screens.ts) carries the screens page's routes only,
 * so the typed client of these four routes lives here, with the same shape as the contract and an in-memory MOCK for the
 * static demo (no backend: settings work for design review). MACs, identifiers and IPs never appear here - the contract
 * returns none; `anchor_entity_id` is the administrator's own view.
 */
import { get, post, put } from './client';
import { isApi } from './session';
import { getDevicesTree } from './devices';
import type { KeyId, MediaKind, ProfileId } from './media-screens';
import type { MusicProvider, PlayerKind, VolumeNight } from './media-players';

export type Control = 'power' | 'volume' | 'mute' | 'sources' | 'apps' | 'keys' | 'now_playing';
/** CR-016: `music` (the device's music layer, CR §5.2) and `mirror` (a poorer cloud twin, hidden, never primary) join the CR-015 roles. */
export type EndpointRole = 'vendor' | 'remote' | 'cast' | 'dlna' | 'smartthings' | 'ma_export' | 'ma_import' | 'ma_native' | 'ma_universal' | 'other' | 'music' | 'mirror';

export interface AdminEndpoint {
  endpoint_id: string;
  /** The integration that owns it (settings screens keep the exact technical names). */
  platform: string;
  role: EndpointRole;
  /** Which rung of the dedupe ladder joined it (1-6). */
  rule: string;
  link_source: 'auto' | 'manual';
  hidden: boolean;
  primary_for: Control[];
}

export interface AdminDevice {
  key: string;
  name: string;
  /** CR-016 adds the non-physical kinds (`session`, `virtual_group`, `service`: listed apart, never offered as devices). */
  kind: MediaKind | PlayerKind;
  kind_source: 'auto' | 'manual';
  approved: boolean;
  public: boolean;
  profile: ProfileId;
  profile_source: 'auto' | 'manual';
  confidence: 'exact' | 'strong' | 'weak' | 'manual';
  anchor_entity_id: string;
  floor_name: string | null;
  area_name: string | null;
  audio_link_key: string | null;
  audio_default: 'screen' | 'linked';
  /** null = no ceiling (CR-016 decision 7ב: there is no default). */
  volume_max: number | null;
  /** CR-016: a second ceiling that applies inside the window; null = none. */
  volume_night?: VolumeNight | null;
  /** CR-016: the HA area (null = "לא משויכים"); a device without one can be placed from the settings (an administrator action). */
  area_id?: string | null;
  /** CR-016: which layer answers the music controls (settings keep the exact technical names). */
  music_provider?: MusicProvider;
  /** CR-016: the zones of a multi-zone receiver (Main first); null otherwise. */
  zones?: { id: string; name: string }[] | null;
  model_keys: KeyId[];
  /** The keys the server accepts in `model_keys` for this profile (absent in the static demo: every extra key is offered). */
  model_key_options?: KeyId[];
  /** Read-only: what else turns this screen on (an integration's own sync), by name. */
  also_turns_on: string[];
  endpoints: AdminEndpoint[];
}

export interface AdminSuggestion {
  endpoint_id: string;
  device_key: string;
  rule: 'weak';
  reason: string;
  /** The merge target's name, when the server resolves it. */
  device_name?: string | null;
}

export interface AdminList {
  devices: AdminDevice[];
  suggestions: AdminSuggestion[];
}

export interface AdminDevicePatch {
  display_name?: string | null;
  kind?: MediaKind | PlayerKind;
  approved?: boolean;
  public?: boolean;
  /** null = detected automatically. */
  profile?: ProfileId | null;
  audio_link_key?: string | null;
  audio_default?: 'screen' | 'linked';
  volume_max?: number | null;
  /** CR-016: null clears the window. */
  volume_night?: VolumeNight | null;
  /** CR-016: places an unplaced device (the bridge writes the entity registry; the area must exist). */
  area_id?: string | null;
  model_keys?: KeyId[];
  primary?: Partial<Record<Control, string>>;
}

export type LinkOp = { op: 'link' | 'unlink' | 'ignore' | 'restore'; endpoint_id: string; device_key?: string };

export interface AdminAdapter {
  list(): Promise<AdminList>;
  update(key: string, patch: AdminDevicePatch): Promise<AdminDevice>;
  link(op: LinkOp): Promise<AdminList>;
  approve(keys: string[], approved: boolean): Promise<Record<string, number>>;
}

const http: AdminAdapter = {
  list: () => get('multimedia/admin/devices'),
  update: (key, patch) => put(`multimedia/admin/devices/${encodeURIComponent(key)}`, patch),
  // the server answers {devices} only (no suggestions): the page wants both, so the list is read again after the write
  link: async (op) => {
    await post('multimedia/admin/links', op);
    return get<AdminList>('multimedia/admin/devices');
  },
  approve: (device_keys, approved) => post('multimedia/admin/approve', { device_keys, approved }),
};

// ------------------------------------------------------------------------------------------------ the demo

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function demoDevices(): AdminDevice[] {
  const ep = (id: string, platform: string, role: EndpointRole, rule: string, hidden: boolean, primary: Control[] = [], manual = false): AdminEndpoint => ({
    endpoint_id: id, platform, role, rule, link_source: manual ? 'manual' : 'auto', hidden, primary_for: primary,
  });
  const dev = (key: string, name: string, floor: string, area: string, profile: ProfileId, approved: boolean, endpoints: AdminEndpoint[], extra: Partial<AdminDevice> = {}): AdminDevice => ({
    key, name, kind: 'screen', kind_source: 'auto', approved, public: false, profile, profile_source: 'auto', confidence: 'exact', anchor_entity_id: endpoints[0].endpoint_id.replace(/^ha:/, ''),
    floor_name: floor, area_name: area, audio_link_key: null, audio_default: 'screen', volume_max: null, model_keys: [], also_turns_on: [], endpoints, ...extra,
  });
  return [
    dev('md-living', 'טלוויזיה סלון', 'קומת קרקע', 'סלון', 'samsung_smart', true, [
      ep('ha:media_player.demo_living', 'samsungtv_smart', 'vendor', '1', false, ['power', 'sources', 'apps', 'keys']),
      ep('ha:media_player.demo_living_cast', 'cast', 'cast', '3', true, ['now_playing']),
      ep('ha:media_player.demo_living_st', 'smartthings', 'smartthings', '3', true),
      ep('ha:media_player.demo_living_ma', 'music_assistant', 'ma_export', '2', true),
    ], { confidence: 'strong', audio_link_key: 'md-living-amp', audio_default: 'linked', also_turns_on: ['מגבר סלון'], volume_max: 60 }),
    dev('md-kitchen', 'טלוויזיה מטבח', 'קומת קרקע', 'מטבח', 'lg_webos', true, [ep('ha:media_player.demo_kitchen', 'webostv', 'vendor', '1', false, ['power', 'volume', 'mute', 'sources', 'apps', 'keys', 'now_playing'])]),
    dev('md-pergola', 'מסך פרגולה', 'קומת קרקע', 'פרגולה', 'samsung_smart', true, [ep('ha:media_player.demo_pergola', 'samsungtv_smart', 'vendor', '1', false, ['power', 'sources', 'apps', 'keys'])], { public: true }),
    dev('md-parents', 'טלוויזיה הורים', 'קומה 1', 'חדר הורים', 'android_tv', true, [
      ep('ha:remote.demo_parents', 'androidtv_remote', 'remote', '1', false, ['power', 'apps', 'keys']),
      ep('ha:media_player.demo_parents_cast', 'cast', 'cast', '1', false, ['now_playing']),
    ]),
    dev('md-kids', 'מסך ילדים', 'קומה 1', 'חדר ילדים', 'generic', true, [ep('ha:media_player.demo_kids', 'dlna_dmr', 'dlna', '1', false, ['power', 'volume', 'mute', 'sources', 'now_playing'])]),
    dev('md-new', 'מסך חדש שזוהה', 'קומה 1', 'חדר עבודה', 'generic', false, [ep('ha:media_player.demo_new', 'samsungtv', 'vendor', '1', false, ['power'])], { confidence: 'weak' }),
    dev('md-speaker', 'רמקול מטבח', 'קומת קרקע', 'מטבח', 'generic', false, [ep('ha:media_player.demo_speaker', 'cast', 'cast', '1', false, ['volume', 'now_playing'])], { kind: 'speaker' }),
    dev('md-living-amp', 'מגבר סלון', 'קומת קרקע', 'סלון', 'generic', false, [ep('ha:media_player.demo_amp', 'denonavr', 'other', '1', false, ['volume', 'mute'])], { kind: 'receiver' }),
  ];
}

class DemoAdmin implements AdminAdapter {
  devices = demoDevices();
  suggestions: AdminSuggestion[] = [{ endpoint_id: 'ha:media_player.demo_speaker', device_key: 'md-kitchen', rule: 'weak', reason: 'אותו חדר ושם דומה' }];

  private snapshot(): AdminList {
    return clone({ devices: this.devices, suggestions: this.suggestions });
  }

  async list() {
    return this.snapshot();
  }

  async update(key: string, patch: AdminDevicePatch) {
    const d = this.devices.find((x) => x.key === key);
    if (!d) throw new Error('not found');
    if (patch.display_name !== undefined) d.name = patch.display_name?.trim() || d.name;
    if (patch.kind) [d.kind, d.kind_source] = [patch.kind, 'manual'];
    if (patch.approved !== undefined) d.approved = patch.approved;
    if (patch.public !== undefined) d.public = patch.public;
    if (patch.profile !== undefined) [d.profile, d.profile_source] = patch.profile ? [patch.profile, 'manual'] : [d.profile, 'auto'];
    if (patch.audio_link_key !== undefined) d.audio_link_key = patch.audio_link_key;
    if (patch.audio_default) d.audio_default = patch.audio_default;
    if (patch.volume_max !== undefined) d.volume_max = patch.volume_max;
    if (patch.volume_night !== undefined) d.volume_night = patch.volume_night;
    if (patch.area_id !== undefined) {
      d.area_id = patch.area_id;
      d.area_name = patch.area_id ? DEMO_AREAS.find((a) => a.id === patch.area_id)?.name ?? patch.area_id : null;
    }
    if (patch.model_keys) d.model_keys = patch.model_keys;
    return clone(d);
  }

  async link(op: LinkOp) {
    for (const d of this.devices) {
      const e = d.endpoints.find((x) => x.endpoint_id === op.endpoint_id);
      if (!e) continue;
      if (op.op === 'ignore') e.hidden = true;
      if (op.op === 'restore') e.hidden = false;
      if (op.op === 'unlink') e.link_source = 'manual';
    }
    if (op.op === 'link') this.suggestions = this.suggestions.filter((s) => s.endpoint_id !== op.endpoint_id);
    return this.snapshot();
  }

  async approve(keys: string[], approved: boolean) {
    for (const d of this.devices) if (keys.includes(d.key)) d.approved = approved;
    return { updated: keys.length };
  }
}

/** The areas a device can be placed in: the home screen's tree with a backend; the demo's own rooms without one. */
export const DEMO_AREAS: { id: string; name: string; floor_name: string | null }[] = [
  { id: 'living', name: 'סלון', floor_name: 'קומת קרקע' }, { id: 'kitchen', name: 'מטבח', floor_name: 'קומת קרקע' }, { id: 'pergola', name: 'פרגולה', floor_name: 'קומת קרקע' },
  { id: 'guest', name: 'חדר אורחים', floor_name: 'קומת קרקע' }, { id: 'parents', name: 'חדר הורים', floor_name: 'קומה 1' }, { id: 'kids', name: 'חדר ילדים', floor_name: 'קומה 1' },
  { id: 'office', name: 'חדר עבודה', floor_name: 'קומה 1' }, { id: 'basement', name: 'מרתף', floor_name: 'מרתף' },
];
export async function adminAreas(): Promise<{ id: string; name: string; floor_name: string | null }[]> {
  if (!isApi()) return DEMO_AREAS;
  try {
    const t = await getDevicesTree();
    return t.floors.flatMap((f) => f.areas.map((a) => ({ id: a.area_id, name: a.name, floor_name: f.floor_id === 'none' ? null : f.name })));
  } catch {
    return [];
  }
}

let demo: DemoAdmin | null = null;
/** The adapter in force: HTTP with a backend, the in-memory demo otherwise. */
export const mediaAdmin = (): AdminAdapter => (isApi() ? http : (demo ??= new DemoAdmin()));
/** Specs: a fresh demo. */
export const resetMediaAdminDemo = (): void => {
  demo = null;
};

export const PROFILE_LABEL: Record<ProfileId, string> = {
  samsung_smart: 'Samsung (samsungtv_smart)',
  lg_webos: 'LG (webostv)',
  android_tv: 'Android TV (androidtv_remote)',
  generic: 'כללי',
};
export const KIND_LABEL: Partial<Record<MediaKind, string>> = { screen: 'מסך', receiver: 'מגבר', speaker: 'רמקול', player: 'נגן' };
/** CR-016: every kind by name (the non-physical ones are listed apart, never chosen as a kind). */
export const ANY_KIND_LABEL: Record<MediaKind | PlayerKind, string> = { screen: 'מסך', receiver: 'מגבר', speaker: 'רמקול', player: 'נגן', group: 'קבוצה', session: 'סשן', virtual_group: 'קבוצה וירטואלית', service: 'שירות' };
export const ROLE_LABEL: Record<EndpointRole, string> = {
  vendor: 'יצרן', remote: 'שלט', cast: 'Cast', dlna: 'DLNA', smartthings: 'SmartThings', ma_export: 'Music Assistant (יצוא)', ma_import: 'Music Assistant (יבוא)',
  ma_native: 'Music Assistant', ma_universal: 'Music Assistant (אוניברסלי)', other: 'אחר', music: 'שכבת המוזיקה', mirror: 'מראה (מוסתר)',
};
export const CONTROL_LABEL: Record<Control, string> = {
  power: 'הפעלה', volume: 'עוצמה', mute: 'השתקה', sources: 'מקורות', apps: 'אפליקציות', keys: 'מקשים', now_playing: 'מה מתנגן',
};
export const CONFIDENCE_LABEL: Record<AdminDevice['confidence'], string> = { exact: 'מדויק', strong: 'חזק', weak: 'חלש', manual: 'ידני' };
