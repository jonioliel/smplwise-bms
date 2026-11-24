// HOME-NEXT-2500 (owner 22.11, Q72 = the recommendation): a wall panel is a screen the whole home shares, so "קראתי" there would mark a
// notice read for whoever comes next. On a wall panel the notice board has no "קראתי": a notice is "new" for 48 hours after it was
// published (the installation setting `wall_notice_new`: 24 / 48 / 72 hours or a week; "read" keeps the panel's own "קראתי" as before).
// Everywhere else (a person's own phone or tablet) "new" stays "not read by me". Pure logic - no DOM, the clock is passed in.

/** The hours a notice stays new on a wall panel by default (services/home_interface.INSTALL_VALUES["wall_notice_new"][0]). */
export const NOTICE_NEW_DEFAULT_H = 48;

/** The notice fields this rule reads (home-p2-api Notice). */
interface NoticeAge {
  read?: boolean;
  published_at: string | null;
  starts_at: string | null;
}

/** The policy's `wall.notice_new_h`, whatever arrived: 0 = the panel's own "read"; missing or not a whole positive number = 48. */
export function noticeNewHours(wall: unknown): number {
  const v = wall && typeof wall === 'object' ? (wall as Record<string, unknown>).notice_new_h : undefined;
  if (v === 0) return 0;
  return typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : NOTICE_NEW_DEFAULT_H;
}

/** The "new" window of this screen in hours, or 0 when "new" means "not read by me" (not a wall panel, or the setting says "read"). */
export function sharedNewHours(wallPanel: boolean, wall: unknown): number {
  return wallPanel ? noticeNewHours(wall) : 0;
}

/** When the notice went up (published, else its start); NaN when it carries neither. */
export function noticeAt(n: NoticeAge): number {
  return Date.parse(n.published_at ?? n.starts_at ?? '');
}

/**
 * Is the notice "new" on this screen? `hours` 0: not read by the person. Otherwise: published less than `hours` ago (a notice whose
 * time is still ahead counts as new; one without any time is never new on a shared screen - nobody can tell how old it is).
 */
export function isNewNotice(n: NoticeAge, now: number, hours: number): boolean {
  if (!hours) return !n.read;
  const at = noticeAt(n);
  return Number.isFinite(at) && now - at < hours * 3600_000;
}
