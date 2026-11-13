// HOME-V3-GAPS-2436: the alarm's arm / disarm changes for the home diary's "אזעקה" filter (mockup v3 `S.events`, kind `alarm`):
// GET /home/alarm-log (routers/home_gaps.py) - only changes the panel confirmed, only panels the person may view, the last 7 days.
import { get } from '../api/client';
import { canAnywhere } from '../api/session';
import type { HomeHost } from './home-ext';

export type AlarmChange = 'arm_away' | 'arm_home' | 'arm_night' | 'arm_vacation' | 'arm_custom_bypass' | 'disarm';
export interface AlarmLogItem { at: string; panel: string; action: AlarmChange; by: string | null; me: boolean }
export const getAlarmLog = () => get<{ items: AlarmLogItem[]; days: number }>('home/alarm-log');

/** The diary's words for an alarm change (mockup: 'האזעקה נדרכה למצב "בבית"', 'האזעקה נוטרלה: יונתן'). */
export function alarmChangeText(i: Pick<AlarmLogItem, 'action' | 'by' | 'me'>): string {
  const w = i.action === 'disarm' ? 'האזעקה נוטרלה' : i.action === 'arm_home' ? 'האזעקה נדרכה למצב "בבית"' : i.action === 'arm_night' ? 'האזעקה נדרכה ללילה' : 'האזעקה נדרכה';
  const who = i.me ? 'אני' : i.by;
  return who ? `${w}: ${who}` : w;
}

/** The alarm filter of the home diary: the alarm category is on and the person may view a panel. */
export const alarmLogOk = (h: HomeHost) => h.d.modules.has('security') && canAnywhere('alarm.view');
