import type { Page, Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEPTS, INSTALLATION, adminDept, mockTicketDetail, type Persona } from './tickets-mocks';

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.jpg': 'image/jpeg',
};

/** A local run without any server (playwright.public.config.ts sets SW_DIST_ROUTE): the BUILT app (`vite build` -> dist/) is served
 * by route interception on the configured origin. Register it BEFORE the API mocks (the later handler answers first). */
export async function serveBuiltApp(page: Page, origin: string): Promise<void> {
  await page.route(`${origin}/**`, async (route) => {
    const p = new URL(route.request().url()).pathname;
    if (p.startsWith('/api/')) return route.fallback();
    const rel = p === '/' ? 'index.html' : decodeURIComponent(p.replace(/^\/+/, ''));
    const file = path.resolve(DIST, rel);
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ status: 200, contentType: TYPES[path.extname(file)] ?? 'application/octet-stream', body: fs.readFileSync(file) });
  });
}

// CR-038 slice 4: the outside-contact part of the tickets mock layer - the wire contract of routers/tickets_contacts.py,
// tickets_links.py and the contact side of POST tickets/{id}/assign, with fake data only (invented names, the 050-000-xxxx block,
// example.test hosts). Installed AFTER installTicketsMock: its handler runs first and passes everything else on (route.fallback).

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const err = (route: Route, status: number, code: string, msg: string, details: Record<string, unknown> = {}) =>
  json(route, { code, user_message: msg, retryable: false, correlation_id: 'mock', details }, status);

const NOW = Date.parse('2026-10-13T10:42:00Z');
const at = (h: number) => new Date(NOW + h * 3_600_000).toISOString().replace(/\.\d+Z$/, 'Z');

export interface S4MockOptions {
  persona?: Persona;
  /** the handler page is set up (the add-on option, its listener, a public address) */
  publicReady?: boolean;
  /** the "waiting for a part" ticket (1042) already went to the vendor's technician, with a live link */
  sentTicket?: boolean;
  /** owner 2026-10-14 (the state he found after installing 2.5.0): no department members, no directory rows */
  empty?: boolean;
  /** the readiness the server reports (merged over "everything ready"); the handler page part follows `publicReady` */
  readiness?: Partial<Readiness>;
}
export interface Readiness {
  public_page: boolean; public_option: boolean; base_url: boolean; module_key: boolean; public_ready: boolean; public_missing: string[];
  master_switch: boolean; account_mapped: boolean; email_fallback: boolean; email_configured: boolean; contacts_count: { employee: number; vendor: number; person: number };
}
export interface S4Mock {
  calls: { method: string; path: string; body: unknown }[];
}

interface Contact {
  id: string; kind: 'person' | 'vendor' | 'employee'; vendor_id: string | null; display_name: string; company: string; phone: string | null; email: string | null;
  preferred_channel: 'whatsapp' | 'email' | 'manual'; require_code: boolean; share_history: boolean | null; lang: 'he' | 'en' | 'ar' | 'ru'; notes: string; active: boolean;
  departments: string[]; open_tickets: number; revision: number;
}
const CONTACTS: Contact[] = [
  { id: 'c000000000000v01', kind: 'vendor', vendor_id: null, display_name: 'קליימה-טק מיזוג אוויר', company: 'קבלן מיזוג', phone: '050-000-0032', email: 'service@clima.example.test', preferred_channel: 'whatsapp',
    require_code: false, share_history: true, lang: 'he', notes: 'חוזה שירות שנתי.', active: true, departments: ['dept-maintenance'], open_tickets: 1, revision: 2 },
  { id: 'c000000000000p01', kind: 'person', vendor_id: 'c000000000000v01', display_name: 'משה אברהם', company: 'טכנאי', phone: '050-000-0031', email: null, preferred_channel: 'whatsapp',
    require_code: false, share_history: null, lang: 'he', notes: '', active: true, departments: ['dept-maintenance'], open_tickets: 1, revision: 1 },
  { id: 'c000000000000p02', kind: 'person', vendor_id: null, display_name: 'יוסי חשמל', company: 'חשמלאי מוסמך', phone: '050-000-0045', email: null, preferred_channel: 'whatsapp',
    require_code: true, share_history: null, lang: 'he', notes: '', active: true, departments: [], open_tickets: 0, revision: 1 },
  { id: 'c000000000000p03', kind: 'person', vendor_id: null, display_name: 'Ivan Petrov', company: 'Lift service', phone: '050-000-0060', email: 'ivan@lift.example.test', preferred_channel: 'email',
    require_code: false, share_history: null, lang: 'ru', notes: '', active: true, departments: [], open_tickets: 0, revision: 1 },
  { id: 'c000000000000v02', kind: 'vendor', vendor_id: null, display_name: 'ברק ניקיון ואחזקה', company: 'ניקיון', phone: '050-000-0071', email: null, preferred_channel: 'manual',
    require_code: false, share_history: null, lang: 'he', notes: '', active: false, departments: ['dept-cleaning'], open_tickets: 0, revision: 1 },
  // owner 2026-10-14: an employee without an account (gets the handler link like a vendor)
  { id: 'c000000000000e01', kind: 'employee', vendor_id: null, display_name: 'אבי לוי', company: '', phone: '050-000-0080', email: null, preferred_channel: 'whatsapp',
    require_code: false, share_history: null, lang: 'he', notes: '', active: true, departments: ['dept-maintenance'], open_tickets: 0, revision: 1 },
];

function present(c: Contact, full: boolean, configure: boolean) {
  const vendor = c.vendor_id ? CONTACTS.find((v) => v.id === c.vendor_id) : undefined;
  const digits = (c.phone ?? '').replace(/\D/g, '');
  return {
    id: c.id, kind: c.kind, vendor_id: c.vendor_id, vendor_name: vendor?.display_name ?? null, user_linked: false, user_id: null, display_name: c.display_name, company: c.company,
    phone: c.phone ? (full ? c.phone : `•••• ${digits.slice(-4)}`) : null, phone_full: !!c.phone && full, has_phone: !!c.phone,
    email: c.email ? (full ? c.email : `•••@${c.email.split('@')[1]}`) : null, preferred_channel: c.preferred_channel, require_code: c.require_code, share_history: c.share_history,
    lang: c.lang, notes: configure ? c.notes : '', active: c.active, erased: false, departments: c.departments, open_tickets: c.open_tickets, last_assigned_at: null, revision: c.revision,
    live_links: c.open_tickets, persons: c.kind === 'vendor' ? CONTACTS.filter((p) => p.vendor_id === c.id).map((p) => ({ id: p.id, display_name: p.display_name })) : [],
  };
}

interface Link { contact: Contact; generation: number; state: 'live' | 'grace' | 'expired' | 'revoked'; reason: string | null; sent: boolean; opens: number }

export async function installS4Mock(page: Page, o: S4MockOptions = {}): Promise<S4Mock> {
  const persona = o.persona ?? 'admin';
  const configure = persona === 'admin';
  const external = persona === 'admin';
  const ready = o.publicReady ?? true;
  const st: S4Mock = { calls: [] };
  const contacts = o.empty ? [] : CONTACTS.map((c) => ({ ...c, departments: [...c.departments] }));
  // slice 2's members, kept per department so the handlers page's writes show (the base mock answers without keeping them)
  const members = new Map<string, ReturnType<typeof adminDept>['members']>(DEPTS.map((d) => [d.id, o.empty ? [] : adminDept(d, 0).members]));
  // owner 2026-10-14: departments created / soft-deleted / restored on the page (maintenance holds open tickets: its delete is refused)
  const depts = DEPTS.map((d) => ({ ...d }));
  const deletedAt = new Map<string, string>();
  const OPEN: Record<string, number> = { 'dept-maintenance': 3 };
  const dept = (id: string) => {
    const base = depts.find((x) => x.id === id) ?? depts[0];
    return { ...adminDept(base, OPEN[id] ?? 0), id: base.id, key: base.key, name: base.name, members: members.get(id) ?? [] };
  };
  const readiness = (): Readiness => {
    const live = contacts.filter((c) => c.active);
    return {
      public_page: ready, public_option: ready, base_url: ready, module_key: true, public_ready: ready, public_missing: ready ? [] : ['option', 'address'],
      master_switch: true, account_mapped: true, email_fallback: true, email_configured: false,
      contacts_count: { employee: live.filter((c) => c.kind === 'employee').length, vendor: live.filter((c) => c.kind === 'vendor').length, person: live.filter((c) => c.kind === 'person').length },
      ...(o.readiness ?? {}),
    };
  };
  const links = new Map<string, Link>();
  if (o.sentTicket) links.set('0000000000000a01', { contact: contacts[1], generation: 1, state: 'live', reason: null, sent: true, opens: 3 });
  let publicDoc = { organization_name: 'מגדלי הדר', public: { base_url: ready ? 'https://t-demo.arx.example.test' : '', trusted_proxy_cidrs: ['172.30.32.0/23'], client_ip_header: 'cf-connecting-ip' } };

  const linkBlock = (l: Link) => ({
    state: l.state, current: l.state !== 'revoked' || true, generation: l.generation, created_at: at(-20), expires_at: at(24 * 11), cap_at: at(24 * 89),
    grace_until: null, revoked_at: l.state === 'revoked' ? at(0) : null, revoked_reason: l.reason, sent_via: l.sent ? 'manual' : null, sent_at: l.sent ? at(-19.9) : null,
    first_opened_at: l.opens ? at(-19) : null, last_opened_at: l.opens ? at(-2) : null, open_count: l.opens, devices: l.opens ? 1 : 0, update_count: l.opens ? 2 : 0,
    require_code: l.contact.require_code, code_locked: false,
    can: { copy: external && l.state === 'live', new: external && l.state !== 'grace', revoke: l.state === 'live' || l.state === 'grace', resend: false },
  });
  const withS4 = (id: string) => {
    const d = mockTicketDetail(id, persona) as (Record<string, unknown> & { can: Record<string, unknown>; events: unknown[]; assignments: unknown[] }) | null;
    if (!d) return null;
    d.can = { ...d.can, assign_external: Boolean(d.can.assign) && external && ready };
    const l = links.get(id);
    if (l) {
      const vendor = l.contact.vendor_id ? contacts.find((v) => v.id === l.contact.vendor_id) : undefined;
      const name = vendor ? `${l.contact.display_name} (${vendor.display_name})` : l.contact.display_name;
      d.assignee = { kind: 'contact', id: l.contact.id, name, since: at(-20), acknowledged_at: at(-18) };
      d.assignments = [{ id: `${id}-x1`, kind: 'contact', name, channel: 'manual', assigned_at: at(-20), assigned_by_name: 'רונית לוי', acknowledged_at: at(-18), ended_at: null,
        end_reason: null, return_kind: null, return_reason: null }];
      d.events = [...d.events,
        { id: `${id}-x2`, at: at(-20), kind: 'reassigned', actor: { kind: 'user', name: 'רונית לוי', me: true }, from: 'assigned', to: 'assigned', body: null,
          data: { assignee: name, assignee_kind: 'contact', channel: 'manual' }, via: 'ui', external: false },
        ...(l.sent ? [{ id: `${id}-x3`, at: at(-19.9), kind: 'link_copied', actor: { kind: 'user', name: 'רונית לוי', me: true }, from: null, to: null, body: null, data: {}, via: 'ui', external: false }] : []),
        ...(l.opens ? [{ id: `${id}-x4`, at: at(-19), kind: 'link_opened', actor: { kind: 'contact', name, me: false }, from: null, to: null, body: null, data: {}, via: 'link', external: false }] : []),
      ];
      d.link = linkBlock(l);
    } else {
      d.link = null;
    }
    return d;
  };

  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    const body: unknown = method === 'GET' || method === 'DELETE' ? null : (() => { try { return req.postDataJSON(); } catch { return null; } })();
    const mine = () => st.calls.push({ method, path: p + url.search, body });

    if (p === 'tickets/readiness') {
      mine();
      if (!configure && persona !== 'manager') return err(route, 403, 'forbidden', 'אין הרשאה לפעולה הזו.');
      return json(route, readiness());
    }
    if (p === 'tickets/admin/departments' && method === 'GET') {
      mine();
      if (!configure) return err(route, 403, 'forbidden', 'אין הרשאה לפעולה הזו.');
      return json(route, {
        departments: depts.filter((d) => !deletedAt.has(d.id)).map((d) => dept(d.id)), all_departments: true, installation: INSTALLATION,
        deleted: depts.filter((d) => deletedAt.has(d.id)).map((d) => ({ id: d.id, name: d.name, deleted_at: deletedAt.get(d.id), tickets: 0 })),
      });
    }
    if (p === 'tickets/admin/departments' && method === 'POST') {
      mine();
      const b = body as { name: string; key?: string };
      const id = `dept-x${String(depts.length).padStart(2, '0')}`;
      depts.push({ id, key: b.key ?? id.slice(5), name: b.name });
      members.set(id, []);
      return json(route, dept(id), 201);
    }
    const dd = /^tickets\/admin\/departments\/([\w-]+)(\/restore)?$/.exec(p);
    if (dd && method === 'DELETE') {
      mine();
      if (OPEN[dd[1]]) return err(route, 409, 'department_in_use', 'במחלקה יש בקשות שירות פתוחות.', { open_tickets: OPEN[dd[1]] });
      deletedAt.set(dd[1], at(0));
      return json(route, { deleted: dd[1] });
    }
    if (dd && dd[2] && method === 'POST') {
      mine();
      if (!deletedAt.has(dd[1])) return err(route, 404, 'not_found', 'המחלקה לא נמצאה.');
      deletedAt.delete(dd[1]);
      return json(route, { ...dept(dd[1]), key_changed: false });
    }
    const mm = /^tickets\/admin\/departments\/([\w-]+)\/members\/(user|group)\/([\w-]+)$/.exec(p);
    if (mm && (method === 'PUT' || method === 'DELETE')) {
      mine();
      const list = members.get(mm[1]) ?? [];
      const idx = list.findIndex((m) => m.kind === mm[2] && m.id === mm[3]);
      if (method === 'DELETE') {
        if (idx >= 0) list.splice(idx, 1);
      } else {
        const b = body as { role: 'manager' | 'member'; notify_new?: boolean };
        const names: Record<string, string> = { 'u-ronit': 'רונית לוי', 'u-avi': 'אבי כהן', 'u-yossi': 'יוסי מזרחי', 'u-dana': 'דנה פרץ', 'g-tech': 'טכנאים' };
        const row = { kind: mm[2] as 'user', id: mm[3], name: names[mm[3]] ?? mm[3], role: b.role, notify_new: b.role === 'manager' && (b.notify_new ?? (idx >= 0 ? list[idx].notify_new : false)), added_at: at(0) };
        if (idx >= 0) list[idx] = row;
        else list.push(row);
      }
      members.set(mm[1], list);
      return json(route, dept(mm[1]));
    }
    // TKSTAFF1: a staff member's mobile (number / language / WhatsApp switch) - kept on every department row of that user
    const sm = /^tickets\/admin\/staff\/([\w-]+)$/.exec(p);
    if (sm && method === 'PUT') {
      mine();
      if (!configure) return err(route, 403, 'forbidden', 'אין הרשאה לפעולה הזו.');
      const b = (body ?? {}) as { phone?: string | null; lang?: 'he' | 'en' | 'ar' | 'ru'; notify_whatsapp?: boolean };
      if (b.phone && !/^[+0-9][0-9\s\-().]{7,30}$/.test(b.phone)) return err(route, 422, 'validation', 'ערך לא תקין.', { fields: [{ field: 'phone', code: 'format' }] });
      let out = { user_id: sm[1], contact_id: null as string | null, phone: null as string | null, has_phone: false, notify_whatsapp: true, lang: 'he', active: true, live_links: 0 };
      for (const list of members.values()) for (const m of list as Array<Record<string, unknown>>) {
        if (m.kind !== 'user' || m.id !== sm[1]) continue;
        if (b.phone !== undefined) m.mobile = b.phone || null;
        if (b.lang) m.lang = b.lang;
        if (b.notify_whatsapp !== undefined) m.notify_whatsapp = b.notify_whatsapp;
        out = { ...out, contact_id: m.mobile ? `c-${sm[1]}` : null, phone: (m.mobile as string | null) ?? null, has_phone: !!m.mobile,
          notify_whatsapp: (m.notify_whatsapp as boolean | undefined) ?? true, lang: (m.lang as string | undefined) ?? 'he' };
      }
      return json(route, out);
    }
    if (p === 'tickets/contacts' && method === 'GET') {
      mine();
      if (!configure && persona !== 'manager') return err(route, 403, 'forbidden', 'אין הרשאה לפעולה הזו.');
      const q = (url.searchParams.get('q') ?? '').trim();
      const kind = url.searchParams.get('kind');
      const list = contacts.filter((c) => (!kind || c.kind === kind) && (!q || c.display_name.includes(q) || c.company.includes(q)))
        .filter((c) => configure || !c.departments.length || c.departments.includes('dept-maintenance'));
      return json(route, { contacts: list.map((c) => present(c, configure || external, configure)), can_edit: configure });
    }
    if (p === 'tickets/contacts' && method === 'POST') {
      mine();
      const b = body as Partial<Contact> & { phone?: string };
      if (!b?.display_name?.trim()) return err(route, 422, 'validation', 'ערך לא תקין.', { fields: [{ field: 'display_name', code: 'required' }] });
      const c: Contact = { id: `c00000000000n${String(contacts.length).padStart(3, '0')}`, kind: b.kind ?? 'person', vendor_id: b.vendor_id ?? null, display_name: b.display_name.trim(),
        company: b.company ?? '', phone: b.phone ?? null, email: b.email ?? null, preferred_channel: b.preferred_channel ?? 'whatsapp', require_code: !!b.require_code,
        share_history: b.share_history ?? null, lang: b.lang ?? 'he', notes: b.notes ?? '', active: true, departments: b.departments ?? [], open_tickets: 0, revision: 1 };
      contacts.push(c);
      return json(route, present(c, true, true), 201);
    }
    const cm = /^tickets\/contacts\/([\w]+)(?:\/(erase|export))?$/.exec(p);
    if (cm) {
      mine();
      const c = contacts.find((x) => x.id === cm[1]);
      if (!c) return err(route, 404, 'contact_not_found', 'איש הקשר לא נמצא.');
      if (cm[2] === 'erase') {
        const idx = contacts.indexOf(c);
        contacts.splice(idx, 1);
        return json(route, { id: c.id, erased: true, links_revoked: c.open_tickets });
      }
      if (cm[2] === 'export') return json(route, { contact: { id: c.id, display_name: c.display_name }, departments: c.departments, assignments: [], timeline: [] });
      if (method === 'PATCH') {
        const b = body as Partial<Contact> & { revision?: number };
        if (b.revision !== c.revision) return err(route, 409, 'contact_stale', 'הרשומה השתנתה בינתיים. טענו מחדש.', { revision: c.revision });
        const { revision: _r, ...fields } = b;
        Object.assign(c, fields);
        c.revision += 1;
      }
      return json(route, present(c, configure || external, configure));
    }
    if (p === 'tickets/assignees') {
      mine();
      const users = o.empty ? [] : [{ kind: 'user', id: 'u-avi', name: 'אבי כהן', member_role: 'manager' }, { kind: 'user', id: 'u-yossi', name: 'יוסי מזרחי', member_role: 'member' }];
      const allowed = (c: Contact) => c.active && (!c.departments.length || c.departments.includes('dept-maintenance'));
      // TKSTAFF2: staff contacts (employees without an account) are handlers for every manager; `contacts` = the outside ones only
      const outside = external ? contacts.filter((c) => c.kind !== 'employee' && allowed(c)).map((c) => {
        const vendor = c.vendor_id ? contacts.find((v) => v.id === c.vendor_id) : undefined;
        return { kind: 'contact', id: c.id, contact_kind: c.kind, name: c.display_name, company: c.company, vendor_name: vendor?.display_name ?? null, phone: c.phone,
          has_phone: !!c.phone, has_email: !!c.email, preferred_channel: c.preferred_channel, require_code: c.require_code || !!vendor?.require_code, share_history: c.share_history, lang: c.lang };
      }) : [];
      const handlers = [
        ...users.map((u) => ({ key: `user:${u.id}`, kind: 'user', id: u.id, name: u.name, account: true, member_role: u.member_role, phone: null, has_phone: false, preferred_channel: 'inapp' })),
        ...contacts.filter((c) => c.kind === 'employee' && allowed(c)).map((c) => ({ key: `contact:${c.id}`, kind: 'contact', id: c.id, name: c.display_name, account: false,
          member_role: null, phone: external || configure ? c.phone : c.phone ? `•••• ${c.phone.slice(-4)}` : null, has_phone: !!c.phone, preferred_channel: c.preferred_channel })),
      ];
      return json(route, { users, handlers, contacts: outside, external, public_ready: ready, readiness: readiness() });
    }
    if (p === 'tickets/settings') {
      if (method === 'PUT') {
        mine();
        const b = body as { organization_name?: string; public?: Record<string, unknown> };
        if (b?.public?.base_url !== undefined && b.public.base_url !== '' && !/^https:\/\/[a-z0-9.-]+$/.test(String(b.public.base_url))) {
          return err(route, 422, 'validation', 'ערך לא תקין.', { fields: [{ field: 'public.base_url', code: 'invalid' }] });
        }
        publicDoc = { organization_name: b?.organization_name ?? publicDoc.organization_name, public: { ...publicDoc.public, ...(b?.public ?? {}) } as typeof publicDoc.public };
        if (b?.organization_name === undefined && b?.public === undefined) return route.fallback();
        return json(route, { revision: 2, ui: { detail: 'drawer_fullscreen', new_ticket: 'sheet' }, links: { sliding_days: 14, cap_days: 90, grace_hours: 24 },
          send_hours: { from: '07:00', to: '21:00' }, urgent_is_critical: true, ...publicDoc });
      }
      return json(route, { revision: 1, ui: { detail: 'drawer_fullscreen', new_ticket: 'sheet' }, links: { sliding_days: 14, cap_days: 90, grace_hours: 24 },
        send_hours: { from: '07:00', to: '21:00' }, urgent_is_critical: true, ...publicDoc });
    }
    if (p === 'tickets/health') {
      mine();
      return json(route, { option: ready, listener: ready ? { running: true, port: 18093 } : null, error: null, rate_limit_trips: {}, module_key: { state: 'ok' },
        links: { live: [...links.values()].filter((l) => l.state === 'live').length, grace: 0, expired: 0, revoked: 0, locked: 0 }, address_configured: !!publicDoc.public.base_url,
        missing: ready ? [] : ['option', 'address'], attachments_bytes: 0 });
    }
    if (p === 'tickets/address/probe') {
      mine();
      return json(route, { result: 'reachable', listener: { seen: true, source: 'header', peer: null, header_ok: true } });
    }
    const tm = /^tickets\/([0-9a-f]{16})(?:\/(assign\/preview|assign|link\/(?:copy|new|revoke|resend)))?$/.exec(p);
    if (tm) {
      const id = tm[1];
      const action = tm[2];
      if (!action && method === 'GET') {
        const d = withS4(id);
        return d ? json(route, d) : route.fallback();
      }
      if (action === 'assign/preview') {
        mine();
        const b = body as { contact_id: string; require_code?: boolean };
        const c = contacts.find((x) => x.id === b.contact_id);
        if (!c) return err(route, 409, 'assignee_not_allowed', 'לא ניתן לשלוח לאיש הקשר הזה.');
        const vendor = c.vendor_id ? contacts.find((v) => v.id === c.vendor_id) : undefined;
        const req = c.require_code || !!b.require_code;
        const t = mockTicketDetail(id, persona) as { number?: number; title?: string } | null;
        const head = `${t?.number ?? ''} (אחזקה): ${t?.title ?? ''}`;
        const text = c.lang === 'ru'
          ? `Здравствуйте, ${c.display_name}!\nЗаявка ${head}\nДля обновления: [ссылка]`
          : `שלום ${c.display_name},\nבקשת שירות ${head}\nלעדכון הטיפול: [קישור]`;
        return json(route, { channel: 'manual', lang: c.lang, text, require_code: req, require_code_locked: c.require_code, code_to_contact_phone: req,
          share_history: { available: true, default: !!(c.share_history ?? vendor?.share_history) }, link: { sliding_days: 14, cap_days: 90, grace_hours: 24, expires_at: at(24 * 31), cap_at: at(24 * 90) },
          refusals: [...(ready ? [] : ['public_link_unavailable']), ...(req ? ['code_channel_unavailable'] : [])] });
      }
      if (action === 'assign') {
        const b = body as { assignee: { kind: string; id: string } };
        if (b?.assignee?.kind !== 'contact') return route.fallback();
        mine();
        const c = contacts.find((x) => x.id === b.assignee.id);
        if (!c) return err(route, 409, 'assignee_not_allowed', 'לא ניתן לשלוח לאיש הקשר הזה.');
        links.set(id, { contact: c, generation: 1, state: 'live', reason: null, sent: false, opens: 0 });
        return json(route, withS4(id));
      }
      if (action?.startsWith('link/')) {
        mine();
        const l = links.get(id);
        if (!l) return err(route, 409, 'no_link', 'אין קישור פעיל של מטפל חיצוני.');
        if (action === 'link/copy') {
          l.sent = true;
          return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' },
            body: JSON.stringify({ url: 'https://t-demo.arx.example.test/t/#AbCdEfGhIjKlMnOpQrStUvWxYz012345', text: 'שלום משה אברהם,\nבקשת שירות 1042 (אחזקה): מזגן לא מקרר - חדר 102\nלעדכון הטיפול: https://t-demo.arx.example.test/t/#AbCdEfGhIjKlMnOpQrStUvWxYz012345' }) });
        }
        if (action === 'link/revoke') Object.assign(l, { state: 'revoked', reason: 'manual' });
        if (action === 'link/new') Object.assign(l, { state: 'live', reason: null, generation: l.generation + 1, sent: false, opens: 0 });
        if (action === 'link/resend') return err(route, 409, 'channel_unavailable', 'אין ערוץ שליחה להודעות. העתיקו את הקישור ושלחו אותו בעצמכם.');
        return json(route, withS4(id));
      }
    }
    return route.fallback();
  });
  return st;
}
