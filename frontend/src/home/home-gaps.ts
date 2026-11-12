// HOME-V3-GAPS-2436: the home interface v3 mockup's remaining small pieces that join existing screens (docs/changes/HOME-V3-GAPS-2436.md).
// No screen of its own; it registers its actions and gives the shared screens their extra buttons:
// * "התראות": "מה מגיע אליי" (to "ההתראות שלי") and "יומן הבית" in the head (mockup `S.alerts` addAct);
// * the personal menu: "ההתראות שלי" (mockup `ovlHtml` menu, the home face);
// * "מים": "פתח פנייה לאינסטלטור" on a suspected leak, and "מערכות הבית": "דווח על תקלה" - the tickets module's own new-ticket sheet,
//   only while the tickets module is on and the person may open one (never on a wall panel);
// * the alarm's changes for the home diary: home-gaps-alarm.ts.
import { html, nothing } from 'lit';
import { registerScreen, type HomeHost } from './home-ext';
import { hi } from './home-icons';
import { canNewTicket, newTicketFor } from './home-tickets';
import { diaryOk } from './home-diary';

/** "התראות" head: what reaches my phone, and the home diary. */
export function gapAlertActs(h: HomeHost) {
  return html`${h.extFor('notif') ? html`<a class="hbtn" href=${h.href('notif')} aria-label="ההתראות שלי" data-gap-notif>${hi('sliders')}<span class="bt">מה מגיע אליי</span></a>` : nothing}${h.extFor('events') && diaryOk(h) ? html`<a class="hbtn" href=${h.href('events')} aria-label="יומן הבית" data-gap-diary>${hi('list')}<span class="bt">יומן הבית</span></a>` : nothing}`;
}

/** The personal menu's "ההתראות שלי" row (not on a locked wall panel: it has no phone of its own). */
export function gapMenuRow(h: HomeHost) {
  if (!h.extFor('notif') || h.kioskLocked()) return nothing;
  return html`<a class="mrow" href=${h.href('notif')} data-act="closeNav" data-gap-menu-notif>${hi('bell')}<span>ההתראות שלי</span>${hi('fwd')}</a>`;
}

/** "פתח פנייה לאינסטלטור" / "דווח על תקלה": shown only when a ticket can be opened from here. */
export function gapTicketButton(h: Pick<HomeHost, 'kioskLocked' | 'requestUpdate'>, kind: 'plumber' | 'fault') {
  if (!canNewTicket(h)) return nothing;
  return kind === 'plumber'
    ? html`<button class="hbtn strong" data-act="gapTkPlumber" data-gap-ticket="plumber">${hi('wrench')}פתח פנייה לאינסטלטור</button>`
    : html`<button class="hbtn" data-act="gapTkFault" data-gap-ticket="fault" aria-label="דווח על תקלה">${hi('wrench')}<span class="bt">דווח על תקלה</span></button>`;
}

registerScreen((h: HomeHost) => ({
  id: 'gaps',
  names: [],
  render: () => nothing,
  acts: {
    gapTkPlumber: () => newTicketFor(h, h.ctx()?.name ?? '', /אינסטל|מים|plumb|water/i),
    gapTkFault: () => newTicketFor(h, '', /תחזוק|כללי|אחר|maint|general|other/i),
  },
}));
