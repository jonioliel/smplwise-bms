/**
 * STATIONPERM-295: the pure logic of the per-station access block (no DOM, unit-tested in Node). The server sends which actions the
 * caller may take on each station; this only orders and labels them.
 */
import type { StateKind } from '../components/sw-badge';
import type { SpAddable, SpPerson, SpSource, SpStation, SpSyncState } from '../api/station-permissions';
import { spt, type SpKey } from '../i18n/station-permissions';

export type SpAction = 'allow' | 'deny' | 'inherit' | 'approve' | 'refuse' | 'sync';

export function sourceBadge(source: SpSource): { kind: StateKind; label: string } {
  switch (source) {
    case 'group': return { kind: 'neutral', label: spt('src_group') };
    case 'personal': return { kind: 'live', label: spt('src_personal') };
    case 'blocked': return { kind: 'error', label: spt('src_blocked') };
    // GRANTDENY-295: Arx wrote a personal deny over a station a group still grants - said on the row itself, no paragraph
    case 'blocked_group': return { kind: 'error', label: spt('src_blocked_group') };
    case 'none': return { kind: 'offline', label: spt('src_none') };
    default: return { kind: 'unknown', label: spt('src_unknown') };
  }
}

/** The sync chip of a station with an Arx decision; none for a station Arx never decided (or one already proven). */
export function syncBadge(state: SpSyncState | undefined | null): { kind: StateKind; label: string } | null {
  switch (state) {
    case 'pending': return { kind: 'stale', label: spt('sync_pending') };
    case 'unverified': return { kind: 'stale', label: spt('sync_unverified') };
    case 'failed': return { kind: 'error', label: spt('sync_failed') };
    case 'applied': return { kind: 'recorded', label: spt('sync_applied') };
    default: return null;
  }
}

/** The buttons of one row, in a fixed order; "refuse" reads "withdraw" on the caller's own request. */
export function rowButtons(st: SpStation): { action: SpAction; label: string; primary: boolean }[] {
  const out: { action: SpAction; label: string; primary: boolean }[] = [];
  const a = st.actions;
  if (a.approve) out.push({ action: 'approve', label: spt('approve'), primary: true });
  if (a.refuse) out.push({ action: 'refuse', label: spt(st.request?.mine ? 'withdraw' : 'refuse'), primary: false });
  if (a.allow && st.source !== 'personal' && !st.request) out.push({ action: 'allow', label: spt('allow'), primary: false });
  // on a personal allow "inherit" is the removal of that allow (the server turns it into a personal deny while a group still grants the station)
  if (a.inherit) out.push({ action: 'inherit', label: spt(st.source === 'personal' ? 'removePersonal' : 'inherit'), primary: false });
  if (a.deny) out.push({ action: 'deny', label: spt('deny'), primary: false });
  if (a.sync) out.push({ action: 'sync', label: spt('sync'), primary: false });
  return out;
}

/** The single blocking notice of the whole block, if any (only one is shown). */
export function blockNotice(p: SpPerson): SpKey | null {
  if (p.grant_live) return 'grantLive';
  if (p.self && !p.system_admin) return 'self';
  if (p.read === 'unavailable') return 'unavailable';
  return null;
}

/** The doors line ("דלתות 1, 2") only when more than one relay exists or the station's doors are not just relay 1. */
export function doorsText(relays: number[]): string {
  return relays.length && !(relays.length === 1 && relays[0] === 1) ? spt('doors', { doors: relays.join(', ') }) : '';
}

export function stationLabel(st: Pick<SpStation, 'station_id' | 'name'>, names: Record<string, string>): string {
  return st.name || names[st.station_id] || st.station_id;
}

/** The stations the caller may add (not already listed), sorted by name. */
export function addChoices(p: SpPerson): SpAddable[] {
  const shown = new Set(p.stations.map((s) => s.station_id));
  return p.addable.filter((s) => !shown.has(s.station_id)).sort((x, y) => (x.name || x.station_id).localeCompare(y.name || y.station_id));
}

/** The one-line outcome under the block after an action. */
export function outcomeKey(outcome: string): SpKey {
  return outcome === 'requested' ? 'requestSent' : 'done';
}
