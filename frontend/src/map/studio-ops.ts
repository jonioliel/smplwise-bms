/** Plan Studio (T084): pure edits of a structure document - every function returns a new document, so undo / redo is
 * a stack of documents and nothing is ever mutated in place. */
import { DEFAULT_LEVEL_ID, OPENING_DEFAULTS, type GeometryDoc, type GeomLabel, type GeomOpening, type GeomWall, type OpeningKind, type Pt, type Swing, type WallKind } from './geometry';

export interface WallDefaults {
  thickness_m: number;
  kind: WallKind;
}

/** 16 hex characters, like the backend's new_id(). */
export function newId(): string {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

const round5 = (v: number): number => Math.round(v * 1e5) / 1e5;
const clampPt = (p: Pt): Pt => [round5(Math.min(1, Math.max(0, p[0]))), round5(Math.min(1, Math.max(0, p[1])))];

export function defaultLevelId(doc: GeometryDoc): string {
  return doc.levels.find((l) => l.is_default)?.id ?? DEFAULT_LEVEL_ID;
}

/** A kind's usual size and swing (a door opens, a window and a passage do not). */
export function kindDefaults(kind: OpeningKind): Pick<GeomOpening, 'kind' | 'width_m' | 'height_m' | 'sill_m' | 'swing'> {
  const swing: Swing = kind === 'door' ? 'right' : 'none';
  return { kind, ...OPENING_DEFAULTS[kind], swing };
}

export function addWall(doc: GeometryDoc, points: Pt[], defaults: WallDefaults): { doc: GeometryDoc; id: string } {
  const id = newId();
  const wall: GeomWall = { id, level_id: defaultLevelId(doc), polyline: points.map(clampPt), thickness_m: defaults.thickness_m, height_m: null, base_z_m: 0,
    kind: defaults.kind, confidence: 1, source: 'manual', locked: false, external_ids: {} };
  return { doc: { ...doc, walls: [...doc.walls, wall] }, id };
}

export function addOpening(doc: GeometryDoc, wallId: string, t: number, kind: OpeningKind): { doc: GeometryDoc; id: string } {
  const o: GeomOpening = { id: newId(), wall_id: wallId, t: round5(Math.min(1, Math.max(0, t))), ...kindDefaults(kind), hinge: 'start', anchor_ref: null,
    confidence: 1, source: 'manual', external_ids: {} };
  return { doc: { ...doc, openings: [...doc.openings, o] }, id: o.id };
}

export function patchWall(doc: GeometryDoc, id: string, patch: Partial<GeomWall>): GeometryDoc {
  return { ...doc, walls: doc.walls.map((w) => (w.id === id ? { ...w, ...patch, id: w.id } : w)) };
}

export function patchOpening(doc: GeometryDoc, id: string, patch: Partial<GeomOpening>): GeometryDoc {
  return {
    ...doc,
    openings: doc.openings.map((o) => (o.id === id ? { ...o, ...patch, id: o.id, t: patch.t === undefined ? o.t : round5(Math.min(1, Math.max(0, patch.t))) } : o)),
  };
}

/** The positions t that keep an opening `widthM` wide inside a wall `lengthM` long (the validator's opening_outside_wall):
 * half the width from either end. An opening wider than its wall has only the middle. */
export function openingRange(widthM: number, lengthM: number): [number, number] {
  if (!(lengthM > 0)) return [0, 1];
  const half = Math.max(0, widthM) / 2 / lengthM;
  return half >= 0.5 ? [0.5, 0.5] : [half, 1 - half];
}

/** A fine move of an opening along its wall by `dt` (a fraction of the wall's length): it stops at the end of `range`, and
 * never goes against the key - an opening that already sticks out does not jump, it only moves back towards the wall. */
export function nudgeT(t: number, dt: number, [lo, hi]: [number, number]): number {
  if (dt > 0) return Math.max(t, Math.min(t + dt, hi));
  if (dt < 0) return Math.min(t, Math.max(t + dt, lo));
  return t;
}

export function moveVertex(doc: GeometryDoc, id: string, index: number, p: Pt): GeometryDoc {
  return { ...doc, walls: doc.walls.map((w) => (w.id === id ? { ...w, polyline: w.polyline.map((q, i) => (i === index ? clampPt(p) : q)) } : w)) };
}

/** A wall takes its openings with it. */
export function removeItem(doc: GeometryDoc, id: string): GeometryDoc {
  if (doc.walls.some((w) => w.id === id)) return { ...doc, walls: doc.walls.filter((w) => w.id !== id), openings: doc.openings.filter((o) => o.wall_id !== id) };
  return { ...doc, openings: doc.openings.filter((o) => o.id !== id), labels: doc.labels.filter((l) => l.id !== id) };
}

export function addLabel(doc: GeometryDoc, p: Pt, text: string): { doc: GeometryDoc; id: string } {
  const label: GeomLabel = { id: newId(), text, position: clampPt(p), level_id: defaultLevelId(doc), size: 14 };
  return { doc: { ...doc, labels: [...doc.labels, label] }, id: label.id };
}

export function patchLabel(doc: GeometryDoc, id: string, patch: Partial<GeomLabel>): GeometryDoc {
  return { ...doc, labels: doc.labels.map((l) => (l.id === id ? { ...l, ...patch, id: l.id, position: patch.position ? clampPt(patch.position) : l.position } : l)) };
}
