import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-dialog';
import { describeError } from '../api/client';
import {
  getNotice, grantableDoors, listApprovers, requestGrant, type ApproversReply, type GrantableDoors, type GrantableStation, type NoticeReply,
} from '../api/access-grants';
import { ticketsS4Api, type Contact } from '../api/tickets-s4';
import { ticketsApi, type TicketItem } from '../api/tickets';
import { ticketsEnabled } from '../tickets/gate';
import { phoneVerifyApi } from '../api/tickets-phone-verify';
import { dateInZone, minuteInZone } from '../api/recordings';
import { xCss } from './styles';
import {
  LANGS, MAX_WINS, NOTES_MAX, PRESETS, PURPOSE_MAX, bodyOf, chosenStations, codeDue, confirmedNumber, daySpan, dm, doorKey, eligibility, freshForm,
  keepRequestable, rangeDates, selfBlock, splitDoor, validate, type Ctx, type Errs, type ErrKey, type Lang, type RequestForm,
} from './request-model';
import { rt, type RtKey } from '../i18n/access-request';
import { xtLang } from '../i18n/access-external';
import { dateInputLang, timeText } from '../api/day-format';

/**
 * ACCESSREQ-293: the manual "request external access" form, built from the owner-approved mockup
 * (private/planning/mockup_access_request_2026-10-20) with the owner's decisions of 2026-10-20:
 *  (a) "I approve now" only for a system administrator (anyone else: a second person approves - the server refuses it too);
 *  (b) the doors a manager who may only request can choose come from the server (`may_request`: entrances + the ticket's station);
 *  (c) writing the name to WisKey stays manual (nothing here writes a name).
 * Who (directory or a new person) · purpose · doors · when · credential · notes | approval path · privacy notice · what the person
 * receives. The entry code is never shown. The server decides every permission and checks every field again.
 * Events: `close`; `done` with `{ text }` after a request was stored.
 */
@customElement('access-request-dialog')
export class AccessRequestDialog extends LitElement {
  @property() tz = 'Asia/Jerusalem';
  @property({ type: Number }) codeHour = 18;
  /** contacts that hold a live grant (a new request for them counts as a widening) */
  @property({ attribute: false }) live: Set<string> = new Set();
  @property({ type: Boolean }) noPerm = false;
  /** GRANTS3-295 (X5): the cards switch is on - the card choice unlocks (the card is typed in the grant's drawer once it is active) */
  @property({ type: Boolean }) cards = false;

  @state() private f: RequestForm = freshForm();
  @state() private g: GrantableDoors | null = null;
  @state() private loadError = '';
  @state() private contacts: Contact[] | null = null;
  @state() private dirError = false;
  @state() private vendors: Contact[] = [];
  @state() private tickets: TicketItem[] = [];
  @state() private appr: ApproversReply | null = null;
  @state() private notice: NoticeReply | null = null;
  @state() private busy = false;
  @state() private error = '';
  @state() private sentCode = false;
  private apprKey = '';
  private noticeLang = '';
  private seq = 0;

  static styles = [
    xCss,
    css`
      :host { display: contents; --sw-ctl-h-md: max(44px, var(--sw-touch-desktop, 44px)); --sw-ctl-h-sm: max(44px, var(--sw-touch-desktop, 44px)); }
      .ap { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); gap: 22px; align-items: start; }
      .col { display: grid; gap: 20px; min-inline-size: 0; }
      .sec > h4 .sp { flex: 1; }
      .seg { display: flex; gap: 4px; padding: 3px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); }
      .seg button { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: 0; background: transparent; color: var(--sw-text-2);
        min-block-size: var(--sw-touch-desktop, 44px); border-radius: var(--sw-r-sm); font: inherit; font-size: var(--sw-fs-sm); cursor: pointer; padding: 0 10px; }
      .seg button[aria-pressed='true'] { background: var(--sw-surface-solid); color: var(--sw-heading); font-weight: 600; box-shadow: var(--sw-shadow-1); }
      .seg button:disabled { opacity: .5; cursor: not-allowed; }
      .seg button:focus-visible { outline: 2px solid var(--sw-focus); outline-offset: 1px; }
      .f2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 12px; }
      textarea.in { min-block-size: 76px; padding-block: 8px; resize: vertical; }
      select.in { appearance: auto; }
      .search { position: relative; }
      .search sw-icon { position: absolute; inset-inline-start: 11px; inset-block-start: 50%; transform: translateY(-50%); color: var(--sw-text-3); pointer-events: none; }
      .search .in { padding-inline-start: 36px; }
      .plist { display: grid; max-block-size: 232px; overflow: auto; border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-md); }
      .plist label { display: grid; grid-template-columns: 20px 34px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 9px 12px; border-block-end: 1px solid var(--sw-border); cursor: pointer; }
      .plist label:last-child { border-block-end: 0; }
      .plist label:hover { background: var(--sw-hover-wash); }
      .plist label.dis { cursor: not-allowed; opacity: .62; }
      .plist input { inline-size: 18px; block-size: 18px; margin: 0; accent-color: var(--sw-accent); }
      .av { inline-size: 34px; block-size: 34px; border-radius: 50%; background: var(--sw-accent-soft); color: var(--sw-accent-text); display: grid; place-items: center; font-size: var(--sw-fs-xs); font-weight: 700; flex: none; }
      .nm { min-inline-size: 0; }
      .nm b, .who b { display: block; color: var(--sw-heading); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .nm small, .who small { display: block; color: var(--sw-text-2); font-size: var(--sw-fs-xs); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .who { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 12px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); }
      .who .acts { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
      .who b { white-space: normal; overflow-wrap: anywhere; }
      .lockrow { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center; padding: 10px 12px; border-radius: var(--sw-r-sm); border: 1px dashed var(--sw-border-strong); color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
      .lockrow b { color: var(--sw-heading); }
      .st-h { display: flex; align-items: center; gap: 6px; font-size: var(--sw-fs-sm); font-weight: 600; color: var(--sw-text-2); grid-column: 1 / -1; margin-block-start: 4px; min-inline-size: 0; }
      .st-h span { overflow-wrap: anywhere; }
      .stgrp { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .stgrp label.cb { align-items: center; }
      .stgrp label.cb:has(input:checked) { background: var(--sw-accent-soft); border-color: var(--sw-accent); }
      .stgrp label.cb:has(input:disabled) { opacity: .6; cursor: not-allowed; }
      .stgrp b { display: block; font-weight: 600; color: var(--sw-heading); overflow-wrap: anywhere; }
      details.locked summary { cursor: pointer; display: inline-flex; gap: 6px; align-items: center; font-size: var(--sw-fs-sm); color: var(--sw-text-2); padding: 0 2px; min-block-size: var(--sw-touch-desktop, 44px); list-style: none; }
      details.locked summary::-webkit-details-marker { display: none; }
      .pills { display: flex; flex-wrap: wrap; gap: 6px; }
      .pill { border: 1px solid var(--sw-border-strong); background: var(--sw-surface-solid); color: var(--sw-text); border-radius: var(--sw-r-pill); min-block-size: var(--sw-touch-desktop, 44px); min-inline-size: 44px;
        padding: 0 12px; font: inherit; font-size: var(--sw-fs-sm); cursor: pointer; }
      .pill[aria-pressed='true'] { background: var(--sw-accent); border-color: var(--sw-accent); color: var(--sw-text-inverse); font-weight: 600; }
      .pill:focus-visible { outline: 2px solid var(--sw-focus); outline-offset: 2px; }
      .wins { display: grid; gap: 8px; }
      .win { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto; gap: 8px; align-items: center; }
      .radio { display: grid; gap: 8px; }
      .radio label.cb:has(input:checked) { background: var(--sw-accent-soft); border-color: var(--sw-accent); }
      .radio label.cb:has(input:disabled) { cursor: not-allowed; }
      .radio b { display: block; color: var(--sw-heading); }
      .apprs { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--sw-r-sm); background: var(--sw-surface-2); font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
      .avs { display: inline-flex; }
      .avs span { inline-size: 28px; block-size: 28px; border-radius: 50%; display: grid; place-items: center; background: var(--sw-accent-soft); color: var(--sw-accent-text);
        font-size: 11px; font-weight: 700; border: 2px solid var(--sw-surface); margin-inline-start: -6px; }
      .avs span:first-child { margin-inline-start: 0; }
      .ntext { padding: 12px 14px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); font-size: var(--sw-fs-sm); line-height: 1.6; color: var(--sw-text); max-block-size: 160px; overflow: auto; }
      .bubble { padding: 12px 14px; border-radius: var(--sw-r-md); background: var(--sw-success-soft); color: var(--sw-text); font-size: var(--sw-fs-sm); line-height: 1.6; max-inline-size: 440px; }
      .pin { display: inline-flex; gap: 3px; align-items: center; padding: 0 6px; border-radius: var(--sw-r-xs); background: var(--sw-surface-3); letter-spacing: 2px; direction: ltr; }
      .banner { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 14px; border-radius: var(--sw-r-md); background: var(--cs); color: var(--ct); font-weight: 600; font-size: var(--sw-fs-sm); }
      .banner .sp { flex: 1; }
      .loadstate { display: grid; justify-items: center; gap: 12px; text-align: center; padding: 24px 8px; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
      .hint.e { color: var(--x-err-t); font-weight: 600; font-size: var(--sw-fs-xs); }
      .in[aria-invalid='true'], label.cb[data-invalid] { border-color: var(--sw-danger); }
      .foot { display: flex; gap: 8px; align-items: center; inline-size: 100%; flex-wrap: wrap; }
      .foot .sp { flex: 1; }
      .nop { display: grid; justify-items: center; gap: 10px; text-align: center; padding: 8px 4px 4px; }
      .nop .art { inline-size: 56px; block-size: 56px; border-radius: var(--sw-r-lg); background: var(--sw-surface-2); display: grid; place-items: center; color: var(--sw-text-2); }
      .nop h3 { margin: 0; font-size: var(--sw-fs-lg); color: var(--sw-heading); }
      .nop p { margin: 0; color: var(--sw-text-2); font-size: var(--sw-fs-sm); max-inline-size: 340px; }
      @media (max-width: 900px) {
        .ap { grid-template-columns: 1fr; }
      }
      @media (max-width: 560px) {
        .f2, .stgrp { grid-template-columns: 1fr; }
        .who { grid-template-columns: auto minmax(0, 1fr); }
        .who > sw-button { grid-column: 1 / -1; }
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    if (!this.noPerm) void this.load();
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('f') || changed.has('g')) {
      void this.refreshApprovers();
      void this.refreshNotice();
    }
  }

  private today(): string {
    return dateInZone(new Date(), this.tz);
  }

  private async load(): Promise<void> {
    this.loadError = '';
    try {
      this.g = await grantableDoors(this.f.ticketId || null);
    } catch (e) {
      this.loadError = describeError(e);
      return;
    }
    if (this.contacts !== null && !this.dirError) return; // "check again": only the door list and its freshness
    void ticketsS4Api().contacts({}).then(
      (p) => {
        const rows = p.contacts.filter((c) => !c.erased);
        this.contacts = rows;
        this.vendors = rows.filter((c) => c.kind === 'vendor' && c.active);
      },
      () => {
        this.contacts = [];
        this.dirError = true;
      },
    );
    if (ticketsEnabled()) void ticketsApi().list({ scope: 'visible', status: 'open', limit: 50 }).then((p) => (this.tickets = p.items), () => (this.tickets = []));
  }

  private set(patch: Partial<RequestForm>): void {
    const next = { ...this.f, ...patch };
    if (next.path === 'self' && selfBlock(next, this.ctx(next))) next.path = 'send';
    this.f = next;
  }

  private contact(f = this.f): Contact | null {
    return f.mode === 'dir' && f.contactId ? this.contacts?.find((c) => c.id === f.contactId) ?? null : null;
  }

  private ctx(f = this.f): Ctx {
    return { today: this.today(), maxDoors: this.g?.max_doors ?? 4, maxDays: this.g?.max_days ?? 14, grantable: this.g, contact: this.contact(f), approvers: this.appr ? this.appr.count : null };
  }

  private personLang(): Lang {
    if (this.f.mode === 'new') return this.f.np.lang;
    const c = this.contact();
    if (c?.lang && (LANGS as readonly string[]).includes(c.lang)) return c.lang as Lang;
    return xtLang() === 'en' ? 'en' : 'he';
  }

  private async refreshApprovers(): Promise<void> {
    const st = chosenStations(this.f.doors);
    const key = `${st.join(',')}|${this.f.cred}`;
    if (key === this.apprKey) return;
    this.apprKey = key;
    if (!st.length) {
      this.appr = null;
      return;
    }
    const my = ++this.seq;
    try {
      const r = await listApprovers(st, this.f.cred);
      if (my === this.seq) this.appr = r;
    } catch {
      if (my === this.seq) this.appr = null;
    }
  }

  private async refreshNotice(): Promise<void> {
    const lang = this.personLang();
    if (lang === this.noticeLang || !this.g) return;
    this.noticeLang = lang;
    try {
      this.notice = await getNotice(lang);
    } catch {
      this.notice = null;
    }
  }

  private async changeTicket(id: string): Promise<void> {
    this.set({ ticketId: id });
    try {
      const g = await grantableDoors(id || null);
      this.g = g;
      this.f = { ...this.f, doors: keepRequestable(this.f.doors, g) };
    } catch {
      /* the previous list stays; the server checks the doors anyway */
    }
  }

  private close(): void {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private err(e: Errs, k: ErrKey): TemplateResult | typeof nothing {
    const x = e[k];
    return x ? html`<span class="hint e" data-err=${k} role="alert">${rt(x.key, x.vars)}</span>` : nothing;
  }

  private initials(name: string): string {
    return name.split(/[\s-]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('');
  }

  // ---------------------------------------------------------------- sections

  private whoSection(e: Errs): TemplateResult {
    const f = this.f;
    const seg = html`<div class="seg" role="group" aria-label=${rt('who')}>
      <button type="button" data-pmode="dir" aria-pressed=${String(f.mode === 'dir')} @click=${() => this.set({ mode: 'dir' })}><sw-icon name="users" size="15"></sw-icon>${rt('fromDir')}</button>
      <button type="button" data-pmode="new" aria-pressed=${String(f.mode === 'new')} @click=${() => this.set({ mode: 'new' })}><sw-icon name="user" size="15"></sw-icon>${rt('newPerson')}</button></div>`;
    let body: TemplateResult;
    if (f.mode === 'dir') {
      const c = this.contact();
      if (c) {
        const ok = confirmedNumber(c);
        body = html`<div class="who" data-person=${c.id}><span class="av">${this.initials(c.display_name)}</span><div style="min-inline-size:0"><b>${c.display_name}</b><small>${c.vendor_name || c.company || ''}</small></div>
          <sw-button size="sm" data-person-change @click=${() => this.set({ contactId: null })}>${rt('change')}</sw-button>
          <div class="acts"><span class="chip" data-tone=${ok ? 'ok' : 'warn'}><sw-icon name="mail" size="13"></sw-icon>${c.phone ? html`<span class="num">${c.phone}</span> · ` : nothing}${ok ? rt('confirmed') : c.has_phone ? rt('notConfirmed') : rt('noNumber')}</span>
            ${!ok && c.has_phone ? html`<sw-button size="sm" variant="ghost" ?disabled=${this.sentCode} data-send-code @click=${() => this.sendCode(c.id)}>${this.sentCode ? rt('codeSent') : rt('sendCode')}</sw-button>` : nothing}
            ${this.live.has(c.id) ? html`<span class="chip" data-tone="acc">${rt('liveAccess')}</span>` : nothing}</div></div>`;
      } else {
        const q = f.q.trim().toLowerCase();
        const list = (this.contacts ?? []).filter((x) => !q || `${x.display_name} ${x.company} ${x.vendor_name ?? ''} ${x.phone ?? ''}`.toLowerCase().includes(q)).slice(0, 80);
        const tag = (x: Contact) => {
          const el = eligibility(x);
          if (el !== 'ok') return html`<span class="chip" data-tone="off">${rt(`dis_${el}` as RtKey)}</span>`;
          if (this.live.has(x.id)) return html`<span class="chip" data-tone="acc">${rt('liveShort')}</span>`;
          return confirmedNumber(x) ? html`<span class="chip" data-tone="ok"><sw-icon name="check" size="12"></sw-icon>${rt('confirmed')}</span>` : html`<span class="chip" data-tone="warn">${rt('notConfirmed')}</span>`;
        };
        body = html`<div class="search"><sw-icon name="search" size="16"></sw-icon><input class="in" type="search" data-person-search aria-invalid=${e.person ? 'true' : 'false'} placeholder=${rt('searchPerson')} .value=${f.q}
            @input=${(ev: Event) => this.set({ q: (ev.target as HTMLInputElement).value })} /></div>
          ${this.dirError
            ? html`<p class="note">${rt('dirUnavailable')}</p>`
            : this.contacts === null
              ? html`<p class="note">${rt('loading')}</p>`
              : list.length
                ? html`<div class="plist" role="radiogroup" aria-label=${rt('fromDir')}>${list.map((x) => {
                    const dis = eligibility(x) !== 'ok';
                    return html`<label class=${dis ? 'dis' : ''} data-contact=${x.id}><input type="radio" name="pp" .disabled=${dis} @change=${() => this.pick(x)} />
                      <span class="av">${this.initials(x.display_name)}</span><span class="nm"><b>${x.display_name}</b><small>${x.vendor_name || x.company || ''}${x.phone ? html` · <span class="num">${x.phone}</span>` : nothing}</small></span>${tag(x)}</label>`;
                  })}</div>`
                : html`<div class="row"><span class="note">${rt('noMatch')}</span><sw-button size="sm" icon="plus" @click=${() => this.set({ mode: 'new', np: { ...f.np, name: f.q } })}>${rt('addNew')}</sw-button></div>`}
          ${this.err(e, 'person')}`;
      }
    } else {
      const np = f.np;
      const upd = (p: Partial<RequestForm['np']>) => this.set({ np: { ...np, ...p } });
      body = html`<div class="f2">
          <div class="field"><label for="np-name">${rt('fullName')}</label><input id="np-name" class="in" autocomplete="off" maxlength="80" aria-invalid=${e.npName ? 'true' : 'false'} .value=${np.name} @input=${(ev: Event) => upd({ name: (ev.target as HTMLInputElement).value })} />${this.err(e, 'npName')}</div>
          <div class="field"><label for="np-co">${rt('company')}</label><input id="np-co" class="in" autocomplete="off" maxlength="80" list="vendors" .value=${np.company} @input=${(ev: Event) => upd({ company: (ev.target as HTMLInputElement).value })} />
            <datalist id="vendors">${this.vendors.map((v) => html`<option value=${v.display_name}></option>`)}</datalist></div>
          <div class="field"><label for="np-ph">${rt('whatsapp')}</label><input id="np-ph" class="in num" type="tel" inputmode="tel" autocomplete="off" placeholder="05X-XXXXXXX" style="text-align:start" aria-invalid=${e.npPhone ? 'true' : 'false'} .value=${np.phone} @input=${(ev: Event) => upd({ phone: (ev.target as HTMLInputElement).value })} />${this.err(e, 'npPhone')}</div>
          <div class="field"><label for="np-lang">${rt('msgLang')}</label><select id="np-lang" class="in" @change=${(ev: Event) => upd({ lang: (ev.target as HTMLSelectElement).value as Lang })}>${LANGS.map((l) => html`<option value=${l} ?selected=${np.lang === l}>${rt(`lang_${l}` as RtKey)}</option>`)}</select></div>
        </div>
        <div class="row"><span class="chip" data-tone="warn"><sw-icon name="mail" size="13"></sw-icon>${rt('onSave')}</span></div>`;
    }
    return html`<section class="sec" data-sec="who"><h4><sw-icon name="user" size="14"></sw-icon>${rt('who')}</h4>${seg}${body}
      <div class="lockrow" data-extended-identity="locked"><sw-icon name="lock" size="16"></sw-icon><b>${rt('extIdentity')}</b><span class="chip" data-tone="off">${rt('locked')}</span></div></section>`;
  }

  private pick(c: Contact): void {
    this.sentCode = false;
    const patch: Partial<RequestForm> = { contactId: c.id };
    if (this.g?.system_admin && confirmedNumber(c) && this.g.reachable) patch.path = 'self';
    if (!confirmedNumber(c)) patch.path = 'send';
    this.set(patch);
  }

  private async sendCode(id: string): Promise<void> {
    try {
      await phoneVerifyApi.contactSend(id);
      this.sentCode = true;
    } catch (e) {
      this.error = describeError(e);
    }
  }

  private purposeSection(e: Errs): TemplateResult {
    const f = this.f;
    const tk = ticketsEnabled(); // owner rule 2026-10-20: no ticket link while the tickets module is off
    return html`<section class="sec" data-sec="purpose"><h4>${tk ? html`<sw-icon name="ticket" size="14"></sw-icon>` : nothing}${rt('purpose')}<span class="chip" data-tone="off">${rt('optional')}</span></h4>
      <div class="f2">${tk ? html`<div class="field"><label for="tk">${rt('ticket')}</label><select id="tk" class="in" @change=${(ev: Event) => this.changeTicket((ev.target as HTMLSelectElement).value)}>
          <option value="" ?selected=${!f.ticketId}>${rt('none')}</option>${this.tickets.map((t) => html`<option value=${t.id} ?selected=${f.ticketId === t.id}>#${t.number} · ${t.title}</option>`)}</select></div>` : nothing}
        <div class="field"><label for="pu">${rt('purposeVisit')}</label><input id="pu" class="in" autocomplete="off" maxlength=${PURPOSE_MAX} aria-invalid=${e.purpose ? 'true' : 'false'} .value=${f.purpose} @input=${(ev: Event) => this.set({ purpose: (ev.target as HTMLInputElement).value })} />${this.err(e, 'purpose')}</div></div>
      ${tk && f.ticketId ? html`<div class="row"><span class="chip" data-tone="acc"><sw-icon name="info" size="13"></sw-icon>${rt('endsWithTicket')}</span></div>` : nothing}</section>`;
  }

  private stationBox(s: GrantableStation, enabled: boolean): TemplateResult {
    return html`<div class="st-h"><sw-icon name="door" size="14"></sw-icon><span>${s.name ?? s.station_id}</span></div>${s.relays.map((r) => {
      const k = doorKey(s.station_id, r.relay);
      return html`<label class="cb"><input type="checkbox" data-door=${k} .checked=${this.f.doors.has(k)} .disabled=${!enabled} @change=${(ev: Event) => {
        const next = new Set(this.f.doors);
        (ev.target as HTMLInputElement).checked ? next.add(k) : next.delete(k);
        this.set({ doors: next });
      }} /><span><b>${r.name || rt('doorN', { n: r.relay })}</b><small>${rt('doorN', { n: r.relay })}</small></span></label>`;
    })}`;
  }

  private doorsSection(e: Errs): TemplateResult {
    const g = this.g;
    const f = this.f;
    const max = g?.max_doors ?? 4;
    const q = f.dq.trim().toLowerCase();
    const all = g?.stations ?? [];
    const match = (s: GrantableStation) => !q || `${s.name ?? ''} ${s.relays.map((r) => r.name ?? '').join(' ')}`.toLowerCase().includes(q);
    const open = all.filter((s) => s.may_request && match(s));
    const locked = all.filter((s) => !s.may_request && match(s));
    const names = new Map(all.map((s) => [s.station_id, s]));
    const chip = (k: string) => {
      const [sid, r] = splitDoor(k);
      const s = names.get(sid);
      const rn = s?.relays.find((x) => x.relay === r)?.name;
      return html`<span class="chip door" data-tone="acc"><sw-icon name="door" size="13"></sw-icon>${s?.name ?? sid} · ${rn || rt('doorN', { n: r })}</span>`;
    };
    return html`<section class="sec" data-sec="doors"><h4><sw-icon name="door" size="14"></sw-icon>${rt('doors')}<span class="sp"></span><span class="chip num" data-door-count data-tone=${f.doors.size > max ? 'err' : 'acc'}>${f.doors.size} / ${max}</span></h4>
      ${all.length > 8 ? html`<div class="search"><sw-icon name="search" size="16"></sw-icon><input class="in" type="search" placeholder=${rt('searchDoor')} .value=${f.dq} @input=${(ev: Event) => this.set({ dq: (ev.target as HTMLInputElement).value })} /></div>` : nothing}
      ${f.doors.size ? html`<div class="chips" data-chosen>${[...f.doors].map(chip)}</div>` : nothing}
      ${open.length ? html`<div class="stgrp" data-open-stations>${open.map((s) => this.stationBox(s, true))}</div>` : html`<p class="note">${rt('noStations')}</p>`}
      ${locked.length ? html`<details class="locked" data-locked-stations><summary><sw-icon name="lock" size="14"></sw-icon>${rt('lockedStations', { n: locked.length })}</summary><div class="stgrp" style="margin-block-start:8px">${locked.map((s) => this.stationBox(s, false))}</div></details>` : nothing}
      ${this.err(e, 'doors')}</section>`;
  }

  private whenSection(e: Errs): TemplateResult {
    const f = this.f;
    const today = this.today();
    const max = this.g?.max_days ?? 14;
    const n = f.from && f.until && f.until >= f.from ? daySpan(f.from, f.until) : 0;
    const due = codeDue(f.from, today, this.codeHour, minuteInZone(new Date(), this.tz));
    const dates = rangeDates(f.from, f.until);
    const toggle = <T,>(set: Set<T>, v: T) => {
      const next = new Set(set);
      next.has(v) ? next.delete(v) : next.add(v);
      return next;
    };
    return html`<section class="sec" data-sec="when"><h4><sw-icon name="calendar" size="14"></sw-icon>${rt('when')}<span class="sp"></span><span class="chip" data-tone="off"><sw-icon name="clock" size="12"></sw-icon>${rt('tz', { tz: this.tz })}</span></h4>
      <div class="f2"><div class="field"><label for="vf">${rt('from')}</label><input id="vf" class="in num" type="date" lang=${dateInputLang()} min=${today} aria-invalid=${e.dates ? 'true' : 'false'} .value=${f.from} @change=${(ev: Event) => this.set({ from: (ev.target as HTMLInputElement).value, dates: new Set() })} /></div>
        <div class="field"><label for="vu">${rt('until')}</label><input id="vu" class="in num" type="date" lang=${dateInputLang()} min=${f.from || today} aria-invalid=${e.dates ? 'true' : 'false'} .value=${f.until} @change=${(ev: Event) => this.set({ until: (ev.target as HTMLInputElement).value, dates: new Set() })} /></div></div>
      ${this.err(e, 'dates')}
      ${n && !e.dates ? html`<div class="row"><span class="chip" data-tone="acc">${rt('daysOf', { n, max })}</span>${f.cred === 'pin' ? html`<span class="chip" data-tone="off"><sw-icon name="mail" size="12"></sw-icon>${due ? rt('codeAt', { t: due }) : rt('codeAtOnce')}</span>` : nothing}</div>` : nothing}
      <div class="seg" role="group"><button type="button" aria-pressed=${String(f.dmode === 'weekly')} @click=${() => this.set({ dmode: 'weekly' })}>${rt('weekdays')}</button><button type="button" aria-pressed=${String(f.dmode === 'dates')} @click=${() => this.set({ dmode: 'dates' })}>${rt('specificDates')}</button></div>
      ${f.dmode === 'weekly'
        ? html`<div class="pills" data-days>${[0, 1, 2, 3, 4, 5, 6].map((i) => html`<button type="button" class="pill" aria-pressed=${String(f.days.has(i))} data-day=${i} @click=${() => this.set({ days: toggle(f.days, i) })}>${rt(`d${i}` as RtKey)}</button>`)}</div>`
        : html`<div class="pills" data-dates>${dates.length ? dates.map((d) => html`<button type="button" class="pill num" aria-pressed=${String(f.dates.has(d))} @click=${() => this.set({ dates: toggle(f.dates, d) })}>${dm(d)}</button>`) : html`<span class="chip" data-tone="off">${rt('pickRange')}</span>`}</div>`}
      ${this.err(e, 'days')}
      <div class="wins" data-wins>${f.wins.map((w, i) => html`<div class="win">
          <input class="in num" type="time" lang=${dateInputLang()} aria-label=${rt('winFrom')} aria-invalid=${e.wins ? 'true' : 'false'} .value=${w.s} @change=${(ev: Event) => this.setWin(i, { s: (ev.target as HTMLInputElement).value })} /><span>–</span>
          <input class="in num" type="time" lang=${dateInputLang()} aria-label=${rt('winUntil')} aria-invalid=${e.wins ? 'true' : 'false'} .value=${w.e === '24:00' ? '23:59' : w.e} @change=${(ev: Event) => { const v = (ev.target as HTMLInputElement).value; this.setWin(i, { e: v === '23:59' ? '24:00' : v }); }} />
          <sw-button size="sm" variant="ghost" iconOnly icon="close" label=${rt('remove')} ?disabled=${f.wins.length === 1} @click=${() => this.set({ wins: f.wins.filter((_, j) => j !== i) })}></sw-button></div>`)}</div>
      ${this.err(e, 'wins')}
      <div class="pills">${PRESETS.map(([s, en]) => html`<button type="button" class="pill num" aria-pressed=${String(f.wins.length === 1 && f.wins[0].s === s && f.wins[0].e === en)} @click=${() => this.set({ wins: [{ s, e: en }] })}>${s}–${en}</button>`)}
        <sw-button size="sm" variant="ghost" icon="plus" ?disabled=${f.wins.length >= MAX_WINS} @click=${() => { const last = f.wins[f.wins.length - 1]; this.set({ wins: [...f.wins, { s: last.e === '24:00' ? '23:00' : last.e, e: '24:00' }] }); }}>${rt('addWin')}</sw-button></div></section>`;
  }

  private setWin(i: number, p: Partial<{ s: string; e: string }>): void {
    this.set({ wins: this.f.wins.map((w, j) => (j === i ? { ...w, ...p } : w)) });
  }

  private credSection(): TemplateResult {
    const f = this.f;
    return html`<section class="sec" data-sec="cred"><h4><sw-icon name="shield" size="14"></sw-icon>${rt('cred')}</h4>
      <div class="seg" role="group"><button type="button" data-cred="pin" aria-pressed=${String(f.cred === 'pin')} @click=${() => this.set({ cred: 'pin' })}><sw-icon name="mail" size="14"></sw-icon>${rt('credPin')}</button>
        <button type="button" data-cred="none" aria-pressed=${String(f.cred === 'none')} @click=${() => this.set({ cred: 'none' })}>${rt('credNone')}</button>
        ${this.cards
          ? html`<button type="button" data-cred="card" aria-pressed=${String(f.cred === 'card')} @click=${() => this.set({ cred: 'card' })}><sw-icon name="shield" size="14"></sw-icon>${rt('credCard')}</button>`
          : html`<button type="button" disabled aria-pressed="false" data-cred="card"><sw-icon name="lock" size="14"></sw-icon>${rt('credCard')}</button>`}</div>
      ${f.cred === 'pin'
        ? html`<div class="seg" role="group" aria-label=${rt('codeType')} data-code-mode><button type="button" data-once="0" aria-pressed=${String(!f.once)} @click=${() => this.set({ once: false })}>${rt('codeWindow')}</button>
            <button type="button" data-once="1" aria-pressed=${String(f.once)} @click=${() => this.set({ once: true })}>${rt('codeOnce')}</button></div>
            ${f.once ? html`<p class="note">${rt('codeOnceNote')}</p>` : nothing}`
        : nothing}</section>`;
  }

  private notesSection(): TemplateResult {
    return html`<section class="sec" data-sec="notes"><h4><sw-icon name="edit" size="14"></sw-icon>${rt('notes')}<span class="chip" data-tone="off">${rt('internal')}</span></h4>
      <textarea class="in" aria-label=${rt('notes')} maxlength=${NOTES_MAX} .value=${this.f.notes} @input=${(ev: Event) => this.set({ notes: (ev.target as HTMLTextAreaElement).value })}></textarea></section>`;
  }

  private pathSection(e: Errs): TemplateResult {
    const f = this.f;
    const blk = selfBlock(f, this.ctx());
    const ap = this.appr;
    const st = chosenStations(f.doors);
    return html`<section class="sec" data-sec="path"><h4><sw-icon name="route" size="14"></sw-icon>${rt('path')}</h4>
      <div class="radio">
        <label class="cb" data-path="self"><input type="radio" name="path" .checked=${f.path === 'self'} .disabled=${!!blk} @change=${() => this.set({ path: 'self' })} />
          <span><b>${rt('approveNow')}</b>${blk ? html`<span class="chip" data-tone="off" data-self-block=${blk}><sw-icon name="lock" size="12"></sw-icon>${rt(blk)}</span>` : html`<small>${rt('approveNowSub')}</small>`}</span></label>
        <label class="cb" data-path="send"><input type="radio" name="path" .checked=${f.path === 'send'} @change=${() => this.set({ path: 'send' })} /><span><b>${rt('sendApproval')}</b><small>${rt('sendApprovalSub')}</small></span></label>
      </div>
      <div class="apprs" data-approvers=${ap ? ap.count : ''}><span class="avs">${(ap?.approvers ?? []).slice(0, 4).map((a) => html`<span title=${a.name}>${this.initials(a.name)}</span>`)}</span>
        <span>${!st.length ? rt('apprFollow') : ap ? (ap.count ? rt('apprCount', { n: ap.count }) : rt('apprNone')) : rt('loading')}</span></div>
      ${this.err(e, 'path')}
      <div class="lockrow"><sw-icon name="lock" size="16"></sw-icon><b>${rt('autoApproval')}</b><span class="chip" data-tone="off">${rt('autoNone')}</span></div></section>`;
  }

  private noticeSection(e: Errs): TemplateResult {
    const n = this.notice;
    const lang = n?.lang ?? this.personLang();
    const dir = lang === 'he' || lang === 'ar' ? 'rtl' : 'ltr';
    return html`<section class="sec" data-sec="notice"><h4><sw-icon name="shield" size="14"></sw-icon>${rt('notice')}<span class="sp"></span><span class="chip" data-tone="off">${rt('noticeLang', { lang: rt(`lang_${lang}` as RtKey), v: n?.version ?? 'n2' })}</span></h4>
      <div class="ntext" dir=${dir} lang=${lang} data-notice-text>${n?.text ?? rt('loading')}</div>
      <label class="cb" ?data-invalid=${!!e.told}><input type="checkbox" data-told .checked=${this.f.told} @change=${(ev: Event) => this.set({ told: (ev.target as HTMLInputElement).checked })} /><span><b dir=${dir} lang=${lang}>${n?.attest ?? ''}</b></span></label>
      ${this.err(e, 'told')}</section>`;
  }

  private previewSection(): TemplateResult | typeof nothing {
    const f = this.f;
    if (f.cred !== 'pin') return nothing;
    const names = new Map((this.g?.stations ?? []).map((s) => [s.station_id, s.name ?? s.station_id]));
    const doors = chosenStations(f.doors).map((s) => names.get(s) ?? s).join(', ') || '-';
    const dates = !f.from || !f.until ? '-' : f.from === f.until ? dm(f.from) : `${dm(f.from)}-${dm(f.until)}`;
    const hours = f.wins.map((w) => `${w.s}-${w.e}`).join(', ');
    const parts = rt('previewBody', { doors, dates, hours }).split('{pin}');
    return html`<section class="sec" data-sec="preview"><h4><sw-icon name="mail" size="14"></sw-icon>${rt('preview')}</h4>
      <div class="bubble" data-preview>${parts[0]}<span class="pin" aria-label="••••••"><sw-icon name="lock" size="12"></sw-icon>••••••</span>${parts[1] ?? ''}</div>
      <p class="note"><sw-icon name="lock" size="13"></sw-icon>${rt('previewNote')}</p></section>`;
  }

  // ---------------------------------------------------------------- submit

  private async submit(): Promise<void> {
    this.f = { ...this.f, tried: true };
    const e = validate(this.f, this.ctx());
    if (Object.keys(e).length) {
      await this.updateComplete;
      this.renderRoot.querySelector('[data-err]')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    this.busy = true;
    this.error = '';
    try {
      let cid = this.f.contactId;
      if (this.f.mode === 'new') {
        const np = this.f.np;
        const vendor = this.vendors.find((v) => v.display_name.trim() === np.company.trim());
        const c = await ticketsS4Api().createContact({ kind: 'person', display_name: np.name.trim(), company: vendor ? '' : np.company.trim(), vendor_id: vendor?.id ?? null,
          phone: np.phone.trim(), lang: np.lang, preferred_channel: 'whatsapp' });
        cid = c.id;
        // the person keeps the new row even when the request below is refused (no second contact on a retry)
        this.contacts = [c, ...(this.contacts ?? [])];
        this.f = { ...this.f, mode: 'dir', contactId: c.id };
        try {
          await phoneVerifyApi.contactSend(c.id);
        } catch {
          /* the number is confirmed later from the directory; the request itself does not need it */
        }
      }
      const r = await requestGrant(bodyOf(this.f, cid!, this.tz, this.g?.max_days ?? 14));
      const text = r.approval
        ? r.approval.approved ? rt('done_self') : rt('done_selfFailed', { why: r.approval.message })
        : r.outcome === 'merged' ? rt('done_merged') : rt('done_send');
      this.dispatchEvent(new CustomEvent('done', { detail: { text, grant: r.grant }, bubbles: true, composed: true }));
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  render() {
    if (this.noPerm) {
      return html`<sw-dialog open heading=${rt('title')} data-request-noperm @close=${() => this.close()}>
        <div class="nop"><div class="art"><sw-icon name="lock" size="26"></sw-icon></div><h3>${rt('noperm_title')}</h3><p>${rt('noperm_text')}</p></div>
        <div slot="footer" class="foot"><span class="sp"></span><sw-button @click=${() => this.close()}>${rt('close')}</sw-button></div></sw-dialog>`;
    }
    const g = this.g;
    if (!g) {
      // SHAREDUI-295: a load that failed says so in plain words, with a retry and a way out (the dialog had neither)
      return html`<sw-dialog open xl heading=${rt('title')} data-request-dialog @close=${() => this.close()}>
        ${this.loadError
          ? html`<div class="loadstate" role="alert" data-request-load-error><sw-icon name="warning" size="22"></sw-icon><b class="err-line">${rt('loadError')}</b><span>${this.loadError}</span></div>`
          : html`<div class="loadstate" role="status" data-request-loading>${rt('loading')}</div>`}
        <div slot="footer" class="foot" ?data-request-load-error=${!!this.loadError}><span class="sp"></span>
          <sw-button variant="ghost" data-close @click=${() => this.close()}>${rt('close')}</sw-button>
          ${this.loadError ? html`<sw-button variant="primary" icon="refresh" data-retry @click=${() => this.load()}>${rt('retry')}</sw-button>` : nothing}</div></sw-dialog>`;
    }
    const e = this.f.tried ? validate(this.f, this.ctx()) : {};
    const n = Object.keys(e).length;
    const offline = !g.reachable;
    const asOf = g.as_of ? timeText(new Date(g.as_of), { timeZone: this.tz }) : '';
    return html`<sw-dialog open xl heading=${rt('title')} data-request-dialog @close=${() => this.close()}>
      ${offline
        ? html`<div class="banner" data-tone="warn" data-offline role="status"><sw-icon name="offline" size="16"></sw-icon><span>${g.has_copy && asOf ? rt('offline', { t: asOf }) : rt('offlineNoCopy')}</span><span class="sp"></span>
            <sw-button size="sm" icon="refresh" @click=${() => this.load()}>${rt('checkAgain')}</sw-button></div>`
        : nothing}
      <div class="ap">
        <div class="col">${this.whoSection(e)}${this.purposeSection(e)}${this.doorsSection(e)}${this.whenSection(e)}${this.credSection()}${this.notesSection()}</div>
        <div class="col">${this.pathSection(e)}${this.noticeSection(e)}${this.previewSection()}</div>
      </div>
      ${this.error ? html`<p class="err-line" role="alert" data-request-error>${this.error}</p>` : nothing}
      <div slot="footer" class="foot">${this.f.tried && n ? html`<span class="chip" data-tone="err" data-fix-count><sw-icon name="warning" size="13"></sw-icon>${rt('fieldsToFix', { n })}</span>` : nothing}
        <span class="sp"></span><sw-button variant="ghost" @click=${() => this.close()}>${rt('cancel')}</sw-button>
        <sw-button variant="primary" data-request-ok icon=${this.f.path === 'self' ? 'check' : 'share'} ?disabled=${this.busy} @click=${() => this.submit()}>${this.f.path === 'self' ? rt('ok_self') : rt('ok_send')}</sw-button></div>
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'access-request-dialog': AccessRequestDialog;
  }
}
