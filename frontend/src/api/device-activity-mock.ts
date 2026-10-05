/**
 * CR-032: the in-memory answer of the activity route for a page with no API session (static preview, design review). Synthetic people
 * and automations only. The same data shape the real route returns, so the popup runs unchanged. Not a source of truth for anything.
 */
import type { ActivityItem, ActivityPage, ActivityQuery, ActorType } from './device-activity';

const MIN = 60_000;

interface Seed {
  ago: number;
  actor: ActorType;
  name?: string;
  kind: ActivityItem['kind'];
  attribute?: string;
  from: ActivityItem['from'];
  to: ActivityItem['to'];
  unit?: string;
  confidence?: ActivityItem['confidence'];
  note?: string;
}

const ON = { state: 'on' };
const OFF = { state: 'off' };

function seedsOf(entityId: string): Seed[] {
  const domain = entityId.split('.')[0];
  if (domain === 'cover') {
    return [
      { ago: 40, actor: 'person', name: 'דנה כהן', kind: 'value', attribute: 'position', from: { value: 100 }, to: { value: 40 }, unit: '%' },
      { ago: 70, actor: 'device', kind: 'value', attribute: 'position', from: { value: 70 }, to: { value: 66 }, unit: '%', confidence: 'inferred' },
      { ago: 24 * 60 + 30, actor: 'automation', name: 'חום בצהריים', kind: 'value', attribute: 'position', from: { value: 100 }, to: { value: 70 }, unit: '%' },
      { ago: 24 * 60 + 600, actor: 'schedule', name: 'תריסים בוקר', kind: 'value', attribute: 'tilt', from: { value: 0 }, to: { value: 30 }, unit: '°' },
    ];
  }
  if (domain === 'climate') {
    return [
      { ago: 20, actor: 'person', name: 'יואב כהן', kind: 'value', attribute: 'target_temperature', from: { value: 22 }, to: { value: 24 }, unit: '°' },
      { ago: 200, actor: 'schedule', name: 'מזגן אחר צהריים', kind: 'power', from: { state: 'off' }, to: { state: 'cool' } },
      { ago: 24 * 60 + 120, actor: 'person', name: 'דנה כהן', kind: 'value', attribute: 'fan_mode', from: { value: 'auto' }, to: { value: 'high' } },
      { ago: 24 * 60 + 122, actor: 'person', name: 'דנה כהן', kind: 'value', attribute: 'hvac_mode', from: { value: 'heat' }, to: { value: 'cool' } },
    ];
  }
  const light = domain === 'light';
  const rows: Seed[] = [
    { ago: 15, actor: 'person', name: 'דנה כהן', kind: 'power', from: ON, to: OFF },
    { ago: 140, actor: 'schedule', name: 'תאורת ערב', kind: 'power', from: OFF, to: ON },
    ...(light ? [{ ago: 150, actor: 'device' as const, kind: 'value' as const, attribute: 'brightness', from: { value: 100 }, to: { value: 60 }, unit: '%', confidence: 'inferred' as const }] : []),
    { ago: 24 * 60 + 20, actor: 'scene', name: 'לילה טוב', kind: 'power', from: ON, to: OFF, note: 'הופעלה ע״י יואב כהן' },
    { ago: 24 * 60 + 600, actor: 'automation', name: 'זריחה', kind: 'power', from: OFF, to: ON },
    { ago: 24 * 60 + 610, actor: 'system', kind: 'availability', from: { state: 'unavailable' }, to: OFF, note: 'אחרי הפסקת חשמל' },
    { ago: 48 * 60 + 5, actor: 'unknown', kind: 'power', from: ON, to: OFF, confidence: 'unknown' },
  ];
  // enough for a second page
  for (let i = 0; i < 60; i++) rows.push({ ago: 3 * 24 * 60 + i * 97, actor: i % 3 === 0 ? 'person' : 'schedule', name: i % 3 === 0 ? 'יואב כהן' : 'תזמון לילה', kind: 'power', from: i % 2 ? ON : OFF, to: i % 2 ? OFF : ON });
  return rows;
}

const PAGE = 50;

export function demoActivity(entityId: string, q: ActivityQuery, now = Date.now()): ActivityPage {
  const all: ActivityItem[] = seedsOf(entityId)
    .map((s, i) => ({
      id: `${entityId}#${i}`,
      at: new Date(now - s.ago * MIN).toISOString(),
      kind: s.kind,
      attribute: s.attribute ?? null,
      actor: { type: s.actor, name: s.name ?? null },
      source: s.actor === 'automation' || s.actor === 'schedule' || s.actor === 'scene' ? { type: s.actor, name: s.name ?? null } : null,
      from: s.from,
      to: s.to,
      unit: s.unit ?? null,
      via: s.actor === 'person' ? ('arx' as const) : s.actor === 'device' ? ('device' as const) : ('ha' as const),
      confidence: s.confidence ?? ('exact' as const),
      note: s.note ?? null,
    }))
    .sort((a, b) => b.at.localeCompare(a.at));
  const rows = all.filter((x) => (!q.actor || x.actor.type === q.actor) && (!q.kind || x.kind === q.kind) && (!q.since || x.at >= q.since) && (!q.until || x.at <= q.until));
  const off = q.cursor ? Number(q.cursor) || 0 : 0;
  const limit = q.limit ?? PAGE;
  const items = rows.slice(off, off + limit);
  return {
    items,
    next_cursor: off + limit < rows.length ? String(off + limit) : null,
    retention_days: 90,
    coverage: { from: new Date(now - 6 * 24 * 3600_000).toISOString(), gaps: [] },
    availability: 'ok',
  };
}
