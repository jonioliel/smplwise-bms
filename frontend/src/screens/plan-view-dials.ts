/**
 * CR-029 ST7 UI: the dial lists and the Hebrew hints of the realistic-3D settings card (system-plan-view.ts), kept apart from
 * the Lit element so the node unit spec (tests/unit-studio6-ui.spec.ts) reads them without a DOM. The dial names (DIAL_HE) and
 * the choice names (CHOICE_HE) live with the API in api/plan-view.ts, where the 3D view reads them too.
 */
import type { PlanViewDials } from '../api/plan-view';
import { tr } from '../i18n/msg/plan-view-card';

export type SiteDial = Exclude<keyof PlanViewDials, 'default_view'>;
export type FlagDial = 'section_cut' | 'show_temps' | 'motion' | 'walk_guard' | 'floor_reflections' | 'reflections_auto';

/** The installation-only dials: content and display choices a person never overrides (services/plan_view.py USER_DIALS). */
export const PLAN_VIEW_SITE_ONLY: readonly SiteDial[] = ['furniture', 'textures', 'floor_finish', 'wall_display', 'kiosk_idle_s'];
export const PLAN_VIEW_FLAGS: readonly FlagDial[] = ['section_cut', 'show_temps', 'motion', 'walk_guard', 'floor_reflections', 'reflections_auto'];
/** The dials in the order the card shows them. */
export const PLAN_VIEW_CARD_DIALS: readonly (keyof PlanViewDials)[] = ['style', 'backdrop', 'default_view', 'furniture', 'textures', 'floor_finish', 'wall_cut', 'floor_reflections', 'reflections_auto', 'section_cut', 'show_temps', 'motion',
  'room_marks', 'light_mark', 'alarm_motion', 'time_source', 'light_mood', 'eye_m', 'mouse_mode', 'walk_guard', 'quality', 'dpr_cap', 'wall_display', 'kiosk_idle_s'];

/** One line under each dial, in plain words (the settings screen is the only place that explains). Written in Hebrew and read
 * through `tr()` (CR-UI-POLISH-2443: English in i18n/msg/plan-view-card.ts). */
export const HINT_HE: Record<keyof PlanViewDials, string> = {
  style: tr('אוטומטי: בהיר עם ערכת נושא בהירה, כהה עם כהה'),
  default_view: tr('במה נפתחת התצוגה התלת־ממדית: סכמטי לכולם, ריאליסטי - בחירה אישית בדפדפן הזה'),
  furniture: tr('דגמים: ריהוט מפורט מהספרייה; גאומטרי: צורות פשוטות (קל יותר למחשב)'),
  textures: tr('קבצי חומרים: טקסטורות אמיתיות; גאומטרי: גוון אחיד לכל חומר'),
  wall_display: tr('מסך קיר מציג תלת־ממד חי או תמונות מוכנות (חוסך חום וסוללה)'),
  time_source: tr('לפי שעון האתר השמש זזה עם היום; ידני: בוחרים שעה בסרגל'),
  mouse_mode: tr('איך מסובבים את המבט בסיור: גרירה, נעילת סמן, או אוטומטי לפי המסך'),
  quality: tr('אוטומטי יורד בדרגה כשהמחשב מתקשה; דרגה קבועה נשארת'),
  kiosk_idle_s: tr('אחרי כמה זמן בלי שינוי מסך הקיר עובר לתמונה מוכנה'),
  eye_m: tr('גובה העין בסיור בגובה עין'),
  dpr_cap: tr('כמה פיקסלים לכל נקודת מסך לכל היותר; נמוך יותר = מהיר יותר'),
  section_cut: tr('במבט מלמעלה הקירות נחתכים כדי לראות פנימה'),
  show_temps: tr('טמפרטורת החדר על הרצפה כשיש חיישן'),
  motion: tr('דלתות נפתחות, אור משתנה ותנועת מצלמה'),
  walk_guard: tr('כשהסיור רץ לאט, האיכות יורדת דרגה עד סוף הסיור'),
  backdrop: tr('בתצוגה הריאליסטית: שמיים לפי השעה, או רקע כהה בהדרגה בלי קו אופק (מראה של הדמיה אדריכלית)'),
  floor_finish: tr('בתצוגה הריאליסטית: ממה עשויה רצפת חדרי המגורים - שיש קלקטה מלוטש, קרמיקה יוקרתית, טרוורטין או פרקט עץ (חדרים רטובים, חניה וגינה נשארים כפי שהם)'),
  floor_reflections: tr('בתצוגה הריאליסטית: הרהיטים והחלונות משתקפים בשיש ובקרמיקה המבריקים; כיבוי חוסך מעט עבודה למחשב'),
  // PLAN3D-R32-ANSWERS-2438 (owner round 32, the 3D map)
  wall_cut: tr('במבט מלמעלה: קירות נמוכים מראים את כל החדרים מכל זווית, וראשי הקירות נושאים את סימון מצב החדר'),
  reflections_auto: tr('במכשיר חלש, וכשהתמונה מתחילה להאט, ההשתקפות ברצפה נכבית ראשונה; סימוני מצב החדר לא יורדים אף פעם'),
  room_marks: tr('נוכחות ואזעקה: פס צבע על ראש הקיר ופס דק לאורך הקירות ברצפה, או צביעת הרצפה כמו קודם'),
  light_mark: tr('ביום כמעט לא רואים שהמנורה דולקת: פס ענבר דק על ראש הקיר מסמן חדר עם אור דולק'),
  alarm_motion: tr('חדר באזעקה מסומן באדום. למי שביקש במכשיר שלו פחות תנועה האדום קבוע בכל מקרה'),
  light_mood: tr('אוטומטי: יום, ערב חם ולילה לפי השעה באתר; נעילה שומרת מראה קבוע (מסך קיר, מוקד)'),
};
export const KIOSK_HE: Record<number, string> = { 0: tr('לעולם לא'), 10: tr('10 שניות'), 30: tr('30 שניות'), 120: tr('2 דקות'), 600: tr('10 דקות') };

/**
 * PLAN3D-R32-ANSWERS-2438 (owner round 32): the round 28 settings of the 3D map (product settings `map.*`, routers/settings.py) move
 * into the one "מפה תלת־ממדית" card with the look dials - installation values, saved with the card's button. The first option of
 * each row is the owner's answer (the default); the server holds the same defaults.
 */
export type Map3dKey = 'map.room_pills' | 'map.room_pill_tap' | 'map.room_pill_quiet' | 'map.room_card_place' | 'map.room_card_confirm' | 'map.room_card_camera' | 'map.stack_backdrop' | 'map.stack_pick';
export interface Map3dRow {
  key: Map3dKey;
  he: string;
  hint: string;
  /** [value, Hebrew]; the first is the default. */
  options: readonly (readonly [string, string])[];
  group: 'labels' | 'stack';
}
export const MAP3D_ROWS: readonly Map3dRow[] = [
  { key: 'map.room_pills', group: 'labels', he: tr('תוויות על המפה'), hint: tr('תווית אחת לכל חדר מסכמת מה פתוח, נוכחות, אורות וטמפרטורה; בהתקרבות לחדר כל התקן מופיע לחוד'), options: [['room', tr('תווית לכל חדר, התקנים בהתקרבות')], ['room_always', tr('תווית לכל חדר תמיד')], ['device', tr('תווית לכל התקן')]] },
  { key: 'map.room_pill_tap', group: 'labels', he: tr('נגיעה בתווית של חדר'), hint: tr('חלון פירוט קטן, וממנו ממשיכים לכרטיס החדר'), options: [['popover', tr('חלון פירוט קטן, ממנו לכרטיס')], ['card', tr('ישר לכרטיס החדר')]] },
  { key: 'map.room_pill_quiet', group: 'labels', he: tr('חדר שאין בו מה לדווח'), hint: tr('הכול סגור וכבוי ואין טמפרטורה'), options: [['name', tr('רק שם החדר')], ['hide', tr('לא להציג כלום')], ['bubble', tr('תווית "הכול סגור"')]] },
  { key: 'map.room_card_place', group: 'labels', he: tr('מיקום כרטיס החדר'), hint: tr('במחשב ובטאבלט: פאנל בצד והחדר זז למרכז השטח שנשאר; בטלפון הכרטיס הוא תמיד גיליון שעולה מלמטה'), options: [['side', tr('פאנל בצד')], ['float', tr('כרטיס צף בפינה')], ['sheet_tablet', tr('מחשב: פאנל, טאבלט: גיליון')]] },
  { key: 'map.room_card_confirm', group: 'labels', he: tr('אישור לפני פעולה בכרטיס החדר'), hint: tr('דלתות, שערים ואזעקה דורשים אישור תמיד, כמו בשאר המערכת'), options: [['system', tr('דלתות, שערים ואזעקה')], ['bulk', tr('גם "כבה הכול" וסגירת תריסים')]] },
  { key: 'map.room_card_camera', group: 'labels', he: tr('המצלמה בכרטיס החדר'), hint: tr('וידאו חי מתחיל מיד כשהכרטיס נפתח (בזרם המשני) ונעצר כשהוא נסגר'), options: [['live', tr('וידאו חי מיד')], ['snapshot', tr('תמונה מתעדכנת, וידאו בלחיצה')], ['none', tr('בלי מצלמה')]] },
  { key: 'map.stack_backdrop', group: 'stack', he: tr('רקע בתצוגת כל הקומות'), hint: tr('לפי מצב בהיר / כהה והשעה, כמו קומה אחת; או נעול למראה בהיר או כהה קבוע'), options: [['theme', tr('לפי המצב והשעה')], ['light', tr('תמיד בהיר')], ['dark', tr('תמיד כהה')]] },
  { key: 'map.stack_pick', group: 'stack', he: tr('בחירת קומה בתצוגת כל הקומות'), hint: tr('נגיעה ראשונה מגדילה את הקומה ומראה את החדרים שלה, נגיעה שנייה נכנסת'), options: [['two_tap', tr('נגיעה מגדילה, שנייה נכנסת')], ['one_tap', tr('נגיעה אחת נכנסת')]] },
];
