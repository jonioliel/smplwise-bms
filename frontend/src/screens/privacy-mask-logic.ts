/**
 * MASKUI-295: the pure logic of the privacy-mask editor (no DOM): rectangles <-> the device's four-point regions, the
 * clamping and keyboard moves, the draft diff and the client-side validation that mirrors services/nvr_privacy.validate.
 * The server validates again; this only keeps the screen from offering a write it knows will be refused.
 * Tested by tests/unit-privacy-mask.spec.ts.
 */
import type { MaskRegion, MaskState, MaskItem } from '../api/nvr-privacy-mask';

export const MIN_SIDE = 4; // normalized units (the server's MIN_SIDE)
export const DEFAULT_FRAME = { width: 704, height: 576 };

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One region of the draft. `rect` is null for a free-shape polygon (kept as the device holds it: it can be deleted, not reshaped here). */
export interface DraftRegion {
  key: string;
  rect: Rect | null;
  points: number[][];
}

export interface Draft {
  enabled: boolean;
  regions: DraftRegion[];
}

export interface Frame {
  width: number;
  height: number;
}

export const rectPoints = (r: Rect): number[][] => [
  [r.x, r.y],
  [r.x + r.w, r.y],
  [r.x + r.w, r.y + r.h],
  [r.x, r.y + r.h],
];

/** The rectangle a four-point region is, or null when it is not an axis-aligned rectangle. */
export function rectOf(points: number[][]): Rect | null {
  if (points.length !== 4) return null;
  const xs = [...new Set(points.map((p) => p[0]))];
  const ys = [...new Set(points.map((p) => p[1]))];
  if (xs.length !== 2 || ys.length !== 2) return null;
  const corners = new Set(points.map((p) => `${p[0]},${p[1]}`));
  if (corners.size !== 4) return null;
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

let seq = 0;
export const newKey = () => `r${++seq}`;

export function draftOf(enabled: boolean, regions: MaskRegion[]): Draft {
  return { enabled, regions: regions.map((r) => ({ key: newKey(), rect: rectOf(r.points), points: r.points.map((p) => [p[0], p[1]]) })) };
}

export const cloneDraft = (d: Draft): Draft => ({ enabled: d.enabled, regions: d.regions.map((r) => ({ key: r.key, rect: r.rect ? { ...r.rect } : null, points: r.points.map((p) => [...p]) })) });

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A rectangle inside the frame, at least MIN_SIDE wide and high, on whole units. */
export function clampRect(r: Rect, f: Frame): Rect {
  const w = clamp(Math.round(r.w), MIN_SIDE, f.width);
  const h = clamp(Math.round(r.h), MIN_SIDE, f.height);
  return { x: clamp(Math.round(r.x), 0, f.width - w), y: clamp(Math.round(r.y), 0, f.height - h), w, h };
}

/** The keyboard step: one percent of the frame (at least one unit); `big` = ten percent. */
export const stepOf = (f: Frame, big = false) => ({ x: Math.max(1, Math.round(f.width / (big ? 10 : 100))), y: Math.max(1, Math.round(f.height / (big ? 10 : 100))) });

export type ArrowKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';
export const isArrow = (k: string): k is ArrowKey => k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown';

/** Arrow = move, Shift+arrow = resize from the top-left corner (width / height). The picture is never mirrored: Left is always smaller x. */
export function keyEdit(r: Rect, key: ArrowKey, shift: boolean, f: Frame, big = false): Rect {
  const s = stepOf(f, big);
  const dx = key === 'ArrowLeft' ? -s.x : key === 'ArrowRight' ? s.x : 0;
  const dy = key === 'ArrowUp' ? -s.y : key === 'ArrowDown' ? s.y : 0;
  return clampRect(shift ? { ...r, w: r.w + dx, h: r.h + dy } : { ...r, x: r.x + dx, y: r.y + dy }, f);
}

export type Corner = 'tl' | 'tr' | 'bl' | 'br';

/** Drag a corner to (px, py): the opposite corner stays; the rectangle never goes below MIN_SIDE or outside the frame. */
export function dragCorner(r: Rect, corner: Corner, px: number, py: number, f: Frame): Rect {
  const left = corner === 'tl' || corner === 'bl';
  const top = corner === 'tl' || corner === 'tr';
  const ax = left ? r.x + r.w : r.x; // the fixed corner
  const ay = top ? r.y + r.h : r.y;
  const cx = clamp(Math.round(px), 0, f.width);
  const cy = clamp(Math.round(py), 0, f.height);
  let x0 = Math.min(ax, cx);
  let x1 = Math.max(ax, cx);
  let y0 = Math.min(ay, cy);
  let y1 = Math.max(ay, cy);
  if (x1 - x0 < MIN_SIDE) (cx < ax ? (x0 = Math.max(0, ax - MIN_SIDE), (x1 = x0 + MIN_SIDE)) : (x1 = Math.min(f.width, ax + MIN_SIDE), (x0 = x1 - MIN_SIDE)));
  if (y1 - y0 < MIN_SIDE) (cy < ay ? (y0 = Math.max(0, ay - MIN_SIDE), (y1 = y0 + MIN_SIDE)) : (y1 = Math.min(f.height, ay + MIN_SIDE), (y0 = y1 - MIN_SIDE)));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** A rectangle spanned by two points (the draw gesture), or null when it is smaller than MIN_SIDE. */
export function spanRect(ax: number, ay: number, bx: number, by: number, f: Frame): Rect | null {
  const x0 = clamp(Math.round(Math.min(ax, bx)), 0, f.width);
  const x1 = clamp(Math.round(Math.max(ax, bx)), 0, f.width);
  const y0 = clamp(Math.round(Math.min(ay, by)), 0, f.height);
  const y1 = clamp(Math.round(Math.max(ay, by)), 0, f.height);
  return x1 - x0 >= MIN_SIDE && y1 - y0 >= MIN_SIDE ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

/** The rectangle the "Add region" button adds: a fifth of the frame, centred, shifted by the number of regions so they do not stack. */
export function defaultRect(f: Frame, count: number): Rect {
  const w = Math.round(f.width / 5);
  const h = Math.round(f.height / 5);
  const off = (count % 5) * Math.round(f.width / 25);
  return clampRect({ x: Math.round((f.width - w) / 2) + off, y: Math.round((f.height - h) / 2) + off, w, h }, f);
}

/** The canonical form the server compares (points sorted, regions sorted): two shapes that are the same polygon are equal. */
const canon = (points: number[][]) => JSON.stringify(points.map((p) => [p[0], p[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]));
export const canonRegions = (regions: { points: number[][] }[]): string[] => regions.map((r) => canon(r.points)).sort();

export function sameState(a: { enabled: boolean; regions: { points: number[][] }[] }, b: { enabled: boolean; regions: { points: number[][] }[] }): boolean {
  return a.enabled === b.enabled && JSON.stringify(canonRegions(a.regions)) === JSON.stringify(canonRegions(b.regions));
}

/** The points a draft region sends: its rectangle once it has one (an edited rectangle's stored `points` are the device's old ones). */
export const pointsOfRegion = (r: DraftRegion): number[][] => (r.rect ? rectPoints(r.rect) : r.points);
const shapeOf = (d: Draft) => ({ enabled: d.enabled, regions: d.regions.map((r) => ({ points: pointsOfRegion(r) })) });

export const isChanged = (original: Draft, draft: Draft): boolean => !sameState(shapeOf(original), shapeOf(draft));

export type Invalid = 'need_region' | 'too_many' | 'too_small' | null;

export function invalidOf(d: Draft, maxRegions: number, f: Frame): Invalid {
  if (d.regions.length > maxRegions) return 'too_many';
  if (d.enabled && d.regions.length === 0) return 'need_region';
  for (const r of d.regions) {
    if (!r.rect) continue;
    if (r.rect.w < MIN_SIDE || r.rect.h < MIN_SIDE || r.rect.x < 0 || r.rect.y < 0 || r.rect.x + r.rect.w > f.width || r.rect.y + r.rect.h > f.height) return 'too_small';
  }
  return null;
}

/** The request item of one camera: exactly the draft, the etag only after a preview. */
export function itemOf(cameraId: string, d: Draft, etag?: string | null): MaskItem {
  return { camera_id: cameraId, enabled: d.enabled, regions: d.regions.map((r) => ({ points: r.rect ? rectPoints(r.rect) : r.points })), ...(etag ? { etag } : {}) };
}

/** Percent box of a rectangle over the picture (the picture is never mirrored: x grows to the right in every language). */
export function percentBox(r: Rect, f: Frame): { left: string; top: string; width: string; height: string } {
  const p = (v: number, t: number) => `${((v / t) * 100).toFixed(3)}%`;
  return { left: p(r.x, f.width), top: p(r.y, f.height), width: p(r.w, f.width), height: p(r.h, f.height) };
}

export const pointsAttr = (points: number[][]) => points.map((p) => `${p[0]},${p[1]}`).join(' ');

/** The region list of a preview row's before/after, as shapes the thumbnails draw. */
export const shapesOf = (s: MaskState | undefined): number[][][] => (s?.regions ?? []).map((r) => r.points);

/** The newest privacy-mask row of the log (newest first) when it is an applied write that was not undone: the only one the undo may restore
 * (the server refuses an older one once the mask changed since). */
export function undoableChange<T extends { kind: string; status: string; rollback_of?: string | null }>(rows: T[]): T | null {
  const newest = rows.find((r) => r.kind === 'privacy_mask');
  return newest && newest.status === 'applied' && !newest.rollback_of ? newest : null;
}
