/**
 * PRESENCE-2280: the client twin of services/building_presence_blocks.py - the cockpit's "building empty for N minutes" trigger and the
 * "room occupied / empty" condition, compiled to the plain template shape the server writes and read back only from that exact text.
 * Pure functions; offered only while the owner switched building presence on and tagged sensors (`catalog.extension.building_presence`).
 */
import type { Duration } from './automations';

export const MAX_MINUTES = 1440;
export type PresenceMode = 'occupied' | 'empty';
const LIST = String.raw`\[((?:'[a-z0-9_]+\.[a-z0-9_]+'(?:, )?)+)\]`;
const EMPTY_RE = new RegExp(String.raw`^\{\{ ${LIST} \| reject\('is_state', 'off'\) \| list \| count == 0 \}\}$`);
const OCCUPIED_RE = new RegExp(String.raw`^\{\{ ${LIST} \| select\('is_state', 'on'\) \| list \| count > 0 \}\}$`);

export function templateFor(mode: PresenceMode, sensors: readonly string[]): string {
  const lst = `[${sensors.map((s) => `'${s}'`).join(', ')}]`;
  return mode === 'occupied' ? `{{ ${lst} | select('is_state', 'on') | list | count > 0 }}` : `{{ ${lst} | reject('is_state', 'off') | list | count == 0 }}`;
}

export function readTemplate(text: unknown): { mode: PresenceMode; sensors: string[] } | null {
  if (typeof text !== 'string') return null;
  for (const [mode, rx] of [['empty', EMPTY_RE], ['occupied', OCCUPIED_RE]] as const) {
    const m = rx.exec(text);
    if (m) {
      const sensors = [...m[1]!.matchAll(/'([^']+)'/g)].map((x) => x[1]!);
      return sensors.length && sensors.length <= 200 ? { mode, sensors } : null;
    }
  }
  return null;
}

export function minutesOf(d: Duration | null | undefined): number | null {
  if (!d) return null;
  const secs = (d.hours ?? 0) * 3600 + (d.minutes ?? 0) * 60 + (d.seconds ?? 0);
  return secs > 0 && secs % 60 === 0 && secs / 60 <= MAX_MINUTES ? secs / 60 : null;
}
export const durationOf = (minutes: number): Duration => ({ hours: Math.floor(minutes / 60), minutes: minutes % 60, seconds: 0 });

export function buildTrigger(b: { sensors: readonly string[]; minutes: number }): Record<string, unknown> {
  return { trigger: 'template', value_template: templateFor('empty', b.sensors), for: durationOf(b.minutes) };
}
export function buildCondition(b: { mode: PresenceMode; sensors: readonly string[] }): Record<string, unknown> {
  return { condition: 'template', value_template: templateFor(b.mode, b.sensors) };
}

export function triggerSentence(minutes: number): string {
  return minutes === 1 ? 'כשהמבנה ריק במשך דקה' : `כשהמבנה ריק במשך ${minutes} דקות`;
}
export function conditionSentence(b: { mode: PresenceMode; sensors: readonly string[] }, building: readonly string[] = [], names?: (id: string) => string): string {
  const word = b.mode === 'empty' ? 'אין נוכחות' : 'יש נוכחות';
  if (building.length && b.sensors.length === building.length && b.sensors.every((s) => building.includes(s))) return `${word} במבנה`;
  if (names) return `${word} ב${b.sensors.slice(0, 3).map(names).join(' · ')}${b.sensors.length > 3 ? ` ועוד ${b.sensors.length - 3}` : ''}`;
  return `${word} באזור שנבחר`;
}

/** Problems of a NEW block (the server judges again). */
export function problems(b: { sensors?: readonly string[]; minutes?: number; mode?: string }, section: 'trigger' | 'condition', tagged: readonly string[]): string[] {
  const out: string[] = [];
  if (!tagged.length) return ['אין חיישני נוכחות מסומנים במבנה'];
  if (!b.sensors?.length) out.push('בחרו חיישני נוכחות');
  else if (b.sensors.some((s) => !tagged.includes(s))) out.push('החיישן אינו מסומן כחיישן נוכחות');
  if (section === 'trigger') {
    if (!Number.isInteger(b.minutes) || (b.minutes ?? 0) < 1 || (b.minutes ?? 0) > MAX_MINUTES) out.push('הגדירו זמן בדקות (1 עד 1440)');
  } else if (b.mode !== 'occupied' && b.mode !== 'empty') out.push('בחרו מצב');
  return out;
}
