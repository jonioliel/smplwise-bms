/**
 * TKRULES-291: the ONLY frontend module that talks to the rule routes of smplwise_vms/backend/smplwise/routers/tickets_rules.py
 * (all of them system.configure):
 *   GET  tickets/rules        the document + per rule today's numbers, the trigger sources, the departments, the bounds
 *   PUT  tickets/rules        the whole document with its revision (409 rules_stale, 422 details.fields)
 *   POST tickets/rules/test   the dry run of one rule (writes nothing)
 * Without a backend (static preview, design review) a small demo store answers with the same rules.
 */
import { ApiError, get, post, put } from './client';
import { isApi } from './session';
import {
  DEFAULT_BOUNDS, effectiveLimit, placeholdersOk, type DryRunAnswer, type RulesDoc, type TicketRule, type TicketRuleView,
} from '../tickets/rules-model';

export interface RulesSave {
  revision: number;
  enabled: boolean;
  daily_limit_default: number;
  rules: TicketRule[];
}

export interface RulesBackend {
  load(): Promise<RulesDoc>;
  save(body: RulesSave): Promise<RulesDoc>;
  test(rule: TicketRule): Promise<DryRunAnswer>;
}

const rest: RulesBackend = {
  load: () => get<RulesDoc>('tickets/rules'),
  save: (body) => put<RulesDoc>('tickets/rules', body),
  test: (rule) => post<DryRunAnswer>('tickets/rules/test', { rule }),
};

// ---------------------------------------------------------------- the demo store (no backend)

const DEMO_SOURCES = [
  { key: 'sensor.leak', label: 'דליפת מים', category: 'safety', subject: 'entity' },
  { key: 'device.unavailable', label: 'התקן לא זמין', category: 'device_faults', subject: 'entity' },
  { key: 'camera.offline', label: 'מצלמה לא זמינה', category: 'device_faults', subject: 'camera' },
  { key: 'opening.left_open', label: 'דלת / חלון נשארו פתוחים', category: 'doors', subject: 'entity' },
];
const DEMO_DEPTS = [
  { id: 'dept-maintenance', name: 'אחזקה', priorities: [{ id: 'p-normal', name: 'רגיל', is_default: true }, { id: 'p-high', name: 'גבוה', is_default: false }],
    categories: [{ id: 'c-plumbing', name: 'אינסטלציה' }] },
  { id: 'dept-cleaning', name: 'ניקיון', priorities: [{ id: 'p2-normal', name: 'רגיל', is_default: true }], categories: [] },
];

const demo: { revision: number; enabled: boolean; daily: number; rules: TicketRuleView[]; seq: number } = {
  revision: 2, enabled: true, daily: 20, seq: 2,
  rules: [
    { id: 'rule-demo-1', name: 'דליפת מים לאחזקה', enabled: true, source: 'sensor.leak', subject_id: '', hold_min: 2, department_id: 'dept-maintenance',
      priority_id: 'p-high', category_id: 'c-plumbing', title: '{alert} - {place}', description: '{details}', on_clear: 'comment', daily_limit: null,
      effective_limit: 20, today_created: 3, limit_reached: false, suppressed_today: 0, last_fired_at: '2026-10-19T07:12:00Z' },
    { id: 'rule-demo-2', name: 'מצלמה לא זמינה', enabled: true, source: 'camera.offline', subject_id: '', hold_min: 15, department_id: 'dept-maintenance',
      priority_id: null, category_id: null, title: '{alert}: {place}', description: '', on_clear: 'comment_close', daily_limit: 2,
      effective_limit: 2, today_created: 2, limit_reached: true, suppressed_today: 1, last_fired_at: '2026-10-19T09:40:00Z' },
  ],
};

function demoDoc(): RulesDoc {
  return {
    revision: demo.revision, enabled: demo.enabled, daily_limit_default: demo.daily, day: '2026-10-19', sources: DEMO_SOURCES, departments: DEMO_DEPTS,
    bounds: DEFAULT_BOUNDS,
    rules: demo.rules.map((r) => {
      const limit = effectiveLimit(r.daily_limit, demo.daily);
      return { ...structuredClone(r), effective_limit: limit, limit_reached: r.today_created >= limit };
    }),
  };
}

function demoErr(status: number, code: string, message: string, details: Record<string, unknown> = {}): ApiError {
  return new ApiError(status, { code, user_message: message, retryable: false, correlation_id: 'demo', details });
}

const mock: RulesBackend = {
  load: async () => demoDoc(),
  save: async (body) => {
    if (body.revision !== demo.revision) throw demoErr(409, 'rules_stale', 'הכללים השתנו בינתיים. טענו מחדש.', { revision: demo.revision });
    const bad = body.rules.findIndex((r) => !placeholdersOk(r.title, DEFAULT_BOUNDS.placeholders));
    if (bad >= 0) throw demoErr(422, 'validation', 'ערך לא תקין.', { fields: [{ field: `rules[${bad}].title`, code: 'placeholder' }] });
    const before = new Map(demo.rules.map((r) => [r.id, r]));
    demo.rules = body.rules.map((r) => {
      const old = r.id ? before.get(r.id) : undefined;
      const id = old ? old.id : `rule-demo-${++demo.seq}`;
      return { ...r, id, effective_limit: 0, today_created: old?.today_created ?? 0, limit_reached: false, suppressed_today: old?.suppressed_today ?? 0,
        last_fired_at: old?.last_fired_at ?? null };
    });
    demo.enabled = body.enabled;
    demo.daily = body.daily_limit_default;
    demo.revision += 1;
    return demoDoc();
  },
  test: async (rule) => {
    const saved = demo.rules.find((r) => r.id === rule.id);
    const limit = effectiveLimit(rule.daily_limit, demo.daily);
    const today = saved?.today_created ?? 0;
    const would = !demo.enabled ? 'rules_off' : !rule.enabled ? 'rule_off' : today >= limit ? 'suppressed' : 'create';
    const values: Record<string, string> = { alert: 'דליפת מים', details: 'חיישן מים מטבח דיווח על מים.', place: 'קומה 1', source: 'דליפת מים', since: '19/10/2026 09:30' };
    const fill = (t: string) => t.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m);
    const dept = DEMO_DEPTS.find((d) => d.id === rule.department_id);
    return {
      would, matches: 1, held: 1, effective_limit: limit, today_created: today, sample_values: false,
      alerts: [{ title: 'דליפת מים', place: 'קומה 1', first_at: '2026-10-19T06:30:00Z', held: true }],
      preview: { title: fill(rule.title), description: fill(rule.description), department: dept?.name ?? '',
        priority: dept?.priorities.find((p) => p.id === rule.priority_id)?.name ?? dept?.priorities.find((p) => p.is_default)?.name ?? '' },
    };
  },
};

export function ticketsRulesApi(): RulesBackend {
  return isApi() ? rest : mock;
}
