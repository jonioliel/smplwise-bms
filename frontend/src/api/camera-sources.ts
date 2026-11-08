/**
 * CAMERA-STREAM-SOURCES-2410: a camera's video source (the recorder, or its own RTSP addresses) and the cameras without a recorder
 * (routers/camera_sources.py). Every call needs `system.configure`. No answer ever carries a password: an address comes back masked
 * (`rtsp://user:***@host/path`) with `has_password`; sending the masked address back keeps the stored secret (same host only).
 */
import { del, get, post, put } from './client';
import type { Camera } from './types';

export interface SourceSide {
  /** The address with its password masked. */
  url: string;
  has_password: boolean;
}

export interface SourceProbe {
  codec: string | null;
  width: number | null;
  height: number | null;
  at: string | null;
}

export interface SourceHealth {
  state: 'ok' | 'failing' | 'unknown';
  code: string | null;
  checked_at: string | null;
  ok_at: string | null;
  since: string | null;
}

export interface CameraSource {
  camera_id: string;
  mode: 'nvr' | 'manual';
  standalone: boolean;
  main: SourceSide | null;
  sub: SourceSide | null;
  area_id: string | null;
  revision: number;
  updated_at: string | null;
  probe: Partial<Record<'main' | 'sub', SourceProbe>>;
  health: SourceHealth | null;
  capabilities: { live: boolean; snapshot: boolean; recording: boolean; playback: boolean; events: boolean; reboot: boolean };
}

export interface SourceSave {
  mode: 'nvr' | 'manual';
  main_url?: string | null;
  sub_url?: string | null;
  area_id?: string | null;
  if_revision?: number;
}

export type StreamTest =
  | { ok: true; width: number; height: number; codec: string | null; codec_label: string | null; preview: string }
  | { ok: false; code: string; message: string };

export interface StandaloneIn {
  name: string;
  area_id?: string | null;
  main_url?: string | null;
  sub_url?: string | null;
}

const cam = (id: string) => `cameras/${encodeURIComponent(id)}`;

export const getCameraSource = (cameraId: string) => get<CameraSource>(`${cam(cameraId)}/source`);
export const saveCameraSource = (cameraId: string, body: SourceSave) => put<CameraSource>(`${cam(cameraId)}/source`, body);
export const testStream = (body: { url?: string | null; camera_id?: string | null; profile: 'main' | 'sub' }) => post<StreamTest>('cameras/source/test', body);
export const addStandaloneCamera = (body: StandaloneIn) => post<Camera & { standalone: true; area_id: string | null }>('cameras/standalone', body);
export const removeStandaloneCamera = (cameraId: string) => del(`cameras/standalone/${encodeURIComponent(cameraId)}`);
