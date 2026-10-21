import type { Page, Route } from '@playwright/test';
import { installAccessMock, PERMS, type AccessMock, type Persona } from './access-control-mocks';

// SHAREDID-293: the external-access screen's mock, layered over tests/access-control-mocks.ts (a route registered later answers first). The
// grant objects follow services/access_grants.present() + _screen_fields (the wire of GET /access-grants); every name, company, ticket and
// time is INVENTED sample data (the mockup's), no PIN anywhere. Nothing here reaches a WisKey, a station, a door or WhatsApp.

export const XNOW = new Date('2026-10-20T07:20:00Z'); // Tuesday 10:20 in Jerusalem (UTC+3)
const iso = (s: string) => `${s}Z`;

interface G {
  id: string;
  state: string;
  name: string;
  company: string | null;
  category?: 'contractor' | 'visitor';
  stations: [string, string, number[]][];
  vf: string;
  vu: string;
  source?: 'ticket' | 'rfq_order' | 'manual';
  ref?: string | null;
  code?: string | null;
  number?: string | null;
  sends?: number;
  verified?: boolean;
  needs_push?: boolean;
  pending?: boolean;
  amend?: [string, number[]][];
  link?: { origin: 'created_from_arx' | 'matched'; state: 'linked' | 'wiskey_missing' | 'unlinking' } | null;
  unresolved?: boolean;
  revoking_since?: string | null;
  end_reason?: string | null;
  ended_at?: string | null;
  approved?: string | null;
  closure?: boolean;
  notice?: boolean;
  timing?: string[];
}

const SAMPLE: G[] = [
  { id: 'g01', state: 'requested', pending: true, name: 'מוחמד חסן', company: 'אלקום חשמל', stations: [['base', 'מרתף', [1]]], vf: '2026-10-22T04:00:00', vu: '2026-10-23T13:00:00', source: 'rfq_order', ref: 'RFQ-2291', code: 'pending', number: '····08', link: null, notice: true },
  { id: 'g02', state: 'requested', name: 'יוסי אברהם', company: 'קר־טק מיזוג', stations: [['lobby', 'לובי ראשי', [1]], ['base', 'מרתף', [1]]], vf: '2026-10-21T04:00:00', vu: '2026-10-22T13:00:00', source: 'ticket', ref: 'T-1842', code: 'pending', number: '····42', link: null, notice: true, timing: ['07:00', '16:00'] },
  { id: 'g03', state: 'active', name: 'אלכס פטרוב', company: 'פ.א. מערכות כיבוי', stations: [['lobby', 'לובי ראשי', [1]]], vf: '2026-10-19T04:00:00', vu: '2026-10-23T13:00:00', source: 'rfq_order', ref: 'RFQ-2284', code: 'sent', number: '····71', sends: 1, link: { origin: 'created_from_arx', state: 'linked' }, amend: [['lobby', [1]], ['base', [1]]], approved: '2026-10-18T08:05:00', notice: true },
  { id: 'g04', state: 'approved', name: 'דנה לוי', company: 'ברק ניקיון', stations: [['lobby', 'לובי ראשי', [1]], ['kitchen', 'מטבח', [1]]], vf: '2026-10-20T04:00:00', vu: '2026-10-24T09:00:00', source: 'manual', code: 'pending', number: '····65', link: null, approved: '2026-10-20T07:18:00', notice: true },
  { id: 'g05', state: 'active', verified: true, name: 'רונן כהן', company: 'אוטיס מעליות', stations: [['roof', 'גג', [1]], ['base', 'מרתף', [1]]], vf: '2026-10-19T04:00:00', vu: '2026-10-21T17:00:00', source: 'ticket', ref: 'T-1830', code: 'sent', number: '····90', sends: 1, link: { origin: 'created_from_arx', state: 'linked' }, approved: '2026-10-18T06:40:00', notice: true },
  { id: 'g06', state: 'active', name: 'שירן מזרחי', company: null, category: 'visitor', stations: [['lobby', 'לובי ראשי', [1, 2]]], vf: '2026-10-20T05:00:00', vu: '2026-10-20T14:00:00', source: 'manual', code: 'sent', number: '····17', sends: 1, link: { origin: 'created_from_arx', state: 'linked' }, approved: '2026-10-19T14:40:00', notice: true },
  { id: 'g07', state: 'active', needs_push: true, name: 'אבי שושן', company: 'שושן אינסטלציה', stations: [['kitchen', 'מטבח', [1]]], vf: '2026-10-18T04:00:00', vu: '2026-10-25T13:00:00', source: 'ticket', ref: 'T-1838', code: 'not_delivered', number: '····33', sends: 1, link: { origin: 'created_from_arx', state: 'linked' }, approved: '2026-10-18T05:15:00', notice: true },
  { id: 'g08', state: 'revoking', name: 'ניר גבאי', company: 'גבאי חשמל', stations: [['park', 'חניון', [1]], ['base', 'מרתף', [1]]], vf: '2026-10-17T04:00:00', vu: '2026-10-21T13:00:00', source: 'ticket', ref: 'T-1827', code: 'sent', number: '····26', link: { origin: 'created_from_arx', state: 'linked' }, revoking_since: '2026-10-20T05:12:00', end_reason: 'ticket_ended', approved: '2026-10-16T05:00:00', notice: true },
  { id: 'g09', state: 'revoking', name: 'משה ביטון', company: 'ביטון שיפוצים', stations: [['lobby', 'לובי ראשי', [1]], ['park', 'חניון', [2]]], vf: '2026-10-15T04:00:00', vu: '2026-10-19T13:00:00', source: 'rfq_order', ref: 'RFQ-2270', code: 'sent', number: '····54', link: { origin: 'created_from_arx', state: 'wiskey_missing' }, revoking_since: '2026-10-19T05:40:00', end_reason: 'wiskey_missing', approved: '2026-10-14T05:00:00', notice: true },
  { id: 'g10', state: 'unknown', name: 'עומר דהן', company: 'דהן תקשורת', stations: [['lobby', 'לובי ראשי', [1]], ['l2', 'קומה 2', [1]]], vf: '2026-10-20T05:00:00', vu: '2026-10-21T14:00:00', source: 'ticket', ref: 'T-1845', code: 'pending', number: '····12', link: null, unresolved: true, approved: '2026-10-20T07:15:00', notice: true },
  { id: 'g11', state: 'revoking', name: 'סהר יונס', company: 'יונס גינון', stations: [['park', 'חניון', [2]]], vf: '2026-10-20T04:00:00', vu: '2026-10-20T09:00:00', source: 'manual', code: 'not_delivered', number: '····81', link: null, unresolved: true, revoking_since: '2026-10-20T06:31:00', end_reason: 'failed', approved: '2026-10-20T06:30:00', notice: true },
  { id: 'g12', state: 'revoked', name: 'קובי אלון', company: 'אלון מנעולים', stations: [['lobby', 'לובי ראשי', [1]]], vf: '2026-10-17T04:00:00', vu: '2026-10-18T13:00:00', source: 'ticket', ref: 'T-1811', code: 'sent', number: '····39', link: { origin: 'created_from_arx', state: 'linked' }, revoking_since: '2026-10-18T07:00:00', end_reason: 'manual', ended_at: '2026-10-18T07:01:00', approved: '2026-10-16T05:00:00', notice: true },
  { id: 'g13', state: 'ended', closure: true, name: 'לאה פרץ', company: 'פרץ הדברה', stations: [['kitchen', 'מטבח', [1]]], vf: '2026-10-16T04:00:00', vu: '2026-10-16T09:00:00', source: 'ticket', ref: 'T-1802', code: 'sent', number: '····58', link: { origin: 'created_from_arx', state: 'wiskey_missing' }, revoking_since: '2026-10-16T09:00:00', end_reason: 'wiskey_missing', ended_at: '2026-10-19T08:00:00', approved: '2026-10-15T05:00:00', notice: true },
  { id: 'g14', state: 'refused', name: 'גיל נחום', company: null, category: 'visitor', stations: [['l2', 'קומה 2', [1]]], vf: '2026-10-15T05:00:00', vu: '2026-10-15T14:00:00', source: 'manual', code: 'pending', number: '····64', link: null, ended_at: '2026-10-14T08:00:00', end_reason: 'refused' },
];

export function grantOf(s: G, sensitive = true): Record<string, unknown> {
  const doors = s.stations.map(([id, name, relays]) => ({ station_id: id, name, relays }));
  const accepted = s.state === 'active' && !s.needs_push;
  const verified = accepted && !!s.verified;
  const tid = s.id.padEnd(32, '0');
  return {
    grant_state: s.state, needs_push: !!s.needs_push, pending_sync: ['approved', 'provisioning', 'unknown'].includes(s.state) || (s.state === 'active' && !!s.needs_push), scope_verified: verified,
    scope_verified_at: verified ? '2026-10-20T07:02:00Z' : null, doors_state: verified ? 'verified_central' : accepted ? 'accepted' : ['requested', 'approved', 'provisioning', 'active', 'revoking', 'unknown'].includes(s.state) ? 'desired' : null,
    id: tid, revision: 3, state: s.state, end_reason: s.end_reason ?? null, source: s.source ?? 'manual', source_ref: s.ref ?? null,
    person: { contact_id: `c-${s.id}`, name: s.name, pending: !!s.pending, number: sensitive ? s.number ?? null : null },
    doors, valid_from: iso(s.vf), valid_until: iso(s.vu), timing: s.timing ? { periods: [{ start: s.timing[0], end: s.timing[1] }] } : null, credential: 'pin', outside_window: false,
    pending_amendment: s.amend ? { doors: Object.fromEntries(s.amend), valid_from: iso(s.vf), valid_until: '2026-10-27T13:00:00Z', timing: null, credential: 'pin' } : null,
    approved_by: s.approved ? 'u-admin' : null, approved_at: s.approved ? iso(s.approved) : null,
    code_state: sensitive ? s.code ?? null : null, code_due_at: sensitive && s.code === 'pending' ? '2026-10-21T15:00:00Z' : null, code_sends: sensitive ? s.sends ?? 0 : null,
    notice: s.notice ? [{ via: 'page', version: 'n2', at: '2026-10-19T13:12:00Z' }] : [],
    attention: s.state === 'revoking' ? 'revoke_pending' : s.code === 'not_delivered' ? 'code_not_delivered' : s.state === 'unknown' ? 'unknown' : null,
    linked: !!s.link,
    created_at: iso(s.approved ?? s.vf), updated_at: '2026-10-20T07:00:00Z', ended_at: s.ended_at ? iso(s.ended_at) : null, revoking_since: s.revoking_since ? iso(s.revoking_since) : null,
    approved_by_name: s.approved ? 'מיכל ש.' : null,
    link: s.link ? { id: `l-${s.id}`, ...s.link } : null, create_unresolved: !!s.unresolved,
    closure: s.closure ? { kind: 'confirmed_gone', closed_at: '2026-10-19T08:00:00Z', closed_by_name: 'משה ש.', reappeared_at: null } : null,
    company: s.company, category: s.category ?? 'contractor',
  };
}

export const DIGEST = {
  period: { from: '2026-10-11T05:00:00Z', until: '2026-10-18T05:00:00Z' },
  schedule: { day: 0, hour: 8, channel: 'app' },
  counts: { requests: 11, approved: 9, refused: 2, ended_or_revoked: 6, confirmed_gone: 1, closed_no_person: 1, codes_sent: 8, codes_replaced: 1, codes_not_delivered: 1 },
  slow_revokes: [{ grant_id: 'g08'.padEnd(32, '0'), name: 'ניר גבאי', open: true, minutes: 128 }, { grant_id: 'g09'.padEnd(32, '0'), name: 'משה ביטון', open: true, minutes: 1540 }],
  approvers: [{ user_id: 'u-1', name: 'מיכל ש.', count: 5 }, { user_id: 'u-2', name: 'רפי ב.', count: 3 }, { user_id: 'u-3', name: 'דוד כ.', count: 1 }],
  gaps: [
    { kind: 'name', link_id: 'l-g05', contact_id: 'c-g05', name: 'רונן כהן' },
    { kind: 'scope', grant_id: 'g06'.padEnd(32, '0'), contact_id: 'c-g06', name: 'שירן מזרחי' },
    { kind: 'idle_person', link_id: 'l-g12', contact_id: 'c-g12', name: 'קובי אלון', since: '2026-10-18T07:01:00Z' },
  ],
};

// GRANTSMIN-295: the drift view's wire (services/access_external.drift): per person, the differences most urgent first. Invented sample data.
const gid = (s: string) => s.padEnd(32, '0');
export const DRIFT = {
  enabled: true, name_sync: 'manual', in_sync: 2,
  rows: [
    { link_id: 'l-g09', contact_id: 'c-g09', subject_kind: 'contact', name: 'משה ביטון', company: 'ביטון שיפוצים', origin: 'created_from_arx', link_state: 'wiskey_missing',
      grant: { id: gid('g09'), state: 'revoking', doors: [{ station_id: 'lobby', name: 'לובי ראשי' }, { station_id: 'park', name: 'חניון' }] },
      diffs: [{ kind: 'missing', grant_id: gid('g09') }], name_checked_at: '2026-10-19T06:00:00Z', scope_checked_at: '2026-10-19T05:40:00Z', can: { push_name: false, read_now: true } },
    { link_id: 'l-g06', contact_id: 'c-g06', subject_kind: 'contact', name: 'שירן מזרחי', company: null, origin: 'created_from_arx', link_state: 'linked',
      grant: { id: gid('g06'), state: 'active', doors: [{ station_id: 'lobby', name: 'לובי ראשי' }] },
      diffs: [{ kind: 'scope', grant_id: gid('g06') }], name_checked_at: null, scope_checked_at: '2026-10-20T07:02:00Z', can: { push_name: false, read_now: true } },
    { link_id: 'l-g07', contact_id: 'c-g07', subject_kind: 'contact', name: 'אבי שושן', company: 'שושן אינסטלציה', origin: 'created_from_arx', link_state: 'linked',
      grant: { id: gid('g07'), state: 'active', doors: [{ station_id: 'kitchen', name: 'מטבח' }] },
      diffs: [{ kind: 'sync_pending', grant_id: gid('g07') }], name_checked_at: null, scope_checked_at: '2026-10-20T06:10:00Z', can: { push_name: false, read_now: true } },
    { link_id: 'l-g05', contact_id: 'c-g05', subject_kind: 'contact', name: 'רונן כהן', company: 'אוטיס מעליות', origin: 'created_from_arx', link_state: 'linked',
      grant: { id: gid('g05'), state: 'active', doors: [{ station_id: 'roof', name: 'גג' }, { station_id: 'base', name: 'מרתף' }] },
      diffs: [{ kind: 'name' }], name_checked_at: '2026-10-20T07:02:00Z', scope_checked_at: '2026-10-20T07:02:00Z', can: { push_name: true, read_now: true } },
    { link_id: 'l-g12', contact_id: 'c-g12', subject_kind: 'contact', name: 'קובי אלון', company: 'אלון מנעולים', origin: 'created_from_arx', link_state: 'linked', grant: null,
      diffs: [{ kind: 'idle_person', since: '2026-10-18T07:01:00Z' }], name_checked_at: '2026-10-17T06:00:00Z', scope_checked_at: null, can: { push_name: false, read_now: false } },
  ],
};

export interface ExternalMock {
  access: AccessMock;
  posts: { path: string; body: unknown }[];
  settingsPuts: Record<string, unknown>[];
  /** GRANTSMIN-295: the CSV requests (their query strings) */
  exports: string[];
  /** SHAREDUI-295: how many times the screen asked for the list */
  listCalls: number;
}

export interface ExternalOptions {
  persona?: Persona;
  /** TICKGATE-295: the tickets module is on (the request form's ticket link needs it) */
  ticketsOn?: boolean;
  /** off (default true): the build as shipped - the switch is off and the go-live permit absent */
  enabled?: boolean;
  empty?: boolean;
  systemAdmin?: boolean;
  /** ACCESSREQ-293: the caller may open the manual request form (default true) */
  mayRequest?: boolean;
  /** GRANTSMIN-295: no differences (every person matches) */
  noDrift?: boolean;
  /** GRANTSMIN-295: the CSV answers 429 export_rate */
  exportRate?: boolean;
  /** SHAREDUI-295: WisKey does not answer (the list's `wiskey` freshness); `noCopy`: and Arx holds no copy either */
  wiskeyOffline?: boolean | 'noCopy';
  /** SHAREDUI-295: GET /access-grants fails - always (the first load), or after the first answer (a poll that fails: stale) */
  listFails?: 'always' | 'after-first';
  /** SHAREDUI-295: the identity card's GET fails with a server error (not a 404) */
  identityFails?: boolean;
  /** SHAREDUI-295: what POST /read-now answers: the same unknown grant (default), a now-active grant, or a refusal */
  readNow?: 'still' | 'settled' | 'error';
  /** GRANTS3-295: the cards switch is on and the list carries an active card grant (g15) waiting for its card */
  cards?: boolean;
}

// GRANTS3-295: an active CARD grant waiting for its card (invented sample data) and the owner's per-grant history (ids / codes only)
const CARD_GRANT: G = { id: 'g15', state: 'active', name: 'איתי ברק', company: 'ברק מעליות', stations: [['base', 'מרתף', [1]], ['roof', 'גג', [1]]], vf: '2026-10-20T04:00:00',
  vu: '2026-10-24T13:00:00', source: 'ticket', ref: 'T-1850', code: null, number: '····27', link: { origin: 'created_from_arx', state: 'linked' }, approved: '2026-10-20T06:50:00', notice: true };
export const HISTORY = [
  { at: '2026-10-19T13:12:00Z', action: 'request', decision: 'allowed', reason: null, by: { kind: 'page', name: null }, facts: { source: 'ticket', doors: 2 } },
  { at: '2026-10-19T13:12:00Z', action: 'notice_ack', decision: 'allowed', reason: null, by: { kind: 'page', name: null }, facts: { via: 'page', version: 'n2' } },
  { at: '2026-10-20T06:40:00Z', action: 'approve', decision: 'denied', reason: 'self_approval', by: { kind: 'user', name: 'רפי ב.' }, facts: {} },
  { at: '2026-10-20T06:50:00Z', action: 'approve', decision: 'allowed', reason: null, by: { kind: 'user', name: 'מיכל ש.' }, facts: { credential: 'card', doors: 2 } },
  { at: '2026-10-20T06:50:05Z', action: 'provision', decision: 'allowed', reason: null, by: { kind: 'system', name: null }, facts: { attempt: 1 } },
  { at: '2026-10-20T06:50:07Z', action: 'activate', decision: 'allowed', reason: null, by: { kind: 'system', name: null }, facts: { doors: 2 } },
];

export async function installExternalMock(page: Page, o: ExternalOptions = {}): Promise<ExternalMock> {
  const persona = o.persona ?? 'admin';
  const access = await installAccessMock(page, { persona, ticketsOn: o.ticketsOn });
  const st: ExternalMock = { access, posts: [], settingsPuts: [], exports: [], listCalls: 0 };
  const screen = { digest_channel: 'app', digest_day: 0, digest_hour: 8, name_sync: 'manual', placement: 'access' };
  const enabled = o.enabled ?? true;
  const admin = o.systemAdmin ?? true;
  const grants = o.empty ? [] : SAMPLE.map((s) => grantOf(s));
  if (o.cards && !o.empty) grants.unshift({ ...grantOf(CARD_GRANT), credential: 'card', code_state: 'not_needed', card_state: 'awaiting' });
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const extra = ['access.external.grant', 'tickets.configure'];
  await page.route('**/api/v1/me', (route) => {
    const p = PERMS[persona];
    return json(route, {
      user: { id: `u-${persona}`, username: persona, display_name: 'מנהל מערכת', source: 'ingress' }, channel: 'local', remote: null, bindings: [],
      permissions_installation: [...p.installation, ...extra], permissions_any: [...p.any, ...extra],
      has_access: true, permission_revision: 1, bootstrap_state: 'done',
    });
  });
  await page.route('**/api/v1/access-grants**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    if (method === 'GET' && p === 'access-grants') {
      st.listCalls += 1;
      if (o.listFails === 'always' || (o.listFails === 'after-first' && st.listCalls > 1)) {
        return json(route, { code: 'service_unavailable', user_message: 'השרת לא זמין כרגע.', retryable: true, correlation_id: 'mock', details: {} }, 503);
      }
      const wiskey = o.wiskeyOffline
        ? { reachable: false, as_of: o.wiskeyOffline === 'noCopy' ? null : '2026-10-20T07:14:00Z', has_copy: o.wiskeyOffline !== 'noCopy' }
        : { reachable: true, as_of: '2026-10-20T07:19:00Z', has_copy: true };
      return json(route, {
        grants, enabled, system_admin: admin, screen, may_request: o.mayRequest ?? true, wiskey,
        rules: { external_grants: enabled ? 'on' : 'off', go_live_permitted: enabled, max_days: 14, max_doors: 4, phone_fresh_days: 180, code_hour: 18, local_approvers: 'off',
          cards: o.cards ? 'on' : 'off', card_capture: 'off' },
      });
    }
    if (method === 'GET' && p === 'access-grants/digest') return json(route, { digest: DIGEST });
    if (method === 'GET' && p === 'access-grants/drift') return json(route, { drift: enabled ? (o.noDrift ? { ...DRIFT, rows: [], in_sync: 7 } : DRIFT) : { ...DRIFT, enabled: false, rows: [], in_sync: 0 } });
    if (method === 'GET' && p === 'access-grants/export.csv') {
      st.exports.push(url.search);
      if (o.exportRate) return json(route, { code: 'export_rate', user_message: 'אפשר לייצא פעם בדקה.', retryable: true, correlation_id: 'mock', details: { retry_after_s: 40 } }, 429);
      return route.fulfill({ status: 200, contentType: 'text/csv; charset=utf-8', headers: { 'Content-Disposition': 'attachment; filename="external-access-20261020-1020.csv"', 'X-Export-Rows': String(grants.length) },
        body: '﻿"שם","מצב"\r\n"רונן כהן","פעיל · אומת"\r\n' });
    }
    if (p === 'access-grants/settings') {
      if (method === 'PUT') {
        const body = JSON.parse(req.postData() ?? '{}') as Record<string, unknown>;
        st.settingsPuts.push(body);
        Object.assign(screen, body);
      }
      return json(route, { external_grants: 'off', go_live_permitted: false, max_days: 14, max_days_cap: 14, max_doors: 4, phone_fresh_days: 180, code_hour: 18, local_approvers: 'off', ...screen });
    }
    const ident = /^access-grants\/contacts\/([^/]+)\/identity$/.exec(p);
    if (ident && o.identityFails) return json(route, { code: 'service_unavailable', user_message: 'השרת לא זמין כרגע.', retryable: true, correlation_id: 'mock', details: {} }, 503);
    if (ident) {
      const g = grants.find((x) => (x.person as { contact_id: string }).contact_id === ident[1]) as Record<string, any> | undefined;
      if (!g) return json(route, { code: 'access_identity_not_found', user_message: 'לא נמצא.', retryable: false, correlation_id: 'mock', details: {} }, 404);
      const link = g.link ? { ...g.link, linked_at: '2026-10-17T06:00:00Z', name_drift: g.id.startsWith('g05') } : null;
      const unresolved = g.create_unresolved ? { count: 1, grant_id: g.id, started_at: '2026-10-19T06:14:00Z', op_id: admin ? '7c1e9a90'.padEnd(32, '4') : null } : null;
      return json(route, {
        identity: {
          contact_id: ident[1], link, live_grant: ['requested', 'approved', 'provisioning', 'active', 'revoking', 'unknown'].includes(g.state) ? { id: g.id, state: g.state } : null, unresolved, name_sync: screen.name_sync,
          can: { link: !link && !unresolved, unlink: !!link, delete: !!link && link.origin === 'created_from_arx', attach: admin && !!unresolved, push_name: !!link && link.origin === 'created_from_arx' },
          history: link ? [{ action: 'access.person_link.create', at: '2026-10-17T06:00:00Z' }, { action: 'access.grant.request', at: '2026-10-19T13:12:00Z' }] : [],
        },
      });
    }
    const hist = /^access-grants\/([^/]+)\/history$/.exec(p);
    if (method === 'GET' && hist) {
      if (!admin) return json(route, { code: 'not_system_admin', user_message: 'רק מנהל מערכת.', retryable: false, correlation_id: 'mock', details: {} }, 403);
      return json(route, { history: HISTORY });
    }
    const one = /^access-grants\/([^/]+)$/.exec(p);
    if (method === 'GET' && one) {
      const g = grants.find((x) => x.id === one[1]) as Record<string, any> | undefined;
      if (!g) return json(route, { code: 'access_grant_not_found', user_message: 'לא נמצא.', retryable: false, correlation_id: 'mock', details: {} }, 404);
      const out = JSON.parse(JSON.stringify(g));
      if (out.closure && admin) out.closure.reference = 'פנייה 5521 לאחראי WisKey';
      return json(route, { grant: out });
    }
    if (method === 'POST' || method === 'DELETE') {
      const body = req.postData() ? JSON.parse(req.postData() ?? '{}') : null;
      st.posts.push({ path: p, body });
      const m = /^access-grants\/([^/]+)\//.exec(p);
      const g = m ? grants.find((x) => x.id === m[1]) : undefined;
      if (p === 'access-grants/revoke-all') return json(route, { revoked: 9 });
      if (g && p.endsWith('/read-now')) {
        if (o.readNow === 'error') return json(route, { code: 'access_grant_read_failed', user_message: 'WisKey לא ענה.', retryable: true, correlation_id: 'mock', details: {} }, 502);
        if (o.readNow === 'settled') Object.assign(g, { state: 'active', grant_state: 'active', pending_sync: false, doors_state: 'accepted' });
        return json(route, { grant: g });
      }
      if (g && /\/card$/.test(p)) { // GRANTS3-295: the card is saved (the mock keeps no number either)
        (g as Record<string, unknown>).card_state = 'attached';
        (g as Record<string, unknown>).revision = Number((g as Record<string, unknown>).revision) + 1;
      }
      return json(route, { grant: g ?? null, link: { id: 'l-new', origin: 'created_from_arx', state: 'linked' }, outcome: 'pushed', drift: false });
    }
    return json(route, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }, 404);
  });
  return st;
}
