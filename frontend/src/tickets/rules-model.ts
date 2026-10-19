/**
 * TKRULES-291 (docs/changes/CR-038-TKRULES-NOTES.md): the pure model of Settings › service management › "פתיחה אוטומטית" - the rules
 * that open a ticket from an alert. The client checks mirror the server's (services/tickets/rules_doc.py) so the editor answers at once;
 * the server stays the authority and its 422 field problems are mapped back onto the same fields.
 */

export type OnClear = 'comment' | 'comment_close';

export interface TicketRule {
  id: string | null;
  name: string;
  enabled: boolean;
  source: string;
  subject_id: string;
  hold_min: number;
  department_id: string;
  priority_id: string | null;
  category_id: string | null;
  title: string;
  description: string;
  on_clear: OnClear;
  /** null = the installation default */
  daily_limit: number | null;
}

/** A rule as the server serves it: the stored fields plus today's numbers. */
export interface TicketRuleView extends TicketRule {
  id: string;
  effective_limit: number;
  today_created: number;
  limit_reached: boolean;
  suppressed_today: number;
  last_fired_at: string | null;
  invalid?: boolean;
  problems?: string[];
}

export interface RuleSource {
  key: string;
  label: string;
  category: string;
  subject: string;
}

export interface RuleDepartment {
  id: string;
  name: string;
  priorities: { id: string; name: string; is_default: boolean }[];
  categories: { id: string; name: string }[];
}

export interface RuleBounds {
  max_rules: number;
  hard_daily_max: number;
  default_daily: number;
  hold_max_min: number;
  name_max: number;
  title_max: number;
  description_max: number;
  placeholders: string[];
}

export interface RulesDoc {
  revision: number;
  enabled: boolean;
  daily_limit_default: number;
  rules: TicketRuleView[];
  day: string;
  sources: RuleSource[];
  departments: RuleDepartment[];
  bounds: RuleBounds;
}

export type DryRunOutcome = 'create' | 'absorb' | 'suppressed' | 'wait_hold' | 'nothing' | 'already_handled' | 'rule_off' | 'rules_off';

export interface DryRunAnswer {
  would: DryRunOutcome;
  matches: number;
  held: number;
  effective_limit: number;
  today_created: number;
  sample_values: boolean;
  alerts: { title: string; place: string; first_at: string; held: boolean }[];
  preview: { title: string; description: string; department: string; priority: string };
}

export const DEFAULT_BOUNDS: RuleBounds = {
  max_rules: 50, hard_daily_max: 200, default_daily: 20, hold_max_min: 1440, name_max: 80, title_max: 120, description_max: 2000,
  placeholders: ['alert', 'details', 'place', 'source', 'since'],
};

/** The editor's draft: numbers stay text while typing (an empty limit = the installation default). */
export interface RuleDraft {
  id: string | null;
  name: string;
  enabled: boolean;
  source: string;
  subject_id: string;
  hold_min: string;
  department_id: string;
  priority_id: string;
  category_id: string;
  title: string;
  description: string;
  on_clear: OnClear;
  daily_limit: string;
}

export type RuleField = 'name' | 'source' | 'subject_id' | 'hold_min' | 'department_id' | 'priority_id' | 'category_id' | 'title' | 'description' | 'on_clear' | 'daily_limit';
export type RuleProblem = 'required' | 'too_long' | 'placeholder' | 'range' | 'integer' | 'unknown' | 'choice';

export function blankDraft(sources: RuleSource[], departments: RuleDepartment[]): RuleDraft {
  return {
    id: null, name: '', enabled: true, source: sources[0]?.key ?? '', subject_id: '', hold_min: '0', department_id: departments[0]?.id ?? '',
    priority_id: '', category_id: '', title: '{alert} - {place}', description: '{details}', on_clear: 'comment', daily_limit: '',
  };
}

export function draftOf(r: TicketRule): RuleDraft {
  return {
    id: r.id, name: r.name, enabled: r.enabled, source: r.source, subject_id: r.subject_id ?? '', hold_min: String(r.hold_min ?? 0),
    department_id: r.department_id, priority_id: r.priority_id ?? '', category_id: r.category_id ?? '', title: r.title, description: r.description ?? '',
    on_clear: r.on_clear, daily_limit: r.daily_limit == null ? '' : String(r.daily_limit),
  };
}

/** A strict whole number from the editor ('' -> null); anything else -> NaN. */
export function parseWhole(text: string): number | null {
  const t = text.trim();
  if (t === '') return null;
  return /^-?\d+$/.test(t) ? Number(t) : Number.NaN;
}

/** The limit a rule works with: its override, else the installation default. */
export function effectiveLimit(daily: number | null | undefined, installationDefault: number): number {
  return typeof daily === 'number' && Number.isInteger(daily) && daily >= 1 ? daily : installationDefault;
}

/** The problem of a daily limit typed in the editor (the override may be empty; the installation default may not). */
export function limitProblem(text: string, hardMax: number, optional: boolean): RuleProblem | null {
  const v = parseWhole(text);
  if (v === null) return optional ? null : 'required';
  if (Number.isNaN(v)) return 'integer';
  return v >= 1 && v <= hardMax ? null : 'range';
}

/** Only the known placeholders, no format spec, balanced braces. */
export function placeholdersOk(template: string, allowed: readonly string[]): boolean {
  let i = 0;
  while (i < template.length) {
    const ch = template[i];
    if (ch === '{') {
      if (template[i + 1] === '{') {
        i += 2;
        continue;
      }
      const end = template.indexOf('}', i);
      if (end < 0) return false;
      const name = template.slice(i + 1, end);
      if (!allowed.includes(name)) return false;
      i = end + 1;
      continue;
    }
    if (ch === '}') {
      if (template[i + 1] === '}') {
        i += 2;
        continue;
      }
      return false;
    }
    i += 1;
  }
  return true;
}

export function ruleProblems(d: RuleDraft, doc: Pick<RulesDoc, 'sources' | 'departments' | 'bounds'>): Partial<Record<RuleField, RuleProblem>> {
  const b = doc.bounds;
  const out: Partial<Record<RuleField, RuleProblem>> = {};
  const name = d.name.trim();
  if (!name) out.name = 'required';
  else if (name.length > b.name_max) out.name = 'too_long';
  if (!doc.sources.some((s) => s.key === d.source)) out.source = 'unknown';
  if (d.subject_id.trim().length > 200) out.subject_id = 'too_long';
  const hold = parseWhole(d.hold_min);
  if (hold === null || Number.isNaN(hold) || hold < 0 || hold > b.hold_max_min) out.hold_min = 'range';
  const dept = doc.departments.find((x) => x.id === d.department_id);
  if (!dept) out.department_id = 'unknown';
  if (d.priority_id && !dept?.priorities.some((p) => p.id === d.priority_id)) out.priority_id = 'unknown';
  if (d.category_id && !dept?.categories.some((c) => c.id === d.category_id)) out.category_id = 'unknown';
  const title = d.title.trim();
  if (!title) out.title = 'required';
  else if (title.length > b.title_max) out.title = 'too_long';
  else if (!placeholdersOk(title, b.placeholders)) out.title = 'placeholder';
  if (d.description.length > b.description_max) out.description = 'too_long';
  else if (!placeholdersOk(d.description, b.placeholders)) out.description = 'placeholder';
  const lim = limitProblem(d.daily_limit, b.hard_daily_max, true);
  if (lim) out.daily_limit = lim;
  return out;
}

/** The body of one rule for the server (numbers as numbers, empty choices as null). Call after ruleProblems() is empty. */
export function ruleBody(d: RuleDraft): TicketRule {
  return {
    id: d.id, name: d.name.trim(), enabled: d.enabled, source: d.source, subject_id: d.subject_id.trim(), hold_min: parseWhole(d.hold_min) ?? 0,
    department_id: d.department_id, priority_id: d.priority_id || null, category_id: d.category_id || null, title: d.title.trim(),
    description: d.description, on_clear: d.on_clear, daily_limit: parseWhole(d.daily_limit),
  };
}

/** A stored rule back to its body (for a PUT of the whole document). */
export function stored(r: TicketRuleView): TicketRule {
  const { id, name, enabled, source, subject_id, hold_min, department_id, priority_id, category_id, title, description, on_clear, daily_limit } = r;
  return { id, name, enabled, source, subject_id, hold_min, department_id, priority_id, category_id, title, description, on_clear, daily_limit };
}

/** Map a server 422 (`rules[i].field` or `rule.field`) onto the editor's fields. */
export function serverProblems(fields: { field: string; code: string }[], index: number | null): Partial<Record<RuleField, RuleProblem>> {
  const out: Partial<Record<RuleField, RuleProblem>> = {};
  const known: RuleField[] = ['name', 'source', 'subject_id', 'hold_min', 'department_id', 'priority_id', 'category_id', 'title', 'description', 'on_clear', 'daily_limit'];
  const codes: RuleProblem[] = ['required', 'too_long', 'placeholder', 'range', 'integer', 'unknown', 'choice'];
  for (const f of fields) {
    const m = /^(?:rules\[(\d+)\]|rule)\.(\w+)$/.exec(f.field);
    if (!m) continue;
    if (m[1] !== undefined && index !== null && Number(m[1]) !== index) continue;
    const key = m[2] as RuleField;
    if (!known.includes(key)) continue;
    out[key] = (codes as string[]).includes(f.code) ? (f.code as RuleProblem) : 'unknown';
  }
  return out;
}

/** The label of a rule's source ('' for a source the catalogue no longer offers). */
export function sourceLabel(sources: RuleSource[], key: string): string {
  return sources.find((s) => s.key === key)?.label ?? '';
}
