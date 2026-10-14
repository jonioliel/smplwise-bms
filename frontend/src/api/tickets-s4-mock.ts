/**
 * CR-038 slice 4: the demo store of the outside-contact routes (no backend: static preview, design review, the evidence specs). It
 * keeps a small directory, sends demo tickets outside through the slice-1 demo store (./tickets-mock.ts `mockStore`) and adds the
 * `link` block to the demo ticket views (`extendMockView`). Every name, number and address here is invented (the 050-000-xxxx block,
 * example.test hosts). Nothing leaves the page.
 */
import { extendMockView, mockStore } from './tickets-mock';
import { tn } from '../tickets/naming';
import type { TicketDetail } from './tickets';
import type {
  AssignPreview, AssigneesAnswer, Contact, ContactBody, ContactExport, ExternalAssignee, LinkBlock, ProbeAnswer, Readiness, TicketWithLink, TicketsHealth,
  TicketsS4Backend,
} from './tickets-s4';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z');
const sleep = (ms = 90) => new Promise((r) => setTimeout(r, ms));
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
let idn = 0;
const nid = () => `c${(++idn).toString(16).padStart(15, '0')}`;
const DEMO_BASE = 'https://t-demo.arx.example.test';

function fail(status: number, code: string, message: string): never {
  throw Object.assign(new Error(message), { status, code });
}

function row(p: Partial<Contact> & Pick<Contact, 'kind' | 'display_name'>): Contact {
  return {
    id: nid(), vendor_id: null, vendor_name: null, user_linked: false, company: '', phone: null, phone_full: true, has_phone: false, email: null,
    preferred_channel: 'whatsapp', require_code: false, share_history: null, lang: 'he', notes: '', active: true, erased: false, departments: [],
    open_tickets: 0, last_assigned_at: null, revision: 1, ...p,
  };
}

const clima = row({ kind: 'vendor', display_name: 'קליימה-טק מיזוג אוויר', company: 'קבלן מיזוג', phone: '050-000-0032', has_phone: true, email: 'service@clima.example.test', departments: ['dept-maintenance'] });
const contacts: Contact[] = [
  clima,
  row({ kind: 'person', display_name: 'משה אברהם', company: 'טכנאי', vendor_id: clima.id, vendor_name: clima.display_name, phone: '050-000-0031', has_phone: true, departments: ['dept-maintenance'] }),
  row({ kind: 'person', display_name: 'יוסי חשמל', company: 'חשמלאי מוסמך', phone: '050-000-0045', has_phone: true, require_code: true, preferred_channel: 'whatsapp' }),
  row({ kind: 'person', display_name: 'John Smith', company: 'Lift service', phone: '050-000-0060', has_phone: true, lang: 'en', preferred_channel: 'email', email: 'john@lift.example.test' }),
  row({ kind: 'vendor', display_name: 'ברק ניקיון ואחזקה', company: 'ניקיון', phone: '050-000-0071', has_phone: true, departments: ['dept-cleaning'], active: false }),
  row({ kind: 'employee', display_name: 'אבי לוי', phone: '050-000-0080', has_phone: true, departments: ['dept-maintenance'] }), // an employee without an account
];

interface DemoLink { ticketId: string; contactId: string; generation: number; createdAt: number; generationAt: number; expiresAt: number; capAt: number; graceUntil: number | null;
  revokedAt: number | null; reason: LinkBlock['revoked_reason']; sentVia: LinkBlock['sent_via']; sentAt: number | null; opens: number; firstOpen: number | null; lastOpen: number | null;
  updates: number; requireCode: boolean }
const linksByTicket = new Map<string, DemoLink>();
const DUR = { sliding_days: 14, cap_days: 90, grace_hours: 24 };

function linkState(l: DemoLink, now = Date.now()): LinkBlock['state'] {
  if (l.revokedAt) return 'revoked';
  if (Math.min(l.expiresAt, l.capAt) <= now) return 'expired';
  if (l.graceUntil !== null) return l.graceUntil > now ? 'grace' : 'expired';
  return 'live';
}

function linkBlock(t: TicketDetail, l: DemoLink): LinkBlock {
  const st = linkState(l);
  const current = t.assignee?.kind === 'contact' && t.assignee.id === l.contactId && t.status !== 'closed' && t.status !== 'cancelled';
  return {
    state: st, current, generation: l.generation, created_at: iso(l.createdAt), expires_at: iso(Math.min(l.expiresAt, l.capAt)), cap_at: iso(l.capAt),
    grace_until: l.graceUntil ? iso(l.graceUntil) : null, revoked_at: l.revokedAt ? iso(l.revokedAt) : null, revoked_reason: l.reason, sent_via: l.sentVia,
    sent_at: l.sentAt ? iso(l.sentAt) : null, first_opened_at: l.firstOpen ? iso(l.firstOpen) : null, last_opened_at: l.lastOpen ? iso(l.lastOpen) : null,
    open_count: l.opens, devices: l.opens ? 1 : 0, update_count: l.updates, require_code: l.requireCode, code_locked: false,
    can: { copy: current && st === 'live', new: current && st !== 'grace', revoke: current && (st === 'live' || st === 'grace'), resend: false },
  };
}

// the slice-1 demo views gain the link block and the "send outside" right (the demo installation has its handler page set up)
extendMockView((t) => {
  const l = linksByTicket.get(t.id);
  const out = t as TicketWithLink;
  out.can = { ...t.can, assign_external: t.can.assign };
  out.link = l ? linkBlock(t, l) : null;
  return out;
});

function demoSeed(): void {
  // one demo ticket already went outside: the air conditioner waits for a part at the vendor's technician
  const t = mockStore.all().find((x) => x.status === 'waiting_part');
  const person = contacts[1];
  if (!t || !person) return;
  const now = Date.now();
  const since = now - 20 * HOUR;
  t.assignee = { kind: 'contact', id: person.id, name: `${person.display_name} (${clima.display_name})`, since: iso(since), acknowledged_at: iso(since + 2 * HOUR) };
  t.assignments.push({ id: nid(), kind: 'contact', name: t.assignee.name, channel: 'manual', assigned_at: iso(since), assigned_by_name: mockStore.me.name, acknowledged_at: iso(since + 2 * HOUR),
    ended_at: null, end_reason: null, return_kind: null, return_reason: null });
  t.events.push(mockStore.event('reassigned', iso(since), { ...mockStore.me, me: true }, { from: 'assigned', to: 'assigned', data: { assignee: t.assignee.name, assignee_kind: 'contact', channel: 'manual' } }));
  t.events.push(mockStore.event('link_copied', iso(since + 60_000), { ...mockStore.me, me: true }));
  t.events.push(mockStore.event('link_opened', iso(since + HOUR), { name: t.assignee.name }, { actor: { kind: 'contact', name: t.assignee.name, me: false }, via: 'link' }));
  t.events.push(mockStore.event('note', iso(since + 3 * HOUR), { name: t.assignee.name }, { actor: { kind: 'contact', name: t.assignee.name, me: false }, via: 'link', external: true, body: 'המדחס תקול. הזמנתי חלק, יגיע ביום חמישי.' }));
  linksByTicket.set(t.id, { ticketId: t.id, contactId: person.id, generation: 1, createdAt: since, generationAt: since, expiresAt: now + 11 * DAY, capAt: since + 90 * DAY,
    graceUntil: null, revokedAt: null, reason: null, sentVia: 'manual', sentAt: since + 60_000, opens: 3, firstOpen: since + HOUR, lastOpen: now - 2 * HOUR, updates: 2, requireCode: false });
  person.open_tickets = 1;
  person.last_assigned_at = iso(since);
}
demoSeed();

function find(id: string): Contact {
  const c = contacts.find((x) => x.id === id);
  if (!c || c.erased) fail(404, 'contact_not_found', 'איש הקשר לא נמצא.');
  return c;
}

function present(c: Contact): Contact {
  const out = clone(c);
  out.vendor_name = c.vendor_id ? contacts.find((v) => v.id === c.vendor_id)?.display_name ?? null : null;
  out.live_links = [...linksByTicket.values()].filter((l) => l.contactId === c.id && linkState(l) !== 'revoked').length;
  out.persons = c.kind === 'vendor' ? contacts.filter((p) => p.vendor_id === c.id && !p.erased).map((p) => ({ id: p.id, display_name: p.display_name })) : [];
  return out;
}

function demoPhone(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const digits = raw.replace(/[\s\-().+]/g, '');
  if (!digits) return null;
  if (!/^\d{8,15}$/.test(digits)) fail(422, 'validation', 'ערך לא תקין.');
  return raw.trim();
}

function apply(c: Contact, b: ContactBody): void {
  if (b.display_name !== undefined) {
    const name = b.display_name.trim();
    if (!name) fail(422, 'validation', 'ערך לא תקין.');
    c.display_name = name.slice(0, 80);
  }
  if (b.kind) c.kind = b.kind;
  if (b.company !== undefined) c.company = b.company.trim().slice(0, 80);
  if (b.vendor_id !== undefined) c.vendor_id = c.kind === 'person' ? b.vendor_id : null;
  if (b.phone !== undefined) { c.phone = demoPhone(b.phone); c.has_phone = !!c.phone; }
  if (b.email !== undefined) c.email = b.email?.trim() || null;
  if (b.preferred_channel) c.preferred_channel = b.preferred_channel;
  if (b.require_code !== undefined) c.require_code = b.require_code;
  if (b.share_history !== undefined) c.share_history = b.share_history;
  if (b.lang) c.lang = b.lang;
  if (b.notes !== undefined) c.notes = b.notes.slice(0, 1000);
  if (b.active !== undefined) c.active = b.active;
  if (b.departments) c.departments = [...b.departments];
}

const STARTERS: Record<string, string> = {
  he: 'שלום {name},\n{ticket} {number} ({department}): {title}\nלעדכון הטיפול: {link}',
  en: 'Hello {name},\n{ticket} {number} ({department}): {title}\nTo update the handling: {link}',
  ar: 'مرحبًا {name}،\n{ticket} {number} ({department}): {title}\nلتحديث المعالجة: {link}',
  ru: 'Здравствуйте, {name}!\n{ticket} {number} ({department}): {title}\nДля обновления: {link}',
};
const PLACEHOLDER: Record<string, string> = { he: '[קישור]', en: '[link]', ar: '[رابط]', ru: '[ссылка]' };

function message(t: TicketDetail, c: Contact, link: string): string {
  // D33: the module's configured name in the contact's language, then the values (a title is never read as a token)
  return tn(STARTERS[c.lang], c.lang).replace('{name}', c.display_name).replace('{number}', String(t.number))
    .replace('{department}', t.department?.name ?? '').replace('{title}', t.title).replace('{link}', link);
}

function randomToken(): string {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let s = '';
  for (let i = 0; i < 32; i += 1) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}

function asTicket(t: TicketDetail): TicketWithLink {
  return mockStore.view(t) as TicketWithLink;
}

export const s4Mock: TicketsS4Backend = {
  async contacts(q = {}) {
    await sleep();
    const needle = (q.q ?? '').trim().toLowerCase();
    const out = contacts.filter((c) => !c.erased && (!q.kind || c.kind === q.kind) && (!q.department_id || !c.departments.length || c.departments.includes(q.department_id))
      && (!needle || c.display_name.toLowerCase().includes(needle) || c.company.toLowerCase().includes(needle)));
    return { contacts: out.sort((a, b) => (a.kind === b.kind ? a.display_name.localeCompare(b.display_name, 'he') : a.kind === 'vendor' ? -1 : 1)).map(present), can_edit: true };
  },
  async contact(id) {
    await sleep(40);
    return present(find(id));
  },
  async createContact(body) {
    await sleep(140);
    const c = row({ kind: body.kind ?? 'person', display_name: '' });
    apply(c, { ...body, display_name: body.display_name ?? '' });
    contacts.push(c);
    return present(c);
  },
  async patchContact(id, body) {
    await sleep(120);
    const c = find(id);
    if (body.revision !== undefined && body.revision !== c.revision) fail(409, 'contact_stale', 'הרשומה השתנתה בינתיים. טענו מחדש.');
    const phoneBefore = c.phone;
    const emailBefore = c.email;
    apply(c, body);
    c.revision += 1;
    if (c.phone !== phoneBefore || c.email !== emailBefore) {
      for (const l of linksByTicket.values()) if (l.contactId === c.id && !l.revokedAt) { l.revokedAt = Date.now(); l.reason = 'contact_changed'; }
    }
    return present(c);
  },
  async eraseContact(id, history) {
    await sleep(140);
    const c = find(id);
    let n = 0;
    for (const l of linksByTicket.values()) if (l.contactId === c.id && !l.revokedAt) { l.revokedAt = Date.now(); l.reason = 'contact_erased'; n += 1; }
    Object.assign(c, { display_name: 'איש קשר שנמחק', company: '', phone: null, has_phone: false, email: null, notes: '', active: false, erased: true, departments: [] });
    void history;
    return { id, erased: true, links_revoked: n };
  },
  async exportContact(id): Promise<ContactExport> {
    await sleep(60);
    const c = find(id);
    return { contact: { id: c.id, kind: c.kind, display_name: c.display_name, company: c.company, phone: c.phone, email: c.email, lang: c.lang }, departments: c.departments, assignments: [], timeline: [] };
  },
  async externalAssignees(departmentId): Promise<AssigneesAnswer> {
    await sleep(60);
    const list: ExternalAssignee[] = contacts.filter((c) => !c.erased && c.active && (!c.departments.length || c.departments.includes(departmentId))).map((c) => {
      const vendor = c.vendor_id ? contacts.find((v) => v.id === c.vendor_id) : undefined;
      return { kind: 'contact', id: c.id, contact_kind: c.kind, name: c.display_name, company: c.company, vendor_name: vendor?.display_name ?? null, phone: c.phone, has_phone: c.has_phone,
        has_email: !!c.email, preferred_channel: c.preferred_channel, require_code: c.require_code || !!vendor?.require_code, share_history: c.share_history, lang: c.lang };
    });
    return { users: [], contacts: list, external: true, public_ready: true, readiness: demoReadiness() };
  },
  async preview(ticketId, contactId, requireCode): Promise<AssignPreview> {
    await sleep(80);
    const t = mockStore.find(ticketId);
    const c = find(contactId);
    const now = Date.now();
    const locked = c.require_code;
    const req = locked || requireCode;
    return {
      channel: 'manual', lang: c.lang, text: message(t, c, PLACEHOLDER[c.lang]), require_code: req, require_code_locked: locked, code_to_contact_phone: req,
      share_history: { available: !!t.device_name, default: false },
      link: { ...DUR, expires_at: iso(now + DUR.sliding_days * DAY), cap_at: iso(now + DUR.cap_days * DAY) },
      refusals: req ? ['code_channel_unavailable'] : [],
    };
  },
  async assignContact(ticketId, b) {
    await sleep(160);
    const t = mockStore.find(ticketId);
    const c = find(b.contactId);
    if (c.require_code || b.requireCode) fail(409, 'code_channel_unavailable', 'לא ניתן לשלוח קוד לאיש קשר זה כרגע.');
    const vendor = c.vendor_id ? contacts.find((v) => v.id === c.vendor_id) : undefined;
    const now = Date.now();
    const name = vendor ? `${c.display_name} (${vendor.display_name})` : c.display_name;
    const previous = t.assignee?.name;
    const old = linksByTicket.get(t.id);
    if (old && !old.revokedAt) { old.revokedAt = now; old.reason = 'reassigned'; }
    for (const a of t.assignments) if (!a.ended_at) { a.ended_at = iso(now); a.end_reason = 'reassigned'; }
    t.assignments.push({ id: nid(), kind: 'contact', name, channel: 'manual', assigned_at: iso(now), assigned_by_name: mockStore.me.name, acknowledged_at: null,
      ended_at: null, end_reason: null, return_kind: null, return_reason: null });
    t.events.push(mockStore.event(previous ? 'reassigned' : 'assigned', iso(now), { ...mockStore.me, me: true }, { from: t.status, to: 'assigned',
      data: { assignee: name, assignee_kind: 'contact', contact_kind: c.kind, channel: 'manual', ...(previous ? { previous } : {}) } }));
    if (b.note) t.events.push(mockStore.event('note', iso(now), { ...mockStore.me, me: true }, { body: b.note, external: b.noteExternal !== false }));
    t.assignee = { kind: 'contact', id: c.id, name, since: iso(now), acknowledged_at: null };
    t.status = 'assigned';
    t.waiting_on = 'assignee';
    linksByTicket.set(t.id, { ticketId: t.id, contactId: c.id, generation: 1, createdAt: now, generationAt: now, expiresAt: now + DUR.sliding_days * DAY, capAt: now + DUR.cap_days * DAY,
      graceUntil: null, revokedAt: null, reason: null, sentVia: null, sentAt: null, opens: 0, firstOpen: null, lastOpen: null, updates: 0, requireCode: false });
    c.last_assigned_at = iso(now);
    mockStore.touch(t);
    return asTicket(t);
  },
  async copyLink(ticketId) {
    await sleep(80);
    const t = mockStore.find(ticketId);
    const l = linksByTicket.get(t.id);
    if (!l || linkState(l) !== 'live') fail(409, 'link_not_live', 'הקישור אינו פעיל. צרו קישור חדש.');
    const c = find(l.contactId);
    const url = `${DEMO_BASE}/t/#${randomToken()}`;
    l.sentVia = l.sentVia === 'email' ? 'email' : 'manual';
    l.sentAt = l.sentAt ?? Date.now();
    t.events.push(mockStore.event('link_copied', iso(Date.now()), { ...mockStore.me, me: true }));
    return { url, text: message(t, c, url) };
  },
  async linkAction(ticketId, action) {
    await sleep(120);
    const t = mockStore.find(ticketId);
    const l = linksByTicket.get(t.id);
    if (!l) fail(409, 'no_link', 'אין קישור פעיל של מטפל חיצוני.');
    const now = Date.now();
    if (action === 'revoke') {
      if (l.revokedAt) fail(409, 'link_not_live', 'הקישור כבר אינו פעיל.');
      l.revokedAt = now;
      l.reason = 'manual';
      t.events.push(mockStore.event('link_revoked', iso(now), { ...mockStore.me, me: true }, { data: { reason: 'manual' } }));
    } else {
      Object.assign(l, { generation: l.generation + 1, generationAt: now, expiresAt: now + DUR.sliding_days * DAY, capAt: now + DUR.cap_days * DAY, graceUntil: null, revokedAt: null,
        reason: null, sentVia: null, sentAt: null });
      t.events.push(mockStore.event('link_new', iso(now), { ...mockStore.me, me: true }, { data: { generation: l.generation } }));
    }
    return asTicket(t);
  },
  async health(): Promise<TicketsHealth> {
    await sleep(60);
    const counts = { live: 0, grace: 0, expired: 0, revoked: 0, locked: 0 };
    for (const l of linksByTicket.values()) counts[linkState(l)] += 1;
    return { option: true, listener: { running: true, port: 18093 }, error: null, rate_limit_trips: {}, module_key: { state: 'ok' }, links: counts, address_configured: true,
      missing: [], attachments_bytes: 0 };
  },
  async probe(): Promise<ProbeAnswer> {
    await sleep(600);
    return { result: 'reachable', listener: { seen: true, source: 'header', peer: null, header_ok: true } };
  },
  async rotateKey() {
    await sleep(200);
    let n = 0;
    for (const l of linksByTicket.values()) if (!l.revokedAt) { l.revokedAt = Date.now(); l.reason = 'module_key'; n += 1; }
    return { rotated: true, links_revoked: n, contacts_rekeyed: contacts.filter((c) => c.has_phone && !c.erased).length };
  },
  async readiness(): Promise<Readiness> {
    await sleep(40);
    return demoReadiness();
  },
};

/** The demo installation is ready to send outside (the WhatsApp switch on, an account chosen). */
function demoReadiness(): Readiness {
  const live = contacts.filter((c) => !c.erased && c.active);
  return {
    public_page: true, public_option: true, base_url: true, module_key: true, public_ready: true, public_missing: [], master_switch: true, account_mapped: true,
    email_fallback: true, email_configured: false,
    contacts_count: { employee: live.filter((c) => c.kind === 'employee').length, vendor: live.filter((c) => c.kind === 'vendor').length, person: live.filter((c) => c.kind === 'person').length },
  };
}
