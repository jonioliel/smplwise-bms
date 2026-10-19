/**
 * TKNOTIFMATRIX: the pure model of the notification matrix screen (tickets/notify-matrix.ts).
 * The stored matrix is `{department id | "*": {source: "digest" | "off"}}`; a missing cell means "now" (today's behaviour). A department's
 * own cell wins over the "*" cell, which is shown as the inherited value when the department has none.
 */
export type MatrixMode = 'now' | 'digest' | 'off';
export type NotifyMatrix = Record<string, Record<string, MatrixMode>>;
export interface NotifySource { key: string; label: string; digest: boolean }
export interface NotifyDoc { matrix_enabled: boolean; matrix: NotifyMatrix; digest_enabled: boolean; digest_time: string }

export const MATRIX_MODES: readonly MatrixMode[] = ['now', 'digest', 'off'];

/** The effective mode of one cell as the server decides it (the department's own cell, else "*", else "now"). */
export function matrixOf(matrix: NotifyMatrix, dept: string, source: string): MatrixMode {
  return matrix[dept]?.[source] ?? (dept === '*' ? undefined : matrix['*']?.[source]) ?? 'now';
}

/** Clicking the mode that is already selected clears the department's own cell (it falls back to "*" / "now"). */
export function cycleMode(cur: MatrixMode, clicked: MatrixMode): MatrixMode | null {
  return cur === clicked ? null : clicked;
}

/** The whole matrix after setting one cell (null clears it). "now" is stored only as an override of a "*" value on a department. */
export function setCell(matrix: NotifyMatrix, dept: string, source: string, mode: MatrixMode | null): NotifyMatrix {
  const out: NotifyMatrix = {};
  for (const [d, cells] of Object.entries(matrix)) out[d] = { ...cells };
  const row = { ...(out[dept] ?? {}) };
  if (mode === null || (mode === 'now' && dept === '*')) delete row[source];
  else row[source] = mode;
  if (Object.keys(row).length) out[dept] = row;
  else delete out[dept];
  return out;
}
