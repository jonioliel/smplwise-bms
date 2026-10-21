/**
 * STATIONPERM-295 (docs/changes/CR-STATION-PERMISSIONS-295.md): the typed calls of a person's access per station
 * (routers/access_station_permissions.py). The server decides every permission and filters every station; nothing here grants anything.
 */
import { get, post, put } from './client';

export type SpEffect = 'allow' | 'deny' | 'inherit';
export type SpSource = 'group' | 'personal' | 'blocked' | 'none' | 'unknown';
export type SpSyncState = 'none' | 'pending' | 'applied' | 'unverified' | 'failed';

export interface SpRecord {
  effect: SpEffect;
  relays: number[];
  sync_state: SpSyncState;
  decided_at: string | null;
  decided_by_name: string | null;
  proof_at: string | null;
  last_error: string | null;
}

export interface SpRequest {
  effect: 'allow' | 'inherit';
  relays: number[];
  requested_at: string | null;
  requested_by_name: string | null;
  mine: boolean;
}

export interface SpActions {
  allow: boolean;
  deny: boolean;
  inherit: boolean;
  approve: boolean;
  refuse: boolean;
  sync: boolean;
}

export interface SpStation {
  station_id: string;
  name: string | null;
  enabled: boolean | null;
  relays: number[];
  source: SpSource;
  record: SpRecord | null;
  request: SpRequest | null;
  revision: number;
  decides: boolean;
  request_only: boolean;
  actions: SpActions;
}

export interface SpAddable {
  station_id: string;
  name: string | null;
  relays: number[];
  request_only: boolean;
}

export interface SpPerson {
  person_id: string;
  read: 'fresh' | 'unavailable';
  wiskey_revision: number | null;
  timing_mode: string | null;
  grant_live: boolean;
  self: boolean;
  system_admin: boolean;
  stations: SpStation[];
  addable: SpAddable[];
}

export interface SpOutcome {
  outcome: 'decided' | 'requested' | 'refused';
  sync_state?: SpSyncState;
  code?: string | null;
}

const base = (personId: string) => `access-station-permissions/people/${encodeURIComponent(personId)}`;
const one = (personId: string, stationId: string) => `${base(personId)}/stations/${encodeURIComponent(stationId)}`;

export const getStationPermissions = (personId: string) => get<SpPerson>(base(personId));
export const decideStation = (personId: string, stationId: string, effect: SpEffect, revision: number, relays?: number[]) =>
  put<SpOutcome>(one(personId, stationId), { effect, revision, ...(effect === 'allow' ? { relays: relays ?? [1] } : {}) });
export const approveStation = (personId: string, stationId: string, revision: number) => post<SpOutcome>(`${one(personId, stationId)}/approve`, { revision });
export const refuseStation = (personId: string, stationId: string, revision: number) => post<SpOutcome>(`${one(personId, stationId)}/refuse`, { revision });
export const syncStation = (personId: string, stationId: string, revision: number) => post<SpOutcome>(`${one(personId, stationId)}/sync`, { revision });
