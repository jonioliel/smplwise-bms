/**
 * WISKEY-RELAYMAP-2310: the WisKey relay map (Settings › הגדרת מערכת › WisKey, "מיפוי ממסרים"). Per station: which WisKey api relay
 * drives which physical relay (door). Saving is an explicit approval guarded by the station revision; nothing is sent to a device.
 */
import { get, put } from './client';

export interface RelayMapRow {
  api_relay: number;
  /** the physical relay this api relay drives now; null: disabled or never mapped */
  physical_relay: number | null;
  active: boolean;
  row_revision: number | null;
  updated_at: string | null;
}

export interface RelayMapStation {
  id: string;
  name: string;
  /** false: the station has map rows but is not in the served WisKey copy (shown read-only) */
  in_copy: boolean;
  online: boolean;
  relays: { physical_index: number; name: string | null }[];
  revision: number;
  approved_by: string | null;
  approved_at: string | null;
  rows: RelayMapRow[];
  /** physical relays a door automation names */
  automated_relays: number[];
}

export interface RelayMap {
  state: string;
  has_copy: boolean;
  can_edit: boolean;
  confirm_word: string;
  stations: RelayMapStation[];
}

export const getRelayMap = () => get<RelayMap>('wiskey/relay-map');
export const approveRelayMap = (stationId: string, expectedRevision: number, rows: { api_relay: number; physical_relay: number | null }[], confirmText?: string) =>
  put<{ revision: number; station: RelayMapStation }>(`wiskey/relay-map/${encodeURIComponent(stationId)}`, {
    expected_revision: expectedRevision,
    rows,
    confirmed: true,
    ...(confirmText ? { confirm_text: confirmText } : {}),
  });
