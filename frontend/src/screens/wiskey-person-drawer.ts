import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-avatar';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-drawer';
import '../components/sw-icon';
import '../components/sw-state-panel';
import './wiskey-person-messages';
import './wiskey-station-permissions';
import { isApi } from '../api/session';
import { fetchPersonPhoto, type AcPerson, type AcProfileField } from '../api/access-people';
import type { DisplayZone } from '../api/intercom';
import type { StateKind } from '../components/sw-badge';
import { knownSyncError, pt, syncErrorText } from '../i18n/access-people';
import { wt } from '../i18n/access-writes';
import type { MessagingTransport } from '../access-control/messaging-logic';
import { credentialKinds, enabledStations, formatDay, initials, personSections, personSyncStatus, stateOf, timingView, validityState, type SyncStatus } from '../access-control/people-logic';
import { UTC_ZONE } from './wiskey-format';

export type DrawerTab = 'details' | 'access' | 'groups' | 'messages';

/** A sync status as a badge: the operator sees the word (answer 5 of 2026-10-12), the error text only when the server sent it. */
export function syncKind(status: SyncStatus): { kind: StateKind; label: string } {
  switch (status) {
    case 'synced': return { kind: 'recorded', label: pt('sync.synced') };
    case 'pending': case 'syncing': case 'delete_pending': return { kind: 'stale', label: pt(`sync.${status}`) };
    case 'conflict': case 'error': return { kind: 'error', label: pt(`sync.${status}`) };
    case 'offline': return { kind: 'offline', label: pt('sync.offline') };
    case 'unassigned': return { kind: 'neutral', label: pt('sync.unassigned') };
    default: return { kind: 'unknown', label: pt('sync.unknown') };
  }
}

/** The person's state as a badge (single place: the row, the card and the drawer agree). */
export function stateBadge(p: Pick<AcPerson, 'archived' | 'active' | 'valid_from' | 'valid_until'>): { kind: StateKind; label: string } {
  switch (stateOf(p)) {
    case 'archived': return { kind: 'neutral', label: pt('person.archived') };
    case 'inactive': return { kind: 'offline', label: pt('person.inactive') };
    case 'expired': return { kind: 'error', label: pt('validity.expired') };
    case 'upcoming': return { kind: 'stale', label: pt('validity.future') };
    default: return { kind: 'live', label: pt('person.active') };
  }
}

/** The person's validity as one phrase: nothing / until / from / a window / expired / not started. `compact` (a row, a card, a cell)
 * names only the end of a running window ("עד 31.12.2026") - two dates side by side read the wrong way round to half the readers;
 * the person's page names both ends ("מ־01.05.2026 עד 15.11.2026"). */
export function validityText(p: Pick<AcPerson, 'valid_from' | 'valid_until'>, zone: DisplayZone, compact = false): string {
  const v = validityState(p);
  if (v === 'permanent') return pt('validity.permanent');
  if (v === 'validity_unknown') return pt('validity.unknown');
  const from = formatDay(p.valid_from, zone);
  const until = formatDay(p.valid_until, zone);
  if (v === 'validity_expired') return `${pt('validity.expired')} · ${until}`;
  if (v === 'validity_future') return `${pt('validity.future')} · ${from}`;
  return compact ? pt('validity.until', { date: until }) : pt('validity.window', { from, until });
}

/**
 * The person's page (CR-036 S7): a modal drawer with the tabs פרטים · גישה · קבוצות. The list row is shown at once and the page
 * (`GET /access-control/people/{id}`) replaces it when it arrives; everything the caller may not see is simply not rendered: a
 * names-level person has no "sensitive details" section at all (people-logic `personSections`), and the photo is fetched only when
 * the sender presses "הצג תמונה" - each fetch is one audited view, so the drawer opening never costs one.
 *
 * Footer slots: "שלח הודעה" (when the screen offers messaging) and "עריכה" (the existing person editor, which also holds the PIN
 * and card flows - unchanged). Events: `close`, `edit` {id}, `message` {id}. When the screen offers messaging the page gains a fourth
 * tab, "הודעות": the person's message history and the "asked not to be messaged" switch (wiskey-person-messages.ts).
 */
@customElement('wiskey-person-drawer')
export class WiskeyPersonDrawer extends LitElement {
  @property({ type: Boolean, reflect: true }) open = false;
  @property({ attribute: false }) person: AcPerson | null = null;
  /** The page of this person is on its way (the row is shown meanwhile). */
  @property({ type: Boolean }) loading = false;
  /** '' | 'gone' (the person is no longer there) | 'failed' */
  @property() error: '' | 'gone' | 'failed' = '';
  @property({ attribute: false }) stationNames: Record<string, string> = {};
  @property({ attribute: false }) groupLabels: Record<string, string> = {};
  @property({ attribute: false }) groupStations: Record<string, number | null> = {};
  @property({ attribute: false }) fields: AcProfileField[] | null = null;
  @property({ attribute: false }) zone: DisplayZone = UTC_ZONE;
  @property({ type: Boolean }) canEdit = false;
  @property({ type: Boolean }) canMessage = false;
  /** CR-036 S11: the page offers the person's actions (switch off / on, archive, cards, photo, delete ...): a "פעולות" button. */
  @property({ type: Boolean }) canAct = false;
  /** CR-036 S11: the one-line outcome of the last write on this person, under the header ("נשלח · ממתין לאישור" for a pending one). */
  @property({ attribute: false }) resultLine: { state: string; text: string } | null = null;
  /** The message client (CR-036 WA) - the "הודעות" tab needs it; bumped `messagesRev` re-reads the history after a send. */
  @property({ attribute: false }) transport: MessagingTransport | null = null;
  /** The screen offers messaging to this caller: the "הודעות" tab is there (whether or not this person has a phone - the history and the
   * opt-out switch matter either way). */
  @property({ type: Boolean }) messagesTab = false;
  @property({ type: Number }) messagesRev = 0;
  /** The photo is offered at all (the feature exists and the installation's photo switch is on). */
  @property({ type: Boolean }) photoEnabled = true;

  @state() private tab: DrawerTab = 'details';
  @state() private photo: { phase: 'idle' | 'loading' | 'ready' | 'error'; url: string; reason: string } = { phase: 'idle', url: '', reason: '' };
  private photoFor = '';

  static styles = css`
    :host {
      display: contents;
    }
    .head {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .head .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .tabs {
      display: flex;
      gap: 4px;
      padding: 4px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-3);
    }
    .tabs button {
      flex: 1;
      min-block-size: 44px;
      border: 0;
      border-radius: var(--sw-r-sm);
      background: transparent;
      color: var(--sw-text-2);
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      cursor: pointer;
    }
    .tabs button[aria-selected='true'] {
      background: var(--sw-surface);
      color: var(--sw-heading, var(--sw-text));
      font-weight: var(--sw-fw-bold);
      box-shadow: var(--sw-shadow-1);
    }
    .tabs button {
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      transition: background var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out);
    }
    .tabs button:active {
      transform: scale(var(--sw-press-scale));
    }
    /* R5-SECURITY: the badges in the head and the sections are fields - 12.5/700 on 22 px */
    sw-badge {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-bold);
      line-height: 18px;
      padding-block: 2px;
    }
    .tabs button:focus-visible,
    .linkbtn:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    /* R5-SECURITY: section headings in the heading ink (14.5/700); values 14/600; the sensitive section is a well (a tone step, no edge) */
    h4 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
    }
    section.sens {
      padding: 14px;
      border: 1px solid transparent;
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface-2);
    }
    dl {
      display: grid;
      grid-template-columns: minmax(0, 8rem) minmax(0, 1fr);
      gap: 8px 12px;
      margin: 0;
      font-size: var(--sw-fs-base);
    }
    dt {
      color: var(--sw-text-3);
    }
    dd {
      margin: 0;
      min-inline-size: 0;
      overflow-wrap: anywhere;
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text);
      font-variant-numeric: tabular-nums;
    }
    .sub {
      color: var(--sw-text-3);
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    li.station {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px 10px;
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    li.station:last-child {
      border-block-end: 0;
    }
    li.station .name {
      flex: 1 1 8rem;
      min-inline-size: 0;
      font-weight: var(--sw-fw-bold);
      font-size: var(--sw-fs-md);
      color: var(--sw-heading, var(--sw-text));
    }
    li.station .err {
      flex-basis: 100%;
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-xs);
    }
    .portrait {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .frame {
      display: grid;
      place-items: center;
      inline-size: 88px;
      block-size: 88px;
      flex-shrink: 0;
      border-radius: 50%;
      overflow: hidden;
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-bold);
      border: 2px solid var(--sw-surface);
      box-shadow: var(--sw-shadow-2);
    }
    .frame img {
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
    }
    .linkbtn {
      min-block-size: 44px;
      padding-inline: 12px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
    }
    .skeleton {
      block-size: 14px;
      border-radius: var(--sw-r-xs);
      background: linear-gradient(90deg, var(--sw-surface-3), var(--sw-surface-2), var(--sw-surface-3));
      background-size: 200% 100%;
      animation: shimmer 1.4s linear infinite;
    }
    @keyframes shimmer {
      to {
        background-position: -200% 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .skeleton {
        animation: none;
      }
    }
    sw-button {
      min-block-size: 44px;
    }
    .result {
      margin: 0;
      padding: 8px 12px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
    }
    .result.saved,
    .result.deleted {
      background: var(--sw-success-soft);
      color: var(--sw-text);
    }
    .result.pending,
    .result.unknown {
      background: var(--sw-stale-soft);
      color: var(--sw-text);
    }
    .result.refused,
    .result.not_sent {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
  `;

  protected willUpdate(changed: PropertyValues<this>) {
    const id = this.person?.id ?? '';
    if (changed.has('person') && id !== this.photoFor) {
      this.dropPhoto();
      this.photoFor = id;
      this.tab = 'details';
    }
    if (changed.has('open') && !this.open) this.dropPhoto();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.dropPhoto();
  }

  private dropPhoto() {
    if (this.photo.url) URL.revokeObjectURL(this.photo.url);
    this.photo = { phase: 'idle', url: '', reason: '' };
  }

  private async showPhoto() {
    const p = this.person;
    if (!p) return;
    this.photo = { phase: 'loading', url: '', reason: '' };
    const result = await fetchPersonPhoto(p.id);
    if (this.person?.id !== p.id || !this.open) {
      if ('url' in result) URL.revokeObjectURL(result.url);
      return;
    }
    this.photo = 'url' in result ? { phase: 'ready', url: result.url, reason: '' } : { phase: 'error', url: '', reason: result.error };
  }

  private fire(name: string, detail: unknown = {}) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  // ------------------------------------------------------------------ render

  private renderDetails(p: AcPerson, full: boolean): TemplateResult {
    const s = personSections(p);
    const timing = timingView(p.timing);
    const creds = credentialKinds(p);
    const cat = p.access_category && p.access_category !== 'unknown' ? pt(`category.${p.access_category}`) : '';
    return html`
      <section data-person-section="details">
        <h4>${pt('drawer.tab_details')}</h4>
        <dl>
          ${s.employeeNo ? html`<dt>${pt('drawer.employee')}</dt><dd><bdi class="ltr" data-person-employee>${p.employee_no}</bdi></dd>` : nothing}
          ${cat ? html`<dt>${pt('drawer.category')}</dt><dd>${cat}</dd>` : nothing}
          <dt>${pt('drawer.validity')}</dt><dd data-person-validity>${validityText(p, this.zone)}</dd>
          ${full
            ? html`<dt>${pt('drawer.timing')}</dt><dd data-person-timing>${!timing
                ? pt('drawer.timing_always')
                : html`${timing.mode === 'weekly' ? html`${timing.days.length ? html`<div>${pt('drawer.timing_days')}: ${timing.days.join(', ')}</div>` : nothing}` : nothing}
                    ${timing.mode === 'dates' ? html`<div>${pt('drawer.timing_dates')}: <bdi class="ltr">${timing.dates.join(', ')}</bdi>${timing.moreDates ? ` +${timing.moreDates}` : ''}</div>` : nothing}
                    <div>${pt('drawer.timing_hours')}: ${timing.hours ? html`<bdi class="ltr">${timing.hours}</bdi>` : pt('drawer.timing_always')}</div>
                    ${timing.timezone ? html`<div class="sub">${pt('drawer.timing_zone')}: <bdi class="ltr">${timing.timezone}</bdi></div>` : nothing}`}</dd>`
            : html`<dt>${pt('drawer.timing')}</dt><dd><div class="skeleton" style="inline-size:60%"></div></dd>`}
          ${s.credentials
            ? html`<dt>${pt('drawer.credentials')}</dt><dd data-person-credentials>${!creds
                ? pt('drawer.unknown_value')
                : creds.kinds.length
                  ? creds.kinds.map((k) => (k === 'card' ? (creds.cards > 1 ? pt('cred.cards', { n: creds.cards }) : pt('cred.card')) : pt('cred.pin'))).join(' · ')
                  : creds.none
                    ? pt('cred.none')
                    : pt('cred.unknown')}</dd>`
            : nothing}
        </dl>
      </section>
      ${s.sensitive ? this.renderSensitive(p, s, full) : nothing}`;
  }

  private renderSensitive(p: AcPerson, s: ReturnType<typeof personSections>, full: boolean): TemplateResult {
    const photoPart = s.photo && this.photoEnabled
      ? html`<div class="portrait" data-person-portrait>
          <div class="frame" aria-hidden=${this.photo.phase === 'ready' ? 'false' : 'true'}>${this.photo.phase === 'ready' ? html`<img src=${this.photo.url} alt=${p.display_name} data-person-photo-img />` : initials(p.display_name)}</div>
          <div>
            ${p.photo_configured === true
              ? this.photo.phase === 'ready'
                ? html`<button type="button" class="linkbtn" data-person-photo-hide @click=${() => this.dropPhoto()}>${pt('action.hide_photo')}</button>`
                : this.photo.phase === 'loading'
                  ? html`<span class="sub" role="status">${pt('drawer.photo_loading')}</span>`
                  : html`<button type="button" class="linkbtn" data-person-photo-show @click=${() => void this.showPhoto()}>${pt('action.show_photo')}</button>${this.photo.phase === 'error' ? html`<div class="sub" role="status" data-person-photo-error=${this.photo.reason}>${pt('drawer.photo_error')}</div>` : nothing}`
              : html`<span class="sub">${pt('drawer.no_photo')}</span>`}
          </div>
        </div>`
      : nothing;
    const labels = new Map((this.fields ?? []).map((f) => [f.id, f.label]));
    const profile = Object.entries(p.profile ?? {});
    return html`<section class="sens" data-person-section="sensitive" aria-label=${pt('drawer.sensitive')}>
      <h4><sw-icon name="lock" size=${14}></sw-icon>${pt('drawer.sensitive')}</h4>
      ${photoPart}
      ${full
        ? html`<dl>
            <dt>${pt('drawer.phone')}</dt><dd data-person-phone>${p.phone ? html`<bdi class="ltr">${p.phone}</bdi>` : p.phone_set === false ? pt('drawer.no_phone') : pt('drawer.unknown_value')}</dd>
            ${s.responsible ? html`<dt>${pt('drawer.responsible')}</dt><dd>${p.responsible_person}</dd>` : nothing}
            ${s.purpose ? html`<dt>${pt('drawer.purpose')}</dt><dd>${p.access_purpose}</dd>` : nothing}
            ${s.profile ? profile.map(([k, v]) => html`<dt>${labels.get(k) ?? k}</dt><dd data-person-profile=${k}>${v}</dd>`) : nothing}
          </dl>`
        : html`<div class="skeleton" style="inline-size:70%"></div>`}
    </section>`;
  }

  private renderAccess(p: AcPerson): TemplateResult {
    const rows = p.stations ?? [];
    return html`<section data-person-section="access">
      <h4>${pt('drawer.stations')}</h4>
      ${rows.length === 0
        ? html`<span class="sub" data-person-no-access>${pt('drawer.no_access')}</span>`
        : html`<ul>${rows.map((st) => {
            const b = syncKind(personSyncStatus({ stations: [st] }));
            return html`<li class="station" data-person-station=${st.station_id}>
              <span class="name">${this.stationNames[st.station_id] ?? st.station_id}</span>
              ${st.doors.length ? html`<span class="sub">${pt(st.doors.length === 1 ? 'drawer.door' : 'drawer.doors', { doors: st.doors.join(', ') })}</span>` : nothing}
              ${st.enabled ? nothing : html`<sw-badge kind="neutral" label=${pt('drawer.access_off')}></sw-badge>`}
              <sw-badge data-person-sync=${personSyncStatus({ stations: [st] })} kind=${b.kind} label=${b.label}></sw-badge>
              ${st.last_error ? html`<span class="err" data-person-sync-error=${st.last_error} title=${st.last_error}>${knownSyncError(st.last_error) ? syncErrorText(st.last_error) : html`<bdi class="ltr">${st.last_error}</bdi>`}</span>` : nothing}
            </li>`;
          })}</ul>`}
    </section>
    ${isApi() ? html`<wiskey-station-permissions .personId=${p.id} .stationNames=${this.stationNames}></wiskey-station-permissions>` : nothing}`;
  }

  private renderGroups(p: AcPerson): TemplateResult {
    const ids = p.group_ids ?? [];
    return html`<section data-person-section="groups">
      <h4>${pt('drawer.groups')}</h4>
      ${ids.length === 0
        ? html`<span class="sub" data-person-no-groups>${pt('drawer.no_groups')}</span>`
        : html`<ul>${ids.map((id) => {
            const n = this.groupStations[id];
            return html`<li class="station" data-person-group=${id}><span class="name">${this.groupLabels[id] ?? id}</span>${typeof n === 'number' ? html`<span class="sub">${pt('drawer.group_stations', { n })}</span>` : nothing}</li>`;
          })}</ul>`}
    </section>`;
  }

  render() {
    const p = this.person;
    const full = !!p && !this.loading && !this.error;
    const heading = p?.display_name ?? '';
    const subheading = p && p.employee_no !== null ? `${pt('drawer.employee')} ${p.employee_no}` : '';
    const showMessages = this.messagesTab && !!this.transport;
    const tabs: [DrawerTab, string][] = [['details', pt('drawer.tab_details')], ['access', pt('drawer.tab_access')], ['groups', pt('drawer.tab_groups')], ...(showMessages ? [['messages', pt('drawer.tab_messages')] as [DrawerTab, string]] : [])];
    const tab: DrawerTab = this.tab === 'messages' && !showMessages ? 'details' : this.tab;
    const sb = p ? stateBadge(p) : null;
    const sync = p ? syncKind(personSyncStatus(p)) : null;
    return html`<sw-drawer modal ?open=${this.open} heading=${heading} subheading=${subheading} data-person-drawer @close=${(e: Event) => e.target === e.currentTarget && this.fire('close')}>
      ${p
        ? html`
            <div class="head">
              <sw-avatar name=${p.display_name} size=${44} aria-hidden="true"></sw-avatar>
              <div class="tags">
                <sw-badge data-person-state=${stateOf(p)} kind=${sb!.kind} label=${sb!.label}></sw-badge>
                ${enabledStations(p) || p.stations?.length ? html`<sw-badge data-person-sync-all=${personSyncStatus(p)} kind=${sync!.kind} label=${sync!.label}></sw-badge>` : nothing}
              </div>
            </div>
            ${this.resultLine ? html`<p class="result ${this.resultLine.state}" role="status" data-person-result=${this.resultLine.state}>${this.resultLine.text}</p>` : nothing}
            ${this.error
              ? html`<sw-state-panel icon="user" compact data-person-error=${this.error} state=${this.error === 'gone' ? 'empty' : 'error'} heading=${this.error === 'gone' ? pt('state.detail_gone') : pt('state.detail_error')}></sw-state-panel>`
              : nothing}
            <div class="tabs" role="tablist" aria-label=${pt('drawer.tabs')}>
              ${tabs.map(([id, label]) => html`<button type="button" role="tab" id="tab-${id}" aria-selected=${tab === id} aria-controls="panel-${id}" data-person-tab=${id} @click=${() => (this.tab = id)}>${label}</button>`)}
            </div>
            <div role="tabpanel" id="panel-${tab}" aria-labelledby="tab-${tab}" style="display:flex;flex-direction:column;gap:12px">
              ${tab === 'details' ? this.renderDetails(p, full) : tab === 'access' ? this.renderAccess(p) : tab === 'groups' ? this.renderGroups(p) : html`<wiskey-person-messages .transport=${this.transport} .personId=${p.id} .zone=${this.zone} .rev=${this.messagesRev}></wiskey-person-messages>`}
            </div>`
        : nothing}
      ${p && (this.canMessage || this.canEdit || this.canAct)
        ? html`<div slot="footer" style="display:contents">
            ${this.canMessage ? html`<sw-button icon="mail" data-person-message @click=${() => this.fire('message', { id: p.id })}>${pt('action.message')}</sw-button>` : nothing}
            ${this.canAct ? html`<sw-button icon="more" data-person-actions-open @click=${() => this.fire('actions', { id: p.id })}>${wt('actions.open')}</sw-button>` : nothing}
            ${this.canEdit ? html`<sw-button variant="primary" icon="edit" data-wiskey-person-edit @click=${() => this.fire('edit', { id: p.id })}>${pt('action.edit')}</sw-button>` : nothing}
          </div>`
        : nothing}
      <slot></slot>
    </sw-drawer>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wiskey-person-drawer': WiskeyPersonDrawer;
  }
}
