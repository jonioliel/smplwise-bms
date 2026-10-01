import type { ReactiveController, ReactiveControllerHost } from 'lit';

/**
 * The one definition of "a phone" for behaviour that depends on it (mobile audit 2026-09-30): the viewport is narrower
 * than 768 px. CSS keeps using `@media (max-width: 767px)`; script uses this so every screen agrees, and follows a
 * rotation / resize live.
 *
 *   private readonly phone = new PhoneWidth(this);          // a Lit element: re-renders when the width crosses 768 px
 *   ... this.phone.matches ...                               // is it a phone right now
 *   ... this.phone.restricted('structure') ...               // is this kind of management hidden on this phone
 *   phoneRestricted('wall_arrange')                          // one-off checks (event handlers, plain functions)
 *
 * Mobile options (owner 2026-09-30, הגדרות › כללי › אפשרויות נייד, setting `ui.mobile`, installation-wide): each option asks
 * the phone UI to hide one kind of management. `phoneRestricted(kind)` is true only at phone width AND with the option on.
 *
 * This is a UX guard, NOT a security boundary: the server still enforces every permission on every write, and a wide
 * window (or a phone browser's desktop mode) reaches the same screens.
 */
export const PHONE_MAX_WIDTH_PX = 767;
export const PHONE_QUERY = `(max-width: ${PHONE_MAX_WIDTH_PX}px)`;

/** The kinds of management a phone can be asked to hide (the keys of `ui.mobile`, without the `hide_` prefix). */
export type MobileKind = 'structure' | 'layout_editor' | 'wall_arrange' | 'settings_writes' | 'permissions' | 'control_images';

/** `ui.mobile` as the backend stores it (services/mobile_options.py). */
export type MobileOptions = Record<`hide_${MobileKind}`, boolean>;

/** The defaults the backend applies (and what a phone uses until the settings arrive): the structure guard and the
 * control-images button are on, everything else is off. */
export const DEFAULT_MOBILE_OPTIONS: Readonly<MobileOptions> = {
  hide_structure: true,
  hide_layout_editor: false,
  hide_wall_arrange: false,
  hide_settings_writes: false,
  hide_permissions: false,
  hide_control_images: true,
};

/** The option's label in הגדרות › כללי › אפשרויות נייד (short, one line). */
export const MOBILE_OPTION_LABEL: Readonly<Record<MobileKind, string>> = {
  structure: 'הסתרת ניהול אתרים, מבנים וקומות בנייד',
  layout_editor: 'הסתרת עורך פריסת האזור בנייד',
  wall_arrange: 'הסתרת סידור קיר המצלמות בנייד',
  settings_writes: 'הסתרת מסכי הגדרות שיוצרים או מוחקים בנייד',
  permissions: 'הסתרת ניהול הרשאות ותפקידים בנייד',
  control_images: 'הסתרת כפתור תמונות בקרה בנייד',
};

/** What the phone shows instead of a hidden screen. */
export const STRUCTURE_DESKTOP_ONLY = 'עריכת מבנה וקומות זמינה במחשב בלבד';
export const DESKTOP_ONLY = 'הפעולה הזו זמינה במחשב בלבד';

let options: MobileOptions = { ...DEFAULT_MOBILE_OPTIONS };
const listeners = new Set<() => void>();

/** A settings value (or anything) in its canonical form: every key present, a non-boolean reads as the default. */
export function normalizeMobileOptions(raw: unknown): MobileOptions {
  const out: MobileOptions = { ...DEFAULT_MOBILE_OPTIONS };
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const key of Object.keys(out) as (keyof MobileOptions)[]) {
      const v = (raw as Record<string, unknown>)[key];
      if (typeof v === 'boolean') out[key] = v;
    }
  }
  return out;
}

export function mobileOptions(): MobileOptions {
  return options;
}

/** The installation's value as last read (or saved from the settings screen): every open screen follows at once. */
export function setInstallationMobileOptions(raw: unknown): void {
  options = normalizeMobileOptions(raw);
  for (const l of listeners) l();
}

let mq: MediaQueryList | null | undefined;

function query(): MediaQueryList | null {
  if (mq === undefined) {
    try {
      mq = window.matchMedia(PHONE_QUERY);
    } catch {
      mq = null;
    }
  }
  return mq;
}

export function isPhoneWidth(): boolean {
  return query()?.matches ?? false;
}

/** Calls `fn` whenever the viewport crosses the phone breakpoint; returns the unsubscribe function. */
export function onPhoneWidthChange(fn: (phone: boolean) => void): () => void {
  const q = query();
  if (!q) return () => undefined;
  const h = () => fn(q.matches);
  q.addEventListener('change', h);
  return () => q.removeEventListener('change', h);
}

/** Calls `fn` whenever the mobile options change. */
export function onMobileOptions(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** True at phone width with the option for this kind switched on: hide (or refuse) that management. */
export function phoneRestricted(kind: MobileKind): boolean {
  return isPhoneWidth() && options[`hide_${kind}`];
}

/**
 * The option that hides the SCREEN at this route on a phone, or null. Only whole screens that create, edit or delete
 * things are listed (the in-screen controls of the other options are hidden by their own screens):
 *   structure        #/explore/floors/<id>/edit (the plan editor) and /import (the plan import)
 *   permissions      #/system/access (permissions and roles)
 *   settings_writes  #/system/schedules, #/system/entities (the device catalogue), #/system/security/manage (alarm management)
 */
export function routeGuardKind(segments: readonly string[]): MobileKind | null {
  const [mode, a, b, c] = segments;
  if (mode === 'explore' && a === 'floors' && b && (c === 'edit' || c === 'import')) return 'structure';
  if (mode === 'system') {
    if (a === 'access') return 'permissions';
    if (a === 'schedules' || a === 'automations' || a === 'entities' || (a === 'security' && b === 'manage')) return 'settings_writes';
  }
  return null;
}

/** A Lit reactive controller: the host re-renders when the width crosses 768 px or an option changes. */
export class PhoneWidth implements ReactiveController {
  private offWidth?: () => void;
  private offOptions?: () => void;
  constructor(private readonly host: ReactiveControllerHost) {
    host.addController(this);
  }
  get matches(): boolean {
    return isPhoneWidth();
  }
  restricted(kind: MobileKind): boolean {
    return phoneRestricted(kind);
  }
  hostConnected() {
    this.offWidth = onPhoneWidthChange(() => this.host.requestUpdate());
    this.offOptions = onMobileOptions(() => this.host.requestUpdate());
  }
  hostDisconnected() {
    this.offWidth?.();
    this.offOptions?.();
    this.offWidth = this.offOptions = undefined;
  }
}
