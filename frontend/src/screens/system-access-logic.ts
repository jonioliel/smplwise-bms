/**
 * Pure helpers of the roles screen (system-access.ts) - no DOM, unit-tested in Node (tests/unit-role-editor-legacy.spec.ts).
 */

/**
 * WXPERM (owner decision 2026-10-13): the sensitive permissions the custom-role editor offers. A legacy permission name (the
 * server's `legacy_permissions`, e.g. `access.release` -> `access.doors.open`) is listed only for a role that already holds it,
 * so an administrator can still see and remove it; every new grant uses the new name. Order is kept.
 */
/**
 * SMALLFIXB-295: the sensitive grants a CUSTOM role may carry. A permission that is both sensitive and a system permission
 * (`bridge.key.rotate`, ...) lives in the built-in roles only: the route refuses it with 422 `system_permission_not_allowed`,
 * so the editor neither lists it nor lets "select all" submit it. Order is kept.
 */
export function customRoleSensitive(sensitive: readonly string[], system: readonly string[] | undefined): string[] {
  const sys = new Set(system ?? []);
  return sensitive.filter((p) => !sys.has(p));
}

export function legacyFiltered(sensitive: readonly string[], legacy: Record<string, string> | undefined, held: ReadonlySet<string>): string[] {
  if (!legacy) return [...sensitive];
  return sensitive.filter((p) => !(p in legacy) || held.has(p));
}
