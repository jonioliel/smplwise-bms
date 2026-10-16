/**
 * TKASSIGNDLG (release 2.6.0, owner decision 16.10 option C): the assign dialog has two separate texts and no visibility checkbox.
 *   1. the internal note - the team only, always posted with `note_external: false`, never shown to the handler;
 *   2. the handler message - optional, empty by default, sent WITH the assignment: the assignment first, then
 *      `POST /tickets/{id}/vendor-message` (detail backend contract v1.3 section 6.1) with `notify: false` (the handler is notified by
 *      the assignment's own message; the free text only shows on the handler page, it never travels in WhatsApp / e-mail).
 * A message that fails never undoes the assignment. Pure helpers (no DOM, no network) so the node-only unit spec can pin them.
 */

export const HANDLER_MESSAGE_MAX = 2000;

/** Whether the dialog offers the handler message: only to a handler who reads a handler page (a vendor / contact, or a staff contact
 * without an account) - an account holder works inside the system and has no external assignment for the message route. */
export function handlerMessageApplies(o: { outside: boolean; pickedStaff: boolean }): boolean {
  return o.outside || o.pickedStaff;
}

export type MessageTarget = 'vendor' | 'handler';

/** The label word: "message to the vendor" for a vendor, "message to the handler" for a person or a staff contact. */
export function messageTarget(o: { outside: boolean; vendor: boolean }): MessageTarget {
  return o.outside && o.vendor ? 'vendor' : 'handler';
}

/** The text that would be sent: trimmed and cut to the route's limit; '' = nothing is sent. */
export function outgoingMessage(raw: string, applies: boolean): string {
  if (!applies) return '';
  return raw.trim().slice(0, HANDLER_MESSAGE_MAX);
}

export interface AssignPlan {
  /** the body of the assign call: the internal note only, never external */
  note: string | null;
  note_external: false;
  /** the message sent after the assignment, or null */
  message: string | null;
}

export function assignPlan(o: { internalNote: string; handlerMessage: string; applies: boolean }): AssignPlan {
  const note = o.internalNote.trim();
  const message = outgoingMessage(o.handlerMessage, o.applies);
  return { note: note || null, note_external: false, message: message || null };
}
