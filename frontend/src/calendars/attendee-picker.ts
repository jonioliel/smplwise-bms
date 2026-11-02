import { LitElement, html, nothing, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import type { DirectoryHit } from '../api/calendar-attendees';
import { calCss } from './styles';
import {
  CONTACT_NOTE, KIND_LABEL, ROLE_LABEL, STATUS_LABEL, chipLabel, draftOfGuest, freshHits, hasErrors, toggleRole, validateGuest,
  type AttendeeDraft, type GuestErrors,
} from './attendee-logic';

/** What the picker asks its host to do (it is controlled: the host owns `value`). */
export interface PickerAdd { draft: AttendeeDraft }
export interface PickerRemove { draft: AttendeeDraft }
export interface PickerRole { draft: AttendeeDraft; role: AttendeeDraft['role'] }

let uid = 0;

/**
 * CAL-ATTENDEES-2343: the attendee picker - search users and residents (a combobox: arrows, Enter, Escape), add an external guest
 * (name + phone or e-mail, validated like the server), chips with a required / optional toggle and a remove button. Controlled: it emits
 * `attendee-add` / `attendee-remove` / `attendee-role` and the host (the drawer section) changes `value` - for a new entry locally, for an
 * existing one through the API. Guests' contacts show on a chip only when the host passes them (organizer / managers). Self-contained so
 * the editable drawer (pilot/CAL-GRID-EDIT-2343) can place it anywhere.
 */
@customElement('cal-attendee-picker')
export class CalAttendeePicker extends LitElement {
  static styles = [calCss, css`
    :host { display: block; min-inline-size: 0; }
    .wrap { display: flex; flex-direction: column; gap: 8px; min-inline-size: 0; }
    .combo { position: relative; }
    .combo .inp { inline-size: 100%; padding-inline-start: 34px; }
    .combo > sw-icon { position: absolute; inset-inline-start: 10px; inset-block-start: 50%; transform: translateY(-50%); color: var(--sw-text-3); pointer-events: none; }
    [role='listbox'] { position: absolute; z-index: 2; inset-inline: 0; inset-block-start: calc(100% + 4px); margin: 0; padding: 4px; list-style: none; max-block-size: 220px; overflow-y: auto;
      background: var(--sw-surface-solid); border: 1px solid var(--sw-border); border-radius: var(--sw-r-md); box-shadow: var(--sw-shadow-2); }
    [role='option'] { display: flex; align-items: center; gap: 8px; min-block-size: 40px; padding: 0 10px; border-radius: var(--sw-r-sm); cursor: pointer; }
    [role='option'][aria-selected='true'], [role='option']:hover { background: var(--sw-hover-wash); }
    [role='option'] .k { margin-inline-start: auto; font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
    .empty { padding: 8px 10px; color: var(--sw-text-3); font-size: var(--sw-fs-sm); }
    ul.chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
    li.att { display: inline-flex; align-items: center; gap: 4px; max-inline-size: 100%; min-block-size: 32px; padding-inline: 10px 2px; border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3); font-size: var(--sw-fs-sm); }
    li.att[data-kind='guest'] { background: var(--sw-accent-soft); }
    li.att .nm { font-weight: var(--sw-fw-semibold); color: var(--sw-heading); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-inline-size: 18ch; }
    li.att .sub { color: var(--sw-text-2); font-size: var(--sw-fs-xs); }
    li.att .ct { direction: ltr; unicode-bidi: isolate; color: var(--sw-text-2); font-size: var(--sw-fs-xs); }
    .mini { font: inherit; font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-semibold); min-block-size: 28px; min-inline-size: 28px; padding: 0 8px; border: 0; border-radius: var(--sw-r-pill);
      background: transparent; color: var(--sw-text-2); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
    .mini[aria-pressed='true'] { background: var(--sw-heading); color: var(--sw-surface-solid); }
    .mini:focus-visible, [role='option']:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: var(--sw-focus-offset); }
    @media (hover: hover) { .mini:not([disabled]):hover { background: var(--sw-hover-wash); } .mini[aria-pressed='true']:hover { background: var(--sw-heading); } }
    fieldset { border: 1px solid var(--sw-border); border-radius: var(--sw-r-md); margin: 0; padding: 10px; display: flex; flex-direction: column; gap: 6px; min-inline-size: 0; }
    legend { padding: 0 4px; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); color: var(--sw-heading); }
    .row { display: flex; gap: 6px; flex-wrap: wrap; }
    .row > .inp { flex: 1 1 140px; min-inline-size: 0; }
    .ferr { color: var(--sw-danger-text); font-size: var(--sw-fs-xs); }
    .note { font-size: var(--sw-fs-xs); color: var(--sw-text-2); }
    .sr { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    @media (max-width: 699px) { .mini { min-block-size: 44px; min-inline-size: 44px; } li.att { min-block-size: 44px; } [role='option'] { min-block-size: 44px; } }
  `];

  /** the chips (controlled) */
  @property({ attribute: false }) value: AttendeeDraft[] = [];
  /** the search (users; residents when the server allows) - the host passes the API call */
  @property({ attribute: false }) search: ((q: string) => Promise<DirectoryHit[]>) | null = null;
  @property({ type: Boolean, attribute: 'allow-guests' }) allowGuests = true;
  @property({ type: Boolean, attribute: 'allow-people' }) allowPeople = true;
  @property({ type: Boolean, attribute: 'show-contacts' }) showContacts = false;
  @property({ type: Boolean, attribute: 'show-status' }) showStatus = false;
  @property({ type: Boolean }) disabled = false;
  @property({ type: Number }) max = 50;
  /** ids of chips the viewer may remove even without `disabled` lifted (his own guests); empty = all removable while enabled */
  @property({ attribute: false }) removable: Set<string> | null = null;

  @state() private q = '';
  @state() private hits: DirectoryHit[] = [];
  @state() private open = false;
  @state() private active = -1;
  @state() private guestOpen = false;
  @state() private gName = '';
  @state() private gPhone = '';
  @state() private gEmail = '';
  @state() private gErr: GuestErrors = {};
  @state() private said = '';
  private timer = 0;
  private seq = 0;
  private readonly uidp = `attp${++uid}`;

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.timer);
  }

  private fire<T>(name: string, detail: T): void {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  private full(): boolean {
    return this.value.length >= this.max;
  }

  private onInput(e: Event): void {
    this.q = (e.target as HTMLInputElement).value;
    clearTimeout(this.timer);
    if (!this.q.trim()) {
      this.hits = [];
      this.open = false;
      return;
    }
    this.timer = window.setTimeout(() => void this.runSearch(), 200);
  }

  private async runSearch(): Promise<void> {
    const n = ++this.seq;
    const q = this.q.trim();
    if (!q || !this.search) return;
    try {
      const hits = await this.search(q);
      if (n !== this.seq) return;
      this.hits = freshHits(hits, this.value);
    } catch {
      if (n === this.seq) this.hits = [];
    }
    this.open = true;
    this.active = this.hits.length ? 0 : -1;
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!this.open && this.hits.length) this.open = true;
      const n = this.hits.length;
      if (!n) return;
      e.preventDefault();
      this.active = (this.active + (e.key === 'ArrowDown' ? 1 : -1) + n) % n;
    } else if (e.key === 'Enter') {
      if (this.open && this.active >= 0 && this.hits[this.active]) {
        e.preventDefault();
        this.pick(this.hits[this.active]);
      }
    } else if (e.key === 'Escape' && this.open) {
      e.stopPropagation(); // the drawer's own Escape closes the drawer; the first one only closes the list
      this.open = false;
    }
  }

  private pick(h: DirectoryHit): void {
    if (this.full()) {
      this.said = `אפשר להזמין עד ${this.max} משתתפים.`;
      return;
    }
    this.fire<PickerAdd>('attendee-add', { draft: { key: `${h.kind}:${h.ref_id}`, kind: h.kind, ref_id: h.ref_id, name: h.name, role: 'required' } });
    this.said = `${h.name} נוסף/ה`;
    this.q = '';
    this.hits = [];
    this.open = false;
    this.active = -1;
    (this.renderRoot.querySelector('[role="combobox"]') as HTMLInputElement | null)?.focus();
  }

  private addGuest(): void {
    const err = validateGuest(this.gName, this.gPhone, this.gEmail);
    this.gErr = err;
    if (hasErrors(err)) {
      const first = err.name ? 'name' : err.phone ? 'phone' : 'email';
      (this.renderRoot.querySelector(`[data-att-guest="${first}"]`) as HTMLInputElement | null)?.focus();
      return;
    }
    if (this.full()) {
      this.said = `אפשר להזמין עד ${this.max} משתתפים.`;
      return;
    }
    const d = draftOfGuest(this.gName, this.gPhone, this.gEmail);
    this.fire<PickerAdd>('attendee-add', { draft: d });
    this.said = `האורח ${d.name} נוסף`;
    this.gName = this.gPhone = this.gEmail = '';
    this.gErr = {};
  }

  private removeChip(d: AttendeeDraft): void {
    this.fire<PickerRemove>('attendee-remove', { draft: d });
    this.said = `${d.name} הוסר/ה`;
  }

  private toggleChipRole(d: AttendeeDraft): void {
    const role = toggleRole(d.role);
    this.fire<PickerRole>('attendee-role', { draft: d, role });
    this.said = `${d.name}: ${ROLE_LABEL[role]}`;
  }

  private canRemove(d: AttendeeDraft): boolean {
    if (!this.disabled) return true;
    return !!(this.removable && d.id && this.removable.has(d.id));
  }

  render() {
    const lb = `${this.uidp}-lb`;
    const opt = (i: number) => `${this.uidp}-o${i}`;
    return html`<div class="wrap" data-att-picker>
      ${this.value.length ? html`<ul class="chips" aria-label="מוזמנים" data-att-chips>${this.value.map((d) => this.chip(d))}</ul>` : nothing}
      ${this.allowPeople && !this.disabled ? html`<div class="combo">
          <sw-icon name="search" size="16"></sw-icon>
          <input class="inp" role="combobox" aria-autocomplete="list" aria-expanded=${this.open ? 'true' : 'false'} aria-controls=${lb}
            aria-activedescendant=${this.open && this.active >= 0 ? opt(this.active) : nothing} aria-label="חיפוש משתמש או דייר להזמנה"
            placeholder="חיפוש משתמש או דייר" autocomplete="off" maxlength="60" data-att-search .value=${this.q} ?disabled=${this.full()}
            @input=${(e: Event) => this.onInput(e)} @keydown=${(e: KeyboardEvent) => this.onKey(e)} @blur=${() => window.setTimeout(() => (this.open = false), 150)}>
          ${this.open ? html`<ul role="listbox" id=${lb} aria-label="תוצאות">
            ${this.hits.length ? this.hits.map((h, i) => html`<li role="option" id=${opt(i)} aria-selected=${i === this.active ? 'true' : 'false'} data-att-hit=${h.ref_id}
                @mousedown=${(e: Event) => e.preventDefault()} @click=${() => this.pick(h)}><span class="ell">${h.name}</span><span class="k">${KIND_LABEL[h.kind]}</span></li>`)
              : html`<li class="empty" role="presentation">לא נמצאו תוצאות</li>`}
          </ul>` : nothing}
        </div>` : nothing}
      ${this.allowGuests && !this.disabled ? this.guestForm() : nothing}
      ${this.showContacts && this.value.some((d) => d.kind === 'guest') ? html`<div class="note" data-att-contact-note>${CONTACT_NOTE}</div>` : nothing}
      <div class="sr" role="status" aria-live="polite">${this.said}</div>
    </div>`;
  }

  private chip(d: AttendeeDraft) {
    const contact = this.showContacts && d.kind === 'guest' ? [d.phone, d.email].filter(Boolean).join(' · ') : '';
    return html`<li class="att" data-kind=${d.kind} data-att-chip=${d.key} aria-label=${chipLabel(d)}>
      <span class="nm" title=${d.name}>${d.name}</span>
      <span class="sub">${KIND_LABEL[d.kind]}${this.showStatus && d.status ? ` · ${STATUS_LABEL[d.status]}` : ''}</span>
      ${contact ? html`<span class="ct">${contact}</span>` : nothing}
      <button type="button" class="mini" aria-pressed=${d.role === 'required' ? 'true' : 'false'} ?disabled=${this.disabled} data-att-role
        aria-label=${`${d.name}: נוכחות ${ROLE_LABEL[d.role]}. לחיצה מחליפה ל${ROLE_LABEL[toggleRole(d.role)]}`} @click=${() => this.toggleChipRole(d)}>${ROLE_LABEL[d.role]}</button>
      ${this.canRemove(d) ? html`<button type="button" class="mini" aria-label=${`הסרת ${d.name}`} data-att-remove @click=${() => this.removeChip(d)}><sw-icon name="close" size="12"></sw-icon></button>` : nothing}
    </li>`;
  }

  private guestForm() {
    if (!this.guestOpen) {
      return html`<div><button type="button" class="btn sm" data-att-guest-open aria-expanded="false" ?disabled=${this.full()} @click=${() => (this.guestOpen = true)}>
        <sw-icon name="plus" size="14"></sw-icon>הוספת אורח</button></div>`;
    }
    const e = this.gErr;
    const f = (k: 'name' | 'phone' | 'email') => `${this.uidp}-g${k}`;
    return html`<fieldset data-att-guest-form>
      <legend>אורח (ללא גישה למערכת)</legend>
      <div class="row">
        <input class="inp" id=${f('name')} maxlength="80" placeholder="שם" aria-label="שם האורח" data-att-guest="name" .value=${this.gName} aria-invalid=${e.name ? 'true' : 'false'}
          aria-describedby=${e.name ? `${f('name')}-e` : nothing} @input=${(ev: Event) => (this.gName = (ev.target as HTMLInputElement).value)}>
        <input class="inp num ltr" id=${f('phone')} type="tel" inputmode="tel" maxlength="30" placeholder="050-000-0000" aria-label="טלפון האורח" data-att-guest="phone" .value=${this.gPhone}
          aria-invalid=${e.phone ? 'true' : 'false'} aria-describedby=${e.phone ? `${f('phone')}-e` : nothing} @input=${(ev: Event) => (this.gPhone = (ev.target as HTMLInputElement).value)}>
        <input class="inp ltr" id=${f('email')} type="email" inputmode="email" maxlength="254" placeholder="name@example.com" aria-label="דוא״ל האורח" data-att-guest="email" .value=${this.gEmail}
          aria-invalid=${e.email ? 'true' : 'false'} aria-describedby=${e.email ? `${f('email')}-e` : nothing} @input=${(ev: Event) => (this.gEmail = (ev.target as HTMLInputElement).value)}
          @keydown=${(ev: KeyboardEvent) => ev.key === 'Enter' && this.addGuest()}>
      </div>
      ${e.name ? html`<div class="ferr" id=${`${f('name')}-e`}>${e.name}</div>` : nothing}
      ${e.phone ? html`<div class="ferr" id=${`${f('phone')}-e`}>${e.phone}</div>` : nothing}
      ${e.email ? html`<div class="ferr" id=${`${f('email')}-e`}>${e.email}</div>` : nothing}
      <div class="note">טלפון או דוא״ל. ההזמנה נשלחת בערוץ ההודעות שהוגדר במערכת.</div>
      <div class="row"><button type="button" class="btn sm pri" data-att-guest-add @click=${() => this.addGuest()}><sw-icon name="check" size="14"></sw-icon>הוספה</button>
        <button type="button" class="btn sm" @click=${() => { this.guestOpen = false; this.gErr = {}; }}>סגירה</button></div>
    </fieldset>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cal-attendee-picker': CalAttendeePicker;
  }
}
