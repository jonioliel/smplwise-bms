import { css, html, nothing, type ReactiveController, type ReactiveControllerHost, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { describeError } from '../api/client';
import { isApi } from '../api/session';
import type { TicketDetail } from '../api/tickets';
import { ticketsS4Api, type AssignPreview, type AssigneesAnswer, type ExternalAssignee, type TicketWithLink } from '../api/tickets-s4';
import { bidi } from '../i18n/bidi';
import { tIcon } from './icons';
import { TICKET_TEXT_KEYS, tt, type TicketTextKey } from './text';

export type AssignKind = 'user' | 'person' | 'vendor';

/** A refusal the preview names, in words (an unknown code - a newer server - shows the general line). */
export function refusalText(code: string): string {
  const key = `refusal_${code}`;
  return (TICKET_TEXT_KEYS as readonly string[]).includes(key) ? tt(key as TicketTextKey) : tt('refusal_other');
}

/** What the assign dialog's host lends the controller: the one place a new ticket is taken in, and the busy flag. */
export interface ExternalAssignHost {
  busy: () => boolean;
  /** run an API call the way the host runs every action (busy flag, the new ticket, the server's message on a refusal) */
  run: (fn: () => Promise<TicketDetail>, done: string) => Promise<boolean>;
}

/**
 * CR-038 slice 4: sending a ticket outside from the assign dialog of `<ticket-detail>` (spec 8.1 / 9.7 / 10, D23, D25). The dialog
 * keeps its user list; this controller adds the kind switch (a user / an outside contact / a vendor - offered only to a holder of
 * `tickets.external` with the handler page set up), the contact picker, "require a verification code" (raise only: a contact whose
 * own setting requires it shows it locked), "share the device history" (only where the server says a snapshot exists), the exact
 * outgoing text from the preview route and every refusal it names. The assignment itself is the server's (`POST .../assign` with
 * `{kind: 'contact'}`); nothing is sent from here - in slice 4 the manager copies the link from the ticket's link panel.
 * Rendered inside the host's shadow root (it shares the dialog's styles; `externalAssignStyles` adds the few it needs).
 */
export class ExternalAssign implements ReactiveController {
  kind: AssignKind = 'user';
  contacts: ExternalAssignee[] | null = null;
  /** whether the caller may send outside at all (tickets.external where the ticket lies) */
  external = false;
  publicReady = false;
  pick = '';
  query = '';
  requireCode = false;
  shareHistory = false;
  preview: AssignPreview | null = null;
  showText = false;
  error = '';
  private seq = 0;

  constructor(private readonly host: ReactiveControllerHost, private readonly lend: ExternalAssignHost) {
    host.addController(this);
  }

  hostConnected(): void {}

  /** The dialog opened: back to the user list, nothing picked. */
  reset(): void {
    this.kind = 'user';
    this.contacts = null;
    this.external = false;
    this.publicReady = false;
    this.pick = '';
    this.query = '';
    this.requireCode = false;
    this.shareHistory = false;
    this.preview = null;
    this.showText = false;
    this.error = '';
    this.seq += 1;
  }

  /** The answer of `GET tickets/assignees` the dialog already asked for (it carries the outside contacts on a server). */
  take(r: AssigneesAnswer, t: TicketDetail): void {
    if (r.contacts !== undefined || isApi()) {
      this.contacts = r.contacts ?? [];
      this.external = !!r.external;
      this.publicReady = !!r.public_ready;
      this.host.requestUpdate();
      return;
    }
    // the demo store's user list does not carry them: ask the slice-4 demo store
    void ticketsS4Api().externalAssignees(t.department?.id ?? '', t.id).then((x) => {
      this.contacts = x.contacts ?? [];
      this.external = !!x.external;
      this.publicReady = !!x.public_ready;
      this.host.requestUpdate();
    }).catch(() => undefined);
  }

  /** Whether the dialog shows the kind switch at all (a caller without `tickets.external` sees the user list only, as before). */
  offered(t: TicketDetail): boolean {
    return t.can.assign_external || (this.external && (this.contacts?.length ?? 0) > 0);
  }

  private setKind(k: AssignKind): void {
    this.kind = k;
    this.pick = '';
    this.preview = null;
    this.error = '';
    this.host.requestUpdate();
  }

  private choose(t: TicketDetail, c: ExternalAssignee): void {
    this.pick = c.id;
    this.requireCode = c.require_code;
    this.shareHistory = false;
    this.error = '';
    void this.loadPreview(t);
  }

  private async loadPreview(t: TicketDetail): Promise<void> {
    const mine = ++this.seq;
    this.preview = null;
    this.host.requestUpdate();
    try {
      const p = await ticketsS4Api().preview(t.id, this.pick, this.requireCode);
      if (mine !== this.seq) return;
      this.preview = p;
      if (!this.shareHistory) this.shareHistory = p.share_history.default;
    } catch (e) {
      if (mine === this.seq) this.error = describeError(e);
    }
    this.host.requestUpdate();
  }

  private matches(c: ExternalAssignee): boolean {
    const want = this.kind === 'vendor' ? 'vendor' : 'person';
    if (c.contact_kind !== want) return false;
    const q = this.query.trim().toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || c.company.toLowerCase().includes(q) || (c.vendor_name ?? '').toLowerCase().includes(q);
  }

  /** The segmented switch at the top of the dialog. */
  renderKinds(t: TicketDetail): TemplateResult | typeof nothing {
    if (!this.offered(t)) return nothing;
    const item = (k: AssignKind, label: TicketTextKey, sub: TicketTextKey) => html`<button type="button" role="radio" aria-checked=${String(this.kind === k)}
      data-assign-kind=${k} @click=${() => this.setKind(k)}><b>${tt(label)}</b><small>${tt(sub)}</small></button>`;
    return html`<div class="seg xkinds" role="radiogroup" aria-label=${tt('fAssignee')} data-assign-kinds>
      ${item('user', 'asgInside', 'asgInsideSub')}${item('person', 'asgContact', 'asgContactSub')}${item('vendor', 'asgVendor', 'asgVendorSub')}
    </div>`;
  }

  /** The contact picker and its options (only for kind person / vendor). */
  renderPicker(t: TicketDetail): TemplateResult {
    if (!t.can.assign_external && !this.external) return html`<div class="banner warn" data-external-locked>${tIcon('lock')}<div>${tt('asgExternalLocked')}</div></div>`;
    if (!this.publicReady && isApi()) return html`<div class="banner warn" data-public-not-ready>${tIcon('warning')}<div>${tt('asgPublicNotReady')}</div></div>`;
    if (this.contacts === null) return html`<span class="skl" style="block-size:44px"></span>`;
    const list = this.contacts.filter((c) => this.matches(c));
    const chosen = this.contacts.find((c) => c.id === this.pick) ?? null;
    const p = this.preview;
    return html`
      <label class="fld"><span class="vh">${tt('asgSearch')}</span><input class="inp" type="search" maxlength="60" data-contact-search placeholder=${tt('asgSearch')}
        .value=${this.query} @input=${(e: Event) => { this.query = (e.target as HTMLInputElement).value; this.host.requestUpdate(); }} /></label>
      ${list.length ? html`<div class="pick xpick" role="radiogroup" aria-label=${tt('fAssignee')}>${repeat(list, (c) => c.id, (c) => html`<label data-contact=${c.id}>
          <input type="radio" name="asgc" .checked=${this.pick === c.id} @change=${() => this.choose(t, c)} />
          <span class="xtx"><span class="xnm">${bidi(c.name)}</span>
            <span class="xsub">${bidi([c.vendor_name ?? c.company, c.phone].filter(Boolean).join(' · '))}</span></span>
          ${c.require_code ? html`<small>${tIcon('lock')}${tt('lkCode')}</small>` : nothing}</label>`)}</div>`
        : html`<div class="muted" data-contacts-none>${tt('asgNoContacts')}</div>`}
      ${chosen ? html`<div class="xopts" data-contact-options>
        <label class="chk"><input type="checkbox" data-require-code .checked=${this.requireCode} ?disabled=${chosen.require_code || this.lend.busy()}
          @change=${(e: Event) => { this.requireCode = (e.target as HTMLInputElement).checked; void this.loadPreview(t); }} />${tt('asgRequireCode')}</label>
        ${chosen.require_code ? html`<span class="muted xnote">${tt('asgRequireCodeLocked')}</span>` : this.requireCode ? html`<span class="muted xnote">${tt('asgRequireCodeNote')}</span>` : nothing}
        ${p?.share_history.available ? html`<label class="chk"><input type="checkbox" data-share-history .checked=${this.shareHistory}
          @change=${(e: Event) => { this.shareHistory = (e.target as HTMLInputElement).checked; this.host.requestUpdate(); }} />${tt('asgShareHistory')}</label>` : nothing}
      </div>` : nothing}
      ${p ? html`<div class="xinfo" data-assign-preview>
        <span class="muted">${tIcon('link')}${tt('asgLinkLine', { days: p.link.cap_days, grace: p.link.grace_hours })}</span>
        ${p.channel === 'manual' ? html`<span class="muted">${tIcon('copy')}${tt('asgManualLine')}</span>` : nothing}
        ${p.refusals.map((r) => html`<div class="err" role="alert" data-refusal=${r}>${refusalText(r)}</div>`)}
        <button type="button" class="btn sm quiet" aria-expanded=${String(this.showText)} data-preview-toggle @click=${() => { this.showText = !this.showText; this.host.requestUpdate(); }}>
          ${tIcon('note')}${this.showText ? tt('asgPreviewHide') : tt('asgPreview')}</button>
        ${this.showText ? html`<pre class="pv" dir=${p.lang === 'he' || p.lang === 'ar' ? 'rtl' : 'ltr'} lang=${p.lang} data-preview-text>${p.text}</pre>` : nothing}
      </div>` : nothing}
      ${this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing}`;
  }

  /** Whether the dialog's OK button may be pressed for an outside contact. */
  ready(): boolean {
    return !!this.pick && !!this.preview && this.preview.refusals.length === 0;
  }

  /** Assign to the chosen contact; true when the dialog may close. */
  async submit(t: TicketDetail, note: string, noteExternal: boolean): Promise<boolean> {
    if (!this.ready()) return false;
    const chosen = this.contacts?.find((c) => c.id === this.pick);
    return this.lend.run(() => ticketsS4Api().assignContact(t.id, {
      contactId: this.pick, note: note || null, noteExternal, revision: t.revision,
      requireCode: this.requireCode && !chosen?.require_code ? true : null,
      shareHistory: this.preview?.share_history.available ? this.shareHistory : null,
    }) as Promise<TicketWithLink>, tt('saved'));
  }
}

/** The few rules the outside parts of the dialog need beyond the detail's own (`.seg`, `.pick`, `.chk`, `.btn` come from there). */
export const externalAssignStyles = css`
  .vh {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .xkinds {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    inline-size: 100%;
  }
  .xkinds button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    min-block-size: 52px;
    padding-inline: 6px;
  }
  .xkinds small {
    font-size: var(--sw-fs-xs);
    font-weight: 500;
    color: var(--dv-text-3);
    text-align: center;
  }
  .xpick .xtx {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    padding-block: 6px;
  }
  .xpick .xnm {
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .xpick .xsub {
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-3);
    overflow-wrap: anywhere;
  }
  .xpick small {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }
  .xopts,
  .xinfo {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .xinfo .muted {
    display: inline-flex;
    align-items: flex-start;
    gap: 6px;
    font-size: var(--sw-fs-sm);
  }
  .xnote {
    font-size: var(--sw-fs-sm);
    padding-inline-start: 26px;
  }
  .xinfo .btn {
    align-self: flex-start;
  }
  .pv {
    margin: 0;
    padding: 10px 14px;
    border-radius: var(--sw-r-lg);
    border: 1px solid var(--dv-border);
    background: var(--dv-surface);
    font: inherit;
    font-size: var(--sw-fs-base);
    line-height: 1.55;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
`;
