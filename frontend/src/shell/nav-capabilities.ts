/**
 * NN1 P2: the one table `route -> what the installation must have` (docs/architecture/CAPABILITIES.md section 4).
 * It replaces the binary NVR-less switch: navigation items whose requirements the installation lacks are not offered, and a
 * direct URL to such a screen gets a neutral panel (sw-app.ts) instead of a screen full of errors. Hidden is not
 * unprotected: the server answers 409 (`nvr_not_configured` / `capability_unavailable`) after its own permission check.
 *
 * `supported` is the installation flag, not a capability: an NVR without a media server is not a supported installation, so the
 * areas that exist for video (live overview, wall, saved views, kiosk) are not offered there either (no snapshot grid).
 */
import type { RouteState } from '../router';
import { ALL_CAPABILITIES, type Capabilities, type CapabilityName } from '../api/capabilities';

export type Need = CapabilityName | 'supported';

let CAPS: Capabilities = ALL_CAPABILITIES;

/** Filled by the shell from the session (everything on without a backend). */
export function applyCapabilities(c: Capabilities | null | undefined): Capabilities {
  CAPS = c ?? ALL_CAPABILITIES;
  return CAPS;
}

const NVR: Need[] = ['nvr'];
const NVR_VIDEO: Need[] = ['nvr', 'supported'];

const EVENT_SEGMENTS = new Set(['events', 'reviews', 'rules', 'search', 'cases', 'exports']);

/** What a route needs, by its path segments (`['investigate','playback','sync']`). */
export function needsOfSegments(s: string[]): Need[] {
  switch (s[0]) {
    case 'kiosk':
      return NVR_VIDEO; // the wall
    case 'live':
      return s[1] === 'cameras' ? NVR : NVR_VIDEO; // the camera page needs the NVR; overview, wall and saved views need video as well
    case 'investigate':
      if (s[1] === 'health') return NVR; // camera health
      if (EVENT_SEGMENTS.has(s[1] ?? '')) return ['events_recorder']; // events, reviews, rules, search, cases, exports
      return ['playback']; // playback, synchronised playback, the historical map (and the bare #/investigate, which opens playback)
    case 'system':
      if (s[1] === 'devices' || (s[1] === 'security' && s[2] === 'cameras')) return NVR; // camera health (legacy URL), camera settings
      return [];
    default:
      return [];
  }
}

/** `#/investigate/playback/sync?x=1` -> `['investigate','playback','sync']` */
export function segmentsOfHref(href: string): string[] {
  return href.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean);
}

const has = (n: Need): boolean => (n === 'supported' ? CAPS.supported : CAPS[n]);

/** The needs of `needs` this installation lacks. */
export function missing(needs: Need[]): Need[] {
  return needs.filter((n) => !has(n));
}

/** A navigation href the installation cannot serve: it leaves the tab rows, the rail and the phone bar. */
export function capHiddenHref(href: string): boolean {
  return missing(needsOfSegments(segmentsOfHref(href))).length > 0;
}

/** What a direct URL is missing (empty = open it). */
export function routeMissing(r: RouteState | null): Need[] {
  return r ? missing(needsOfSegments(r.segments)) : [];
}

export type BlockKind = 'no_nvr' | 'no_media';

/** Which neutral panel a blocked route gets: no recorder at all, or a recorder installation without its media server. */
export function blockKind(m: Need[]): BlockKind {
  return !CAPS.nvr || m.some((n) => n === 'nvr' || n === 'events_recorder') ? 'no_nvr' : 'no_media';
}
