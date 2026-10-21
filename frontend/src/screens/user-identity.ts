/** UXREST2-295: a users list prints the sign-in name under the display name only when it adds something. A display name that
 * equals the username (a user with no separate name, or an e-mail used as both) is shown once. Pure; used by the Access users
 * table and the local users list. */
const same = (a: string, b: string): boolean => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

/** The secondary identity line: the username (or the id when the username is empty), or '' when it repeats the display name. */
export function secondaryIdentity(name: string | null | undefined, username: string | null | undefined, id?: string | null): string {
  const shown = (name ?? '').trim();
  const cand = (username ?? '').trim() || (id ?? '').trim();
  if (!cand) return '';
  return shown && same(shown, cand) ? '' : cand;
}
