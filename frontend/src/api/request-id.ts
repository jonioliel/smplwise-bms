/** One id per deliberate user action (entity actions, WisKey commands, bulk actions). `crypto.randomUUID` exists only
 * in secure contexts - Home Assistant reached over plain http on the LAN is not one, and there the call throws a
 * TypeError that the API client would report as "no connection to the server". `getRandomValues` works everywhere. */
export function commandId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
}
