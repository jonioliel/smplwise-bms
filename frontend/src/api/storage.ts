/** NVR storage and recording plan, read-only (T051). */
import { get, post } from './client';

export interface StorageDisk {
  id: string;
  name: string;
  kind: string;
  status: string;
  capacity_mb: number;
  free_mb: number;
  used_mb: number;
  property: string;
  path: string;
}

export interface StorageCamera {
  camera_id: string;
  name: string;
  channel: number;
  track_id: number | null;
  has_schedule: boolean;
  enable_flag: boolean | null;
  default_mode: string | null;
  modes: string[];
  summary: string;
  pre_s: number | null;
  post_s: number | null;
  expiry: string | null;
  save_audio: boolean | null;
  bitrate_kbps: number | null;
  resolution: string | null;
  fps: number | null;
  oldest_recording_at: string | null;
  retention_days: number | null;
  retention_reason: string;
}

export interface StorageReport {
  generated_at: string;
  cached: boolean;
  nvr: { configured: boolean; reachable: boolean; error: string | null };
  disks: StorageDisk[];
  nas: StorageDisk[];
  totals: { capacity_mb: number; free_mb: number; used_mb: number; used_pct: number | null; disks: number; nas: number; disks_ok: number } | null;
  work_mode: string | null;
  schedule_error: string | null;
  cameras: StorageCamera[];
  retention: {
    measured_days_min: number | null;
    measured_days_max: number | null;
    measured_reason: string;
    estimated_days: number | null;
    estimated_reason: string;
    bitrate_total_kbps: number;
    lookback_days: number;
  };
  limits: { writes: boolean; notes: string[] };
}

export const getStorage = (fresh = false) => get<StorageReport>(`storage${fresh ? '?fresh=true' : ''}`);

/** The add-on's own data disk and the bounded queues (T068): no device call. */
export interface StorageLocal {
  data_disk: { free_mb: number | null; total_mb: number | null; min_free_mb: number; low: boolean };
  exports: {
    by_state: Record<string, number>;
    paused_disk_full: number;
    waiting: number;
    max_waiting: number;
    max_per_owner: number;
    counters: { refused_disk: number; refused_queue_full: number; paused_disk_full: number; resumed: number };
  };
  ingest_queue: { depth: number; max: number; high_water: number; accepted: number; processed: number; failed: number; coalesced: number; dropped: number };
}

export const getStorageLocal = () => get<StorageLocal>('storage/local');
export const resumeExports = () => post<StorageLocal & { resumed: number }>('storage/exports/resume');

export function fmtMb(mb: number | null | undefined): string {
  if (mb == null) return '—';
  if (mb >= 1024 * 1024) return `${(mb / 1024 / 1024).toFixed(2)} TB`;
  if (mb >= 1024) return `${(mb / 1024).toFixed(0)} GB`;
  return `${mb} MB`;
}
