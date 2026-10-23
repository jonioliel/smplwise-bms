/**
 * CR-INTAKE99 / TENANTINTAKE098-295: the pure rules of the free-text request queue and of its settings. Nothing here reaches the server;
 * the server validates again. The requester's text is ALWAYS plain text: `segments` only splits it into runs for text nodes (never HTML,
 * never a link), so a URL typed by a stranger is inert on the handler's screen.
 */
import type { Evidence, IntakeDraft, IntakeEditKey, IntakeUrgency } from '../api/tickets-intake';
import type { IntakeSettings } from '../api/tickets';
import type { IntakeKey } from '../i18n/intake';

export const PAGE_SIZE = 5;

export interface Segment { text: string; hit: boolean }

/** The text split at the evidence offsets (clamped, merged, in reading order): a hit is a phrase that produced a suggestion. */
export function segments(text: string, evidence: readonly Evidence[]): Segment[] {
  const spans = evidence
    .map(([s, e]) => [Math.max(0, Math.min(text.length, s)), Math.max(0, Math.min(text.length, e))] as const)
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const [s, e] of spans) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  const out: Segment[] = [];
  let at = 0;
  for (const [s, e] of merged) {
    if (s > at) out.push({ text: text.slice(at, s), hit: false });
    out.push({ text: text.slice(s, e), hit: true });
    at = e;
  }
  if (at < text.length) out.push({ text: text.slice(at), hit: false });
  return out;
}

/** Every evidence span of a draft's suggestion. */
export function allEvidence(d: Pick<IntakeDraft, 'suggestion'>): Evidence[] {
  const s = d.suggestion;
  return [...s.category.evidence, ...s.location.evidence, ...s.place.evidence, ...s.urgency.evidence];
}

export function urgencyTone(u: IntakeUrgency): 'danger' | 'warning' | 'neutral' {
  return u === 'urgent' ? 'danger' : u === 'high' ? 'warning' : 'neutral';
}

const FLAG_KEYS: Record<string, IntakeKey> = {
  safety: 'safety', emergency_services: 'emergency', safety_negated: 'negated', possible_multi_issue: 'multi', possible_question: 'question',
  possible_not_a_request: 'notRequest', too_short: 'tooShort',
};

/** The keys of the flags the screen words (unknown flags of a newer server are ignored). */
export function flagKeys(flags: readonly string[]): IntakeKey[] {
  return flags.map((f) => FLAG_KEYS[f]).filter((k): k is IntakeKey => !!k);
}

export interface Pager { from: number; to: number; total: number; prev: number | null; next: number | null }

export function pager(total: number, offset: number, shown: number): Pager {
  const from = total === 0 ? 0 : offset + 1;
  return {
    from, to: offset + shown, total,
    prev: offset > 0 ? Math.max(0, offset - PAGE_SIZE) : null,
    next: offset + PAGE_SIZE < total ? offset + PAGE_SIZE : null,
  };
}

/** The value a field shows: the handler's edit when there is one, else the suggestion. */
export function fieldValue(d: IntakeDraft, key: IntakeEditKey): string {
  const e = d.edited[key];
  if (e !== undefined) return e ?? '';
  switch (key) {
    case 'department_id': return d.suggestion.department_id ?? '';
    case 'category_id': return d.suggestion.category.value ?? '';
    case 'priority_key': return d.suggestion.urgency.value;
    case 'location_id': return d.suggestion.location.value ?? '';
    case 'place_other': return d.suggestion.place.text;
    case 'title': return d.suggestion.title;
    case 'description': return d.text;
  }
}

/** A typed Israeli or international mobile, loosely (the server normalises and validates). */
export function plausiblePhone(raw: string): boolean {
  const digits = raw.replace(/[\s\-().+]/g, '');
  return /^\d{8,15}$/.test(digits);
}

export const INTAKE_LIMITS = {
  unlisted_reply_per_day: [1, 5], coalesce_min: [1, 60], sender_per_day: [1, 20], sender_per_week: [1, 50], installation_per_hour: [10, 200],
  installation_per_day: [50, 1000], open_max: [50, 2000], draft_ttl_days: [1, 60], rejected_keep_days: [1, 30], block_days: [1, 90],
} as const;
export type IntakeLimitKey = keyof typeof INTAKE_LIMITS;

export const INTAKE_DEFAULTS: IntakeSettings = {
  enabled: false, whatsapp: false, default_department: '', classifier: 'rules', approval_reply: true, unlisted_reply: true, unlisted_reply_per_day: 1,
  coalesce_min: 10, sender_per_day: 5, sender_per_week: 15, installation_per_hour: 60, installation_per_day: 300, open_max: 500, draft_ttl_days: 14,
  rejected_keep_days: 7, block_days: 30,
};

/** The stored block with defaults filled in; an older server without the block answers null (the card is not shown). */
export function intakeOf(raw: Partial<IntakeSettings> | undefined | null): IntakeSettings | null {
  if (!raw || typeof raw !== 'object') return null;
  const out: IntakeSettings = { ...INTAKE_DEFAULTS };
  for (const k of Object.keys(INTAKE_DEFAULTS) as Array<keyof IntakeSettings>) {
    const v = raw[k];
    if (typeof v === typeof INTAKE_DEFAULTS[k] && v !== undefined) (out as unknown as Record<string, unknown>)[k] = v;
  }
  if (raw.classifier !== 'rules' && raw.classifier !== 'off') out.classifier = 'rules';
  return out;
}

/** A typed whole number inside the key's range, or null. */
export function limitedInt(raw: string, key: IntakeLimitKey): number | null {
  if (!/^\d{1,4}$/.test(raw.trim())) return null;
  const n = Number(raw);
  const [lo, hi] = INTAKE_LIMITS[key];
  return n >= lo && n <= hi ? n : null;
}

/** The sub-switches only make sense under the master switch. */
export function subControlsEnabled(s: IntakeSettings): boolean {
  return s.enabled;
}

/** The patch for one number field, or null when invalid or unchanged. */
export function numberPatch(s: IntakeSettings, key: IntakeLimitKey, raw: string): Partial<IntakeSettings> | null {
  const n = limitedInt(raw, key);
  return n === null || n === s[key] ? null : ({ [key]: n } as Partial<IntakeSettings>);
}
