/**
 * CR-MAINT215 slice 2: what the frontend knows about the maintenance module for this viewer - the module switch and `can` from
 * GET /maintenance/module (it answers while the module is off), shared by the navigation and every maintenance screen. The server
 * checks every call again; this only decides what is offered.
 *   view     maintenance.view      the section, the ledger, plans, rounds, a scanned tag
 *   perform  maintenance.perform   walk a round, mark a plan done
 *   manage   maintenance.manage    add / edit / pause / delete, renew, the tags page
 *   request  the tickets module on AND tickets.create - otherwise no "open a service request" anywhere (owner rule 2026-10-20)
 */
import { isApi, onSession } from '../api/session';
import { maintApi, type ModuleState } from '../api/maintenance';
import { applyMaintenanceOn } from '../shell/nav';

export interface MaintAccess {
  /** null = not asked yet */
  enabled: boolean | null;
  view: boolean;
  perform: boolean;
  manage: boolean;
  request: boolean;
  ticketsOn: boolean;
}

const OFF: MaintAccess = { enabled: false, view: false, perform: false, manage: false, request: false, ticketsOn: false };
let current: MaintAccess = { ...OFF, enabled: null };
const listeners = new Set<(a: MaintAccess) => void>();

export function accessOf(s: ModuleState | null): MaintAccess {
  if (!s) return { ...OFF };
  return { enabled: s.enabled, view: s.enabled && s.can.view, perform: s.enabled && s.can.perform, manage: s.enabled && s.can.manage, request: s.enabled && s.can.open_request,
    ticketsOn: s.tickets_on ?? s.can.open_request };
}

export function maintAccess(): MaintAccess {
  return current;
}

function publish(a: MaintAccess): void {
  current = a;
  applyMaintenanceOn(!!a.enabled && a.view);
  for (const l of listeners) l(a);
}

export function onMaintAccess(fn: (a: MaintAccess) => void): () => void {
  listeners.add(fn);
  fn(current);
  const off = onSession(() => void refreshMaintenance());
  return () => {
    listeners.delete(fn);
    off();
  };
}

let inflight: Promise<MaintAccess> | null = null;

/** Asked when the shell loads, after a permission change and after the switch in Settings. A failed read hides the section (an
 * installation that does not use the module never sees an error banner for it). */
export function refreshMaintenance(): Promise<MaintAccess> {
  if (!isApi()) {
    publish({ ...OFF });
    return Promise.resolve(current);
  }
  inflight ??= maintApi.module().then((s) => accessOf(s), () => ({ ...OFF })).then((a) => {
    inflight = null;
    publish(a);
    return a;
  });
  return inflight;
}
