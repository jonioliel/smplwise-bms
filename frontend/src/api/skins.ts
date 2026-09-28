/** AI-rendered floor skins (CR-006 phase 2, slice 2a): the settings section's status and connection test, and the
 * floor's control images. The API key never reaches the browser - only whether it is configured. */
import { get, post, upload } from './client';
import type { ControlState } from '../map/skin-control';
import { dataUrlBytes } from '../map/skin-control';

export interface SkinsBudget {
  monthly_cap: number;
  used_month: number;
  remaining_month: number;
  per_floor_cap: number;
  used_floor: number | null;
  remaining_floor: number | null;
}
export interface SkinsStatus {
  provider: string;
  model: string;
  key_configured: boolean;
  privacy_ack: boolean;
  leaves: string[];
  never_leaves: string[];
  capabilities: Record<string, unknown>;
  estimate: { cost_estimate_usd: number; basis: string; size: string; quality: string };
  budget: SkinsBudget;
  last_test: { created_at: string; status: string; http_status: number | null; error_code: string | null; model: string } | null;
  api: { endpoint: string; shape_verified: boolean; prices_verified: boolean };
}
export interface SkinsTestResult {
  ok: boolean;
  render_id: string | null;
  provider: string;
  model: string;
  http_status: number;
  message: string | null;
  code?: string;
  provider_code?: string | null;
  image: string | null;
  image_bytes: number;
  cost_estimate_usd: number | null;
  request_id: string | null;
  budget: SkinsBudget;
}
export interface SkinControl {
  id: string;
  floor_id: string;
  state: ControlState;
  geometry_key: string;
  sha256: string;
  bytes: number;
  width: number;
  height: number;
  created_at: string;
  current?: boolean;
  identical?: boolean;
}
export interface FloorSkins {
  floor_id: string;
  geometry_key: string | null;
  doc_hash: string | null;
  states: ControlState[];
  size: [number, number];
  controls: SkinControl[];
  budget: SkinsBudget;
}

export const getSkinsStatus = () => get<SkinsStatus>('skins/status');
export const runSkinsTest = () => post<SkinsTestResult>('skins/test');
export const getFloorSkins = (floorId: string) => get<FloorSkins>(`floors/${floorId}/skins`);

export function uploadControlImage(floorId: string, state: ControlState, geometryKey: string, pngDataUrl: string): Promise<SkinControl> {
  const form = new FormData();
  form.set('state', state);
  form.set('geometry_key', geometryKey);
  form.set('file', new Blob([dataUrlBytes(pngDataUrl)], { type: 'image/png' }), `control-${state}.png`);
  return upload<SkinControl>(`floors/${floorId}/skins/control-image`, form);
}
