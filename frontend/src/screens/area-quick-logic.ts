/**
 * AREAPOPUP-297 (round 4 polish, owner requirement 2026-10-27): the pure logic of the area quick-control pop-up - what pressing an
 * area opens (a side drawer, a centred pop-up or, on a phone, a bottom sheet with detents), the open / close / expand state machine,
 * the bottom sheet's detents and the momentum rule that picks one on release, the spring curve as a CSS `linear()` easing, the
 * FLIP transform that lets the pop-up grow out of the pressed tile, and the permission filter (a person sees only the devices he may
 * control and only the sections his permissions reach). No Lit and no DOM, so the unit spec imports it under Playwright's transpiler.
 */
import type { CardId, DeviceCard, DeviceRow } from '../api/devices';

export type QuickMode = 'drawer' | 'popup' | 'sheet';
export type DesktopArea = 'drawer' | 'popup' | 'screen';
export type Detent = 'peek' | 'half' | 'full';
export const DETENTS: readonly Detent[] = ['peek', 'half', 'full'];

export interface QuickState {
  open: boolean;
  mode: QuickMode;
  /** Desktop: the larger view (a wider panel with two columns). */
  expanded: boolean;
  /** Phone: the sheet's resting height. */
  detent: Detent;
  areaId: string | null;
}

export const QUICK_CLOSED: QuickState = { open: false, mode: 'drawer', expanded: false, detent: 'half', areaId: null };

/** What pressing an area does: on a phone the owner's phone choice (sheet / full screen), elsewhere the installation's desktop choice. */
export function pressTarget(phone: boolean, phoneArea: 'sheet' | 'full', desktopArea: DesktopArea): QuickMode | 'screen' {
  if (phone) return phoneArea === 'sheet' ? 'sheet' : 'screen';
  return desktopArea === 'screen' ? 'screen' : desktopArea;
}

export function openQuick(s: QuickState, areaId: string, mode: QuickMode): QuickState {
  // the same area pressed again while open: keep what is there (no re-open flicker); another area: the new one, same size
  if (s.open && s.areaId === areaId && s.mode === mode) return s;
  return { open: true, mode, expanded: s.open && s.mode === mode ? s.expanded : false, detent: 'half', areaId };
}

export function closeQuick(s: QuickState): QuickState {
  return s.open ? { ...s, open: false } : s;
}

export function toggleExpand(s: QuickState): QuickState {
  if (!s.open || s.mode === 'sheet') return s;
  return { ...s, expanded: !s.expanded };
}

export function setDetent(s: QuickState, detent: Detent): QuickState {
  if (!s.open || s.mode !== 'sheet' || s.detent === detent) return s;
  return { ...s, detent };
}

// ------------------------------------------------------------------------------------------------ the bottom sheet's detents

/** The sheet's height per detent, as a share of the viewport height (peek = the head and the quick strip, half, nearly full). */
export const DETENT_SHARE: Record<Detent, number> = { peek: 0.34, half: 0.62, full: 0.92 };

export function detentHeight(detent: Detent, viewportH: number): number {
  return Math.round(viewportH * DETENT_SHARE[detent]);
}

/** Apple's momentum projection (Designing Fluid Interfaces): where a flick would come to rest, from its release velocity (px/ms). */
export function project(velocityPxPerMs: number, decelerationRate = 0.998): number {
  return (velocityPxPerMs * decelerationRate) / (1 - decelerationRate);
}

/** Progressive resistance past a boundary: the further past it, the less the sheet follows (real things slow before they stop). */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/**
 * Where the sheet settles after a drag: the visible height the finger left it at, projected forward by its velocity, snapped to the
 * nearest detent; below a third of the peek height (or a fast downward flick from the peek) it closes. `dy` is the drag in px
 * (positive = down), `velocity` px/ms (positive = down). Every detent is reachable from every other with one gesture.
 */
export function releaseDetent(current: Detent, dy: number, velocity: number, viewportH: number): Detent | 'closed' {
  const startH = detentHeight(current, viewportH);
  const projectedH = startH - dy - project(velocity);
  const closeLine = detentHeight('peek', viewportH) * 0.55;
  if (projectedH < closeLine) return 'closed';
  let best: Detent = 'peek';
  let bestDist = Infinity;
  for (const d of DETENTS) {
    const dist = Math.abs(detentHeight(d, viewportH) - projectedH);
    if (dist < bestDist) {
      bestDist = dist;
      best = d;
    }
  }
  return best;
}

/** The sheet's transform while dragging: its resting offset for the detent plus the drag, rubber-banded above the full height. */
export function dragOffset(current: Detent, dy: number, viewportH: number): number {
  const rest = viewportH - detentHeight(current, viewportH);
  const fullRest = viewportH - detentHeight('full', viewportH);
  const raw = rest + dy;
  if (raw < fullRest) return fullRest - rubberband(fullRest - raw, viewportH);
  return raw;
}

// ------------------------------------------------------------------------------------------------ the spring as a CSS easing

/**
 * A spring in Apple's two parameters (response = how long until it reaches the target, bounce 0 = critically damped) sampled into a
 * CSS `linear()` easing, so the open / close / detent transitions are a real spring that CSS runs off the main thread, and a
 * transition retargeted mid-flight (a second press, a drag released early) starts from where the panel is.
 */
export function springSamples(response: number, bounce: number, steps = 24): number[] {
  const out: number[] = [];
  const zeta = 1 - Math.max(0, Math.min(0.9, bounce)); // damping ratio
  const omega = (2 * Math.PI) / Math.max(0.05, response);
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * response * 1.6; // sample over 1.6 × response: the spring has settled by then
    let y: number;
    if (zeta >= 1) {
      // critically damped
      y = 1 - (1 + omega * t) * Math.exp(-omega * t);
    } else {
      const wd = omega * Math.sqrt(1 - zeta * zeta);
      y = 1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + ((zeta * omega) / wd) * Math.sin(wd * t));
    }
    out.push(Number(y.toFixed(4)));
  }
  out[steps] = 1;
  return out;
}

export function springLinear(response: number, bounce: number, steps = 24): string {
  return `linear(${springSamples(response, bounce, steps).join(', ')})`;
}

/** The motion the pop-up ships: a critically damped open (Apple: damping 1.0 / response 0.35), a slight bounce only after a flick. */
export const SPRING_OPEN = { response: 0.36, bounce: 0 };
export const SPRING_FLICK = { response: 0.32, bounce: 0.14 };
export const OPEN_MS = Math.round(SPRING_OPEN.response * 1.6 * 1000);
export const CLOSE_MS = 180;

// ------------------------------------------------------------------------------------------------ growing out of the pressed tile

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The FLIP start transform: the panel's final box moved and scaled onto the pressed element, so the pop-up visibly grows out of it. */
export function flipFrom(from: Box, to: Box): { x: number; y: number; sx: number; sy: number } {
  const sx = to.w > 0 ? Math.max(0.2, from.w / to.w) : 1;
  const sy = to.h > 0 ? Math.max(0.2, from.h / to.h) : 1;
  return { x: Math.round(from.x + from.w / 2 - (to.x + to.w / 2)), y: Math.round(from.y + from.h / 2 - (to.y + to.h / 2)), sx: Number(sx.toFixed(3)), sy: Number(sy.toFixed(3)) };
}

export function flipTransform(f: { x: number; y: number; sx: number; sy: number }): string {
  return `translate(${f.x}px, ${f.y}px) scale(${f.sx}, ${f.sy})`;
}

// ------------------------------------------------------------------------------------------------ permissions and sections

export type QuickSection = 'quick' | 'lighting' | 'switches' | 'climate' | 'heating' | 'covers' | 'media' | 'sensors' | 'cameras' | 'scenes' | 'schedules' | 'events';
export const CONTROL_CARDS: readonly (CardId & QuickSection)[] = ['lighting', 'switches', 'climate', 'heating', 'covers', 'media'];

/** The rows of a control section a person sees: only what he may control (the owner's rule), that is available. */
export function controllableRows(card: Pick<DeviceCard, 'entities'> | null | undefined, equipmentDomains: ReadonlySet<string> = new Set()): DeviceRow[] {
  return (card?.entities ?? []).filter((r) => r.can_control && !r.alarm_managed && !equipmentDomains.has(r.domain) && !r.door_class);
}

/** The read-only sensors shown (everyone who sees the area sees its values). */
export function sensorRows(card: Pick<DeviceCard, 'entities'> | null | undefined, max = 6): DeviceRow[] {
  return (card?.entities ?? []).filter((r) => r.available).slice(0, max);
}

export interface SectionInput {
  cards: Partial<Record<CardId, Pick<DeviceCard, 'entities'>>> | null;
  cameras: number;
  scenes: number;
  schedules: number;
  events: number;
  /** The caller may start a bulk action on this area (the quick strip). */
  canBulk: boolean;
}

/** The sections of the pop-up, in order, only the ones that have something this person may see or do. */
export function sectionsFor(input: SectionInput, equipmentDomains: ReadonlySet<string> = new Set()): QuickSection[] {
  const out: QuickSection[] = [];
  if (input.canBulk) out.push('quick');
  for (const id of CONTROL_CARDS) if (controllableRows(input.cards?.[id], equipmentDomains).length) out.push(id);
  if (sensorRows(input.cards?.sensors).length) out.push('sensors');
  if (input.cameras > 0) out.push('cameras');
  if (input.scenes > 0) out.push('scenes');
  if (input.schedules > 0) out.push('schedules');
  if (input.events > 0) out.push('events');
  return out;
}

/** The sections of the collapsed (peek) sheet: the quick strip and the first control section only. */
export function peekSections(all: readonly QuickSection[]): QuickSection[] {
  const first = all.find((s) => s !== 'quick');
  return all.filter((s) => s === 'quick' || s === first);
}

/** Which permissions a side list needs (any one of them, at any scope); a 403 from the server hides the section too - the server is the authority. */
export const SECTION_PERMISSION: Record<'scenes' | 'schedules' | 'events' | 'cameras', readonly string[]> = {
  scenes: ['scene.manage', 'automation.manage', 'devices.control', 'ha.entity.control'],
  schedules: ['schedule.view', 'schedule.manage'],
  events: ['events.read'],
  cameras: ['video.live'],
};

export function sideSectionsAllowed(held: (p: string) => boolean): { scenes: boolean; schedules: boolean; events: boolean; cameras: boolean } {
  const any = (list: readonly string[]) => list.some((p) => held(p));
  return { scenes: any(SECTION_PERMISSION.scenes), schedules: any(SECTION_PERMISSION.schedules), events: any(SECTION_PERMISSION.events), cameras: any(SECTION_PERMISSION.cameras) };
}
