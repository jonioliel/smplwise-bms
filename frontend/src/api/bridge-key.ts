/**
 * CR-WISKEY-HMAC-ROTATION-295: the bridge HMAC key and its rotation (Settings › Connections, system administrator only, local
 * sessions only). No answer ever carries a key: key ids, generations, states and times only. Active since HMACACT-295: the switch is on
 * by default and the rotation starts by itself once the bridge has been updated (`automatic`).
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
  /** waiting_for_bridge | scheduled | idle | off - the automatic rotation (starts by itself once the bridge announces support). */
  automatic: 'waiting_for_bridge' | 'awaiting_click' | 'scheduled' | 'idle' | 'off';
  /** F3B K-01: the server's own answer (HMACACT2-295 `door_commands_paused`); absent on a server that does not send it. */
  door_commands_paused?: boolean;
  /** WXH-LEFTOVERS-2405 (CR-034 section 7): who is "the owner" for the bridge-key notices; absent on an older server. */
  owner_contacts?: OwnerContacts;
  /** WXH-LEFTOVERS-2405: the Settings banner (an open bridge-key notice while no owner contact is set). */
  notice_banner?: NoticeBanner;
  /** WXH-LEFTOVERS-2405: the conditions the watchdog reports now (codes and times only). */
  watchdog?: WatchdogCondition[];
  /** WXH-LEFTOVERS-2405 (CR-034 section 2 item 3): the key status the bridge is handed (generations and outcomes, never a key). */
  hand_over?: HandOver;
}

export interface OwnerContacts {
  ids: string[];
  users: { id: string; name: string; valid: boolean }[];
  candidates: { id: string; name: string }[];
  set: boolean;
  max: number;
  recipients: number;
}

export interface NoticeBanner {
  show: boolean;
  open: number;
  contacts_set: boolean;
}

export type WatchdogCode = 'overlap_overdue' | 'needs_repair' | 'verify_failed' | 'generation_mismatch';

export interface WatchdogCondition {
  code: WatchdogCode;
  rotation_id?: string;
  since?: string;
  arx_generation?: number;
  bridge_generation?: number;
}

export interface HandOver {
  key_generation: number | null;
  last_rotation: { rotation_id: string; mode: RotationMode; state: RotationState; verified_old_rejected: boolean; anchor_eligible: boolean; completed_at: string | null } | null;
  anchor_decrease_available: boolean;
  bridge_generation: number | null;
}

export const ACTIVE_STATES: readonly RotationState[] = ['prepared', 'publishing', 'published', 'confirmed', 'switching', 'switched', 'retiring'];

export const getBridgeKey = () => get<BridgeKeyStatus>('system/bridge-key');
export const setBridgeKeySettings = (body: { enabled?: boolean; reminder_days?: number }) => put<BridgeKeyStatus>('system/bridge-key/settings', body);
export const startRotation = (mode: RotationMode) => post<{ rotation: Rotation }>('system/bridge-key/rotations', { mode, confirm: true });
export const setOwnerContacts = (userIds: string[]) => put<BridgeKeyStatus>('system/bridge-key/owner-contacts', { user_ids: userIds });
export const getNoticeBanner = () => get<NoticeBanner>('system/bridge-key/notice');
export const resumeRotation = (id: string) => post<{ rotation: Rotation }>(`system/bridge-key/rotations/${encodeURIComponent(id)}/resume`);

/**
 * F3B K-01: are remote door commands paused by the key rotation? The server's `door_commands_paused` wins when it sends one; otherwise the
 * same rule it applies: the switch is on and a rotation is running or the latest one waits for repair.
 */
export function doorsPaused(s: Pick<BridgeKeyStatus, 'enabled' | 'rotation' | 'last' | 'door_commands_paused'>): boolean {
  if (typeof s.door_commands_paused === 'boolean') return s.door_commands_paused;
  if (!s.enabled) return false;
  if (s.rotation && ACTIVE_STATES.includes(s.rotation.state)) return true;
  return s.last?.state === 'needs_repair';
}
