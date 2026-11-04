/**
 * WISKEY-PROFILES-EDIT-2390: the pure part of the groups and profile fields editor - draft edits, the same validation the server runs
 * before anything is sent (WisKey's own limits: services/wiskey_profiles.normalize_draft), the diff the confirmation shows, the condition
 * graph, and how a reply / error is read. No DOM, no network: tests/unit-wiskey-profiles.spec.ts drives it directly.
 */
import { ApiError } from '../api/client';
import type { ApplyReply, DiffRow, FieldType, ImpactPerson, PolicyValues, ProfileField, ProfileGroup } from '../api/access-profiles';

export const FIELDS_MAX = 12;
export const GROUPS_MAX = 64;
export const LABEL_MAX = 64;
export const OPTIONS_MAX = 100;
export const OPTION_MAX = 100;
export const GROUP_STATIONS_MAX = 100;
export const SUGGEST_FIELDS_MAX = 3;
export const FIELD_TYPES: readonly FieldType[] = ['text', 'select', 'number', 'date'];
const ID = /^[a-z][a-z0-9_]{0,47}$/;
const FIELD_PROPS = ['label', 'enabled', 'type', 'required', 'unique', 'options', 'depends_on'] as const;
const GROUP_PROPS = ['label', 'enabled', 'station_ids'] as const;

export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** A fresh id that matches WisKey's pattern and is not taken (labels are Hebrew, so ids are generated, never derived). */
export function freshId(prefix: 'field' | 'group', taken: readonly string[]): string {
  const used = new Set(taken);
  for (let n = 1; n < 10_000; n++) {
    const id = `${prefix}_${n}`;
    if (!used.has(id)) return id;
  }
  return `${prefix}_${Date.now().toString(36)}`;
}

export function newField(values: PolicyValues, label: string): ProfileField {
  return { id: freshId('field', values.fields.map((f) => f.id)), label, enabled: true, type: 'text', required: false, unique: false, options: [], depends_on: null };
}

export function newGroup(values: PolicyValues, label: string): ProfileGroup {
  return { id: freshId('group', values.groups.map((g) => g.id)), label, enabled: true, station_ids: [] };
}

/** Ids present in the loaded policy: they cannot be removed (WisKey archives definitions), only disabled. */
export function savedIds(base: PolicyValues | null): Set<string> {
  return new Set([...(base?.fields ?? []).map((f) => `fields.${f.id}`), ...(base?.groups ?? []).map((g) => `groups.${g.id}`)]);
}

export function canRemove(base: PolicyValues | null, kind: 'fields' | 'groups', id: string): boolean {
  return !savedIds(base).has(`${kind}.${id}`);
}

export function move<T>(items: readonly T[], index: number, by: -1 | 1): T[] {
  const to = index + by;
  if (to < 0 || to >= items.length) return [...items];
  const out = [...items];
  [out[index], out[to]] = [out[to], out[index]];
  return out;
}

export function toggleStation(group: ProfileGroup, stationId: string): ProfileGroup {
  const now = new Set(group.station_ids ?? []);
  if (now.has(stationId)) now.delete(stationId);
  else now.add(stationId);
  return { ...group, station_ids: [...now].sort() };
}

/** Options from a textarea: one per line, trimmed, empty lines dropped (duplicates kept so validation can mark them). */
export function parseOptions(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** The fields that may be the parent of `fieldId`'s condition: not itself, and not one that (transitively) depends on it. */
export function parentCandidates(fields: readonly ProfileField[], fieldId: string): ProfileField[] {
  const children = new Map<string, string[]>();
  for (const f of fields) {
    if (f.depends_on) children.set(f.depends_on.field_id, [...(children.get(f.depends_on.field_id) ?? []), f.id]);
  }
  const below = new Set<string>([fieldId]);
  const queue = [fieldId];
  while (queue.length) {
    const at = queue.shift() as string;
    for (const c of children.get(at) ?? []) {
      if (!below.has(c)) {
        below.add(c);
        queue.push(c);
      }
    }
  }
  return fields.filter((f) => !below.has(f.id));
}

export type Problems = Record<string, string>;

/** Every problem of a draft as `{path: code}` (the server's DraftError paths and codes). `known`: the stations Arx knows plus those
 * already in the loaded groups (an unknown id there is kept, a NEW unknown one is a problem). */
export function draftProblems(values: PolicyValues, known: ReadonlySet<string>): Problems {
  const out: Problems = {};
  const bad = (path: string, code: string) => {
    if (!(path in out)) out[path] = code;
  };
  const labelOk = (s: unknown) => typeof s === 'string' && s.trim().length > 0 && s.length <= LABEL_MAX && !/[\u0000-\u001f]/.test(s);
  if (values.fields.length > FIELDS_MAX) bad('fields', 'too_many');
  if (values.groups.length > GROUPS_MAX) bad('groups', 'too_many');
  const fieldIds = values.fields.map((f) => f.id);
  values.fields.forEach((f, i) => {
    const p = `fields.${i}`;
    if (!ID.test(f.id)) bad(`${p}.id`, 'id');
    else if (fieldIds.indexOf(f.id) !== i) bad(`${p}.id`, 'duplicate');
    if (!labelOk(f.label)) bad(`${p}.label`, 'label');
    if (!FIELD_TYPES.includes(f.type)) bad(`${p}.type`, 'type');
    if (f.options.length > OPTIONS_MAX) bad(`${p}.options`, 'too_many');
    if (f.options.some((o) => !o.trim() || o.length > OPTION_MAX || /[\u0000-\u001f]/.test(o))) bad(`${p}.options`, 'option');
    if (new Set(f.options).size !== f.options.length) bad(`${p}.options`, 'duplicate');
    if (f.type === 'select' && f.options.length === 0) bad(`${p}.options`, 'empty');
    const dep = f.depends_on;
    if (dep) {
      const parent = values.fields.find((x) => x.id === dep.field_id);
      if (!parent || dep.field_id === f.id) bad(`${p}.depends_on`, 'parent');
      else {
        if (parent.type === 'select' && dep.value && !parent.options.includes(dep.value)) bad(`${p}.depends_on`, 'value');
        const seen = new Set([f.id]);
        let at: string | undefined = dep.field_id;
        while (at) {
          if (seen.has(at)) {
            bad(`${p}.depends_on`, 'cycle');
            break;
          }
          seen.add(at);
          at = values.fields.find((x) => x.id === at)?.depends_on?.field_id;
        }
      }
      if (dep.value.length > OPTION_MAX) bad(`${p}.depends_on`, 'value');
    }
  });
  const groupIds = values.groups.map((g) => g.id);
  values.groups.forEach((g, i) => {
    const p = `groups.${i}`;
    if (!ID.test(g.id)) bad(`${p}.id`, 'id');
    else if (groupIds.indexOf(g.id) !== i) bad(`${p}.id`, 'duplicate');
    if (!labelOk(g.label)) bad(`${p}.label`, 'label');
    const st = g.station_ids ?? [];
    if (st.length > GROUP_STATIONS_MAX) bad(`${p}.station_ids`, 'too_many');
    if (new Set(st).size !== st.length) bad(`${p}.station_ids`, 'duplicate');
    if (st.some((s) => !known.has(s))) bad(`${p}.station_ids`, 'unknown_station');
  });
  return out;
}

const sortIfList = (v: unknown) => (Array.isArray(v) ? [...v].sort() : v);
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** The rows the confirmation shows - the server's `diff_rows` (WisKey's compare rows plus the photo switch). */
export function diffRows(before: PolicyValues, after: PolicyValues): DiffRow[] {
  const out: DiffRow[] = [];
  if (!!before.photo_enabled !== !!after.photo_enabled) {
    out.push({ kind: 'settings', id: 'photo_enabled', label: 'photo_enabled', state: 'changed', changes: [{ property: 'photo_enabled', before: !!before.photo_enabled, after: !!after.photo_enabled }] });
  }
  const kinds: ['fields' | 'groups', readonly string[]][] = [['fields', FIELD_PROPS], ['groups', GROUP_PROPS]];
  for (const [kind, props] of kinds) {
    const old = new Map((before[kind] as { id: string }[]).map((v) => [v.id, v as unknown as Record<string, unknown>]));
    const neu = new Map((after[kind] as { id: string }[]).map((v) => [v.id, v as unknown as Record<string, unknown>]));
    for (const key of [...new Set([...old.keys(), ...neu.keys()])].sort()) {
      const a = old.get(key);
      const b = neu.get(key);
      const changes = [];
      for (const prop of props) {
        let left = a ? a[prop] : null;
        let right = b ? b[prop] : null;
        if (prop === 'station_ids') {
          left = sortIfList(left);
          right = sortIfList(right);
        }
        if (!same(left, right)) changes.push({ property: prop, before: left ?? null, after: right ?? null });
      }
      if (!a || !b || changes.length) out.push({ kind, id: key, label: String((b ?? a)?.label ?? key), state: !a ? 'added' : !b ? 'removed' : 'changed', changes });
    }
  }
  return out;
}

export const changeCount = (rows: readonly DiffRow[]) => rows.reduce((n, r) => n + Math.max(1, r.changes.length), 0);

/** The stations a person gains and loses in a preview row. */
export function personDelta(p: ImpactPerson): { gains: string[]; loses: string[] } {
  const before = new Set(p.before);
  const after = new Set(p.after);
  return { gains: p.after.filter((s) => !before.has(s)), loses: p.before.filter((s) => !after.has(s)) };
}

/** People sorted for the impact list: those whose access changes first, then by name. */
export function sortPeople(people: readonly ImpactPerson[]): ImpactPerson[] {
  return [...people].sort((a, b) => Number(b.changed) - Number(a.changed) || a.display_name.localeCompare(b.display_name, 'he'));
}

export type Outcome = 'not_sent' | 'refused' | 'unknown';

/** What a failed request says happened: the server's `details.outcome`; a 4xx refusal without one is `not_sent`; a network failure
 * (no answer at all) is `unknown` for an apply (it may have reached the server). */
export function outcomeOf(err: unknown): { outcome: Outcome; code: string } {
  if (err instanceof ApiError) {
    const d = (err.body?.details ?? {}) as Record<string, unknown>;
    const raw = String(d.outcome ?? '');
    const outcome: Outcome = raw === 'refused' ? 'refused' : raw === 'not_sent' ? 'not_sent' : raw === 'unknown' ? 'unknown' : err.status >= 400 && err.status < 500 ? 'not_sent' : 'unknown';
    return { outcome, code: String(err.code ?? d.wiskey_code ?? '') };
  }
  return { outcome: 'unknown', code: 'network' };
}

/** The server's per-path problems of a 422 `profiles_invalid_draft`. */
export function problemsOf(err: unknown): Problems {
  if (!(err instanceof ApiError)) return {};
  const list = ((err.body?.details ?? {}) as { problems?: { path: string; code: string }[] }).problems ?? [];
  return Object.fromEntries(list.map((p) => [p.path, p.code]));
}

export type ResultTone = 'ok' | 'warn' | 'err';

/** The honest result line of an apply: saved and read back as confirmed (ok), saved but the readback differs / failed (warn). */
export function resultTone(reply: ApplyReply): ResultTone {
  return reply.readback?.matches ? 'ok' : 'warn';
}

/** Seconds left of a review (from its `expires_at`). */
export function secondsLeft(expiresAt: string, now: number): number {
  const at = Date.parse(expiresAt);
  return Number.isFinite(at) ? Math.max(0, Math.round((at - now) / 1000)) : 0;
}

/** A diff value as words (stations by name, options joined, booleans yes / no, a condition as "<parent label> = <value>"). */
export function valueText(prop: string, v: unknown, names: Record<string, string>, fieldLabels: Record<string, string>, words: { yes: string; no: string; none: string; types: Record<string, string> }): string {
  if (v === null || v === undefined) return words.none;
  if (typeof v === 'boolean') return v ? words.yes : words.no;
  if (prop === 'station_ids' && Array.isArray(v)) return v.length ? v.map((s) => names[String(s)] ?? String(s)).join(', ') : words.none;
  if (prop === 'options' && Array.isArray(v)) return v.length ? v.join(', ') : words.none;
  if (prop === 'type') return words.types[String(v)] ?? String(v);
  if (prop === 'depends_on' && typeof v === 'object') {
    const d = v as { field_id: string; value: string };
    return `${fieldLabels[d.field_id] ?? d.field_id} = ${d.value || '—'}`;
  }
  return String(v);
}
