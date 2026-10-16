import type { WaMine, WaNotifyView } from '../api/notify-whatsapp';

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
  /** review F3: a budget share stepper (10 % steps), clamped to the range; the critical share never below the normal one and vice versa */
  stepPct(v: WaNotifyView, key: 'budget_pct' | 'budget_critical_pct', delta: number): { budget_pct: number; budget_critical_pct: number } {
    const [lo, hi] = v.ranges[key];
    const next = Math.min(hi, Math.max(lo, v[key] + delta));
    if (key === 'budget_pct') return { budget_pct: next, budget_critical_pct: Math.max(next, v.budget_critical_pct) };
    return { budget_pct: Math.min(v.budget_pct, next), budget_critical_pct: next };
  },
  /** re-review R5 / second re-review B-5: the user can always withdraw an opt-in they gave - whatever the contact list says, and also
   * after the number changed or was removed (`stored_opt_in`) */
  canStop(m: WaMine | null): boolean {
    return !!m && m.channel_enabled && (m.opted_in || !!m.stored_opt_in);
  },
  /** the user's own row (review F2): hidden while the channel is off; otherwise what the user should see and may do */
  mineState(m: WaMine | null): 'hidden' | 'none' | 'declined' | 'changed' | 'on' | 'off' {
    if (!m || !m.channel_enabled) return 'hidden';
    if (!m.has_number) return 'none';
    if (m.directory_declined) return 'declined';
    if (m.number_changed) return 'changed';
    return m.opted_in ? 'on' : 'off';
  },
};
