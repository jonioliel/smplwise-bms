import { css, html, nothing, type ReactiveController, type ReactiveControllerHost, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { bidi } from '../i18n/bidi';
import { ticketsApi, type TicketCan, type TicketDetail } from '../api/tickets';
import { messagesApi, type TicketMessage, type TicketWithMessages } from '../api/tickets-messages';
import { conversationApi } from '../api/tickets-conversation';
import {
  activeSub, afterSend, buildTimeline, canForward, convSubs, editDraft, enterSends, forwardedNotes, initialConv, openedAfter, prefillFromNote,
  sendPlan, subItems, switchSub, unreadIn, windowLast, withDays, dayLabel, type ConvState, type ConvSub, type FeedItem,
} from './conversation-model';
import { cvt } from './conversation-text';
import { messageLine, purposeLabel, when } from './message-lines';
import { mtt } from './messages-text';
import { marksInternal } from './model';
import { tIcon } from './icons';
import { timelineLine } from './timeline-line';
import type { DrawerTab } from './drawer-model';

/** The ticket the tab reads: the detail with slice 5b's delivery rows and slice 4's link block (both for managers only). */
export type ConvTicket = TicketWithMessages & { can: TicketCan & { vendor_message?: boolean } };

/** What `<ticket-detail>` lends the tab (its run / flash / upload, so every action behaves like the screen's own). */
export interface ConvHost {
  busy: () => boolean;
  run: (fn: () => Promise<TicketDetail>, done?: string) => Promise<boolean>;
  upload: (files: File[], external: boolean) => Promise<void>;
  uploading: () => number;
  onTab: (tab: DrawerTab) => void;
}

const firstName = (name: string) => {
  const w = name.trim().split(/\s+/)[0] ?? '';
  return w.length > 14 ? `${w.slice(0, 13)}…` : w;
};
const LONG_BODY = 420;

/** The vendor of the conversation: the current outside handler, else the last one (the history stays readable after a change). */
export function vendorOf(t: Pick<TicketDetail, 'assignee' | 'assignments'>): { name: string; channel: string; active: boolean } | null {
  if (t.assignee?.kind === 'contact') {
    const a = [...t.assignments].reverse().find((x) => x.kind === 'contact' && !x.ended_at);
    return { name: t.assignee.name, channel: a?.channel ?? '', active: true };
  }
  const last = [...t.assignments].reverse().find((x) => x.kind === 'contact');
  return last ? { name: last.name, channel: last.channel, active: false } : null;
}

/**
 * Who may write to the vendor: the server's `can.vendor_message` (contract §8) when it sends one, else (a server before the detail
 * backend) the slice-4 rule - may write an external note, and an outside contact holds the request now. Never on a closed request.
 */
export function canWriteVendor(t: ConvTicket): boolean {
  if (t.status === 'closed' || t.status === 'cancelled') return false;
  if (typeof t.can.vendor_message === 'boolean') return t.can.vendor_message;
  return !!t.can.note_external && t.assignee?.kind === 'contact';
}

/**
 * TKUI2 (release 2.6.0): the Conversation tab of the request (IA §4.2, mock-up v5 `tabConv`), rendered INSIDE `<ticket-detail>`'s one
 * scroll container (no inner scroller: the feed is a plain column, "הודעות קודמות" renders more in place, the composer is sticky at
 * the bottom of the drawer body).
 *   - Two sub-tabs "עם הספק" / "הצוות" (a toggle group - the request's own tab list stays the only ARIA tab list); without an outside
 *     contact ever assigned one feed "הערות" with the team composer only.
 *   - Two composers, NEVER both on screen: the active sub-tab owns its composer. The team composer is the warning-tinted note surface
 *     with a lock and "שמירה" (internal by construction - there is no visibility flag any more); the vendor composer is the message
 *     colour with the vendor's name and channel in the placeholder and "שליחה ל{name}".
 *   - "שלח לספק" on an internal note pre-fills the vendor composer and focuses it; the user edits and presses send (a forward).
 *   - Every outgoing message says its delivery in plain words (slice 5b's lines, D14); incoming messages - WhatsApp replies and notes
 *     from the handler page - sit on the other side, with their channel; team notes are the yellow cards with the lock.
 */
export class ConversationTab implements ReactiveController {
  private s: ConvState = initialConv(false);
  private forTicket = '';
  private bodiesOpen = new Set<string>();
  private error: { sub: ConvSub; text: string } | null = null;
  private sending = false;

  constructor(private readonly host: ReactiveControllerHost & { renderRoot: ParentNode }, private readonly lend: ConvHost) {
    host.addController(this);
  }

  hostConnected(): void {}

  /** A different request: the default sub-tab, empty drafts. */
  reset(): void {
    this.forTicket = '';
    this.bodiesOpen.clear();
    this.error = null;
  }

  private sync(t: ConvTicket): void {
    if (this.forTicket === t.id) return;
    this.forTicket = t.id;
    this.s = initialConv(marksInternal(t));
  }

  private set(next: ConvState): void {
    this.s = next;
    this.host.requestUpdate();
  }

  /** The status block's "עדכון ל{name}" (or a deep link): open the right sub-tab and focus its composer. */
  focusComposer(t: ConvTicket, sub?: ConvSub): void {
    this.sync(t);
    if (sub) this.set(switchSub(this.s, sub));
    void this.host.updateComplete.then(() => this.focusText());
  }

  private focusText(): void {
    const ta = this.host.renderRoot.querySelector('[data-composer-text]') as HTMLTextAreaElement | null;
    if (!ta) return;
    ta.focus();
    const end = ta.value.length;
    ta.setSelectionRange?.(end, end);
  }

  private pickSub(sub: ConvSub): void {
    this.error = null;
    this.set(switchSub(this.s, sub));
  }

  private forward(it: FeedItem): void {
    this.error = null;
    this.set(prefillFromNote(this.s, { id: it.id, body: it.body }));
    void this.host.updateComplete.then(() => this.focusText());
  }

  private async send(t: ConvTicket, sub: ConvSub, vendorName: string): Promise<void> {
    const plan = sendPlan(this.s, sub);
    if (!plan || this.sending || this.lend.busy()) return;
    this.sending = true;
    this.error = null;
    const id = t.id;
    const api = conversationApi();
    const done = plan.route === 'note' ? cvt('saved_team') : cvt('sent_vendor', { name: vendorName });
    const ok = await this.lend.run(async () => {
      if (plan.route === 'note') return api.teamNote(id, plan.text);
      if (plan.route === 'forward') await api.forwardNote(id, plan.noteId, plan.text);
      else await api.vendorMessage(id, plan.text);
      return ticketsApi().get(id);
    }, done);
    this.sending = false;
    if (ok) this.set(afterSend(this.s, sub));
    else {
      this.error = { sub, text: sub === 'team' ? cvt('save_failed') : cvt('send_failed') };
      this.host.requestUpdate();
    }
    void this.host.updateComplete.then(() => this.focusText());
  }

  private onKey(e: KeyboardEvent, t: ConvTicket, sub: ConvSub, vendorName: string): void {
    if (!enterSends(sub, e)) return;
    e.preventDefault();
    void this.send(t, sub, vendorName);
  }

  private async onFiles(e: Event, external: boolean): Promise<void> {
    const input = e.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = '';
    if (files.length) await this.lend.upload(files, external);
  }

  // ---------------------------------------------------------------- render

  render(t: ConvTicket): TemplateResult {
    this.sync(t);
    const vendorMode = marksInternal(t);
    const sub = activeSub(this.s, vendorMode);
    const vendor = vendorOf(t);
    const vname = firstName(vendor?.name ?? '');
    const all = buildTimeline(t, { outbox: true });
    const forwarded = forwardedNotes(all);
    const canVendor = canWriteVendor(t);
    const items = subItems(all, sub, vendorMode);
    const win = windowLast(items, this.s.expanded[sub]);
    const now = new Date();
    const ctx: RowCtx = { t, all, forwarded, canVendor, now, vname };
    const stale = sub === 'vendor' && !!t.external_stale && !!t.link?.can?.resend;
    const cap = !vendorMode ? cvt('cap_notes') : sub === 'team' ? cvt('cap_team')
      : !vendor?.active ? cvt('cap_vendor_none') : cvt(vendor.channel === 'whatsapp' ? 'cap_vendor_whatsapp' : vendor.channel === 'email' ? 'cap_vendor_email' : 'cap_vendor_page');
    const empty = sub === 'team' ? cvt('empty_team') : vendor?.active ? cvt('empty_vendor', { name: vname }) : cvt('empty_vendor_none');
    return html`<div class=${`cv ${sub}`} data-conv data-conv-active=${sub} data-conv-mode=${vendorMode ? 'vendor' : 'notes'}>
      ${vendorMode ? this.subToggle(all, sub) : nothing}
      <section class=${`cv-feed ${sub}`} data-conv-feed=${sub} data-sect=${sub === 'vendor' ? 'messages' : 'notes'}>
        <div class="cv-cap" data-conv-caption>${tIcon(sub === 'team' ? 'lock' : 'send')}<span>${cap}</span></div>
        ${stale ? html`<div class="blk cv-stale" data-stale>
          <span class="bi">${tIcon('warning')}</span>
          <div class="bt"><span class="who">${mtt('staleLine')}</span></div>
          <div class="acts"><button type="button" class="btn sm" data-send-update ?disabled=${this.lend.busy()}
            @click=${() => void this.lend.run(() => messagesApi().sendUpdate(t.id), mtt('queuedNow'))}>${tIcon('send')}${mtt('sendUpdate')}</button></div>
        </div>` : nothing}
        ${win.hidden ? html`<button type="button" class="btn sm quiet cv-older" data-conv-older aria-expanded="false"
          @click=${() => this.set({ ...this.s, expanded: { ...this.s.expanded, [sub]: true } })}>${tIcon('clock')}${cvt('older', { n: win.hidden })}</button>` : nothing}
        <div class="cv-log" role="log" aria-label=${sub === 'team' ? cvt('log_team') : cvt('log_vendor')} data-conv-log data-timeline>
          ${repeat(withDays(win.shown), (r) => ('day' in r ? `d:${r.day}` : r.item.id), (r) => ('day' in r
            ? html`<div class="cv-day" data-day=${r.day}><span>${dayLabel(r.day, now, { today: cvt('today'), yesterday: cvt('yesterday') })}</span></div>`
            : this.row(r.item, ctx)))}
        </div>
        ${items.length ? nothing : html`<p class="cv-empty" data-conv-empty>${empty}</p>`}
      </section>
      ${this.composer(t, sub, vendor, vname, canVendor)}
    </div>`;
  }

  private subToggle(all: FeedItem[], sub: ConvSub): TemplateResult {
    const btn = (id: ConvSub) => {
      const n = subItems(all, id, true).length;
      const unread = id === 'vendor' ? unreadIn(subItems(all, 'vendor', true)) : 0;
      const label = cvt(id === 'vendor' ? 'sub_vendor' : 'sub_team');
      const words = unread ? (unread === 1 ? cvt('sub_unread_one') : cvt('sub_unread_many', { n: unread })) : '';
      return html`<button type="button" class=${`cv-sub ${id}${sub === id ? ' on' : ''}`} aria-pressed=${String(sub === id)} data-conv-sub=${id}
        aria-label=${words ? `${label}, ${words}` : label} @click=${() => this.pickSub(id)}>
        ${tIcon(id === 'vendor' ? 'send' : 'lock')}<span>${label}</span><small class="n" aria-hidden="true">${n}</small>
        ${unread ? html`<span class="bdg info" aria-hidden="true" data-conv-unread=${unread}>${unread}</span>` : nothing}
      </button>`;
    };
    return html`<div class="cv-subs" role="group" aria-label=${cvt('subs')} data-conv-subs>${convSubs(true).map(btn)}</div>`;
  }

  private bodyOf(it: FeedItem): TemplateResult | typeof nothing {
    if (!it.body) return nothing;
    const long = it.body.length > LONG_BODY || it.body.split('\n').length > 8;
    const open = this.bodiesOpen.has(it.id);
    return html`<div class=${`cv-text${long && !open ? ' clamp' : ''}`}>${it.body}</div>
      ${long ? html`<button type="button" class="cv-more" aria-expanded=${String(open)} data-body-more
        @click=${() => { if (open) this.bodiesOpen.delete(it.id); else this.bodiesOpen.add(it.id); this.host.requestUpdate(); }}>${open ? cvt('less_text') : cvt('more_text')}</button>` : nothing}`;
  }

  private row(it: FeedItem, c: RowCtx): TemplateResult {
    const time = when(it.at, c.now);
    if (it.message) return this.outboxRow(it.message, c);
    if (it.type === 'internal_note') {
      const fwd = c.forwarded.get(it.id);
      return html`<article class="cv-note" data-item=${it.id} data-kind=${it.kind} data-type="internal_note">
        <span class="ni" aria-hidden="true">${tIcon('lock')}</span>
        <div class="nh"><b>${cvt('note_head')}</b><span>·</span><span>${bidi(it.actor.me ? cvt('me') : it.actor.name)}</span>
          <span class="mut">${time} · ${fwd ? html`<span class="fwd" data-note-forwarded>${tIcon('check')}${cvt('note_forwarded', { when: when(fwd.at, c.now) })}</span>` : cvt('note_not_sent')}</span>
          <span class="sp"></span>
          ${canForward(it, { canVendor: c.canVendor, forwarded: c.forwarded }) ? html`<button type="button" class="btn sm quiet cv-fwd" data-note-forward=${it.id}
            @click=${() => this.forward(it)}>${tIcon('send')}${cvt('forward')}</button>` : nothing}
        </div>
        ${this.bodyOf(it)}
      </article>`;
    }
    if (it.type === 'message' && it.direction === 'in') {
      const ch = it.unverified ? timelineLine(it.event!).text : it.channel === 'page' ? cvt('ch_page') : cvt('ch_whatsapp');
      return html`<article class="cv-msg in" data-item=${it.id} data-kind=${it.kind} data-dir="in">
        <div class="hd"><b>${bidi(it.actor.name || c.vname)}</b><span class=${`ch ${it.channel ?? ''}`}>${tIcon(it.channel === 'page' ? 'link' : 'send')}${ch}</span></div>
        <div class="bx">${it.body ? this.bodyOf(it) : html`<div class="cv-text">${timelineLine(it.event!).text}</div>`}<span class="tm">${time}</span></div>
      </article>`;
    }
    if (it.type === 'message' && it.direction === 'out' && it.body) {
      const seen = openedAfter(it, c.all);
      const author = it.actor.me ? cvt('me') : it.actor.name;
      return html`<article class="cv-msg out" data-item=${it.id} data-kind=${it.kind} data-dir="out" data-delivery=${seen ? 'opened' : it.delivery ?? ''}>
        <div class="hd"><span class="ch page">${tIcon('link')}${cvt('ch_page')}</span><b>${bidi(author)}</b>${it.fromNoteId ? html`<span class="mut">· ${cvt('from_note')}</span>` : nothing}</div>
        <div class="bx">${this.bodyOf(it)}<span class="tm">${time} · <span data-delivery-line>${seen ? cvt('d_page_opened') : cvt('d_page')}</span></span></div>
      </article>`;
    }
    const line = timelineLine(it.event!, c.t.department ? { [c.t.department.id]: c.t.department.name } : {});
    if (it.type === 'message') {
      // a templated message (the event row, when the server sent no delivery rows): its line already says how it went (D14)
      return html`<div class=${`cv-sys out ${it.delivery === 'failed' ? 'bad' : it.delivery === 'unknown' ? 'run' : ''}`} data-item=${it.id} data-kind=${it.kind} data-state=${it.delivery ?? ''}>
        ${tIcon(line.icon)}<span data-message-line>${line.text}</span><span class="mut">· ${time}</span></div>`;
    }
    if (it.type === 'quote' || it.type === 'demand') {
      return html`<div class="blk cv-cost" data-item=${it.id} data-kind=${it.kind} data-type=${it.type}>
        <span class="bi">${tIcon(line.icon)}</span><div class="bt"><span class="who">${line.text}</span><small>${bidi(it.actor.name)} · ${time}</small></div>
        <div class="acts"><button type="button" class="btn sm quiet" data-conv-costs @click=${() => this.lend.onTab('costs')}>${cvt('to_costs')}</button></div>
      </div>`;
    }
    if (it.type === 'photo') {
      return html`<div class="cv-sys" data-item=${it.id} data-kind=${it.kind}>${tIcon('image')}<span>${line.text}</span><span class="mut">· ${bidi(it.actor.me ? cvt('me') : it.actor.name)} · ${time}</span></div>`;
    }
    return html`<div class=${`cv-sys ${it.type === 'status_event' ? 'hl' : ''}`} data-item=${it.id} data-kind=${it.kind}>${tIcon(line.icon)}<span>${line.text}</span><span class="mut">· ${time}</span></div>`;
  }

  /** A delivery row of the outbox (slice 5b): purpose, the D14 line, "send now" (D29) / "send again". */
  private outboxRow(m: TicketMessage, c: RowCtx): TemplateResult {
    const line = messageLine(m, c.now);
    return html`<div class=${`blk cv-ob ${line.tone}`} data-item=${`ob:${m.id}`} data-message=${m.id} data-state=${m.state} data-purpose=${m.purpose}>
      <span class="bi">${tIcon(m.channel === 'email' ? 'note' : 'send')}</span>
      <div class="bt"><span class="who">${purposeLabel(m.purpose)}</span>
        <small data-message-line data-tone=${line.tone}>${line.text}${m.account && m.state === 'sent' ? html` · ${bidi(m.account)}` : nothing}</small></div>
      <div class="acts">
        ${m.can.send_now ? html`<button type="button" class="btn sm" data-send-now ?disabled=${this.lend.busy()}
          @click=${() => void this.lend.run(() => messagesApi().sendNow(c.t.id, m.id), mtt('queuedNow'))}>${tIcon('send')}${mtt('sendNow')}</button>` : nothing}
        ${m.can.resend ? html`<button type="button" class="btn sm quiet" data-resend ?disabled=${this.lend.busy()}
          @click=${() => void this.lend.run(() => messagesApi().resend(c.t.id, m.id), mtt('queuedNow'))}>${tIcon('refresh')}${mtt('resend')}</button>` : nothing}
      </div>
    </div>`;
  }

  private composer(t: ConvTicket, sub: ConvSub, vendor: ReturnType<typeof vendorOf>, vname: string, canVendor: boolean): TemplateResult | typeof nothing {
    const team = sub === 'team';
    if (team ? !t.can.note : !canVendor) return nothing;
    const value = team ? this.s.teamDraft : this.s.vendorDraft;
    const ph = team ? cvt('ph_team')
      : cvt(vendor?.channel === 'whatsapp' ? 'ph_vendor_whatsapp' : vendor?.channel === 'email' ? 'ph_vendor_email' : 'ph_vendor_page', { name: vname });
    const canPhoto = team ? t.can.attach : t.can.attach_external;
    const busy = this.sending || this.lend.busy();
    const err = this.error?.sub === sub ? this.error.text : '';
    return html`<div class=${`cv-composer ${team ? 'team' : 'vendor'}`} data-composer=${team ? 'team' : 'vendor'}>
      ${!team && this.s.sourceNote ? html`<div class="cv-src" data-composer-source=${this.s.sourceNote}>${tIcon('lock')}<span>${cvt('from_note_draft')}</span>
        <button type="button" class="cv-more" data-composer-clear @click=${() => { this.set(editDraft(this.s, 'vendor', '')); this.focusText(); }}>${cvt('clear_draft')}</button></div>` : nothing}
      <div class="cv-in">
        <span class="cv-ic" aria-hidden="true">${tIcon(team ? 'lock' : 'send')}</span>
        <textarea rows="1" maxlength="2000" data-composer-text aria-label=${ph} placeholder=${ph} .value=${value}
          @input=${(e: Event) => { this.error = null; this.set(editDraft(this.s, sub, (e.target as HTMLTextAreaElement).value)); }}
          @keydown=${(e: KeyboardEvent) => this.onKey(e, t, sub, vname)}></textarea>
        ${canPhoto ? html`<label class="cv-photo" title=${team ? cvt('photo_team') : cvt('photo_vendor')} data-composer-photo=${team ? 'internal' : 'external'}>
          ${tIcon(this.lend.uploading() ? 'clock' : 'camera')}
          <input type="file" accept="image/jpeg,image/png" multiple aria-label=${team ? cvt('photo_team') : cvt('photo_vendor')} ?disabled=${this.lend.uploading() > 0}
            @change=${(e: Event) => void this.onFiles(e, !team)} /></label>` : nothing}
      </div>
      <div class="cv-foot">
        <span class="hint">${team ? cvt('hint_team') : cvt('hint_vendor')}</span>
        ${err ? html`<span class="cv-err" role="alert" data-composer-error>${tIcon('warning')}${err}</span>` : nothing}
        <span class="sp"></span>
        <button type="button" class=${`btn sm ${team ? 'cv-save' : 'primary'}`} data-composer-send=${team ? 'team' : 'vendor'} ?disabled=${busy || !value.trim()}
          @click=${() => void this.send(t, sub, vname)}>${tIcon(team ? 'lock' : 'send')}${team ? cvt('save_team') : cvt('send_vendor', { name: vname })}</button>
      </div>
    </div>`;
  }
}

interface RowCtx {
  t: ConvTicket;
  all: FeedItem[];
  forwarded: Map<string, FeedItem>;
  canVendor: boolean;
  now: Date;
  vname: string;
}

export const conversationStyles = css`
  .cv {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-inline-size: 0;
  }
  /* the sub-tabs: a segmented toggle group (aria-pressed); the team toggle takes the note colour when on */
  .cv-subs {
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: var(--sw-r-pill);
    background: var(--dv-surface-3);
  }
  .cv-sub {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-block-size: 40px;
    padding-inline: 10px;
    border: 0;
    border-radius: var(--sw-r-pill);
    background: transparent;
    color: var(--dv-text-2);
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: 600;
    cursor: pointer;
  }
  .cv-sub .n {
    font-size: var(--sw-fs-xs);
    color: var(--dv-text-3);
    font-variant-numeric: tabular-nums;
  }
  .cv-sub.on {
    background: var(--mm-seg-thumb, var(--dv-surface-solid));
    color: var(--dv-accent-text);
    box-shadow: var(--dv-shadow-control);
  }
  .cv-sub.team.on {
    background: var(--dv-warning-soft);
    color: var(--au-warn-text);
  }
  .cv-sub:focus-visible,
  .cv-fwd:focus-visible,
  .cv-more:focus-visible,
  .cv-photo:focus-within {
    outline: 2px solid var(--dv-focus, var(--dv-accent));
    outline-offset: 1px;
  }
  /* the feed: a plain column inside the one scroller (never max-height + overflow) */
  .cv-feed {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    border-radius: var(--sw-r-lg);
    background: var(--dv-surface-2);
    min-inline-size: 0;
  }
  .cv-feed.team {
    background: color-mix(in srgb, var(--dv-warning-soft) 55%, var(--dv-surface-2));
  }
  .cv-log {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-inline-size: 0;
  }
  .cv-cap {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: var(--sw-r-pill);
    background: var(--dv-surface-3);
    color: var(--dv-text-2);
    font-size: var(--sw-fs-xs);
    font-weight: 600;
    text-align: center;
  }
  .cv-feed.team .cv-cap {
    background: var(--dv-warning-soft);
    color: var(--au-warn-text);
  }
  .cv-older {
    align-self: center;
    min-block-size: 36px;
  }
  .cv-empty {
    margin: 4px 0;
    text-align: center;
    color: var(--dv-text-3);
    font-size: var(--sw-fs-sm);
  }
  .cv-day {
    align-self: center;
    margin-block: 4px 0;
  }
  .cv-day span {
    display: inline-block;
    padding: 2px 10px;
    border-radius: var(--sw-r-pill);
    background: var(--dv-surface-3);
    color: var(--dv-text-3);
    font-size: var(--sw-fs-xs);
    font-weight: 600;
  }
  .cv-sys {
    align-self: center;
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 6px;
    max-inline-size: 100%;
    padding: 2px 8px;
    color: var(--dv-text-3);
    font-size: var(--sw-fs-xs);
    text-align: center;
    overflow-wrap: anywhere;
  }
  .cv-sys.hl {
    padding: 4px 12px;
    border-radius: var(--sw-r-pill);
    background: var(--dv-accent-soft);
    color: var(--dv-accent-text);
  }
  .cv-sys.bad {
    color: var(--dv-danger);
  }
  .cv-sys.run {
    color: var(--au-warn-text);
  }
  .cv-sys .mut,
  .cv-msg .mut {
    opacity: 0.8;
  }
  /* messages: incoming at the start side (the vendor's), outgoing at the end side in the message colour */
  .cv-msg {
    display: flex;
    flex-direction: column;
    gap: 3px;
    max-inline-size: 86%;
    min-inline-size: 0;
  }
  .cv-msg.in {
    align-self: flex-start;
  }
  .cv-msg.out {
    align-self: flex-end;
  }
  .cv-msg .hd {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    padding-inline: 6px;
    color: var(--dv-text-3);
    font-size: var(--sw-fs-xs);
  }
  .cv-msg .hd b {
    color: var(--dv-text-2);
    font-weight: 600;
  }
  .cv-msg .ch {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }
  .cv-msg .bx {
    padding: 9px 12px;
    border-radius: var(--sw-r-xl);
    background: var(--dv-surface-solid);
    border: 1px solid var(--dv-border);
    box-shadow: var(--dv-shadow-control);
    font-size: var(--sw-fs-md);
    line-height: 1.5;
    color: var(--dv-text);
  }
  .cv-msg.in .bx {
    border-start-start-radius: var(--sw-r-2xs);
  }
  .cv-msg.out .bx {
    background: var(--dv-accent-soft);
    border-color: color-mix(in srgb, var(--dv-accent) 30%, transparent);
    border-start-end-radius: var(--sw-r-2xs);
  }
  .cv-msg .tm {
    display: block;
    margin-block-start: 3px;
    text-align: end;
    font-size: var(--sw-fs-xs);
    color: var(--dv-text-3);
  }
  .cv-text {
    white-space: pre-line;
    overflow-wrap: anywhere;
  }
  .cv-text.clamp {
    display: -webkit-box;
    -webkit-line-clamp: 8;
    line-clamp: 8;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .cv-more {
    min-block-size: 32px;
    padding: 0 4px;
    border: 0;
    background: transparent;
    color: var(--dv-accent-text);
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: 600;
    cursor: pointer;
  }
  /* the team note: the warning-tinted card with the lock - "הערה פנימית" is said in text, never by colour alone */
  .cv-note {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 2px 10px;
    padding: 8px 12px;
    border-radius: var(--sw-r-lg);
    background: var(--dv-warning-soft);
    border: 1px dashed color-mix(in srgb, var(--dv-warning) 55%, transparent);
    color: var(--dv-text);
  }
  .cv-note .ni {
    grid-row: 1 / span 3;
    display: grid;
    place-items: center;
    inline-size: 28px;
    block-size: 28px;
    border-radius: var(--sw-r-md);
    background: color-mix(in srgb, var(--dv-warning) 30%, transparent);
    color: var(--au-warn-text);
  }
  .cv-note .nh {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 6px;
    font-size: var(--sw-fs-xs);
    color: var(--au-warn-text);
  }
  .cv-note .nh .mut {
    opacity: 0.85;
  }
  .cv-note .nh .sp {
    flex: 1;
  }
  .cv-note .fwd {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    color: var(--au-ok-text);
    font-weight: 600;
  }
  .cv-note .cv-text {
    font-size: var(--sw-fs-md);
    line-height: 1.5;
  }
  .cv-note .cv-more {
    justify-self: start;
  }
  .cv-ob.bad .bt small,
  .cv-stale .who {
    color: var(--dv-danger);
  }
  .cv-ob.run .bt small {
    color: var(--au-warn-text);
  }
  /* the composer: sticky at the bottom of the tab body (the drawer's one scroller); the team one is the note surface */
  .cv-composer {
    position: sticky;
    inset-block-end: 0;
    z-index: 3;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-block-start: 4px;
    padding: 10px 12px;
    border-radius: var(--sw-r-lg);
    background: var(--dv-surface-solid);
    border: 1px solid color-mix(in srgb, var(--dv-accent) 35%, var(--dv-border));
    box-shadow: var(--dv-shadow-2);
  }
  .cv-composer.team {
    background: var(--dv-warning-soft);
    border: 1px dashed color-mix(in srgb, var(--dv-warning) 60%, transparent);
  }
  .cv-src {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--sw-fs-xs);
    color: var(--au-warn-text);
    font-weight: 600;
  }
  .cv-in {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }
  .cv-ic {
    display: grid;
    place-items: center;
    inline-size: 32px;
    block-size: 44px;
    color: var(--dv-accent-text);
    flex: none;
  }
  .cv-composer.team .cv-ic {
    color: var(--au-warn-text);
  }
  .cv-in textarea {
    flex: 1;
    min-inline-size: 0;
    min-block-size: 44px;
    box-sizing: border-box;
    padding: 10px 14px;
    border-radius: var(--sw-r-xl);
    border: 1px solid var(--dv-border);
    background: var(--dv-surface-2);
    color: var(--dv-text);
    font: inherit;
    font-size: var(--sw-fs-md);
    line-height: 1.5;
    resize: none;
    overflow: hidden;
    field-sizing: content;
  }
  .cv-composer.vendor textarea {
    border-color: color-mix(in srgb, var(--dv-accent) 45%, transparent);
    background: color-mix(in srgb, var(--dv-accent-soft) 60%, var(--dv-surface-2));
  }
  .cv-composer.team textarea {
    border-style: dashed;
    border-color: color-mix(in srgb, var(--dv-warning) 60%, transparent);
    background: var(--dv-surface-solid);
  }
  .cv-in textarea:focus-visible {
    outline: 2px solid var(--dv-focus, var(--dv-accent));
    outline-offset: 1px;
  }
  .cv-photo {
    position: relative;
    display: grid;
    place-items: center;
    inline-size: 44px;
    block-size: 44px;
    flex: none;
    border-radius: 50%;
    border: 1px solid var(--dv-border);
    background: var(--dv-surface-solid);
    color: var(--dv-text-2);
    cursor: pointer;
  }
  .cv-photo input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .cv-foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .cv-foot .hint {
    font-size: var(--sw-fs-xs);
    color: var(--dv-text-3);
  }
  .cv-foot .sp {
    flex: 1;
  }
  .cv-err {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--dv-danger);
    font-size: var(--sw-fs-sm);
    font-weight: 600;
  }
  .cv-foot .btn {
    min-block-size: 40px;
  }
  .cv-save {
    background: color-mix(in srgb, var(--dv-warning) 35%, var(--dv-surface-solid));
    border-color: color-mix(in srgb, var(--dv-warning) 60%, transparent);
    color: var(--au-warn-text);
    font-weight: 700;
  }
  @media (max-width: 767px) {
    .cv-sub,
    .cv-foot .btn,
    .cv-older,
    .cv-fwd,
    .cv-more {
      min-block-size: 44px;
    }
    .cv-msg {
      max-inline-size: 94%;
    }
    .cv-foot .hint {
      display: none;
    }
    .cv-foot .btn {
      flex: 1;
      justify-content: center;
    }
  }
`;
