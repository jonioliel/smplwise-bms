/** TOPPILL-295: the pill's search access setting (`ui.global_search`, `ui.global_search_roles`) - pure helpers, no DOM. */
export type SearchMode = 'off' | 'admins' | 'roles' | 'all';
export const SEARCH_MODES: readonly SearchMode[] = ['off', 'admins', 'roles', 'all'];

/** The role ids of a stored `ui.global_search_roles` value (comma-separated), without blanks or repeats. */
export function parseSearchRoles(v: unknown): string[] {
  return [...new Set(String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean))];
}

export function toggleSearchRole(current: string[], id: string, on: boolean): string[] {
  const set = new Set(current);
  if (on) set.add(id);
  else set.delete(id);
  return [...set];
}

/** A stored mode read back safely: anything unknown is off (the default). */
export function searchModeOf(v: unknown): SearchMode {
  return SEARCH_MODES.includes(v as SearchMode) ? (v as SearchMode) : 'off';
}
