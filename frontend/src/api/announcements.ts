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
}
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
}
export interface AnnounceConfigAnswer {
  config: AnnounceConfig;
  speakers: AnnounceSpeaker[];
  engines: string[];
  /** the speech engines the home system exposes; `cloud` = the engine's integration sends the text to a cloud service */
  engine_info?: { entity_id: string; name: string; platform: string; cloud: boolean }[];
  history: AnnounceHistoryRow[];
  templates: AnnounceTemplate[];
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
}
export interface AnnounceResult {
  id: string;
  status: 'sent' | 'queued';
  targets: number;
  release_at?: string;
}
export interface AnnounceArea {
  area_id: string;
  name: string;
  floor_name: string | null;
  devices: { key: string; name: string }[];
}
export type AnnounceConfigPatch = Partial<Pick<AnnounceConfig, 'enabled' | 'engine' | 'language' | 'devices' | 'max_per_minute' | 'volume' | 'pause_music' | 'engine_kind' | 'cloud_enabled' | 'emergency_languages'>> & {
  quiet?: Partial<AnnounceQuiet>;
  notify?: Partial<AnnounceNotify>;
};
export const ANNOUNCE_CATEGORIES = ['safety', 'alerts', 'doors', 'device_faults', 'automations', 'system', 'security'] as const;
export type AnnounceScope = 'area' | 'device' | 'all';

const BASE = 'announcements';
export const announceConfig = () => get<AnnounceConfigAnswer>(`${BASE}/config`);
export const announcePutConfig = (patch: AnnounceConfigPatch) => put<{ changed: string[] } & AnnounceConfigAnswer>(`${BASE}/config`, patch);
export const announceAreas = () => get<AnnounceForm>(`${BASE}/areas`);
/** `ref` is `*` for scope `all`. Several languages = `texts`, spoken one after the other. */
export const announceSpeak = (body: { scope: AnnounceScope; ref: string; text?: string; language?: AnnounceLang; texts?: { language: AnnounceLang; text: string }[]; template_id?: string; volume?: number }) =>
  post<AnnounceResult>(BASE, body);
/** The ONE-CLICK emergency announcement: no confirmation step, every allowed speaker. */
export const announceEmergency = (body: { template_id: string } | { texts: { language: AnnounceLang; text: string }[] }) => post<AnnounceResult>(`${BASE}/emergency`, body);
export const announceTest = (body: { scope: AnnounceScope; ref: string; language: AnnounceLang }) => post<AnnounceResult>(`${BASE}/test`, body);
export const announceTemplates = () => get<{ templates: AnnounceTemplate[]; languages: AnnounceLang[] }>(`${BASE}/templates`);
export const announcePutTemplates = (templates: AnnounceTemplate[]) => put<{ templates: AnnounceTemplate[] }>(`${BASE}/templates`, { templates });
export const announceHistory = (limit = 20) => get<{ history: AnnounceHistoryRow[] }>(`${BASE}/history?limit=${limit}`);
