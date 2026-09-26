/**
 * The action a click on a lighting circuit runs (T085 strip, T087 3D lamp): the switch's turn_off while it is on, else its
 * turn_on, and why it is blocked - the same guards on both surfaces (no permission, an unavailable switch, no allowed
 * action, a separate grant, a send already in flight for this switch, a stale screen). The click itself goes through the
 * screen's existing `trigger` (the entity action route, its confirmation and audit); this module never writes.
 */
import type { HaActionSpec } from '../api/ha';
import type { CircuitState } from '../api/types';

export interface CircuitAction {
  spec: HaActionSpec | null;
  blocked: boolean;
  /** Hebrew reason when blocked (the strip's disabled title), else null. */
  why: string | null;
}

export function circuitAction(s: CircuitState, ctx: { busy: boolean; stale: boolean }): CircuitAction {
  const on = s.state === 'on';
  const spec = s.actions.find((x) => x.id.endsWith(on ? 'turn_off' : 'turn_on')) ?? null;
  const why = !s.can_control
    ? 'אין הרשאת שליטה בישויות בקומה'
    : !s.available
      ? 'המפסק אינו זמין ב־Home Assistant'
      : !spec
        ? 'אין פעולה מותרת למפסק הזה'
        : spec.granted === false
          ? `נדרשת הרשאה נפרדת: ${spec.grant ?? ''}`
          : ctx.busy
            ? 'פעולה על המפסק כבר בדרך'
            : ctx.stale
              ? 'המפה אינה מעודכנת — השליטה חוזרת עם החידוש'
              : null;
  return { spec, blocked: why !== null, why };
}
