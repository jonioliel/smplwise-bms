import type { Page, Route } from '@playwright/test';
import { installGeneratorMock } from './generator-mocks';

// CALENDARS-UI-2310: the API-mode mock of the calendars module (fake data only) - the session comes from the generator mock layer, the
// calendar routes are layered on top (the last route registered wins). The views themselves are mostly exercised in demo mode
// (src/calendars/demo.ts answers the same shapes); this layer proves the navigation, the module switch and the rights.
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

export interface CalMockOptions {
  enabled?: boolean;
  placement?: 'rail' | 'home_tab' | 'both';
  /** the session's permissions; default: home + calendars */
  perms?: string[];
  can?: Partial<Record<'view' | 'book' | 'book_for_others' | 'manage' | 'maintenance' | 'guests' | 'configure' | 'connect', boolean>>;
}
export interface CalMock { calls: { method: string; path: string; body: unknown }[] }

export const HOME_PERMS = ['devices.read', 'calendar.view', 'calendar.book'];

export async function installCalendarsMock(page: Page, o: CalMockOptions = {}): Promise<CalMock> {
  const perms = o.perms ?? HOME_PERMS;
  await installGeneratorMock(page, { perms, count: 0 });
  const st: CalMock = { calls: [] };
  const can = { view: true, book: true, book_for_others: false, manage: false, maintenance: false, guests: false, configure: false, connect: false, ...(o.can ?? {}) };
  const cal = (id: string, name: string, type = 'room') => ({ id, name, type, color: 'blue', tz: 'Asia/Jerusalem', owner: { id: 'u2', name: 'נועה ברק' }, my_role: 'book', visibility: 'members',
    approval_mode: 'none', approval_timeout_h: 2, capacity: 8, equipment: [], floor_id: null, area_ref: null, overlap_override: null, sync: null, pending_count: 0, archived: false, revision: 1 });
  await page.route('**/api/v1/calendar/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    st.calls.push({ method: req.method(), path: p, body: req.method() === 'GET' ? null : req.postDataJSON?.() ?? null });
    if (p === 'calendar/module') return json(route, { enabled: o.enabled ?? true, menu_position: o.placement ?? 'rail', can });
    if (o.enabled === false) return json(route, { code: 'feature_disabled', user_message: 'כבוי', retryable: false, correlation_id: 'm', details: {} }, 404);
    if (p === 'calendar/calendars') return json(route, { calendars: [cal('a', 'חדר ישיבות אלון'), cal('b', 'חדר ישיבות ברוש')] });
    if (p === 'calendar/occurrences') return json(route, { occurrences: [], truncated: false });
    if (p === 'calendar/rooms/day') return json(route, { rooms: [] });
    if (p === 'calendar/requests') return json(route, { requests: [] });
    return json(route, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'm', details: {} }, 404);
  });
  return st;
}
