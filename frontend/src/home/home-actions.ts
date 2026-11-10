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

function run(key: string, id: string, action: string, args: Record<string, unknown> = {}, confirmed = false): Promise<Outcome> {
  return new Promise((resolve) => {
    void runCommand(key, domainOf(id), id, action, args, true, (s: CommandState<boolean>) => {
      if (s.phase === 'pending') return;
      resolve({ ok: s.phase !== 'rolled_back', note: s.note });
    }, { confirmed });
  });
}

export const setPower = (x: HLight | HLoad, on: boolean) => run(`home:${x.id}`, x.id, `${domainOf(x.id)}.turn_${on ? 'on' : 'off'}`);

const dimmer = debouncedCommand<number>(280);
export function setLevel(l: HLight, v: number, done: (o: Outcome) => void): void {
  dimmer(`home:${l.id}`, 'light', l.id, v <= 0 ? 'light.turn_off' : 'light.turn_on', v <= 0 ? {} : { brightness_pct: Math.max(1, Math.min(100, Math.round(v))) }, v, (s) => {
    if (s.phase !== 'pending') done({ ok: s.phase !== 'rolled_back', note: s.note });
  });
}

/** Lights off in a set of rooms: lights and light-typed switches only (a boiler, a fridge, a socket never). */
export async function lightsOff(rooms: HRoom[], scope: { kind: BulkScope; id: string } | null): Promise<Outcome> {
  if (scope) {
    try {
      const p = await previewBulk(scope.kind, scope.id, 'lights_off');
      const first = await runBulk(scope.kind, scope.id, 'lights_off', p.digest);
      const r = await followBulk(first, () => undefined);
      return { ok: r.counts.total === 0 || (r.counts.confirmed + (r.counts.sent ?? 0)) > 0, note: null };
    } catch (err) {
      return { ok: false, note: describeError(err) };
    }
  }
  const lit = rooms.flatMap((r) => r.lights.filter((l) => l.on && l.can));
  const res = await Promise.all(lit.map((l) => setPower(l, false)));
  const bad = res.find((o) => !o.ok);
  return { ok: !bad, note: bad?.note ?? null };
}

export async function climateOff(zones: HZone[]): Promise<Outcome> {
  const res = await Promise.all(zones.filter((z) => z.mode !== 'off' && z.can).map((z) => run(`home:${z.id}`, z.id, 'climate.turn_off')));
  const bad = res.find((o) => !o.ok);
  return { ok: !bad, note: bad?.note ?? null };
}

export async function setTarget(z: HZone, target: number): Promise<Outcome> {
  if (z.mode === 'off') {
    const mode = z.modes.includes('cool') ? 'cool' : z.modes.find((m) => m !== 'off') ?? 'auto';
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
