import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ticketsApi } from '../api/tickets';
import { tIcon } from './icons';
import { dt } from './device-text';
import { deviceTicketsOn } from './device-entry';
import { onTicketNames } from './naming';
import { OPEN_EVENT, type ActivityOpen } from '../components/device-activity-press';

/** Open the device window on its "{tickets}" tab (the map card's entry; section 12.1). The map knows no `activity` flag: the window
 * shows the tickets tab only (`tracked: false`). */
export function openDeviceTickets(entityId: string, name: string, state = '', opener: HTMLElement | null = null): void {
  window.dispatchEvent(new CustomEvent<ActivityOpen>(OPEN_EVENT, { detail: { target: { id: entityId, kind: 'generic', name, state, tracked: false }, tab: 'tickets', opener } }));
}

/**
 * CR-038 slice 3 `<ticket-count-chip entity-id>`: the small chip on the face of the floor map's device card - the number of OPEN tickets of
 * the device the user may see, only when there is at least one (a state chip, no text: the clean-screen rule allows it). Renders nothing
 * while the module is off, without tickets.view / devices.read, or when the server answers anything but a list.
 */
@customElement('ticket-count-chip')
export class TicketCountChip extends LitElement {
  @property({ attribute: 'entity-id' }) entityId = '';
  @state() private count = 0;
  private token = 0;
  private offNames: (() => void) | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.offNames = onTicketNames(() => this.requestUpdate());
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.offNames?.();
    this.token++;
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('entityId')) void this.load();
  }

  private async load(): Promise<void> {
    const mine = ++this.token;
    this.count = 0;
    if (!this.entityId || !deviceTicketsOn()) return;
    try {
      const d = await ticketsApi().byEntity(this.entityId);
      if (mine === this.token) this.count = d.open_count;
    } catch {
      /* no chip */
    }
  }

  render() {
    if (!this.count) return nothing;
    return html`<span class="chip" role="img" aria-label=${dt('countChip', { n: this.count })} title=${dt('countChip', { n: this.count })} data-ticket-count=${this.count}>${tIcon('ticket')}<bdi>${this.count}</bdi></span>`;
  }

  static styles = css`
    :host { display: inline-flex; }
    .chip {
      display: inline-flex; align-items: center; gap: 4px; padding: 1px 8px; border-radius: var(--sw-r-pill); background: var(--sw-warning-soft); color: var(--sw-warning-text);
      font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-semibold); font-variant-numeric: tabular-nums; line-height: 1.6;
    }
    .chip svg { inline-size: 1.1em; block-size: 1.1em; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'ticket-count-chip': TicketCountChip;
  }
}
