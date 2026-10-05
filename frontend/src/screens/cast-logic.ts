/**
 * CR-028 (CAST1 UI): the pure part of the cast screens - words, grouping, countdown and the rules of which buttons exist. No DOM, no Lit, no
 * network (unit-tested by tests/unit-cast-logic.spec.ts). Operator copy never names the technology or the platform; the settings screens may.
 */
import { t } from '../i18n/he';
import type { CastBlocked, CastSession, CastTarget, CastTargetState } from '../api/cast';

export const BLOCKED_TEXT: Record<CastBlocked, string> = {
  no_permission: t('cast.blockedNoPermission'),
  unsupported: t('cast.blockedUnsupported'),
  not_allowed: t('cast.blockedNotAllowed'),
  public: t('cast.blockedPublic'),
  unavailable: t('cast.blockedUnavailable'),
};

export const STATE_TEXT: Record<CastTargetState, string> = {
  free: t('cast.stateFree'),
  off: t('cast.stateOff'),
  playing_music: t('cast.stateMusic'),
  casting: t('cast.stateCasting'),
  unavailable: t('cast.stateUnavailable'),
};

/** The line under a screen's name: the reason when it is blocked, otherwise its state. */
export function targetLine(tg: CastTarget, sessionOf?: CastSession | null): string {
  if (tg.blocked) return BLOCKED_TEXT[tg.blocked] ?? tg.blocked;
  if (tg.state === 'casting') return sessionOf?.camera_name ? `${t('cast.stateCasting')}: ${sessionOf.camera_name}` : STATE_TEXT.casting;
  return STATE_TEXT[tg.state] ?? tg.state;
}

/** Operator words for "why casting is not available now" (the administrator also learns where to fix it). */
export function notReadyText(_reason: string | null | undefined, admin: boolean): string {
  return admin ? t('cast.notReadyAdmin') : t('cast.notReady');
}

/** The server's own Hebrew message when it sent one; these cover the codes of a 200 "refused" answer, which carries a code and no message. */
const REFUSED_TEXT: Record<string, string> = {
  cast_unsupported: 'המסך הזה לא יכול לקבל שידור.',
  unavailable: 'המסך לא זמין.',
  rate_limited: 'רגע, השידור הקודם למסך הזה עוד מתחיל.',
  bridge_outdated: 'השידור לא זמין: נדרש עדכון של רכיב החיבור.',
  bridge_not_paired: 'רכיב החיבור לא צומד.',
};

/** A "refused" start / switch (HTTP 200, `error` = the code the bridge or the screen answered). */
export function refusedText(code: string | null | undefined): string {
  const c = (code ?? '').replace(/^refused:/, '');
  return REFUSED_TEXT[c] ?? 'המסך סירב לשידור. אפשר לנסות שוב או לבחור מסך אחר.';
}

// ---------------------------------------------------------------------------------------------- time

export function msLeft(s: Pick<CastSession, 'expires_at'>, nowMs: number): number | null {
  if (!s.expires_at) return null;
  const e = Date.parse(s.expires_at);
  return Number.isNaN(e) ? null : Math.max(0, e - nowMs);
}

/** `4:32` under an hour, `1:05:00` above; `קבוע` for a permanent cast. */
export function leftText(s: Pick<CastSession, 'expires_at' | 'permanent'>, nowMs: number): string {
  if (s.permanent || !s.expires_at) return t('cast.pillPermanent');
  const ms = msLeft(s, nowMs);
  if (ms === null) return '';
  const sec = Math.ceil(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const ss = sec % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${two(m)}:${two(ss)}` : `${m}:${two(ss)}`;
}

/** Under five minutes the countdown is drawn as a warning. */
export function isLow(s: Pick<CastSession, 'expires_at' | 'permanent'>, nowMs: number): boolean {
  const ms = s.permanent ? null : msLeft(s, nowMs);
  return ms !== null && ms <= 5 * 60_000;
}

// ---------------------------------------------------------------------------------------------- sessions / pill

export const isOpen = (s: CastSession) => s.state !== 'stopped';

/** The open sessions, mine first, then the soonest to end (a permanent one last). */
export function openSessions(list: CastSession[]): CastSession[] {
  return list.filter(isOpen).sort((a, b) => {
    if (a.mine !== b.mine) return a.mine ? -1 : 1;
    const ea = a.expires_at ? Date.parse(a.expires_at) : Infinity;
    const eb = b.expires_at ? Date.parse(b.expires_at) : Infinity;
    return ea - eb;
  });
}

export function canExtend(s: CastSession): boolean {
  return isOpen(s) && !s.permanent && s.kind !== 'test' && s.can.extend && s.extensions_left > 0;
}

/** The "extend" control stays visible (but disabled) while the right exists and the limit is reached - the user learns why. */
export function extendLimitReached(s: CastSession): boolean {
  return isOpen(s) && !s.permanent && s.kind !== 'test' && s.can.extend && s.extensions_left <= 0;
}

/** "Also switch the screen off" is offered only when the screen was off before the cast and the installation rule is on. */
export const powerOffOffered = (s: CastSession) => !!s.power_off_after;

/** The pill's summary: one session says the screen and the time; several say how many. */
export function pillLabel(open: CastSession[], nowMs: number): string {
  if (!open.length) return '';
  if (open.length === 1) return `${t('cast.pillLabel')} · ${open[0].screen_name} · ${leftText(open[0], nowMs)}`;
  return `${t('cast.pillLabel')} ${open.length}`;
}

export function sessionOfTarget(sessions: CastSession[], key: string): CastSession | null {
  return sessions.find((s) => isOpen(s) && s.device_key === key) ?? null;
}

// ---------------------------------------------------------------------------------------------- picker

export interface TargetGroup {
  id: string;
  title: string;
  targets: CastTarget[];
}

/** "לאחרונה" first (the screens this person used last, in that order), then one group per floor by name. A screen is listed once. */
export function groupTargets(targets: CastTarget[], recent: string[]): TargetGroup[] {
  const byKey = new Map(targets.map((x) => [x.key, x]));
  const used = new Set<string>();
  const out: TargetGroup[] = [];
  const rec = recent.map((k) => byKey.get(k)).filter((x): x is CastTarget => !!x && !x.blocked).slice(0, 3);
  if (rec.length >= 1 && targets.length > 4) {
    out.push({ id: 'recent', title: t('cast.recent'), targets: rec });
    rec.forEach((x) => used.add(x.key));
  }
  const floors = new Map<string, TargetGroup>();
  for (const x of targets) {
    if (used.has(x.key)) continue;
    const title = x.floor_name || t('cast.noFloor');
    const g = floors.get(title) ?? { id: `floor:${title}`, title, targets: [] };
    g.targets.push(x);
    floors.set(title, g);
  }
  const rest = [...floors.values()].sort((a, b) => (a.title === t('cast.noFloor') ? 1 : b.title === t('cast.noFloor') ? -1 : a.title.localeCompare(b.title, 'he')));
  for (const g of rest) g.targets.sort((a, b) => Number(!!a.blocked) - Number(!!b.blocked) || a.name.localeCompare(b.name, 'he'));
  return [...out, ...rest];
}

export const canPick = (x: CastTarget) => !x.blocked && x.state !== 'unavailable';
/** A screen that plays music asks for a confirmation before the cast takes it. */
export const needsConfirm = (x: CastTarget) => x.state === 'playing_music';

/** The pill button of the picker's footer: how long the cast will run on that screen. */
export function durationText(x: CastTarget, permanent: boolean): string {
  return permanent ? t('cast.durationPermanent') : `${x.minutes} ${t('cast.minutes')}`;
}

// ---------------------------------------------------------------------------------------------- recents

const RECENT_KEY = 'sw.cast.recent';

export function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((k): k is string => typeof k === 'string').slice(0, 5) : [];
  } catch {
    return [];
  }
}

export function pushRecent(key: string): void {
  try {
    const next = [key, ...readRecent().filter((k) => k !== key)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: no recents */
  }
}

// ---------------------------------------------------------------------------------------------- the button

/** The button exists only for a person holding `media.cast` (somewhere), on a backend, and only when the server says there is at least one screen
 * to show in the picker (a blocked-but-listed screen counts: the grey list explains). No hint otherwise - a clean operator screen. */
export function castButtonVisible(opts: { api: boolean; hasCast: boolean; targets: number | null; ready: boolean | null }): boolean {
  if (!opts.api || !opts.hasCast) return false;
  if (opts.ready === false) return false;
  return (opts.targets ?? 0) > 0;
}

/** The phone shows the picker as a bottom sheet when the owner's `ui.dd_phone` says `sheet`, otherwise as the docked list (default). */
export function pickerPresentation(opts: { phone: boolean; ddPhone: string | null | undefined }): 'panel' | 'list' | 'sheet' {
  if (!opts.phone) return 'panel';
  return opts.ddPhone === 'sheet' ? 'sheet' : 'list';
}

/** The minutes choices of the per-screen setting (5-240). */
export const CAST_MINUTES = [5, 10, 15, 30, 45, 60, 90, 120, 240];

/** The per-screen cast-method words of the administrator's table (technology names are allowed in the settings). */
export const SCREEN_METHOD_LABEL: Record<string, string> = { auto: 'אוטומטי', cast_hls: 'Google Cast', none: 'ללא שידור' };

export const BLOCKED_DISPLAY_LABEL: Record<string, string> = { grey_reason: 'אפור עם הסיבה', hide: 'הסתרה', grey_admin: 'אפור למנהל בלבד' };

export const ORIGIN_REASON_TEXT: Record<string, string> = {
  relay_off: 'אפשרות ה־relay כבויה בהגדרות התוסף (cast_relay)',
  origin_missing: 'כתובת המקור לא הוגדרה',
  unreachable: 'השרת לא הצליח להגיע לכתובת המקור',
  not_this_relay: 'הכתובת עונה, אבל לא מה־relay הזה',
};

/** The settings screens keep the exact reasons (technical names allowed there). */
export const NOT_READY_ADMIN_TEXT: Record<string, string> = {
  relay_off: 'ה־relay כבוי: הפעילו את האפשרות cast_relay בהגדרות התוסף ומפו פורט מארח ל־18092',
  disabled: 'השידור למסכים כבוי',
  origin_missing: 'כתובת המקור (http://כתובת-LAN:פורט) לא הוגדרה',
  origin_unverified: 'כתובת המקור טרם נבדקה: לחצו "בדוק"',
  bridge_not_paired: 'גשר Arx לא מצומד',
  bridge_outdated: 'גשר Arx ישן: נדרשת גרסה 0.7.0 ומעלה',
};
