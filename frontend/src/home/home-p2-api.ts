// HOME-V3-P2-2431: what the family and building screens read and write. The phase-2 routes of the home interface (/home/family,
// /home/presence, /home/buses, /home/weather, /home/tickets, /home/schedules, /home/notify - routers/home_family.py) and the modules'
// own routes for the calendar, shared-room booking, the notice board and a new scene (allowlisted for a home-only person).
import { get, post, put } from '../api/client';
import { httpAutomations, type SceneMember } from '../api/automations';

export interface Features {
  presence: { on: boolean; can: boolean };
  calendar: { on: boolean; view: boolean; book: boolean };
  notices: { on: boolean; can: boolean };
  transit: { on: boolean };
  tickets: { on: boolean; create: boolean; view: boolean };
  schedules: { on: boolean; view: boolean; manage: boolean };
  scenes: { capture: boolean };
  weather: boolean;
  notif: { phones: number };
}
export interface FamilyInfo { features: Features; modules: string[] | null; kiosk: boolean }
export const getFamily = () => get<FamilyInfo>('home/family');

// ---------------------------------------------------------------- who is home
export interface Person { user_id: string; name: string; me: boolean; home: boolean; at: string | null }
export interface PresenceHome { enabled: boolean; me_hidden: boolean; people: Person[]; home_count?: number }
export const getPresence = () => get<PresenceHome>('home/presence');
export const setHidden = (hidden: boolean) => put<{ hidden: boolean }>('home/presence/me', { hidden });

// ---------------------------------------------------------------- calendar and shared rooms
export interface Calendar { id: string; name: string; type: 'room' | 'team' | 'maintenance' | 'event'; my_role: string | null; archived?: boolean; open_hours?: unknown }
export interface Occurrence {
  occurrence_id: string; event_id: string; calendar_id: string; room_calendar_ids: string[]; start: string; end: string; state: string; kind: string;
  title: string | null; organizer: { id: string; name: string } | null; revision: string; all_day: boolean;
}
export interface RoomDay { calendar_id: string; name: string; capacity: number | null; open: { from: string; to: string }[]; entries: Occurrence[] }
export const listCalendars = () => get<{ calendars: Calendar[] }>('calendar/calendars');
export const occurrences = (from: string, to: string, cals: string[]) =>
  get<{ occurrences: Occurrence[] }>(`calendar/occurrences?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${cals.length ? '&calendars=' + cals.map(encodeURIComponent).join(',') : ''}`);
export const roomsDay = (date: string) => get<{ rooms: RoomDay[] }>(`calendar/rooms/day?date=${date}`);
export const myCalendar = (from: string, to: string) => get<{ occurrences: Occurrence[]; pending: { event_id: string; title: string; start: string; end: string; calendar_id: string }[] }>(`me/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
export const createEvent = (body: { calendar_id: string; kind: 'event' | 'booking'; title: string; start: string; end: string }) =>
  post<{ event: { id: string }; state: string }>('calendar/events', body);
export const cancelEvent = (id: string, state: string, revision?: string) =>
  post<unknown>(`calendar/events/${encodeURIComponent(id)}/${state === 'pending' ? 'withdraw' : 'cancel'}`, revision ? { revision } : {});

// ---------------------------------------------------------------- notice board and buses
export interface Notice {
  id: string; title: string; body: string; severity: 'info' | 'important' | 'urgent' | string; read: boolean; pinned: boolean;
  starts_at: string | null; ends_at: string | null; published_at: string | null; when_text: string | null;
}
export const listNotices = () => get<{ notices: Notice[] }>('notices');
export const readNotice = (id: string) => post<{ read: boolean }>(`notices/${encodeURIComponent(id)}/read`);
export interface BusRow { line: string; dest: string; hm: string; mins: number; quality?: string }
export interface Buses { state: 'off' | 'fresh' | 'cached' | 'expired'; items?: BusRow[]; updated_hm?: string | null }
export const getBuses = () => get<Buses>('home/buses');

// ---------------------------------------------------------------- weather
export interface Weather {
  now: { t: number; condition: string; text: string; feels: number | null; wind: number | null; wind_unit: string | null; humidity: number | null; rain: number | null };
  hours: { at: string; t: number; condition: string }[];
  days?: { date: string; t: number; lo?: number; condition: string }[];
}
export const getWeather = () => get<{ weather: Weather | null }>('home/weather');

// ---------------------------------------------------------------- service requests (only the caller's own)
export interface Ticket {
  id: string; number: number | string; title: string; excerpt: string; status: string; step: 0 | 1 | 2; category: { id: string; name: string } | null;
  place_text: string; created_at: string; last_activity_at: string; eta_at: string | null; waiting_on: string | null; closed_at: string | null; department: string | null;
}
export interface TicketCat { department_id: string; category_id: string | null; name: string }
export const myTickets = (state: 'open' | 'all') => get<{ items: Ticket[]; categories: TicketCat[]; can_create: boolean; can_view: boolean }>(`home/tickets?state=${state}`);
export const newTicket = (body: { department_id: string; category_id: string | null; title: string; where: string; text: string; client_request_id: string }) =>
  post<{ id: string }>('home/tickets', body);
export const ticketNote = (id: string, text: string) => post<{ ticket: Ticket }>(`home/tickets/${encodeURIComponent(id)}/notes`, { text });

// ---------------------------------------------------------------- scene schedules
export interface SceneSchedule {
  id: string; name: string; enabled: boolean; scene: string; days: { kind?: string; days?: string[] | null; tokens?: string[] } | string[] | null;
  slots: { start: { kind: string; time?: string; event?: string; offset_min?: number } }[]; next_run: { at?: string } | null; can: Record<string, boolean>;
}
export const sceneSchedules = () => get<{ items: SceneSchedule[]; can_create: boolean }>('home/schedules');
export const newSceneSchedule = (body: { name: string; scene: string; at: string; days: string[]; client_request_id: string }) => post<unknown>('home/schedules', body);
export const sceneScheduleOp = (id: string, op: 'enable' | 'disable' | 'run', confirm = false) =>
  post<unknown>(`home/schedules/${encodeURIComponent(id)}/${op}`, { client_request_id: rid(), confirm });

// ---------------------------------------------------------------- my notifications
export interface NotifyCat { id: string; name: string; critical: boolean; on: boolean; partly: boolean }
export interface NotifyMe { phones: number; categories: NotifyCat[]; dnd: { enabled: boolean; start: string; end: string }; dnd_pass: string[] }
export const getNotify = () => get<NotifyMe>('home/notify');
export const putNotify = (body: { muted?: string[]; dnd?: { enabled?: boolean; start?: string; end?: string } }) => put<NotifyMe>('home/notify', body);

// ---------------------------------------------------------------- a new scene from the current state
export const captureScene = (ids: string[]) => httpAutomations.capture({ entity_ids: ids });
export const createScene = (name: string, members: SceneMember[]) =>
  post<unknown>('automations/scene', { draft: { name, icon: null, members }, client_request_id: rid() });

export function rid(): string {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return 'h' + Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}
