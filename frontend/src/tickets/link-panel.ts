import { css, html, nothing, type ReactiveController, type ReactiveControllerHost, type TemplateResult } from 'lit';
import { describeError } from '../api/client';
import type { TicketDetail } from '../api/tickets';
import { ticketsS4Api, type LinkBlock, type TicketWithLink } from '../api/tickets-s4';
import { messagesApi } from '../api/tickets-messages';
import { tIcon } from './icons';
import { mtt } from './messages-text';
import { relTime, shortDateTime } from './model';
import { tt, type TicketTextKey } from './text';

/** What `<ticket-detail>` lends the panel (its run / flash, so every action behaves like the screen's own). */
export interface LinkPanelHost {
  busy: () => boolean;
  run: (fn: () => Promise<TicketDetail>, done: string) => Promise<boolean>;
  say: (text: string, tone?: 'ok' | 'bad') => void;
  /** read the ticket again (after a copy: "sent by hand" and the timeline row) */
  reload: () => void;
}

/** Keep a copied answer this long for the second button ("copy the whole message") - never stored anywhere else. */
const COPY_KEEP_MS = 60_000;

async function toClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through: the panel shows the text to copy by hand
  }
  return false;
}

/**
 * CR-038 slice 4: the handler link of a ticket sent outside, in the handler block of `<ticket-detail>` (spec 10.2 / 14.2, D5, D14).
 * For a manager only (the server sends `link` to managers; never the token or the URL): the state (active / view only / expired /
 * revoked and why), until when, opened how often and on how many devices, the handler's updates, the code requirement and a code
 * lock-out; and the actions the server allows (`can`): copy the link (the copy route returns it once, audited - the only place a
 * link appears), a new link (a new generation: the old one stops working) and revoke - each new / revoke behind an inline
 * confirmation. "Send the link again" (slice 5b) queues the current link through the message channel when the server allows it
 * (`can.resend`: a live current link and a channel that can carry it).
 */
export class LinkPanel implements ReactiveController {
  private confirm: 'new' | 'revoke' | 'entry-off' | null = null;
  private copied: { url: string; text: string; at: number; manual: boolean } | null = null;
  private timer = 0;

  constructor(private readonly host: ReactiveControllerHost, private readonly lend: LinkPanelHost) {
    host.addController(this);
  }

  hostConnected(): void {}

  hostDisconnected(): void {
    window.clearTimeout(this.timer);
    this.copied = null;
  }

  /** A different ticket or a new answer: forget a pending confirmation and a copied link. */
  reset(): void {
    this.confirm = null;
    this.copied = null;
    window.clearTimeout(this.timer);
  }

  private keep(answer: { url: string; text: string }, manual: boolean): void {
    this.copied = { ...answer, at: Date.now(), manual };
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.copied = null;
      this.host.requestUpdate();
    }, COPY_KEEP_MS);
    this.host.requestUpdate();
  }

  private async copy(t: TicketDetail): Promise<void> {
    if (this.lend.busy()) return;
    try {
      const answer = await ticketsS4Api().copyLink(t.id);
      const ok = await toClipboard(answer.url);
      this.keep(answer, !ok);
      this.lend.say(ok ? tt('lkCopied') : tt('lkCopyFailed'), ok ? 'ok' : 'bad');
      // the copy wrote "sent by hand" and a timeline row: read the ticket again so the panel and the timeline show it
      this.lend.reload();
    } catch (e) {
      this.lend.say(describeError(e), 'bad');
    }
  }

  private async copyText(): Promise<void> {
    if (!this.copied) return;
    const ok = await toClipboard(this.copied.text);
    if (ok) this.lend.say(tt('lkCopied'));
    else this.copied = { ...this.copied, manual: true };
    this.host.requestUpdate();
  }

  /** PHYSENTRY070-295: tick / untick "physical entry required" on the current outside assignment (only while the server offers it). */
  private async setEntry(t: TicketDetail, value: boolean): Promise<void> {
    this.confirm = null;
    this.copied = null;
    await this.lend.run(() => ticketsS4Api().setAccessNeeded(t.id, value, t.revision) as Promise<TicketWithLink>, value ? tt('lkEntrySet') : tt('lkEntryClear'));
  }

  private async act(t: TicketDetail, action: 'new' | 'revoke'): Promise<void> {
    this.confirm = null;
    this.copied = null;
    await this.lend.run(() => ticketsS4Api().linkAction(t.id, action) as Promise<TicketWithLink>, action === 'new' ? tt('lkNewDone') : tt('lkRevoked'));
  }

  /** Slice 5b: the current link again through the message channel - a new message; the link's sliding expiry moves (10.2). */
  private async resend(t: TicketDetail): Promise<void> {
    this.copied = null;
    await this.lend.run(() => messagesApi().resendLink(t.id), mtt('queuedNow'));
  }

  private stateLine(l: LinkBlock): string {
    if (l.state === 'grace' && l.grace_until) return tt('lkGraceUntil', { when: shortDateTime(l.grace_until) });
    if (l.state === 'live') return tt('lkExpires', { when: shortDateTime(l.expires_at) });
    if (l.state === 'revoked' && l.revoked_reason) return tt(`lkReason_${l.revoked_reason}` as TicketTextKey);
    return '';
  }

  render(t: TicketDetail): TemplateResult | typeof nothing {
    const l = (t as TicketWithLink).link;
    if (!l) return nothing;
    const tone = l.state === 'live' ? 'ok' : l.state === 'grace' ? 'info' : 'warn';
    const opened = l.open_count ? tt('lkOpened', { n: l.open_count, when: relTime(l.last_opened_at ?? l.first_opened_at ?? l.created_at) }) : tt('lkNeverOpened');
    const busy = this.lend.busy();
    const facts = [opened, l.devices > 1 ? tt('lkDevices', { n: l.devices }) : '', l.update_count ? tt('lkUpdates', { n: l.update_count }) : ''].filter(Boolean).join(' · ');
    return html`<div class="lkp" data-link-panel data-link-state=${l.state}>
      <div class="lkh">${tIcon('link')}<b>${tt('lkTitle')}</b>
        <span class=${`chip ${tone}`} data-link-chip>${tt(`lk_${l.state}` as TicketTextKey)}</span>
        ${l.kind === 'staff' ? html`<span class="chip tag" data-link-staff>${tt('lkStaff')}</span>` : nothing}
        ${l.require_code ? html`<span class="chip tag" data-link-code>${tIcon('lock')}${tt('lkCode')}</span>` : nothing}
        ${l.code_locked ? html`<span class="chip warn" data-link-locked>${tt('lkCodeLocked')}</span>` : nothing}
      </div>
      <small class="lkl">${this.stateLine(l)}${l.sent_via === 'manual' && l.state === 'live' ? ` · ${tt('lkSentManual')}` : ''}</small>
      <small class="lkl" data-link-opened>${facts}</small>
      ${this.copied?.manual ? html`<div class="lkcopy" data-link-manual>
        <input class="inp" readonly dir="ltr" aria-label=${tt('lkCopy')} .value=${this.copied.url} @focus=${(e: Event) => (e.target as HTMLInputElement).select()} />
        <textarea class="inp" readonly aria-label=${tt('lkCopyText')} .value=${this.copied.text} @focus=${(e: Event) => (e.target as HTMLTextAreaElement).select()}></textarea>
      </div>` : nothing}
      ${this.confirm ? html`<div class="lkconfirm" role="group" data-link-confirm=${this.confirm}>
        <span>${this.confirm === 'new' ? tt('lkNewConfirm') : this.confirm === 'entry-off' ? tt('lkEntryConfirm') : tt('lkRevokeConfirm')}</span>
        <span class="lkacts">
          <button type="button" class=${`btn sm ${this.confirm === 'revoke' ? 'danger' : 'primary'}`} data-link-confirm-ok ?disabled=${busy} @click=${() => (this.confirm === 'entry-off' ? void this.setEntry(t, false) : void this.act(t, this.confirm as 'new' | 'revoke'))}>
            ${this.confirm === 'new' ? tt('lkNew') : this.confirm === 'entry-off' ? tt('lkEntryOff') : tt('lkRevoke')}</button>
          <button type="button" class="btn sm" data-link-confirm-back @click=${() => { this.confirm = null; this.host.requestUpdate(); }}>${tt('back')}</button>
        </span>
      </div>` : html`<div class="lkacts">
        ${l.can.copy ? html`<button type="button" class="btn sm primary" data-link-copy ?disabled=${busy} @click=${() => void this.copy(t)}>${tIcon('copy')}${tt('lkCopy')}</button>` : nothing}
        ${this.copied && !this.copied.manual ? html`<button type="button" class="btn sm" data-link-copy-text @click=${() => void this.copyText()}>${tIcon('note')}${tt('lkCopyText')}</button>` : nothing}
        ${l.access_needed?.available ? html`<button type="button" class="btn sm" data-link-entry aria-pressed=${String(l.access_needed.on)} ?disabled=${busy}
          @click=${() => (l.access_needed!.on ? ((this.confirm = 'entry-off'), this.host.requestUpdate()) : void this.setEntry(t, true))}>${tIcon('lock')}${tt('lkEntry')}</button>` : nothing}
        ${l.can.resend ? html`<button type="button" class="btn sm" data-link-resend ?disabled=${busy} @click=${() => void this.resend(t)}>${tIcon('send')}${mtt('lkResend')}</button>` : nothing}
        ${l.can.new ? html`<button type="button" class="btn sm" data-link-new ?disabled=${busy} @click=${() => { this.confirm = 'new'; this.host.requestUpdate(); }}>${tIcon('refresh')}${tt('lkNew')}</button>` : nothing}
        ${l.can.revoke ? html`<button type="button" class="btn sm quiet dz" data-link-revoke ?disabled=${busy} @click=${() => { this.confirm = 'revoke'; this.host.requestUpdate(); }}>${tIcon('x')}${tt('lkRevoke')}</button>` : nothing}
      </div>`}
    </div>`;
  }
}

export const linkPanelStyles = css`
  .lkp {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-block-start: 10px;
    padding: 12px 14px;
    border-radius: var(--sw-r-lg);
    border: 1px solid var(--dv-border);
    background: var(--dv-surface);
    min-inline-size: 0;
  }
  .lkh {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .lkl {
    color: var(--dv-text-2);
    font-size: var(--sw-fs-sm);
    overflow-wrap: anywhere;
  }
  .lkacts {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .lkconfirm {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 12px;
    border-radius: var(--sw-r-md);
    background: var(--dv-warning-soft);
    font-size: var(--sw-fs-base);
  }
  .lkcopy {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .lkcopy textarea {
    min-block-size: 96px;
  }
`;
