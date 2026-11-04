import type { Page, Route } from '@playwright/test';
import { installAccessMock, type Persona } from './access-control-mocks';

// WISKEY-PROFILES-EDIT-2390: the groups and profile fields editor's mock, layered over tests/access-control-mocks.ts (a route registered later
// answers first). The wire follows routers/access_control_profiles.py. Every group, field, person and station here is INVENTED sample data;
// nothing reaches the access-control system, a station or a door.

export interface ProfilesOptions {
  persona?: Persona;
  /** the apply's answer: ok (saved, read back), unknown (no clear answer; the check then says applied), stale (refused: the review is stale) */
  apply?: 'ok' | 'unknown' | 'stale';
  /** the preview finds duplicates in a unique field (cannot be applied) */
  duplicates?: boolean;
  /** parts the installed version does not offer */
  unsupported?: ('edit' | 'versions' | 'compare' | 'suggestions')[];
}

export interface ProfilesMock {
  posts: { path: string; body: Record<string, unknown> }[];
  reads: string[];
}

const STATIONS = [
  { id: 'entry-a', name: 'כניסה ראשית', online: true, lock_enabled: true },
  { id: 'entry-b', name: 'חניון', online: true, lock_enabled: true },
  { id: 'entry-c', name: 'דלת אחורית', online: false, lock_enabled: true },
  { id: 'entry-d', name: 'מחסן', online: true, lock_enabled: false },
];

export const POLICY = {
  revision: 7,
  photo_enabled: true,
  templates: 1,
  fields: [
    { id: 'department', label: 'מחלקה', enabled: true, type: 'select', required: false, unique: false, options: ['הנדסה', 'ביטחון', 'הנהלה'], depends_on: null },
    { id: 'badge', label: 'מספר תג', enabled: true, type: 'text', required: false, unique: false, options: [], depends_on: null },
    { id: 'shift', label: 'משמרת', enabled: true, type: 'select', required: false, unique: false, options: ['בוקר', 'לילה'], depends_on: { field_id: 'department', value: 'ביטחון' } },
  ],
  groups: [
    { id: 'staff', label: 'צוות', enabled: true, station_ids: ['entry-a', 'entry-b'] },
    { id: 'night', label: 'משמרת לילה', enabled: true, station_ids: ['entry-c'] },
    { id: 'visitors', label: 'מבקרים', enabled: false, station_ids: null },
  ],
};

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const fail = (route: Route, status: number, code: string, message: string, details: Record<string, unknown> = {}) =>
  json(route, { code, user_message: message, retryable: false, correlation_id: 'mock', details }, status);

export async function installProfilesMock(page: Page, o: ProfilesOptions = {}): Promise<ProfilesMock> {
  const persona = o.persona ?? 'admin';
  await installAccessMock(page, { persona });
  const mock: ProfilesMock = { posts: [], reads: [] };
  const canEdit = persona === 'admin' || persona === 'siteAdmin';
  let revision = POLICY.revision;
  let reviewValues: unknown = null;
  const feature = (part: string) => ({ available: !(o.unsupported ?? []).includes(part as never), reason: (o.unsupported ?? []).includes(part as never) ? 'not_listed' : null });
  // the person search of the suggestions tab (the people read of routers/access_control_reads.py, two invented people)
  await page.route(/\/api\/v1\/access-control\/people(\?|$)/, async (route) => {
    mock.reads.push('people');
    const head = { state: 'ready', configured: true, last_error: null, fetched_at: '2026-09-27T10:30:00Z', fresh: true, sync: { state: 'ready' } };
    const rec = (id: string, name: string) => ({ id, display_name: name, active: true, archived: false, valid_from: null, valid_until: null, revision: 3, employee_no: null, groups: [],
                                                 stations: [], phone: null, profile: null, photo_configured: null, responsible_person: null, access_purpose: null, timing: null });
    return json(route, { ...head, people: { records: [rec('p1', 'דנה לוי'), rec('p3', 'עומר כהן')], total: 2, total_all: 2, offset: 0, limit: 20, next_offset: null, previous_offset: null,
                                            snapshot: 's', stale: false } });
  });
  await page.route('**/api/v1/access-control/profiles**', async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const p = u.pathname.replace(/^.*\/api\/v1\//, '');
    const body = req.method() === 'GET' ? {} : ((req.postDataJSON() as Record<string, unknown>) ?? {});
    if (req.method() !== 'GET') mock.posts.push({ path: p, body });
    else mock.reads.push(p + u.search);
    if (p === 'access-control/profiles/access') return json(route, { can_edit: canEdit, sensitive: canEdit });
    if (!canEdit) return fail(route, 403, 'forbidden', 'אין הרשאה (בדיקה).');
    if (p === 'access-control/profiles') {
      return json(route, {
        state: 'ready', configured: true, last_error: null, fetched_at: '2026-09-27T10:30:00Z', stations: STATIONS,
        policy: { ...POLICY, revision }, features: { view: feature('view'), edit: feature('edit'), versions: feature('versions'), compare: feature('compare'), suggestions: feature('suggestions') },
      });
    }
    if (p === 'access-control/profiles/preview') {
      reviewValues = body.values;
      const dup = !!o.duplicates;
      return json(route, {
        review_id: 'a'.repeat(32), base_revision: body.revision, expires_at: new Date(Date.now() + 290_000).toISOString().replace(/\.\d{3}Z$/, 'Z'),
        values: body.values,
        diff: [{ kind: 'groups', id: 'staff', label: 'צוות', state: 'changed', changes: [{ property: 'station_ids', before: ['entry-a', 'entry-b'], after: ['entry-a', 'entry-b', 'entry-c'] }] }],
        impact: {
          people: [
            { user_id: 'p1', display_name: 'דנה לוי', employee_no: 'E-100', before: ['entry-a', 'entry-b'], after: ['entry-a', 'entry-b', 'entry-c'], changed: true, overrides: 0 },
            { user_id: 'p2', display_name: 'יעל בר', employee_no: 'E-102', before: ['entry-a', 'entry-b', 'entry-c'], after: ['entry-a', 'entry-b', 'entry-c'], changed: false, overrides: 1 },
          ],
          people_truncated: false, changed: 1, stations: ['entry-a', 'entry-b', 'entry-c'], offline: ['entry-c'],
          field_changes: dup
            ? [{ field_id: 'badge', label: 'מספר תג', new: false, checked: 3, applicable: 3, inactive: 0, newly_applicable: 0, missing: 0, invalid: 0, previous_issues: 0, duplicates: 2,
                 template_issues: 0, required: false, unique: true, examples: [], duplicate_examples: [{ display_name: 'דנה לוי', employee_no: 'E-100', archived: false },
                 { display_name: 'עומר כהן', employee_no: 'E-101', archived: false }], examples_truncated: false }]
            : [],
          can_apply: !dup, requires_confirmation: true, expires_in: 300, device_writes: 0,
          station_names: Object.fromEntries(STATIONS.map((s) => [s.id, s.name])),
        },
      });
    }
    if (p === 'access-control/profiles/apply') {
      if (o.apply === 'stale') return fail(route, 409, 'profiles_review_stale', 'הנתונים השתנו מאז התצוגה המקדימה (בדיקה).', { outcome: 'refused', wiskey_code: 'bulk_review_stale' });
      if (o.apply === 'unknown') return fail(route, 504, 'profiles_outcome_unknown', 'לא התקבלה תשובה ברורה (בדיקה).', { outcome: 'unknown', wiskey_code: 'storage_or_internal_error' });
      revision += 1;
      return json(route, {
        status: 'saved', review_id: body.review_id, command_id: 'c'.repeat(32), revision_before: revision - 1,
        receipt: { saved_at: '2026-09-27T10:31:00Z', stations: ['entry-a', 'entry-b', 'entry-c'], changed: 1, station_names: Object.fromEntries(STATIONS.map((s) => [s.id, s.name])) },
        readback: { state: 'ready', revision, matches: true, unchanged: false, last_error: null }, sync: 'requested', physical_result: 'not_verified',
      });
    }
    const check = /^access-control\/profiles\/reviews\/([0-9a-f]{32})\/check$/.exec(p);
    if (check) {
      revision = POLICY.revision + 1;
      const readback = { state: 'ready', revision, matches: true, unchanged: false, last_error: null };
      return json(route, { review_id: check[1], verdict: 'applied', readback,
                           result: { status: 'saved', review_id: check[1], revision_before: POLICY.revision, receipt: null, readback, sync: 'unknown', physical_result: 'not_verified', confirmed_by: 'readback' } });
    }
    if (p === 'access-control/profiles/versions') {
      return json(route, { fetched_at: '2026-09-27T10:30:00Z', versions: {
        records: [
          { revision: 7, saved_at: '2026-09-25T08:00:00Z', action: 'bulk/group_policy', origin: 'saved', field_changes: 1, group_changes: 1 },
          { revision: 5, saved_at: '2026-09-20T08:00:00Z', action: 'profiles/settings_update', origin: 'saved', field_changes: 1, group_changes: 0 },
          { revision: 3, saved_at: null, action: 'baseline', origin: 'baseline', field_changes: 0, group_changes: 0 },
        ],
        total: 3, offset: 0, next_offset: null, previous_offset: null, current_revision: revision, retained_from_revision: 3 } });
    }
    if (p === 'access-control/profiles/compare') {
      return json(route, { compare: { before_revision: Number(u.searchParams.get('before')), after_revision: Number(u.searchParams.get('after')),
        rows: [
          { kind: 'fields', id: 'badge', label: 'מספר תג', state: 'added', changes: [{ property: 'label', before: null, after: 'מספר תג' }, { property: 'enabled', before: null, after: true }] },
          { kind: 'groups', id: 'staff', label: 'צוות', state: 'changed', changes: [{ property: 'station_ids', before: ['entry-a'], after: ['entry-a', 'entry-b'] }] },
        ], summary: { fields: 1, groups: 1 } } });
    }
    const draft = /^access-control\/profiles\/versions\/(\d+)\/draft$/.exec(p);
    if (draft) {
      const values = { photo_enabled: POLICY.photo_enabled, fields: POLICY.fields.map((f) => (f.id === 'badge' ? { ...f, enabled: false } : f)),
                       groups: POLICY.groups.map((g) => (g.id === 'staff' ? { ...g, station_ids: ['entry-a'] } : g)) };
      return json(route, { target_revision: Number(draft[1]), base_revision: revision, values, rows: 2,
                           notes: [{ code: 'photo_not_versioned', id: 'photo_enabled' }, { code: 'templates_not_versioned', id: 'templates' }, { code: 'disabled_not_removed', id: 'fields.badge' }] });
    }
    if (p === 'access-control/profiles/suggestions') {
      const fields = u.searchParams.getAll('field');
      return json(route, { fetched_at: '2026-09-27T10:30:00Z', read_only: true, physical_result: 'not_verified', suggestions: {
        user_id: u.searchParams.get('user_id'), person_revision: 3, policy_revision: revision,
        fields: [{ id: 'department', label: 'מחלקה', value: 'ביטחון' }, { id: 'shift', label: 'משמרת', value: 'לילה' }], selected_fields: fields,
        suggestions: fields.length ? [{ group_id: 'night', label: 'משמרת לילה', matching_members: 4, matching_people: 5,
                                        doors: [{ station_id: 'entry-c', station_name: 'דלת אחורית', blocked: false, before: [], after: [1] }] }] : [],
        can_apply_to_draft: true } });
    }
    void reviewValues;
    return fail(route, 404, 'not_found', 'לא נמצא (בדיקה).');
  });
  return mock;
}
