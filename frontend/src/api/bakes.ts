/**
 * Plan Studio 6 bakes (CR-029 S3; backend routers/plan_bakes.py, services/plan_bakes.py): the stills, room masks and
 * lightmaps of a floor - list (map.read), upload / regenerate / claim / finish / delete (map.edit, audited), and the
 * installation's `plan.bakes` setting (PATCH /settings, system.configure). The add-on never renders: an editor's browser
 * draws the files (still-render-scene.ts, lightmap-bake.ts) and uploads them here (bake-runner.ts).
 */
import { ApiError, del, get, post, resourceUrl, upload } from './client';
import type { BakeKind, BakeSetting, BakeSlot, BundleBakes } from '../map/still-bake';

export interface BakeRow extends BakeSlot {
  id: string;
  slot: string;
  bake_key: string;
  recipe: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  sha256: string;
  meta: Record<string, unknown>;
  created_at: string;
  stale: boolean;
  url: string;
  identical?: boolean;
  evicted?: string[];
}
export interface BakeJob {
  id: string;
  status: 'requested' | 'claimed' | 'done' | 'failed' | 'cancelled';
  bake_key: string;
  scope: { levels: string[]; presets: string[]; styles: string[]; bands: string[]; lightmap: boolean };
  requested_by: string | null;
  requested_at: string;
  claimed_by: string | null;
  claimed_at: string | null;
  lease_until: string | null;
  finished_at: string | null;
  error: string | null;
}
export interface FloorBakes {
  floor_id: string;
  bake_key: string | null;
  geometry_key: string | null;
  /** The published structure's doc_hash: a map showing a draft (another hash) must not bake. */
  doc_hash: string | null;
  levels: string[];
  setting: BakeSetting;
  size: [number, number];
  bakes: BakeRow[];
  expected: string[];
  missing: string[];
  complete: boolean;
  stale_count: number;
  usage: { floor_bytes: number; total_bytes: number; floor_cap_bytes: number; total_cap_bytes: number };
  job: BakeJob | null;
}

export const floorBakes = (floorId: string) => get<FloorBakes>(`floors/${encodeURIComponent(floorId)}/bakes`);

export interface UploadBakeInput {
  slot: BakeSlot;
  bakeKey: string;
  recipe: string;
  meta?: Record<string, unknown>;
  file: Blob;
  name?: string;
}
/** One file into its slot. A 503 `bake_busy` (the add-on is decoding other uploads) is retried twice after a short wait. */
export async function uploadBake(floorId: string, input: UploadBakeInput, wait = (ms: number) => new Promise((r) => setTimeout(r, ms))): Promise<BakeRow> {
  const form = (): FormData => {
    const f = new FormData();
    f.set('kind', input.slot.kind);
    f.set('level_id', input.slot.level_id);
    f.set('preset', input.slot.preset);
    f.set('style', input.slot.style);
    f.set('band', input.slot.band);
    f.set('variant', input.slot.variant);
    f.set('bake_key', input.bakeKey);
    f.set('recipe', input.recipe);
    f.set('meta', input.meta ? JSON.stringify(input.meta) : '');
    f.set('file', input.file, input.name ?? fileName(input.slot.kind, input.file.type));
    return f;
  };
  for (let attempt = 0; ; attempt++) {
    try {
      return await upload<BakeRow>(`floors/${encodeURIComponent(floorId)}/bakes`, form());
    } catch (err) {
      if (attempt < 2 && err instanceof ApiError && err.status === 503) {
        await wait(1500 * (attempt + 1));
        continue;
      }
      throw err;
    }
  }
}

function fileName(kind: BakeKind, mime: string): string {
  const ext = mime === 'image/webp' ? 'webp' : mime === 'image/jpeg' ? 'jpg' : mime === 'application/json' ? 'json' : 'png';
  return `${kind}.${ext}`;
}

export interface RegenerateScope {
  levels?: string[];
  presets?: string[];
  styles?: string[];
  bands?: string[];
  lightmap?: boolean;
}
export const requestBake = (floorId: string, scope: RegenerateScope = {}) =>
  post<{ job: BakeJob; created: boolean; expected: string[] }>(`floors/${encodeURIComponent(floorId)}/bakes/regenerate`, scope);
export const claimBake = (floorId: string, jobId: string) => post<{ job: BakeJob; expected: string[] }>(`floors/${encodeURIComponent(floorId)}/bakes/jobs/${encodeURIComponent(jobId)}/claim`);
export const finishBake = (floorId: string, jobId: string, status: 'done' | 'failed' | 'cancelled', error?: string) =>
  post<{ job: BakeJob }>(`floors/${encodeURIComponent(floorId)}/bakes/jobs/${encodeURIComponent(jobId)}/finish`, error ? { status, error } : { status });
export const deleteBakes = (floorId: string) => del(`floors/${encodeURIComponent(floorId)}/bakes`);

/** The bundle's bakes part with every URL resolved against the API root (the map adapter, api/maps.ts). */
export function resolveBundleBakes(b: BundleBakes | null | undefined): BundleBakes | null {
  if (!b) return null;
  const levels: BundleBakes['levels'] = {};
  for (const [id, lv] of Object.entries(b.levels ?? {})) {
    levels[id] = {
      stills: Object.fromEntries(Object.entries(lv.stills).map(([k, s]) => [k, { ...s, url: resourceUrl(s.url) }])),
      masks: Object.fromEntries(Object.entries(lv.masks).map(([k, m]) => [k, { url: resourceUrl(m.url) }])),
      lightmap: lv.lightmap ? { ...lv.lightmap, url: resourceUrl(lv.lightmap.url) } : null,
    };
  }
  return { ...b, levels };
}
