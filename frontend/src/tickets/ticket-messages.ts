import { html, nothing, type TemplateResult } from 'lit';
import { bidi } from '../i18n/bidi';
import { messagesApi, type TicketWithMessages } from '../api/tickets-messages';
import { messageLine, purposeLabel, visibleMessages } from './message-lines';
import { mtt } from './messages-text';
import { tIcon } from './icons';

export { messageEventLine, messageLine, purposeLabel, visibleMessages, when } from './message-lines';

/**
 * CR-038 slice 5b: the delivery lines of a ticket (D14) and their actions, rendered INSIDE `<ticket-detail>` (its styles: `.sect`, `.blk`,
 * `.btn`) - the pure line logic is tickets/message-lines.ts.
 *   - a message handed to WhatsApp: "נשלח בוואטסאפ - מסירה לא ידועה · 14:02" (never "delivered" or "read"); by e-mail the same "במייל";
 *   - an unknown outcome: "ייתכן שנשלח · 14:02" with "שלח שוב" (a NEW message - the old one stays unknown, 9.2);
 *   - not sent / refused: "לא נשלח" with "שלח שוב";
 *   - held by the send hours: "ממתין לשעות השליחה · יישלח ב-07:00" with "שלח עכשיו" for holders of tickets.external (D29);
 *   - an edit after the message left: "נשלח לפני השינוי" with "שלח עדכון".
 * Operator screens stay clean: one line per message, no explanations; the block exists only when there is something to show (the
 * server sends `messages` to managers and holders of tickets.external only).
 */

export interface MessagesCtx {
  busy: boolean;
  /** run one action against the API (ticket-detail's run: busy flag, the new ticket, the server's message on a refusal) */
  act: (fn: () => Promise<TicketWithMessages>, done: string) => void;
}

export function messagesBlock(t: TicketWithMessages, ctx: MessagesCtx): TemplateResult | typeof nothing {
  const rows = visibleMessages(t.messages);
  const stale = !!t.external_stale && !!t.link?.can?.resend;
  if (!rows.length && !stale) return nothing;
  const now = new Date();
  return html`<section class="sect" data-sect="messages">
    <h4><span class="tag">${tIcon('send')}</span>${mtt('msgSection')}</h4>
    ${stale ? html`<div class="blk" data-stale>
      <span class="bi">${tIcon('warning')}</span>
      <div class="bt"><span class="who">${mtt('staleLine')}</span></div>
      <div class="acts"><button type="button" class="btn sm" data-send-update ?disabled=${ctx.busy}
        @click=${() => ctx.act(() => messagesApi().sendUpdate(t.id), mtt('queuedNow'))}>${tIcon('send')}${mtt('sendUpdate')}</button></div>
    </div>` : nothing}
    ${rows.map((m) => {
      const line = messageLine(m, now);
      return html`<div class="blk" data-message=${m.id} data-state=${m.state} data-purpose=${m.purpose}>
        <span class="bi">${tIcon(m.channel === 'email' ? 'note' : 'send')}</span>
        <div class="bt"><span class="who">${purposeLabel(m.purpose)}</span>
          <small data-message-line data-tone=${line.tone}>${line.text}${m.account && m.state === 'sent' ? html` · ${bidi(m.account)}` : nothing}</small>
        </div>
        <div class="acts">
          ${m.can.send_now ? html`<button type="button" class="btn sm" data-send-now ?disabled=${ctx.busy}
            @click=${() => ctx.act(() => messagesApi().sendNow(t.id, m.id), mtt('queuedNow'))}>${tIcon('send')}${mtt('sendNow')}</button>` : nothing}
          ${m.can.resend ? html`<button type="button" class="btn sm quiet" data-resend ?disabled=${ctx.busy}
            @click=${() => ctx.act(() => messagesApi().resend(t.id, m.id), mtt('queuedNow'))}>${tIcon('refresh')}${mtt('resend')}</button>` : nothing}
        </div>
      </div>`;
    })}
  </section>`;
}
