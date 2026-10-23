/**
 * CR-TIMESCRUB101 slice 1: the floor's recorded state per layer at one instant (snapshot) and over a window (range), for the
 * historical map's time scrub. Every layer block is independent and says what IS recorded: `status` per layer, the layer's
 * retention and first recorded instant, and for the HA layers a state per entity that is `known` only when the local
 * history knows it (never the last live value). A layer the viewer may not see comes back `not_permitted` with no ids.
 *
 * The routes answer 404 `feature_off` while the setting `history.timescrub` is off: `isFeatureOff` tells the screen to fall
 * back to the classic historical map.
 */
import { ApiError, get } from './client';
import type { EntityLayerId, RangeLayerId } from '../map/history-replay';

export type LayerStatus = 'ok' | 'empty' | 'not_recorded' | 'not_permitted' | 'gap';
export interface HistoryGap {
  from: string;
  to: string;
  /** 'disconnected' (Arx was not connected to the system infrastructure). */
  reason: string;
}
export interface HistoryCoverage {
  /** The first instant of the local history (null = none yet). */
  from: string | null;
  to: string | null;
  gaps: HistoryGap[];
  /** A recorded state is carried forward at most this long when no later change is known. */
  forward_fill_max_s: number;
}


export interface SnapshotEntityState {
  state: string | null;
  changed_at: string | null;
  known: boolean;
  reason: string | null;
}
export interface SnapshotEntityLayer {
  status: LayerStatus;
  retention_days: number | null;
  from: string | null;
  /** {} when not_permitted (no ids at all) or empty. */
  entities: Record<string, SnapshotEntityState>;
}
export interface SnapshotElevatorItem {
  name: string;
  state: string | null;
  at: string | null;
  known: boolean;
}
export interface SnapshotElevatorLayer {
  status: LayerStatus;
  retention_days: number | null;
  from: string | null;
  /** The cab's position is never recorded (CR section 2). */
  position: 'not_recorded';
  items: Record<string, SnapshotElevatorItem>;
}
export interface SnapshotCameraLayer {
  status: 'ok' | 'not_permitted' | 'empty';
  camera_ids: string[];
}
export interface SnapshotEventLayer {
  status: 'ok' | 'not_permitted' | 'empty';
  /** null when not_permitted. */
  retention_days: number | null;
}
export interface HistorySnapshot {
  at: string;
  floor_id: string;
  settings: { range_max_days: number; presence_retention_days: number };
  coverage: HistoryCoverage;
  layers: Record<EntityLayerId, SnapshotEntityLayer> & {
    elevators: SnapshotElevatorLayer;
    cameras: SnapshotCameraLayer;
    events: SnapshotEventLayer;
  };
}

/** One change-point: [t (UTC ISO), state, n changes (1 when exact; the changes inside the bucket when bucketed)]. */
export type RangePoint = [string, string | null, number];
export interface RangeSeries {
  /** The state at `from` (before the first point). */
  initial: { state: string | null; known: boolean };
  points: RangePoint[];
  /** A recorded change after `to` exists (the last point's state is bounded on the right). */
  bounded_after: boolean;
}
export interface RangeEntityLayer {
  status: LayerStatus;
  retention_days: number | null;
  from: string | null;
  entities: Record<string, RangeSeries>;
}
export interface RangeElevatorLayer {
  status: LayerStatus;
  retention_days: number | null;
  from: string | null;
  position: 'not_recorded';
  items: Record<string, RangeSeries & { name: string }>;
}
export interface HistoryRange {
  from: string;
  to: string;
  floor_id: string;
  /** null = exact change-points; a number = bucketed (each point is the LAST state of its bucket, n = changes in it). */
  bucket_s: number | null;
  coverage: HistoryCoverage;
  layers: Partial<Record<EntityLayerId, RangeEntityLayer>> & { elevators?: RangeElevatorLayer };
}

/** UTC ISO without milliseconds (the form the routes and the existing map bundle use). */
export function isoZ(d: Date | number): string {
  return new Date(d).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** The error code of an API error; the time-scrub routes may wrap it as `{error: {code}}` as well as the house `{code}`. */
export function apiErrorCode(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  const b = err.body as unknown as { code?: unknown; error?: { code?: unknown } } | null;
  if (b && typeof b.code === 'string') return b.code;
  if (b && b.error && typeof b.error.code === 'string') return b.error.code;
  return null;
}

/** The routes are off (setting `history.timescrub` false): a 404 (with or without the `feature_off` code). */
export function isFeatureOff(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}

export function loadSnapshot(floorId: string, at: string): Promise<HistorySnapshot> {
  return get<HistorySnapshot>(`floors/${encodeURIComponent(floorId)}/history/snapshot?at=${encodeURIComponent(at)}`);
}

export function loadRange(floorId: string, from: string, to: string, layers?: readonly RangeLayerId[]): Promise<HistoryRange> {
  const q = new URLSearchParams({ from, to });
  if (layers && layers.length) q.set('layers', layers.join(','));
  return get<HistoryRange>(`floors/${encodeURIComponent(floorId)}/history/range?${q.toString()}`);
}
