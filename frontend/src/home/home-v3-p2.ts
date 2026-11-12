// HOME-V3-P2-2431: phase 2 of the home interface mockup v3 (family and building). Importing this file registers its screens and hub
// tiles (home-ext.ts, more-registry.ts of phase 1): who is home, the calendar and shared rooms, the notice board with the buses, service
// requests, weather, my notifications, scene schedules and a new scene from the current state.
import type { HomeHost } from './home-ext';
import { moreTiles } from './more-registry';
import { warmFamily } from './home-p2-ui';
import './home-presence';
import './home-calendar';
import './home-notices';
import './home-tickets';
import './home-weather';
import './home-notif';
import './home-schedules';
import './home-scene-new';

export { sceneScreenActs } from './home-scene-new';

/** The room-screen categories a wall panel locked to its room adds (owner decision round 27 q12 "ב": the notice board and the
 * calendar), in the chips() tuple shape [route, label, icon, status line, tone, key]. Only what the person may see. */
export function wallChips(h: HomeHost): [string, string, string, unknown, string, string?, string?][] {
  warmFamily(h);
  const out: [string, string, string, unknown, string, string?, string?][] = [];
  for (const t of moreTiles(h)) {
    if (t.id !== 'notices' && t.id !== 'calendar') continue;
    t.warm?.(h);
    // HOME-V3-AUDITFIX-2437 (audit item 4): the chip takes the tile's short line when it has one; the full line goes to the title
    const l = t.line(h);
    out.push([t.href, t.label, t.icon, l.chip ?? l.text, '', t.id, l.title]);
  }
  return out;
}
