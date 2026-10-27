/**
 * BUSTIMES-295: the ONLY module of the application that talks to `/api/v1/transit...` (smplwise_vms/backend/smplwise/routers/transit.py).
 * The TV page (src/notice-tv/) has its own read of the digest and never imports this file. The per-screen choices are part of the board's
 * display settings (`display.transit`) and are saved through `patchBoard` (api/notices.ts).
 */
import { get, post, put } from './client';

export interface TransitStop {
  code: number;
  name: string;
  /** the catalogue's own name / city (absent while the catalogue is empty or does not know the code) */
  catalogue_name?: string | null;
  city?: string;
}

export interface TransitConfig {
  enabled: boolean;
  stops: TransitStop[];
  /** minutes up to this are counted, then the clock time (0 = always the clock) */
  clock_after_min: number;
  /** how long last-known data is shown while the source is down (0 = none) */
  stale_grace_min: number;
  /** walking time: buses closer than this are hidden */
  hide_closer_min: number;
  /** seconds between two polls of the public source, per distinct stop (15-300; below 30 only with `poll_floor_ack`) */
  poll_s: number;
  poll_floor_ack: boolean;
  /** installation default of how often a screen fetches the digest, seconds (10-120) */
  refresh_s: number;
  /** minutes: a vehicle position older than this is no estimate and shows no distance */
  position_fresh_min: number;
  show_distance: boolean;
  /** BUSSTATUS-297: hours of a provider outage after which the system health warns (1-72, default 6) */
  outage_warn_h: number;
}

export interface CatalogueStatus {
  count: number;
  date: string | null;
  ok_at: string | null;
  error: string | null;
  error_at: string | null;
}

export interface TransitHealth {
  enabled: boolean;
  state: 'off' | 'ok' | 'stale' | 'down';
  codes_in_use: number;
  age_s: number | null;
  last_ok_at: string | null;
  errors: number;
  consecutive_errors: number;
  last_error: string | null;
  last_error_at: string | null;
  backoff_until: string | null;
}

export interface TransitLimits {
  max_stops: number;
  windows: number[];
  window_range: [number, number];
  rows_range: [number, number];
  dwell_range: [number, number];
  clock_after_range: [number, number];
  grace_range: [number, number];
  outage_warn_range: [number, number];
  walk_range: [number, number];
  poll_range: [number, number];
  poll_floor_s: number;
  refresh_range: [number, number];
  position_fresh_range: [number, number];
  layouts: string[];
  groups: string[];
}

export interface TransitSettings {
  config: TransitConfig;
  catalogue: CatalogueStatus;
  health: TransitHealth;
  limits: TransitLimits;
  can: { configure: boolean; boards: boolean };
}

export interface CatalogueStop {
  code: number;
  name: string;
  city: string;
  lat: number | null;
  lon: number | null;
}

export type TransitConfigPatch = Partial<Omit<TransitConfig, 'stops'>> & { stops?: { code: number; name: string }[] };

export const transitSettings = () => get<TransitSettings>('transit/settings');
export const putTransitSettings = (body: TransitConfigPatch) => put<TransitSettings>('transit/settings', body);
export const transitCities = () => get<{ cities: string[] }>('transit/cities');
export const searchTransitStops = (city: string, q: string) =>
  get<{ stops: CatalogueStop[]; catalogue: CatalogueStatus }>(`transit/stops?city=${encodeURIComponent(city)}&q=${encodeURIComponent(q)}`);
export const transitStatus = () => get<{ health: TransitHealth; catalogue: CatalogueStatus }>('transit/status');
export const refreshTransitCatalogue = () => post<{ started: boolean; running: boolean }>('transit/catalogue/refresh');
