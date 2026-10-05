import type { StateKind } from '../components/sw-badge';

/** M037: marker clustering for large sites. Pure and deterministic: markers are bucketed in a grid of `cellPx` screen
 * pixels; a bucket with two or more markers becomes a cluster (centroid, count, worst status), a lone marker stays a
 * plain marker. Clustering applies only above `threshold` markers, so a small site renders exactly as before. */
export interface ClusterInput {
  id: string;
  x: number; // normalized 0..1
  y: number;
  state: StateKind;
}

export interface Cluster<T extends ClusterInput = ClusterInput> {
  /** Stable id from the sorted member ids, so a cluster keeps keyboard focus across re-renders. */
  id: string;
  x: number;
  y: number;
  members: T[];
  /** The most severe member status; the cluster pin takes its colour. */
  state: StateKind;
  /** Members per status, for the accessible name. */
  byState: Partial<Record<StateKind, number>>;
}

export interface ClusterResult<T extends ClusterInput = ClusterInput> {
  singles: T[];
  clusters: Cluster<T>[];
}

export interface ClusterOptions {
  /** Plan size in pixels and the current zoom: screen px = normalized * plan * scale. */
  planWidth: number;
  planHeight: number;
  scale: number;
  /** Clustering starts above this many markers (default 60). */
  threshold?: number;
  /** Grid cell in screen pixels (default 56: about two pin diameters). */
  cellPx?: number;
  /** From this zoom on every marker is shown (default 2.5, the zoomToBox cap), so coincident pins always expand. */
  maxScale?: number;
  /** Markers that stay individual whatever the zoom (the selection). */
  keepIds?: Iterable<string>;
}

export const CLUSTER_THRESHOLD = 60;
export const CLUSTER_CELL_PX = 56;
export const CLUSTER_MAX_SCALE = 2.5;

/** Worst first: what an operator must see on a cluster pin. */
const SEVERITY: StateKind[] = ['error', 'offline', 'stale', 'unknown', 'forbidden', 'partial', 'historic', 'recorded', 'live', 'neutral'];
const rank = (s: StateKind) => {
  const i = SEVERITY.indexOf(s);
  return i < 0 ? SEVERITY.length : i;
};

export function worstState(states: StateKind[]): StateKind {
  let best: StateKind = 'neutral';
  let r = SEVERITY.length;
  for (const s of states) {
    if (rank(s) < r) {
      r = rank(s);
      best = s;
    }
  }
  return best;
}

export function clusterMarkers<T extends ClusterInput>(markers: T[], o: ClusterOptions): ClusterResult<T> {
  const threshold = o.threshold ?? CLUSTER_THRESHOLD;
  if (markers.length <= threshold || o.scale >= (o.maxScale ?? CLUSTER_MAX_SCALE)) return { singles: markers, clusters: [] };
  const cell = o.cellPx ?? CLUSTER_CELL_PX;
  const keep = new Set(o.keepIds ?? []);
  const singles: T[] = [];
  const cells = new Map<string, T[]>();
  for (const m of markers) {
    if (keep.has(m.id)) {
      singles.push(m);
      continue;
    }
    const cx = Math.floor((m.x * o.planWidth * o.scale) / cell);
    const cy = Math.floor((m.y * o.planHeight * o.scale) / cell);
    const key = `${cx}:${cy}`;
    const list = cells.get(key);
    if (list) list.push(m);
    else cells.set(key, [m]);
  }
  const clusters: Cluster<T>[] = [];
  for (const list of cells.values()) {
    if (list.length === 1) {
      singles.push(list[0]);
      continue;
    }
    const byState: Partial<Record<StateKind, number>> = {};
    for (const m of list) byState[m.state] = (byState[m.state] ?? 0) + 1;
    const ids = list.map((m) => m.id).sort();
    clusters.push({
      id: `cluster:${ids[0]}+${ids.length}`,
      x: list.reduce((t, m) => t + m.x, 0) / list.length,
      y: list.reduce((t, m) => t + m.y, 0) / list.length,
      members: list,
      state: worstState(list.map((m) => m.state)),
      byState,
    });
  }
  return { singles, clusters };
}

/** Normalized bounding box of a cluster's members, for the expand-on-click zoom. */
export function clusterBox(c: Cluster): { x0: number; y0: number; x1: number; y1: number } {
  return {
    x0: Math.min(...c.members.map((m) => m.x)),
    y0: Math.min(...c.members.map((m) => m.y)),
    x1: Math.max(...c.members.map((m) => m.x)),
    y1: Math.max(...c.members.map((m) => m.y)),
  };
}
