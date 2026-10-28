import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-icon';
import { ApiError } from '../api/client';
import { fetchEventPortrait, getAccessEventDetail, type AccessEvent, type AccessEventDetail } from '../api/access-events';
import type { DisplayZone } from '../api/intercom';
import { addDays, dateLabel, dateOf, hasPortrait, localDate, localTime, showsMethod } from '../access-control/events-logic';
import { offsetAt, offsetLabel } from './wiskey-format';
import { ev, evDynamic } from '../i18n/access-events';
import { glyph } from '../access-control/glyphs';

type PortraitState = { kind: 'none' } | { kind: 'loading' } | { kind: 'ready'; url: string } | { kind: 'gone' } | { kind: 'error' };
type DetailState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ready'; event: AccessEventDetail } | { kind: 'failed' } | { kind: 'unsupported' };

/**
 * CR-036 S8: the body of the entry-log drawer - one event: when, where, how, and (when the server says the caller may open it) the
 * event picture. Mounted by `wiskey-events` inside a modal `sw-drawer` only while a row is open, so closing the drawer removes it:
 * a request still in flight is aborted and the picture's object URL is released.
 *
 * What it asks, and when:
 *  - `GET events/{id}` once per opened row, for the evidence of how the identity and the time were established;
 *  - `GET events/{id}/portrait?station_id=&at=` once per opened row and ONLY when the row said `portrait: true` - each of those is
 *    an audited view on the server (unless the administrator switched that off), so the picture is never fetched for a row nobody
 *    opened, never again on a re-render, and again only by the person's own "try again".
 * A section the caller may not see is absent, never greyed (`portrait: null` = the picture is not for them). Nothing here names the
 * platform; the person's card, PIN and phone do not exist in the data at all.
 */
@customElement('wiskey-event-drawer')
export class WiskeyEventDrawer extends LitElement {
  @property({ attribute: false }) event: AccessEvent | null = null;
  @property({ attribute: false }) zone!: DisplayZone;
  @property() stationName = '';
  /** The integration offers the evidence read / the picture read (features `event_detail`, `event_portrait`). */
  @property({ type: Boolean }) detailOn = true;
  @property({ type: Boolean }) portraitOn = true;
  /** The page's "now", for "today" / "yesterday" (a property so the screen and the tests agree on it). */
  @property({ attribute: false }) now: Date = new Date();
  @state() private portrait: PortraitState = { kind: 'none' };
  @state() private detail: DetailState = { kind: 'idle' };
  private ctl: AbortController | null = null;
  private loadedFor = '';

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-inline-size: 0;
    }
    /* R5-SECURITY: the sections are wells (a tone step, no edge, radius lg); headings 14.5/700 in the heading ink; values 600 */
    .sect {
      border: 1px solid transparent;
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface-2);
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-inline-size: 0;
    }
    .sect.sens {
      background: var(--sw-surface-3);
    }
    h4 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
    }
    dl {
      display: grid;
      grid-template-columns: minmax(84px, 110px) minmax(0, 1fr);
      gap: 6px 12px;
      margin: 0;
      font-size: var(--sw-fs-base);
    }
    dt {
      color: var(--sw-text-3);
    }
    dd {
      margin: 0;
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
      font-variant-numeric: tabular-nums;
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    dd:first-of-type {
      font-size: var(--sw-fs-lg);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
    }
    bdi {
      unicode-bidi: isolate;
    }
    .frame {
      position: relative;
      aspect-ratio: 4 / 3;
      border-radius: var(--sw-r-sm);
      overflow: hidden;
      display: grid;
      place-items: center;
      background: var(--sw-surface-3);
      color: var(--sw-text-3);
    }
    .frame img {
      inline-size: 100%;
      block-size: 100%;
      object-fit: contain;
      display: block;
    }
    .frame .msg {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 12px;
      text-align: center;
      font-size: var(--sw-fs-sm);
    }
    .frame.loading::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(100deg, transparent 30%, var(--sw-skeleton-shine) 50%, transparent 70%);
      animation: sheen 1.4s var(--sw-ease) infinite;
    }
    @keyframes sheen {
      from {
        transform: translateX(-100%);
      }
      to {
        transform: translateX(100%);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .frame.loading::after {
        animation: none;
      }
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
  `;

  willUpdate(changed: PropertyValues<this>) {
    if (changed.has('event') && (this.event?.id ?? '') !== this.loadedFor) this.begin();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.end();
  }

  private end() {
    this.ctl?.abort();
    this.ctl = null;
    if (this.portrait.kind === 'ready') URL.revokeObjectURL(this.portrait.url);
    this.loadedFor = '';
  }

  private begin() {
    this.end();
    this.portrait = { kind: 'none' };
    this.detail = { kind: 'idle' };
    const e = this.event;
    if (!e) return;
    this.loadedFor = e.id;
    this.ctl = new AbortController();
    void this.loadDetail(e, this.ctl);
    void this.loadPortrait(e, this.ctl);
  }

  private async loadDetail(e: AccessEvent, ctl: AbortController) {
    if (!this.detailOn) return;
    this.detail = { kind: 'loading' };
    try {
      const r = await getAccessEventDetail(e.id, ctl.signal);
      if (ctl.signal.aborted) return;
      this.detail = r.state === 'unsupported' ? { kind: 'unsupported' } : r.event ? { kind: 'ready', event: r.event } : { kind: 'failed' };
    } catch {
      if (!ctl.signal.aborted) this.detail = { kind: 'failed' };
    }
  }

  private async loadPortrait(e: AccessEvent, ctl: AbortController) {
    if (!this.portraitOn || !hasPortrait(e) || !e.station_id || !e.timestamp) return;
    this.portrait = { kind: 'loading' };
    try {
      const blob = await fetchEventPortrait(e.id, e.station_id, e.timestamp, ctl.signal);
      if (ctl.signal.aborted) return;
      this.portrait = { kind: 'ready', url: URL.createObjectURL(blob) };
    } catch (err) {
      if (ctl.signal.aborted) return;
      const code = err instanceof ApiError ? err.code : '';
      this.portrait = { kind: code === 'intercom_photo_not_found' || code === 'intercom_event_not_found' ? 'gone' : 'error' };
    }
  }

  /** The person's own "try again": one more view (one more audit row), asked for. */
  private retryPortrait() {
    const e = this.event;
    if (!e || !this.ctl) return;
    void this.loadPortrait(e, this.ctl);
  }

  private when(e: AccessEvent): string {
    if (!e.timestamp) return '—';
    const ms = Date.parse(e.timestamp);
    if (!Number.isFinite(ms)) return '—';
    const date = dateOf(e.timestamp, this.zone);
    const today = localDate(this.now.getTime(), this.zone);
    const day = date === today ? ev('dayToday') : date === addDays(today, -1) ? ev('dayYesterday') : dateLabel(date);
    return `${day} ${localTime(e.timestamp, this.zone, true)}`;
  }

  private row(label: string, value: unknown, attr = '') {
    return html`<dt>${label}</dt><dd data-ev-field=${attr || nothing}>${value}</dd>`;
  }

  render() {
    const e = this.event;
    if (!e) return nothing;
    const ms = e.timestamp ? Date.parse(e.timestamp) : NaN;
    const offset = Number.isFinite(ms) ? offsetLabel(offsetAt(ms, this.zone)) : '';
    const d = this.detail.kind === 'ready' ? this.detail.event : null;
    const ev0 = d?.evidence ?? null;
    const source = ev0?.time_source ?? e.time_source;
    const received = e.received_at && e.time_source !== 'received' ? `${localTime(e.received_at, this.zone, true)}` : '';
    const delay = ev0?.arrival_delay_seconds;
    const showPicture = this.portraitOn && hasPortrait(e);
    const p = this.portrait;
    const named = !!(e.person_name || e.employee_no);
    return html`
      <section class="sect" data-ev-section="event">
        <h4>${glyph('card', 13)}${ev('dEvent')}</h4>
        <dl>
          ${this.row(ev('dTime'), html`<bdi>${this.when(e)}</bdi>${offset ? html` <bdi class="muted">${offset}</bdi>` : nothing}`, 'time')}
          ${this.row(ev('dStation'), this.stationName || '—', 'station')}
          ${e.door ? this.row(ev('dDoor'), e.door, 'door') : nothing}
          ${showsMethod(e) ? this.row(ev('dMethod'), e.authentication === 'card' ? ev('card') : e.authentication === 'pin' ? ev('pin') : ev('unknown'), 'method') : nothing}
          ${this.row(ev('dType'), evDynamic('long_', e.event_type), 'type')}
          ${source ? this.row(ev('dTimeSource'), source === 'received' ? ev('tsReceived') : ev('tsDevice'), 'time-source') : nothing}
          ${received ? this.row(ev('dReceived'), html`<bdi>${received}</bdi>`, 'received') : nothing}
          ${ev0?.identity_state ? this.row(ev('dIdentity'), evDynamic('identity_', ev0.identity_state), 'identity') : nothing}
          ${ev0?.origin ? this.row(ev('dOrigin'), evDynamic('origin_', ev0.origin), 'origin') : nothing}
          ${delay ? this.row(ev('dDelay'), ev('dDelaySeconds', { n: delay }), 'delay') : nothing}
          ${e.recovered ? this.row(ev('dRecordKind'), ev('dRecovered'), 'recovered') : nothing}
        </dl>
        ${this.detail.kind === 'failed' ? html`<div class="muted" data-ev-detail-failed>${ev('dDetailFail')}</div>` : nothing}
      </section>
      ${showPicture
        ? html`<section class="sect sens" data-ev-section="portrait" aria-label=${ev('dPicture')}>
            <h4><sw-icon name="lock" size=${13}></sw-icon>${ev('dPicture')}</h4>
            <div class="frame ${p.kind === 'loading' ? 'loading' : ''}" data-ev-portrait=${p.kind} role=${p.kind === 'loading' ? 'status' : nothing} aria-label=${p.kind === 'loading' ? ev('dPictureLoading') : nothing}>
              ${p.kind === 'ready'
                ? html`<img src=${p.url} alt=${ev('dPictureAlt')} data-ev-portrait-img />`
                : p.kind === 'gone'
                  ? html`<div class="msg"><sw-icon name="image" size=${24}></sw-icon><span>${ev('dPictureGone')}</span></div>`
                  : p.kind === 'error'
                    ? html`<div class="msg"><sw-icon name="warning" size=${24}></sw-icon><span>${ev('dPictureFail')}</span><sw-button size="lg" variant="secondary" icon="refresh" data-ev-portrait-retry @click=${() => this.retryPortrait()}>${ev('retry')}</sw-button></div>`
                    : html`<sw-icon name="user" size=${28}></sw-icon>`}
            </div>
          </section>`
        : nothing}
      ${named
        ? html`<section class="sect" data-ev-section="person">
            <h4><sw-icon name="user" size=${13}></sw-icon>${ev('dPerson')}</h4>
            <dl>
              ${e.person_name ? this.row(ev('dName'), e.person_name, 'name') : nothing}
              ${e.employee_no ? this.row(ev('dEmployee'), html`<bdi>${e.employee_no}</bdi>`, 'employee') : nothing}
            </dl>
          </section>`
        : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wiskey-event-drawer': WiskeyEventDrawer;
  }
}
