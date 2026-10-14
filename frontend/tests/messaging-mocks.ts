import type { Page, Route } from '@playwright/test';

// CR-038 slice 5a: the mock layer of the Settings › ערוץ ההודעות specs - the wire contract of routers/messaging_accounts.py with fake data
// only (fake entry ids, the 555-01xx fiction numbers, no real person). The whole app runs against it through page.route.

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const err = (route: Route, status: number, code: string, msg: string, details: Record<string, unknown> = {}) =>
  json(route, { code, user_message: msg, retryable: false, correlation_id: 'mock', details }, status);

export type WaPersona = 'admin' | 'configure' | 'operator';
const PERMS: Record<WaPersona, string[]> = {
  admin: ['system.configure', 'messaging.accounts.manage', 'tickets.view', 'tickets.configure', 'devices.read', 'map.read'],
  configure: ['system.configure', 'devices.read', 'map.read'],
  operator: ['devices.read', 'map.read'],
};

export interface WaMockOptions {
  persona?: WaPersona;
  /** the tickets module switch: off = no active uses */
  ticketsOn?: boolean;
  /** queued messages of the installation ticket use (a move answers 409 queued_messages first) */
  queued?: number;
  /** nothing discovered, nothing stored */
  empty?: boolean;
  /** the platform's websocket is down */
  wsDown?: boolean;
}

export interface WaMock {
  calls: { method: string; path: string; body: unknown }[];
}

const PACE = { min_gap_s: 15, jitter_s: 10, per_hour: 30, per_day: 150, per_recipient_hour: 4, hold_when_down_min: 15 };
const RANGES = { min_gap_s: [5, 600], jitter_s: [0, 300], per_hour: [1, 200], per_day: [1, 1000], per_recipient_hour: [1, 30], hold_when_down_min: [1, 240] };

function baseView(o: WaMockOptions, manage: boolean) {
  const on = o.ticketsOn ?? true;
  const accounts = o.empty ? [] : [
    { key: 'entry:01JFAKEOFFICE', kind: 'discovered', label: 'משרד הניהול', label_set: true, last4: '0191', state: 'connected', state_source: 'entity', in_mirror: true, stored: true,
      shared_outside: false, removed: false, pacing: { ...PACE }, uses: ['tickets.codes', 'tickets.messages'], sends_24h: 12, last_send_at: '2026-10-13T09:58:00Z', has_status_entity: true },
    { key: 'entry:01JFAKEINTERC', kind: 'discovered', label: 'אינטרקום', label_set: true, last4: '0192', state: 'connected', state_source: 'entity', in_mirror: true, stored: true,
      shared_outside: true, removed: false, pacing: { ...PACE }, uses: ['tickets.messages@dept:dept-cleaning'], sends_24h: 41, last_send_at: '2026-10-13T10:31:00Z', has_status_entity: true },
    { key: 'entry:01JFAKESPARE0', kind: 'discovered', label: 'וואטסאפ 01JFAK', label_set: false, last4: null, state: 'disconnected', state_source: 'entity', in_mirror: true, stored: false,
      shared_outside: false, removed: false, pacing: { ...PACE }, uses: [], sends_24h: 0, last_send_at: null, has_status_entity: true },
    { key: 'manual:k3f9demo', kind: 'manual', label: 'מספר ישן', label_set: true, last4: '0197', state: 'unknown', state_source: 'sends', in_mirror: false, stored: true,
      shared_outside: false, removed: false, pacing: { ...PACE }, uses: [], sends_24h: 0, last_send_at: null, has_status_entity: false, account: manage ? '15555550197' : null, status_entity_id: null, connected_states: ['on'] },
  ];
  const uses = on && !o.empty ? [
    { key: 'tickets.messages', module: 'tickets', label: 'הודעות בקשות שירות', inherits: null, inherits_label: null, per_department: true, required: true, value: 'entry:01JFAKEOFFICE', resolved: 'entry:01JFAKEOFFICE', queued: o.queued ?? 0,
      departments: [
        { id: 'dept-maintenance', name: 'אחזקה', value: null, resolved: 'entry:01JFAKEOFFICE' },
        { id: 'dept-cleaning', name: 'ניקיון', value: 'entry:01JFAKEINTERC', resolved: 'entry:01JFAKEINTERC' },
        { id: 'dept-hr', name: 'משאבי אנוש', value: null, resolved: 'entry:01JFAKEOFFICE' },
      ] },
    { key: 'tickets.codes', module: 'tickets', label: 'קודי אימות לבקשות שירות', inherits: 'tickets.messages', inherits_label: 'הודעות בקשות שירות', per_department: false, required: false, value: null, resolved: 'entry:01JFAKEOFFICE', queued: 0 },
  ] : on ? [
    { key: 'tickets.messages', module: 'tickets', label: 'הודעות בקשות שירות', inherits: null, inherits_label: null, per_department: true, required: true, value: null, resolved: null, queued: 0, departments: [] },
    { key: 'tickets.codes', module: 'tickets', label: 'קודי אימות לבקשות שירות', inherits: 'tickets.messages', inherits_label: 'הודעות בקשות שירות', per_department: false, required: false, value: null, resolved: null, queued: 0 },
  ] : [];
  const warnings = on && !o.empty ? [
    { code: 'shared_outside', use: 'tickets.messages', department_id: 'dept-cleaning', account_key: 'entry:01JFAKEINTERC', severity: 'amber' },
    { code: 'shared_module', use: 'tickets.messages', department_id: 'dept-cleaning', account_key: 'entry:01JFAKEINTERC', module: 'access', severity: 'amber' },
  ] : on ? [{ code: 'required_unmapped', use: 'tickets.messages', severity: 'red' }] : [];
  return {
    revision: 3, can_manage: manage, ws_connected: !o.wsDown, accounts, uses,
    mapping: o.empty ? {} : { 'tickets.messages': 'entry:01JFAKEOFFICE', 'tickets.codes': null, 'tickets.messages@dept:dept-cleaning': 'entry:01JFAKEINTERC' },
    warnings,
    channels: [{ key: 'whatsapp', state: on ? (o.empty ? 'not_configured' : 'active') : 'idle' }, { key: 'email', state: 'active' }, { key: 'inapp', state: 'active' }, { key: 'sms', state: 'soon' }],
    modules: { tickets: 'ניהול השירות', access: 'בקרת כניסה' },
    pacing_ranges: RANGES, pacing_default: { ...PACE }, test_send: { enabled: true },
  };
}

export async function installMessagingMock(page: Page, o: WaMockOptions = {}): Promise<WaMock> {
  const persona = o.persona ?? 'admin';
  const perms = PERMS[persona];
  const manage = perms.includes('messaging.accounts.manage');
  const st: WaMock = { calls: [] };
  let view = baseView(o, manage);
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    const body: unknown = method === 'GET' || method === 'DELETE' ? null : (() => { try { return req.postDataJSON(); } catch { return null; } })();
    if (p === 'me') {
      return json(route, {
        user: { id: 'u-ronit', username: 'ronit', display_name: 'רונית לוי', source: 'ingress' }, channel: 'local', remote: null,
        bindings: [{ id: 'b1', role_id: persona === 'admin' ? 'system_admin' : 'operator', role_name: persona === 'admin' ? 'מנהל מערכת' : 'מפעיל', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, bootstrap_state: 'done',
        modules: { tickets: o.ticketsOn ?? true, tickets_name: { he: { one: 'בקשת שירות', many: 'בקשות שירות', gender: 'f' } } },
      });
    }
    if (p === 'me/prefs') return json(route, { prefs: { 'nav.order': [] }, stored: [], updated_at: null });
    if (p === 'settings') return json(route, { settings: { 'ui.design': 'a', 'tickets.enabled': String(o.ticketsOn ?? true) }, can_edit: perms.includes('system.configure') });
    if (p.startsWith('notifications')) return json(route, { unread: 0, items: [] });
    if (p === 'tickets/module') return json(route, { enabled: o.ticketsOn ?? true, public_ready: false, name: { he: { one: 'בקשת שירות', many: 'בקשות שירות', gender: 'f' } }, name_revision: 0, ui: {} });
    if (!p.startsWith('messaging/whatsapp')) return err(route, 404, 'not_found', 'לא נמצא');
    st.calls.push({ method, path: p, body });
    if (!perms.includes('system.configure') && !manage) return err(route, 403, 'forbidden', 'אין הרשאה');
    if (p === 'messaging/whatsapp' && method === 'GET') return json(route, view);
    if (!manage) return err(route, 403, 'forbidden', 'אין הרשאה');
    if (p === 'messaging/whatsapp/refresh') return json(route, view);
    if (p === 'messaging/whatsapp/test') return json(route, { id: 'o-test', state: 'queued' });
    if (p === 'messaging/whatsapp' && method === 'PUT') {
      const b = body as { revision: number; uses: Record<string, string | null>; accounts: { key: string; label: string; kind: string; shared_outside: boolean }[]; confirm_queued?: boolean };
      if (b.revision !== view.revision) return err(route, 409, 'settings_stale', 'ההגדרות השתנו בינתיים. טענו מחדש.', { revision: view.revision });
      const moved = (b.uses['tickets.messages'] ?? null) !== view.mapping['tickets.messages' as keyof typeof view.mapping];
      if (moved && (o.queued ?? 0) > 0 && !b.confirm_queued) {
        return err(route, 409, 'queued_messages', 'יש הודעות ממתינות שיישלחו מהחשבון החדש. אשרו כדי לשמור.', { moves: [{ use: 'tickets.messages', department_id: null, count: o.queued }] });
      }
      const next = baseView(o, manage);
      next.revision = view.revision + 1;
      next.mapping = { ...b.uses } as typeof next.mapping;
      for (const u of next.uses) {
        u.value = b.uses[u.key] ?? null;
        for (const d of (u as { departments?: { id: string; value: string | null }[] }).departments ?? []) d.value = b.uses[`${u.key}@dept:${d.id}`] ?? null;
      }
      const keys = new Set(b.accounts.map((a) => a.key));
      next.accounts = [...next.accounts.filter((a) => keys.has(a.key) || !a.stored).map((a) => {
        const s = b.accounts.find((x) => x.key === a.key);
        return s ? { ...a, label: s.label || a.label, label_set: !!s.label, shared_outside: s.shared_outside, stored: true } : a;
      }), ...b.accounts.filter((a) => !next.accounts.some((x) => x.key === a.key)).map((a) => ({
        key: a.key, kind: a.kind, label: a.label || 'ידני', label_set: !!a.label, last4: null, state: 'unknown', state_source: 'sends', in_mirror: false, stored: true,
        shared_outside: a.shared_outside, removed: false, pacing: { ...PACE }, uses: [], sends_24h: 0, last_send_at: null, has_status_entity: false, account: '', status_entity_id: null, connected_states: ['on'],
      }))] as typeof next.accounts;
      view = next;
      return json(route, view);
    }
    return err(route, 404, 'not_found', 'לא נמצא');
  });
  return st;
}

export const waUrl = (hash: string, skin = 'classic', scheme: 'light' | 'dark' = 'light') => `/?design=a&skin=${skin}&scheme=${scheme}#${hash}`;
