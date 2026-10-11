/**
 * Pure helpers of the WisKey door Settings cards (CR-033 wave 1, system-doors.ts) - no DOM, unit-tested in Node
 * (tests/unit-door-settings.spec.ts). Hebrew copy lives here so the cards and the spec read the same words.
 */
import type { DoorGrantRole, DoorGrantSubject, DoorMap, DoorMapLock } from '../api/doors';

/** The built-in roles' read-only answer in the "תפקידים" section (owner default: no built-in role changes by a switch). */
export function builtinAnswer(role: DoorGrantRole): string {
  if (role.answer === 'never') return 'לעולם לא';
  if (role.answer === 'yes' || role.includes) return 'כן';
  return 'לא - אפשר לתת למשתמשים בנפרד';
}

/** The question each sensitive switch asks before it is sent (one short confirmation). */
export function grantQuestion(name: string, enabled: boolean): string {
  return enabled ? `לתת ל${name} הרשאה לפתוח דלתות?` : `להסיר מ${name} את ההרשאה לפתוח דלתות?`;
}

export function roleQuestion(name: string, enabled: boolean): string {
  return enabled ? `לכלול פתיחת דלתות בתפקיד ${name}?` : `להסיר פתיחת דלתות מהתפקיד ${name}?`;
}

/** The line under a subject: what else lets them open ("שיוך אחר"), by role and scope name - never ids. */
export function otherGrants(s: DoorGrantSubject): string {
  if (!s.other.length) return '';
  return `שיוך אחר: ${s.other.map((o) => `${o.role_name} · ${o.scope_name}`).join(', ')}`;
}

/** Subjects filtered by a free-text search over their names (the card lists every user and group). */
export function filterSubjects(rows: DoorGrantSubject[], q: string): DoorGrantSubject[] {
  const needle = q.trim().toLowerCase();
  return needle ? rows.filter((r) => r.name.toLowerCase().includes(needle)) : rows;
}

/** A placement select's value: `building:<id>`, `site:<id>` or '' (the whole installation). */
export function placementValue(p: { site_id: string | null; building_id: string | null } | null): string {
  if (!p) return '';
  if (p.building_id) return `building:${p.building_id}`;
  return p.site_id ? `site:${p.site_id}` : '';
}

export function parsePlacement(value: string): { site_id: string | null; building_id: string | null } {
  if (value.startsWith('building:')) return { site_id: null, building_id: value.slice(9) };
  if (value.startsWith('site:')) return { site_id: value.slice(5), building_id: null };
  return { site_id: null, building_id: null };
}

/** The placement options: the whole installation, every site, every building under its site. */
export function placementOptions(map: DoorMap): { value: string; label: string }[] {
  const out = [{ value: '', label: 'כל ההתקנה (ללא שיוך)' }];
  for (const s of map.sites) {
    out.push({ value: `site:${s.id}`, label: `אתר · ${s.name}` });
    for (const b of map.buildings.filter((x) => x.site_id === s.id)) out.push({ value: `building:${b.id}`, label: `${s.name} · ${b.name}` });
  }
  return out;
}

/** The relays a lock may be mapped to: the relays of its own station when its registry names one, else of every station. */
export function relayOptions(map: DoorMap, lock: DoorMapLock): { value: string; label: string }[] {
  const stations = lock.station_id ? map.stations.filter((s) => s.id === lock.station_id) : map.stations;
  const out: { value: string; label: string }[] = [];
  for (const s of stations) {
    for (const r of s.relays) out.push({ value: `${s.id}#${r.physical_index}`, label: `${s.name} · ${r.name || `ממסר ${r.physical_index}`}` });
  }
  return out;
}

export function parseRelay(value: string): { station_id: string; relay: number } | null {
  const i = value.lastIndexOf('#');
  if (i <= 0) return null;
  const relay = Number(value.slice(i + 1));
  return Number.isInteger(relay) && relay >= 1 ? { station_id: value.slice(0, i), relay } : null;
}

/** A lock's mapping state as the "שיוך דלתות" card says it. */
export function mappingState(lock: DoorMapLock): { tone: 'live' | 'stale' | 'unknown'; text: string } {
  if (lock.mapping && lock.mapping.valid) return { tone: 'live', text: lock.mapping.source === 'manual' ? 'משויך ידנית' : 'משויך' };
  if (lock.mapping) return { tone: 'stale', text: 'השיוך אינו תקף כרגע - יש לשייך מחדש' };
  if (lock.suggestion) return { tone: 'unknown', text: 'הצעה לשיוך מוכנה' };
  return { tone: 'unknown', text: 'לא משויך - הדלת לא תיפתח מ-Arx' };
}
