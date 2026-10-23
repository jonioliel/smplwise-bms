/**
 * CR-WATER78 sections 3, 8 and 16: who may do what with the water module in the frontend (the server checks every call again). The ONE
 * source is `GET /infra/water/status` (`{enabled, can_view, can_manage, can_configure, can_ack, can_bills, meters}`, any signed-in user,
 * never 403, never module_off); it drives the tab gate (`applyInfraWater`) and every water page.
 *   view       water.view        meters, consumption, alerts, accounts without money (floor-scoped on the server)
 *   ack        water.ack         acknowledge and snooze an open alert
 *   manage     water.manage      add / edit meters, accounts, tariffs, customers
 *   configure  system.configure  the snooze settings (PUT /alerts)
 *   bills      water.bills       money, bills, customers' contact fields
 * Without a backend (static preview, design review) everything is shown and the module is on; the data calls answer empty lists
 * (api/water.ts), so each page shows its empty state - no invented demo data.
 */
import { get } from '../api/client';
import { isApi, onSession } from '../api/session';
import { applyInfraWater } from '../shell/nav';

export interface WaterStatus {
  enabled: boolean;
  can_view: boolean;
  can_manage: boolean;
  can_configure: boolean;
  can_ack: boolean;
  can_bills: boolean;
  meters: number;
}

export interface WaterAccess {
  /** the status was read (or failed): until then the screen shows its loading state */
  loaded: boolean;
  /** the status read failed (the screen offers "try again"; the tab stays hidden) */
  failed: boolean;
  enabled: boolean;
  view: boolean;
  ack: boolean;
  manage: boolean;
  configure: boolean;
  bills: boolean;
  meters: number;
}

const DEMO: WaterAccess = { loaded: true, failed: false, enabled: true, view: true, ack: true, manage: true, configure: true, bills: true, meters: 0 };
const BLANK: WaterAccess = { loaded: false, failed: false, enabled: false, view: false, ack: false, manage: false, configure: false, bills: false, meters: 0 };

let current: WaterAccess = BLANK;
let pending: Promise<WaterAccess> | null = null;
const listeners = new Set<(a: WaterAccess) => void>();

export function accessOf(s: WaterStatus): WaterAccess {
  return { loaded: true, failed: false, enabled: !!s.enabled, view: !!s.can_view, ack: !!s.can_ack, manage: !!s.can_manage, configure: !!s.can_configure, bills: !!s.can_bills, meters: s.meters ?? 0 };
}

/** The tab is offered only while the module is on AND the viewer may see water meters (section 3). */
export const tabOffered = (a: WaterAccess): boolean => a.loaded && !a.failed && a.enabled && a.view;
/** The settings page (section 16): water.manage (tariffs) or system.configure (the snooze). */
export const canSettings = (a: WaterAccess): boolean => a.manage || a.configure;

export function waterAccess(): WaterAccess {
  return isApi() ? current : DEMO;
}

function set(a: WaterAccess) {
  current = a;
  applyInfraWater(tabOffered(a));
  for (const l of listeners) l(a);
}

/** Read the status again (the shell on load, after the module switch, after a session change). */
export function refreshWaterVisibility(): Promise<WaterAccess> {
  if (!isApi()) {
    applyInfraWater(false); // the static demo's navigation shows the default tabs only (nav.ts), the screen still renders on a deep link
    return Promise.resolve(DEMO);
  }
  pending ??= get<WaterStatus>('infra/water/status')
    .then((s) => {
      set(accessOf(s));
      return current;
    })
    .catch(() => {
      set({ ...BLANK, loaded: true, failed: true });
      return current;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** Calls `fn` now and on every change of the status; a session change reads the status again. Returns the stop function. */
export function onWaterAccess(fn: (a: WaterAccess) => void): () => void {
  listeners.add(fn);
  fn(waterAccess());
  let me: unknown = undefined;
  const stopSession = onSession((s) => {
    const who = (s as { me?: { id?: string } | null }).me?.id ?? null;
    if (me !== undefined && who !== me && isApi()) void refreshWaterVisibility();
    me = who;
  });
  return () => {
    listeners.delete(fn);
    stopSession();
  };
}
