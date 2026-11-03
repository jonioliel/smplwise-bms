import type { Page, Route } from '@playwright/test';
import { WIRE } from './access-control-mocks';

// WISKEY-SCHED-WRITE-2390: the mocked backend of the schedule library editor, layered over the access-control mock
// (tests/access-control-mocks.ts; routes registered later win). Invented data only: no station, no integration. It answers like
// routers/access_control_schedule_writes.py and keeps the library, proposals, claims and jobs STATEFULLY (so a saved schedule appears in
// the list), RECORDS every request body, and lets a spec choose refusals, slow answers and a partial deploy.

export interface SchedMock {
  /** action -> the integration's refusal code answered once (`refused`), e.g. { create: 'revision_conflict' }. */
  refuse: Record<string, string>;
  /** action -> answered "sent, no clear answer" once. */
  unknown: Set<string>;
  /** Stations whose deploy preflight fails at the station (`authentication_failed`). */
  failAt: Set<string>;
  /** Hold the deploy jobs this many polls in `checking` before the final state. */
  checkingPolls: number;
  /** The integration allows schedule writes to the stations (rc.10: never). */
  writesEnabled: boolean;
  // state
  library: any[];
  plans: any[];
  jobs: any[];
  claims: any[];
  // recorded
  posts: { action: string; body: Record<string, any> }[];
  gets: string[];
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const NOW = '2026-09-27T10:30:00Z';
let serial = 0;
const uid = (p: string) => `${p}-${(++serial).toString(16).padStart(4, '0')}`;

export function newSchedMock(over: Partial<SchedMock> = {}): SchedMock {
  return {
    refuse: {},
    unknown: new Set(),
    failAt: new Set(),
    checkingPolls: 1,
    writesEnabled: false,
    library: clone(WIRE.schedules_library.schedules),
    plans: clone(WIRE.schedules_plans.schedules).map((p: any) => ({ ...p, bindings: { template: 1, weekly: 1, holiday_group: null, holidays: [] } })),
    jobs: clone(WIRE.schedules_operations.schedules.jobs),
    claims: [],
    posts: [],
    gets: [],
    ...over,
  };
}

const REASON: Record<string, string> = {
  revision_conflict: 'מישהו אחר שינה את הרשומה בינתיים - טענו מחדש ובדקו לפני שמנסים שוב',
  unauthorized: 'לחשבון השירות של Arx אין הרשאת ניהול לוחות זמנים ב־WisKey',
  schedule_limit: 'הספרייה מלאה (עד 100 לוחות זמנים)',
};

const CAPS = {
  template: { ids: [1, 255], name_length: [1, 32], week_ids: [1, 255], group_ids: [1, 64] },
  weekly: { ids: [1, 255], period_ids: [1, 8], max_periods: 56, precision: 'minute', weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
  holiday_group: { ids: [1, 64], name_length: [1, 32], holiday_ids: [1, 255] },
  holiday: { ids: [1, 255], period_ids: [1, 8], max_periods: 8, precision: 'minute' },
};

function station(id: string) {
  const s = WIRE.stations.stations.find((x: any) => x.id === id);
  return s ? { id, name: s.name, online: s.online, doors: (s.locks ?? []).map((l: any) => ({ index: l.physical_index, name: l.name })) } : { id, name: null, online: null, doors: [] };
}

const PEOPLE = { state: 'complete', error: null, read: 412, explicit: 37, implicit: 4, malformed: 0 };

function report(holidays: number, weekly: number) {
  return {
    checked_at: NOW,
    blockers: ['schedule_writes_unverified', 'schedule_ownership_unknown', ...(holidays ? ['schedule_plan_holiday_membership_unknown'] : [])],
    resources: [
      { kind: 'weekly', id: weekly, coverage: 'complete', state: 'different', active: false, fields: ['WeekPlanCfg'], externally_referenced: false },
      { kind: 'template', id: weekly, coverage: 'complete', state: 'not_observed', active: null, fields: [], externally_referenced: false },
    ],
    users: PEOPLE,
  };
}

export async function installSchedWritesMock(page: Page, m: SchedMock): Promise<void> {
  const previews = new Map<string, { kind: string; data: any }>();
  const pid = (kind: string, data: any = null) => {
    const id = Math.random().toString(16).slice(2).padEnd(32, '0').slice(0, 32);
    previews.set(id, { kind, data });
    return id;
  };
  const refusal = (route: Route, action: string, code: string, status = 409) =>
    json(route, { code: 'schedule_refused', user_message: `WisKey סירב - ${REASON[code] ?? code} (${code}). לא נשמר דבר.`, retryable: false, correlation_id: 'mock', details: { outcome: 'refused', wiskey_code: code, reason: REASON[code] ?? code } }, status);
  const notSent = (route: Route, code: string, message: string, status = 409) =>
    json(route, { code, user_message: message, retryable: false, correlation_id: 'mock', details: { outcome: 'not_sent' } }, status);
  const head = () => ({ state: 'ready', configured: true, last_error: null, fetched_at: NOW, fresh: true, sync: clone(WIRE.sync) });

  await page.route('**/api/v1/access-control/schedules**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\/access-control\//, '');
    if (req.method() === 'GET') {
      m.gets.push(p + url.search);
      if (p === 'schedules') return json(route, { ...head(), schedules: clone(m.library) });
      if (p === 'schedules/plans') return json(route, { ...head(), schedules: clone(m.plans) });
      if (p === 'schedules/operations') return json(route, { ...head(), schedules: { jobs: clone(m.jobs), archive: [], journal: [], claims: m.claims.map((c) => ({ id: c.id, plan_id: c.plan_id, station_id: c.station_id, created_at: c.created_at })), writes_enabled: m.writesEnabled } });
      if (p === 'schedules/claims') return json(route, { state: 'ready', last_error: null, claims: clone(m.claims) });
      if (p === 'schedules/export') return json(route, { format: 'hikvision_intercom.schedule_drafts', version: 1, schedules: m.library.map((s) => ({ name: s.name, weekly: s.weekly, holidays: s.holidays })) });
      if (p === 'schedules/jobs') {
        const ids = url.searchParams.getAll('ids');
        for (const j of m.jobs) {
          if (!ids.includes(j.id) || !['queued', 'checking'].includes(j.status)) continue;
          if (j.status === 'queued') j.status = 'checking';
          else if ((j._polls = (j._polls ?? 0) + 1) >= m.checkingPolls) {
            if (m.failAt.has(j.station_id)) Object.assign(j, { status: 'failed', error: 'authentication_failed' });
            else Object.assign(j, { status: 'blocked', blockers: ['schedule_writes_unverified', 'schedule_ownership_unknown'], ownership: 'missing' });
          }
          j.revision += 1;
        }
        const jobs = m.jobs.filter((j) => !ids.length || ids.includes(j.id));
        return json(route, { state: 'ready', last_error: null, fetched_at: NOW, jobs: clone(jobs), missing: [], writes_enabled: m.writesEnabled, done: jobs.every((j) => !['pending', 'queued', 'checking'].includes(j.status)) });
      }
      return route.fallback();
    }
    const action = /^schedules\/actions\/([a-z_]+)$/.exec(p)?.[1];
    if (!action) return route.fallback();
    const body = req.postDataJSON() as Record<string, any>;
    m.posts.push({ action, body: clone(body) });
    if (m.refuse[action]) {
      const code = m.refuse[action];
      delete m.refuse[action];
      return refusal(route, action, code, code === 'unauthorized' ? 403 : 409);
    }
    if (m.unknown.has(action)) {
      m.unknown.delete(action);
      return json(route, { code: 'schedule_outcome_unknown', user_message: 'הפקודה נשלחה אך לא התקבלה תשובה ברורה (timeout). ייתכן שנשמרה וייתכן שלא - רעננו ובדקו לפני שמנסים שוב.', retryable: false, correlation_id: 'mock', details: { outcome: 'unknown', wiskey_code: 'timeout' } }, 504);
    }
    const done = (data: any, extra: Record<string, unknown> = {}) => json(route, { action, status: 'done', command_id: uid('cmd'), at: NOW, data, ...extra });
    const read = (data: any, extra: Record<string, unknown> = {}) => json(route, { action, at: NOW, data, ...extra });
    switch (action) {
      case 'check': {
        const d = new Date(`${body.date}T12:00:00Z`);
        const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getUTCDay()];
        const periods = body.data.weekly[day] ?? [];
        const at = body.time as string;
        const inside = periods.some((x: any) => x.start <= at && at < (x.end === '24:00' ? '24:00' : x.end));
        return read({ date: body.date, time: body.time, weekday: day, source: 'weekly', holiday: null, periods, within_window: inside, applied: false }, { check_id: pid('draft', JSON.stringify(body.data)) });
      }
      case 'create':
      case 'update': {
        const pv = previews.get(body.check_id);
        if (!pv || pv.kind !== 'draft' || pv.data !== JSON.stringify(body.data)) return notSent(route, 'schedule_preview_required', 'הבדיקה המקדימה חסרה, פגה או שייכת למשתמש אחר. יש לבדוק שוב ולאשר מחדש - לא נשלח דבר.');
        previews.delete(body.check_id);
        if (action === 'create') {
          const item = { ...clone(body.data), id: uid('sch'), revision: 1, updated_at: NOW };
          m.library.push(item);
          return done(item);
        }
        const item = m.library.find((s) => s.id === body.schedule_id);
        Object.assign(item, clone(body.data), { revision: item.revision + 1, updated_at: NOW });
        return done(clone(item));
      }
      case 'delete':
        m.library = m.library.filter((s) => s.id !== body.schedule_id);
        return done({ deleted: true });
      case 'import_preview': {
        const doc = JSON.parse(body.document);
        const names = new Set(m.library.map((s) => s.name));
        return read({ count: doc.schedules.length, name_collisions: doc.schedules.filter((s: any) => names.has(s.name)).length, expires_in: 300, mode: 'append',
                      items: doc.schedules.map((s: any) => ({ name: s.name, weekly_periods: Object.values(s.weekly).flat().length, holidays: s.holidays.length })) }, { preview_id: pid('import', doc) });
      }
      case 'import_apply': {
        const pv = previews.get(body.preview_id);
        if (!pv) return notSent(route, 'schedule_preview_required', 'הבדיקה המקדימה חסרה או פגה.');
        const items = pv.data.schedules.map((s: any) => ({ ...s, id: uid('sch'), revision: 1, updated_at: NOW }));
        m.library.push(...items);
        return done(items);
      }
      case 'readiness':
        return read({ checked_at: NOW, can_apply: false, reason: 'schedule_writes_unverified', checks: Object.entries(CAPS).map(([kind, capabilities]) => ({ kind, advertised: true, capabilities, read_state: 'readable', error: null, coverage: 'complete', read: 3, total: 3 })) },
                    { impact: { station: station(body.station_id), people: null } });
      case 'assess':
        return read({ checked_at: NOW, complete: true, checks: [], assessment: { state: 'fits', requirements: { template: 1, weekly: 1, holiday_group: 0, holiday: 0, weekly_periods: 6 },
                      limits: [{ key: 'weekly_per_day', needed: 2, available: 8, state: 'fits' }, { key: 'weekly_periods', needed: 6, available: 56, state: 'fits' }], can_apply: false, inventory_complete: true,
                      blockers: ['schedule_writes_unverified', 'schedule_ownership_unknown'] }, baseline: { state: 'missing', revision: 0, checked_at: null, checks: [] } },
                    { baseline_preview_id: pid('baseline', body.station_id), impact: { station: station(body.station_id) } });
      case 'baseline_save':
        return done({ revision: 1, checked_at: NOW });
      case 'baseline_clear':
        return done({ revision: 0, checked_at: null });
      case 'plan_preview': {
        const src = m.library.find((s) => s.id === body.schedule_id);
        const plan = { id: uid('plan'), revision: 1, station_id: body.station_id, draft_id: src.id, draft_revision: src.revision, name: src.name, created_at: NOW, source_state: 'current', can_apply: false,
                       drifted_resources: [], bindings: body.bindings, report: report(src.holidays.length, body.bindings.weekly) };
        const r = plan.report;
        return read(plan, { preview_id: pid('plan', plan), impact: { station: station(body.station_id), people: r.users, blockers: r.blockers, resources: r.resources } });
      }
      case 'plan_save': {
        const pv = previews.get(body.preview_id);
        if (!pv) return notSent(route, 'schedule_preview_required', 'הבדיקה המקדימה חסרה או פגה.');
        m.plans.push(pv.data);
        return done(pv.data, { impact: { station: station(pv.data.station_id), people: PEOPLE, blockers: pv.data.report.blockers, resources: pv.data.report.resources } });
      }
      case 'plan_recheck': {
        const plan = m.plans.find((x) => x.id === body.plan_id);
        plan.revision += 1;
        return done(clone(plan));
      }
      case 'plan_delete':
        m.plans = m.plans.filter((x) => x.id !== body.plan_id);
        return done({ deleted: true });
      case 'claim_preview':
        return read({ plan_id: body.plan_id, plan_revision: body.revision, resource_keys: ['weekly:1', 'template:1'], report: null }, { preview_id: pid('claim', body.plan_id), impact: { station: null } });
      case 'claim_confirm': {
        const pv = previews.get(body.preview_id)!;
        const plan = m.plans.find((x) => x.id === pv.data);
        const c = { id: uid('claim'), revision: 1, plan_id: pv.data, station_id: plan?.station_id ?? null, created_at: NOW, resource_keys: ['weekly:1', 'template:1'] };
        m.claims.push(c);
        return done(c);
      }
      case 'claim_release':
        m.claims = m.claims.filter((c) => c.id !== body.claim_id);
        return done({ released: true });
      case 'deploy': {
        const results = body.plans.map((x: any) => {
          const plan = m.plans.find((y) => y.id === x.plan_id);
          if (!plan) return { plan_id: x.plan_id, station: null, people: null, status: 'not_sent', code: 'schedule_plan_not_found', reason: 'ההצעה לא נמצאה' };
          if (m.refuse[`deploy:${plan.station_id}`]) {
            const code = m.refuse[`deploy:${plan.station_id}`];
            return { plan_id: x.plan_id, station: station(plan.station_id), people: PEOPLE, status: 'refused', code, reason: REASON[code] ?? code };
          }
          const job = { id: uid('job'), revision: 2, plan_id: plan.id, plan_revision: plan.revision, station_id: plan.station_id, name: plan.name, status: 'queued', error: null,
                        blockers: ['schedule_writes_unverified'], ownership: 'not_checked', created_at: NOW, updated_at: NOW, resource_keys: ['weekly:1'] };
          m.jobs.push(job);
          return { plan_id: x.plan_id, station: station(plan.station_id), people: PEOPLE, status: 'queued', code: null, reason: null, job: clone(job) };
        });
        const summary = { queued: 0, refused: 0, unknown: 0, not_sent: 0 } as Record<string, number>;
        for (const r of results) summary[r.status] += 1;
        return json(route, { action: 'deploy', status: 'done', at: NOW, results, summary });
      }
      case 'job_check':
      case 'job_cancel':
      case 'job_archive': {
        const job = m.jobs.find((j) => j.id === body.job_id);
        if (action === 'job_archive') {
          m.jobs = m.jobs.filter((j) => j.id !== body.job_id);
          return done({ archived: true });
        }
        Object.assign(job, { status: action === 'job_check' ? 'queued' : 'cancelled', revision: job.revision + 1 });
        return done(clone(job));
      }
    }
    return json(route, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }, 404);
  });
}
