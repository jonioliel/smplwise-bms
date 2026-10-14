import { html, nothing, type TemplateResult } from 'lit';
import { post } from '../api/client';
import type { TicketDetail } from '../api/tickets';
import { codeLockCard, lockText } from './code-lock-model';
import { shortDateTime } from './model';
import { tIcon } from './icons';

export { lockText } from './code-lock-model';

/**
 * CR-038 slice 7 (option B, spec 10.5): the manager's "נעילת קוד" card on the ticket page. Five wrong verification codes lock
 * the handler link of the current generation for 30 minutes and the ticket waits for the manager (`waiting_reason =
 * code_locked`); the card shows until when, and its one tap - "שלח קישור חדש" - mints a new generation (every old code, lock and
 * session dead, code review V8) and sends it by the message channel when one exists (`POST tickets/{id}/link/new`).
 *
 * Clean operator screen: one status line and one button, no paragraph. The card lives inside the ticket page's own shadow root
 * and uses its classes (`sect`, `blk`, `btn`), so every skin styles it with the rules it already has (no new CSS).
 */

/** "שלח קישור חדש": a new generation; the answer is the ticket detail. */
export function sendNewLink(ticketId: string): Promise<TicketDetail> {
  return post<TicketDetail>(`tickets/${encodeURIComponent(ticketId)}/link/new`);
}

/** The card, rendered inside the ticket page. `onNew` runs the action through the page's busy / flash handling. */
export function codeLockSection(t: TicketDetail, opts: { busy: boolean; onNew: () => void }): TemplateResult | typeof nothing {
  const card = codeLockCard(t);
  if (!card.show) return nothing;
  return html`<section class="sect" data-sect="code-lock" data-code-locked=${card.until ? 'on' : 'ended'}>
    <div class="blk" role="status">
      <span class="bi">${tIcon('lock')}</span>
      <div class="bt"><span class="who">${lockText('title')}</span>
        ${card.until ? html`<small>${lockText('until', { when: shortDateTime(card.until) })}</small>` : nothing}
      </div>
      <div class="acts">
        ${card.canNew ? html`<button type="button" class="btn sm" data-code-new-link ?disabled=${opts.busy} @click=${opts.onNew}>${tIcon('send')}${lockText('newLink')}</button>` : nothing}
      </div>
    </div>
  </section>`;
}
