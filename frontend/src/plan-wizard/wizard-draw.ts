/**
 * PLAN3D-R28-WIZARD-2433: the wizard's plan drawings - the sheet behind the canvas (the uploaded picture, or in demo mode the
 * sample house drawn as an architect's sheet) and the overlays of each step: the detection by confidence band, the rooms with
 * their numbers, the devices. Everything is drawn through map/geometry buildPrimitives, the same primitives every map uses,
 * in the plan's own pixel space (viewBox 0 0 W H). Plan geometry is never mirrored by the RTL layout.
 */
import { svg, nothing, type SVGTemplateResult } from 'lit';
import { buildPrimitives, type GeometryDoc, type Primitive, type Pt } from '../map/geometry';
import { candidatesDoc, type CandidateSet } from '../map/candidates';
import { bandOf, centroid, type Band, type Placement, type WizardPrefs } from './wizard-model';

const INK = '#1b1f27';
const f = (v: number) => Math.round(v * 10) / 10;
const pts = (p: Pt[]) => p.map((q) => `${f(q[0])},${f(q[1])}`).join(' ');

function drawingString(prims: Primitive[]): string {
  let out = '';
  for (const p of prims) {
    if (p.kind === 'wall') out += `<polyline points="${pts(p.points)}" fill="none" stroke="${INK}" stroke-width="${f(Math.max(3, p.width))}" stroke-linejoin="miter" stroke-linecap="butt"/>`;
    else if (p.kind === 'door') {
      for (const l of p.leaves) out += `<line x1="${f(l[0][0])}" y1="${f(l[0][1])}" x2="${f(l[1][0])}" y2="${f(l[1][1])}" stroke="${INK}" stroke-width="2"/>`;
      for (const a of p.arcs) out += `<path d="M${f(a.from[0])},${f(a.from[1])} A${f(a.r)},${f(a.r)} 0 0 ${a.sweep} ${f(a.to[0])},${f(a.to[1])}" fill="none" stroke="${INK}" stroke-width="1.3"/>`;
    } else if (p.kind === 'window') for (const l of p.lines) out += `<line x1="${f(l[0][0])}" y1="${f(l[0][1])}" x2="${f(l[1][0])}" y2="${f(l[1][1])}" stroke="${INK}" stroke-width="1.5"/>`;
  }
  return out;
}

/** The demo sheet as an image: the house in ink on paper, plus what a real sheet carries and the detector drops (dimension
 * lines, a dashed section line, a title block). */
export function planDrawingDataUrl(doc: GeometryDoc): string {
  const W = doc.dimensions.width_px;
  const H = doc.dimensions.height_px;
  const sheet = `<g stroke="${INK}" stroke-width="1.2" fill="none"><path d="M42,20H958M42,12v16M958,12v16M292,12v16M20,42V858M12,42h16M12,858h16"/><path d="M0,470H${W}" stroke-dasharray="14 8 3 8"/><rect x="${W - 250}" y="${H - 40}" width="236" height="34"/></g>`;
  const body = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#ffffff"/>${sheet}${drawingString(buildPrimitives(doc, W, H))}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(body)}`;
}

/** The band colours (product tokens; the CSS of the screen defines them for both themes). */
export const BAND_VAR: Record<Band, string> = { sure: 'var(--wz-sure)', check: 'var(--wz-check)', doubt: 'var(--wz-doubt)' };

/** Where each candidate is drawn: its wall parts or its opening gap, in plan pixels. */
export interface CandidateGeometry {
  walls: Map<string, Pt[][]>;
  gaps: Map<string, [Pt, Pt]>;
}
export function candidateGeometry(base: GeometryDoc, set: CandidateSet): CandidateGeometry {
  const W = base.dimensions.width_px;
  const H = base.dimensions.height_px;
  const walls = new Map<string, Pt[][]>();
  const gaps = new Map<string, [Pt, Pt]>();
  for (const p of buildPrimitives(candidatesDoc(base, set), W, H)) {
    if (p.kind === 'wall') walls.set(p.id, [...(walls.get(p.id) ?? []), p.points]);
    else if (p.kind === 'door' || p.kind === 'window' || p.kind === 'passage') gaps.set(p.id, p.gap);
  }
  return { walls, gaps };
}

/** The point an item is "at" (the middle of its gap, or of its longest wall part), in plan pixels. */
export function itemPoint(g: CandidateGeometry, id: string): Pt | null {
  const gap = g.gaps.get(id);
  if (gap) return [(gap[0][0] + gap[1][0]) / 2, (gap[0][1] + gap[1][1]) / 2];
  const parts = g.walls.get(id);
  if (!parts?.length) return null;
  const part = [...parts].sort((a, b) => len(b) - len(a))[0];
  return part.length >= 2 ? [(part[0][0] + part[part.length - 1][0]) / 2, (part[0][1] + part[part.length - 1][1]) / 2] : part[0];
}
const len = (p: Pt[]) => p.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - p[i][0], q[1] - p[i][1]), 0);

/** Step 3: every candidate in its band's colour - the doubtful dashed - and a ring around each item still to look at. */
export function detectOverlay(g: CandidateGeometry, set: CandidateSet, prefs: WizardPrefs, decided: ReadonlySet<string>, rejected: ReadonlySet<string>, current: string | null): SVGTemplateResult {
  const conf = new Map<string, number>([...set.walls.map((w) => [w.id, w.confidence] as const), ...set.openings.map((o) => [o.id, o.confidence] as const)]);
  const tone = (id: string): Band => (decided.has(id) ? 'sure' : bandOf(conf.get(id) ?? 1, prefs));
  const wallsT = [...g.walls.entries()].map(([id, parts]) => {
    const b = tone(id);
    const out = rejected.has(id);
    return parts.map((p) => svg`<polyline data-cand=${id} points=${pts(p)} fill="none" stroke=${out ? 'var(--wz-out)' : BAND_VAR[b]} stroke-width="7" stroke-linecap="round" stroke-dasharray=${b === 'doubt' && !out ? '10 9' : out ? '3 8' : 'none'} opacity=".85"/>`);
  });
  const gapsT = [...g.gaps.entries()].map(([id, [a, b]]) => {
    const t = tone(id);
    const out = rejected.has(id);
    const m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const hot = current === id;
    return svg`<line data-cand=${id} x1=${f(a[0])} y1=${f(a[1])} x2=${f(b[0])} y2=${f(b[1])} stroke=${out ? 'var(--wz-out)' : BAND_VAR[t]} stroke-width="9" stroke-linecap="round" stroke-dasharray=${t === 'doubt' && !out ? '3 12' : 'none'} opacity=".95"/>
      ${t !== 'sure' || hot ? svg`<circle data-cand=${id} cx=${f(m[0])} cy=${f(m[1])} r=${hot ? 46 : 26} fill=${BAND_VAR[t]} fill-opacity=${hot ? 0.16 : 0.1} stroke=${BAND_VAR[t]} stroke-width=${hot ? 4 : 2}/>` : nothing}`;
  });
  const hotWall = current && g.walls.has(current) ? itemPoint(g, current) : null;
  return svg`<g class="ov">${wallsT}${gapsT}${hotWall ? svg`<circle cx=${f(hotWall[0])} cy=${f(hotWall[1])} r="46" fill=${BAND_VAR[tone(current!)]} fill-opacity=".14" stroke=${BAND_VAR[tone(current!)]} stroke-width="4"/>` : nothing}</g>`;
}

/** The palette of the room fills (a categorical set that reads on white paper in both themes). */
export const ROOM_COLOURS = ['#7aa7ff', '#b99cf0', '#8fd0c8', '#f5c26b', '#f09a8a', '#9ccf7f', '#e8a3d3', '#b8bfcc', '#7fc4e8', '#d9b48f', '#a3b8f0', '#c9d97f'];
export const roomColour = (i: number) => ROOM_COLOURS[i % ROOM_COLOURS.length];

/** Step 4 / 6: the rooms - strong fills with their numbers (naming), or faint fills under the devices. */
export function roomsOverlay(rooms: readonly { polygon: { x: number; y: number }[] }[], W: number, H: number, mode: 'name' | 'faint', focus: number | null): SVGTemplateResult {
  return svg`<g class="rooms">${rooms.map((r, i) => {
    const c = centroid(r.polygon);
    const poly = r.polygon.map((p) => `${f(p.x * W)},${f(p.y * H)}`).join(' ');
    return svg`<polygon data-room=${i} points=${poly} fill=${roomColour(i)} fill-opacity=${mode === 'name' ? (focus === i ? 0.62 : 0.42) : 0.16} stroke=${focus === i ? 'var(--sw-accent)' : 'none'} stroke-width="4"/>
      ${mode === 'name' ? svg`<g data-room=${i}><circle cx=${f(c.x * W)} cy=${f(c.y * H)} r="24" fill="#fff" stroke=${roomColour(i)} stroke-width="3"/><text x=${f(c.x * W)} y=${f(c.y * H + 8)} text-anchor="middle" font-size="24" font-weight="700" fill="#1e2e47">${i + 1}</text></g>` : nothing}`;
  })}</g>`;
}

/** Step 6: placed devices (solid), the selected one ringed, the ones still waiting for a place listed only in the side panel. */
export function devicesOverlay(list: readonly Placement[], W: number, H: number, selected: string | null): SVGTemplateResult {
  return svg`<g class="devs">${list.filter((d) => d.x !== null && d.y !== null).map((d) => {
    const x = f(d.x! * W);
    const y = f(d.y! * H);
    const on = d.entity_id === selected;
    const fill = d.where === 'manual' ? 'var(--wz-check)' : 'var(--wz-sure)';
    // a camera is a rounded square (PLAN3D-R28-WIZARD2-2434), a device a dot: the two read apart on the plan
    const mark = d.resource === 'camera'
      ? svg`<rect x=${f(d.x! * W - 15)} y=${f(d.y! * H - 15)} width="30" height="30" rx="7" fill=${fill} stroke="#fff" stroke-width="4"/>`
      : svg`<circle cx=${x} cy=${y} r="15" fill=${fill} stroke="#fff" stroke-width="4"/>`;
    return svg`<g data-dev=${d.entity_id} data-dev-kind=${d.resource ?? 'ha_entity'}>${on ? svg`<circle cx=${x} cy=${y} r="30" fill="var(--sw-accent)" fill-opacity=".16" stroke="var(--sw-accent)" stroke-width="3"/>` : nothing}${mark}</g>`;
  })}</g>`;
}
