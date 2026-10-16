import type { TicketEvent } from '../api/tickets';
import { costEventText } from './cost-model';
import type { TicketIconName } from './icons';
import { messageEventLine } from './message-lines';
import { eventLine } from './model';
import { cvt } from './conversation-text';

export interface TimelineLine {
  icon: TicketIconName;
  text: string;
}

/**
 * TKUI2: the one line of a timeline event for the Conversation feed and the History timeline - the message / link lines of slices 4 / 5b
 * first, then the cost rows (never an amount), the quote and internal-owner rows of the detail backend (contract §6), then slice 1's
 * eventLine. One function so both tabs say the same words for the same event.
 */
export function timelineLine(e: TicketEvent, depts: Record<string, string> = {}): TimelineLine {
  const m = messageEventLine(e);
  if (m) return m;
  const cost = costEventText(e.kind, e.data ?? {});
  if (cost) return { icon: 'flag', text: cost };
  const d = e.data ?? {};
  switch (e.kind) {
    case 'quote_submitted':
      return { icon: 'note', text: cvt('e_quote_submitted') };
    case 'quote_decided':
      return { icon: 'check', text: cvt('e_quote_decided') };
    case 'owner_changed': {
      const to = typeof d.to === 'string' ? d.to : '';
      return { icon: 'user', text: to ? cvt('e_owner_changed', { name: to }) : cvt('e_owner_cleared') };
    }
    default:
      return eventLine(e, depts);
  }
}
