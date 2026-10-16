import { css, html, nothing, type ReactiveController, type ReactiveControllerHost, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { describeError } from '../api/client';
import { isApi } from '../api/session';
import type { TicketDetail } from '../api/tickets';
import { ticketsS4Api, type AssignPreview, type AssigneesAnswer, type ExternalAssignee, type Readiness, type TicketWithLink } from '../api/tickets-s4';
import type { AssignPreviewExtra } from '../api/tickets-messages';
import { bidi } from '../i18n/bidi';
import { tIcon } from './icons';
import { assignLines } from './message-lines';
import { mtt } from './messages-text';
import { TICKET_TEXT_KEYS, tt, type TicketTextKey } from './text';
import { ct, type CostTextKey } from './cost-text'; // slice 9
import { outsideBlock, staffBlock, usersBlock, whatsappNote, type ReadyItem } from './readiness-model';

type CostModeChoice = 'required' | 'optional' | 'off';

/** The dialog's three groups (owner 2026-10-14): handlers with an account, employees without one, vendors and contacts. TKSTAFF2: the
 * first two are both HANDLERS (one list, one picker and one submit in the host - tickets/assignee-model.ts); this controller runs the
 * third (outside contacts) only. */
export type AssignKind = 'user' | 'employee' | 'person';
/** How many handlers of each handler group the server offered (null = still loading). */
export interface HandlerCounts { user: number | null; employee: number | null }

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
  /** what sending outside still needs (absent on the demo store / an older server) */
  readiness: Readiness | null = null;
  pick = '';
  query = '';
  requireCode = false;
  shareHistory = false;
  /** slice 9 (D32): "דרישת עלות: חובה / רשות / בלי" - null = the preview's preselection (vendor -> department -> installation) */
  costClaim: 'required' | 'optional' | 'off' | null = null;
  preview: AssignPreview | null = null;
  showText = false;
  error = '';
  /** slice 5b (D29): the person's "send now" choice outside the send hours; null = the preview's default (critical priorities) */
  sendNow: boolean | null = null;
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
    this.readiness = null;
    this.pick = '';
    this.query = '';
    this.requireCode = false;
    this.shareHistory = false;
    this.costClaim = null;
    this.preview = null;
    this.showText = false;
    this.error = '';
    this.sendNow = null;
    this.pending = '';
    this.seq += 1;
  }

  /** TKUI1 (the new-request sheet's vendor flow, step two): open on the outside group with this contact chosen once the list is in. */
  private pending = '';
  preselect(contactId: string): void {
    this.kind = 'person';
    this.pending = contactId;
    this.host.requestUpdate();
  }

  private applyPending(t: TicketDetail): void {
    const id = this.pending;
    this.pending = '';
    const c = id ? this.groupRows().find((x) => x.id === id) : undefined;
    if (c) this.choose(t, c);
  }

  /** The answer of `GET tickets/assignees` the dialog already asked for (it carries the outside contacts on a server). */
  take(r: AssigneesAnswer, t: TicketDetail): void {
    if (r.contacts !== undefined || isApi()) {
      this.contacts = r.contacts ?? [];
      this.external = !!r.external;
      this.publicReady = !!r.public_ready;
      this.readiness = r.readiness ?? null;
      this.applyPending(t);
      this.host.requestUpdate();
      return;
    }
    // the demo store's user list does not carry them: ask the slice-4 demo store
    void ticketsS4Api().externalAssignees(t.department?.id ?? '', t.id).then((x) => {
      this.contacts = x.contacts ?? [];
      this.external = !!x.external;
      this.publicReady = !!x.public_ready;
      this.readiness = x.readiness ?? null;
      this.applyPending(t);
      this.host.requestUpdate();
    }).catch(() => undefined);
  }

  /** Whether the caller may send this ticket outside (tickets.external where the ticket lies). */
  private mayExternal(t: TicketDetail): boolean {
    return t.can.assign_external || this.external;
  }

  /** The outside contacts the dialog may offer for this ticket (staff contacts are handlers - TKSTAFF2). */
  private groupRows(): ExternalAssignee[] {
    return (this.contacts ?? []).filter((c) => c.contact_kind !== 'employee');
  }

  /** Why a group cannot be used now (one short reason with the link to its setting), or null. `n` = how many handlers of that handler
   * group the server listed (ignored for the outside group). */
  blocked(t: TicketDetail, k: AssignKind, n: number | null): ReadyItem | null {
    if (k === 'user') return n === null ? null : usersBlock(n);
    if (k === 'employee') return n === null ? null : staffBlock({ readiness: this.readiness, publicReady: this.publicReady || !isApi(), count: n });
    if (this.contacts === null && this.mayExternal(t)) return null; // still loading
    return outsideBlock('person', { external: this.mayExternal(t), readiness: this.readiness, publicReady: this.publicReady || !isApi(), count: this.groupRows().length });
  }

  /** The host's group switch: the handler groups are the host's picker, the outside group this controller's. */
  get outside(): boolean {
    return this.kind === 'person';
  }

  /** One reason line: the words and the link to the exact setting. */
  reasonLine(item: ReadyItem, kind = 'block'): TemplateResult {
    return html`<div class=${`xreason ${kind}`} data-blocked=${item.key}>${tIcon(kind === 'note' ? 'warning' : 'lock')}<span>${tt(item.text)}</span>
      <a href=${item.href} data-blocked-link=${item.key}>${tt(item.link)}</a></div>`;
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
    this.sendNow = null;
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
    if (c.contact_kind === 'employee') return false; // TKSTAFF2: a staff contact is a handler, never an outside row
    const q = this.query.trim().toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || c.company.toLowerCase().includes(q) || (c.vendor_name ?? '').toLowerCase().includes(q);
  }

  /** The three groups at the top of the dialog - ALWAYS shown (owner 2026-10-14): a group that cannot be used now is dimmed and its
   * second line says why; choosing it shows the reason with the link to the setting. `counts` = how many handlers of each handler
   * group the server listed. */
  renderKinds(t: TicketDetail, counts: HandlerCounts): TemplateResult {
    const item = (k: AssignKind, label: TicketTextKey, sub: TicketTextKey) => {
      const why = this.blocked(t, k, k === 'person' ? null : counts[k]);
      return html`<button type="button" role="radio" aria-checked=${String(this.kind === k)} class=${why ? 'off' : ''} data-assign-kind=${k}
        data-kind-blocked=${why?.key ?? ''} @click=${() => this.setKind(k)}><b>${tt(label)}</b><small>${tt(why ? why.text : sub)}</small></button>`;
    };
    return html`<div class="seg xkinds" role="radiogroup" aria-label=${tt('fAssignee')} data-assign-kinds>
      ${item('user', 'asgInside', 'asgInsideSub')}${item('employee', 'asgGroupEmployees', 'asgEmployeesSub')}${item('person', 'asgOutside', 'asgOutsideSub')}
    </div>`;
  }

  private row(t: TicketDetail, c: ExternalAssignee): TemplateResult {
    return html`<label data-contact=${c.id} data-contact-kind=${c.contact_kind}>
      <input type="radio" name="asgc" .checked=${this.pick === c.id} @change=${() => this.choose(t, c)} />
      <span class="xtx"><span class="xnm">${bidi(c.name)}</span>
        <span class="xsub">${bidi([c.vendor_name ?? c.company, c.phone].filter(Boolean).join(' · '))}</span></span>
      ${c.require_code ? html`<small>${tIcon('lock')}${tt('lkCode')}</small>` : nothing}</label>`;
  }

  /** The picker of the outside group (vendors and contacts) and the chosen row's options. */
  renderPicker(t: TicketDetail): TemplateResult {
    const k = 'person';
    const why = this.blocked(t, k, null);
    if (why) return this.reasonLine(why);
    if (this.contacts === null) return html`<span class="skl" style="block-size:44px"></span>`;
    const list = this.contacts.filter((c) => this.matches(c));
    const chosen = this.contacts.find((c) => c.id === this.pick) ?? null;
    const p = this.preview;
    const wa = whatsappNote(this.readiness);
    // vendors and contacts in one group, each under its own small heading when both are there
    const vendors = k === 'person' ? list.filter((c) => c.contact_kind === 'vendor') : [];
    const others = k === 'person' ? list.filter((c) => c.contact_kind !== 'vendor') : list;
    const headed = vendors.length > 0 && others.length > 0;
    return html`
      ${wa ? this.reasonLine(wa, 'note') : nothing}
      <label class="fld"><span class="vh">${tt('asgSearch')}</span><input class="inp" type="search" maxlength="60" data-contact-search placeholder=${tt('asgSearch')}
        .value=${this.query} @input=${(e: Event) => { this.query = (e.target as HTMLInputElement).value; this.host.requestUpdate(); }} /></label>
      ${list.length ? html`<div class="pick xpick" role="radiogroup" aria-label=${tt('fAssignee')}>
          ${headed ? html`<span class="xgh" data-group="vendors">${tt('hdSeg_vendors')}</span>` : nothing}${repeat(vendors, (c) => c.id, (c) => this.row(t, c))}
          ${headed ? html`<span class="xgh" data-group="contacts">${tt('hdSeg_contacts')}</span>` : nothing}${repeat(others, (c) => c.id, (c) => this.row(t, c))}</div>`
        : html`<div class="muted" data-contacts-none>${tt('ctNone')}</div>`}
      ${chosen ? html`<div class="xopts" data-contact-options>
        <label class="chk"><input type="checkbox" data-require-code .checked=${this.requireCode} ?disabled=${chosen.require_code || this.lend.busy()}
          @change=${(e: Event) => { this.requireCode = (e.target as HTMLInputElement).checked; void this.loadPreview(t); }} />${tt('asgRequireCode')}</label>
        ${chosen.require_code ? html`<span class="muted xnote">${tt('asgRequireCodeLocked')}</span>` : this.requireCode ? html`<span class="muted xnote">${tt('asgRequireCodeNote')}</span>` : nothing}
        ${p?.share_history.available ? html`<label class="chk"><input type="checkbox" data-share-history .checked=${this.shareHistory}
          @change=${(e: Event) => { this.shareHistory = (e.target as HTMLInputElement).checked; this.host.requestUpdate(); }} />${tt('asgShareHistory')}</label>` : nothing}
        ${this.costChoice()}
      </div>` : nothing}
      ${p ? html`<div class="xinfo" data-assign-preview>
        <span class="muted">${tIcon('link')}${tt('asgLinkLine', { days: p.link.cap_days, grace: p.link.grace_hours })}</span>
        ${p.channel === 'manual' ? html`<span class="muted">${tIcon('copy')}${tt('asgManualLine')}</span>` : this.channelLines(p)}
        ${p.refusals.map((r) => html`<div class="err" role="alert" data-refusal=${r}>${refusalText(r)}</div>`)}
        <button type="button" class="btn sm quiet" aria-expanded=${String(this.showText)} data-preview-toggle @click=${() => { this.showText = !this.showText; this.host.requestUpdate(); }}>
          ${tIcon('note')}${this.showText ? tt('asgPreviewHide') : tt('asgPreview')}</button>
        ${this.showText ? html`<pre class="pv" dir=${p.lang === 'he' || p.lang === 'ar' ? 'rtl' : 'ltr'} lang=${p.lang} data-preview-text>${p.text}</pre>` : nothing}
      </div>` : nothing}
      ${this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing}`;
  }

  /** Slice 5b: the message this assignment queues - its channel and account, a WhatsApp account that cannot send now (the message
   * waits, then falls back, 9.9.4) and, outside the send hours, when it leaves with the "send now" choice (D29). */
  private channelLines(p: AssignPreview): TemplateResult | typeof nothing {
    const l = assignLines(p as AssignPreview & AssignPreviewExtra);
    if (!l) return nothing;
    return html`<span class="muted" data-assign-channel=${p.channel}>${tIcon(p.channel === 'email' ? 'note' : 'send')}${l.via}</span>
      ${l.down ? html`<span class="muted" data-assign-down>${tIcon('warning')}${l.down}</span>` : nothing}
      ${l.hours ? html`<span class="muted" data-assign-hours>${tIcon('clock')}${l.hours}</span>
        <label class="chk"><input type="checkbox" data-assign-send-now .checked=${this.sendNow ?? l.sendNowDefault} ?disabled=${this.lend.busy()}
          @change=${(e: Event) => { this.sendNow = (e.target as HTMLInputElement).checked; this.host.requestUpdate(); }} />${mtt('sendNow')}</label>` : nothing}`;
  }

  /** The "send now" the assignment carries: only outside the send hours, the person's choice or the preview's default. */
  private sendNowChoice(): boolean {
    const l = this.preview ? assignLines(this.preview as AssignPreview & AssignPreviewExtra) : null;
    return !!l && !!l.hours && (this.sendNow ?? l.sendNowDefault);
  }

  /** Slice 9 (D32): the claim requirement of this assignment, preselected from the preview (vendor -> department -> installation). */
  private costChoice(): TemplateResult | typeof nothing {
    const opt = (this.preview as unknown as { cost_claim?: { default: CostModeChoice; choices: CostModeChoice[] } } | null)?.cost_claim;
    if (!opt) return nothing;
    const value = this.costClaim ?? opt.default;
    return html`<div class="fld" data-cost-claim=${value}><span>${ct('mode')}</span>
      <span class="seg sm" role="radiogroup" aria-label=${ct('mode')}>${opt.choices.map((m) => html`<button type="button" role="radio" aria-checked=${String(value === m)}
        data-cost-claim-mode=${m} ?disabled=${this.lend.busy()} @click=${() => { this.costClaim = m; this.host.requestUpdate(); }}>${ct(`m_${m}` as CostTextKey)}</button>`)}</span></div>`;
  }

  /** TKASSIGNDLG: whether the chosen outside contact is a vendor (the message field says "vendor" or "handler"). */
  get pickedVendor(): boolean {
    return !!this.contacts?.find((c) => c.id === this.pick && c.contact_kind === 'vendor');
  }

  /** Whether the dialog's OK button may be pressed for an outside contact. */
  ready(): boolean {
    return !!this.pick && !!this.preview && this.preview.refusals.length === 0;
  }

  /** Assign to the chosen contact; true when the dialog may close. */
  async submit(t: TicketDetail, note: string): Promise<boolean> {
    if (!this.ready()) return false;
    const chosen = this.contacts?.find((c) => c.id === this.pick);
    return this.lend.run(() => ticketsS4Api().assignContact(t.id, {
      contactId: this.pick, note: note || null, noteExternal: false, revision: t.revision,
      requireCode: this.requireCode && !chosen?.require_code ? true : null,
      shareHistory: this.preview?.share_history.available ? this.shareHistory : null,
      sendNow: this.sendNowChoice() || null, // slice 5b (D29)
      costClaim: this.costClaim, // slice 9 (D32)
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
  .xkinds b,
  .xkinds small {
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  /* a phone: the three kinds are rows of one column (three tiles with two lines each do not fit a 320 px dialog). As specific as a
     skin's segmented-control rule (and later in the host's sheet list), so a pill track never cuts the first and last rows' text */
  @media (max-width: 560px) {
    :host .seg.xkinds {
      grid-template-columns: minmax(0, 1fr);
      border-radius: var(--sw-r-lg);
      padding: 4px;
    }
    :host .seg.xkinds button {
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      min-block-size: 44px;
      padding-inline: 14px;
      border-radius: var(--sw-r-md);
    }
    .xkinds small {
      text-align: end;
    }
  }
  /* a group that cannot be used now: dimmed, its second line says why (owner 2026-10-14) */
  .xkinds button.off b {
    color: var(--dv-text-3);
  }
  .xkinds button.off small {
    color: var(--sw-warning, var(--dv-text-3));
  }
  .xreason {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 8px;
    padding: 10px 12px;
    border: 1px solid var(--dv-border);
    border-radius: var(--sw-r-lg);
    background: var(--dv-surface);
    font-size: var(--sw-fs-sm);
    overflow-wrap: anywhere;
  }
  .xreason.note {
    padding: 0;
    border: 0;
    background: none;
    color: var(--dv-text-3);
  }
  .xreason a {
    color: var(--dv-accent-text, var(--dv-accent));
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  /* the list scrolls at its max height: its rows keep their own height (a squeezed row cut its two-line text) */
  .xpick > * {
    flex-shrink: 0;
  }
  .xgh {
    padding-block: 6px 0;
    font-size: var(--sw-fs-xs);
    font-weight: 600;
    color: var(--dv-text-3);
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
