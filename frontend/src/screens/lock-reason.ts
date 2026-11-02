/**
 * UNLOCK-REASON-2370: why a lock cannot be opened, in words. The server (`unlock_reason`, the one function behind `can_unlock`) says WHICH
 * reason; this module says it once, for the devices panel, the map card and the effective-permissions note. Pure (no DOM), so the texts and
 * links are unit-tested. The configuration link is offered only to a holder of `system.configure` - everyone else gets the sentence alone.
 */
export type UnlockReason = 'ok' | 'no_permission' | 'door_not_mapped' | 'alarm_managed' | 'not_placed' | 'wall_profile' | 'no_control';

/** Settings › חיבורים: the "שיוך דלתות" card sits on this page (system administrator only). */
export const DOOR_MAP_HREF = '#/system/setup';
export const DOOR_MAP_LINK_LABEL = 'לשיוך דלתות';

export interface UnlockReasonText {
  /** The short sentence shown in place of the open button. */
  text: string;
  /** The longer tooltip. */
  title: string;
  /** Present only when the caller may act on it (system.configure). */
  link: { href: string; label: string } | null;
}

const TEXTS: Record<Exclude<UnlockReason, 'ok'>, { text: string; title: string }> = {
  no_permission: { text: 'אין לך הרשאת פתיחה לדלת זו', title: 'פתיחת דלת דורשת הרשאת פתיחת דלתות (door.unlock או פתיחת דלתות באינטרקום) בהיקף של הדלת' },
  door_not_mapped: { text: 'הדלת לא משויכת לתחנה', title: 'דלת אינטרקום נפתחת רק אחרי ששויכה לתחנה ולממסר שלה ב"שיוך דלתות"' },
  alarm_managed: { text: 'המנעול מנוהל ממסך האזעקה', title: 'המנעול שייך לאזעקה ומופעל רק ממסך האזעקה' },
  not_placed: { text: 'ההרשאה שלך לפי קומה - המנעול לא ממוקם על מפת הקומה', title: 'הרשאת הפתיחה שלך חלה על קומות מסוימות, והמנעול הזה אינו ממוקם על מפת אחת מהן' },
  wall_profile: { text: 'חשבון של מסך קיר לא פותח דלתות', title: 'חשבון שמוגדר כמסך קיר אינו אדם שפותח דלתות, ולכן פתיחה אינה מוצעת לו' },
  no_control: { text: 'אין לך הרשאת שליטה במנעול זה', title: 'פתיחה דורשת גם הרשאת שליטה בישויות (ha.entity.control) בהיקף המנעול' },
};

/** The sentence, tooltip and (for an administrator) the link for a reason; null for "ok" or a reason this build does not know. */
export function unlockReasonText(reason: string | null | undefined, canConfigure: boolean): UnlockReasonText | null {
  if (!reason || reason === 'ok') return null;
  const t = (TEXTS as Record<string, { text: string; title: string } | undefined>)[reason];
  if (!t) return null;
  return { ...t, link: reason === 'door_not_mapped' && canConfigure ? { href: DOOR_MAP_HREF, label: DOOR_MAP_LINK_LABEL } : null };
}

/** The panel's fallback when an older server sends `can_unlock: false` with no reason: the original, generic sentence. */
export const GENERIC_DENIED: UnlockReasonText = { text: 'פתיחה דורשת הרשאה נפרדת', title: 'פתיחת מנעול דורשת הרשאה נפרדת (פתיחת דלת)', link: null };

/** What a locked row shows instead of the open button. */
export function deniedNote(row: { can_unlock?: boolean; unlock_reason?: string | null }, canConfigure: boolean): UnlockReasonText {
  return unlockReasonText(row.unlock_reason, canConfigure) ?? GENERIC_DENIED;
}

/** The map card's note under a dimmed lock action. A non-lock action keeps the generic wording (a separate grant is what it needs). */
export function mapCardGrantNote(actions: { id: string; granted?: boolean; reason?: string | null }[] | undefined, canConfigure: boolean): UnlockReasonText | null {
  const denied = (actions ?? []).filter((a) => a.granted === false);
  if (!denied.length) return null;
  const unlock = denied.find((a) => a.id === 'lock.unlock');
  const specific = unlock ? unlockReasonText(unlock.reason, canConfigure) : null;
  if (specific && denied.length === 1) return specific;
  if (specific) return { ...specific, text: `${specific.text} · פעולות מעומעמות אחרות דורשות הרשאה נפרדת שאינה חלק משליטה כללית בישויות.` };
  return { text: 'פעולה מעומעמת דורשת הרשאה נפרדת (למשל פתיחת דלת) שאינה חלק משליטה כללית בישויות.', title: '', link: null };
}

/** The tooltip of a dimmed action button: the specific reason for the open action, else the permission name as before. */
export function dimmedActionTitle(action: { id: string; grant?: string | null; reason?: string | null }, canConfigure: boolean): string {
  const t = action.id === 'lock.unlock' ? unlockReasonText(action.reason, canConfigure) : null;
  return t ? t.text : `נדרשת הרשאה נפרדת: ${action.grant ?? ''}`;
}

/** The note under "הרשאות אפקטיביות" when the shown permissions include a door opening one: intercom doors also need a door mapping. */
export const DOOR_PERMISSION_NOTE = 'פתיחת דלת אינטרקום דורשת גם שיוך של הדלת לתחנה וממסר ב"שיוך דלתות" - ההרשאה לבדה אינה מספיקה.';
const DOOR_PERMISSIONS = ['door.unlock', 'access.doors.open', 'access.release'];

export function doorPermissionNote(shown: readonly string[], canConfigure: boolean): { text: string; link: { href: string; label: string } | null } | null {
  if (!shown.some((p) => DOOR_PERMISSIONS.includes(p))) return null;
  return { text: DOOR_PERMISSION_NOTE, link: canConfigure ? { href: DOOR_MAP_HREF, label: DOOR_MAP_LINK_LABEL } : null };
}

/** The notice on the door-permissions tab: how many intercom doors wait for a mapping (the server counts; this only words it). */
export function unmappedDoorsNotice(unmapped: { count: number; with_suggestion: number } | null | undefined, canConfigure: boolean): { text: string; link: { href: string; label: string } | null } | null {
  if (!unmapped || unmapped.count <= 0) return null;
  const n = unmapped.count;
  const text = n === 1 ? 'דלת אינטרקום אחת עדיין לא משויכת לתחנה - אף אחד לא יוכל לפתוח אותה, גם עם הרשאה.' : `${n} דלתות אינטרקום עדיין לא משויכות לתחנה - אף אחד לא יוכל לפתוח אותן, גם עם הרשאה.`;
  return { text, link: canConfigure ? { href: DOOR_MAP_HREF, label: DOOR_MAP_LINK_LABEL } : null };
}
