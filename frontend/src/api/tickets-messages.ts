/**
 * CR-038 slice 5b: the ticket message channel's API (routers/tickets_messages.py) - the channel settings (the WhatsApp master switch,
 * buttons, the reply window, the e-mail fallback; the ticket uses' account mapping READ-ONLY - it is edited in Settings › ערוץ ההודעות),
 * the ticket's delivery actions ("send now" D29, "send again", "send update"), the unmatched-reply queue (claim before reveal) and the
 * message templates per purpose x language (D26). No answer ever carries a phone number, an address, a token or a code.
 * Without a server (the demo) a small in-memory store answers, so the screens render.
 */
import { api, get, patch, post, put } from './client';
import { isApi } from './session';
import type { TicketDetail } from './tickets';

export type MessagePurpose = 'assign' | 'reminder' | 'code' | 'closed' | 'reassigned' | 'reopened' | 'update' | 'test';
export type MessageState = 'queued' | 'held' | 'sending' | 'sent' | 'refused' | 'unknown' | 'not_sent' | 'cancelled' | 'superseded';
export type HeldReason = 'send_hours' | 'channel_down' | 'account_unmapped' | 'module_off';
export type MessageLang = 'he' | 'en' | 'ar' | 'ru';

/** One delivery line of a ticket (D14): managers and holders of tickets.external only. */
export interface TicketMessage {
  id: string;
  purpose: MessagePurpose;
  channel: 'whatsapp' | 'email';
  state: MessageState;
  held_reason: HeldReason | null;
  not_before: string | null;
  created_at: string;
  sent_at: string | null;
  attempts: number;
  code: string | null;
  /** the WhatsApp account's label it left from (D27) */
  account: string | null;
  fallback_of: string | null;
  resend_of: string | null;
  current: boolean;
  can: { send_now: boolean; resend: boolean };
}

/** The ticket detail with the slice-5b block (and the link block of slice 4). */
export type TicketWithMessages = TicketDetail & {
  messages?: TicketMessage[];
  link?: { state: string; can?: { resend?: boolean; copy?: boolean; new?: boolean; revoke?: boolean }; sent_via?: string | null } | null;
};

export interface ChannelUse {
  key: string;
  label: string;
  value: string | null;
  resolved: string | null;
  inherits: string | null;
  inherits_label: string | null;
  required: boolean;
  queued: number;
  departments?: { id: string; name: string; value: string | null; resolved: string | null }[];
}
export interface ChannelAccount {
  key: string;
  label: string;
  last4: string | null;
  state: 'connected' | 'disconnected' | 'unknown' | 'missing';
  kind: 'discovered' | 'manual';
  uses: string[];
  sends_24h: number;
  per_day: number | null;
  last_send_at: string | null;
  last_ok_at: string | null;
  shared_outside: boolean;
  ticket: boolean;
}
export interface ChannelWarning { code: string; use?: string; account_key?: string; severity: 'red' | 'amber' | 'grey'; state?: string; module?: string }
export interface ChannelView {
  revision: number;
  whatsapp: { enabled: boolean; use_buttons: boolean; reply_window_h: number };
  email_fallback: boolean;
  uses: ChannelUse[];
  accounts: ChannelAccount[];
  warnings: ChannelWarning[];
  ws_connected: boolean;
  email: { configured: boolean };
  inbound: { wanted: boolean };
  test_send: { enabled: boolean };
  health: {
    worker: { running: boolean; inbound_wanted: boolean };
    outbox: { depth: Record<string, number>; oldest_open_s: number | null; last_24h: Record<string, Record<string, number>> };
    inbound: { last_24h: Record<string, number>; queue: number; queue_overflow: number };
  };
  accounts_href: string;
}
export interface ChannelPatch { whatsapp?: Partial<ChannelView['whatsapp']>; email_fallback?: boolean }

export interface InboundItem {
  id: string;
  received_at: string;
  sender: string;
  tickets: { id: string; number: number; title: string; status: string }[];
  claimed: boolean;
  claimed_by_me: boolean;
  claimed_by_name: string | null;
  /** the reply's text - only for the manager who claimed it */
  text: string | null;
}

export interface MessageTemplate { id: string; department_id: string | null; purpose: MessagePurpose; lang: MessageLang; body: string; active: boolean; revision: number; updated_at: string }
export interface TemplatesView {
  purposes: MessagePurpose[];
  langs: MessageLang[];
  placeholders: string[];
  rules: { link_required: string[]; code_only: string[]; code_forbidden: string[]; max_rendered: number };
  items: MessageTemplate[];
  starters: Record<string, Partial<Record<MessageLang, string>>>;
  samples: Record<string, Partial<Record<MessageLang, string>>>;
  departments: { id: string; name: string }[];
}
export interface TemplatePreview { text: string; problems: { code: string; field: string }[]; length: number; max: number }

/** The lines slice 5b adds to slice 4's assign preview (`POST tickets/{id}/assign/preview`, OutboxDispatch.preview_extra): the send
 * hours with the "send now" default (D29), the WhatsApp account the message would leave from and what happens when WhatsApp cannot. */
export interface AssignPreviewExtra {
  send_hours?: { window: { from: string; to: string }; open_now: boolean; next_opening: string | null; send_now_default: boolean };
  /** null: no account chosen for the ticket messages; `sendable` false: the worker would hold the message (9.9.4) */
  account?: { key: string; label: string; state: string; sendable: boolean } | null;
  fallback?: 'email' | 'manual' | null;
}

export interface MessagesBackend {
  channel(): Promise<ChannelView>;
  saveChannel(revision: number, patch: ChannelPatch): Promise<ChannelView>;
  sendNow(ticketId: string, outboxId: string): Promise<TicketWithMessages>;
  resend(ticketId: string, outboxId: string): Promise<TicketWithMessages>;
  sendUpdate(ticketId: string): Promise<TicketWithMessages>;
  /** the link panel's "send the link again" through the channel (slice 4's `POST tickets/{id}/link/resend`) */
  resendLink(ticketId: string): Promise<TicketWithMessages>;
  inbound(): Promise<{ items: InboundItem[] }>;
  claim(id: string): Promise<InboundItem>;
  attach(id: string, ticketId: string): Promise<TicketWithMessages>;
  dismiss(id: string): Promise<{ ok: boolean }>;
  templates(): Promise<TemplatesView>;
  createTemplate(body: { department_id: string | null; purpose: MessagePurpose; lang: MessageLang; body: string; active?: boolean }): Promise<MessageTemplate>;
  patchTemplate(id: string, body: { body?: string; active?: boolean; revision: number }): Promise<MessageTemplate>;
  deleteTemplate(id: string): Promise<{ ok: boolean }>;
  previewTemplate(body: { purpose: MessagePurpose; lang: MessageLang; body: string }): Promise<TemplatePreview>;
}

const T = 'tickets';
const enc = encodeURIComponent;

const rest: MessagesBackend = {
  channel: () => get<ChannelView>(`${T}/channel`),
  saveChannel: (revision, patch) => put<ChannelView>(`${T}/channel`, { revision, ...patch }),
  sendNow: (ticketId, outboxId) => post<TicketWithMessages>(`${T}/${enc(ticketId)}/outbox/${enc(outboxId)}/send-now`, {}),
  resend: (ticketId, outboxId) => post<TicketWithMessages>(`${T}/${enc(ticketId)}/outbox/${enc(outboxId)}/resend`, {}),
  sendUpdate: (ticketId) => post<TicketWithMessages>(`${T}/${enc(ticketId)}/send-update`, {}),
  resendLink: (ticketId) => post<TicketWithMessages>(`${T}/${enc(ticketId)}/link/resend`, {}),
  inbound: () => get<{ items: InboundItem[] }>(`${T}/inbound`),
  claim: (id) => post<InboundItem>(`${T}/inbound/${enc(id)}/claim`, {}),
  attach: (id, ticketId) => post<TicketWithMessages>(`${T}/inbound/${enc(id)}/attach`, { ticket_id: ticketId }),
  dismiss: (id) => post<{ ok: boolean }>(`${T}/inbound/${enc(id)}/dismiss`, {}),
  templates: () => get<TemplatesView>(`${T}/admin/message-templates`),
  createTemplate: (body) => post<MessageTemplate>(`${T}/admin/message-templates`, body),
  patchTemplate: (id, body) => patch<MessageTemplate>(`${T}/admin/message-templates/${enc(id)}`, body),
  deleteTemplate: (id) => api<{ ok: boolean }>(`${T}/admin/message-templates/${enc(id)}`, { method: 'DELETE' }),
  previewTemplate: (body) => post<TemplatePreview>(`${T}/admin/message-templates/preview`, body),
};

// ---------------------------------------------------------------- the demo store (no server)

const DEMO_STARTERS: Record<string, Partial<Record<MessageLang, string>>> = {
  assign: {
    he: 'שלום {name},\n{module_name} {number} ({department}): {title}\n{place}\nלעדכון הטיפול: {link}\nחובה להיכנס לקישור כדי להמשיך בטיפול.',
    en: 'Hello {name},\nNew {module_name} #{number} ({department}): {title}\n{place}\nUpdate the handling: {link}\nYou must open the link to continue the handling.',
  },
  reminder: { he: 'תזכורת: {module_name} {number} ({department}): {title}\nלעדכון הטיפול: {link}' },
  code: { he: 'קוד האימות: {code}\nהקוד בתוקף 10 דקות. אין למסור אותו לאחרים.' },
  closed: { he: '{module_name} {number} ({department}) {g:f=נסגרה|m=נסגר|n=נסגר}. תודה.' },
  reassigned: { he: '{module_name} {number} ({department}) {g:f=הועברה|m=הועבר|n=הועבר} לטיפול אחר. הקישור שקיבלתם אינו פעיל עוד.' },
  reopened: { he: '{module_name} {number} ({department}) {g:f=נפתחה|m=נפתח|n=נפתח} מחדש: {title}\nלעדכון הטיפול: {link}' },
  update: { he: 'עדכון: {module_name} {number} ({department}): {title}\nלעדכון הטיפול: {link}' },
};

const demo = {
  channel: {
    revision: 3, whatsapp: { enabled: true, use_buttons: false, reply_window_h: 72 }, email_fallback: true,
    uses: [
      { key: 'tickets.messages', label: 'הודעות', value: 'entry:01JDEMOA', resolved: 'entry:01JDEMOA', inherits: null, inherits_label: null, required: true, queued: 1,
        departments: [{ id: 'dept-maintenance', name: 'אחזקה', value: null, resolved: 'entry:01JDEMOA' }] },
      { key: 'tickets.codes', label: 'קודי אימות', value: null, resolved: 'entry:01JDEMOA', inherits: 'tickets.messages', inherits_label: 'הודעות', required: false, queued: 0 },
    ],
    accounts: [{ key: 'entry:01JDEMOA', label: 'וואטסאפ שירות ····0191', last4: '0191', state: 'connected', kind: 'discovered', uses: ['tickets.messages'],
      sends_24h: 7, per_day: 150, last_send_at: '2026-10-14T05:12:00Z', last_ok_at: '2026-10-14T05:12:00Z', shared_outside: false, ticket: true }],
    warnings: [], ws_connected: true, email: { configured: true }, inbound: { wanted: true }, test_send: { enabled: false },
    health: { worker: { running: true, inbound_wanted: true }, outbox: { depth: { 'held:send_hours': 1 }, oldest_open_s: 3600, last_24h: { 'entry:01JDEMOA': { sent: 7 } } },
      inbound: { last_24h: { status: 3, note: 1 }, queue: 0, queue_overflow: 0 } },
    accounts_href: '#/system/messaging-accounts',
  } as ChannelView,
  items: [] as MessageTemplate[],
};

const mock: MessagesBackend = {
  channel: async () => structuredClone(demo.channel),
  saveChannel: async (_rev, patch) => {
    demo.channel = { ...demo.channel, revision: demo.channel.revision + 1, whatsapp: { ...demo.channel.whatsapp, ...(patch.whatsapp ?? {}) },
      email_fallback: patch.email_fallback ?? demo.channel.email_fallback };
    return structuredClone(demo.channel);
  },
  sendNow: async () => { throw new Error('demo'); },
  resend: async () => { throw new Error('demo'); },
  sendUpdate: async () => { throw new Error('demo'); },
  resendLink: async () => { throw new Error('demo'); },
  inbound: async () => ({ items: [] }),
  claim: async () => { throw new Error('demo'); },
  attach: async () => { throw new Error('demo'); },
  dismiss: async () => ({ ok: true }),
  templates: async () => ({
    purposes: ['assign', 'reminder', 'code', 'closed', 'reassigned', 'reopened', 'update'], langs: ['he', 'en', 'ar', 'ru'],
    placeholders: ['name', 'number', 'department', 'title', 'place', 'device', 'priority', 'organization', 'link', 'code', 'manager', 'eta', 'module_name', 'module_name_plural'],
    rules: { link_required: ['assign', 'reminder', 'reopened', 'update'], code_only: ['code'], code_forbidden: ['device', 'link', 'place', 'title'], max_rendered: 1000 },
    items: structuredClone(demo.items), starters: DEMO_STARTERS, samples: {}, departments: [{ id: 'dept-maintenance', name: 'אחזקה' }],
  }),
  createTemplate: async (body) => {
    const t: MessageTemplate = { id: `tpl${demo.items.length + 1}`, department_id: body.department_id, purpose: body.purpose, lang: body.lang, body: body.body,
      active: body.active ?? true, revision: 1, updated_at: new Date().toISOString() };
    demo.items.push(t);
    return structuredClone(t);
  },
  patchTemplate: async (id, body) => {
    const t = demo.items.find((x) => x.id === id);
    if (!t) throw new Error('demo');
    Object.assign(t, body.body !== undefined ? { body: body.body } : {}, body.active !== undefined ? { active: body.active } : {}, { revision: t.revision + 1 });
    return structuredClone(t);
  },
  deleteTemplate: async (id) => {
    demo.items = demo.items.filter((x) => x.id !== id);
    return { ok: true };
  },
  previewTemplate: async (body) => ({ text: body.body.replace(/\{link\}/g, '[קישור]').replace(/\{number\}/g, '1042'), problems: [], length: body.body.length, max: 1000 }),
};

/** The backend in force: REST with a server, the demo store without one. */
export function messagesApi(): MessagesBackend {
  return isApi() ? rest : mock;
}
