/**
 * MU2 (voice announcements): the typed client of `/api/v1/announcements/*`. Speaking needs `media.announce`; the setup, the test and the history
 * need `system.configure`. Nothing here picks a device: the server only ever speaks to the speakers an administrator allowed.
 * ANNOUNCE-295 (stage A, speakers only): the built-in `announcer` role holds `media.announce`; ready-made templates (routine and emergency, he / en / ru),
 * the one-click emergency announcement, the quiet-hours modes (suppress / lower / queue / allow) and the engine selector (local by default; the cloud
 * engine is behind its own switch, OFF by default, and its key lives in the secrets store - never in these answers).
 */
import { get, post, put } from './client';

export interface AnnounceConfig {
  enabled: boolean;
  engine: string;
  language: string;
  devices: string[];
  /** ANNOUNCE-295: the engine selector (`local` by default), the cloud switch (OFF by default: the text leaves the building), whether the key is stored (never the key) */
  engine_kind: AnnounceEngineKind;
  cloud_enabled: boolean;
  cloud_key_set: boolean;
  emergency_languages: AnnounceLang[];
  max_per_minute: number;
  max_text: number;
  cooldown_s: number;
  /** ANN2: the default volume in percent (null = leave the speaker as it is), pause playing music, quiet hours, routing of notifications */
  volume: number | null;
  pause_music: boolean;
  quiet: AnnounceQuiet;
  notify: AnnounceNotify;
  /** ANNOUNCEB-295 (stage B): the text is also shown on the allowed screens; OFF by default */
  screens: AnnounceScreensConfig;
  /** ANNOUNCE-297 (stage C): automatic translation of a Hebrew text into ar / en / ru for review; OFF by default (absent on an older server) */
  translate?: AnnounceTranslateConfig;
}
export type AnnounceTranslateTarget = 'ar' | 'en' | 'ru';
export const ANNOUNCE_TRANSLATE_TARGETS: readonly AnnounceTranslateTarget[] = ['ar', 'en', 'ru'];
export interface AnnounceTranslateConfig {
  enabled: boolean;
  /** ANNOUNCE2-297: `google` by default (the free Google translation, no key); `cloud` = OpenAI (its key lives in the secrets store, never here); `off` */
  provider: string;
  source: 'he';
  targets: AnnounceTranslateTarget[];
  /** who approved sending announcement text to this provider, and when; null = not approved (it cannot be switched on) */
  approval: { provider: string; by: string | null; at: string } | null;
  key_set: boolean;
}
/** One draft translation: shown to the sender for review and edit, never sent by itself. */
export interface AnnounceTranslation {
  language: AnnounceTranslateTarget;
  text: string;
  machine: true;
  cached: boolean;
}
export interface AnnounceScreensConfig {
  enabled: boolean;
  /** shown on the screens when the sender does not choose */
  default_on: boolean;
  /** how long a normal / an emergency announcement stays on a screen, and how often a screen asks (seconds) */
  seconds: number;
  critical_seconds: number;
  poll_s: number;
  /** ANNOUNCE-297: an emergency announcement cannot be closed on a wall display for this many seconds (0 = at once); absent on an older server */
  critical_close_s?: number;
  targets: AnnounceScreenTarget[];
}
export interface AnnounceScreenTarget {
  /** `board:<id>` (a notice TV board) or `wall:<user id>` (a wall display) */
  key: string;
  area_id: string | null;
  device_key: string | null;
}
export interface AnnounceScreenOption {
  key: string;
  kind: 'board' | 'wall';
  name: string;
  area_id: string | null;
  device_key: string | null;
  allowed: boolean;
}
export interface AnnounceScreenOptions {
  screens: AnnounceScreenOption[];
  /** the approved media screens (TVs) a target can be linked to, so a "device" announcement reaches it */
  devices: { key: string; name: string; area_id: string | null }[];
}
export const ANNOUNCE_SCREEN_RANGE = { seconds: [5, 600], critical_seconds: [10, 3600], poll_s: [2, 30], critical_close_s: [0, 600] } as const;
export interface AnnounceQuiet {
  enabled: boolean;
  from: string;
  to: string;
  days: string[];
  mode: AnnounceQuietMode;
  night_volume: number | null;
}
export type AnnounceQuietMode = 'suppress' | 'lower' | 'queue' | 'allow';
export const ANNOUNCE_QUIET_MODES: readonly AnnounceQuietMode[] = ['suppress', 'lower', 'queue', 'allow'];
export type AnnounceEngineKind = 'local' | 'cloud';
/** The spoken languages (automatic translation between them is a later stage). */
export type AnnounceLang = 'he' | 'en' | 'ru' | 'ar';
export const ANNOUNCE_LANGS: readonly AnnounceLang[] = ['he', 'en', 'ru', 'ar'];
export type AnnounceTemplateKind = 'routine' | 'emergency';
export interface AnnounceTemplate {
  id: string;
  kind: AnnounceTemplateKind;
  name: Partial<Record<AnnounceLang, string>>;
  text: Partial<Record<AnnounceLang, string>>;
}
export type AnnounceSeverity = 'info' | 'alert' | 'critical';
export interface AnnounceNotify {
  enabled: boolean;
  scope: 'area' | 'device';
  ref: string;
  categories: string[];
  min_severity: AnnounceSeverity;
}
export interface AnnounceSpeaker {
  key: string;
  name: string;
  kind: string;
  floor_name: string | null;
  area_id: string | null;
  area_name: string | null;
  allowed: boolean;
}
export interface AnnounceHistoryRow {
  id: string;
  at: string;
  source: 'manual' | 'test' | 'rule' | 'notification' | 'emergency';
  username: string | null;
  rule_id: string | null;
  scope: AnnounceScope;
  scope_ref: string;
  targets: number;
  message: string;
  status: 'pending' | 'sent' | 'failed' | 'limited' | 'refused' | 'queued' | 'cancelled';
  error: string | null;
  notes?: string[];
  languages?: string[];
  template_id?: string | null;
  critical?: boolean;
  release_at?: string | null;
  /** ANNOUNCEB-295: how many screens it was shown on, and until when */
  screens?: number;
  screen_until?: string | null;
  /** ANNOUNCE-297: the languages whose text was machine-translated */
  machine_translated?: string[];
}
export interface AnnounceConfigAnswer {
  config: AnnounceConfig;
  speakers: AnnounceSpeaker[];
  engines: string[];
  /** the speech engines the home system exposes; `cloud` = the engine's integration sends the text to a cloud service */
  engine_info?: { entity_id: string; name: string; platform: string; cloud: boolean }[];
  history: AnnounceHistoryRow[];
  templates: AnnounceTemplate[];
  screen_options?: AnnounceScreenOptions;
}
/** The announce form's data (`media.announce`): the rooms, the templates and the languages. */
export interface AnnounceForm {
  enabled: boolean;
  areas: AnnounceArea[];
  max_text: number;
  templates: AnnounceTemplate[];
  languages: AnnounceLang[];
  default_language: AnnounceLang;
  emergency_languages: AnnounceLang[];
  quiet_mode: AnnounceQuietMode;
  /** ANNOUNCEB-295: the screens switch is on (the form offers "screens") and whether a new announcement is shown there unless the sender says otherwise */
  screens_enabled?: boolean;
  screens_default_on?: boolean;
  /** ANNOUNCE-297: the automatic translation is switched on, approved and configured (the form offers "translate"), and into which languages */
  translate_enabled?: boolean;
  translate_targets?: AnnounceTranslateTarget[];
}
/** A part of an announcement; `machine` = taken from the automatic translation (an editable draft; ANNOUNCE2-297: never a gate on sending), never Hebrew. */
export interface AnnouncePart {
  language: AnnounceLang;
  text: string;
  machine?: boolean;
}
export interface AnnounceResult {
  id: string;
  status: 'sent' | 'queued';
  targets: number;
  /** ANNOUNCEB-295: the screens it is shown on (absent = none) */
  screens?: number;
  release_at?: string;
}
export interface AnnounceArea {
  area_id: string;
  name: string;
  floor_name: string | null;
  devices: { key: string; name: string }[];
  /** ANNOUNCEB-295: allowed screens in this room */
  screens?: number;
}
export type AnnounceConfigPatch = Partial<Pick<AnnounceConfig, 'enabled' | 'engine' | 'language' | 'devices' | 'max_per_minute' | 'volume' | 'pause_music' | 'engine_kind' | 'cloud_enabled' | 'emergency_languages'>> & {
  quiet?: Partial<AnnounceQuiet>;
  screens?: Partial<AnnounceScreensConfig>;
  notify?: Partial<AnnounceNotify>;
  /** ANNOUNCE-297: `approve: true` records the approval for the chosen provider (needed before it can be switched on) */
  translate?: Partial<Pick<AnnounceTranslateConfig, 'enabled' | 'provider' | 'targets'>> & { approve?: boolean };
};
export const ANNOUNCE_CATEGORIES = ['safety', 'alerts', 'doors', 'device_faults', 'automations', 'system', 'security'] as const;
export type AnnounceScope = 'area' | 'device' | 'all';

const BASE = 'announcements';
export const announceConfig = () => get<AnnounceConfigAnswer>(`${BASE}/config`);
export const announcePutConfig = (patch: AnnounceConfigPatch) => put<{ changed: string[] } & AnnounceConfigAnswer>(`${BASE}/config`, patch);
export const announceAreas = () => get<AnnounceForm>(`${BASE}/areas`);
/** `ref` is `*` for scope `all`. Several languages = `texts`, spoken one after the other. */
export const announceSpeak = (body: { scope: AnnounceScope; ref: string; text?: string; language?: AnnounceLang; texts?: AnnouncePart[]; template_id?: string; volume?: number;
  /** ANNOUNCEB-295: `speakers` false = screens only; `screens` omitted = the configured default */ speakers?: boolean; screens?: boolean }) =>
  post<AnnounceResult>(BASE, body);
/** ANNOUNCEB-295: take an announcement off the screens now (the speech is not touched). */
export const announceStopScreens = (id: string) => post<{ stopped: boolean }>(`${BASE}/${encodeURIComponent(id)}/screens/stop`);
/** The ONE-CLICK emergency announcement: no confirmation step, every allowed speaker. */
export const announceEmergency = (body: { template_id: string } | { texts: AnnouncePart[] }) => post<AnnounceResult>(`${BASE}/emergency`, body);
/** ANNOUNCE-297: draft translations of a Hebrew text (nothing is announced). 404 translate_off, 409 translate_not_configured, 429, 502. */
export const announceTranslate = (text: string, targets?: AnnounceTranslateTarget[]) =>
  post<{ provider: string; source: 'he'; items: AnnounceTranslation[] }>(`${BASE}/translate`, { text, ...(targets ? { targets } : {}) });
export const announceTest = (body: { scope: AnnounceScope; ref: string; language: AnnounceLang }) => post<AnnounceResult>(`${BASE}/test`, body);
export const announceTemplates = () => get<{ templates: AnnounceTemplate[]; languages: AnnounceLang[] }>(`${BASE}/templates`);
export const announcePutTemplates = (templates: AnnounceTemplate[]) => put<{ templates: AnnounceTemplate[] }>(`${BASE}/templates`, { templates });
export const announceHistory = (limit = 20) => get<{ history: AnnounceHistoryRow[] }>(`${BASE}/history?limit=${limit}`);
