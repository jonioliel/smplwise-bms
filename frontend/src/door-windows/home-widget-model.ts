/**
 * DOORWIN2-295: the doors HOME widget's pure logic (no DOM, no network). Unit-tested in tests/unit-door-windows-home-widget.spec.ts.
 *
 * Sources: GET /doors/windows/state and GET /doors/emergency/state - the SAME answers the door-windows screen uses, so the widget never shows a
 * door, a window or an emergency button the server did not already scope to this person (Arx RBAC is the only authority; this module only
 * shapes). Nothing is invented: a window is "open now" only when the engine's acknowledgement moved it to `active`; "relock not confirmed" is the
 * watchdog's own state. No claim about the physical door is made anywhere.
 *
 * The widget is present only when the doors tab is on (`doors.ui.tab`, derived by the server from the two master switches, both off by default)
 * and the viewer sees at least one door. The emergency entry is a separate, per-installation switch (`doors.emergency.home_widget`, off by default)
 * and only for the holders of an emergency permission. No ticket action of any kind lives here: the tickets module is not consulted because the
 * widget offers no service-request action (a test pins that with the module off and on).
 */
import type { EmergencyState, ForeignPaused, Incident, Occurrence, WindowsState } from '../api/door-windows';
import { hm } from './logic';
import type { DwwtKey } from '../i18n/door-windows-widget';

export const DOORS_HOME_HREF = '#/wiskey/door-windows';

export interface DoorsWidgetData {
  windows: WindowsState | null;
  emergency: EmergencyState | null;
}

export type DoorsLook = 'err' | 'warn' | 'ok' | 'off';
export type DoorsRowKind = 'unconfirmed' | 'foreign' | 'not_started' | 'active' | 'next';

export interface DoorsHomeRow {
  kind: DoorsRowKind;
  door: string;
  name: string;
  /** "HH:MM" in the door's own zone: the end of an open window, the start of the next one (empty for the others). */
  time: string;
  look: DoorsLook;
  key: DwwtKey;
}

export interface DoorsHomeView {
  look: DoorsLook;
  incident: Incident | null;
  /** The emergency entry (a button that opens the existing sheet): the installation switch is on and the viewer holds an emergency permission. */
  emergencyEntry: boolean;
  counts: { unconfirmed: number; notStarted: number; foreign: number; active: number };
  rows: DoorsHomeRow[];
  /** The one line of the small card. */
  headline: { key: DwwtKey; vars: Record<string, string | number> };
}

const ROW_KEY: Record<DoorsRowKind, DwwtKey> = {
  unconfirmed: 'rowUnconfirmed', foreign: 'rowForeign', not_started: 'rowNotStarted', active: 'rowActive', next: 'rowNext',
};
const RANK: Record<DoorsRowKind, number> = { unconfirmed: 0, foreign: 1, not_started: 2, active: 3, next: 4 };

/** Whether the viewer may use the emergency entry on the home screen. */
export function emergencyEntry(em: EmergencyState | null): boolean {
  return !!em && em.home_widget === true && (em.can.lock || em.can.open);
}

/** The widget is ABSENT (no ghost, not in the editor, not in the personal list) unless the doors tab is on and the viewer sees at least one door. */
export function doorsWidgetAvailable(d: DoorsWidgetData, tabOn: boolean): boolean {
  return tabOn && !!d.windows && d.windows.doors.length > 0;
}

export function liveIncident(em: EmergencyState | null): Incident | null {
  const live = (i: Incident | null | undefined): i is Incident => !!i && ['applying', 'in_effect', 'in_effect_partial', 'releasing'].includes(i.state);
  return live(em?.active) ? em!.active : live(em?.drill) ? (em!.drill as Incident) : null;
}

const zoneOf = (w: WindowsState, door: string): string => w.doors.find((x) => x.key === door)?.zone ?? 'Asia/Jerusalem';
const nameOf = (w: WindowsState, o: Pick<Occurrence, 'door' | 'label'>): string => o.label || w.doors.find((x) => x.key === o.door)?.label || o.door;

export function doorsHomeView(d: DoorsWidgetData, now: Date): DoorsHomeView {
  const w = d.windows;
  const rows: DoorsHomeRow[] = [];
  const counts = { unconfirmed: 0, notStarted: 0, foreign: 0, active: 0 };
  let next: Occurrence | null = null;
  if (w) {
    for (const o of w.occurrences) {
      const zone = zoneOf(w, o.door);
      if (o.state === 'relock_unconfirmed') {
        counts.unconfirmed += 1;
        rows.push({ kind: 'unconfirmed', door: o.door, name: nameOf(w, o), time: '', look: 'err', key: ROW_KEY.unconfirmed });
      } else if (o.state === 'not_started') {
        counts.notStarted += 1;
        rows.push({ kind: 'not_started', door: o.door, name: nameOf(w, o), time: '', look: 'warn', key: ROW_KEY.not_started });
      } else if (o.state === 'active' || o.state === 'starting') {
        counts.active += o.state === 'active' ? 1 : 0;
        if (o.state === 'active') rows.push({ kind: 'active', door: o.door, name: nameOf(w, o), time: hm(o.end_at, zone), look: 'ok', key: ROW_KEY.active });
      } else if (['prepared', 'planned', 'armed'].includes(o.state) && new Date(o.start_at).getTime() > now.getTime()) {
        if (!next || o.start_at < next.start_at) next = o;
      }
    }
    for (const f of w.foreign_paused ?? ([] as ForeignPaused[])) {
      counts.foreign += 1;
      rows.push({ kind: 'foreign', door: f.door, name: f.label, time: '', look: 'warn', key: ROW_KEY.foreign });
    }
    if (next) rows.push({ kind: 'next', door: next.door, name: nameOf(w, next), time: hm(next.start_at, zoneOf(w, next.door)), look: 'off', key: ROW_KEY.next });
  }
  rows.sort((a, b) => RANK[a.kind] - RANK[b.kind] || a.name.localeCompare(b.name));
  const incident = liveIncident(d.emergency);
  const look: DoorsLook = incident || counts.unconfirmed ? 'err' : counts.notStarted || counts.foreign ? 'warn' : counts.active ? 'ok' : 'off';
  const top = rows[0];
  const headline: DoorsHomeView['headline'] = incident
    ? { key: incident.drill ? 'drill' : 'incident', vars: {} }
    : counts.unconfirmed
      ? { key: 'unconfirmed', vars: { n: counts.unconfirmed } }
      : counts.notStarted
        ? { key: 'notStarted', vars: { n: counts.notStarted } }
        : counts.foreign
          ? { key: 'foreign', vars: { n: counts.foreign } }
          : counts.active
            ? { key: 'openNow', vars: { n: counts.active } }
            : top && top.kind === 'next'
              ? { key: 'next', vars: { name: top.name, t: top.time } }
              : { key: 'none', vars: {} };
  return { look, incident, emergencyEntry: emergencyEntry(d.emergency), counts, rows, headline };
}
