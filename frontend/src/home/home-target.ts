// FIX-HOME-MAPS-2570 (MH-02): the order of an A/C's commands when +/- is tapped on a unit that is off. The first tap turns the unit on
// (a mode command, which settles after seconds) and only then sends its setpoint; a second tap inside that window used to send ITS
// setpoint at once and the first tap's older setpoint then went out last and won, while the tile showed the second. Here the zone keeps
// the newest target asked for and the turn-on in flight: a setpoint that waited is sent only by the NEWEST tap, with the newest value.
// Nothing is retried; a failed turn-on is the answer of every tap that waited for it.
export interface TargetOutcome { ok: boolean; note: string | null }
export type TargetSend = (key: string, id: string, action: string, args: Record<string, unknown>) => Promise<TargetOutcome>;
export interface TargetZone { id: string; min: number; max: number }

export function makeTargetSender(send: TargetSend, onModeFor: (z: TargetZone & { modes: string[] }) => string | null) {
  const want = new Map<string, { target: number }>();
  const turningOn = new Map<string, Promise<TargetOutcome>>();
  return async function setTarget(z: TargetZone & { modes: string[] }, target: number, wasOff: boolean): Promise<TargetOutcome> {
    const mine = { target: Math.max(z.min, Math.min(z.max, target)) };
    want.set(z.id, mine);
    let wait = turningOn.get(z.id);
    if (wasOff && !wait) {
      const mode = onModeFor(z);
      if (!mode) return { ok: false, note: null };
      const p = send(`home:${z.id}:mode`, z.id, 'climate.set_hvac_mode', { hvac_mode: mode });
      turningOn.set(z.id, p);
      void p.finally(() => { if (turningOn.get(z.id) === p) turningOn.delete(z.id); });
      wait = p;
    }
    if (wait) {
      const o = await wait;
      if (!o.ok) return o;
      if (want.get(z.id) !== mine) return { ok: true, note: null }; // a newer tap sends the setpoint itself
    }
    if (want.get(z.id) === mine) want.delete(z.id);
    return send(`home:${z.id}`, z.id, 'climate.set_temperature', { temperature: mine.target });
  };
}
