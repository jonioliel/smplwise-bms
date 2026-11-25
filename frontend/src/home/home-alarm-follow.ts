// SCREENS-FIX-A-2520 (SCR-06): an arm / disarm request of the home interface is followed to the panel's answer. The toast says
// "sent, waiting for the panel" until the device-action record is confirmed, failed or unknown (api/ha awaitAction - the same
// follow-up as the full alarm screen), and the panels are read again at each step. Only the newest request is followed.
import { awaitAction } from '../api/ha';
import type { AlarmAction } from '../api/alarm';
import type { HomeHost } from './home-ext';
import { alarmFollow, alarmFollowText, type AlarmFollow } from './home-v3-words';

let current: { stopped: boolean } | null = null;

export function followAlarmAction(h: HomeHost, rec: { id: string; status: string }, action: AlarmAction | string): void {
  if (current) current.stopped = true;
  const signal = { stopped: false };
  current = signal;
  const show = (f: AlarmFollow) => { if (!signal.stopped) h.toast(alarmFollowText(action, f)); };
  const first = alarmFollow(rec.status);
  show(first);
  void h.loadPanels();
  if (first !== 'pending' || !rec.id) return;
  void awaitAction(rec.id, () => undefined, signal)
    // still pending after the follow-up window: the panel did not answer in time - say so, never "armed"
    .then((a) => { const f = alarmFollow(a.status); show(f === 'pending' ? 'unknown' : f); })
    .catch(() => show('unknown'))
    .finally(() => { if (!signal.stopped) void h.loadPanels(); });
}
