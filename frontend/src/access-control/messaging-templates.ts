/**
 * CR-036 WA: the checks of the Settings page "הודעות" (templates and limits), run in the browser so the administrator is told at once.
 * Pure - no DOM, no network (unit-tested in Node: tests/unit-messaging-templates.spec.ts). The SERVER is the judge: it applies the same
 * rules again on every save (services/intercom_messaging.py `validate_settings`) and answers every problem as `{path, code}`; this module
 * produces the same shape with the same codes, so a server answer and a local check render alike.
 *
 * A template body may hold the placeholders {name} (the person's name) and {organization} (the name set below) and nothing else in curly
 * braces; it may never contain, or read like, a PIN or an access code; no control characters; bounded sizes.
 */
import { hasCredentialPlaceholder, looksLikeCredential } from './messaging-logic';
import type { MessagingLimits, MessagingSettingsDoc, SettingsProblem } from '../api/access-messaging';

export const DEFAULT_LIMITS: MessagingLimits = {
  templates_max: 20,
  label_max: 40,
  body_max: 600,
  text_max: 1000,
  organization_max: 60,
  bulk_max: [1, 200],
  rate_per_hour: [1, 1000],
  per_sender_per_hour: [1, 1000],
  per_person_per_day: [1, 50],
  per_station_per_hour: [1, 1000],
  placeholders: ['name', 'organization'],
  placeholders_max: 6,
};

/** The longest a person's name is rendered (WisKey keeps at most this) and the longest the whole text may become. */
const NAME_MAX = 128;
const RENDERED_MAX = 1500;

const CONTROL = /\p{Cc}|\p{Zl}|\p{Zp}/u;
const hasControl = (text: string, newline: boolean) => [...text].some((c) => (newline && c === '\n' ? false : CONTROL.test(c)));

/** The same normalisation the server applies to a body: line ends as \n, trailing spaces off every line, the whole trimmed. */
export function cleanBody(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+$/u, ''))
    .join('\n')
    .trim();
}

export interface TemplateDraft {
  id?: string;
  label: string;
  body: string;
}

function labelProblems(label: string, path: string, seen: Set<string>, limits: MessagingLimits): SettingsProblem[] {
  const text = label.trim();
  if (!text) return [{ path, code: 'empty' }];
  if (text.length > limits.label_max) return [{ path, code: 'too_long' }];
  if (hasControl(text, false)) return [{ path, code: 'control_chars' }];
  const key = text.toLocaleLowerCase();
  if (seen.has(key)) return [{ path, code: 'duplicate_label' }];
  seen.add(key);
  return [];
}

export function bodyProblems(body: string, path: string, organization: string, limits: MessagingLimits): SettingsProblem[] {
  const text = cleanBody(body);
  if (!text) return [{ path, code: 'empty' }];
  if (text.length > limits.body_max) return [{ path, code: 'too_long' }];
  if (hasControl(text, true)) return [{ path, code: 'control_chars' }];
  if (hasCredentialPlaceholder(text)) return [{ path, code: 'credential' }];
  const found = [...text.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1]);
  const rest = text.replace(/\{[^{}]*\}/g, '');
  if (rest.includes('{') || rest.includes('}')) return [{ path, code: 'bad_braces' }];
  if (found.some((n) => !limits.placeholders.includes(n))) return [{ path, code: 'unknown_placeholder' }];
  if (looksLikeCredential(text)) return [{ path, code: 'credential' }];
  if (found.length > limits.placeholders_max) return [{ path, code: 'too_many_placeholders' }];
  if (found.includes('organization') && !organization.trim()) return [{ path, code: 'organization_missing' }];
  // review F8: the text a person receives - "הקוד שלך {organization}" with an organization of "4821"
  if (looksLikeCredential(text.replace(/\{(name|organization)\}/g, (_m, k: string) => (k === 'name' ? 'xxxxxxxx' : organization.trim())))) return [{ path, code: 'credential' }];
  const names = found.filter((n) => n === 'name').length;
  const orgs = found.filter((n) => n === 'organization').length;
  if (text.replace(/\{(?:name|organization)\}/g, '').length + names * NAME_MAX + orgs * limits.organization_max > RENDERED_MAX) return [{ path, code: 'too_long' }];
  return [];
}

/** Every problem of the whole document, as the server would name them (`{path, code}`). */
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The server's `send_hours_error`: null = a valid window (the tickets' send-hours rules: from < to, no window across midnight). */
export function sendHoursProblem(v: { from: string; to: string } | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  if (!HHMM.test(v.from) || !HHMM.test(v.to)) return 'window_invalid';
  if (v.from === v.to) return 'window_empty';
  if (v.from > v.to) return 'window_across_midnight';
  return null;
}

type CapKey = 'per_sender_per_hour' | 'per_person_per_day' | 'per_station_per_hour';
const CAP_DEFAULT_RANGES: Record<CapKey, [number, number]> = { per_sender_per_hour: [1, 1000], per_person_per_day: [1, 50], per_station_per_hour: [1, 1000] };

export function settingsProblems(
  doc: Pick<MessagingSettingsDoc, 'bulk_max' | 'rate_per_hour' | 'organization' | 'account' | 'templates'> & Partial<Pick<MessagingSettingsDoc, CapKey | 'send_hours'>>,
  limits: MessagingLimits = DEFAULT_LIMITS,
): SettingsProblem[] {
  const out: SettingsProblem[] = [];
  const int = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
  if (!int(doc.bulk_max)) out.push({ path: 'bulk_max', code: 'type' });
  else if (doc.bulk_max < limits.bulk_max[0] || doc.bulk_max > limits.bulk_max[1]) out.push({ path: 'bulk_max', code: 'range' });
  if (!int(doc.rate_per_hour)) out.push({ path: 'rate_per_hour', code: 'type' });
  else if (doc.rate_per_hour < limits.rate_per_hour[0] || doc.rate_per_hour > limits.rate_per_hour[1]) out.push({ path: 'rate_per_hour', code: 'range' });
  for (const key of Object.keys(CAP_DEFAULT_RANGES) as CapKey[]) {
    if (!(key in doc)) continue;
    const v = doc[key];
    const [lo, hi] = limits[key] ?? CAP_DEFAULT_RANGES[key];
    if (!int(v)) out.push({ path: key, code: 'type' });
    else if (v < lo || v > hi) out.push({ path: key, code: 'range' });
  }
  const hours = sendHoursProblem(doc.send_hours);
  if (hours) out.push({ path: 'send_hours', code: hours });
  const organization = doc.organization.trim();
  if (organization.length > limits.organization_max) out.push({ path: 'organization', code: 'too_long' });
  else if (hasControl(organization, false)) out.push({ path: 'organization', code: 'control_chars' });
  else if (organization.includes('{') || organization.includes('}')) out.push({ path: 'organization', code: 'bad_braces' });
  else if (looksLikeCredential(organization)) out.push({ path: 'organization', code: 'credential' });
  if (doc.templates.length > limits.templates_max) out.push({ path: 'templates', code: 'too_many' });
  const labels = new Set<string>();
  doc.templates.forEach((t, i) => {
    out.push(...labelProblems(t.label, `templates.${i}.label`, labels, limits));
    out.push(...bodyProblems(t.body, `templates.${i}.body`, organization, limits));
  });
  return out;
}

/** The problems of one field (`templates.2.body`, `bulk_max`, ...) among a list. */
export const problemsAt = (problems: readonly SettingsProblem[], path: string): SettingsProblem[] => problems.filter((p) => p.path === path);

/** A text with the placeholder `{token}` put in at the caret (or at the end), the caret after it. */
export function insertAt(text: string, token: string, start: number | null, end: number | null): { text: string; caret: number } {
  const a = start ?? text.length;
  const b = end ?? a;
  return { text: text.slice(0, a) + token + text.slice(b), caret: a + token.length };
}
