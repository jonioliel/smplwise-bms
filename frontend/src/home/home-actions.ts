// HOME-SIMPLE-2420: every control of the home interface, through the existing control paths only:
// a device -> POST /ha/entities/{id}/actions (api/device-commands runCommand: the same permission, confirmation and audit as the
// devices screens); a room / the house off -> the bulk lights_off route where the person may run bulk actions, else one command per
// light (never a non-light switch); a scene -> the scene apply route; a door -> lock.unlock with the explicit confirmation the server
// asks for (routed to the door authority). Nothing here retries a physical command.
import { debouncedCommand, runCommand, type CommandState } from '../api/device-commands';
import { followBulk, previewBulk, runBulk, type BulkScope } from '../api/device-bulk';
import { httpAutomations } from '../api/automations';
import { commandId } from '../api/request-id';
import { describeError } from '../api/client';
import type { HLight, HLoad, HRoom, HShade, HZone, HDoor, HScene } from './home-api';

export type Outcome = { ok: boolean; note: string | null };
const domainOf = (id: string) => id.split('.')[0];

// MEDIUM-REST-2540 (SCR-30): the devices this person's commands are acting on, so an overview read does not put back the state from
// before the tap. A hold ends when the command settles; one that never settles (a newer command for the same device superseded it)
// counts for HOLD_MAX_MS at most.
const HOLD_MAX_MS = 20_000;
const holds = new Map<string, Map<number, number>>(); // entity -> hold -> started at
const touched = new Map<string, number>(); // entity -> the last command sent from this screen
let holdSeq = 0;

function hold(id: string): () => void {
  const n = ++holdSeq;
  const at = Date.now();
  let m = holds.get(id);
  if (!m) holds.set(id, (m = new Map()));
  m.set(n, at);
  touched.set(id, at);
  return () => {
    const mm = holds.get(id);
    if (!mm) return;
    mm.delete(n);
    if (!mm.size) holds.delete(id);
  };
}

/** The devices whose state the screen shows from this person's own command: one still in flight, or one sent at or after `since` (a read
 * that started before the tap answers the old state). */
export function localIds(since: number, now = Date.now()): Set<string> {
  const out = new Set<string>();
  for (const [id, m] of holds) {
    for (const [n, at] of m) if (now - at >= HOLD_MAX_MS) m.delete(n);
    if (m.size) out.add(id);
    else holds.delete(id);
  }
  for (const [id, at] of touched) {
    if (at >= since) out.add(id);
    else if (now - at >= HOLD_MAX_MS) touched.delete(id);
  }
  return out;
}

function run(key: string, id: string, action: string, args: Record<string, unknown> = {}, confirmed = false): Promise<Outcome> {
  const release = hold(id);
  return new Promise((resolve) => {
    void runCommand(key, domainOf(id), id, action, args, true, (s: CommandState<boolean>) => {
      if (s.phase === 'pending') return;
      resolve({ ok: s.phase !== 'rolled_back', note: s.note });
    }, { confirmed }).finally(release);
  });
}

export const setPower = (x: HLight | HLoad, on: boolean) => run(`home:${x.id}`, x.id, `${domainOf(x.id)}.turn_${on ? 'on' : 'off'}`);

const dimmer = debouncedCommand<number>(280);
const dimHolds = new Map<string, () => void>(); // a drag's newer value supersedes the older one at once: its hold ends with it
export function setLevel(l: HLight, v: number, done: (o: Outcome) => void): void {
  dimHolds.get(l.id)?.();
  const release = hold(l.id);
  dimHolds.set(l.id, release);
  dimmer(`home:${l.id}`, 'light', l.id, v <= 0 ? 'light.turn_off' : 'light.turn_on', v <= 0 ? {} : { brightness_pct: Math.max(1, Math.min(100, Math.round(v))) }, v, (s) => {
    if (s.phase === 'pending') return;
    release();
    if (dimHolds.get(l.id) === release) dimHolds.delete(l.id);
    done({ ok: s.phase !== 'rolled_back', note: s.note });
  });
}

/** Lights off in a set of rooms: lights and light-typed switches only (a boiler, a fridge, a socket never). `lit` = the lights that
 * were on BEFORE the screen showed them off (MEDIUM-REST-2540: the screen turns them off at once, so reading `on` here found none). */
export async function lightsOff(rooms: HRoom[], scope: { kind: BulkScope; id: string; building?: string } | null, lit: HLight[] = rooms.flatMap((r) => r.lights.filter((l) => l.on && l.can))): Promise<Outcome> {
  if (scope) {
    const release = lit.map((l) => hold(l.id));
    try {
      // MULTI-BUILDING-HOME-2500 (owner Q66): "כבה הכל" of one building names it - the server cuts the scope to that building's areas
      const p = await previewBulk(scope.kind, scope.id, 'lights_off', undefined, undefined, undefined, scope.building);
      const first = await runBulk(scope.kind, scope.id, 'lights_off', p.digest, undefined, undefined, undefined, scope.building);
      const r = await followBulk(first, () => undefined);
      return { ok: r.counts.total === 0 || (r.counts.confirmed + (r.counts.sent ?? 0)) > 0, note: null };
    } catch (err) {
      return { ok: false, note: describeError(err) };
    } finally {
      for (const f of release) f();
    }
  }
  const res = await Promise.all(lit.filter((l) => l.can).map((l) => setPower(l, false)));
  const bad = res.find((o) => !o.ok);
  return { ok: !bad, note: bad?.note ?? null };
}

export async function climateOff(zones: HZone[]): Promise<Outcome> {
  const res = await Promise.all(zones.filter((z) => z.mode !== 'off' && z.can).map((z) => run(`home:${z.id}`, z.id, 'climate.turn_off')));
  const bad = res.find((o) => !o.ok);
  return { ok: !bad, note: bad?.note ?? null };
}

/** MEDIUM-REST-2540 (SCR-31): the mode a zone that is off is turned on with when its target is changed - cool when the unit offers it,
 * else its first mode other than off; null when it offers no other mode (it cannot be turned on from here). */
export function onModeFor(z: Pick<HZone, 'modes'>): string | null {
  return z.modes.includes('cool') ? 'cool' : z.modes.find((m) => m !== 'off') ?? null;
}

/** A new target. A zone that WAS off (`wasOff`, read before the screen showed it on - SCR-31: the screen's own optimistic mode hid it, so
 * only the setpoint was sent and the unit stayed off) is turned on first with `onModeFor`, then gets the setpoint. */
export async function setTarget(z: HZone, target: number, wasOff = z.mode === 'off'): Promise<Outcome> {
  if (wasOff) {
    const mode = onModeFor(z);
    if (!mode) return { ok: false, note: null };
    const o = await run(`home:${z.id}:mode`, z.id, 'climate.set_hvac_mode', { hvac_mode: mode });
    if (!o.ok) return o;
  }
  return run(`home:${z.id}`, z.id, 'climate.set_temperature', { temperature: Math.max(z.min, Math.min(z.max, target)) });
}

export const setMode = (z: HZone, mode: string) =>
  mode === 'off' ? run(`home:${z.id}:mode`, z.id, 'climate.turn_off') : run(`home:${z.id}:mode`, z.id, 'climate.set_hvac_mode', { hvac_mode: mode });

/** A shutter: open / close are movements the server asks to confirm (the screen asks for a second tap first); stop never waits. */
export const moveShade = (s: HShade, v: 'open' | 'close' | 'stop') =>
  run(`home:${s.id}`, s.id, v === 'open' ? 'cover.open_cover' : v === 'close' ? 'cover.close_cover' : 'cover.stop_cover', {}, v !== 'stop');

/** Open a door: the person already confirmed on screen; the server checks the door permission itself and audits the attempt. */
export const openDoor = (d: HDoor) => run(`home:${d.id}`, d.id, 'lock.unlock', {}, true);
export const lockDoor = (d: HDoor) => run(`home:${d.id}`, d.id, 'lock.lock', {}, true);

export async function applyScene(s: HScene): Promise<Outcome> {
  try {
    await httpAutomations.applyScene(s.id, { confirm: s.sensitive ? true : undefined, client_request_id: commandId() });
    return { ok: true, note: null };
  } catch (err) {
    return { ok: false, note: describeError(err) };
  }
}
