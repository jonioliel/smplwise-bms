import type { WaNotifyView } from '../api/notify-whatsapp';

/** NOTIFWA: the pure state rules of `<notify-whatsapp-section>` (unit-tested in frontend/tests/unit-notify-whatsapp.spec.ts). */
export const waLogic = {
  /** the cap stepper: one step, clamped to the server's range */
  stepCap(v: WaNotifyView, delta: number): number {
    const [lo, hi] = v.ranges.per_user_hour;
    return Math.min(hi, Math.max(lo, v.per_user_hour + delta));
  },
  /** the one warning the section shows: switched on while no account sends */
  warning(v: WaNotifyView): 'no_account' | null {
    return v.enabled && !v.account.mapped ? 'no_account' : null;
  },
  /** the header tag: on / off / on but not able to send (no account, or the account is not connected) */
  tone(v: WaNotifyView): 'ok' | 'bad' | 'off' {
    if (!v.enabled) return 'off';
    return v.account.mapped && v.account.state === 'connected' ? 'ok' : 'bad';
  },
  /** the test button is offered only to a caller with an own number while an account is mapped */
  canTest(v: WaNotifyView): boolean {
    return v.test.own_number && v.account.mapped;
  },
};
