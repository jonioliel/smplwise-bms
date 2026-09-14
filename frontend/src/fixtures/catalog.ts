import type { StateKind } from '../components/sw-badge';
import type { SceneKind } from '../components/sw-camera-tile';

// Synthetic, clearly labelled demo data for the screen skeletons. Names are generic; nothing here comes
// from the customer's site, no stream is connected and every timestamp is fictional.

export interface DemoSite {
  id: string;
  name: string;
  address: string;
  buildings: number;
  cameras: number;
  online: number;
  alerts: number;
  health: StateKind;
}

export const demoSites: DemoSite[] = [
  { id: 'site-a', name: 'אתר הדגמה', address: 'רחוב הדוגמה 1', buildings: 2, cameras: 10, online: 9, alerts: 2, health: 'stale' },
  { id: 'site-b', name: 'סניף צפון', address: 'שדרות הדגמה 20', buildings: 1, cameras: 6, online: 6, alerts: 0, health: 'live' },
  { id: 'site-c', name: 'מחסן לוגיסטי', address: 'אזור תעשייה', buildings: 1, cameras: 4, online: 3, alerts: 1, health: 'offline' },
];

export interface DemoBuilding {
  id: string;
  siteId: string;
  name: string;
  floors: { id: string; name: string; cameras: number; entities: number; hasPlan: boolean }[];
}

export const demoBuildings: DemoBuilding[] = [
  {
    id: 'bld-a',
    siteId: 'site-a',
    name: 'מבנה א',
    floors: [
      { id: 'f0', name: 'קומה 0', cameras: 6, entities: 4, hasPlan: true },
      { id: 'f-1', name: 'קומה 1-', cameras: 3, entities: 1, hasPlan: true },
      { id: 'f-2', name: 'קומה 2-', cameras: 2, entities: 0, hasPlan: false },
    ],
  },
  { id: 'bld-b', siteId: 'site-a', name: 'מבנה ב', floors: [{ id: 'b-f0', name: 'קרקע', cameras: 1, entities: 2, hasPlan: false }] },
];

export interface DemoWallCamera {
  id: string;
  name: string;
  floor: string;
  state: StateKind;
  stream: 'main' | 'sub';
  fps: number | null;
  bitrateKbps: number | null;
  firmware: string;
  lastEvent: string;
  recording: 'continuous' | 'motion' | 'off' | 'unknown';
  ptz: boolean;
  audio: boolean;
}

export const demoWall: DemoWallCamera[] = [
  { id: 'cam-1', name: 'כניסה ראשית', floor: 'קומה 0', state: 'live', stream: 'sub', fps: 25, bitrateKbps: 3072, firmware: 'V5.8.10', lastEvent: 'לפני 2 דק׳', recording: 'continuous', ptz: false, audio: false },
  { id: 'cam-2', name: 'לובי', floor: 'קומה 0', state: 'live', stream: 'sub', fps: 25, bitrateKbps: 3072, firmware: 'V5.8.10', lastEvent: 'לפני 5 דק׳', recording: 'motion', ptz: false, audio: true },
  { id: 'cam-3', name: 'מסדרון מזרחי', floor: 'קומה 0', state: 'offline', stream: 'sub', fps: null, bitrateKbps: null, firmware: 'V5.8.10', lastEvent: 'לפני שעה', recording: 'unknown', ptz: false, audio: false },
  { id: 'cam-4', name: 'אולם', floor: 'קומה 0', state: 'live', stream: 'main', fps: 25, bitrateKbps: 5120, firmware: 'V5.8.10', lastEvent: 'לפני 12 דק׳', recording: 'continuous', ptz: true, audio: false },
  { id: 'cam-5', name: 'חדר מדרגות', floor: 'קומה 0', state: 'stale', stream: 'sub', fps: 20, bitrateKbps: 2048, firmware: 'V5.8.9', lastEvent: 'לפני 40 דק׳', recording: 'continuous', ptz: false, audio: false },
  { id: 'cam-6', name: 'חניה מקורה', floor: 'קומה 0', state: 'forbidden', stream: 'sub', fps: null, bitrateKbps: null, firmware: '—', lastEvent: '—', recording: 'unknown', ptz: false, audio: false },
  { id: 'cam-7', name: 'מחסן', floor: 'קומה 1-', state: 'live', stream: 'sub', fps: 25, bitrateKbps: 3072, firmware: 'V5.8.10', lastEvent: 'לפני 3 שעות', recording: 'motion', ptz: false, audio: false },
  { id: 'cam-8', name: 'חדר מכונות', floor: 'קומה 1-', state: 'live', stream: 'sub', fps: 25, bitrateKbps: 3072, firmware: 'V5.8.10', lastEvent: 'אתמול', recording: 'continuous', ptz: false, audio: false },
  { id: 'cam-9', name: 'מקלט', floor: 'קומה 1-', state: 'offline', stream: 'sub', fps: null, bitrateKbps: null, firmware: 'V5.8.10', lastEvent: 'לפני יומיים', recording: 'unknown', ptz: false, audio: false },
  { id: 'cam-10', name: 'חצר אחורית', floor: 'חוץ', state: 'live', stream: 'sub', fps: 25, bitrateKbps: 4096, firmware: 'V5.8.10', lastEvent: 'לפני 8 דק׳', recording: 'continuous', ptz: true, audio: true },
];

/** Illustrative scene per camera for the placeholder tiles (never a real frame; tiles say "דמו"). */
export const demoScene: Record<string, SceneKind> = {
  'cam-1': 'outdoor',
  'cam-2': 'indoor',
  'cam-3': 'indoor',
  'cam-4': 'indoor',
  'cam-5': 'garage',
  'cam-6': 'garage',
  'cam-7': 'garage',
  'cam-8': 'garage',
  'cam-9': 'night',
  'cam-10': 'night',
};

export type EventType = 'person' | 'vehicle' | 'motion' | 'line' | 'offline' | 'door';

export interface DemoEvent {
  id: string;
  time: string; // display string (fixture)
  minuteOfDay: number;
  type: EventType;
  title: string;
  camera: string;
  floor: string;
  source: 'NVR' | 'HA';
  acked: boolean;
  severity: 'info' | 'alert' | 'critical';
}

export const eventTypeLabel: Record<EventType, string> = {
  person: 'זיהוי אדם',
  vehicle: 'זיהוי רכב',
  motion: 'תנועה',
  line: 'חציית קו',
  offline: 'מצלמה מנותקת',
  door: 'דלת נפתחה',
};

export const demoEvents: DemoEvent[] = [
  { id: 'ev-1', time: 'היום 10:14', minuteOfDay: 614, type: 'person', title: 'אדם זוהה', camera: 'כניסה ראשית', floor: 'קומה 0', source: 'NVR', acked: false, severity: 'alert' },
  { id: 'ev-2', time: 'היום 09:42', minuteOfDay: 582, type: 'vehicle', title: 'רכב זוהה', camera: 'חצר אחורית', floor: 'חוץ', source: 'NVR', acked: false, severity: 'info' },
  { id: 'ev-3', time: 'היום 08:31', minuteOfDay: 511, type: 'motion', title: 'תנועה', camera: 'מחסן', floor: 'קומה 1-', source: 'NVR', acked: true, severity: 'info' },
  { id: 'ev-4', time: 'היום 08:12', minuteOfDay: 492, type: 'door', title: 'דלת כניסה נפתחה', camera: 'כניסה ראשית', floor: 'קומה 0', source: 'HA', acked: true, severity: 'info' },
  { id: 'ev-5', time: 'היום 07:55', minuteOfDay: 475, type: 'offline', title: 'מסדרון מזרחי מנותק', camera: 'מסדרון מזרחי', floor: 'קומה 0', source: 'NVR', acked: false, severity: 'critical' },
  { id: 'ev-6', time: 'היום 06:43', minuteOfDay: 403, type: 'line', title: 'חציית קו', camera: 'חניה מקורה', floor: 'קומה 0', source: 'NVR', acked: true, severity: 'alert' },
  { id: 'ev-7', time: 'אתמול 23:10', minuteOfDay: 1390, type: 'person', title: 'אדם זוהה', camera: 'לובי', floor: 'קומה 0', source: 'NVR', acked: true, severity: 'info' },
];

export interface DemoSegment {
  startMin: number; // minutes since 00:00 of the fixture day
  endMin: number;
  kind: 'continuous' | 'motion';
}

/** Recording coverage for one fixture day: continuous blocks with a deliberate gap and motion clips. */
export const demoSegments: DemoSegment[] = [
  { startMin: 0, endMin: 190, kind: 'continuous' },
  { startMin: 205, endMin: 460, kind: 'continuous' },
  { startMin: 470, endMin: 474, kind: 'motion' },
  { startMin: 480, endMin: 486, kind: 'motion' },
  { startMin: 492, endMin: 640, kind: 'continuous' },
  { startMin: 660, endMin: 1439, kind: 'continuous' },
];

export interface DemoUser {
  id: string;
  name: string;
  haUser: string;
  active: boolean;
  lastSync: string;
  groups: string[];
  bindings: { role: string; scope: string }[];
  haAdmin: boolean;
}

export const demoUsers: DemoUser[] = [
  { id: 'u-1', name: 'יוני', haUser: 'joni', active: true, lastSync: 'לפני 20 שנ׳', groups: ['מנהלי מערכת'], bindings: [{ role: 'מנהל מערכת VMS', scope: 'כל ההתקנה' }], haAdmin: true },
  { id: 'u-2', name: 'דנה', haUser: 'dana', active: true, lastSync: 'לפני 20 שנ׳', groups: ['עורכי קומה 2'], bindings: [{ role: 'עורך מפות', scope: 'מבנה א · קומה 2' }], haAdmin: false },
  { id: 'u-3', name: 'יוסי', haUser: 'yossi', active: true, lastSync: 'לפני 20 שנ׳', groups: ['מנהלי מבנה א'], bindings: [{ role: 'מנהל אתר/מבנה', scope: 'מבנה א' }], haAdmin: false },
  { id: 'u-4', name: 'codex', haUser: 'codex', active: true, lastSync: 'לפני 20 שנ׳', groups: [], bindings: [], haAdmin: false },
  { id: 'u-5', name: 'רון', haUser: 'ron', active: false, lastSync: 'לפני 3 ימים', groups: ['צופים'], bindings: [{ role: 'צופה', scope: 'אתר הדגמה' }], haAdmin: false },
];

export const demoGroups = [
  { id: 'g-1', name: 'מנהלי מערכת', members: 1, bindings: ['מנהל מערכת VMS · כל ההתקנה'] },
  { id: 'g-2', name: 'עורכי קומה 2', members: 1, bindings: ['עורך מפות · מבנה א · קומה 2'] },
  { id: 'g-3', name: 'מנהלי מבנה א', members: 1, bindings: ['מנהל אתר/מבנה · מבנה א'] },
  { id: 'g-4', name: 'צופים', members: 1, bindings: ['צופה · אתר הדגמה'] },
];

export const demoRoles = [
  { id: 'viewer', name: 'צופה', allowed: 'מפה, מצב ישויות מורשה, שידור חי', denied: 'היסטוריה, עריכה, ייצוא, שליטה' },
  { id: 'operator', name: 'מפעיל', allowed: 'צפייה, Playback, סקירת אירועים וסימון טיפול', denied: 'עריכת מפות, תפקידים, ייצוא, פעולות פיזיות' },
  { id: 'editor', name: 'עורך מפות ותצוגות', allowed: 'צפייה, יבוא/עריכה/פרסום מפות, מיקומים ותצוגות', denied: 'Playback, ייצוא, משתמשים, סודות, שליטה' },
  { id: 'site_admin', name: 'מנהל אתר / מבנה / קומה', allowed: 'מפעיל + עורך, הגדרות תוכן מקומיות', denied: 'הגדרות מערכת, תפקידים, סודות, כתיבה ל־NVR' },
  { id: 'system_admin', name: 'מנהל מערכת VMS', allowed: 'הגדרות מוצר, מקורות, מדיניות, קבוצות ושיוכים', denied: 'ניהול HA, שליטה פיזית, ייצוא ראיות ללא grant' },
];

export const demoAudit = [
  { time: '10:24', user: 'יוני', action: 'צפייה חיה', resource: 'כניסה ראשית', decision: 'הותר', role: 'מנהל מערכת · כל ההתקנה' },
  { time: '10:18', user: 'דנה', action: 'פרסום תוכנית', resource: 'מבנה א · קומה 2', decision: 'הותר', role: 'עורך מפות · קומה 2' },
  { time: '10:11', user: 'דנה', action: 'עריכת תוכנית', resource: 'מבנה א · קומה 3', decision: 'נחסם: מחוץ להיקף', role: 'עורך מפות · קומה 2' },
  { time: '09:55', user: 'יוסי', action: 'ייצוא קטע', resource: 'לובי 09:10–09:20', decision: 'נחסם: אין הרשאת ייצוא', role: 'מנהל מבנה · מבנה א' },
  { time: '09:43', user: 'codex', action: 'כניסה דרך Ingress', resource: '—', decision: 'הותר, ללא שיוך', role: '—' },
  { time: '09:30', user: 'יוני', action: 'הפעלת תאורה', resource: 'light.lobby', decision: 'הותר (HA אישר)', role: 'מנהל מערכת' },
  { time: '08:12', user: 'מערכת', action: 'סנכרון משתמשים', resource: 'HA bridge', decision: '5 משתמשים, 0 שינויים', role: '—' },
];

export const demoJobs = [
  { id: 'job-1', title: 'ייצוא: כניסה ראשית 09:10–09:25', status: 'הושלם', progress: 100, size: '182 MB', hash: 'sha256 ✓' },
  { id: 'job-2', title: 'ייצוא: לובי 23:00–23:40', status: 'בתהליך', progress: 62, size: '—', hash: '—' },
  { id: 'job-3', title: 'תמונות מקדימות: קומה 0', status: 'ממתין', progress: 0, size: '—', hash: '—' },
  { id: 'job-4', title: 'ייצוא: חצר אחורית 02:00–04:00', status: 'נכשל: פער בהקלטה', progress: 35, size: '—', hash: '—' },
];

export const demoCases = [
  { id: 'case-1', title: 'כניסה לא מורשית — 13.09', status: 'פתוח', owner: 'יוני', clips: 3, notes: 2, preserved: 2, missing: 1 },
  { id: 'case-2', title: 'נזק לרכב בחניה', status: 'בבדיקה', owner: 'יוסי', clips: 2, notes: 1, preserved: 2, missing: 0 },
  { id: 'case-3', title: 'דלת מקלט פתוחה בלילה', status: 'סגור', owner: 'יוני', clips: 1, notes: 3, preserved: 1, missing: 0 },
];

export const demoRules = [
  { id: 'r-1', name: 'אדם בלילה', trigger: 'זיהוי אדם', scope: 'חוץ · 22:00–06:00', action: 'התראה + פתיחת מצלמות', enabled: true, last: 'אתמול 23:10' },
  { id: 'r-2', name: 'רכב באזור מוגבל', trigger: 'זיהוי רכב', scope: 'חניה מקורה', action: 'התראה', enabled: true, last: 'היום 09:42' },
  { id: 'r-3', name: 'דלת נשארה פתוחה', trigger: 'דלת > 60 שנ׳', scope: 'כל הדלתות', action: 'התראה + הקלטה', enabled: true, last: '—' },
  { id: 'r-4', name: 'מצלמה מנותקת', trigger: 'ניתוק', scope: 'כל האתר', action: 'התראה מיידית', enabled: false, last: 'היום 07:55' },
];

export const demoHealth = [
  { name: 'NVR (הקלטה)', state: 'live' as StateKind, detail: '10/10 ערוצים, דיסק תקין' },
  { name: 'go2rtc (מדיה)', state: 'live' as StateKind, detail: 'גרסה ‎1.9.x‎ · 4 זרמים פעילים' },
  { name: 'גשר Home Assistant', state: 'stale' as StateKind, detail: 'סנכרון אחרון לפני 4 דק׳' },
  { name: 'מסד נתונים', state: 'live' as StateKind, detail: 'WAL · גיבוי אחרון אתמול 02:00' },
  { name: 'תור עבודות', state: 'partial' as StateKind, detail: '1 בתהליך · 1 נכשל' },
];
