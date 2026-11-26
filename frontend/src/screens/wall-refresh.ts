// MEDIUM-REST-2540 (deep review SCR-26): the two camera walls that stay open for days (the "all cameras" wall and the kiosk) read the
// camera list once, so a camera that was offline when the wall opened stayed an offline tile with no player until the page was reloaded,
// and a camera that came back (or went down) was never seen. Now both re-read the list every CAMERA_REFRESH_MS through the shared poll
// (visible page only, never two reads at once) and merge the answer by id: an unchanged camera keeps its object, so its tile and its
// player are not touched; an unchanged list keeps the array, so nothing is drawn again.
//
// The kiosk's "system" tile used to say "active - go2rtc + NVR" whatever the health answer was (and named vendor components); it now
// follows the health summary the header pill already reads.

/** How often a wall re-reads its camera list (as the live overview, live-overview.ts). */
export const CAMERA_REFRESH_MS = 60_000;

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/** The new list with every unchanged item's previous object; the previous array itself when nothing changed (same ids, same order). */
export function mergeById<T extends { id: string }>(prev: readonly T[] | null | undefined, next: readonly T[]): T[] {
  if (!prev) return [...next];
  const old = new Map(prev.map((x) => [x.id, x]));
  const out = next.map((x) => {
    const was = old.get(x.id);
    return was && same(was, x) ? was : x;
  });
  return out.length === prev.length && out.every((x, i) => x === prev[i]) ? (prev as T[]) : out;
}

type SystemTone = 'green' | 'red' | '';

/** The kiosk's system tile: its status key, colour class and icon, from the health summary (null = not read yet) and the connection. */
export function systemTile(status: 'ok' | 'warn' | 'error' | 'off' | null, disconnected: boolean): { key: 'offline' | 'unknown' | 'ok' | 'warn' | 'error' | 'off'; tone: SystemTone; icon: 'check' | 'warning' } {
  if (disconnected) return { key: 'offline', tone: 'red', icon: 'warning' };
  if (status === null) return { key: 'unknown', tone: '', icon: 'check' };
  if (status === 'ok') return { key: 'ok', tone: 'green', icon: 'check' };
  if (status === 'error') return { key: 'error', tone: 'red', icon: 'warning' };
  if (status === 'warn') return { key: 'warn', tone: '', icon: 'warning' };
  return { key: 'off', tone: '', icon: 'check' };
}
