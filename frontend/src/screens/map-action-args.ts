// MEDIUM-REST-2540 (deep review SCR-17): the argument values the floor map sends with a device action.
//
// Before: the values typed in the map were keyed by the action id only (`climate.set_temperature:temperature`), so +/- on thermostat A
// was shown and sent for thermostat B; and every argument was always sent, so a light turned on from the map (the room card's switch, the
// card's "הדלקה") always got a brightness - 100 % for a light that was off (no brightness attribute) - and lost its own dim level (rule
// SWITCH-LIGHT-DIMMER-2331: turning a light on keeps the level it had).
// Now: a value belongs to one entity's one action argument, and an OPTIONAL argument the person did not type is not sent at all - the
// device keeps its own value. A required argument (a thermostat's target, a number's value) is still sent with its default.
import type { HaActionArgSpec, HaActionSpec } from '../api/ha';

/** The arguments the bridge treats as optional (custom_components/smplwise_bridge/config_policy.py ACTION_ARGS, `required` False, and
 * services/ha_bridge.py: not an expected-state argument). Every other argument of a map action is required and is always sent. */
const OPTIONAL_ARGS: Readonly<Record<string, readonly string[]>> = {
  'light.turn_on': ['brightness_pct', 'color_temp_kelvin', 'transition'],
  'fan.turn_on': ['percentage'],
};

export function argOptional(actionId: string, arg: string): boolean {
  return OPTIONAL_ARGS[actionId]?.includes(arg) ?? false;
}

/** The key of one typed value: the entity, the action and the argument (never the action alone). */
export function argKey(entityId: string, actionId: string, arg: string): string {
  return `${entityId}|${actionId}|${arg}`;
}

/** The values to send: typed ones as typed, a required argument's default when nothing was typed, an untyped optional argument left out.
 * Numbers go as numbers (a volume back to a fraction), enums / text as typed. */
export function argsToSend(entityId: string, spec: HaActionSpec, typed: Readonly<Record<string, string>>, fallback: (arg: HaActionArgSpec) => string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const a of spec.argument_specs ?? []) {
    let raw = typed[argKey(entityId, spec.id, a.name)];
    if (raw === undefined) {
      if (argOptional(spec.id, a.name)) continue;
      raw = fallback(a);
    }
    if (a.type === 'int' || a.type === 'float') {
      const n = Number(raw);
      if (raw === '' || !Number.isFinite(n)) continue;
      out[a.name] = a.name === 'volume_level' ? Math.min(1, Math.max(0, n / 100)) : n;
    } else out[a.name] = raw;
  }
  return out;
}

/** LOWS-FRONTEND-2550 (review SCR-52, owner answer Q1 a): how one device of a room's "all off" ended - `false` when the command was
 * refused or failed (an error, a failed / denied record). An unknown or still pending record is not counted as "not turned off": the
 * screen does not claim what it did not see. */
export function bulkItemFailed(error: string, status: string | null | undefined): boolean {
  return !!error || status === 'failed' || status === 'denied';
}

/** The room card's line after "all off": null when every device went off (nothing is shown), else how many of how many did not. */
export function bulkResultOf(failed: number, total: number): { failed: number; total: number } | null {
  return failed > 0 && total > 0 ? { failed, total } : null;
}
