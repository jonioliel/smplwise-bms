/**
 * TKUI2 (release 2.6.0): the writes of the request's Conversation tab, on the detail backend contract v1.3 §6.1
 * (docs/tickets/DETAIL_BACKEND_CONTRACT.md, branch pilot/TKDETAILBE-backend):
 *   - `POST /tickets/{id}/vendor-message` {text, notify, source?} - a free text to the outside handler: a timeline row `note` marked
 *     external (the handler page shows it) plus, with `notify` and a live link, the templated "update" notification (the free text never
 *     travels in WhatsApp / e-mail);
 *   - `POST /tickets/{id}/notes/{event_id}/forward` {text?, notify} - the same, recorded as made from an internal note (`from_note_id`);
 *     the note itself never changes visibility.
 * Team notes stay `POST /tickets/{id}/notes` with `external: false` - the composer has no visibility flag any more.
 *
 * Until the detail backend is merged a server without these routes answers 404 / 405: the vendor message then falls back to the
 * slice-4 external note (`POST /notes` with `external: true`), which is what the new route records as well (a forward falls back the
 * same way, without the link to its note). A refusal of the new routes (409 `no_external_assignment`, `ticket_closed`,
 * `note_already_external`, 404 `note_not_found`) is shown as the server's message. Without a server (the demo) the in-memory store answers.
 */
import { ApiError, post } from './client';
import { isApi } from './session';
import { ticketsApi, type TicketDetail } from './tickets';
import { mockStore } from './tickets-mock';

export interface VendorMessageAnswer {
  item?: unknown;
  notified?: { queued: boolean; channel: 'whatsapp' | 'email' | 'manual' | null };
}

const enc = encodeURIComponent;
/** the codes of a real refusal by the new routes (anything else on a 404 / 405 = the route is not on this server yet) */
const REFUSALS = new Set(['note_not_found', 'ticket_not_found', 'no_external_assignment', 'ticket_closed', 'note_already_external', 'forbidden']);

export function routeMissing(e: unknown): boolean {
  return e instanceof ApiError && (e.status === 404 || e.status === 405) && !REFUSALS.has(e.code);
}

function demoMessage(id: string, text: string, fromNote: string | null): TicketDetail {
  const t = mockStore.find(id);
  t.events.push(mockStore.event('note', new Date().toISOString(), { ...mockStore.me, me: true }, { body: text, external: true, data: fromNote ? { from_note_id: fromNote } : {} }));
  mockStore.touch(t);
  return mockStore.view(t);
}

export interface ConversationBackend {
  vendorMessage(id: string, text: string, opts?: { notify?: boolean; source?: { kind: 'quote' | 'claim' | 'note'; id: string } }): Promise<VendorMessageAnswer>;
  forwardNote(id: string, eventId: string, text: string, opts?: { notify?: boolean }): Promise<VendorMessageAnswer>;
  teamNote(id: string, text: string): Promise<TicketDetail>;
}

const rest: ConversationBackend = {
  async vendorMessage(id, text, opts = {}) {
    try {
      return await post<VendorMessageAnswer>(`tickets/${enc(id)}/vendor-message`, { text, notify: opts.notify ?? true, ...(opts.source ? { source: opts.source } : {}) });
    } catch (e) {
      if (!routeMissing(e)) throw e;
      await ticketsApi().note(id, text, true);
      return {};
    }
  },
  async forwardNote(id, eventId, text, opts = {}) {
    try {
      return await post<VendorMessageAnswer>(`tickets/${enc(id)}/notes/${enc(eventId)}/forward`, { text, notify: opts.notify ?? true });
    } catch (e) {
      if (!routeMissing(e)) throw e;
      return rest.vendorMessage(id, text, { notify: opts.notify, source: { kind: 'note', id: eventId } });
    }
  },
  teamNote: (id, text) => ticketsApi().note(id, text, false),
};

const demo: ConversationBackend = {
  vendorMessage: async (id, text) => (demoMessage(id, text, null), {}),
  forwardNote: async (id, eventId, text) => (demoMessage(id, text, eventId), {}),
  teamNote: (id, text) => ticketsApi().note(id, text, false),
};

export function conversationApi(): ConversationBackend {
  return isApi() ? rest : demo;
}
