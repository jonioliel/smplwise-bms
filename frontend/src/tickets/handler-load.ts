/**
 * TKUI6: the load of a handler on the "מטפלים וספקים" cards - open requests, those waiting for the handler, those stuck. Pure: the manager
 * board's open items in, a map by assignee key (`user:<id>` / `contact:<id>`) out; and the one rule of who may see it (owner decision,
 * 2.6.0): ONLY a manager of the person's department - nobody else gets a number.
 */
export interface MemberLoad { open: number; waiting: number; stuck: number }

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
