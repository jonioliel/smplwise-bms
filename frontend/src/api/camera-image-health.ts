/** CAMHEALTH091: camera image health - GET /camera-image-health (results), POST /camera-image-health/check, GET/PUT
 * /camera-image-health/settings (system.configure), POST /camera-image-health/{id}/reference. Names, states and numbers only. */
import { get, post, put } from './client';

export type ImageKind = 'dark' | 'blurred' | 'frozen' | 'shifted';
export type ImageState = 'ok' | 'warn' | 'unknown' | 'excluded' | 'off';
export const IMAGE_KINDS: ImageKind[] = ['dark', 'blurred', 'frozen', 'shifted'];

export interface ImageCamera {
  id: string;
  name: string;
  state: ImageState;
  issues: ImageKind[];
  texts: string[];
  sampled_at: string | null;
  attempted_at: string | null;
  source: 'cache' | 'stream' | null;
  error: string | null;
  error_text: string | null;
  metrics: { brightness?: number; sharpness?: number; diff?: number | null; shift_pct?: number | null; corr?: number | null };
  reference: { set_at: string; auto: boolean } | null;
}

export interface ImageHealth {
  enabled: boolean;
  interval_s: number;
  checked_at: string | null;
  counts: Record<ImageState | ImageKind, number>;
  cameras: ImageCamera[];
  can_manage: boolean;
}

export interface ImageHealthSettings {
  enabled: boolean;
  passive_only: boolean;
  check_dark: boolean;
  check_blur: boolean;
  check_freeze: boolean;
  check_shift: boolean;
  interval_s: number;
  per_pass_max: number;
  dark_level: number;
  blur_min: number;
  freeze_diff: number;
  freeze_samples: number;
  shift_pct: number;
  shift_corr_min: number;
  confirm_samples: number;
  recover_s: number;
  excluded: string[];
}

export interface ImageHealthSettingsAnswer {
  values: ImageHealthSettings;
  ranges: Record<string, { default: number; min: number; max: number }>;
  cameras: { id: string; name: string; recorder_id: string }[];
  /** The notification source whose policy holds the recipients and channels (PUT /notify/policies/{source}). */
  source: string;
}

export const cameraImageHealth = () => get<ImageHealth>('camera-image-health');
export const checkCameraImages = () => post<ImageHealth & { checked: boolean }>('camera-image-health/check');
export const cameraImageSettings = () => get<ImageHealthSettingsAnswer>('camera-image-health/settings');
export const saveCameraImageSettings = (body: Partial<ImageHealthSettings>) => put<ImageHealthSettingsAnswer>('camera-image-health/settings', body);
export const setCameraReference = (id: string, action: 'set' | 'clear') => post<ImageHealth>(`camera-image-health/${encodeURIComponent(id)}/reference`, { action });
