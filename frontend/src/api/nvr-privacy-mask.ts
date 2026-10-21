/**
 * MASKUI-295: the privacy-mask routes of the NVR (backend NVRMASK-295, routers/nvr_privacy.py).
 *
 * - `readMask`   GET  cameras/{id}/privacy-mask     the mask as the NVR holds it, its etag, limits, `can_write`, `write_enabled`
 * - `previewMasks` POST nvr/privacy-masks/preview   before -> after per camera with the etag the apply must carry; writes nothing
 * - `applyMasks` POST nvr/privacy-masks/apply       ONLY from the confirm button: `confirm: true` + the preview's etag per camera
 * - `undoChange` POST nvr/changes/{id}/rollback     the change log's undo
 *
 * Nothing here queues, retries or saves on its own: every function sends one request when it is called, and a failed call
 * rejects with the ApiError (the screen shows the line; it never calls the write again by itself).
 * No device address, user name, password, serial or MAC is part of these types.
 */
import { get, post } from './client';

export type Point = [number, number];

export interface MaskRegion {
  id: string;
  /** The parser's verdict: the region masks the picture (only the master switch counts on the lab device). */
  active?: boolean;
  points: number[][];
}

export interface MaskView {
  camera_id: string;
  channel: number;
  name: string;
  enabled: boolean;
  normalized: { width: number; height: number };
  active_regions: number;
  regions: MaskRegion[];
  etag: string;
  max_regions: number;
  points_per_region: number;
  can_write: boolean;
  write_enabled: boolean;
}

export interface MaskItem {
  camera_id: string;
  enabled: boolean;
  regions: { points: number[][] }[];
  etag?: string | null;
}

export type PreviewStatus = 'ready' | 'unchanged' | 'invalid' | 'skipped';

export interface MaskState {
  enabled: boolean;
  regions: { id?: string; points: number[][] }[];
}

export interface PreviewRow {
  camera_id: string;
  channel: number;
  name: string;
  status: PreviewStatus;
  etag?: string;
  max_regions?: number;
  before?: MaskState & { normalized?: { width: number; height: number } };
  after?: MaskState;
  reason?: string;
  message?: string;
}

export interface PreviewResult {
  items: PreviewRow[];
  ready: number;
  unchanged: number;
  invalid: number;
  skipped: number;
}

export type ApplyStatus = 'applied' | 'unchanged' | 'skipped' | 'failed' | 'not_attempted' | string;

export interface ApplyRow {
  camera_id: string;
  channel: number;
  status: ApplyStatus;
  change_id?: string | null;
  reason?: string;
  message?: string;
  restored?: boolean | null;
}

export interface ApplyResult {
  results: ApplyRow[];
  applied: number;
  unchanged: number;
  skipped: number;
  failed: number;
  not_attempted: number;
}

/** One row of the change log (GET nvr/changes?camera_id=); documents are never part of a row. */
export interface MaskChange {
  id: string;
  kind: string;
  status: string;
  camera_id: string | null;
  created_at: string;
  rollback_of?: string | null;
}

const enc = encodeURIComponent;

export interface PrivacyMaskAdapter {
  readMask(cameraId: string): Promise<MaskView>;
  previewMasks(items: MaskItem[]): Promise<PreviewResult>;
  applyMasks(items: MaskItem[]): Promise<ApplyResult>;
  changes(cameraId: string, limit?: number): Promise<{ changes: MaskChange[] }>;
  undoChange(changeId: string): Promise<MaskChange>;
}

export const privacyMaskApi: PrivacyMaskAdapter = {
  readMask: (cameraId) => get(`cameras/${enc(cameraId)}/privacy-mask`),
  previewMasks: (items) => post('nvr/privacy-masks/preview', { items }),
  applyMasks: (items) => post('nvr/privacy-masks/apply', { items, confirm: true }),
  changes: (cameraId, limit = 20) => get(`nvr/changes?camera_id=${enc(cameraId)}&limit=${limit}`),
  undoChange: (changeId) => post(`nvr/changes/${enc(changeId)}/rollback`, { confirm: true }),
};
