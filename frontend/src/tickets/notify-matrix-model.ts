/**
 * TKNOTIFMATRIX: the pure model of the notification matrix screen (tickets/notify-matrix.ts).
 * The stored matrix is `{department id | "*": {source: "now" | "digest" | "off"}}`; a missing cell means "now" (today's behaviour). A
 * department's own cell wins over the "*" cell, which is shown as the inherited value when the department has none.
 * 2.9.1: `departments` holds, per department and "*", the digest time (departments only - the installation value is the "*" time),
 * the digest's recipients and a channel override; a department inherits each field it does not set from "*". `sla_urgent` is the
 * per-SLA-policy (department x priority) override of the installation's `urgent_immediate`.
 */
export type MatrixMode = 'now' | 'digest' | 'off';
export type NotifyMatrix = Record<string, Record<string, MatrixMode>>;
export interface NotifySource { key: string; label: string; digest: boolean; assignee?: boolean; sla?: boolean }
export type ChannelGroup = 'push' | 'email' | 'whatsapp';
export type ChannelValue = 'on' | 'off';
export interface DeptRecipients { managers: boolean; users: string[]; roles: string[] }
export interface DeptNotify { digest_time?: string; recipients?: DeptRecipients; channels?: Partial<Record<ChannelGroup, ChannelValue>> }
export type NotifyDepartments = Record<string, DeptNotify>;
export type SlaUrgent = Record<string, 'immediate' | 'matrix'>;
export interface NotifyDoc {
  matrix_enabled: boolean;
  matrix: NotifyMatrix;
  digest_enabled: boolean;
  digest_time: string;
  departments?: NotifyDepartments;
  urgent_immediate?: boolean;
  sla_urgent?: SlaUrgent;
}

export const MATRIX_MODES: readonly MatrixMode[] = ['now', 'digest', 'off'];
export const CHANNEL_GROUPS: readonly ChannelGroup[] = ['push', 'email', 'whatsapp'];
export const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

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

export interface EffectiveDept {
  digestTime: string;
  /** the time comes from the installation value (the department has none of its own) */
  timeInherited: boolean;
  recipients: DeptRecipients;
  recipientsInherited: boolean;
  /** per channel group: the effective value ('inherit' = the event's own channel policy) and whether it comes from "*" */
  channels: Record<ChannelGroup, { value: ChannelValue | 'inherit'; inherited: boolean }>;
}

/** What the server applies to one department (the same inheritance as services/tickets/notify_matrix.department_cfg). */
export function effectiveDept(doc: NotifyDoc, dept: string): EffectiveDept {
  const deps = doc.departments ?? {};
  const own = deps[dept] ?? {};
  const star = dept === '*' ? {} : deps['*'] ?? {};
  const rec = own.recipients ?? star.recipients;
  const channels = {} as EffectiveDept['channels'];
  for (const g of CHANNEL_GROUPS) {
    const mine = own.channels?.[g];
    const parent = star.channels?.[g];
    channels[g] = mine ? { value: mine, inherited: false } : { value: parent ?? 'inherit', inherited: !!parent };
  }
  return {
    digestTime: (dept !== '*' && own.digest_time) || doc.digest_time,
    timeInherited: dept === '*' || !own.digest_time,
    recipients: rec ? { managers: rec.managers, users: [...rec.users], roles: [...rec.roles] } : { managers: true, users: [], roles: [] },
    recipientsInherited: !own.recipients,
    channels,
  };
}

/** The departments map after setting (or clearing, with undefined) one field of one department; empty rows are dropped. */
export function setDeptField<K extends keyof DeptNotify>(deps: NotifyDepartments | undefined, dept: string, field: K, value: DeptNotify[K] | undefined): NotifyDepartments {
  const out: NotifyDepartments = {};
  for (const [d, cfg] of Object.entries(deps ?? {})) out[d] = { ...cfg };
  const row: DeptNotify = { ...(out[dept] ?? {}) };
  if (value === undefined || (field === 'channels' && !Object.keys(value as object).length)) delete row[field];
  else row[field] = value;
  if (Object.keys(row).length) out[dept] = row;
  else delete out[dept];
  return out;
}

/** One channel group of a department set to on / off, or back to inherit. */
export function setChannel(cur: Partial<Record<ChannelGroup, ChannelValue>> | undefined, group: ChannelGroup, value: ChannelValue | 'inherit'): Partial<Record<ChannelGroup, ChannelValue>> {
  const out = { ...(cur ?? {}) };
  if (value === 'inherit') delete out[group];
  else out[group] = value;
  return out;
}

/** An id added to / removed from a picked list (no duplicates, order kept). */
export function toggleId(list: readonly string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/** The key of an SLA policy (department x priority) in `sla_urgent`. */
export function slaKey(dept: string, priority: string): string {
  return `${dept}/${priority}`;
}

export function setSla(map: SlaUrgent | undefined, key: string, value: 'immediate' | 'matrix' | 'inherit'): SlaUrgent {
  const out = { ...(map ?? {}) };
  if (value === 'inherit') delete out[key];
  else out[key] = value;
  return out;
}
