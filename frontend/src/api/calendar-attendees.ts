/**
 * CAL-ATTENDEES-2343: the attendees of a calendar entry (routers/calendar_attendees.py; docs/changes/CAL-ATTENDEES-2343.md). Kept out of
 * api/calendars.ts on purpose (the grid-edit branch owns that file this train); the entry routes there accept `attendees` on create and a
 * desired list on PATCH. The server decides every permission and every privacy rule - the screen only hides what `can` says is not offered.
 * Without a backend (the static demo) the calls are answered from a small in-memory list - invented data, never a network call.
 */
import { api, get, post, put } from './client';
import { isApi } from './session';

export type AttendeeKind = 'user' | 'resident' | 'guest';
export type AttendeeRole = 'required' | 'optional';
export type InviteStatus = 'invited' | 'accepted' | 'declined' | 'tentative';
export type GuestsMode = 'off' | 'organizer' | 'anyone';
export type ListVisibility = 'organizer' | 'attendees' | 'viewers';

export interface Attendee {
  id: string;
  kind: AttendeeKind;
  ref_id: string | null;
  name: string;
  role: AttendeeRole;
  status: InviteStatus;
  notified: boolean;
  you: boolean;
  /** organizer / managers only, guests only */
  contact?: { phone: string; email: string };
  added_by_you?: boolean;
  /** organizer / managers only: the last notice to this attendee (never an address) */
  last_notice?: { kind: 'invite' | 'change' | 'cancel' | 'removed'; state: 'queued' | 'sent' | 'skipped' | 'retracted' | 'failed'; channel: string | null; reason: string | null } | null;
}

export interface AttendeesView {
  event_id: string;
  /** null = the viewer sees the entry as busy only */
  count: number | null;
  list_visible: boolean;
  attendees: Attendee[];
  me: { id: string; status: InviteStatus; role: AttendeeRole } | null;
  can: { manage: boolean; join: boolean; add_guest: boolean; respond: boolean; leave: boolean; contacts: boolean };
  policy: { guests_mode: GuestsMode; self_join: boolean; max_attendees: number };
}

/** What a new entry / a desired list sends: a user or resident by reference, a guest by name + phone or e-mail. */
export type AttendeeInput =
  | { kind: 'user' | 'resident'; ref_id: string; role?: AttendeeRole }
  | { kind: 'guest'; name: string; phone?: string; email?: string; role?: AttendeeRole };

export interface DirectoryHit { kind: 'user' | 'resident'; ref_id: string; name: string }

export interface AttendeePolicy { guests_mode: GuestsMode; self_join: boolean; max_attendees: number; notify_on_change: boolean; list_visibility: ListVisibility; revision: number }

export interface AttendeeSettings {
  enabled: boolean;
  cancel_notice_delay_s: number;
  guest_channel_order: ('whatsapp' | 'sms' | 'email')[];
  notify_users_inapp: boolean;
  notify_guests: boolean;
}

export interface AttendeesApi {
  list(eventId: string): Promise<AttendeesView>;
  add(eventId: string, attendees: AttendeeInput[]): Promise<AttendeesView>;
  setRole(eventId: string, attendeeId: string, role: AttendeeRole): Promise<AttendeesView>;
  remove(eventId: string, attendeeId: string): Promise<AttendeesView>;
  respond(eventId: string, status: Exclude<InviteStatus, 'invited'>): Promise<AttendeesView>;
  directory(q: string): Promise<{ results: DirectoryHit[]; residents: boolean }>;
  policy(calendarId: string): Promise<{ policy: AttendeePolicy; can_edit: boolean }>;
  savePolicy(calendarId: string, body: Partial<AttendeePolicy>): Promise<{ policy: AttendeePolicy; can_edit: boolean }>;
  settings(): Promise<{ settings: AttendeeSettings; channels: { key: string; address: 'phone' | 'email'; state: 'live' | 'soon'; available: boolean }[]; can_configure: boolean }>;
}

const ev = (id: string) => `/calendar/events/${encodeURIComponent(id)}/attendees`;

export const httpAttendees: AttendeesApi = {
  list: (id) => get(ev(id)),
  add: (id, attendees) => post(ev(id), { attendees }),
  setRole: (id, aid, role) => api(`${ev(id)}/${encodeURIComponent(aid)}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  remove: (id, aid) => api(`${ev(id)}/${encodeURIComponent(aid)}`, { method: 'DELETE' }),
  respond: (id, status) => put(`${ev(id)}/me`, { status }),
  directory: (q) => get(`/calendar/attendees/directory?q=${encodeURIComponent(q)}`),
  policy: (cid) => get(`/calendar/calendars/${encodeURIComponent(cid)}/attendee-policy`),
  savePolicy: (cid, body) => put(`/calendar/calendars/${encodeURIComponent(cid)}/attendee-policy`, body),
  settings: () => get('/calendar/attendee-settings'),
};

// ---------------------------------------------------------------- the static demo (no backend)

const DEMO_PEOPLE: DirectoryHit[] = [
  { kind: 'user', ref_id: 'demo-u1', name: 'נועה לוי' },
  { kind: 'user', ref_id: 'demo-u2', name: 'אורי כהן' },
  { kind: 'user', ref_id: 'demo-u3', name: 'מיכל ברק' },
  { kind: 'resident', ref_id: 'demo-r1', name: 'רות אברהם · דירה 12' },
  { kind: 'resident', ref_id: 'demo-r2', name: 'דוד מזרחי · דירה 4' },
];
const demoLists = new Map<string, Attendee[]>();
let demoSeq = 0;

function demoView(id: string): AttendeesView {
  const list = demoLists.get(id) ?? [];
  return {
    event_id: id, count: list.length, list_visible: true, attendees: list, me: null,
    can: { manage: true, join: false, add_guest: true, respond: false, leave: false, contacts: true },
    policy: { guests_mode: 'organizer', self_join: false, max_attendees: 50 },
  };
}

export const demoAttendees: AttendeesApi = {
  list: async (id) => demoView(id),
  add: async (id, items) => {
    const list = demoLists.get(id) ?? [];
    for (const it of items) {
      demoSeq += 1;
      const name = it.kind === 'guest' ? it.name : DEMO_PEOPLE.find((p) => p.ref_id === it.ref_id)?.name ?? '';
      list.push({ id: `demo-att-${demoSeq}`, kind: it.kind, ref_id: it.kind === 'guest' ? null : it.ref_id, name, role: it.role ?? 'required', status: 'invited', notified: false, you: false,
        ...(it.kind === 'guest' ? { contact: { phone: it.phone ?? '', email: it.email ?? '' } } : {}) });
    }
    demoLists.set(id, list);
    return demoView(id);
  },
  setRole: async (id, aid, role) => {
    for (const a of demoLists.get(id) ?? []) if (a.id === aid) a.role = role;
    return demoView(id);
  },
  remove: async (id, aid) => {
    demoLists.set(id, (demoLists.get(id) ?? []).filter((a) => a.id !== aid));
    return demoView(id);
  },
  respond: async (id) => demoView(id),
  directory: async (q) => ({ results: DEMO_PEOPLE.filter((p) => q.trim() && p.name.includes(q.trim())), residents: true }),
  policy: async () => ({ policy: { guests_mode: 'organizer', self_join: false, max_attendees: 50, notify_on_change: true, list_visibility: 'organizer', revision: 0 }, can_edit: true }),
  savePolicy: async (_cid, body) => ({ policy: { guests_mode: 'organizer', self_join: false, max_attendees: 50, notify_on_change: true, list_visibility: 'organizer', revision: 1, ...body }, can_edit: true }),
  settings: async () => ({
    settings: { enabled: true, cancel_notice_delay_s: 6, guest_channel_order: ['whatsapp', 'sms', 'email'], notify_users_inapp: true, notify_guests: true },
    channels: [{ key: 'whatsapp', address: 'phone', state: 'live', available: true }, { key: 'sms', address: 'phone', state: 'soon', available: false }, { key: 'email', address: 'email', state: 'soon', available: false }],
    can_configure: true,
  }),
};

/** The client for the current session: the server, or (no backend) the demo list. */
export function attendeesApi(): AttendeesApi {
  return isApi() ? httpAttendees : demoAttendees;
}
