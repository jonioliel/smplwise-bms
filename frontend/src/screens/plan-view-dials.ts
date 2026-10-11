/**
 * CR-029 ST7 UI: the dial lists and the Hebrew hints of the realistic-3D settings card (system-plan-view.ts), kept apart from
 * the Lit element so the node unit spec (tests/unit-studio6-ui.spec.ts) reads them without a DOM. The dial names (DIAL_HE) and
 * the choice names (CHOICE_HE) live with the API in api/plan-view.ts, where the 3D view reads them too.
 */
import type { PlanViewDials } from '../api/plan-view';

export type SiteDial = Exclude<keyof PlanViewDials, 'default_view'>;
export type FlagDial = 'section_cut' | 'show_temps' | 'motion' | 'walk_guard';

/** The installation-only dials: content and display choices a person never overrides (services/plan_view.py USER_DIALS). */
export const PLAN_VIEW_SITE_ONLY: readonly SiteDial[] = ['furniture', 'textures', 'wall_display', 'kiosk_idle_s'];
export const PLAN_VIEW_FLAGS: readonly FlagDial[] = ['section_cut', 'show_temps', 'motion', 'walk_guard'];
/** The dials in the order the card shows them. */
export const PLAN_VIEW_CARD_DIALS: readonly (keyof PlanViewDials)[] = ['style', 'default_view', 'furniture', 'textures', 'section_cut', 'show_temps', 'motion', 'time_source', 'eye_m', 'mouse_mode', 'walk_guard', 'quality', 'dpr_cap', 'wall_display', 'kiosk_idle_s'];

/** One line under each dial, in plain Hebrew (the settings screen is the only place that explains). */
export const HINT_HE: Record<keyof PlanViewDials, string> = {
  style: 'אוטומטי: בהיר עם ערכת נושא בהירה, כהה עם כהה',
  default_view: 'במה נפתחת התצוגה התלת־ממדית: סכמטי לכולם, ריאליסטי - בחירה אישית בדפדפן הזה',
  furniture: 'דגמים: ריהוט מפורט מהספרייה; גאומטרי: צורות פשוטות (קל יותר למחשב)',
  textures: 'קבצי חומרים: טקסטורות אמיתיות; גאומטרי: גוון אחיד לכל חומר',
  wall_display: 'מסך קיר מציג תלת־ממד חי או תמונות מוכנות (חוסך חום וסוללה)',
  time_source: 'לפי שעון האתר השמש זזה עם היום; ידני: בוחרים שעה בסרגל',
  mouse_mode: 'איך מסובבים את המבט בסיור: גרירה, נעילת סמן, או אוטומטי לפי המסך',
  quality: 'אוטומטי יורד בדרגה כשהמחשב מתקשה; דרגה קבועה נשארת',
  kiosk_idle_s: 'אחרי כמה זמן בלי שינוי מסך הקיר עובר לתמונה מוכנה',
  eye_m: 'גובה העין בסיור בגובה עין',
  dpr_cap: 'כמה פיקסלים לכל נקודת מסך לכל היותר; נמוך יותר = מהיר יותר',
  section_cut: 'במבט מלמעלה הקירות נחתכים כדי לראות פנימה',
  show_temps: 'טמפרטורת החדר על הרצפה כשיש חיישן',
  motion: 'דלתות נפתחות, אור משתנה ותנועת מצלמה',
  walk_guard: 'כשהסיור רץ לאט, האיכות יורדת דרגה עד סוף הסיור',
};
export const KIOSK_HE: Record<number, string> = { 0: 'לעולם לא', 10: '10 שניות', 30: '30 שניות', 120: '2 דקות', 600: '10 דקות' };
