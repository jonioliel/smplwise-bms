/**
 * WISKEY-VISITS-2407: the pure part of the visits panel - the capability lines, a visit row's status / origin text and tone, what an
 * invitation's record state lets the operator do, and a guest template turned into an invite-form preset. No DOM, no I/O (unit-tested in
 * tests/unit-wiskey-visits.spec.ts). Operator text never names the vendor or the platform ("מערכת בקרת הכניסה").
 */
import type { GuestTemplate, LinkState, VisitCapability, VisitCapabilityName, VisitLink, VisitStatus, WiskeyVisit } from '../api/wiskey-visits';

export type Tone = 'ok' | 'acc' | 'warn' | 'err' | 'off';

export const CAPABILITY_LABEL: Record<VisitCapabilityName, string> = {
  visits: 'הצגת ביקורים ממערכת בקרת הכניסה',
  templates: 'תבניות אורחים',
  push: 'רישום הזמנות Arx במערכת בקרת הכניסה',
};

export interface CapabilityLine {
  name: VisitCapabilityName;
  label: string;
  tone: Tone;
  text: string;
}

/** One line per capability: available, or the server's Hebrew reason (never a code alone). */
export function capabilityLines(caps: Record<VisitCapabilityName, VisitCapability>): CapabilityLine[] {
  return (['visits', 'templates', 'push'] as VisitCapabilityName[]).map((name) => {
    const c = caps[name];
    if (c?.available) return { name, label: CAPABILITY_LABEL[name], tone: 'ok', text: 'זמין' };
    const text = c?.message || (c?.reason ? `לא זמין (${c.reason})` : 'לא זמין');
    const tone: Tone = c?.reason === 'push_off' ? 'off' : 'warn';
    return { name, label: CAPABILITY_LABEL[name], tone, text };
  });
}

const STATUS_TEXT: Record<VisitStatus, [string, Tone]> = {
  pending: ['ממתין לאישור', 'warn'],
  approved: ['מאושר', 'ok'],
  rejected: ['נדחה', 'err'],
  cancelled: ['בוטל', 'off'],
  superseded: ['הוחלף', 'off'],
  unknown: ['לא ידוע', 'off'],
};

export function statusText(status: VisitStatus): { text: string; tone: Tone } {
  const [text, tone] = STATUS_TEXT[status] ?? STATUS_TEXT.unknown;
  return { text, tone };
}

/** Where the visit is managed: an Arx invitation (its own card in Arx) or the access-control system's own panel (read only here). */
export function originText(v: Pick<WiskeyVisit, 'origin'>): { text: string; tone: Tone } {
  return v.origin === 'arx' ? { text: 'הזמנה של Arx', tone: 'acc' } : { text: 'נוצר במערכת בקרת הכניסה · צפייה בלבד', tone: 'off' };
}

export type LinkAction = 'push' | 'reconcile' | 'none';

export interface LinkPlan {
  action: LinkAction;
  text: string;
  tone: Tone;
}

const LINK_TEXT: Record<LinkState, [string, Tone]> = {
  never: ['לא נרשם', 'off'],
  sending: ['בשליחה', 'acc'],
  pushed: ['נרשם', 'ok'],
  refused: ['נדחה', 'err'],
  not_sent: ['לא נשלח', 'off'],
  unknown: ['תוצאה לא ברורה', 'warn'],
};

/** What the operator may do with one invitation's record. `unknown` is only ever settled by a check, never by sending again. */
export function linkPlan(link: VisitLink, pushAvailable: boolean): LinkPlan {
  const [base, tone] = LINK_TEXT[link.state] ?? LINK_TEXT.never;
  if (link.state === 'unknown') return { action: 'reconcile', text: base, tone };
  if (link.state === 'sending') return { action: 'none', text: base, tone };
  if (link.state === 'pushed' && link.in_sync) return { action: 'none', text: base, tone };
  const outdated = link.state === 'pushed' && !link.in_sync;
  const text = outdated ? 'נרשם · יש עדכון לשליחה' : base;
  if (!pushAvailable || !link.pushable) return { action: 'none', text, tone: outdated ? 'warn' : tone };
  return { action: 'push', text, tone: outdated ? 'warn' : tone };
}

export interface InvitePreset {
  doors: Record<string, number[]>;
  valid_from: string;
  valid_until: string;
  category: 'visitor' | 'contractor';
}

/** A guest template as the invite form's preset: the doors, and a window of the template's length starting at `startMs` (UTC instants). */
export function presetFromTemplate(t: GuestTemplate, startMs: number): InvitePreset | null {
  if (!t.duration_minutes || Object.keys(t.doors).length === 0) return null;
  const from = new Date(startMs);
  from.setUTCSeconds(0, 0);
  const until = new Date(from.getTime() + t.duration_minutes * 60_000);
  const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const doors: Record<string, number[]> = {};
  for (const [sid, locks] of Object.entries(t.doors)) doors[sid] = [...locks].sort((a, b) => a - b);
  return { doors, valid_from: iso(from), valid_until: iso(until), category: t.access_category === 'contractor' ? 'contractor' : 'visitor' };
}

export function durationText(minutes: number | null): string {
  if (!minutes) return '—';
  if (minutes % 1440 === 0) return minutes === 1440 ? 'יום' : `${minutes / 1440} ימים`;
  if (minutes % 60 === 0) return minutes === 60 ? 'שעה' : `${minutes / 60} שעות`;
  return `${minutes} דקות`;
}
