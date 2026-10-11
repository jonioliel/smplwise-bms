/**
 * Plan Studio 6 look settings (CR-029 S0; backend services/plan_view.py, routers/plan_view.py): the installation's dials
 * (`plan.view` in /settings, system.configure) and a person's own override (GET / PUT /plan-view/prefs, map.read). The
 * 3D view applies `effective`. The same lists and defaults as the backend (tests/unit-plan-view-prefs.spec.ts compares
 * them with services/plan_view.py); the demo mode and a failed read use DEFAULT_VIEW.
 */
import { get, put } from './client';
import { isApi } from './session';

export type ViewStyle = 'auto' | 'light' | 'dark';
export type MouseMode = 'drag' | 'lock' | 'auto';
export type QualityRung = 'auto' | 'realistic' | 'lite' | 'full' | 'schematic';
export interface PlanViewDials {
  style: ViewStyle;
  default_view: 'schematic' | 'realistic';
  furniture: 'models' | 'procedural';
  textures: 'files' | 'procedural';
  wall_display: 'live' | 'stills';
  time_source: 'clock' | 'manual';
  mouse_mode: MouseMode;
  quality: QualityRung;
  kiosk_idle_s: 0 | 10 | 30 | 120 | 600;
  eye_m: number;
  dpr_cap: number;
  section_cut: boolean;
  show_temps: boolean;
  motion: boolean;
  /** The walk drops one rung for the session after it ran under 24 fps (CR-029 section 3.4); off: a hint only. */
  walk_guard: boolean;
}
export type PersonalDial = 'style' | 'default_view' | 'time_source' | 'mouse_mode' | 'quality' | 'eye_m' | 'dpr_cap' | 'section_cut' | 'show_temps' | 'motion' | 'walk_guard';
export const PERSONAL_DIALS: readonly PersonalDial[] = ['style', 'default_view', 'time_source', 'mouse_mode', 'quality', 'eye_m', 'dpr_cap', 'section_cut', 'show_temps', 'motion', 'walk_guard'];
export const CHOICES = {
  style: ['auto', 'light', 'dark'],
  default_view: ['schematic', 'realistic'],
  furniture: ['models', 'procedural'],
  textures: ['files', 'procedural'],
  wall_display: ['live', 'stills'],
  time_source: ['clock', 'manual'],
  mouse_mode: ['drag', 'lock', 'auto'],
  quality: ['auto', 'realistic', 'lite', 'full', 'schematic'],
  kiosk_idle_s: [0, 10, 30, 120, 600],
} as const;
export const RANGES = { eye_m: [1.2, 2.0, 0.05], dpr_cap: [1.0, 2.0, 0.25] } as const;
/** The owner's 2026-10-09 answers (services/plan_view.DEFAULT). */
export const DEFAULT_VIEW: PlanViewDials = {
  style: 'auto', default_view: 'schematic', furniture: 'models', textures: 'files', wall_display: 'live', time_source: 'clock', mouse_mode: 'drag', quality: 'auto',
  kiosk_idle_s: 30, eye_m: 1.65, dpr_cap: 1.25, section_cut: true, show_temps: false, motion: true, walk_guard: true,
};
/** The home's location as the server last read it from the home's configuration (services/site_location.py). */
export interface HomeLocation {
  latitude: number;
  longitude: number;
  elevation_m: number | null;
  time_zone: string | null;
  fetched_at: string | null;
}
/** Where the sun stands (read-only; owner 2026-10-11): `source` ha = the home's location, manual = the override an
 * administrator chose in Settings (`site.location_source`), default = the fallback 32.0 / 34.8. map/sun.ts resolveSite. */
export interface SiteLocation {
  latitude: number;
  longitude: number;
  elevation_m: number | null;
  time_zone: string;
  source: 'ha' | 'manual' | 'default';
  mode: 'home' | 'manual';
  home: HomeLocation | null;
}
export interface PlanViewPrefs {
  site: Omit<PlanViewDials, 'default_view'>;
  own: Partial<Pick<PlanViewDials, PersonalDial>>;
  effective: PlanViewDials;
  personal_dials: PersonalDial[];
  can_edit_site: boolean;
  /** Absent from an older server: the view then uses the fallback. */
  location?: SiteLocation;
}

/** The Hebrew names the settings screen and the 3D view show (one place, so both agree). */
export const DIAL_HE: Record<keyof PlanViewDials, string> = {
  style: 'סגנון חזותי', default_view: 'תצוגת ברירת מחדל', furniture: 'ריהוט', textures: 'טקסטורות', wall_display: 'מסך קיר', time_source: 'שעה ביום',
  mouse_mode: 'מבט בעכבר בסיור', quality: 'איכות', kiosk_idle_s: 'מעבר לתמונה מוכנה במסך קיר', eye_m: 'גובה עין', dpr_cap: 'חדות מרבית',
  section_cut: 'חיתוך קירות במבט מלמעלה', show_temps: 'טמפרטורות בחדרים', motion: 'אנימציות', walk_guard: 'הורדת איכות אוטומטית בסיור',
};
export const CHOICE_HE: Record<string, string> = {
  auto: 'אוטומטי', light: 'אדריכלי בהיר', dark: 'תאום דיגיטלי כהה', schematic: 'סכמטי', realistic: 'ריאליסטי', models: 'דגמים', procedural: 'גאומטרי',
  files: 'קבצי חומרים', live: 'תלת־ממד חי', stills: 'תמונות מוכנות', clock: 'לפי שעון האתר', manual: 'ידני', drag: 'גרירה', lock: 'נעילת סמן', lite: 'ריאליסטי קל', full: 'מלא',
};

let cache: PlanViewPrefs | null = null;

function demo(): PlanViewPrefs {
  const { default_view: _d, ...site } = DEFAULT_VIEW;
  return { site, own: {}, effective: { ...DEFAULT_VIEW }, personal_dials: [...PERSONAL_DIALS], can_edit_site: false };
}

/** The caller's dials (cached for the page; `force` reads again). A failed read answers the defaults, never an error. */
export async function planViewPrefs(force = false): Promise<PlanViewPrefs> {
  if (!isApi()) return (cache ??= demo());
  if (cache && !force) return cache;
  try {
    cache = await get<PlanViewPrefs>('plan-view/prefs');
  } catch {
    cache = demo();
  }
  return cache;
}

/** Set or reset (null) the caller's own dials; the answer replaces the cache. The demo mode keeps them for the page. */
export async function setPlanViewPrefs(patch: Partial<Record<PersonalDial, unknown>>): Promise<PlanViewPrefs> {
  if (!isApi()) {
    const cur = await planViewPrefs();
    const own = { ...cur.own } as Record<string, unknown>;
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) delete own[k];
      else own[k] = v;
    }
    cache = { ...cur, own: own as PlanViewPrefs['own'], effective: { ...DEFAULT_VIEW, ...cur.site, ...(own as Partial<PlanViewDials>) } };
    return cache;
  }
  cache = await put<PlanViewPrefs>('plan-view/prefs', { prefs: patch });
  return cache;
}

/** Snap a number dial to its step inside its range (what the server stores). */
export function snapDial(key: keyof typeof RANGES, v: number): number {
  const [lo, hi, step] = RANGES[key];
  const c = Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
  return Math.round((Math.round((c - lo) / step) * step + lo) * 100) / 100;
}
