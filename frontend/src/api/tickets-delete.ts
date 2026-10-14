/**
 * Owner 14.10: full deletion of tickets by a manager (docs/changes/CR-038-DELETE-NOTES.md) -
 *   POST tickets/<id>/delete   {reason, confirm_number, client_request_id} -> {deleted, id, number, counts}
 *   POST tickets/bulk-delete   {ids, reason, confirm_count, client_request_id} -> the bulk answer (one result per ticket)
 * The server decides everything (tickets.delete + manager rights where the ticket lies, the cost guard, the hourly rate); the demo
 * store removes the demo ticket. A separate file so the slice-1 API module is untouched.
 */
import { post, ApiError } from './client';
import { isApi } from './session';
import { extendMockView, mockStore } from './tickets-mock';
import type { BulkAnswer } from './tickets-table';

export interface DeleteCounts { notes: number; photos: number; files: number; links: number; claims: number }
export interface DeleteAnswer { deleted: true; id: string; number: number; counts: DeleteCounts }
export interface DeleteBody { reason: string; confirm_number: number; client_request_id: string }
export interface BulkDeleteBody { ids: string[]; reason: string; confirm_count: number; client_request_id: string }

export interface DeleteBackend {
  remove(id: string, body: DeleteBody): Promise<DeleteAnswer>;
  bulkRemove(body: BulkDeleteBody): Promise<BulkAnswer>;
}

const enc = encodeURIComponent;

const rest: DeleteBackend = {
  remove: (id, body) => post<DeleteAnswer>(`tickets/${enc(id)}/delete`, body),
  bulkRemove: (body) => post<BulkAnswer>('tickets/bulk-delete', body),
};

// the demo store: the manager of the demo may delete; a deleted demo ticket is gone from every list
extendMockView((t) => ({ ...t, can: { ...t.can, delete: true } }));

function notFound(): ApiError {
  return new ApiError(404, { code: 'ticket_not_found', user_message: '', retryable: false, correlation_id: '', details: {} });
}

function demoRemove(id: string): DeleteAnswer | null {
  const all = mockStore.all();
  const i = all.findIndex((t) => t.id === id);
  if (i < 0) return null;
  const [t] = all.splice(i, 1);
  const notes = t.events.filter((e) => e.kind === 'note').length;
  return { deleted: true, id, number: t.number, counts: { notes, photos: t.attachments.length, files: t.attachments.length, links: 0, claims: 0 } };
}

const mock: DeleteBackend = {
  async remove(id, body) {
    const t = mockStore.find(id);
    if (!t) throw notFound();
    if (body.confirm_number !== t.number) {
      throw new ApiError(422, { code: 'validation', user_message: '', retryable: false, correlation_id: '', details: { fields: [{ field: 'confirm_number', code: 'mismatch' }] } });
    }
    const out = demoRemove(id);
    if (!out) throw notFound();
    return out;
  },
  async bulkRemove(body) {
    const results: BulkAnswer['results'] = body.ids.map((id) => {
      const out = demoRemove(id);
      return out ? { id, number: out.number, result: 'ok' as const } : { id, result: 'not_found' as const };
    });
    const counts: BulkAnswer['counts'] = {};
    for (const r of results) counts[r.result] = (counts[r.result] ?? 0) + 1;
    return { action: 'delete', total: body.ids.length, done: counts.ok ?? 0, counts, results };
  },
};

export function deleteApi(): DeleteBackend {
  return isApi() ? rest : mock;
}
