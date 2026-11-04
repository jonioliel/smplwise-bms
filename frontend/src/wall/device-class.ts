/**
 * CR-030 section 3.2.1: the device class of this browser - `tablet`, `phone` or `desktop` - from signals of the physical
 * device, never from the viewport (an on-screen keyboard, split screen and rotation change the viewport, not these).
 *
 * Presentation only, NOT a security control: the server never looks at the result. A wrong answer is cosmetic (the normal
 * limited application instead of the wall display, or the reverse), never a change of permissions.
 *
 * WALL-FOLLOWUPS-2390 (display D5): two follow-ups of the rule.
 * - Foldables. The inner screen of an unfolded book-style foldable (Galaxy Z Fold 3-5: 673x841 / 690x829 CSS px) is a small
 *   tablet, yet its browser keeps the "Mobile" token, so the "under 700 with a Mobile token is a phone" band classified it as a
 *   phone. No phone has a short side of 600 px or more: what sits in that band is an unfolded foldable (near-square, long / short
 *   under 1.4) or a 7 inch tablet that sends a phone user agent (tall, 600x960 = 1.6). The band now keeps only the tall shape;
 *   a near-square screen, or a window spread over two viewport segments, is a tablet. The folded cover screen (344-412 px short)
 *   stays a phone by the 600 rule.
 * - Fold / unfold changes the physical screen while the page lives on, so the class is re-read on every screen change
 *   (`watchDeviceClass`), not only on load: the shell swaps between the wall display and the application at once.
 * - "Wall mode on desktop": a wall profile may also take over a desktop-class browser (a mini-PC behind a wall monitor),
 *   switched on per profile by the administrator (`me.wall.desktop`). Phones never get the wall.
 *
 * WALL-ANSWERS-2400 (owner 04.11, round 18 question 18 = א + a setting): the unfolded foldable stays a tablet by default, and an
 * administrator may switch the installation to "an open foldable is a phone" (Settings > wall displays, `me.wall.foldable_open`).
 * Only the open-foldable case moves; every other device keeps its class whatever the setting says.
 */
export type DeviceClass = 'tablet' | 'phone' | 'desktop';

export interface DeviceEnv {
  /** `navigator.maxTouchPoints` */
  maxTouchPoints: number;
  /** `matchMedia('(pointer: coarse)')` - the PRIMARY pointer is a finger */
  coarsePointer: boolean;
  /** `matchMedia('(hover: none)')` */
  hoverNone: boolean;
  /** `screen.width` / `screen.height` in CSS pixels: the physical screen, orientation independent */
  screenWidth: number;
  screenHeight: number;
  /** `navigator.userAgentData?.mobile` when present, else the `Mobi|iPhone|iPod` test on the user agent */
  mobileUA: boolean;
  /** Viewport Segments API: 2 when the window spans the hinge of a foldable / dual-screen device (absent = 1) */
  segments?: number;
}

/** The short side (CSS px) from which a touch device is a tablet (7 inch and up), and the larger bound that applies when the UA says "Mobile". */
export const TABLET_MIN_SHORT = 600;
export const TABLET_MIN_SHORT_MOBILE_UA = 700;
/** long / short under this is a near-square screen: the inner screen of an unfolded foldable (1.07-1.25), never a phone (1.8 and up). */
export const FOLDABLE_MAX_ASPECT = 1.4;

/** How an UNFOLDED foldable is classified (installation setting `wall.foldable_open`): a small tablet (default) or a phone. */
export type FoldableOpen = 'tablet' | 'phone';
export const FOLDABLE_OPEN_DEFAULT: FoldableOpen = 'tablet';

export interface ClassifyOptions {
  foldableOpen?: FoldableOpen;
}

/** The largest short side (CSS px) an unfolded foldable's inner screen has (Galaxy Z Fold 3-7, Pixel Fold / 9 Pro Fold: 673-~790). */
export const FOLDABLE_MAX_SHORT = 900;

/**
 * An unfolded foldable: a touch screen of tablet size (short side >= 600) that is either spread over a hinge (two viewport
 * segments) or carries a phone ("Mobile") user agent on a near-square screen (long / short under 1.4, short side under 900:
 * the inner screens of the Galaxy Z Fold 3-7, Pixel Fold, Pixel 9 Pro Fold). Tablets do not send the Mobile token (iPads send a
 * Mac UA, Android tablets drop it), and a 7 inch tablet that does is tall (1.6), so neither is one.
 */
export function isOpenFoldable(env: DeviceEnv): boolean {
  const touch = env.maxTouchPoints > 0 && (env.coarsePointer || env.hoverNone);
  if (!touch) return false;
  const short = Math.min(env.screenWidth, env.screenHeight);
  const long = Math.max(env.screenWidth, env.screenHeight);
  if (short < TABLET_MIN_SHORT) return false;
  if ((env.segments ?? 1) > 1) return true;
  return env.mobileUA && short < FOLDABLE_MAX_SHORT && long / short < FOLDABLE_MAX_ASPECT;
}

export function classifyDevice(env: DeviceEnv, opts: ClassifyOptions = {}): DeviceClass {
  const touch = env.maxTouchPoints > 0 && (env.coarsePointer || env.hoverNone);
  if (!touch) return 'desktop';
  const short = Math.min(env.screenWidth, env.screenHeight);
  const long = Math.max(env.screenWidth, env.screenHeight);
  if (short < TABLET_MIN_SHORT) return 'phone'; // a phone, a folded foldable's cover screen
  if (isOpenFoldable(env)) return opts.foldableOpen === 'phone' ? 'phone' : 'tablet'; // spread over the hinge, or a near-square inner screen
  if (env.mobileUA && short < TABLET_MIN_SHORT_MOBILE_UA && long / short >= FOLDABLE_MAX_ASPECT) return 'phone'; // a tall screen with a phone UA
  return 'tablet'; // touch, short >= 600 (7" and up)
}

export function readDeviceEnv(): DeviceEnv {
  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  const mq = (q: string): boolean => {
    try {
      return window.matchMedia(q).matches;
    } catch {
      return false;
    }
  };
  const uaMobile = typeof nav.userAgentData?.mobile === 'boolean' ? nav.userAgentData.mobile : /Mobi|iPhone|iPod/.test(nav.userAgent ?? '');
  return {
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    coarsePointer: mq('(pointer: coarse)'),
    hoverNone: mq('(hover: none)'),
    screenWidth: window.screen?.width ?? window.innerWidth,
    screenHeight: window.screen?.height ?? window.innerHeight,
    mobileUA: uaMobile,
    segments: mq('(horizontal-viewport-segments: 2)') || mq('(vertical-viewport-segments: 2)') ? 2 : 1,
  };
}

export interface WallMe {
  wall?: { enabled?: boolean; desktop?: boolean; foldable_open?: FoldableOpen } | null;
}

/** The classification options a signed-in user's `/me` carries (the installation's foldable setting; anything unknown = the default). */
export function classifyOptionsFor(me: WallMe | null | undefined): ClassifyOptions {
  return { foldableOpen: me?.wall?.foldable_open === 'phone' ? 'phone' : FOLDABLE_OPEN_DEFAULT };
}

/** The wall interface is mounted for an enabled wall profile on a tablet, and on a desktop when the profile allows it; never on a phone. */
export function wallModeFor(me: WallMe | null | undefined, cls: DeviceClass): boolean {
  if (!me?.wall?.enabled) return false;
  if (cls === 'tablet') return true;
  return cls === 'desktop' && me.wall.desktop === true;
}

/** The part of the environment that can change while the page lives (a fold / unfold, a hinge span, a pointer docked). */
export function envKey(env: DeviceEnv): string {
  return [classifyDevice(env), env.screenWidth, env.screenHeight, env.segments ?? 1].join(':');
}

/** How long the screen must stay unchanged after a resize before the class is read again (a fold animates through odd sizes). */
export const SETTLE_MS = 250;

/**
 * Call `onChange` with the new environment whenever the physical screen changes (fold / unfold, the hinge span, a
 * different display) - debounced, so the transient sizes of a fold animation never flip the shell twice. A resize that
 * leaves the screen alone (the on-screen keyboard, split screen, a window drag on a desktop) is not a change.
 * Returns the unsubscribe function.
 */
export function watchDeviceClass(onChange: (env: DeviceEnv) => void, read: () => DeviceEnv = readDeviceEnv): () => void {
  let last = envKey(read());
  let timer = 0;
  const check = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      const env = read();
      const key = envKey(env);
      if (key === last) return;
      last = key;
      onChange(env);
    }, SETTLE_MS);
  };
  const posture = (navigator as Navigator & { devicePosture?: EventTarget }).devicePosture;
  const orient = window.screen?.orientation as (ScreenOrientation & EventTarget) | undefined;
  window.addEventListener('resize', check);
  window.addEventListener('orientationchange', check);
  posture?.addEventListener?.('change', check);
  orient?.addEventListener?.('change', check);
  return () => {
    window.clearTimeout(timer);
    window.removeEventListener('resize', check);
    window.removeEventListener('orientationchange', check);
    posture?.removeEventListener?.('change', check);
    orient?.removeEventListener?.('change', check);
  };
}
