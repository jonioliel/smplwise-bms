/** Export jobs (chapter 27): estimate → durable job → progress → scoped download. */
import { apiUrl, del, get, post } from './client';

export interface ExportFile {
  name: string;
  start_at: string;
  end_at: string;
  size: number | null;
  state: 'pending' | 'downloading' | 'downloaded' | 'remuxed' | 'failed' | 'skipped';
  bytes: number;
  error: string | null;
}

export interface ExportJob {
  id: string;
  camera_id: string;
  camera_name: string;
  owner: string;
  requested_from: string;
  requested_to: string;
  state: 'queued' | 'running' | 'done' | 'partial' | 'failed' | 'cancelled' | 'interrupted';
  progress: number;
  error: string | null;
  created_at: string;
  updated_at: string;
  files: ExportFile[];
  estimate_bytes: number | null;
  timezone: string;
  coverage: string;
  output_name: string | null;
  media_type: string;
  container: 'mp4' | 'hikvision-ps' | 'zip' | 'unknown';
  actual_from: string | null;
  actual_to: string | null;
  remux: 'pending' | 'done' | 'unavailable' | 'failed' | 'skipped';
  sha256: string | null;
  bytes_done: number;
  note: string;
  download_ready: boolean;
}

export interface ExportEstimate {
  files: number;
  estimate_bytes: number | null;
  coverage: string;
  first_file_at: string | null;
  last_file_end_at: string | null;
  note: string;
  ffmpeg: boolean;
  max_bytes: number;
}

const body = (cameraId: string, fromAt: string, toAt: string) => ({ camera_id: cameraId, from_at: fromAt, to_at: toAt });

export const estimateExport = (cameraId: string, fromAt: string, toAt: string) => post<ExportEstimate>('exports/estimate', body(cameraId, fromAt, toAt));
export const createExport = (cameraId: string, fromAt: string, toAt: string) => post<ExportJob>('exports', body(cameraId, fromAt, toAt));
export const listExports = () => get<{ jobs: ExportJob[]; ffmpeg: boolean }>('exports');
export const getExport = (id: string) => get<ExportJob>(`exports/${id}`);
export const cancelExport = (id: string) => post<ExportJob>(`exports/${id}/cancel`);
export const deleteExport = (id: string) => del(`exports/${id}`);
export const exportDownloadUrl = (id: string) => apiUrl(`exports/${id}/download`);
export const exportManifestUrl = (id: string) => apiUrl(`exports/${id}/manifest`);

export function formatBytes(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
