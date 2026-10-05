// HA1: the sync's last_error is a stable code (ha_restarting, ha_unreachable, ha_auth_failed, ...) or, for an unforeseen
// failure, an exception class name. Operators see plain Hebrew, never the technical name.
export function syncErrorText(code: string | null | undefined): string {
  switch (code) {
    case 'ha_restarting':
      return 'תשתית המערכת מופעלת מחדש, מתחבר שוב...';
    case 'ha_unreachable':
      return 'אין קשר עם תשתית המערכת, מנסה שוב...';
    case 'ha_not_configured':
      return 'החיבור לתשתית המערכת עדיין לא הוגדר';
    case 'ha_auth_failed':
    case 'ha_unauthorized':
      return 'תשתית המערכת דחתה את ההרשאה';
    default:
      return code ? 'החיבור לתשתית המערכת נפסק, מנסה שוב...' : '';
  }
}

/** "מנותק · <reason>" for a disconnected sync, with the reason in plain Hebrew (nothing when there is none). */
export function syncDisconnectedText(code: string | null | undefined): string {
  const t = syncErrorText(code);
  return t ? `מנותק · ${t}` : 'מנותק';
}
