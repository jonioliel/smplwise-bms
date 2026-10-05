/** CR-026: recorder health cards (GET /recorder-health) and their thresholds (GET/PUT /recorder-health/settings, system.configure). */
import { get, post, put } from './client';
import type { FrigateHealth } from './frigate';

export type HealthState = 'ok' | 'warn' | 'error' | 'unknown' | 'off';

export interface Section {
  state: HealthState;
  [k: string]: unknown;
}

export interface RecorderHealthCard {
  id: string;
  name: string;
  vendor?: string;
  status: HealthState;
  checked_at: string | null;
  detail_supported: boolean;
  model?: string | null;
  api: Section & { latency_ms?: number | null; text?: string };
  disks: (Section & { items?: { ref: string; state: string; text: string; total_mb: number | null; free_mb: number | null }[]; free_pct?: number | null; full?: boolean; fill_days?: number | null; alarms?: string[] }) | null;
  recording: (Section & { recording?: number; watched?: number; continuous?: boolean; expected?: number; stopped?: { channel: number; name: string }[]; exception?: { channel: number; name: string }[] }) | null;
  channels: (Section & { total?: number; connected?: number; disconnected?: { channel: number; name: string }[] }) | null;
  clock: (Section & { drift_s?: number }) | null;
  certificate: (Section & { days_left?: number | null }) | null;
  /** NN5-F1B: a Frigate recorder's own rows (detectors, per-camera fps and status, hours of recording left, partial coverage). */
  frigate?: FrigateHealth | null;
}

export interface RecorderHealthList {
  recorders: RecorderHealthCard[];
  interval_s: number;
  can_manage: boolean;
}

export interface HealthThresholds {
  interval_s: number;
  latency_ms: number;
  recording_gap_min: number;
  clock_drift_s: number;
  disk_fill_days: number;
  cert_days: number;
  recover_s: number;
  continuous_recorders: string[];
  /** NN6B: a camera's own choice over its recorder's ("continuous" | "events"); a camera without an entry follows its recorder. */
  camera_recording: Record<string, CameraRecordingMode>;
}

export type CameraRecordingMode = 'continuous' | 'events';

export interface CameraChoice {
  id: string;
  name: string;
  recorder_id: string;
  channel: number;
}

export interface ThresholdsAnswer {
  values: HealthThresholds;
  ranges: Record<string, { default: number; min: number; max: number }>;
  cameras?: CameraChoice[];
}

export const recorderHealth = () => get<RecorderHealthList>('recorder-health');
export const checkRecorderHealth = () => post<{ checked: boolean; recorders: RecorderHealthCard[] }>('recorder-health/check');
export const healthThresholds = () => get<ThresholdsAnswer>('recorder-health/settings');
export const saveHealthThresholds = (body: Partial<HealthThresholds>) => put<ThresholdsAnswer>('recorder-health/settings', body);
