/**
 * TKUI6: the load of a handler on the "מטפלים וספקים" cards - open requests, those waiting for the handler, those stuck. Pure: the manager
 * board's open items in, a map by assignee key (`user:<id>` / `contact:<id>`) out; and the one rule of who may see it (owner decision,
 * 2.6.0): ONLY a manager of the person's department - nobody else gets a number.
 */
export interface MemberLoad { open: number; waiting: number; stuck: number; /** HANDLERLOAD: requests handled in the chosen period; absent = not available */ handled?: number }

/** The part of a board item the load reads. */
export interface LoadItem { assignee_key: string; waiting_on?: string; stuck?: unknown }

export function loadsFromBoard(items: readonly LoadItem[]): Map<string, MemberLoad> {
  const out = new Map<string, MemberLoad>();
  for (const it of items) {
    if (!it.assignee_key || it.assignee_key === 'none') continue;
    const l = out.get(it.assignee_key) ?? { open: 0, waiting: 0, stuck: 0 };
    l.open += 1;
    if (it.waiting_on === 'assignee') l.waiting += 1;
    if (it.stuck) l.stuck += 1;
    out.set(it.assignee_key, l);
  }
  return out;
}

/** The ids of the departments the viewer manages (the server's `can_manage` of each department of GET tickets/meta). */
export function managedDepartments(departments: readonly { id: string; can_manage: boolean }[]): string[] {
  return departments.filter((d) => d.can_manage).map((d) => d.id);
}

/** True when the viewer manages at least one of the departments the person belongs to (an employee without an account: no departments
 * means every department, so any managed department counts). */
export function seesLoad(managed: readonly string[], personDepartments: readonly string[]): boolean {
  if (!managed.length) return false;
  return !personDepartments.length || personDepartments.some((d) => managed.includes(d));
}

// ---------------------------------------------------------------- HANDLERLOAD (owner 2026-10-17): the "handled" number and its period

/**
 * The fourth number of a handler card: how many requests the handler HANDLED in a period. Definition (server side,
 * services/tickets/handler_load.py): done/closed requests whose completion time is in the period, counted for the assignee they had at
 * that moment; a count only. The period applies to this number only - open / waiting / stuck are the current state.
 */
export type HandledDays = 1 | 7 | 30;
export const HANDLED_PERIODS: readonly HandledDays[] = [1, 7, 30];
export const HANDLED_DEFAULT: HandledDays = 7;
export const HANDLED_STORAGE_KEY = 'sw.tickets.handlers.handledDays';

export function asHandledDays(v: unknown): HandledDays | null {
  const n = typeof v === 'string' && /^(1|7|30)$/.test(v) ? Number(v) : v;
  return n === 1 || n === 7 || n === 30 ? n : null;
}

/** The installation default (`ui.handled_days` of GET tickets/module); an older server / a bad value reads as 7. */
export function installationHandledDays(ui: { handled_days?: unknown } | null | undefined): HandledDays {
  return asHandledDays(ui?.handled_days) ?? HANDLED_DEFAULT;
}

/** The viewer's own remembered choice; any storage failure (private window, blocked data) or a stale value reads as "none". */
export function readStoredPeriod(storage?: Pick<Storage, 'getItem'>): HandledDays | null {
  try {
    return asHandledDays((storage ?? globalThis.localStorage).getItem(HANDLED_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function storePeriod(days: HandledDays, storage?: Pick<Storage, 'setItem'>): void {
  try {
    (storage ?? globalThis.localStorage).setItem(HANDLED_STORAGE_KEY, String(days));
  } catch {
    /* the choice just is not remembered */
  }
}

/** The loads with the handled count of the period merged in (a new map; `handled` null = the count is not available -> no fourth number). */
export function withHandled(loads: Map<string, MemberLoad> | null, handled: Readonly<Record<string, number>> | null): Map<string, MemberLoad> | null {
  if (!loads) return null;
  if (!handled) return loads;
  const out = new Map<string, MemberLoad>();
  for (const [k, v] of loads) out.set(k, { ...v, handled: handled[k] ?? 0 });
  for (const [k, n] of Object.entries(handled)) if (!out.has(k)) out.set(k, { open: 0, waiting: 0, stuck: 0, handled: n });
  return out;
}
