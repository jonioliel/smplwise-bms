import type { Page, Route } from '@playwright/test';
import { mockTicketDetail } from './tickets-mocks';
import { installTableMock, type TableMock, type TableMockOptions } from './tickets-table-mocks';

// Owner 14.10: the mock layer of the deletion specs - the wire contract of POST tickets/<id>/delete and POST tickets/bulk-delete
// (routers/tickets.py, routers/tickets_table.py) on top of the table's mock (tests/tickets-table-mocks.ts, which keeps answering
// everything else). The caller holds tickets.delete; a ticket's detail says `can.delete`. Fake data only.

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const err = (route: Route, status: number, code: string, msg: string, details: Record<string, unknown> = {}) =>
  json(route, { code, user_message: msg, retryable: status === 429, correlation_id: 'mock', details }, status);

export interface DeleteMockOptions extends TableMockOptions {
  /** ids whose approved cost claim blocks the deletion (409 cost_claim_approved / the bulk result) */
  costBlocked?: string[];
  /** the caller does not hold tickets.delete (no button, no bar entry) */
  noDelete?: boolean;
}

export interface DeleteMock {
  table: TableMock;
  calls: { path: string; body: unknown }[];
  deleted: Set<string>;
}

export async function installDeleteMock(page: Page, o: DeleteMockOptions = {}): Promise<DeleteMock> {
  const table = await installTableMock(page, { board: { view: 'table' }, ...o, persona: o.persona ?? 'admin', extraPerms: [...(o.extraPerms ?? []), ...(o.noDelete ? [] : ['tickets.delete'])] });
  const st: DeleteMock = { table, calls: [], deleted: new Set() };
  const blocked = new Set(o.costBlocked ?? []);
  const drop = (id: string) => {
    st.deleted.add(id);
    const rows = table.rows();
    const i = rows.findIndex((r) => r.id === id);
    if (i >= 0) rows.splice(i, 1);
  };
  await page.route(/\/api\/v1\/tickets\/(bulk-delete|[0-9a-f]{16}(\/delete)?)(\?.*)?$/, async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    const body = method === 'POST' ? (() => { try { return req.postDataJSON(); } catch { return null; } })() : null;
    if (p === 'tickets/bulk-delete' && method === 'POST') {
      st.calls.push({ path: p, body });
      const b = body as { ids: string[]; confirm_count: number; reason: string };
      if (b.confirm_count !== b.ids.length) return err(route, 422, 'validation', 'ערך לא תקין.', { fields: [{ field: 'confirm_count', code: 'mismatch' }] });
      const results = b.ids.map((id) => {
        const r = table.rows().find((x) => x.id === id);
        if (!r) return { id, result: 'not_found' };
        if (blocked.has(id)) return { id, number: r.number, result: 'cost_claim_approved' };
        drop(id);
        return { id, number: r.number, result: 'ok' };
      });
      const counts: Record<string, number> = {};
      for (const r of results) counts[r.result] = (counts[r.result] ?? 0) + 1;
      return json(route, { action: 'delete', total: b.ids.length, done: counts.ok ?? 0, counts, results });
    }
    const id = p.split('/')[1];
    if (st.deleted.has(id)) return err(route, 404, 'ticket_not_found', 'בקשת השירות לא נמצאה.');
    const d = mockTicketDetail(id, 'admin');
    if (!d) return route.fallback();
    if (p.endsWith('/delete') && method === 'POST') {
      st.calls.push({ path: p, body });
      const b = body as { confirm_number: number; reason: string };
      if (b.confirm_number !== d.number) return err(route, 422, 'validation', 'ערך לא תקין.', { fields: [{ field: 'confirm_number', code: 'mismatch' }] });
      if (blocked.has(id)) return err(route, 409, 'cost_claim_approved', 'לבקשת השירות יש דרישת תשלום שאושרה או שולמה. המחיקה דורשת גם הרשאת אישור עלויות.', { permission: 'tickets.costs' });
      drop(id);
      return json(route, { deleted: true, id, number: d.number, counts: { notes: 1, photos: 0, files: 0, links: 0, claims: 0 } });
    }
    if (method !== 'GET') return route.fallback();
    const can = d.can as Record<string, unknown>;
    return json(route, { ...d, can: { ...can, delete: !o.noDelete } });
  });
  return st;
}
