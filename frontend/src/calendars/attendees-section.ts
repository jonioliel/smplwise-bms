import { LitElement, html, nothing, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import { describeError } from '../api/client';
import { attendeesApi, type AttendeesApi, type AttendeesView, type InviteStatus } from '../api/calendar-attendees';
import { calCss } from './styles';
import { calHooks } from './ctx';
import './attendee-picker';
import type { PickerAdd, PickerRemove, PickerRole } from './attendee-picker';
import { RESPONSE_LABEL, addHit, countText, draftOfAttendee, payloadOf, statusSummary, type AttendeeDraft } from './attendee-logic';
import type { AttendeeInput } from '../api/calendar-attendees';

/**
 * CAL-ATTENDEES-2343: the "מוזמנים" section of the event drawer. Two modes:
 * - a NEW entry (no `eventId`): a local list in the picker; the drawer reads `payload()` into the create body (`attendees`).
 * - an EXISTING entry (`eventId`): loads GET /calendar/events/{id}/attendees and changes it live (add / remove / role) when `can.manage`;
 *   an attendee answers (מגיע/ה · אולי · לא מגיע/ה), may leave, and may join when the calendar allows it; a viewer sees the count only.
 * The server decides permission and privacy; this only hides what `can` says is not offered.
 */
@customElement('cal-attendees-section')
export class CalAttendeesSection extends LitElement {
  static styles = [calCss, css`
    :host { display: block; min-inline-size: 0; }
    .sec { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 8px 14px; align-items: start; }
    .lbl { font-weight: var(--sw-fw-semibold); color: var(--sw-heading); padding-block-start: 6px; }
    .col { display: flex; flex-direction: column; gap: 8px; min-inline-size: 0; }
    .muted { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .rsvp { display: flex; gap: 6px; flex-wrap: wrap; }
    .err { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); }
    @media (max-width: 699px) { .sec { grid-template-columns: minmax(0, 1fr); gap: 6px; } .lbl { padding: 0; } }
  `];

  /** the entry; empty = a new entry (local list) */
  @property({ attribute: false }) eventId = '';
  /** a new entry: may the creator bring guests (the calendar's guests_mode, when the host knows it); the server checks again */
  @property({ type: Boolean, attribute: 'allow-guests' }) allowGuests = true;
  /** tests and the static demo pass a client; otherwise the session's */
  @property({ attribute: false }) api: AttendeesApi | null = null;
  /** a new entry: the list it starts from (the quick create's picks, carried by "פרטים נוספים"); read once */
  @property({ attribute: false }) initial: AttendeeDraft[] = [];

  private seeded = false;
  @state() private drafts: AttendeeDraft[] = [];
  @state() private view: AttendeesView | null = null;
  @state() private error = '';
  @state() private busy = false;

  private client(): AttendeesApi {
    return this.api ?? attendeesApi();
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this.eventId) void this.load();
  }

  protected willUpdate(): void {
    // a new entry starts from the carried-over list once; later picks are the section's own
    if (!this.seeded && !this.eventId && this.initial.length) this.drafts = [...this.initial];
    this.seeded = true;
  }

  /** The `attendees` of the create body (a new entry); empty when nobody was added. */
  payload(): AttendeeInput[] {
    return payloadOf(this.drafts);
  }

  private async load(): Promise<void> {
    try {
      this.view = await this.client().list(this.eventId);
      this.error = '';
    } catch (e) {
      this.error = describeError(e);
    }
  }

  private async run(fn: () => Promise<AttendeesView>): Promise<void> {
    this.busy = true;
    this.error = '';
    try {
      this.view = await fn();
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private search = async (q: string) => (await this.client().directory(q)).results;

  private onAdd(e: CustomEvent<PickerAdd>): void {
    const d = e.detail.draft;
    if (!this.eventId) {
      this.drafts = d.kind === 'guest' ? [...this.drafts, d] : addHit(this.drafts, { kind: d.kind, ref_id: d.ref_id as string, name: d.name });
      return;
    }
    void this.run(() => this.client().add(this.eventId, payloadOf([d])));
  }

  private onRemove(e: CustomEvent<PickerRemove>): void {
    const d = e.detail.draft;
    if (!this.eventId) {
      this.drafts = this.drafts.filter((x) => x.key !== d.key);
      return;
    }
    if (d.id) void this.run(() => this.client().remove(this.eventId, d.id as string));
  }

  private onRole(e: CustomEvent<PickerRole>): void {
    const { draft, role } = e.detail;
    if (!this.eventId) {
      this.drafts = this.drafts.map((x) => (x.key === draft.key ? { ...x, role } : x));
      return;
    }
    if (draft.id) void this.run(() => this.client().setRole(this.eventId, draft.id as string, role));
  }

  render() {
    return html`<div class="sec" data-cal-attendees role="group" aria-labelledby="att-h">
      <span class="lbl" id="att-h">מוזמנים</span>
      <div class="col">${this.eventId ? this.existing() : this.fresh()}
        ${this.error ? html`<div class="err" role="alert" data-att-error>${this.error}</div>` : nothing}</div>
    </div>`;
  }

  private fresh() {
    return html`<cal-attendee-picker .value=${this.drafts} .search=${this.search} ?allow-guests=${this.allowGuests} show-contacts
      @attendee-add=${(e: CustomEvent<PickerAdd>) => this.onAdd(e)} @attendee-remove=${(e: CustomEvent<PickerRemove>) => this.onRemove(e)}
      @attendee-role=${(e: CustomEvent<PickerRole>) => this.onRole(e)}></cal-attendee-picker>`;
  }

  private existing() {
    const v = this.view;
    if (!v) return this.error ? nothing : html`<div class="skel" style="block-size:36px"></div>`;
    if (v.count === null) return html`<span class="muted">—</span>`;
    const drafts = v.attendees.map(draftOfAttendee);
    const mineGuests = new Set(v.attendees.filter((a) => a.added_by_you || a.you).map((a) => a.id));
    const showList = v.list_visible || v.attendees.length > 0;
    const summary = v.list_visible ? statusSummary(drafts) : '';
    return html`
      <span class="muted" data-att-count>${countText(v.count)}${summary ? ` · ${summary}` : ''}</span>
      ${showList ? html`<cal-attendee-picker .value=${drafts} .search=${this.search} .max=${v.policy.max_attendees} ?disabled=${!v.can.manage || this.busy}
          ?allow-guests=${v.can.add_guest} ?allow-people=${v.can.manage} ?show-contacts=${v.can.contacts} show-status .removable=${mineGuests}
          @attendee-add=${(e: CustomEvent<PickerAdd>) => this.onAdd(e)} @attendee-remove=${(e: CustomEvent<PickerRemove>) => this.onRemove(e)}
          @attendee-role=${(e: CustomEvent<PickerRole>) => this.onRole(e)}></cal-attendee-picker>` : nothing}
      ${!v.can.manage && v.can.add_guest ? html`<cal-attendee-picker .value=${[]} .max=${v.policy.max_attendees} allow-guests .allowPeople=${false}
          @attendee-add=${(e: CustomEvent<PickerAdd>) => this.onAdd(e)}></cal-attendee-picker>` : nothing}
      ${v.me && v.can.respond ? html`<div class="rsvp" role="group" aria-label="התשובה שלי" data-att-rsvp>
          ${(Object.keys(RESPONSE_LABEL) as Exclude<InviteStatus, 'invited'>[]).map((s) => html`<button type="button" class="chipb" aria-pressed=${v.me?.status === s ? 'true' : 'false'}
            ?disabled=${this.busy} data-att-respond=${s} @click=${() => void this.run(() => this.client().respond(this.eventId, s))}>${RESPONSE_LABEL[s]}</button>`)}
        </div>` : nothing}
      ${v.can.join ? html`<div><button type="button" class="btn sm" ?disabled=${this.busy} data-att-join
          @click=${() => void this.run(() => this.client().add(this.eventId, [{ kind: 'user', ref_id: '@me' }]))}><sw-icon name="plus" size="14"></sw-icon>הצטרפות לאירוע</button></div>` : nothing}`;
  }
}

/**
 * CAL-ATTENDEES-2343 follow-up: the quick create's compact attendee row. Collapsed it is one line ("משתתפים" + how many were picked);
 * open it is the same picker as the drawer. The list is the host's (QuickDraft.attendees, handed back through `onChange`), so the
 * quick create sends it with the create request as `attendees`.
 */
@customElement('cal-quick-attendees')
export class CalQuickAttendees extends LitElement {
  static styles = [calCss, css`
    :host { display: block; min-inline-size: 0; }
    .tg { display: flex; align-items: center; gap: 8px; inline-size: 100%; min-block-size: 32px; padding: 0; border: 0; background: transparent; font: inherit;
      font-size: var(--sw-fs-md); color: var(--sw-heading); cursor: pointer; text-align: start; }
    .tg > sw-icon { color: var(--sw-text-3); flex: none; }
    .tg .muted { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .tg .chev { margin-inline-start: auto; transition: transform var(--sw-t-hover) var(--sw-ease-color); }
    .tg[aria-expanded='true'] .chev { transform: rotate(180deg); }
    .tg:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; border-radius: var(--sw-r-sm); }
    .body { padding-block-start: 6px; padding-inline-start: 26px; }
    /* ROUND4-LEFTOVERS-2390 (D22 review): the attendees toggle is a 44 px target on a touch screen */
    @media (pointer: coarse) { .tg { min-block-size: 44px; } }
  `];

  @property({ attribute: false }) value: AttendeeDraft[] = [];
  @property({ attribute: false }) onChange: ((v: AttendeeDraft[]) => void) | null = null;
  @property({ attribute: false }) api: AttendeesApi | null = null;
  @state() private open = false;

  private search = async (q: string) => (await (this.api ?? attendeesApi()).directory(q)).results;

  private put(v: AttendeeDraft[]): void {
    this.onChange?.(v);
  }

  render() {
    const n = this.value.length;
    return html`<button type="button" class="tg" aria-expanded=${String(this.open)} aria-controls="qatt" data-cal-qc-attendees-toggle @click=${() => (this.open = !this.open)}>
        <sw-icon name="users" size="16"></sw-icon><span>משתתפים</span><span class="muted">${n ? countText(n) : 'אף אחד עדיין'}</span>
        <sw-icon class="chev" name="chevronDown" size="14"></sw-icon></button>
      ${this.open ? html`<div class="body" id="qatt" data-cal-qc-attendees><cal-attendee-picker .value=${this.value} .search=${this.search} allow-guests show-contacts
        @attendee-add=${(e: CustomEvent<PickerAdd>) => { const d = e.detail.draft; this.put(d.kind === 'guest' ? [...this.value, d] : addHit(this.value, { kind: d.kind, ref_id: d.ref_id as string, name: d.name })); }}
        @attendee-remove=${(e: CustomEvent<PickerRemove>) => this.put(this.value.filter((x) => x.key !== e.detail.draft.key))}
        @attendee-role=${(e: CustomEvent<PickerRole>) => this.put(this.value.map((x) => (x.key === e.detail.draft.key ? { ...x, role: e.detail.role } : x)))}></cal-attendee-picker></div>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cal-attendees-section': CalAttendeesSection;
    'cal-quick-attendees': CalQuickAttendees;
  }
}

// 2.35.0 train: the picker fills the grid branch's attendee slot - the booking drawer (new: a local list read by the drawer's payload;
// edit: live) and the quick create (a collapsed row; the list rides in the draft).
calHooks.attendees = (p) => (p.surface === 'drawer' ? html`<cal-attendees-section .eventId=${p.eventId ?? ''}
    .initial=${!p.eventId && Array.isArray(p.value) ? (p.value as AttendeeDraft[]) : []}></cal-attendees-section>`
  : html`<cal-quick-attendees .value=${Array.isArray(p.value) ? (p.value as AttendeeDraft[]) : []} .onChange=${(v: AttendeeDraft[]) => p.onChange(v)}></cal-quick-attendees>`);
