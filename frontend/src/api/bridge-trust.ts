/**
 * CR-040 (WXROT): Settings › בקרת כניסה › "מפתח הגשר" - the rotation of the bridge's trust key in ONE atomic switch the bridge owns.
 * Backend routers/bridge_trust.py: `GET /ha/bridge/trust`, `POST /ha/bridge/trust/rotations` `{confirmed: true}` and
 * `POST /ha/bridge/trust/rotations/{request_id}/check`. `access.trust.rotate` at installation scope, an interactive session, the local
 * channel only (the remote channel answers 404). Nothing here ever carries a key, a salt, a proof, a nonce or a signature.
 */
import { get, post } from './client';

export type RotationState = 'dispatching' | 'unknown' | 'rotated' | 'not_rotated' | 'superseded';
export type Blocked = 'ha_not_configured' | 'not_paired' | 'unsupported' | 'in_progress';

export interface RotationRow {
  request_id: string;
  /** The person who asked (their name at the time, else their id). */
  initiator: string;
  epoch_from: number;
  epoch_to: number;
  state: RotationState;
  /** Closed set: rotated, status_applied, not_sent, bridge_outdated, ha_forbidden, refused:<stage>/<code>, fenced, reverted_on_bridge,
   * transport, bridge_error, invalid_response, interrupted, status_unreachable, status_transport, status_refused:..., neither_key,
   * inconsistent, repaired. */
  code: string | null;
  requested_at: string;
  resolved_at: string | null;
  status_checks: number;
}

export interface TrustView {
  epoch: number;
  bridge: {
    paired: boolean;
    version: string | null;
    required: string;
    supported: boolean;
    /** The epoch the bridge reported in its last verified push, and when. */
    epoch_seen: number | null;
    seen_at: string | null;
  };
  open: RotationRow | null;
  history: RotationRow[];
  can_rotate: boolean;
  blocked: Blocked | null;
}

export interface RotationResult {
  request_id: string;
  state: 'rotated' | 'not_rotated' | 'unknown' | 'superseded';
  code: string | null;
  epoch_from: number;
  epoch_to: number;
  /** The server's Hebrew sentence for the outcome. */
  message: string;
  trust: TrustView;
}

export const getTrust = () => get<TrustView>('ha/bridge/trust');
export const rotateTrustKey = () => post<RotationResult>('ha/bridge/trust/rotations', { confirmed: true });
export const checkRotation = (requestId: string) => post<RotationResult>(`ha/bridge/trust/rotations/${encodeURIComponent(requestId)}/check`);
