/**
 * CR-029 ST7 UI: the dial lists and the Hebrew hints of the realistic-3D settings card (system-plan-view.ts), kept apart from
 * the Lit element so the node unit spec (tests/unit-studio6-ui.spec.ts) reads them without a DOM. The dial names (DIAL_HE) and
 * the choice names (CHOICE_HE) live with the API in api/plan-view.ts, where the 3D view reads them too.
 */
import type { PlanViewDials } from '../api/plan-view';

export type SiteDial = Exclude<keyof PlanViewDials, 'default_view'>;
export type FlagDial = 'section_cut' | 'show_temps' | 'motion' | 'walk_guard' | 'floor_reflections' | 'reflections_auto';

/** The installation-only dials: content and display choices a person never overrides (services/plan_view.py USER_DIALS). */
export const PLAN_VIEW_SITE_ONLY: readonly SiteDial[] = ['furniture', 'textures', 'floor_finish', 'wall_display', 'kiosk_idle_s'];
export const PLAN_VIEW_FLAGS: readonly FlagDial[] = ['section_cut', 'show_temps', 'motion', 'walk_guard', 'floor_reflections', 'reflections_auto'];
/** The dials in the order the card shows them. */
export const PLAN_VIEW_CARD_DIALS: readonly (keyof PlanViewDials)[] = ['style', 'backdrop', 'default_view', 'furniture', 'textures', 'floor_finish', 'wall_cut', 'floor_reflections', 'reflections_auto', 'section_cut', 'show_temps', 'motion',
  'room_marks', 'light_mark', 'alarm_motion', 'time_source', 'light_mood', 'eye_m', 'mouse_mode', 'walk_guard', 'quality', 'dpr_cap', 'wall_display', 'kiosk_idle_s'];

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
  backdrop: 'בתצוגה הריאליסטית: שמיים לפי השעה, או רקע כהה בהדרגה בלי קו אופק (מראה של הדמיה אדריכלית)',
  floor_finish: 'בתצוגה הריאליסטית: ממה עשויה רצפת חדרי המגורים - שיש קלקטה מלוטש, קרמיקה יוקרתית, טרוורטין או פרקט עץ (חדרים רטובים, חניה וגינה נשארים כפי שהם)',
  floor_reflections: 'בתצוגה הריאליסטית: הרהיטים והחלונות משתקפים בשיש ובקרמיקה המבריקים; כיבוי חוסך מעט עבודה למחשב',
  // PLAN3D-R32-ANSWERS-2438 (owner round 32, the 3D map)
  wall_cut: 'במבט מלמעלה: קירות נמוכים מראים את כל החדרים מכל זווית, וראשי הקירות נושאים את סימון מצב החדר',
  reflections_auto: 'במכשיר חלש, וכשהתמונה מתחילה להאט, ההשתקפות ברצפה נכבית ראשונה; סימוני מצב החדר לא יורדים אף פעם',
  room_marks: 'נוכחות ואזעקה: פס צבע על ראש הקיר ופס דק לאורך הקירות ברצפה, או צביעת הרצפה כמו קודם',
  light_mark: 'ביום כמעט לא רואים שהמנורה דולקת: פס ענבר דק על ראש הקיר מסמן חדר עם אור דולק',
  alarm_motion: 'חדר באזעקה מסומן באדום. למי שביקש במכשיר שלו פחות תנועה האדום קבוע בכל מקרה',
  light_mood: 'אוטומטי: יום, ערב חם ולילה לפי השעה באתר; נעילה שומרת מראה קבוע (מסך קיר, מוקד)',
};
export const KIOSK_HE: Record<number, string> = { 0: 'לעולם לא', 10: '10 שניות', 30: '30 שניות', 120: '2 דקות', 600: '10 דקות' };

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
  { key: 'map.room_pills', group: 'labels', he: 'תוויות על המפה', hint: 'תווית אחת לכל חדר מסכמת מה פתוח, נוכחות, אורות וטמפרטורה; בהתקרבות לחדר כל התקן מופיע לחוד', options: [['room', 'תווית לכל חדר, התקנים בהתקרבות'], ['room_always', 'תווית לכל חדר תמיד'], ['device', 'תווית לכל התקן']] },
  { key: 'map.room_pill_tap', group: 'labels', he: 'נגיעה בתווית של חדר', hint: 'חלון פירוט קטן, וממנו ממשיכים לכרטיס החדר', options: [['popover', 'חלון פירוט קטן, ממנו לכרטיס'], ['card', 'ישר לכרטיס החדר']] },
  { key: 'map.room_pill_quiet', group: 'labels', he: 'חדר שאין בו מה לדווח', hint: 'הכול סגור וכבוי ואין טמפרטורה', options: [['name', 'רק שם החדר'], ['hide', 'לא להציג כלום'], ['bubble', 'תווית "הכול סגור"']] },
  { key: 'map.room_card_place', group: 'labels', he: 'מיקום כרטיס החדר', hint: 'במחשב ובטאבלט: פאנל בצד והחדר זז למרכז השטח שנשאר; בטלפון הכרטיס הוא תמיד גיליון שעולה מלמטה', options: [['side', 'פאנל בצד'], ['float', 'כרטיס צף בפינה'], ['sheet_tablet', 'מחשב: פאנל, טאבלט: גיליון']] },
  { key: 'map.room_card_confirm', group: 'labels', he: 'אישור לפני פעולה בכרטיס החדר', hint: 'דלתות, שערים ואזעקה דורשים אישור תמיד, כמו בשאר המערכת', options: [['system', 'דלתות, שערים ואזעקה'], ['bulk', 'גם "כבה הכול" וסגירת תריסים']] },
  { key: 'map.room_card_camera', group: 'labels', he: 'המצלמה בכרטיס החדר', hint: 'וידאו חי מתחיל מיד כשהכרטיס נפתח (בזרם המשני) ונעצר כשהוא נסגר', options: [['live', 'וידאו חי מיד'], ['snapshot', 'תמונה מתעדכנת, וידאו בלחיצה'], ['none', 'בלי מצלמה']] },
  { key: 'map.stack_backdrop', group: 'stack', he: 'רקע בתצוגת כל הקומות', hint: 'לפי מצב בהיר / כהה והשעה, כמו קומה אחת; או נעול למראה בהיר או כהה קבוע', options: [['theme', 'לפי המצב והשעה'], ['light', 'תמיד בהיר'], ['dark', 'תמיד כהה']] },
  { key: 'map.stack_pick', group: 'stack', he: 'בחירת קומה בתצוגת כל הקומות', hint: 'נגיעה ראשונה מגדילה את הקומה ומראה את החדרים שלה, נגיעה שנייה נכנסת', options: [['two_tap', 'נגיעה מגדילה, שנייה נכנסת'], ['one_tap', 'נגיעה אחת נכנסת']] },
];
