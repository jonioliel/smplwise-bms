/**
 * CR-030 section 3.2.1: the device class of this browser - `tablet`, `phone` or `desktop` - from signals of the physical
 * device, never from the viewport (an on-screen keyboard, split screen and rotation change the viewport, not these).
 *
 * Presentation only, NOT a security control: the server never looks at the result. A wrong answer is cosmetic (the normal
 * limited application instead of the wall display, or the reverse), never a change of permissions.
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
}

/** The short side (CSS px) from which a touch device is a tablet (7 inch and up), and the larger bound that applies when the UA says "Mobile". */
export const TABLET_MIN_SHORT = 600;
export const TABLET_MIN_SHORT_MOBILE_UA = 700;

export function classifyDevice(env: DeviceEnv): DeviceClass {
  const touch = env.maxTouchPoints > 0 && (env.coarsePointer || env.hoverNone);
  if (!touch) return 'desktop';
  const short = Math.min(env.screenWidth, env.screenHeight);
  if (short < TABLET_MIN_SHORT) return 'phone';
  if (env.mobileUA && short < TABLET_MIN_SHORT_MOBILE_UA) return 'phone'; // a large phone, a folded foldable
  return 'tablet';
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
  };
}

/** The wall interface is mounted for an enabled wall profile on a tablet, nowhere else. */
export function wallModeFor(me: { wall?: { enabled?: boolean } | null } | null | undefined, cls: DeviceClass): boolean {
  return cls === 'tablet' && !!me?.wall?.enabled;
}
