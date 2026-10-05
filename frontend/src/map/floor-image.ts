/**
 * K88: own floor images - the maths of placing a picture over the plan by its four corners.
 *
 * The picture is drawn as the plan-sized rectangle (0,0)-(W,H) and moved by an affine transform whose least-squares
 * fit sends the rectangle's corners to the stored corner positions (top-left, top-right, bottom-right, bottom-left,
 * plan-normalised). Four corners over-determine an affine map (six unknowns, eight equations): a render that was
 * scaled, rotated, flipped or sheared aligns exactly; a photographed model with perspective aligns up to the
 * least-squares residual, which the alignment card reports so the administrator sees how far off it is.
 */
/** A point as the canvas hands it (plan pixels or normalised), not geometry.ts's tuple. */
export interface Pt {
  x: number;
  y: number;
}

export type Corners = [number, number][];

export interface Affine {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export const IDENTITY: Affine = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/** Corner `i` of the unit square in plan pixels, in the stored corner order. */
function unitCorner(i: number, w: number, h: number): Pt {
  return i === 0 ? { x: 0, y: 0 } : i === 1 ? { x: w, y: 0 } : i === 2 ? { x: w, y: h } : { x: 0, y: h };
}

/**
 * Least-squares affine map sending the plan-pixel rectangle (0,0)-(w,h) to `corners` (normalised, scaled by w / h).
 * Returns the identity for a degenerate set (fewer than three distinct corners).
 */
export function affineFromCorners(corners: Corners | null | undefined, w: number, h: number): Affine {
  if (!corners || corners.length !== 4 || !(w > 0) || !(h > 0)) return IDENTITY;
  // x' = a x + c y + e ; y' = b x + d y + f  - two independent 3-unknown least-squares problems with the same normal matrix
  let sxx = 0, sxy = 0, sx = 0, syy = 0, sy = 0, n = 0;
  let tx0 = 0, tx1 = 0, tx2 = 0, ty0 = 0, ty1 = 0, ty2 = 0;
  for (let i = 0; i < 4; i++) {
    const p = unitCorner(i, w, h);
    const q = { x: corners[i][0] * w, y: corners[i][1] * h };
    if (!Number.isFinite(q.x) || !Number.isFinite(q.y)) return IDENTITY;
    sxx += p.x * p.x; sxy += p.x * p.y; sx += p.x; syy += p.y * p.y; sy += p.y; n += 1;
    tx0 += p.x * q.x; tx1 += p.y * q.x; tx2 += q.x;
    ty0 += p.x * q.y; ty1 += p.y * q.y; ty2 += q.y;
  }
  const m = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]];
  const solved = solve3(m, [tx0, tx1, tx2]);
  const solvedY = solve3(m, [ty0, ty1, ty2]);
  if (!solved || !solvedY) return IDENTITY;
  const [a, c, e] = solved;
  const [b, d, f] = solvedY;
  if (![a, b, c, d, e, f].every(Number.isFinite) || Math.abs(a * d - b * c) < 1e-9) return IDENTITY;
  return { a, b, c, d, e, f };
}

function solve3(m: number[][], v: number[]): number[] | null {
  const det = det3(m);
  if (Math.abs(det) < 1e-9) return null;
  const col = (i: number) => m.map((row, r) => row.map((x, cidx) => (cidx === i ? v[r] : x)));
  return [det3(col(0)) / det, det3(col(1)) / det, det3(col(2)) / det];
}

function det3(m: number[][]): number {
  return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
}

export function applyAffine(t: Affine, p: Pt): Pt {
  return { x: t.a * p.x + t.c * p.y + t.e, y: t.b * p.x + t.d * p.y + t.f };
}

/** The SVG `transform` attribute of an affine map. */
export function affineAttr(t: Affine): string {
  return `matrix(${[t.a, t.b, t.c, t.d, t.e, t.f].map((x) => +x.toFixed(5)).join(' ')})`;
}

/**
 * The largest distance (plan-normalised, relative to the plan's diagonal) between a stored corner and where the fitted
 * affine map sends the rectangle's corner: 0 for an exactly affine placement, larger for a perspective picture.
 */
export function cornerResidual(corners: Corners, w: number, h: number): number {
  const t = affineFromCorners(corners, w, h);
  const diag = Math.hypot(w, h) || 1;
  let worst = 0;
  for (let i = 0; i < 4; i++) {
    const got = applyAffine(t, unitCorner(i, w, h));
    const want = { x: corners[i][0] * w, y: corners[i][1] * h };
    worst = Math.max(worst, Math.hypot(got.x - want.x, got.y - want.y) / diag);
  }
  return worst;
}

/** Move one corner (0..3) to a new normalised position; the others stay. */
export function moveCorner(corners: Corners, index: number, to: Pt): Corners {
  const out = corners.map((c) => [c[0], c[1]] as [number, number]);
  out[index] = [clamp(to.x, -1, 2), clamp(to.y, -1, 2)];
  return out;
}

/** Shift all four corners by a normalised delta (dragging the whole picture). */
export function shiftCorners(corners: Corners, dx: number, dy: number): Corners {
  return corners.map((c) => [clamp(c[0] + dx, -1, 2), clamp(c[1] + dy, -1, 2)] as [number, number]);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** True when the four corners are the plan's own corners (no alignment stored yet). */
export function isDefaultCorners(corners: Corners | null | undefined): boolean {
  if (!corners || corners.length !== 4) return true;
  const d: Corners = [[0, 0], [1, 0], [1, 1], [0, 1]];
  return corners.every((c, i) => Math.abs(c[0] - d[i][0]) < 1e-6 && Math.abs(c[1] - d[i][1]) < 1e-6);
}
