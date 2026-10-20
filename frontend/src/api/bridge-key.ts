/**
 * CR-WISKEY-HMAC-ROTATION-295: the bridge HMAC key and its rotation (Settings › Connections, system administrator only, local
 * sessions only). No answer ever carries a key: key ids, generations, states and times only. The switch stays off in this
 * build (`go_live_permitted` false; turning it on is refused with 409 `rotation_not_permitted`).
 */
import { get, post, put } from './client';

export type RotationMode = 'routine' | 'hard_cut';
export type RotationState =
  | 'prepared' | 'publishing' | 'published' | 'confirmed' | 'switching' | 'switched' | 'retiring'
  | 'retired' | 'verified' | 'verify_failed' | 'rolled_back' | 'needs_repair';

export interface BridgeKeyInfo {
  kid: string;
  generation: number;
  state: string;
  created_at: string | null;
  activated_at: string | null;
  verify_until: string | null;
  ended_at: string | null;
  readable?: boolean;
}

export interface Rotation {
  id: string;
  mode: RotationMode;
  state: RotationState;
  kid_from: string;
  kid_to: string;
  gen_from: number;
  gen_to: number;
  started_at: string;
  switched_at: string | null;
  ended_at: string | null;
  result_code: string | null;
  anchor_eligible: boolean;
  retire_at?: string | null;
}

export interface BridgeKeyStatus {
  enabled: boolean;
  go_live_permitted: boolean;
  peer_available: boolean;
  adopted: boolean;
  key: BridgeKeyInfo | null;
  keys: BridgeKeyInfo[];
  rotation: Rotation | null;
  last: Rotation | null;
  history: Rotation[];
  reminder_days: number;
  reminder_values: number[];
  reminder_due: boolean;
  can_start: boolean;
  blocked_by: string | null;
}

export const ACTIVE_STATES: readonly RotationState[] = ['prepared', 'publishing', 'published', 'confirmed', 'switching', 'switched', 'retiring'];

export const getBridgeKey = () => get<BridgeKeyStatus>('system/bridge-key');
export const setBridgeKeySettings = (body: { enabled?: boolean; reminder_days?: number }) => put<BridgeKeyStatus>('system/bridge-key/settings', body);
export const startRotation = (mode: RotationMode) => post<{ rotation: Rotation }>('system/bridge-key/rotations', { mode, confirm: true });
export const resumeRotation = (id: string) => post<{ rotation: Rotation }>(`system/bridge-key/rotations/${encodeURIComponent(id)}/resume`);
