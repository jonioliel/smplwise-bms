// HOME-V3-P1-2430: the "עוד" (more) hub's tiles. Each module registers its own tile here (phase 1: recordings, the home diary, the
// intercom, the alarm); phases 2 and 3 add theirs from their own files. A tile is shown only when `visible` says so - its module is on
// and the person holds the permission - so a switched-off capability disappears from the hub entirely.
import type { HomeHost } from './home-ext';

export interface MoreLine {
  /** the live status line under the label (simple words) */
  text: unknown;
  /** status tone (green = ok only); omitted = plain */
  tone?: 'ok' | 'warn' | 'info' | 'danger' | 'neutral';
  /** a small count on the tile (e.g. missed calls) */
  badge?: number;
}

export interface MoreTile {
  id: string;
  /** sort key: phase 1 uses 10..40, phase 2 50..90, phase 3 100.. */
  order: number;
  /** the route below #/home */
  href: string;
  label: string;
  icon: string;
  visible(h: HomeHost): boolean;
  line(h: HomeHost): MoreLine;
  /** load what the live line needs (called when the hub opens) */
  warm?(h: HomeHost): void;
}

const TILES: MoreTile[] = [];

export function registerMoreTile(t: MoreTile): void {
  const i = TILES.findIndex((x) => x.id === t.id);
  if (i >= 0) TILES.splice(i, 1, t);
  else TILES.push(t);
}

export function moreTiles(h: HomeHost): MoreTile[] {
  return TILES.filter((t) => {
    try {
      return t.visible(h);
    } catch {
      return false;
    }
  }).sort((a, b) => a.order - b.order);
}

/** The route names the hub's children use (their strip goes back to the hub, the nav marks "עוד"). */
export function moreChild(name: string): boolean {
  return TILES.some((t) => t.href.split('/')[0] === name);
}
