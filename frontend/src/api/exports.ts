/** Export jobs (chapter 27): estimate → durable job → progress → scoped download. */
import { apiUrl, del, get, post } from './client';
import { formatByteSize } from '../format/bytes';

interface ExportFile {
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
  /** paused_disk_full (T068): the add-on's data disk fell under storage.min_free_mb mid-job; resumes by itself when there is room. */
  state: 'queued' | 'running' | 'done' | 'partial' | 'failed' | 'cancelled' | 'interrupted' | 'paused_disk_full';
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
// CR-FE-DEAD-CODE-2442 (O15 a): no caller yet - kept; built ahead by T048 (export jobs).
export const getExport = (id: string) => get<ExportJob>(`exports/${id}`);
export const cancelExport = (id: string) => post<ExportJob>(`exports/${id}/cancel`);
export const deleteExport = (id: string) => del(`exports/${id}`);
export const exportDownloadUrl = (id: string) => apiUrl(`exports/${id}/download`);
export const exportManifestUrl = (id: string) => apiUrl(`exports/${id}/manifest`);

/** "313 KB" / "12.4 MB" / "1.25 GB"; an em dash when the size is not known. CR-FORMAT-2440: the arithmetic is format/bytes.ts. */
export function formatBytes(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return formatByteSize(n, { gb: true });
}
