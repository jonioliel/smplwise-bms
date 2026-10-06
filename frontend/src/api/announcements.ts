/**
 * MU2 (voice announcements): the typed client of `/api/v1/announcements/*`. Speaking needs `media.announce`; the setup, the test and the history
 * need `system.configure`. Nothing here picks a device: the server only ever speaks to the speakers an administrator allowed.
 */
import { get, post, put } from './client';

export interface AnnounceConfig {
  enabled: boolean;
  engine: string;
  language: string;
  devices: string[];
  max_per_minute: number;
  max_text: number;
  cooldown_s: number;
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
  source: 'manual' | 'test' | 'rule';
  username: string | null;
  rule_id: string | null;
  scope: 'area' | 'device';
  scope_ref: string;
  targets: number;
  message: string;
  status: 'pending' | 'sent' | 'failed' | 'limited' | 'refused';
  error: string | null;
}
export interface AnnounceConfigAnswer {
  config: AnnounceConfig;
  speakers: AnnounceSpeaker[];
  engines: string[];
  history: AnnounceHistoryRow[];
}
export interface AnnounceArea {
  area_id: string;
  name: string;
  floor_name: string | null;
  devices: { key: string; name: string }[];
}
export type AnnounceConfigPatch = Partial<Pick<AnnounceConfig, 'enabled' | 'engine' | 'language' | 'devices' | 'max_per_minute'>>;
export type AnnounceScope = 'area' | 'device';

const BASE = 'announcements';
export const announceConfig = () => get<AnnounceConfigAnswer>(`${BASE}/config`);
export const announcePutConfig = (patch: AnnounceConfigPatch) => put<{ changed: string[] } & AnnounceConfigAnswer>(`${BASE}/config`, patch);
export const announceAreas = () => get<{ enabled: boolean; areas: AnnounceArea[]; max_text: number }>(`${BASE}/areas`);
export const announceSpeak = (body: { scope: AnnounceScope; ref: string; text: string }) => post<{ id: string; status: string; targets: number }>(BASE, body);
export const announceTest = (body: { scope: AnnounceScope; ref: string; language: 'he' | 'en' }) => post<{ id: string; status: string; targets: number }>(`${BASE}/test`, body);
export const announceHistory = (limit = 20) => get<{ history: AnnounceHistoryRow[] }>(`${BASE}/history?limit=${limit}`);
